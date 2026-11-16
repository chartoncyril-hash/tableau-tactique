"use client";

import { Check, MapPin, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditor } from "../store";
import { IconButton } from "../ui/controls";
import {
  closeComments,
  openComments,
  postReply,
  postThread,
  removeComment,
  resolveThread,
  threads,
  useComments,
  type Thread,
} from "./comments";
import { useCollab } from "./session";

const area = "w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm";

/** Bouton de la barre du haut : ouvre les commentaires, avec le nombre de fils ouverts. */
export function CommentsButton() {
  const t = useTranslations("editor.comments");
  const open = useComments((s) => s.open);
  const count = useComments((s) => s.rows.filter((r) => !r.parent_id && !r.resolved_at).length);
  return (
    <span className="relative">
      <IconButton icon={MessageSquare} label={t("open")} active={open} onClick={() => (open ? closeComments() : openComments())} />
      {count > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground"
        >
          {count}
        </span>
      )}
    </span>
  );
}

function useMe() {
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    void import("@/lib/data/clubs-api").then(({ currentUserId }) => currentUserId().then(setMe));
  }, []);
  return me;
}

function ThreadItem({ thread, me, canModerate }: { thread: Thread; me: string | null; canModerate: boolean }) {
  const t = useTranslations("editor.comments");
  const format = useFormatter();
  const focus = useComments((s) => s.focus);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const { root } = thread;
  const resolved = !!root.resolved_at;
  const focused = focus === root.id;

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" });
  const mayDelete = (authorId: string | null) => canModerate || (!!me && authorId === me);

  return (
    <li
      ref={ref}
      aria-label={t("thread", { author: root.author_name || t("someone") })}
      className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3", focused && "ring-2 ring-primary", resolved && "opacity-70")}
    >
      <div className="flex items-start gap-2">
        {thread.pin !== null && (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            {thread.pin}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{root.author_name || t("someone")}</span> · {when(root.created_at)}
          </p>
          <p className="text-sm break-words whitespace-pre-wrap">{root.body}</p>
        </div>
      </div>
      {thread.replies.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l pl-3">
          {thread.replies.map((r) => (
            <li key={r.id} className="group">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.author_name || t("someone")}</span> · {when(r.created_at)}
                {mayDelete(r.author_id) && (
                  <button
                    type="button"
                    className="ml-2 text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => void run(() => removeComment(r.id))}
                  >
                    {t("delete")}
                  </button>
                )}
              </p>
              <p className="text-sm break-words whitespace-pre-wrap">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
      {replying ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = reply.trim().slice(0, 2000);
            if (!text) return;
            void run(async () => {
              await postReply(root.id, text);
              setReply("");
              setReplying(false);
            });
          }}
        >
          <textarea autoFocus rows={2} aria-label={t("replyField")} value={reply} onChange={(e) => setReply(e.target.value)} className={area} />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !reply.trim()}>
              {t("send")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-1">
          {!resolved && (
            <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>
              {t("reply")}
            </Button>
          )}
          {(canModerate || root.author_id === me) && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => resolveThread(root.id, !resolved))}>
              {resolved ? <RotateCcw aria-hidden /> : <Check aria-hidden />}
              {resolved ? t("reopen") : t("resolve")}
            </Button>
          )}
          {mayDelete(root.author_id) && (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => void run(() => removeComment(root.id))}>
              <Trash2 aria-hidden />
              {t("delete")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Panneau des commentaires du tableau affiché, à droite (en bas sur téléphone). */
export function CommentsPanel() {
  const t = useTranslations("editor.comments");
  const open = useComments((s) => s.open);
  const rows = useComments((s) => s.rows);
  const loading = useComments((s) => s.loading);
  const error = useComments((s) => s.error);
  const draftPin = useComments((s) => s.draftPin);
  const tool = useEditor((s) => s.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const live = useCollab((s) => s.status === "live");
  const me = useMe();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!open) return null;

  const list = threads(rows);
  const active = list.filter((th) => !th.root.resolved_at);
  const done = list.filter((th) => th.root.resolved_at);
  const pinning = tool.type === "comment";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim().slice(0, 2000);
    if (!body) return;
    setBusy(true);
    setFailed(false);
    try {
      await postThread(body);
      setText("");
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col rounded-t-xl border-t bg-muted/95 shadow-2xl backdrop-blur md:inset-x-auto md:top-14 md:right-0 md:bottom-0 md:max-h-none md:w-80 md:rounded-none md:border-t-0 md:border-l"
    >
      <header className="flex items-center justify-between border-b bg-card py-1 pr-1 pl-4">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <IconButton icon={X} label={t("close")} onClick={closeComments} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
          <textarea rows={3} aria-label={t("newField")} placeholder={t("newPlaceholder")} value={text} onChange={(e) => setText(e.target.value)} className={area} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {draftPin ? (
              <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => useComments.setState({ draftPin: null })}>
                <MapPin className="size-4" aria-hidden />
                {t("pinned")}
              </button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant={pinning ? "secondary" : "outline"}
                onClick={() => useEditor.getState().setTool(pinning ? { type: "select" } : { type: "comment" })}
              >
                <MapPin aria-hidden />
                {pinning ? t("pinHint") : t("pin")}
              </Button>
            )}
            <Button type="submit" size="sm" disabled={busy || !text.trim()}>
              {t("post")}
            </Button>
          </div>
          {failed && <p role="alert" className="text-xs text-destructive">{t("error")}</p>}
        </form>
        {!live && <p className="text-xs text-muted-foreground">{t("notLive")}</p>}
        {error && <p className="text-sm text-destructive">{t("loadError")}</p>}
        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" aria-busy="true">{t("loading")}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2" data-testid="comment-threads">
              {active.map((thread) => (
                <ThreadItem key={thread.root.id} thread={thread} me={me} canModerate={!readOnly} />
              ))}
            </ul>
            {done.length > 0 && (
              <details>
                <summary className="cursor-pointer text-sm text-muted-foreground">{t("resolved", { count: done.length })}</summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {done.map((thread) => (
                    <ThreadItem key={thread.root.id} thread={thread} me={me} canModerate={!readOnly} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </section>
  );
}
