"use client";

import { useTranslations } from "next-intl";
import { DRILL_SHORT_FIELDS, DRILL_TEXT_FIELDS, PROCEDES, type DrillSheet, type Procede } from "@/lib/sheet";
import { setDrillField, useProject } from "../project-session";
import { Field, Section, Select, TextInput } from "./controls";

/** Fiche d'exercice du tableau affiché : ce qui sera imprimé dans la fiche de séance. */
export function DrillSection() {
  const t = useTranslations("sheet");
  const board = useProject((s) => s.boards.find((b) => b.id === s.currentId));
  const hasSteps = useProject((s) => !!s.boards.find((b) => b.id === s.currentId)?.scene.frames?.length);
  if (!board) return null;
  const d: DrillSheet = board.sheet;

  return (
    <Section title={t("drillTitle")}>
      <Field label={t("fields.procede")}>
        <Select value={d.procede ?? ""} onChange={(e) => setDrillField("procede", e.target.value as Procede | "")}>
          <option value="">{t("none")}</option>
          {PROCEDES.map((p) => (
            <option key={p} value={p}>
              {t(`pdf.procedes.${p}`)}
            </option>
          ))}
        </Select>
      </Field>
      {DRILL_SHORT_FIELDS.map((key) => (
        <Field key={key} label={t(`fields.${key}`)}>
          <TextInput
            value={d[key] ?? ""}
            maxLength={40}
            placeholder={t(`placeholders.${key}`)}
            onChange={(e) => setDrillField(key, e.target.value)}
          />
        </Field>
      ))}
      {DRILL_TEXT_FIELDS.map((key) => (
        <label key={key} className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">{t(`fields.${key}`)}</span>
          <textarea
            rows={key === "instructions" ? 5 : 2}
            maxLength={2000}
            value={d[key] ?? ""}
            placeholder={t(`placeholders.${key}`)}
            className="rounded-md border border-input bg-card p-2 text-sm"
            onChange={(e) => setDrillField(key, e.target.value)}
          />
        </label>
      ))}
      <Field label={t("fields.diagrams")}>
        <Select
          value={d.diagrams ?? "steps"}
          disabled={!hasSteps}
          onChange={(e) => setDrillField("diagrams", e.target.value === "board" ? "board" : "")}
        >
          <option value="steps">{t("diagrams.steps")}</option>
          <option value="board">{t("diagrams.board")}</option>
        </Select>
      </Field>
      <p className="text-xs text-muted-foreground">{t("drillHint")}</p>
    </Section>
  );
}
