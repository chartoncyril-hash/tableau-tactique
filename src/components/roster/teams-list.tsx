"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/navigation";
import { createTeam, listTeams } from "@/lib/data/roster-api";
import type { TeamRow } from "@/lib/roster";
import { KitPreview } from "./kit-preview";

export function TeamsList() {
  const t = useTranslations("roster");
  const router = useRouter();
  const [teams, setTeams] = useState<TeamRow[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTeams()
      .then((rows) => !cancelled && setTeams(rows))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const team = await createTeam(t("newTeamName"));
      router.push({ pathname: "/app/teams/team", query: { id: team.id } });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <Button onClick={create} disabled={busy}>
          <Plus aria-hidden />
          {t("newTeam")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t("error")}
        </p>
      )}
      {teams === null ? (
        !error && <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>
      ) : teams.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{t("empty")}</Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="team-list">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={{ pathname: "/app/teams/team", query: { id: team.id } }}
                className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
              >
                <KitPreview kit={team.kit} className="size-12 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{team.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[team.club, team.category].filter(Boolean).join(" · ") || t("noDetails")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
