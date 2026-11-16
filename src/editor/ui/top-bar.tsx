"use client";

import { ArrowLeft, Maximize, Redo2, SlidersHorizontal, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { canvasApi, useView } from "../canvas/editor-canvas";
import { useEditor } from "../store";
import { IconButton } from "./controls";

export function TopBar({ onTogglePanel, panelOpen }: { onTogglePanel: () => void; panelOpen: boolean }) {
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
        href="/"
        aria-label={t("back")}
        title={t("back")}
        className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <p data-testid="object-count" className="mr-auto truncate px-1 text-sm text-muted-foreground">
        {t("objects", { count })}
      </p>
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
