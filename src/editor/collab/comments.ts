"use client";

import { create } from "zustand";
import { addComment, deleteComment, listComments, setResolved, type CommentRow } from "@/lib/data/comments-api";
import { useProject } from "../project-session";
import { commentEvents, notifyComments } from "./session";

/**
 * Commentaires du tableau affiché : fils (un commentaire principal, éventuellement épinglé sur le
 * tableau) et réponses. Relus quand un autre entraîneur en écrit (événement « comments »).
 */
export interface Thread {
  root: CommentRow;
  replies: CommentRow[];
  /** Numéro d'affichage de l'épingle (fils épinglés et ouverts). */
  pin: number | null;
}

interface CommentsState {
  board: string | null;
  rows: CommentRow[];
  loading: boolean;
  error: boolean;
  /** Panneau ouvert, et fil mis en avant. */
  open: boolean;
  focus: string | null;
  /** Épingle choisie sur le tableau pour le prochain fil. */
  draftPin: { x: number; y: number } | null;
}

export const useComments = create<CommentsState>(() => ({
  board: null,
  rows: [],
  loading: false,
  error: false,
  open: false,
  focus: null,
  draftPin: null,
}));

/** Regroupe les commentaires en fils : ouverts d'abord, puis résolus ; les plus récents en haut. */
export function threads(rows: CommentRow[]): Thread[] {
  const roots = rows.filter((r) => !r.parent_id);
  const list = roots.map((root) => ({
    root,
    replies: rows.filter((r) => r.parent_id === root.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    pin: null as number | null,
  }));
  let n = 0;
  for (const t of [...list].sort((a, b) => a.root.created_at.localeCompare(b.root.created_at))) {
    if (t.root.x !== null && t.root.y !== null && !t.root.resolved_at) t.pin = ++n;
  }
  return list.sort(
    (a, b) => Number(!!a.root.resolved_at) - Number(!!b.root.resolved_at) || b.root.created_at.localeCompare(a.root.created_at),
  );
}

let request = 0;

export async function loadComments(board: string | null) {
  const mine = ++request;
  useComments.setState({ board, rows: board === useComments.getState().board ? useComments.getState().rows : [], loading: !!board, error: false });
  if (!board) return;
  try {
    const rows = await listComments(board);
    if (mine === request) useComments.setState({ rows, loading: false });
  } catch {
    if (mine === request) useComments.setState({ loading: false, error: true });
  }
}

commentEvents.changed = (board) => {
  if (board === useComments.getState().board) void loadComments(board);
};

async function mutate(action: () => Promise<unknown>) {
  const board = useComments.getState().board;
  if (!board) return;
  await action();
  await loadComments(board);
  notifyComments(board);
}

export function postThread(body: string) {
  const { board, draftPin } = useComments.getState();
  if (!board) return Promise.resolve();
  return mutate(async () => {
    const row = await addComment(board, body, draftPin ?? {});
    useComments.setState({ draftPin: null, focus: row.id });
  });
}

export function postReply(parentId: string, body: string) {
  const { board } = useComments.getState();
  if (!board) return Promise.resolve();
  return mutate(() => addComment(board, body, { parentId }));
}

export const resolveThread = (id: string, resolved: boolean) => mutate(() => setResolved(id, resolved));
export const removeComment = (id: string) => mutate(() => deleteComment(id));

export function openComments(focus: string | null = null) {
  useComments.setState({ open: true, focus });
}

export function closeComments() {
  useComments.setState({ open: false, focus: null, draftPin: null });
}

/** Le tableau affiché change : ses commentaires suivent. */
let watching: (() => void) | undefined;
export function watchBoard() {
  watching?.();
  void loadComments(useProject.getState().currentId);
  watching = useProject.subscribe((s, prev) => {
    if (s.currentId !== prev.currentId) void loadComments(s.currentId);
  });
  return () => {
    watching?.();
    watching = undefined;
    useComments.setState({ board: null, rows: [], open: false, focus: null, draftPin: null });
  };
}
