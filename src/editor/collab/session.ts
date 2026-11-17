"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { applyRemoteBoard, reloadBoards, sessionEvents, useProject } from "../project-session";
import type { Scene } from "../scene/types";
import { applyingRemote, useEditor } from "../store";
import { diffScenes, mergePatches, type ScenePatch } from "./patch";

/**
 * Édition à plusieurs d'un projet, en temps réel (Supabase Realtime, canal privé par projet).
 * - présence : qui est là, sur quel tableau ;
 * - « patch » : les changements de scène, objet par objet (voir patch.ts) ;
 * - « cursor » : le pointeur de chacun sur le tableau ;
 * - « hello » / « full » : un arrivant reçoit l'état le plus récent d'un tableau ;
 * - « boards » : la liste des tableaux a changé.
 * Le canal est privé : la base n'y admet que ceux qui peuvent lire le projet, et n'accepte les
 * changements que de ceux qui peuvent le modifier (politiques sur realtime.messages).
 */

export interface Peer {
  key: string;
  userId: string;
  name: string;
  color: string;
  board: string | null;
  readOnly: boolean;
}

export interface Cursor {
  x: number;
  y: number;
  board: string;
  at: number;
}

interface CollabState {
  status: "off" | "connecting" | "live" | "error";
  peers: Peer[];
  cursors: Record<string, Cursor>;
}

export const useCollab = create<CollabState>(() => ({ status: "off", peers: [], cursors: {} }));

const COLORS = ["#e11d48", "#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#c026d3", "#2563eb", "#ca8a04"];
const SEND_DELAY = 40;
const CURSOR_DELAY = 50;
const CURSOR_TTL = 6000;

export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

let channel: RealtimeChannel | null = null;
let me: Peer | null = null;
let projectId: string | null = null;
/** Dernier état envoyé (ou reçu) du tableau affiché : on n'envoie que la différence. */
let lastSent: Scene | null = null;
let lastBoard: string | null = null;
let pending: ScenePatch | null = null;
let sendTimer: ReturnType<typeof setTimeout> | undefined;
let cursorTimer: ReturnType<typeof setTimeout> | undefined;
let nextCursor: { x: number; y: number } | null = null;
let stopWatching: (() => void) | undefined;
let sweep: ReturnType<typeof setInterval> | undefined;
/** Instant d'arrivée : un état complet n'est accepté qu'au début, avant toute modification. */
let joinedAt = 0;

const currentBoard = () => useProject.getState().currentId;

function send(event: string, payload: Record<string, unknown>) {
  if (!channel || useCollab.getState().status !== "live") return;
  void channel.send({ type: "broadcast", event, payload: { ...payload, from: me?.key } });
}

function flushPatch() {
  clearTimeout(sendTimer);
  sendTimer = undefined;
  if (!pending || !lastBoard) return;
  send("patch", { board: lastBoard, patch: pending });
  pending = null;
}

/** Suit la scène affichée : chaque changement local part, regroupé, vers les autres. */
function watchScene() {
  lastSent = useEditor.getState().scene;
  lastBoard = currentBoard();
  return useEditor.subscribe((state) => {
    const board = currentBoard();
    if (board !== lastBoard) {
      // Changement de tableau : on repart de la scène affichée, rien à envoyer.
      flushPatch();
      lastBoard = board;
      lastSent = state.scene;
      updatePresence();
      return;
    }
    if (state.scene === lastSent) return;
    if (applyingRemote() || state.readOnly) {
      lastSent = state.scene;
      return;
    }
    const patch = lastSent ? diffScenes(lastSent, state.scene) : null;
    lastSent = state.scene;
    if (!patch) return;
    pending = mergePatches(pending, patch);
    sendTimer ??= setTimeout(flushPatch, SEND_DELAY);
  });
}

function updatePresence() {
  if (!channel || !me) return;
  me = { ...me, board: currentBoard() };
  void channel.track(me);
}

function readPresence() {
  if (!channel) return;
  const state = channel.presenceState<Peer>();
  const peers = Object.entries(state)
    .filter(([key]) => key !== me?.key)
    .map(([, metas]) => metas[metas.length - 1])
    .filter((p): p is Peer & { presence_ref: string } => !!p?.userId);
  const keys = new Set(peers.map((p) => p.key));
  useCollab.setState((s) => ({
    peers,
    cursors: Object.fromEntries(Object.entries(s.cursors).filter(([key]) => keys.has(key))),
  }));
}

type Incoming<T> = { payload: T & { from?: string } };

/** Rejoint le canal du projet ouvert. Sans effet hors connexion (éditeur de démonstration). */
export async function startCollab(id: string) {
  stopCollab();
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || projectId) return;
  projectId = id;
  const key = crypto.randomUUID();
  const name = (user.user_metadata?.full_name as string | undefined) || user.email?.split("@")[0] || "?";
  me = { key, userId: user.id, name, color: colorFor(user.id), board: currentBoard(), readOnly: useEditor.getState().readOnly };
  useCollab.setState({ status: "connecting", peers: [], cursors: {} });
  // Le jeton de session autorise l'accès au canal privé.
  await supabase.realtime.setAuth(data.session!.access_token);
  const ch = supabase.channel(`project:${id}`, {
    config: { private: true, broadcast: { self: false }, presence: { key } },
  });
  channel = ch;

  ch.on("presence", { event: "sync" }, readPresence)
    .on("broadcast", { event: "patch" }, ({ payload }: Incoming<{ board: string; patch: ScenePatch }>) => {
      if (payload.board === currentBoard()) {
        flushPatch();
        applyRemoteBoard(payload.board, payload.patch);
        lastSent = useEditor.getState().scene;
      } else {
        applyRemoteBoard(payload.board, payload.patch);
      }
    })
    .on("broadcast", { event: "cursor" }, ({ payload }: Incoming<{ board: string; x: number; y: number }>) => {
      if (!payload.from) return;
      const cursor = { x: payload.x, y: payload.y, board: payload.board, at: Date.now() };
      useCollab.setState((s) => ({ cursors: { ...s.cursors, [payload.from!]: cursor } }));
    })
    .on("broadcast", { event: "cursor-out" }, ({ payload }: Incoming<object>) => {
      if (!payload.from) return;
      useCollab.setState((s) => {
        const cursors = { ...s.cursors };
        delete cursors[payload.from!];
        return { cursors };
      });
    })
    .on("broadcast", { event: "hello" }, ({ payload }: Incoming<{ board: string }>) => {
      // Un arrivant sur notre tableau : on lui envoie notre état, peut-être plus récent que la base.
      if (payload.board === currentBoard() && !useEditor.getState().readOnly) {
        send("full", { to: payload.from, board: payload.board, scene: useEditor.getState().scene });
      }
    })
    .on("broadcast", { event: "full" }, ({ payload }: Incoming<{ to: string; board: string; scene: Scene }>) => {
      const editor = useEditor.getState();
      if (payload.to !== me?.key || payload.board !== currentBoard()) return;
      // Seulement juste après l'arrivée, et si l'on n'a encore rien modifié.
      if (Date.now() - joinedAt > 5000 || editor.past.length > 0) return;
      const patch = diffScenes(editor.scene, payload.scene);
      if (patch) applyRemoteBoard(payload.board, patch);
      lastSent = useEditor.getState().scene;
    })
    .on("broadcast", { event: "boards" }, () => void reloadBoards())
    .on("broadcast", { event: "comments" }, ({ payload }: Incoming<{ board: string }>) => commentEvents.changed(payload.board));

  ch.subscribe((status) => {
    if (channel !== ch) return;
    if (status === "SUBSCRIBED") {
      joinedAt = Date.now();
      useCollab.setState({ status: "live" });
      void ch.track(me!);
      if (!useEditor.getState().readOnly) send("hello", { board: currentBoard() });
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      useCollab.setState({ status: "error" });
    } else if (status === "CLOSED") {
      useCollab.setState({ status: "off" });
    }
  });

  stopWatching = watchScene();
  sessionEvents.boardsChanged = () => send("boards", {});
  sweep = setInterval(() => {
    const now = Date.now();
    const { cursors } = useCollab.getState();
    if (Object.values(cursors).some((c) => now - c.at > CURSOR_TTL)) {
      useCollab.setState({ cursors: Object.fromEntries(Object.entries(cursors).filter(([, c]) => now - c.at <= CURSOR_TTL)) });
    }
  }, 2000);
}

/** Les commentaires d'un tableau ont changé : les autres les relisent. */
export function notifyComments(board: string) {
  send("comments", { board });
}

/** Abonnement aux commentaires modifiés par les autres. */
export const commentEvents: { changed: (board: string) => void } = { changed: () => {} };

export function stopCollab() {
  flushPatch();
  stopWatching?.();
  stopWatching = undefined;
  clearInterval(sweep);
  clearTimeout(cursorTimer);
  sessionEvents.boardsChanged = () => {};
  const ch = channel;
  channel = null;
  projectId = null;
  me = null;
  lastSent = null;
  lastBoard = null;
  pending = null;
  useCollab.setState({ status: "off", peers: [], cursors: {} });
  if (ch) void createClient().removeChannel(ch);
}

/** Position du pointeur sur le tableau (en mètres), envoyée aux autres quelques fois par seconde. */
export function shareCursor(point: { x: number; y: number } | null) {
  const board = currentBoard();
  if (!channel || !board) return;
  if (!point) {
    nextCursor = null;
    clearTimeout(cursorTimer);
    cursorTimer = undefined;
    send("cursor-out", {});
    return;
  }
  nextCursor = point;
  cursorTimer ??= setTimeout(() => {
    cursorTimer = undefined;
    if (nextCursor) send("cursor", { board, x: Math.round(nextCursor.x * 10) / 10, y: Math.round(nextCursor.y * 10) / 10 });
  }, CURSOR_DELAY);
}
