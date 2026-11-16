"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { stop as stopPlayback } from "./animation/playback";
import { canvasApi, EditorCanvas } from "./canvas/editor-canvas";
import { closeProject, openProject, useProject } from "./project-session";
import { createScene, migrateScene } from "./scene/defaults";
import type { SceneObject } from "./scene/types";
import { newId, useEditor, type Tool } from "./store";
import { BoardTabs } from "./ui/board-tabs";
import { IconButton } from "./ui/controls";
import { Panel } from "./ui/panel";
import { Toolbar } from "./ui/toolbar";
import { Timeline } from "./ui/timeline";
import { TopBar } from "./ui/top-bar";
import { View3dOverlay } from "./three/view-3d-overlay";
import { setViewMode, useView3d } from "./three/view-mode";

const STORAGE_KEY = "tt:scene:v1";

const TOOL_KEYS: Record<string, Tool> = {
  v: { type: "select" },
  h: { type: "pan" },
  p: { type: "player", goalkeeper: false },
  k: { type: "player", goalkeeper: true },
  b: { type: "ball" },
  c: { type: "equipment", kind: "cone", color: "#f97316" },
  z: { type: "zone", shape: "rect" },
  l: { type: "line", kind: "pass" },
  d: { type: "freehand" },
  t: { type: "text", label: false },
  e: { type: "eraser" },
};

function stressObjects(count: number): SceneObject[] {
  return Array.from({ length: count }, (_, i) => ({
    id: newId(),
    type: "player" as const,
    x: 3 + Math.random() * 99,
    y: 3 + Math.random() * 62,
    rotation: 0,
    teamId: i % 2 ? "team-a" : "team-b",
    number: String((i % 99) + 1),
    name: "",
    role: "",
    look: "disc" as const,
    goalkeeper: false,
  }));
}

export default function EditorApp({ projectId, boardId }: { projectId?: string; boardId?: string }) {
  const t = useTranslations("editor");
  const ready = useEditor((s) => s.hydrated);
  const [panelOpen, setPanelOpen] = useState(false);
  const viewMode = useView3d((s) => s.mode);
  const readOnly = useEditor((s) => s.readOnly);
  // En quittant l'éditeur, on revient à la 2D pour la prochaine ouverture.
  useEffect(() => () => setViewMode("2d"), []);
  const projectStatus = useProject((s) => s.status);

  // Projet enregistré : la session gère le chargement et la sauvegarde en ligne.
  useEffect(() => {
    if (!projectId) return;
    void openProject(projectId, boardId);
    return closeProject;
  }, [projectId, boardId]);

  // Chargement initial puis sauvegarde locale différée (la persistance en ligne arrive en phase 3).
  useEffect(() => {
    if (projectId) return;
    const names: [string, string] = [t("teamDefault", { letter: "A" }), t("teamDefault", { letter: "B" })];
    const stress = Number(new URLSearchParams(window.location.search).get("stress"));
    let scene = createScene(names);
    if (stress > 0) {
      scene = { ...scene, objects: stressObjects(Math.min(stress, 2000)) };
    } else {
      try {
        const saved = migrateScene(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
        if (saved) scene = saved;
      } catch {
        // Brouillon illisible : on repart d'un tableau vide.
      }
    }
    useEditor.getState().loadScene(scene);
    useEditor.setState({ hydrated: true });
    if (stress > 0) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (state.scene === previous.scene) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(useEditor.getState().scene));
        } catch {
          // Stockage plein ou indisponible : l'édition continue sans sauvegarde locale.
        }
      }, 400);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [t, projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      // Lecture seule : seuls le zoom et Échap restent actifs.
      if (s.readOnly) {
        const k = e.key;
        if (k === "Escape") setViewMode("2d");
        else if (k === "+" || k === "=") canvasApi.zoomBy(1.25);
        else if (k === "-") canvasApi.zoomBy(1 / 1.25);
        else if (k === "0") canvasApi.fit();
        else return;
        e.preventDefault();
        return;
      }
      // Vue 3D : seuls annuler / rétablir et Échap (retour en 2D) passent par le clavier.
      if (useView3d.getState().mode === "3d") {
        if (e.key === "Escape") setViewMode("2d");
        else if (mod && e.key.toLowerCase() === "z") (e.shiftKey ? s.redo : s.undo)();
        else return;
        e.preventDefault();
        return;
      }
      const key = e.key.toLowerCase();
      let handled = true;

      if (mod && key === "z") (e.shiftKey ? s.redo : s.undo)();
      else if (mod && key === "y") s.redo();
      else if (mod && key === "c") s.copy();
      else if (mod && key === "x") {
        s.copy();
        s.deleteSelected();
      } else if (mod && key === "v") s.paste();
      else if (mod && key === "d") s.duplicateSelected();
      else if (mod && key === "a") s.selectAll();
      else if (mod && key === "g") (e.shiftKey ? s.ungroup : s.group)();
      else if (mod && key === "l") s.toggleLock();
      else if (mod) handled = false;
      else if (key === "delete" || key === "backspace") s.deleteSelected();
      else if (key === "escape") {
        stopPlayback();
        s.setTool({ type: "select" });
        s.select([]);
      } else if (key.startsWith("arrow")) {
        const step = e.shiftKey ? 2 : 0.5;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        if (s.selection.length) s.moveBy(s.selection, dx, dy);
        else handled = false;
      } else if (key === "]") s.reorder(e.shiftKey ? "front" : "forward");
      else if (key === "[") s.reorder(e.shiftKey ? "back" : "backward");
      else if (key === "+" || key === "=") canvasApi.zoomBy(1.25);
      else if (key === "-") canvasApi.zoomBy(1 / 1.25);
      else if (key === "0") canvasApi.fit();
      else if (TOOL_KEYS[key]) s.setTool(TOOL_KEYS[key]);
      else handled = false;

      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (projectId && (projectStatus === "missing" || projectStatus === "error")) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">
          {t(projectStatus === "missing" ? "project.missingTitle" : "project.errorTitle")}
        </h1>
        <p className="max-w-sm text-muted-foreground">
          {t(projectStatus === "missing" ? "project.missingBody" : "project.errorBody")}
        </p>
        <Link href="/app" className={buttonVariants()}>
          {t("project.backToProjects")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar project={!!projectId} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} />
      {projectId && projectStatus === "ready" && <BoardTabs />}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {viewMode === "2d" && !readOnly && <Toolbar />}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {readOnly && (
            <p role="note" className="border-b bg-amber-50 px-3 py-1.5 text-center text-sm text-amber-900">
              {t("readOnly")}
            </p>
          )}
          <main className="relative min-h-0 min-w-0 flex-1">
            {ready && <EditorCanvas defaultText={t("newText")} />}
            <View3dOverlay />
          </main>
          <Timeline />
        </div>
        <aside
          aria-label={t("properties")}
          className={cn(
            "z-40 shrink-0 overflow-y-auto border-t bg-card md:static md:block md:w-72 md:border-t-0 md:border-l",
            panelOpen
              ? "fixed inset-x-0 bottom-0 max-h-[70dvh] rounded-t-xl shadow-2xl md:max-h-none md:rounded-none md:shadow-none"
              : "hidden",
          )}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card py-1 pr-1 pl-4 md:hidden">
            <span className="text-sm font-medium">{t("properties")}</span>
            <IconButton icon={X} label={t("close")} onClick={() => setPanelOpen(false)} />
          </div>
          <fieldset disabled={readOnly} className="contents">
            <Panel />
          </fieldset>
        </aside>
      </div>
    </div>
  );
}
