"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPlayers, listTeams } from "@/lib/data/roster-api";
import { fullName, shortName, sortPlayers, type PlayerRow, type TeamRow } from "@/lib/roster";
import type { FormationId } from "../scene/formations";
import type { PlayerObject } from "../scene/types";
import { useEditor } from "../store";
import { Field, Select } from "./controls";

/** Équipes de l'effectif ; vide hors connexion (éditeur de démonstration). */
function useRosterTeams() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    listTeams()
      .then((rows) => !cancelled && setTeams(rows))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return teams;
}

const playersCache = new Map<string, Promise<PlayerRow[]>>();

/** Joueurs d'une équipe de l'effectif, mis en cache le temps de la session d'édition. */
export function useRosterPlayers(teamId: string | undefined) {
  const [state, setState] = useState<{ teamId: string; players: PlayerRow[] } | null>(null);
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    let request = playersCache.get(teamId);
    if (!request) {
      request = listPlayers(teamId).catch(() => []);
      playersCache.set(teamId, request);
    }
    request.then((players) => !cancelled && setState({ teamId, players }));
    return () => {
      cancelled = true;
    };
  }, [teamId]);
  return teamId && state?.teamId === teamId ? state.players : [];
}

/** Composer une équipe du tableau à partir d'une équipe de l'effectif. */
export function RosterCompose({ formation }: { formation: FormationId }) {
  const t = useTranslations("roster.editor");
  const rosterTeams = useRosterTeams();
  const sceneTeams = useEditor((s) => s.scene.teams);
  const [rosterId, setRosterId] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  if (rosterTeams.length === 0) return null;

  const chosen = rosterTeams.find((r) => r.id === rosterId) ?? rosterTeams[0];
  const sceneTeam = sceneTeams.find((s) => s.id === target) ?? sceneTeams[0];

  const compose = async () => {
    setBusy(true);
    try {
      playersCache.delete(chosen.id);
      const request = listPlayers(chosen.id);
      playersCache.set(chosen.id, request);
      useEditor.getState().composeFromRoster(sceneTeam.id, chosen, await request, formation);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <p className="text-sm font-medium">{t("title")}</p>
      <Field label={t("rosterTeam")}>
        <Select value={chosen.id} onChange={(e) => setRosterId(e.target.value)}>
          {rosterTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.category ? `${team.name} (${team.category})` : team.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("boardTeam")}>
        <Select value={sceneTeam.id} onChange={(e) => setTarget(e.target.value)}>
          {sceneTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button size="sm" disabled={busy} onClick={compose}>
        {t("compose", { formation })}
      </Button>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}

/** Choix du joueur de l'effectif représenté par le jeton sélectionné. */
export function RosterPlayerField({ player }: { player: PlayerObject }) {
  const t = useTranslations("roster.editor");
  const rosterTeamId = useEditor((s) => s.scene.teams.find((team) => team.id === player.teamId)?.rosterTeamId);
  const players = useRosterPlayers(rosterTeamId);
  if (!rosterTeamId || players.length === 0) return null;

  const assign = (id: string) => {
    const chosen = players.find((p) => p.id === id);
    useEditor.getState().updateSelected((o) => {
      if (o.type !== "player") return;
      if (!chosen) {
        delete o.rosterId;
        delete o.photo;
        return;
      }
      o.rosterId = chosen.id;
      o.name = shortName(chosen);
      if (chosen.number) o.number = chosen.number;
      if (chosen.position) {
        o.role = chosen.position;
        o.goalkeeper = chosen.position === "G";
      }
      if (chosen.photo_path) o.photo = chosen.photo_path;
      else delete o.photo;
    }, "assignPlayer");
  };

  return (
    <Field label={t("player")}>
      <Select value={player.rosterId ?? ""} onChange={(e) => assign(e.target.value)}>
        <option value="">{t("noPlayer")}</option>
        {sortPlayers(players).map((p) => (
          <option key={p.id} value={p.id}>
            {[p.number, fullName(p)].filter(Boolean).join(" · ")}
          </option>
        ))}
      </Select>
    </Field>
  );
}
