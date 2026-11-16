"use client";

import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { addBoard, duplicateBoard, removeBoard, renameBoard, selectBoard, useProject } from "../project-session";
import { useEditor } from "../store";
import { IconButton } from "./controls";

/** Onglets des tableaux d'un projet. Les actions portent sur le tableau affiché. */
export function BoardTabs() {
  const t = useTranslations("editor.project");
  const boards = useProject((s) => s.boards);
  const currentId = useProject((s) => s.currentId);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = boards.find((b) => b.id === currentId);
  const readOnly = useEditor((s) => s.readOnly);

  const run = async (action: () => Promise<unknown> | undefined) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const nextName = () => {
    const used = new Set(boards.map((b) => b.name));
    let n = boards.length + 1;
    while (used.has(t("boardDefault", { n }))) n++;
    return t("boardDefault", { n });
  };

  return (
    <nav
      aria-label={t("boards")}
      className="z-20 flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-1.5"
    >
      <div role="tablist" className="flex items-center gap-1">
        {boards.map((board) =>
          renaming === board.id ? (
            <input
              key={board.id}
              autoFocus
              aria-label={t("renameBoard")}
              defaultValue={board.name}
              maxLength={120}
              className="h-9 w-40 rounded-md border border-input bg-card px-2 text-sm"
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                setRenaming(null);
                void renameBoard(board.id, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setRenaming(null);
              }}
            />
          ) : (
            <button
              key={board.id}
              type="button"
              role="tab"
              aria-selected={board.id === currentId}
              onClick={() => selectBoard(board.id)}
              onDoubleClick={() => !readOnly && setRenaming(board.id)}
              className={cn(
                "h-9 max-w-48 shrink-0 truncate rounded-md px-3 text-sm transition-colors",
                board.id === currentId
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {board.name}
            </button>
          ),
        )}
      </div>
      {!readOnly && (
        <>
      <IconButton icon={Plus} label={t("addBoard")} disabled={busy} onClick={() => run(() => addBoard(nextName()))} />
      <span className="mx-1 h-6 w-px shrink-0 bg-border" />
      <IconButton
        icon={Pencil}
        label={t("renameBoard")}
        disabled={!current}
        onClick={() => current && setRenaming(current.id)}
      />
      <IconButton
        icon={Copy}
        label={t("duplicateBoard")}
        disabled={busy || !current}
        onClick={() => current && run(() => duplicateBoard(t("copyName", { name: current.name })))}
      />
      <IconButton
        icon={Trash2}
        label={t("deleteBoard")}
        disabled={busy || boards.length <= 1 || !current}
        onClick={() => current && run(() => removeBoard(current.id))}
      />
        </>
      )}
    </nav>
  );
}
