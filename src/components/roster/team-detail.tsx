"use client";

import { ArrowLeft, Camera, Cloud, CloudOff, Download, LoaderCircle, Plus, Trash2, Upload, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TEAM_PATTERNS, type TeamPattern } from "@/editor/scene/types";
import { Link, useRouter } from "@/i18n/navigation";
import {
  deletePlayer,
  insertPlayers,
  listPlayers,
  loadTeam,
  removePlayerPhoto,
  setPlayerPhoto,
  trashTeam,
  updatePlayer,
  updateTeam,
} from "@/lib/data/roster-api";
import { preparePhoto, requestPhotos, usePhotos } from "@/lib/photos";
import {
  FEET,
  fullName,
  playersFromCsv,
  playersToCsv,
  POSITIONS,
  type Foot,
  type Kit,
  type PlayerFields,
  type PlayerRow,
  type Position,
  type TeamRow,
} from "@/lib/roster";
import { cn } from "@/lib/utils";
import { KitPreview } from "./kit-preview";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELAY = 600;
type Save = "saved" | "dirty" | "saving" | "error";

export function TeamDetailLoader() {
  const id = useSearchParams().get("id") ?? "";
  return <TeamDetail key={id} id={UUID.test(id) ? id : null} />;
}

const select = "h-11 rounded-md border border-input bg-card px-2 text-sm md:h-9";

function PlayerItem({
  player,
  onChange,
  onDelete,
  onPhoto,
  onRemovePhoto,
}: {
  player: PlayerRow;
  onChange: (patch: Partial<PlayerFields>) => void;
  onDelete: () => void;
  onPhoto: (file: File) => void;
  onRemovePhoto: () => void;
}) {
  const t = useTranslations("roster");
  const photo = usePhotos((s) => (player.photo_path ? s.images[player.photo_path] : undefined));
  const file = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const name = fullName(player) || t("unnamed");

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2" aria-label={name}>
      <div className="relative">
        <button
          type="button"
          aria-label={t("photoFor", { name })}
          title={t("photoFor", { name })}
          onClick={() => file.current?.click()}
          className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 bg-muted text-muted-foreground"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- adresse signée temporaire
            <img src={photo.src} alt="" className="size-full object-cover" data-testid="player-photo" />
          ) : (
            <Camera className="size-5" aria-hidden />
          )}
        </button>
        {player.photo_path && (
          <button
            type="button"
            aria-label={t("removePhoto")}
            title={t("removePhoto")}
            onClick={onRemovePhoto}
            className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full border bg-card shadow"
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t("photoFile", { name })}
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            if (chosen) onPhoto(chosen);
            e.target.value = "";
          }}
        />
      </div>
      <Input
        aria-label={t("fields.number")}
        placeholder={t("fields.numberShort")}
        inputMode="numeric"
        maxLength={3}
        value={player.number}
        onChange={(e) => onChange({ number: e.target.value.replace(/\D/g, "") })}
        className="w-16 text-center md:h-9"
      />
      <Input
        aria-label={t("fields.firstName")}
        placeholder={t("fields.firstName")}
        maxLength={60}
        value={player.first_name}
        onChange={(e) => onChange({ first_name: e.target.value })}
        className="min-w-32 flex-1 md:h-9"
      />
      <Input
        aria-label={t("fields.lastName")}
        placeholder={t("fields.lastName")}
        maxLength={60}
        value={player.last_name}
        onChange={(e) => onChange({ last_name: e.target.value })}
        className="min-w-32 flex-1 md:h-9"
      />
      <select
        aria-label={t("fields.position")}
        value={player.position}
        onChange={(e) => onChange({ position: e.target.value as Position | "" })}
        className={cn(select, "w-36")}
      >
        <option value="">{t("fields.position")}</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {t(`positions.${p}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t("fields.foot")}
        value={player.foot}
        onChange={(e) => onChange({ foot: e.target.value as Foot | "" })}
        className={cn(select, "w-32")}
      >
        <option value="">{t("fields.foot")}</option>
        {FEET.map((f) => (
          <option key={f} value={f}>
            {t(`feet.${f}`)}
          </option>
        ))}
      </select>
      <Input
        aria-label={t("fields.notes")}
        placeholder={t("fields.notes")}
        maxLength={1000}
        value={player.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        className="min-w-48 flex-[2] md:h-9"
      />
      {confirming ? (
        <Button
          size="sm"
          className="bg-destructive text-white hover:bg-destructive/90"
          onClick={onDelete}
          onBlur={() => setConfirming(false)}
        >
          {t("confirmDelete")}
        </Button>
      ) : (
        <Button variant="ghost" size="icon" aria-label={t("deletePlayer", { name })} title={t("deletePlayer", { name })} onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  );
}

export function TeamDetail({ id }: { id: string | null }) {
  const t = useTranslations("roster");
  const tPattern = useTranslations("editor.panel.teamPatterns");
  const router = useRouter();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(id ? "loading" : "missing");
  const [save, setSave] = useState<Save>("saved");
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [confirmTeam, setConfirmTeam] = useState(false);
  const csv = useRef<HTMLInputElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const patches = useRef(new Map<string, Record<string, unknown>>());
  const writers = useRef(new Map<string, (patch: Record<string, unknown>) => Promise<void>>());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([loadTeam(id), listPlayers(id)])
      .then(([row, roster]) => {
        if (cancelled) return;
        if (!row) return setStatus("missing");
        setTeam(row);
        setPlayers(roster);
        setStatus("ready");
        requestPhotos(roster.flatMap((p) => (p.photo_path ? [p.photo_path] : [])));
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // En quittant la page, les modifications en attente partent tout de suite au lieu d'être perdues.
  useEffect(() => {
    const pending = timers.current;
    const queued = patches.current;
    const write = writers.current;
    return () => {
      for (const [key, timer] of pending) {
        clearTimeout(timer);
        void write.get(key)?.(queued.get(key) ?? {}).catch(() => undefined);
      }
      pending.clear();
    };
  }, []);

  /** Modification différée : on cumule les champs puis on enregistre une seule fois. */
  const defer = (key: string, patch: Record<string, unknown>, write: (patch: Record<string, unknown>) => Promise<void>) => {
    patches.current.set(key, { ...patches.current.get(key), ...patch });
    writers.current.set(key, write);
    clearTimeout(timers.current.get(key));
    setSave("dirty");
    timers.current.set(
      key,
      setTimeout(async () => {
        timers.current.delete(key);
        const pending = patches.current.get(key) ?? {};
        patches.current.delete(key);
        setSave("saving");
        try {
          await write(pending);
          setSave(timers.current.size ? "dirty" : "saved");
        } catch {
          setSave("error");
        }
      }, DELAY),
    );
  };

  const run = async (action: () => Promise<void>) => {
    setNotice(null);
    setSave("saving");
    try {
      await action();
      setSave(timers.current.size ? "dirty" : "saved");
    } catch {
      setSave("error");
      setNotice({ kind: "error", text: t("error") });
    }
  };

  if (status === "missing" || status === "error") {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-semibold">{t(status === "missing" ? "missingTitle" : "errorTitle")}</h1>
        <Link href="/app/teams" className={buttonVariants({ variant: "outline" })}>
          {t("back")}
        </Link>
      </Card>
    );
  }
  if (!team) return <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>;

  const setTeamField = (patch: Partial<Pick<TeamRow, "name" | "club" | "category">>) => {
    if (patch.name !== undefined && !patch.name.trim()) {
      setTeam({ ...team, ...patch });
      return;
    }
    setTeam({ ...team, ...patch });
    defer(`team`, patch, (p) => updateTeam(team.id, p));
  };
  const setKit = (patch: Partial<Kit>) => {
    const kit = { ...team.kit, ...patch };
    setTeam({ ...team, kit });
    defer(`team`, { kit }, (p) => updateTeam(team.id, p));
  };
  const setPlayer = (player: PlayerRow, patch: Partial<PlayerFields>) => {
    setPlayers((list) => list.map((p) => (p.id === player.id ? { ...p, ...patch } : p)));
    defer(`player:${player.id}`, patch, (p) => updatePlayer(player.id, p));
  };

  const addPlayer = () =>
    run(async () => {
      const used = players.map((p) => Number(p.number) || 0);
      const [row] = await insertPlayers(team.id, [{ number: String(Math.max(0, ...used) + 1) }]);
      setPlayers((list) => [...list, row]);
    });

  const importCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const rows = playersFromCsv(await file.text());
    if (rows.length === 0) {
      setNotice({ kind: "error", text: t("csvEmpty") });
      return;
    }
    await run(async () => {
      const inserted = await insertPlayers(team.id, rows);
      setPlayers((list) => [...list, ...inserted]);
      setNotice({ kind: "info", text: t("csvImported", { count: inserted.length }) });
    });
  };

  const exportCsv = () => {
    const blob = new Blob([playersToCsv(players)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${team.name.replace(/[^\p{L}\p{N}-]+/gu, "-") || "effectif"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const Icon = save === "error" ? CloudOff : save === "saved" ? Cloud : LoaderCircle;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/app/teams" aria-label={t("back")} title={t("back")} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">{team.name || t("newTeamName")}</h1>
        <span role="status" data-testid="team-save" data-state={save} className={cn("flex items-center gap-1.5 text-xs", save === "error" ? "text-destructive" : "text-muted-foreground")}>
          <Icon className={cn("size-4", save === "saving" && "animate-spin")} aria-hidden />
          {t(`save.${save}`)}
        </span>
      </div>

      <Card className="grid gap-4 p-4 md:grid-cols-[1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-3">
          {(["name", "club", "category"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{t(`teamFields.${key}`)}</span>
              <Input
                value={team[key]}
                maxLength={key === "category" ? 40 : 80}
                placeholder={t(`teamPlaceholders.${key}`)}
                onChange={(e) => setTeamField({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <fieldset className="flex items-end gap-3">
          <legend className="mb-1 text-sm text-muted-foreground">{t("kit")}</legend>
          <KitPreview kit={team.kit} className="size-14 shrink-0" />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("kitColor")}
            <input type="color" value={team.kit.color} onChange={(e) => setKit({ color: e.target.value })} className="h-11 w-12 cursor-pointer rounded-md border border-input bg-card p-1" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("kitColor2")}
            <input
              type="color"
              value={team.kit.color2 ?? "#111827"}
              disabled={!team.kit.pattern || team.kit.pattern === "plain"}
              onChange={(e) => setKit({ color2: e.target.value })}
              className="h-11 w-12 cursor-pointer rounded-md border border-input bg-card p-1 disabled:opacity-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("kitPattern")}
            <select value={team.kit.pattern ?? "plain"} onChange={(e) => setKit({ pattern: e.target.value as TeamPattern })} className="h-11 rounded-md border border-input bg-card px-2 text-sm text-foreground">
              {TEAM_PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {tPattern(p)}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{t("players", { count: players.length })}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => csv.current?.click()}>
            <Upload aria-hidden />
            {t("importCsv")}
          </Button>
          <input ref={csv} type="file" accept=".csv,text/csv" className="hidden" aria-label={t("csvFile")} onChange={importCsv} />
          <Button variant="outline" size="sm" disabled={players.length === 0} onClick={exportCsv}>
            <Download aria-hidden />
            {t("exportCsv")}
          </Button>
          <Button size="sm" onClick={addPlayer}>
            <Plus aria-hidden />
            {t("addPlayer")}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("csvHint")}</p>
      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={cn("text-sm", notice.kind === "error" ? "text-destructive" : "text-primary")}>
          {notice.text}
        </p>
      )}

      {players.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{t("noPlayers")}</Card>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="player-list">
          {players.map((player) => (
            <PlayerItem
              key={player.id}
              player={player}
              onChange={(patch) => setPlayer(player, patch)}
              onDelete={() =>
                run(async () => {
                  clearTimeout(timers.current.get(`player:${player.id}`));
                  timers.current.delete(`player:${player.id}`);
                  await deletePlayer(player);
                  setPlayers((list) => list.filter((p) => p.id !== player.id));
                })
              }
              onPhoto={(file) =>
                run(async () => {
                  const path = await setPlayerPhoto(player, await preparePhoto(file));
                  setPlayers((list) => list.map((p) => (p.id === player.id ? { ...p, photo_path: path } : p)));
                  requestPhotos([path]);
                })
              }
              onRemovePhoto={() =>
                run(async () => {
                  await removePlayerPhoto(player);
                  setPlayers((list) => list.map((p) => (p.id === player.id ? { ...p, photo_path: null } : p)));
                })
              }
            />
          ))}
        </ul>
      )}

      <div className="mt-4 border-t pt-4">
        {confirmTeam ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{t("deleteTeamConfirm")}</span>
            <Button className="bg-destructive text-white hover:bg-destructive/90" size="sm" onClick={() => run(async () => { await trashTeam(team.id); router.push("/app/teams"); })}>
              {t("deleteTeam")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmTeam(false)}>
              {t("cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirmTeam(true)}>
            <Trash2 aria-hidden />
            {t("deleteTeam")}
          </Button>
        )}
      </div>
    </div>
  );
}
