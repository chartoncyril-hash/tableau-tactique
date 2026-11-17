"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useProject } from "../project-session";
import { useCollab } from "./session";

const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

/** Les autres entraîneurs présents sur le projet ; leur pastille est pleine s'ils sont sur ce tableau. */
export function PresenceAvatars() {
  const t = useTranslations("editor.collab");
  const peers = useCollab((s) => s.peers);
  const status = useCollab((s) => s.status);
  const board = useProject((s) => s.currentId);
  const boards = useProject((s) => s.boards);
  if (status === "off") return null;
  // Une personne peut avoir plusieurs onglets : une pastille par personne.
  const people = [...new Map(peers.map((p) => [p.userId, p])).values()];
  return (
    <div
      role="group"
      aria-label={t("present", { count: people.length })}
      data-testid="presence"
      data-count={people.length}
      data-status={status}
      className="flex shrink-0 items-center -space-x-2 px-1"
    >
      {status === "error" && <span className="mr-3 text-xs text-destructive">{t("offline")}</span>}
      {people.slice(0, 4).map((peer) => {
        const here = peer.board === board;
        const where = boards.find((b) => b.id === peer.board)?.name;
        const label = here ? t("here", { name: peer.name }) : t("elsewhere", { name: peer.name, board: where ?? "?" });
        return (
          <span
            key={peer.userId}
            title={label}
            aria-label={label}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border-2 border-card text-xs font-semibold",
              here ? "text-white" : "bg-card",
            )}
            style={here ? { background: peer.color } : { color: peer.color, boxShadow: `inset 0 0 0 2px ${peer.color}` }}
          >
            {initials(peer.name)}
          </span>
        );
      })}
      {people.length > 4 && (
        <span className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-muted text-xs">
          +{people.length - 4}
        </span>
      )}
    </div>
  );
}
