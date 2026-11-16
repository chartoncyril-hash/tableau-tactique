import type { jsPDF as JsPdf } from "jspdf";
import { cells, DEFAULT_SHEET_COLOR, type DrillSheet, type SessionSheet } from "@/lib/sheet";

/** Mise en page de la fiche de séance, A4 portrait, en millimètres. */

export interface PdfLabels {
  date: string;
  number: string;
  theme: string;
  withBall: string;
  withoutBall: string;
  transition: string;
  category: string;
  equipment: string;
  action: string;
  run: string;
  pass: string;
  dribble: string;
  squad: string;
  objective: string;
  goal: string;
  instructions: string;
  duration: string;
  players: string;
  space: string;
  procedes: { game: string; situation: string; exercise: string };
  pedagogy: string;
  variables: string;
  method: string;
  behaviours: string;
  page: (n: number, total: number) => string;
  animations: string;
}

export interface PdfDrill {
  name: string;
  notes: string;
  sheet: DrillSheet;
  /** Images JPEG (data URL) des schémas, dans l'ordre. */
  images: string[];
  /** Rapport largeur / hauteur des images. */
  aspect: number;
}

export interface PdfInput {
  title: string;
  sheet: SessionSheet;
  drills: PdfDrill[];
  equipmentIcons: string[];
  squad: { color: string; count: number }[];
  labels: PdfLabels;
  /** Lien public vers les animations, et son QR code (PNG). */
  link?: { url: string; qr: string };
}

const M = 8;
const PAGE_W = 210;
const PAGE_H = 297;
const W = PAGE_W - 2 * M;
const FOOTER_Y = PAGE_H - 4;
/** Hauteur réservée au QR code en bas de page, quand un lien est fourni. */
const QR = 15;
const INK = "#111827";
const MUTED = "#6b7280";
const LINE = "#1f2937";
const GREEN = "#4caf50";
const VARIABLES_BG = "#c5dfb3";
const MM_PER_PT = 0.3528;

function mix(hex: string, ratio: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * ratio));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

async function fontBase64(url: string) {
  const buffer = await (await fetch(url)).arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

interface TextOpts {
  size?: number;
  min?: number;
  bold?: boolean;
  color?: string;
  align?: "left" | "center";
  valign?: "top" | "middle";
  pad?: number;
}

class Sheet {
  constructor(
    private doc: JsPdf,
    private color: string,
  ) {}

  get main() {
    return this.color;
  }

  get light() {
    return mix(this.color, 0.45);
  }

  /** Texte ajusté dans une boîte : réduit la taille si besoin, puis tronque avec « … ». */
  text(value: string, x: number, y: number, w: number, h: number, o: TextOpts = {}) {
    const { doc } = this;
    const text = value.trim();
    if (!text || w <= 2 || h <= 2) return;
    const pad = o.pad ?? 1.4;
    const align = o.align ?? "left";
    doc.setFont("Geist", o.bold ? "bold" : "normal");
    doc.setTextColor(o.color ?? INK);
    let size = o.size ?? 8;
    const min = o.min ?? Math.min(size, 6);
    let lines: string[] = [];
    let lineH = 0;
    for (; size >= min; size -= 0.5) {
      doc.setFontSize(size);
      lineH = size * MM_PER_PT * 1.22;
      lines = doc.splitTextToSize(text, w - 2 * pad);
      if (lines.length * lineH <= h - 2 * pad + 0.01) break;
    }
    size = Math.max(size, min);
    doc.setFontSize(size);
    lineH = size * MM_PER_PT * 1.22;
    const max = Math.max(1, Math.floor((h - 2 * pad) / lineH));
    if (lines.length > max) {
      lines = lines.slice(0, max);
      lines[max - 1] = `${lines[max - 1].replace(/\s*\S{0,3}$/, "")}…`;
    }
    const blockH = lines.length * lineH;
    const top = o.valign === "middle" ? y + (h - blockH) / 2 : y + pad;
    const tx = align === "center" ? x + w / 2 : x + pad;
    doc.text(lines, tx, top + lineH * 0.78, { align, lineHeightFactor: 1.22 });
  }

  /** Bandeau de titre plein. */
  bar(label: string, x: number, y: number, w: number, h: number, light = false, size = 8) {
    this.doc.setFillColor(light ? this.light : this.color);
    this.doc.rect(x, y, w, h, "F");
    this.text(label, x, y, w, h, { size, bold: true, color: "#ffffff", align: "center", valign: "middle", pad: 0.6 });
  }

  /** Case encadrée, avec texte facultatif. */
  cell(x: number, y: number, w: number, h: number, value = "", o: TextOpts = {}, fill?: string) {
    const { doc } = this;
    if (fill) {
      doc.setFillColor(fill);
      doc.rect(x, y, w, h, "F");
    }
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, "S");
    this.text(value, x, y, w, h, o);
  }

  arrow(x1: number, y1: number, x2: number, y2: number, style: "dotted" | "solid" | "wavy") {
    const { doc } = this;
    doc.setDrawColor(INK);
    doc.setFillColor(INK);
    doc.setLineWidth(0.3);
    const end = x2 - 1.6;
    if (style === "wavy") {
      const steps = 24;
      let px = x1;
      let py = y1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const nx = x1 + (end - x1) * t;
        const ny = y1 + Math.sin(t * Math.PI * 4) * 0.7;
        doc.line(px, py, nx, ny);
        px = nx;
        py = ny;
      }
    } else {
      if (style === "dotted") doc.setLineDashPattern([0.5, 0.6], 0);
      doc.line(x1, y1, end, y2);
      doc.setLineDashPattern([], 0);
    }
    doc.triangle(x2, y2, end, y2 - 1, end, y2 + 1, "F");
  }
}

function header(s: Sheet, doc: JsPdf, input: PdfInput) {
  const { sheet, labels: L } = input;
  // Date et numéro de séance.
  s.bar(L.date, M, M, 40, 5);
  s.cell(M, M + 5, 40, 7, sheet.date ?? "", { align: "center", valign: "middle" });
  s.bar(L.number, M, M + 15, 20, 14);
  s.cell(M + 20, M + 15, 20, 14, sheet.number ?? "", { align: "center", valign: "middle", size: 11, bold: true });

  // Thème et principes de jeu.
  const cx = M + 44;
  s.bar(L.theme, cx, M, 36, 12, false, 10);
  s.cell(cx + 36, M, 76, 12, sheet.theme ?? "", { align: "center", valign: "middle", size: 8 });
  const rows: [string, string | undefined][] = [
    [L.withBall, sheet.withBall],
    [L.withoutBall, sheet.withoutBall],
    [L.transition, sheet.transition],
  ];
  rows.forEach(([label, value], i) => {
    const y = M + 15 + i * 7;
    s.bar(label, cx, y, 36, 7, false, 9);
    const parts = cells(value);
    const n = Math.max(1, parts.length);
    for (let j = 0; j < n; j++) {
      s.cell(cx + 36 + (76 / n) * j, y, 76 / n, 7, parts[j] ?? "", { align: "center", valign: "middle", size: 7, min: 5, pad: 0.5 });
    }
  });

  // Catégorie.
  const rx = M + W - 34;
  s.bar(L.category, rx, M, 34, 5);
  s.cell(rx, M + 5, 34, 24, sheet.category ?? "", { align: "center", valign: "middle", size: 22, min: 9, bold: true });

  // Légende : matériel, actions, effectif.
  const ly = M + 39;
  const icons = input.equipmentIcons.slice(0, 7);
  const iconW = 8;
  const eqW = Math.max(30, icons.length * iconW);
  s.bar(L.equipment, M, ly, eqW, 5);
  s.cell(M, ly + 5, eqW, 9);
  icons.forEach((icon, i) => {
    doc.addImage(icon, "PNG", M + i * iconW + 0.8, ly + 5.8, iconW - 1.6, iconW - 1.6);
  });

  const ax = M + eqW + 4;
  const aw = 96;
  s.bar(L.action, ax, ly, aw, 5);
  ([
    ["dotted", L.run],
    ["solid", L.pass],
    ["wavy", L.dribble],
  ] as const).forEach(([style, label], i) => {
    const x = ax + (aw / 3) * i;
    s.cell(x, ly + 5, aw / 3, 5);
    s.arrow(x + 5, ly + 7.5, x + aw / 3 - 5, ly + 7.5, style);
    s.cell(x, ly + 10, aw / 3, 4, label, { align: "center", valign: "middle", size: 6, pad: 0.3 });
  });

  const teams = input.squad.slice(0, 4);
  const sw = Math.max(24, teams.length * 9);
  const sx = M + W - sw;
  s.bar(L.squad, sx, ly, sw, 5);
  s.cell(sx, ly + 5, sw, 9);
  teams.forEach((team, i) => {
    const x = sx + (sw / Math.max(1, teams.length)) * (i + 0.5);
    doc.setFillColor(team.color);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.2);
    doc.circle(x, ly + 8, 1.6, "FD");
    s.text(String(team.count), x - 4, ly + 9.7, 8, 4, { align: "center", size: 6, pad: 0 });
  });

  return ly + 17;
}

function placeDiagrams(doc: JsPdf, drill: PdfDrill, x: number, y: number, w: number, h: number) {
  const n = drill.images.length;
  if (n === 0) return;
  const a = drill.aspect;
  const layouts = n === 1 ? [[1, 1]] : n === 2 ? [[1, 2], [2, 1]] : [[2, 2]];
  let best = { cols: 1, rows: 1, cw: 0, ch: 0 };
  for (const [cols, rows] of layouts) {
    const gw = (w - (cols - 1) * 1.5) / cols;
    const gh = (h - (rows - 1) * 1.5) / rows;
    const cw = Math.min(gw, gh * a);
    if (cw > best.cw) best = { cols, rows, cw, ch: cw / a };
  }
  const { cols, rows, cw, ch } = best;
  const totalW = cols * cw + (cols - 1) * 1.5;
  const totalH = rows * ch + (rows - 1) * 1.5;
  drill.images.forEach((image, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ix = x + (w - totalW) / 2 + col * (cw + 1.5);
    const iy = y + (h - totalH) / 2 + row * (ch + 1.5);
    doc.addImage(image, "JPEG", ix, iy, cw, ch);
    if (n > 1) {
      doc.setFillColor("#1f2937");
      doc.roundedRect(ix + cw / 2 - 3.5, iy + ch - 5, 7, 4.2, 1, 1, "F");
      doc.setFont("Geist", "bold");
      doc.setFontSize(9);
      doc.setTextColor("#ffffff");
      doc.text(String(i + 1), ix + cw / 2, iy + ch - 1.9, { align: "center" });
    }
  });
}

function block(s: Sheet, doc: JsPdf, drill: PdfDrill, index: number, y: number, h: number, L: PdfLabels) {
  const d = drill.sheet;
  const lab = 4.5;

  // Colonne gauche : organisation.
  const lx = M;
  const mainW = 52;
  const sideX = lx + mainW;
  const sideW = 18;
  s.bar(`${index}. ${drill.name}`, lx, y, mainW + sideW, 6, false, 8.5);
  const bodyY = y + 6;
  const bodyH = h - 6;
  const textH = Math.min(14, (bodyH - 3 * lab) / 4);
  const consignesH = bodyH - 3 * lab - 2 * textH;
  let cy = bodyY;
  ([
    [L.objective, d.objective ?? "", textH],
    [L.goal, d.goal ?? "", textH],
    [L.instructions, d.instructions || drill.notes, consignesH],
  ] as const).forEach(([label, value, height]) => {
    s.bar(label, lx, cy, mainW, lab, true, 7);
    s.cell(lx, cy + lab, mainW, height, value, { size: 7.5, align: label === L.instructions ? "left" : "center", valign: label === L.instructions ? "top" : "middle", min: 5.5 });
    cy += lab + height;
  });
  const sideH = (bodyH - 3 * lab) / 3;
  ([
    [L.duration, d.duration],
    [L.players, d.players],
    [L.space, d.space],
  ] as const).forEach(([label, value], i) => {
    const yy = bodyY + i * (lab + sideH);
    s.bar(label, sideX, yy, sideW, lab, false, 6.5);
    s.cell(sideX, yy + lab, sideW, sideH, value ?? "", { align: "center", valign: "middle", size: 7.5, min: 5.5 });
  });

  // Colonne centrale : procédé et schémas.
  const cx = M + 72;
  const cw = 72;
  (["game", "situation", "exercise"] as const).forEach((key, i) => {
    const active = d.procede === key;
    const x = cx + (cw / 3) * i;
    s.cell(x, y, cw / 3, 6, L.procedes[key], { align: "center", valign: "middle", size: 7.5, bold: active, color: active ? "#ffffff" : s.main, pad: 0.4 }, active ? GREEN : undefined);
  });
  s.cell(cx, y + 6, cw, h - 6);
  placeDiagrams(doc, drill, cx + 1.5, y + 7.5, cw - 3, h - 9);

  // Colonne droite : éléments pédagogiques.
  const rx = M + 146;
  const rw = W - 146;
  s.bar(L.pedagogy, rx, y, rw, 6, false, 7.5);
  const rest = h - 6 - 3 * lab;
  const parts: [string, string | undefined, number, string | undefined][] = [
    [L.variables, d.variables, rest * 0.38, VARIABLES_BG],
    [L.method, d.method, rest * 0.24, undefined],
    [L.behaviours, d.behaviours, rest * 0.38, undefined],
  ];
  let ry = y + 6;
  for (const [label, value, height, fill] of parts) {
    s.bar(label, rx, ry, rw, lab, true, 6.5);
    s.cell(rx, ry + lab, rw, height, value ?? "", { size: 7.5, min: 5.5, align: "center", valign: "middle" }, fill);
    ry += lab + height;
  }
}

function footer(s: Sheet, doc: JsPdf, input: PdfInput, page: number, total: number) {
  const left = [input.sheet.club, input.sheet.coach].filter(Boolean).join(" · ");
  const o = { size: 6.5, color: MUTED, pad: 0 };
  if (input.link) {
    // QR code et lien vers les animations, en bas à droite de chaque page.
    const qx = M + W - QR;
    const qy = FOOTER_Y - 4 - QR;
    doc.addImage(input.link.qr, "PNG", qx, qy, QR, QR);
    s.text(input.labels.animations, qx - 72, qy + 2, 70, 5, { size: 7.5, bold: true, color: s.main, pad: 0, align: "left" });
    doc.setFont("Geist", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(s.main);
    doc.textWithLink(input.link.url, qx - 72, qy + 10.5, { url: input.link.url, maxWidth: 70 });
  }
  s.text(left, M, FOOTER_Y - 2.5, 80, 3.5, o);
  s.text(input.title, M + 50, FOOTER_Y - 2.5, W - 100, 3.5, { ...o, align: "center" });
  s.text(input.labels.page(page, total), M + W - 30, FOOTER_Y - 2.5, 30, 3.5, { ...o, align: "left" });
}

/** Construit la fiche de séance et renvoie le PDF. */
export async function buildSessionPdf(input: PdfInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const [regular, bold] = await Promise.all([fontBase64("/fonts/Geist-Regular.ttf"), fontBase64("/fonts/Geist-SemiBold.ttf")]);
  doc.addFileToVFS("Geist-Regular.ttf", regular);
  doc.addFont("Geist-Regular.ttf", "Geist", "normal");
  doc.addFileToVFS("Geist-SemiBold.ttf", bold);
  doc.addFont("Geist-SemiBold.ttf", "Geist", "bold");
  doc.setProperties({ title: input.title, creator: "Tableau Tactique" });

  const s = new Sheet(doc, input.sheet.color || DEFAULT_SHEET_COLOR);
  const firstTop = header(s, doc, input);
  const gap = 3;

  // Deux exercices par page ; la première page porte en plus l'en-tête.
  const pages: PdfDrill[][] = [];
  for (let i = 0; i < input.drills.length; i += 2) pages.push(input.drills.slice(i, i + 2));
  if (pages.length === 0) pages.push([]);

  let index = 1;
  pages.forEach((drills, p) => {
    if (p > 0) doc.addPage();
    const top = p === 0 ? firstTop : M;
    const bottom = FOOTER_Y - 4 - (input.link ? QR + 2 : 0);
    const blockH = (bottom - top - gap) / 2;
    drills.forEach((drill, i) => block(s, doc, drill, index++, top + i * (blockH + gap), blockH, input.labels));
  });
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footer(s, doc, input, p, total);
  }
  return doc.output("blob");
}
