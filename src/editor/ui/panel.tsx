"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  BringToFront,
  Copy,
  Group,
  Lock,
  LockOpen,
  SendToBack,
  Trash2,
  Ungroup,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GRASS_PRESETS, LINE_STYLES } from "../scene/defaults";
import { FORMATIONS, type FormationId } from "../scene/formations";
import {
  LINE_KINDS,
  MAX_TEAMS,
  TEAM_PATTERNS,
  type LineKind,
  type MowStyle,
  type PitchView,
  type SceneObject,
  type TeamPattern,
} from "../scene/types";
import { useProject } from "../project-session";
import { useEditor } from "../store";
import { ProjectSections } from "./project-sections";
import { Check, ColorInput, Field, IconButton, Range, Section, Select, TextInput } from "./controls";

const VIEWS: PitchView[] = ["full", "half", "third", "box", "blank"];
const MOWS: MowStyle[] = ["stripes", "checker", "plain"];

function SelectionSection({ objects }: { objects: SceneObject[] }) {
  const t = useTranslations("editor.panel");
  const tEditor = useTranslations("editor");
  const teams = useEditor((s) => s.scene.teams);
  const s = useEditor.getState();
  const first = objects[0];
  const sameType = objects.every((o) => o.type === first.type);
  const allLocked = objects.every((o) => o.locked);
  const grouped = objects.some((o) => o.groupId);
  const many = objects.length > 1;

  const edit = (key: string, recipe: (o: SceneObject) => void) =>
    s.updateSelected(recipe as never, "edit", `edit:${key}`);

  return (
    <Section title={t("selection", { count: objects.length })}>
      <div className="grid grid-cols-6 gap-1">
        <IconButton icon={AlignStartVertical} label={t("alignLeft")} disabled={!many} onClick={() => s.align("left")} />
        <IconButton icon={AlignCenterVertical} label={t("alignCenterX")} disabled={!many} onClick={() => s.align("centerX")} />
        <IconButton icon={AlignEndVertical} label={t("alignRight")} disabled={!many} onClick={() => s.align("right")} />
        <IconButton icon={AlignStartHorizontal} label={t("alignTop")} disabled={!many} onClick={() => s.align("top")} />
        <IconButton icon={AlignCenterHorizontal} label={t("alignCenterY")} disabled={!many} onClick={() => s.align("centerY")} />
        <IconButton icon={AlignEndHorizontal} label={t("alignBottom")} disabled={!many} onClick={() => s.align("bottom")} />
        <IconButton icon={AlignHorizontalSpaceAround} label={t("distributeX")} disabled={objects.length < 3} onClick={() => s.distribute("x")} />
        <IconButton icon={AlignVerticalSpaceAround} label={t("distributeY")} disabled={objects.length < 3} onClick={() => s.distribute("y")} />
        <IconButton icon={BringToFront} label={t("front")} onClick={() => s.reorder("front")} />
        <IconButton icon={SendToBack} label={t("back")} onClick={() => s.reorder("back")} />
        {grouped ? (
          <IconButton icon={Ungroup} label={t("ungroup")} onClick={s.ungroup} />
        ) : (
          <IconButton icon={Group} label={t("group")} disabled={!many} onClick={s.group} />
        )}
        <IconButton
          icon={allLocked ? LockOpen : Lock}
          label={allLocked ? t("unlock") : t("lock")}
          active={allLocked}
          onClick={s.toggleLock}
        />
        <IconButton icon={Copy} label={t("duplicate")} onClick={s.duplicateSelected} />
        <IconButton icon={Trash2} label={t("delete")} onClick={s.deleteSelected} />
      </div>

      {sameType && first.type === "player" && (
        <>
          <Field label={t("number")}>
            <TextInput
              value={first.number}
              maxLength={3}
              onChange={(e) => edit("number", (o) => o.type === "player" && (o.number = e.target.value))}
            />
          </Field>
          <Field label={t("name")}>
            <TextInput
              value={first.name}
              maxLength={24}
              onChange={(e) => edit("name", (o) => o.type === "player" && (o.name = e.target.value))}
            />
          </Field>
          <Field label={t("role")}>
            <TextInput
              value={first.role}
              maxLength={12}
              onChange={(e) => edit("role", (o) => o.type === "player" && (o.role = e.target.value))}
            />
          </Field>
          <Field label={t("team")}>
            <Select
              value={first.teamId}
              onChange={(e) => edit("team", (o) => o.type === "player" && (o.teamId = e.target.value))}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("look")}>
            <Select
              value={first.look}
              onChange={(e) =>
                edit("look", (o) => o.type === "player" && (o.look = e.target.value as "disc" | "jersey"))
              }
            >
              <option value="disc">{tEditor("looks.disc")}</option>
              <option value="jersey">{tEditor("looks.jersey")}</option>
            </Select>
          </Field>
          <Check
            label={t("isCaptain")}
            checked={!!first.captain}
            onChange={(e) => edit("captain", (o) => o.type === "player" && (o.captain = e.target.checked))}
          />
          <Check
            label={t("isGoalkeeper")}
            checked={first.goalkeeper}
            onChange={(e) => edit("gk", (o) => o.type === "player" && (o.goalkeeper = e.target.checked))}
          />
        </>
      )}

      {sameType && first.type === "line" && (
        <>
          <Field label={t("kind")}>
            <Select
              value={first.kind}
              onChange={(e) =>
                edit("kind", (o) => {
                  if (o.type === "line") Object.assign(o, { kind: e.target.value }, LINE_STYLES[e.target.value as LineKind]);
                })
              }
            >
              {LINE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {tEditor(`lines.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("color")}>
            <ColorInput
              value={first.color}
              onChange={(e) => edit("color", (o) => o.type === "line" && (o.color = e.target.value))}
            />
          </Field>
          <Field label={t("width")}>
            <Range
              min={0.15}
              max={1}
              step={0.05}
              value={first.width}
              onChange={(e) => edit("width", (o) => o.type === "line" && (o.width = Number(e.target.value)))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-x-2">
            <Check label={t("dashed")} checked={first.dashed} onChange={(e) => edit("dashed", (o) => o.type === "line" && (o.dashed = e.target.checked))} />
            <Check label={t("wavy")} checked={first.wavy} onChange={(e) => edit("wavy", (o) => o.type === "line" && (o.wavy = e.target.checked))} />
            <Check label={t("curved")} checked={first.curved} onChange={(e) => edit("curved", (o) => o.type === "line" && (o.curved = e.target.checked))} />
            <Check label={t("arrowStart")} checked={first.arrowStart} onChange={(e) => edit("arrowStart", (o) => o.type === "line" && (o.arrowStart = e.target.checked))} />
            <Check label={t("double")} checked={!!first.double} onChange={(e) => edit("double", (o) => o.type === "line" && (o.double = e.target.checked))} />
            <Check label={t("barEnd")} checked={!!first.barEnd} onChange={(e) => edit("barEnd", (o) => o.type === "line" && (o.barEnd = e.target.checked))} />
            <Check label={t("arrowEnd")} checked={first.arrowEnd} onChange={(e) => edit("arrowEnd", (o) => o.type === "line" && (o.arrowEnd = e.target.checked))} />
          </div>
        </>
      )}

      {sameType && first.type === "zone" && (
        <>
          <Field label={t("fill")}>
            <ColorInput value={first.fill} onChange={(e) => edit("fill", (o) => o.type === "zone" && (o.fill = e.target.value))} />
          </Field>
          <Field label={t("pattern")}>
            <Select
              value={first.pattern ?? "solid"}
              onChange={(e) => edit("pattern", (o) => o.type === "zone" && (o.pattern = e.target.value as "solid" | "hatch"))}
            >
              <option value="solid">{t("patterns.solid")}</option>
              <option value="hatch">{t("patterns.hatch")}</option>
            </Select>
          </Field>
          <Field label={t("opacity")}>
            <Range min={0.1} max={1} step={0.05} value={first.opacity} onChange={(e) => edit("opacity", (o) => o.type === "zone" && (o.opacity = Number(e.target.value)))} />
          </Field>
        </>
      )}

      {sameType && first.type === "text" && (
        <>
          <textarea
            aria-label={t("text")}
            rows={2}
            value={first.text}
            className="rounded-md border border-input bg-card p-2 text-sm"
            onChange={(e) => edit("text", (o) => o.type === "text" && (o.text = e.target.value))}
          />
          <Field label={t("size")}>
            <Range min={1} max={8} step={0.2} value={first.size} onChange={(e) => edit("size", (o) => o.type === "text" && (o.size = Number(e.target.value)))} />
          </Field>
          <Field label={t("color")}>
            <ColorInput value={first.color} onChange={(e) => edit("color", (o) => o.type === "text" && (o.color = e.target.value))} />
          </Field>
          <Check label={t("asLabel")} checked={first.label} onChange={(e) => edit("label", (o) => o.type === "text" && (o.label = e.target.checked))} />
        </>
      )}

      {sameType && first.type === "equipment" && (
        <>
          <Field label={t("color")}>
            <ColorInput value={first.color} onChange={(e) => edit("color", (o) => o.type === "equipment" && (o.color = e.target.value))} />
          </Field>
          <Field label={t("scale")}>
            <Range min={0.5} max={4} step={0.1} value={first.scale} onChange={(e) => edit("scale", (o) => o.type === "equipment" && (o.scale = Number(e.target.value)))} />
          </Field>
        </>
      )}

      {sameType && first.type === "freehand" && (
        <>
          <Field label={t("color")}>
            <ColorInput value={first.color} onChange={(e) => edit("color", (o) => o.type === "freehand" && (o.color = e.target.value))} />
          </Field>
          <Field label={t("width")}>
            <Range min={0.15} max={1} step={0.05} value={first.width} onChange={(e) => edit("width", (o) => o.type === "freehand" && (o.width = Number(e.target.value)))} />
          </Field>
        </>
      )}
    </Section>
  );
}

export function Panel() {
  const t = useTranslations("editor.panel");
  const tEditor = useTranslations("editor");
  const scene = useEditor((s) => s.scene);
  const selection = useEditor((s) => s.selection);
  const overlays = useEditor((s) => s.overlays);
  const s = useEditor.getState();
  const [formation, setFormation] = useState<FormationId>("4-4-2");
  const online = useProject((p) => p.status === "ready");

  const objects = useMemo(() => {
    const ids = new Set(selection);
    return scene.objects.filter((o) => ids.has(o.id));
  }, [scene.objects, selection]);

  const { pitch, teams } = scene;

  return (
    <div className="flex flex-col">
      {objects.length > 0 && <SelectionSection objects={objects} />}

      {online && <ProjectSections />}

      <Section title={t("pitch")}>
        <Field label={t("view")}>
          <Select value={pitch.view} onChange={(e) => s.setPitch({ view: e.target.value as PitchView })}>
            {VIEWS.map((v) => (
              <option key={v} value={v}>
                {t(`views.${v}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("orientation")}>
          <Select
            value={pitch.orientation}
            onChange={(e) => e.target.value !== pitch.orientation && s.toggleOrientation()}
          >
            <option value="horizontal">{t("horizontal")}</option>
            <option value="vertical">{t("vertical")}</option>
          </Select>
        </Field>
        <Field label={t("mow")}>
          <Select value={pitch.mow} onChange={(e) => s.setPitch({ mow: e.target.value as MowStyle })}>
            {MOWS.map((m) => (
              <option key={m} value={m}>
                {t(`mows.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("presets")}>
          <span className="flex gap-1.5">
            {GRASS_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-label={t(`presetNames.${p.id}`)}
                title={t(`presetNames.${p.id}`)}
                className="size-7 rounded-full border-2"
                style={{ background: p.grass, borderColor: p.lines }}
                onClick={() => s.setPitch({ grass: p.grass, lines: p.lines })}
              />
            ))}
          </span>
        </Field>
        <Field label={t("grass")}>
          <ColorInput value={pitch.grass} onChange={(e) => s.setPitch({ grass: e.target.value }, "pitch:grass")} />
        </Field>
        <Field label={t("linesColor")}>
          <ColorInput value={pitch.lines} onChange={(e) => s.setPitch({ lines: e.target.value }, "pitch:lines")} />
        </Field>
      </Section>

      <Section title={t("teams")}>
        {teams.map((team) => (
          <div key={team.id} className="flex flex-col gap-2 rounded-md border p-2">
            <div className="flex items-center gap-2">
              <ColorInput
                aria-label={t("color")}
                value={team.color}
                onChange={(e) => s.updateTeam(team.id, { color: e.target.value }, `team:${team.id}:color`)}
              />
              <TextInput
                aria-label={t("teamName")}
                className="w-0 flex-1"
                value={team.name}
                maxLength={24}
                onChange={(e) => s.updateTeam(team.id, { name: e.target.value }, `team:${team.id}:name`)}
              />
              <IconButton
                icon={Trash2}
                label={t("removeTeam")}
                disabled={teams.length <= 1}
                onClick={() => s.removeTeam(team.id)}
              />
            </div>
            <div className="flex items-center gap-2">
              <ColorInput
                aria-label={t("color2")}
                title={t("color2")}
                value={team.color2 ?? "#111827"}
                disabled={!team.pattern || team.pattern === "plain"}
                onChange={(e) => s.updateTeam(team.id, { color2: e.target.value }, `team:${team.id}:color2`)}
              />
              <Select
                aria-label={t("teamPattern")}
                className="w-0 flex-1"
                value={team.pattern ?? "plain"}
                onChange={(e) => s.updateTeam(team.id, { pattern: e.target.value as TeamPattern })}
              >
                {TEAM_PATTERNS.map((pattern) => (
                  <option key={pattern} value={pattern}>
                    {t(`teamPatterns.${pattern}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ))}
        {teams.length < MAX_TEAMS && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => s.addTeam(tEditor("teamDefault", { letter: "ABCD"[teams.length] }))}
          >
            {t("addTeam")}
          </Button>
        )}
        <Field label={t("formation")}>
          <Select value={formation} onChange={(e) => setFormation(e.target.value as FormationId)}>
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          {teams.map((team) => (
            <Button key={team.id} variant="secondary" size="sm" onClick={() => s.applyFormation(team.id, formation)}>
              <span className="size-3 rounded-full" style={{ background: team.color }} />
              {t("applyFormation", { team: team.name })}
            </Button>
          ))}
        </div>
      </Section>

      <Section title={t("analysis")}>
        <Check label={t("voronoi")} checked={overlays.voronoi} onChange={() => s.toggleOverlay("voronoi")} />
        <Check label={t("blockLines")} checked={overlays.blockLines} onChange={() => s.toggleOverlay("blockLines")} />
      </Section>

      <Section title={t("board")}>
        <Button variant="outline" size="sm" disabled={scene.objects.length === 0} onClick={s.clearAll}>
          {t("clear")}
        </Button>
        <p className="text-xs text-muted-foreground">{online ? t("onlineSave") : t("localSave")}</p>
      </Section>
    </div>
  );
}
