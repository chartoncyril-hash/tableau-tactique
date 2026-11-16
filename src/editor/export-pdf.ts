import type { DrillSheet, SessionSheet } from "@/lib/sheet";
import type { PdfLabels } from "@/lib/pdf/session-pdf";
import { migrateScene } from "./scene/defaults";
import type { Scene } from "./scene/types";

export interface ExportSource {
  name: string;
  sheet: SessionSheet;
  boards: { name: string; notes: string; sheet: DrillSheet; scene: Scene }[];
}

function safeFileName(name: string) {
  return (name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "seance").slice(0, 60);
}

/** Génère la fiche de séance et la télécharge. Les bibliothèques lourdes sont chargées ici seulement. */
export async function exportSessionPdf(source: ExportSource, labels: PdfLabels, shareUrl?: string) {
  const [{ buildSessionPdf }, snapshot] = await Promise.all([import("@/lib/pdf/session-pdf"), import("./snapshot")]);
  const scenes = source.boards.map((b) => migrateScene(b.scene)).filter((s): s is Scene => s !== null);
  const drills = [];
  for (const board of source.boards) {
    const scene = migrateScene(board.scene);
    if (!scene) continue;
    const images: string[] = [];
    for (const step of snapshot.diagramSteps(scene, board.sheet.diagrams)) {
      images.push(await snapshot.renderDiagram(scene, step));
    }
    drills.push({ name: board.name, notes: board.notes, sheet: board.sheet, images, aspect: snapshot.diagramAspect(scene) });
  }
  const equipmentIcons = await Promise.all(snapshot.usedItems(scenes).map((item) => snapshot.iconPng(item)));
  let link: { url: string; qr: string } | undefined;
  if (shareUrl) {
    const { toDataURL } = await import("qrcode");
    link = { url: shareUrl, qr: await toDataURL(shareUrl, { margin: 0, width: 320, errorCorrectionLevel: "M" }) };
  }
  const blob = await buildSessionPdf({
    title: source.sheet.theme || source.name,
    sheet: source.sheet,
    drills,
    equipmentIcons,
    squad: snapshot.squad(scenes),
    labels,
    link,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(source.name)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return blob;
}
