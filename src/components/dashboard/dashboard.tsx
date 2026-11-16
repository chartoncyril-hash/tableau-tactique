"use client";

import {
  Copy,
  Ellipsis,
  FolderInput,
  FolderPlus,
  LayoutTemplate,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createScene } from "@/editor/scene/defaults";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createFolder,
  createProject,
  duplicateProject,
  listFolders,
  listProjects,
  purgeProject,
  renameFolder,
  searchProjects,
  trashFolder,
  updateProject,
} from "@/lib/data/api";
import type { FolderRow, ProjectFilter, ProjectRow } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { Dialog } from "./dialog";

const TRASH_DAYS = 30;

type DialogState =
  | { kind: "rename"; project: ProjectRow }
  | { kind: "tags"; project: ProjectRow }
  | { kind: "move"; project: ProjectRow }
  | { kind: "newFolder" }
  | { kind: "renameFolder"; folder: FolderRow }
  | { kind: "deleteFolder"; folder: FolderRow }
  | { kind: "purge"; project: ProjectRow };

function FilterChip({ active, children, ...props }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap transition-colors sm:h-9",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Dashboard() {
  const t = useTranslations("dash");
  const tEditor = useTranslations("editor");
  const format = useFormatter();
  const router = useRouter();

  const [filter, setFilter] = useState<ProjectFilter>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** Instant du dernier chargement : sert au décompte de la corbeille. */
  const [loadedAt, setLoadedAt] = useState(0);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  // La recherche part 300 ms après la dernière frappe.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([search ? searchProjects(search) : listProjects(filter), listFolders()])
      .then(([rows, folderRows]) => {
        if (cancelled) return;
        setProjects(rows);
        setLoadedAt(Date.now());
        setFolders(folderRows);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, search, reloadKey]);

  /** Exécute une action, referme menus et fenêtres, puis recharge la liste. */
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMenuFor(null);
    try {
      await action();
      setDialog(null);
      setError(false);
      reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const open = (id: string) => router.push({ pathname: "/app/project", query: { id } });

  const newProject = async () => {
    setBusy(true);
    try {
      const scene = createScene([tEditor("teamDefault", { letter: "A" }), tEditor("teamDefault", { letter: "B" })]);
      const folderId = filter.kind === "folder" ? filter.folderId : null;
      open(await createProject(t("newProjectName"), tEditor("project.boardDefault", { n: 1 }), scene, folderId));
    } catch {
      setError(true);
    } finally {
      // La page reste en mémoire après la navigation : on la laisse dans un état utilisable.
      setBusy(false);
    }
  };

  const openTemplate = async (project: ProjectRow) => {
    setBusy(true);
    try {
      open(await duplicateProject(project.id, project.name, false));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const inTrash = filter.kind === "trash" && !search;
  const currentFolder = filter.kind === "folder" ? folders.find((f) => f.id === filter.folderId) : undefined;
  const folderIds = new Set(folders.map((f) => f.id));
  const pick = (next: ProjectFilter) => {
    setQuery("");
    setSearch("");
    setProjects(null);
    setFilter(next);
  };

  const heading = search
    ? t("results", { query: search })
    : currentFolder
      ? currentFolder.name
      : t(`filters.${filter.kind === "folder" ? "all" : filter.kind}`);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <Button onClick={newProject} disabled={busy}>
          <Plus aria-hidden />
          {t("newProject")}
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={t("filtersLabel")}>
        {(["all", "favorites", "templates", "trash"] as const).map((kind) => (
          <FilterChip key={kind} active={!search && filter.kind === kind} onClick={() => pick({ kind })}>
            {t(`filters.${kind}`)}
          </FilterChip>
        ))}
        <span className="mx-1 h-11 w-px shrink-0 bg-border sm:h-9" />
        {folders.map((folder) => (
          <FilterChip
            key={folder.id}
            active={!search && filter.kind === "folder" && filter.folderId === folder.id}
            onClick={() => pick({ kind: "folder", folderId: folder.id })}
          >
            {folder.name}
          </FilterChip>
        ))}
        <FilterChip active={false} onClick={() => setDialog({ kind: "newFolder" })}>
          <FolderPlus className="size-4" aria-hidden />
          {t("newFolder")}
        </FilterChip>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{heading}</h2>
        {currentFolder && !search && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "renameFolder", folder: currentFolder })}>
              <Pencil aria-hidden />
              {t("rename")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "deleteFolder", folder: currentFolder })}>
              <Trash2 aria-hidden />
              {t("deleteFolder")}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t("error")}
        </p>
      )}
      {inTrash && <p className="text-sm text-muted-foreground">{t("trashHint", { days: TRASH_DAYS })}</p>}

      {projects === null ? (
        <p className="text-muted-foreground" aria-busy="true">
          {t("loading")}
        </p>
      ) : projects.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          {search ? t("emptySearch") : inTrash ? t("emptyTrash") : t("empty")}
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="project-list">
          {projects.map((project) => {
            const trashed = project.deleted_at !== null;
            const daysLeft = trashed
              ? Math.max(0, TRASH_DAYS - Math.floor((loadedAt - Date.parse(project.deleted_at!)) / 86_400_000))
              : 0;
            return (
              <li key={project.id}>
                <Card className="relative flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    {trashed ? (
                      <p className="min-w-0 font-medium break-words">{project.name}</p>
                    ) : project.is_template ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openTemplate(project)}
                        className="min-w-0 text-left font-medium break-words underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </button>
                    ) : (
                      <Link
                        href={{ pathname: "/app/project", query: { id: project.id } }}
                        className="min-w-0 font-medium break-words underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </Link>
                    )}
                    {!trashed && (
                      <button
                        type="button"
                        aria-label={project.favorite ? t("unfavorite") : t("favorite")}
                        aria-pressed={project.favorite}
                        onClick={() => act(() => updateProject(project.id, { favorite: !project.favorite }))}
                        className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                      >
                        <Star
                          className={cn("size-5", project.favorite ? "fill-accent text-accent" : "text-muted-foreground")}
                          aria-hidden
                        />
                      </button>
                    )}
                  </div>

                  {project.tags.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {project.tags.map((tag) => (
                        <li key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {trashed
                        ? t("daysLeft", { days: daysLeft })
                        : project.is_template
                          ? t("templateHint")
                          : t("updated", {
                              date: format.dateTime(new Date(project.updated_at), {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }),
                            })}
                    </p>
                    {trashed ? (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            act(() =>
                              updateProject(project.id, {
                                deleted_at: null,
                                folder_id: project.folder_id && folderIds.has(project.folder_id) ? project.folder_id : null,
                              }),
                            )
                          }
                        >
                          <RotateCcw aria-hidden />
                          {t("restore")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("purge")}
                          title={t("purge")}
                          disabled={busy}
                          onClick={() => setDialog({ kind: "purge", project })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("actions", { name: project.name })}
                        aria-expanded={menuFor === project.id}
                        onClick={() => setMenuFor(menuFor === project.id ? null : project.id)}
                      >
                        <Ellipsis aria-hidden />
                      </Button>
                    )}
                  </div>

                  {menuFor === project.id && (
                    <div
                      role="menu"
                      className="absolute right-3 bottom-14 z-10 flex w-60 flex-col rounded-lg border bg-card p-1 shadow-xl"
                    >
                      <MenuItem icon={Pencil} onClick={() => { setMenuFor(null); setDialog({ kind: "rename", project }); }}>
                        {t("rename")}
                      </MenuItem>
                      <MenuItem icon={Tag} onClick={() => { setMenuFor(null); setDialog({ kind: "tags", project }); }}>
                        {t("editTags")}
                      </MenuItem>
                      <MenuItem icon={FolderInput} onClick={() => { setMenuFor(null); setDialog({ kind: "move", project }); }}>
                        {t("move")}
                      </MenuItem>
                      <MenuItem
                        icon={Copy}
                        onClick={() => act(() => duplicateProject(project.id, t("copyName", { name: project.name }), project.is_template))}
                      >
                        {t("duplicate")}
                      </MenuItem>
                      {!project.is_template && (
                        <MenuItem
                          icon={LayoutTemplate}
                          onClick={() => act(() => duplicateProject(project.id, project.name, true))}
                        >
                          {t("saveAsTemplate")}
                        </MenuItem>
                      )}
                      <MenuItem
                        icon={Trash2}
                        danger
                        onClick={() => act(() => updateProject(project.id, { deleted_at: new Date().toISOString() }))}
                      >
                        {t("trash")}
                      </MenuItem>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <DashboardDialog dialog={dialog} folders={folders} busy={busy} onClose={() => setDialog(null)} act={act} afterFolderDelete={() => pick({ kind: "all" })} afterFolderCreate={(id) => pick({ kind: "folder", folderId: id })} />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  children,
  onClick,
}: {
  icon: typeof Pencil;
  danger?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-muted",
        danger && "text-destructive",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {children}
    </button>
  );
}

function DashboardDialog({
  dialog,
  folders,
  busy,
  onClose,
  act,
  afterFolderDelete,
  afterFolderCreate,
}: {
  dialog: DialogState;
  folders: FolderRow[];
  busy: boolean;
  onClose: () => void;
  act: (action: () => Promise<unknown>) => Promise<void>;
  afterFolderDelete: () => void;
  afterFolderCreate: (id: string) => void;
}) {
  const t = useTranslations("dash");
  const initial =
    dialog.kind === "rename"
      ? dialog.project.name
      : dialog.kind === "tags"
        ? dialog.project.tags.join(", ")
        : dialog.kind === "move"
          ? (dialog.project.folder_id ?? "")
          : dialog.kind === "renameFolder"
            ? dialog.folder.name
            : "";
  const [value, setValue] = useState(initial);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    switch (dialog.kind) {
      case "rename":
        if (text) void act(() => updateProject(dialog.project.id, { name: text.slice(0, 120) }));
        break;
      case "tags": {
        const tags = [...new Set(text.split(",").map((s) => s.trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
        void act(() => updateProject(dialog.project.id, { tags }));
        break;
      }
      case "move":
        void act(() => updateProject(dialog.project.id, { folder_id: value || null }));
        break;
      case "newFolder":
        if (text) void act(async () => afterFolderCreate((await createFolder(text.slice(0, 80))).id));
        break;
      case "renameFolder":
        if (text) void act(() => renameFolder(dialog.folder.id, text.slice(0, 80)));
        break;
      case "deleteFolder":
        if (text === dialog.folder.name) {
          void act(async () => {
            await trashFolder(dialog.folder.id);
            afterFolderDelete();
          });
        }
        break;
      case "purge":
        void act(() => purgeProject(dialog.project.id));
        break;
    }
  };

  const danger = dialog.kind === "deleteFolder" || dialog.kind === "purge";
  const blocked = dialog.kind === "deleteFolder" && value.trim() !== dialog.folder.name;

  return (
    <Dialog title={t(`dialogs.${dialog.kind}.title`)} closeLabel={t("close")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {dialog.kind === "deleteFolder" && (
          <p className="text-sm text-muted-foreground">{t("dialogs.deleteFolder.body", { name: dialog.folder.name })}</p>
        )}
        {dialog.kind === "purge" && (
          <p className="text-sm text-muted-foreground">{t("dialogs.purge.body", { name: dialog.project.name })}</p>
        )}
        {dialog.kind === "tags" && <p className="text-sm text-muted-foreground">{t("dialogs.tags.body")}</p>}
        {dialog.kind === "move" ? (
          <select
            aria-label={t("dialogs.move.title")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 rounded-md border border-input bg-card px-3"
          >
            <option value="">{t("noFolder")}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        ) : dialog.kind !== "purge" ? (
          <Input
            autoFocus
            aria-label={t(`dialogs.${dialog.kind}.field`)}
            placeholder={t(`dialogs.${dialog.kind}.field`)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            disabled={busy || blocked}
            className={danger ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
          >
            {t(`dialogs.${dialog.kind}.confirm`)}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
