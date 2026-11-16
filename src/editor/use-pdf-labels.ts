"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { PdfLabels } from "@/lib/pdf/session-pdf";

/** Libellés de la fiche PDF, dans la langue de l'interface. */
export function usePdfLabels(): PdfLabels {
  const t = useTranslations("sheet.pdf");
  return useMemo(
    () => ({
      date: t("date"),
      number: t("number"),
      theme: t("theme"),
      withBall: t("withBall"),
      withoutBall: t("withoutBall"),
      transition: t("transition"),
      category: t("category"),
      equipment: t("equipment"),
      action: t("action"),
      run: t("run"),
      pass: t("pass"),
      dribble: t("dribble"),
      squad: t("squad"),
      objective: t("objective"),
      goal: t("goal"),
      instructions: t("instructions"),
      duration: t("duration"),
      players: t("players"),
      space: t("space"),
      procedes: { game: t("procedes.game"), situation: t("procedes.situation"), exercise: t("procedes.exercise") },
      pedagogy: t("pedagogy"),
      variables: t("variables"),
      method: t("method"),
      behaviours: t("behaviours"),
      page: (n, total) => t("page", { n, total }),
      animations: t("animations"),
    }),
    [t],
  );
}
