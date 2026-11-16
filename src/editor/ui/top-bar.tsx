"use client";

import {
  ArrowLeft,
  Cloud,
  CloudOff,
  FileText,
  LoaderCircle,
  Maximize,
  Redo2,
  SlidersHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { canvasApi, useView } from "../canvas/editor-canvas";
import { renameProject, useProject } from "../project-session";
import { useEditor } from "../store";
import { cn } from "@/lib/utils";
import { IconButton } from "./controls";

function ProjectTitle() {
  const t = useTranslations("editor.project");
  const name = useProject((s) => s.project?.name ?? "");
  const saveState = useProject((s) => s.saveState);
  const Icon = saveState === "error" ? CloudOff : saveState === "saved" ? Cloud : LoaderCircle;
  const label = t(`save.${saveState}`);

  return (
    <>
      <input
        key={name}
        aria-label={t("name")}
        defaultValue={name}
        maxLength={120}
        className="h-9 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-medium hover:border-input focus:border-input sm:max-w-72"
        onBlur={(e) => void renameProject(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <span
        role="status"
        data-testid="save-state"
        data-state={saveState}
        title={label}
        className={cn(
          "flex shrink-0 items-center gap-1.5 px-1 text-xs",
          saveState === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <Icon className={cn("size-4", saveState === "saving" && "animate-spin")} aria-hidden />
        <span className="sr-only md:not-sr-only">{label}</span>
      </span>
      <SessionButton />
    </>
  );
}

function SessionButton() {
  const t = useTranslations("sheet");
  const id = useProject((s) => s.project?.id);
  if (!id) return null;
  return (
    <Link
      href={{ pathname: "/app/project/sheet", query: { id } }}
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-2.5 text-sm font-medium hover:bg-muted"
    >
      <FileText className="size-5" aria-hidden />
      <span className="sr-only lg:not-sr-only">{t("open")}</span>
    </Link>
  );
}

export function TopBar({
  onTogglePanel,
  panelOpen,
  project = false,
}: {
  onTogglePanel: () => void;
  panelOpen: boolean;
  project?: boolean;
}) {
  const t = useTranslations("editor");
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const count = useEditor((s) => s.scene.objects.length);
  const zoom = useView((s) => s.zoom);

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-1 border-b bg-card px-1.5">
      <Link
        href={project ? "/app" : "/"}
        aria-label={project ? t("project.backToProjects") : t("back")}
        title={project ? t("project.backToProjects") : t("back")}
        className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      {project && <ProjectTitle />}
      <p
        data-testid="object-count"
        className={cn(
          "truncate px-1 text-sm text-muted-foreground",
          project ? "sr-only lg:not-sr-only lg:ml-auto" : "mr-auto",
        )}
      >
        {t("objects", { count })}
      </p>
      {project && <span className="ml-auto lg:hidden" />}
      <IconButton icon={Undo2} label={t("undo")} disabled={!canUndo} onClick={undo} />
      <IconButton icon={Redo2} label={t("redo")} disabled={!canRedo} onClick={redo} />
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
      <IconButton icon={ZoomOut} label={t("zoomOut")} className="hidden sm:inline-flex" onClick={() => canvasApi.zoomBy(1 / 1.25)} />
      <span className="hidden w-12 text-center text-xs text-muted-foreground tabular-nums sm:block">{zoom} %</span>
      <IconButton icon={ZoomIn} label={t("zoomIn")} className="hidden sm:inline-flex" onClick={() => canvasApi.zoomBy(1.25)} />
      <IconButton icon={Maximize} label={t("fit")} onClick={() => canvasApi.fit()} />
      <IconButton
        icon={SlidersHorizontal}
        label={t("properties")}
        active={panelOpen}
        className="md:hidden"
        onClick={onTogglePanel}
      />
    </header>
  );
}
