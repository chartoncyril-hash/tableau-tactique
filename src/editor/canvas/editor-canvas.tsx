"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import { create } from "zustand";
import { viewRect, worldRect } from "../pitches";
import { DEFAULT_EQUIPMENT_COLOR, defaultEquipmentScale } from "../scene/catalog";
import {
  arrowHead,
  boxesIntersect,
  objectBox,
  simplify,
  snapPoint,
} from "../scene/geometry";
import type { PlayerObject, SceneObject } from "../scene/types";
import { requestPhotos, usePhotos } from "@/lib/photos";
import { playbackTarget, restingPoses, usePlayback } from "../animation/playback";
import { movePath, resolveStep } from "../scene/animation";
import { displayObjects, lineDefaults, useEditor, type Tool } from "../store";
import { blockLines, voronoiCells } from "../scene/analysis";
import { shareCursor } from "../collab/session";
import { RemoteCursors } from "../collab/remote-cursors";
import { CommentPins } from "../collab/comment-pins";
import { useComments } from "../collab/comments";
import { keepUpright, ObjectNode, type NodeHandlers } from "./object-node";
import { PitchLayer } from "./pitch-layer";

interface Cam {
  scale: number;
  x: number;
  y: number;
}

type DraftShape =
  | { type: "rect" | "ellipse" | "line"; x0: number; y0: number; x1: number; y1: number }
  | { type: "freehand"; points: number[] }
  | { type: "polygon"; points: number[]; cx: number; cy: number };

type Gesture =
  | { kind: "pan"; sx: number; sy: number; cam: Cam }
  | { kind: "marquee"; x0: number; y0: number; additive: boolean }
  | { kind: "draw" }
  | { kind: "erase" };

const MIN_SCALE = 1.5;
const MAX_SCALE = 90;
const ACCENT = "#f4b740";
const SELECT = "#38bdf8";


/** État de vue partagé avec la barre du haut. */
export const useView = create<{ zoom: number }>(() => ({ zoom: 100 }));
export const canvasApi: { fit: () => void; zoomBy: (factor: number) => void } = {
  fit: () => {},
  zoomBy: () => {},
};

const zoneStyle = (tool: Tool) =>
  tool.type === "zone" && tool.hatch
    ? { pattern: "hatch" as const, opacity: 0.7 }
    : { pattern: "solid" as const, opacity: 0.3 };

const transformable = (o: SceneObject) =>
  !o.locked &&
  o.type !== "line" &&
  o.type !== "freehand" &&
  !(o.type === "zone" && o.shape === "polygon");

const snappable = (o: SceneObject) =>
  o.type === "player" ||
  o.type === "ball" ||
  o.type === "equipment" ||
  o.type === "text" ||
  (o.type === "zone" && o.shape !== "polygon");

export function EditorCanvas({ defaultText }: { defaultText: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const objectsRef = useRef<Konva.Layer>(null);
  const overlayRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const scene = useEditor((s) => s.scene);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const overlays = useEditor((s) => s.overlays);
  const step = useEditor((s) => s.currentStep);
  const previewing = usePlayback((s) => s.mode !== "idle");
  const playingStep = usePlayback((s) => s.step);
  const showTraces = usePlayback((s) => s.traces);
  /** Objets à leur position dans l'étape affichée. */
  const objects = useMemo(() => displayObjects(scene, step), [scene, step]);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCamState] = useState<Cam>({ scale: 8, x: 0, y: 0 });
  const camRef = useRef(cam);
  const sizeRef = useRef(size);
  /** Vrai dès que l'utilisateur a zoomé ou déplacé la vue : on ne recadre plus à sa place. */
  const userMoved = useRef(false);
  const fitScaleRef = useRef(8);
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const draftRef = useRef<DraftShape | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const marqueeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [spaceDown, setSpaceDown] = useState(false);
  const [trTick, setTrTick] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef<{ dist: number; cx: number; cy: number; cam: Cam } | null>(null);
  const dragRef = useRef<{
    id: string;
    node: Konva.Node;
    start: Map<string, { x: number; y: number }>;
    nodes: Map<string, Konva.Node>;
    snap: boolean;
    detached: boolean;
    cx: number[];
    cy: number[];
  } | null>(null);

  const setCam = useCallback((next: Cam) => {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale));
    const value = { ...next, scale };
    camRef.current = value;
    setCamState(value);
    useView.setState({ zoom: Math.round((scale / fitScaleRef.current) * 100) });
  }, []);

  const updateDraft = useCallback((next: DraftShape | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const updateMarquee = useCallback((next: typeof marqueeRef.current) => {
    marqueeRef.current = next;
    setMarquee(next);
  }, []);

  // --- Dimensions et cadrage -------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const rect = viewRect(useEditor.getState().scene.pitch);
    const pad = 5;
    const scale = Math.min(w / (rect.w + pad * 2), h / (rect.h + pad * 2));
    fitScaleRef.current = scale;
    userMoved.current = false;
    setCam({
      scale,
      x: (w - rect.w * scale) / 2 - rect.x * scale,
      y: (h - rect.h * scale) / 2 - rect.y * scale,
    });
  }, [setCam]);

  const zoomAt = useCallback(
    (sx: number, sy: number, scale: number) => {
      const c = camRef.current;
      userMoved.current = true;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      const wx = (sx - c.x) / c.scale;
      const wy = (sy - c.y) / c.scale;
      setCam({ scale: next, x: sx - wx * next, y: sy - wy * next });
    },
    [setCam],
  );

  useEffect(() => {
    // Recadrage quand le terrain change.
    fit();
  }, [fit, scene.pitch.view, scene.pitch.orientation, scene.pitch.sport]);

  useEffect(() => {
    const previous = sizeRef.current;
    sizeRef.current = size;
    if (!size.w || !size.h) return;
    if (userMoved.current && previous.w) {
      // La zone de dessin change de taille (panneau, barre d'options) : on garde le zoom
      // choisi et le même point au centre.
      const c = camRef.current;
      setCam({ ...c, x: c.x + (size.w - previous.w) / 2, y: c.y + (size.h - previous.h) / 2 });
    } else {
      fit();
    }
  }, [size, fit, setCam]);

  useEffect(() => {
    canvasApi.fit = fit;
    canvasApi.zoomBy = (factor) =>
      zoomAt(sizeRef.current.w / 2, sizeRef.current.h / 2, camRef.current.scale * factor);
  }, [fit, zoomAt]);

  // --- Clavier propre au canevas ---------------------------------------------
  const finishPolygon = useCallback(() => {
    const d = draftRef.current;
    if (d?.type !== "polygon") return;
    const pts: number[] = [];
    for (let i = 0; i < d.points.length; i += 2) {
      const last = pts.length - 2;
      if (last < 0 || Math.hypot(d.points[i] - pts[last], d.points[i + 1] - pts[last + 1]) > 0.4) {
        pts.push(d.points[i], d.points[i + 1]);
      }
    }
    updateDraft(null);
    if (pts.length < 6) return;
    const n = pts.length / 2;
    let ox = 0;
    let oy = 0;
    for (let i = 0; i < pts.length; i += 2) {
      ox += pts[i] / n;
      oy += pts[i + 1] / n;
    }
    useEditor.getState().addObject(
      {
        type: "zone",
        shape: "polygon",
        x: ox,
        y: oy,
        rotation: 0,
        width: 0,
        height: 0,
        points: pts.map((v, i) => v - (i % 2 === 0 ? ox : oy)),
        fill: ACCENT,
        ...zoneStyle(useEditor.getState().tool),
      },
      "addZone",
    );
  }, [updateDraft]);

  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        setSpaceDown(true);
      }
      if (e.key === "Enter") finishPolygon();
      if (e.key === "Escape" && draftRef.current) {
        updateDraft(null);
        gesture.current = null;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [finishPolygon, updateDraft]);

  // --- Gestes sur la scène ---------------------------------------------------
  const world = () => stageRef.current!.getRelativePointerPosition()!;

  /** Gomme : supprime l'objet non verrouillé sous le pointeur. */
  const eraseAtPointer = () => {
    const pos = stageRef.current?.getPointerPosition();
    if (!pos) return;
    const id = objectsRef.current?.getIntersection(pos)?.findAncestor(".object", true)?.id();
    if (!id) return;
    useEditor.getState().live((draftScene) => {
      const index = draftScene.objects.findIndex((o) => o.id === id && !o.locked);
      if (index >= 0) draftScene.objects.splice(index, 1);
    });
  };

  const onPointerDown = (e: KonvaEventObject<PointerEvent>) => {
    const stage = stageRef.current!;
    const evt = e.evt;
    if (pinch.current) return;
    // Pendant la lecture, le canevas ne sert qu'à déplacer la vue.
    if (previewing || tool.type === "pan" || spaceDown || evt.button === 1) {
      gesture.current = { kind: "pan", sx: evt.clientX, sy: evt.clientY, cam: camRef.current };
      return;
    }
    if (evt.pointerType === "mouse" && evt.button !== 0) return;
    if (e.target !== stage && e.target.getLayer() === overlayRef.current) return;
    const p = world();
    const st = useEditor.getState();

    switch (tool.type) {
      case "comment":
        useComments.setState({ draftPin: { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 } });
        st.setTool({ type: "select" });
        break;
      case "select":
        if (e.target === stage) {
          if (!evt.shiftKey) st.select([]);
          gesture.current = { kind: "marquee", x0: p.x, y0: p.y, additive: evt.shiftKey };
          updateMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
        }
        break;
      case "player":
        st.addPlayerAt(p.x, p.y, tool.goalkeeper);
        break;
      case "ball":
        st.addObject({ type: "ball", style: tool.style ?? "classic", x: p.x, y: p.y, rotation: 0 }, "addBall");
        break;
      case "equipment":
        st.addObject(
          {
            type: "equipment",
            kind: tool.kind,
            color: tool.color ?? DEFAULT_EQUIPMENT_COLOR[tool.kind],
            scale: defaultEquipmentScale(tool.kind),
            x: p.x,
            y: p.y,
            rotation: 0,
          },
          "addEquipment",
        );
        break;
      case "text":
        st.addObject(
          {
            type: "text",
            text: defaultText,
            size: 2.4,
            color: st.ink,
            label: tool.label,
            x: p.x,
            y: p.y,
            rotation: 0,
          },
          "addText",
        );
        st.setTool({ type: "select" });
        break;
      case "zone":
        if (tool.shape === "polygon") {
          const d = draftRef.current;
          if (d?.type === "polygon") {
            const close = Math.hypot(p.x - d.points[0], p.y - d.points[1]) < 12 / camRef.current.scale;
            if (close && d.points.length >= 6) finishPolygon();
            else updateDraft({ ...d, points: [...d.points, p.x, p.y], cx: p.x, cy: p.y });
          } else {
            updateDraft({ type: "polygon", points: [p.x, p.y], cx: p.x, cy: p.y });
          }
        } else {
          gesture.current = { kind: "draw" };
          updateDraft({ type: tool.shape, x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }
        break;
      case "eraser":
        gesture.current = { kind: "erase" };
        st.beginLive();
        eraseAtPointer();
        break;
      case "line":
        gesture.current = { kind: "draw" };
        updateDraft({ type: "line", x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        break;
      case "freehand":
        gesture.current = { kind: "draw" };
        updateDraft({ type: "freehand", points: [p.x, p.y] });
        break;
    }
  };

  const onPointerMove = (e: KonvaEventObject<PointerEvent>) => {
    const g = gesture.current;
    const d = draftRef.current;
    if (e.evt.pointerType === "mouse") shareCursor(world());
    if (pinch.current) return;
    if (g?.kind === "pan") {
      userMoved.current = true;
      setCam({ ...g.cam, x: g.cam.x + e.evt.clientX - g.sx, y: g.cam.y + e.evt.clientY - g.sy });
      return;
    }
    if (g?.kind === "erase") {
      eraseAtPointer();
      return;
    }
    if (!g && d?.type !== "polygon") return;
    const p = world();
    if (g?.kind === "marquee") {
      updateMarquee({
        x: Math.min(g.x0, p.x),
        y: Math.min(g.y0, p.y),
        w: Math.abs(p.x - g.x0),
        h: Math.abs(p.y - g.y0),
      });
    } else if (d?.type === "polygon") {
      updateDraft({ ...d, cx: p.x, cy: p.y });
    } else if (g?.kind === "draw" && d) {
      if (d.type === "freehand") updateDraft({ type: "freehand", points: [...d.points, p.x, p.y] });
      else updateDraft({ ...d, x1: p.x, y1: p.y });
    }
  };

  const finishGesture = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const st = useEditor.getState();

    if (g.kind === "marquee") {
      const m = marqueeRef.current;
      updateMarquee(null);
      if (m && (m.w > 0.5 || m.h > 0.5)) {
        const hits = displayObjects(st.scene, st.currentStep)
          .filter((o) => boxesIntersect(objectBox(o), m))
          .map((o) => o.id);
        if (hits.length) st.select(hits, g.additive);
      }
      return;
    }
    if (g.kind === "erase") {
      st.endLive("erase");
      const alive = new Set(useEditor.getState().scene.objects.map((o) => o.id));
      useEditor.setState({ selection: st.selection.filter((id) => alive.has(id)) });
      return;
    }
    if (g.kind !== "draw") return;
    const d = draftRef.current;
    updateDraft(null);
    if (!d) return;

    if (d.type === "freehand") {
      if (d.points.length < 4) return;
      const pts = simplify(d.points, 0.25);
      const [ox, oy] = pts;
      st.addObject(
        {
          type: "freehand",
          x: ox,
          y: oy,
          rotation: 0,
          points: pts.map((v, i) => v - (i % 2 === 0 ? ox : oy)),
          width: st.inkWidth,
          color: st.ink,
        },
        "addFreehand",
      );
      return;
    }
    if (d.type === "line") {
      const tiny = Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 1;
      const dx = tiny ? 12 : d.x1 - d.x0;
      const dy = tiny ? 0 : d.y1 - d.y0;
      const kind = st.tool.type === "line" ? st.tool.kind : "pass";
      st.addObject(
        {
          type: "line",
          x: d.x0,
          y: d.y0,
          rotation: 0,
          points: [0, 0, dx / 2, dy / 2, dx, dy],
          ...lineDefaults(kind, st.ink, st.inkWidth),
        },
        "addLine",
      );
      return;
    }
    if (d.type === "rect" || d.type === "ellipse") {
      const tiny = Math.abs(d.x1 - d.x0) < 1 && Math.abs(d.y1 - d.y0) < 1;
      st.addObject(
        {
          type: "zone",
          shape: d.type,
          x: tiny ? d.x0 : (d.x0 + d.x1) / 2,
          y: tiny ? d.y0 : (d.y0 + d.y1) / 2,
          rotation: 0,
          width: tiny ? 14 : Math.max(1, Math.abs(d.x1 - d.x0)),
          height: tiny ? 10 : Math.max(1, Math.abs(d.y1 - d.y0)),
          points: [],
          fill: ACCENT,
          ...zoneStyle(st.tool),
        },
        "addZone",
      );
    }
  }, [updateDraft, updateMarquee]);

  useEffect(() => {
    window.addEventListener("pointerup", finishGesture);
    window.addEventListener("pointercancel", finishGesture);
    return () => {
      window.removeEventListener("pointerup", finishGesture);
      window.removeEventListener("pointercancel", finishGesture);
    };
  }, [finishGesture]);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current!.getPointerPosition();
    if (!pointer) return;
    const speed = e.evt.ctrlKey ? 0.01 : 0.0015;
    zoomAt(pointer.x, pointer.y, camRef.current.scale * Math.exp(-e.evt.deltaY * speed));
  };

  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = (t[0].clientX + t[1].clientX) / 2 - rect.left;
    const cy = (t[0].clientY + t[1].clientY) / 2 - rect.top;
    const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    if (!pinch.current) {
      // Un deuxième doigt annule le geste en cours pour laisser place au zoom.
      dragRef.current?.node.stopDrag();
      gesture.current = null;
      if (draftRef.current?.type !== "polygon") updateDraft(null);
      updateMarquee(null);
      pinch.current = { dist, cx, cy, cam: camRef.current };
      return;
    }
    const p = pinch.current;
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (p.cam.scale * dist) / p.dist));
    const wx = (p.cx - p.cam.x) / p.cam.scale;
    const wy = (p.cy - p.cam.y) / p.cam.scale;
    userMoved.current = true;
    setCam({ scale, x: cx - wx * scale, y: cy - wy * scale });
  };

  const onTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) pinch.current = null;
  };

  // --- Sélection et déplacement des objets -----------------------------------
  const handlers = useMemo<NodeHandlers>(
    () => ({
      onPointerDown(e) {
        const st = useEditor.getState();
        if (st.tool.type !== "select" || e.evt.button > 0) return;
        const id = e.currentTarget.id();
        if (e.evt.shiftKey) st.select([id], true);
        else if (!st.selection.includes(id)) st.select([id]);
      },
      onDragStart(e) {
        const node = e.target;
        const id = node.id();
        let st = useEditor.getState();
        if (!st.selection.includes(id)) {
          st.select([id]);
          st = useEditor.getState();
        }
        const moving = new Set(st.selection);
        const start = new Map<string, { x: number; y: number }>();
        const cx: number[] = [];
        const cy: number[] = [];
        let dragged: SceneObject | undefined;
        for (const o of displayObjects(st.scene, st.currentStep)) {
          if (o.id === id) dragged = o;
          if (moving.has(o.id)) {
            if (!o.locked) start.set(o.id, { x: o.x, y: o.y });
          } else if (snappable(o)) {
            cx.push(o.x);
            cy.push(o.y);
          }
        }
        const w = worldRect(st.scene.pitch);
        cx.push(w.x, w.x + w.w / 2, w.x + w.w);
        cy.push(w.y, w.y + w.h / 2, w.y + w.h);
        const nodes = new Map<string, Konva.Node>();
        for (const child of objectsRef.current?.getChildren() ?? []) {
          if (start.has(child.id())) nodes.set(child.id(), child);
        }
        // Le cadre de transformation recalcule sa boîte à chaque image : on le retire
        // pendant le déplacement d'une grande sélection pour rester fluide.
        const detached = start.size > 8;
        if (detached) trRef.current?.nodes([]);
        dragRef.current = { id, node, start, nodes, cx, cy, detached, snap: !!dragged && snappable(dragged) };
      },
      onDragMove(e) {
        const d = dragRef.current;
        if (!d) return;
        const origin = d.start.get(d.id);
        if (!origin) return;
        let x = e.target.x();
        let y = e.target.y();
        if (d.snap && !e.evt.altKey) {
          const s = snapPoint(x, y, d.cx, d.cy, 7 / camRef.current.scale);
          x = s.x;
          y = s.y;
          e.target.position({ x, y });
          setGuides((g) => (g.x === s.guideX && g.y === s.guideY ? g : { x: s.guideX, y: s.guideY }));
        }
        const dx = x - origin.x;
        const dy = y - origin.y;
        for (const [id, pos] of d.start) {
          if (id !== d.id) d.nodes.get(id)?.position({ x: pos.x + dx, y: pos.y + dy });
        }
      },
      onDragEnd(e) {
        const d = dragRef.current;
        dragRef.current = null;
        setGuides({ x: null, y: null });
        if (!d) return;
        if (d.detached) setTrTick((n) => n + 1);
        const origin = d.start.get(d.id);
        if (!origin) return;
        const dx = e.target.x() - origin.x;
        const dy = e.target.y() - origin.y;
        if (!dx && !dy) return;
        useEditor.getState().commit("move", (scene) => {
          for (const obj of scene.objects) {
            const pos = d.start.get(obj.id);
            if (pos) {
              obj.x = pos.x + dx;
              obj.y = pos.y + dy;
            }
          }
        });
      },
    }),
    [],
  );

  const selected = useMemo(() => new Set(selection), [selection]);
  const teamsById = useMemo(() => new Map(scene.teams.map((t) => [t.id, t])), [scene.teams]);
  const photos = usePhotos((s) => s.images);
  useEffect(() => {
    requestPhotos(objects.flatMap((o) => (o.type === "player" && o.photo ? [o.photo] : [])));
  }, [objects]);
  // Lecture seule : ni déplacement, ni poignées ; on peut seulement regarder.
  const readOnly = useEditor((s) => s.readOnly);
  const selecting = tool.type === "select" && !previewing && !readOnly;

  const nodes = useMemo(
    () =>
      objects.map((obj) => (
        <ObjectNode
          key={obj.id}
          obj={obj}
          team={obj.type === "player" ? teamsById.get(obj.teamId) : undefined}
          photo={obj.type === "player" && obj.photo ? photos[obj.photo] : undefined}
          ink={scene.pitch.lines}
          draggable={selecting && !obj.locked}
          handlers={handlers}
          showFacing={!scene.hideFacing}
        />
      )),
    [objects, scene.pitch.lines, scene.hideFacing, teamsById, photos, selecting, handlers],
  );

  // --- Poignées de transformation --------------------------------------------
  const selectedObjects = useMemo(
    () => (previewing ? [] : objects.filter((o) => selected.has(o.id))),
    [objects, selected, previewing],
  );

  useEffect(() => {
    const tr = trRef.current;
    const layer = objectsRef.current;
    if (!tr || !layer) return;
    const ids = new Set(selecting ? selectedObjects.filter(transformable).map((o) => o.id) : []);
    tr.nodes(layer.getChildren().filter((n) => ids.has(n.id())));
    tr.getLayer()?.batchDraw();
  }, [selectedObjects, selecting, size.w, trTick]);

  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const resizable =
    !!single &&
    transformable(single) &&
    (single.type === "zone" || single.type === "equipment" || single.type === "text");
  const freeResize = single?.type === "zone";

  // Pendant une rotation à la poignée, numéro et nom des joueurs restent droits.
  const onTransform = () => {
    for (const node of trRef.current?.nodes() ?? []) keepUpright(node, node.rotation());
  };

  const onTransformEnd = () => {
    const trNodes = trRef.current?.nodes() ?? [];
    const read = new Map(
      trNodes.map((n) => [n.id(), { x: n.x(), y: n.y(), r: n.rotation(), sx: n.scaleX(), sy: n.scaleY() }]),
    );
    useEditor.getState().commit("transform", (draftScene) => {
      for (const obj of draftScene.objects) {
        const v = read.get(obj.id);
        if (!v) continue;
        obj.x = v.x;
        obj.y = v.y;
        obj.rotation = Math.round(v.r * 10) / 10;
        if (obj.type === "zone") {
          obj.width = Math.max(1, obj.width * Math.abs(v.sx));
          obj.height = Math.max(1, obj.height * Math.abs(v.sy));
        } else if (obj.type === "equipment") {
          obj.scale = Math.min(6, Math.max(0.3, Math.abs(v.sx)));
        } else if (obj.type === "text") {
          obj.size = Math.min(14, Math.max(0.8, obj.size * Math.abs(v.sx)));
        }
      }
    });
    const objects = useEditor.getState().scene.objects;
    for (const n of trNodes) {
      const obj = objects.find((o) => o.id === n.id());
      const s = obj?.type === "equipment" ? obj.scale : 1;
      n.scale({ x: s, y: s });
    }
  };

  // --- Surcouches d'analyse --------------------------------------------------
  const players = useMemo(
    () => objects.filter((o): o is PlayerObject => o.type === "player"),
    [objects],
  );
  const pitchRect = useMemo(() => worldRect(scene.pitch), [scene.pitch]);

  const voronoi = useMemo(
    () => (overlays.voronoi ? voronoiCells(players, pitchRect, scene.teams) : []),
    [overlays.voronoi, players, pitchRect, scene.teams],
  );

  const blocks = useMemo(
    () => (overlays.blockLines ? blockLines(players, scene.teams, scene.pitch.orientation, pitchRect) : []),
    [overlays.blockLines, players, scene.teams, scene.pitch.orientation, pitchRect],
  );

  // --- Animation -------------------------------------------------------------
  useEffect(() => {
    return playbackTarget.listen((poses) => {
      const layer = objectsRef.current;
      if (!layer) return;
      const target = poses ?? restingPoses();
      for (const node of layer.getChildren()) {
        const pose = target.get(node.id());
        if (!pose) continue;
        // Un ballon en cloche monte à l'écran et grossit ; au sol il retrouve sa taille.
        node.position({ x: pose.x, y: pose.y - pose.lift * 0.35 });
        node.rotation(pose.rotation);
        keepUpright(node, pose.rotation);
        if (node.hasName("ball")) {
          const scale = 1 + pose.lift * 0.09;
          node.scale({ x: scale, y: scale });
        }
      }
      layer.batchDraw();
    });
  }, []);

  const traceStep = previewing ? playingStep : step;
  const traces = useMemo(() => {
    const frame = traceStep >= 1 ? scene.frames?.[traceStep - 1] : undefined;
    if (!showTraces || !frame) return [];
    const from = resolveStep(scene, traceStep - 1);
    return Object.entries(frame.moves).flatMap(([id, move]) => {
      const start = from.get(id);
      if (!start || move.attach) return [];
      const path = movePath(start, move);
      if (Math.hypot(move.x - start.x, move.y - start.y) < 0.3) return [];
      return [{ id, start, move, path }];
    });
  }, [scene, traceStep, showTraces]);

  const curveTarget =
    !previewing && selecting && selectedObjects.length === 1 && !selectedObjects[0].locked
      ? traces.find((trace) => trace.id === selectedObjects[0].id)
      : undefined;

  // Milieu de la trajectoire : c'est là que se tient la poignée de courbure.
  const curveMid = curveTarget
    ? {
        x:
          curveTarget.move.cx === undefined
            ? (curveTarget.start.x + curveTarget.move.x) / 2
            : 0.25 * curveTarget.start.x + 0.5 * curveTarget.move.cx + 0.25 * curveTarget.move.x,
        y:
          curveTarget.move.cy === undefined
            ? (curveTarget.start.y + curveTarget.move.y) / 2
            : 0.25 * curveTarget.start.y + 0.5 * curveTarget.move.cy + 0.25 * curveTarget.move.y,
      }
    : { x: 0, y: 0 };

  const curveHandle = {
    onDragStart: () => useEditor.getState().beginLive(),
    onDragMove: (e: KonvaEventObject<DragEvent>) => {
      const id = curveTarget?.id;
      const { x, y } = e.target.position();
      useEditor.getState().live((draftScene) => {
        const move = id ? draftScene.frames?.[step - 1]?.moves[id] : undefined;
        if (move) {
          // La poignée est sur la courbe : le point de contrôle est son symétrique par rapport à la corde.
          const from = curveTarget!.start;
          move.cx = 2 * x - (from.x + move.x) / 2;
          move.cy = 2 * y - (from.y + move.y) / 2;
        }
      });
    },
    onDragEnd: () => useEditor.getState().endLive("curveMove"),
    onDblClick: () =>
      useEditor.getState().updateMoves({ cx: undefined, cy: undefined }),
    onDblTap: () => useEditor.getState().updateMoves({ cx: undefined, cy: undefined }),
  };

  // --- Rendu -----------------------------------------------------------------
  const px = 1 / cam.scale;
  const lineHandles = single?.type === "line" && !single.locked && selecting ? single : null;

  const dragHandle = (index: 0 | 2 | 4) => ({
    onDragStart: () => useEditor.getState().beginLive(),
    onDragMove: (e: KonvaEventObject<DragEvent>) => {
      const id = lineHandles?.id;
      const { x, y } = e.target.position();
      useEditor.getState().live((draftScene) => {
        const obj = draftScene.objects.find((o) => o.id === id);
        if (obj?.type !== "line") return;
        obj.points[index] = x - obj.x;
        obj.points[index + 1] = y - obj.y;
        if (index === 2) obj.curved = true;
        else if (!obj.curved) {
          obj.points[2] = (obj.points[0] + obj.points[4]) / 2;
          obj.points[3] = (obj.points[1] + obj.points[5]) / 2;
        }
      });
    },
    onDragEnd: () => useEditor.getState().endLive("editLine"),
  });

  const cursor =
    tool.type === "pan" || spaceDown
      ? "grab"
      : tool.type === "select"
        ? "default"
        : tool.type === "eraser"
          ? "cell"
          : "crosshair";

  return (
    <div
      ref={containerRef}
      data-testid="editor-canvas"
      className="relative h-full w-full touch-none overflow-hidden bg-muted select-none"
      style={{ cursor }}
    >
      {size.w > 0 && size.h > 0 && (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          scaleX={cam.scale}
          scaleY={cam.scale}
          x={cam.x}
          y={cam.y}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerLeave={() => shareCursor(null)}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDblClick={finishPolygon}
          onDblTap={finishPolygon}
        >
          <PitchLayer settings={scene.pitch} />
          <Layer listening={false}>
            {voronoi.map((cell) => (
              <Line
                key={cell.id}
                points={cell.points}
                closed
                fill={cell.color}
                opacity={0.24}
                stroke="#fff"
                strokeWidth={0.12}
              />
            ))}
          </Layer>
          <Layer ref={objectsRef} listening={selecting || (tool.type === "eraser" && !previewing)}>
            {nodes}
          </Layer>
          <Layer ref={overlayRef}>
            <CommentPins px={px} />
            <RemoteCursors px={px} />
            {blocks.map((team) => (
              <BlockLines key={team.id} team={team} ink={scene.pitch.lines} />
            ))}
            {selectedObjects
              .filter((o) => !selecting || !transformable(o))
              .map((o) => {
                const b = objectBox(o);
                return (
                  <Rect
                    key={o.id}
                    x={b.x - 0.4}
                    y={b.y - 0.4}
                    width={b.w + 0.8}
                    height={b.h + 0.8}
                    stroke={SELECT}
                    strokeWidth={1.5 * px}
                    dash={[6 * px, 4 * px]}
                    listening={false}
                  />
                );
              })}
            {traces.map((trace) => (
              <Group key={trace.id} listening={false} opacity={0.8}>
                <Circle
                  x={trace.start.x}
                  y={trace.start.y}
                  radius={1.5}
                  stroke={scene.pitch.lines}
                  strokeWidth={0.18}
                  dash={[0.5, 0.4]}
                />
                <Line points={trace.path} stroke={scene.pitch.lines} strokeWidth={0.22} dash={[0.9, 0.7]} lineCap="round" />
                <Line points={arrowHead(trace.path, true, 1.3)} closed fill={scene.pitch.lines} />
              </Group>
            ))}
            {curveTarget && (
              <Circle
                x={curveMid.x}
                y={curveMid.y}
                radius={7 * px}
                hitStrokeWidth={18 * px}
                fill={ACCENT}
                stroke="#fff"
                strokeWidth={2 * px}
                draggable
                {...curveHandle}
              />
            )}
            <Transformer
              ref={trRef}
              rotateEnabled
              resizeEnabled={resizable}
              keepRatio={!freeResize}
              enabledAnchors={
                freeResize ? undefined : ["top-left", "top-right", "bottom-left", "bottom-right"]
              }
              rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
              ignoreStroke
              anchorSize={12}
              anchorCornerRadius={6}
              borderStroke={SELECT}
              anchorStroke={SELECT}
              rotateAnchorOffset={28}
              onTransform={onTransform}
              onTransformEnd={onTransformEnd}
            />
            {lineHandles &&
              ([0, 2, 4] as const).map((i) => {
                const straightMid = i === 2 && !lineHandles.curved;
                const lx = straightMid
                  ? (lineHandles.points[0] + lineHandles.points[4]) / 2
                  : lineHandles.points[i];
                const ly = straightMid
                  ? (lineHandles.points[1] + lineHandles.points[5]) / 2
                  : lineHandles.points[i + 1];
                return (
                  <Circle
                    key={i}
                    x={lineHandles.x + lx}
                    y={lineHandles.y + ly}
                    radius={(i === 2 ? 7 : 8) * px}
                    hitStrokeWidth={18 * px}
                    fill={i === 2 ? SELECT : "#fff"}
                    stroke={SELECT}
                    strokeWidth={2 * px}
                    draggable
                    {...dragHandle(i)}
                  />
                );
              })}
            {guides.x !== null && (
              <Line
                points={[guides.x, pitchRect.y - 5, guides.x, pitchRect.y + pitchRect.h + 5]}
                stroke={ACCENT}
                strokeWidth={1.2 * px}
                dash={[5 * px, 4 * px]}
                listening={false}
              />
            )}
            {guides.y !== null && (
              <Line
                points={[pitchRect.x - 5, guides.y, pitchRect.x + pitchRect.w + 5, guides.y]}
                stroke={ACCENT}
                strokeWidth={1.2 * px}
                dash={[5 * px, 4 * px]}
                listening={false}
              />
            )}
            {marquee && (
              <Rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.w}
                height={marquee.h}
                fill="rgba(56,189,248,0.15)"
                stroke={SELECT}
                strokeWidth={px}
                listening={false}
              />
            )}
            {draft && <DraftPreview draft={draft} px={px} />}
          </Layer>
        </Stage>
      )}
    </div>
  );
}

function BlockLines({
  team,
  ink,
}: {
  team: {
    color: string;
    lines: { points: number[]; count: number }[];
    gaps: { x: number; y: number; label: string }[];
  };
  ink: string;
}) {
  return (
    <>
      {team.lines
        .filter((l) => l.count >= 2)
        .map((l, i) => (
          <Line
            key={i}
            points={l.points}
            stroke={team.color}
            strokeWidth={0.45}
            opacity={0.85}
            dash={[1.4, 1]}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
      {team.gaps.map((g, i) => (
        <Text
          key={i}
          x={g.x}
          y={g.y}
          text={g.label}
          fontSize={1.5}
          fontStyle="bold"
          fill={ink}
          width={12}
          offsetX={6}
          offsetY={0.75}
          align="center"
          listening={false}
        />
      ))}
    </>
  );
}

function DraftPreview({ draft, px }: { draft: DraftShape; px: number }) {
  const style = {
    stroke: ACCENT,
    strokeWidth: 2 * px,
    dash: [6 * px, 4 * px],
    listening: false,
  };
  switch (draft.type) {
    case "rect":
      return (
        <Rect
          x={Math.min(draft.x0, draft.x1)}
          y={Math.min(draft.y0, draft.y1)}
          width={Math.abs(draft.x1 - draft.x0)}
          height={Math.abs(draft.y1 - draft.y0)}
          fill="rgba(244,183,64,0.2)"
          {...style}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={(draft.x0 + draft.x1) / 2}
          y={(draft.y0 + draft.y1) / 2}
          radiusX={Math.abs(draft.x1 - draft.x0) / 2}
          radiusY={Math.abs(draft.y1 - draft.y0) / 2}
          fill="rgba(244,183,64,0.2)"
          {...style}
        />
      );
    case "line":
      return <Line points={[draft.x0, draft.y0, draft.x1, draft.y1]} {...style} />;
    case "freehand":
      return <Line points={draft.points} {...style} dash={undefined} lineCap="round" lineJoin="round" />;
    case "polygon":
      return (
        <>
          <Line points={[...draft.points, draft.cx, draft.cy]} fill="rgba(244,183,64,0.2)" closed {...style} />
          <Circle x={draft.points[0]} y={draft.points[1]} radius={6 * px} fill={ACCENT} listening={false} />
        </>
      );
  }
}
