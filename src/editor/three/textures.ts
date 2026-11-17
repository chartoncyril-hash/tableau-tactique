"use client";

import * as THREE from "three";
import { contrastOn, escapeXml, primSvg, sceneToSvg } from "../export/svg";
import { worldRect } from "../pitches";
import type { Prim } from "../scene/catalog";
import type { Box } from "../scene/geometry";
import { blockLines, voronoiCells } from "../scene/analysis";
import type { PlayerObject, Scene, Team } from "../scene/types";
import { isGroundDrawing } from "./layout";

/** Textures de la vue 3D, dessinées dans le navigateur (aucun fichier à télécharger). */

export const GROUND_MARGIN = 6;
const SVG_PAD = 2;

function loadSvg(svg: string, width: number, height: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

let grain: HTMLCanvasElement | null = null;

/**
 * Grain du gazon : un motif de bruit (brins clairs et sombres) posé en « lumière douce » sur la
 * pelouse rastérisée, à l'échelle d'environ 2 cm par point. Rend l'herbe moins lisse de près.
 */
function grassGrain(canvas: HTMLCanvasElement, pxPerMeter: number) {
  if (!grain) {
    grain = document.createElement("canvas");
    grain.width = grain.height = 256;
    const g = grain.getContext("2d")!;
    const img = g.createImageData(256, 256);
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < img.data.length; i += 4) {
      // Brins orientés : un peu de corrélation verticale.
      const v = 128 + (rand() - 0.5) * 120;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  const g = canvas.getContext("2d");
  if (!g) return;
  g.save();
  g.globalCompositeOperation = "soft-light";
  g.globalAlpha = 0.35;
  const pattern = g.createPattern(grain, "repeat");
  if (pattern) {
    // Un point du motif ≈ 4 cm sur le terrain, quelle que soit la résolution de la texture.
    const k = Math.max(0.5, pxPerMeter * 0.04);
    pattern.setTransform(new DOMMatrix().scale(k, k));
    g.fillStyle = pattern;
    g.fillRect(0, 0, canvas.width, canvas.height);
  }
  g.restore();
}

/** Cadre couvert par la pelouse texturée, en coordonnées du tableau. */
export function groundRect(scene: Scene): Box {
  const r = worldRect(scene.pitch);
  return {
    x: r.x - GROUND_MARGIN - SVG_PAD,
    y: r.y - GROUND_MARGIN - SVG_PAD,
    w: r.w + (GROUND_MARGIN + SVG_PAD) * 2,
    h: r.h + (GROUND_MARGIN + SVG_PAD) * 2,
  };
}

/**
 * Pelouse : le terrain et les dessins au sol (zones, tracés, textes), rendus par l'export SVG,
 * puis rastérisés. Le cadre reste le terrain entier : la caméra peut voir au-delà du cadrage 2D.
 */
export async function groundTexture(scene: Scene, maxSize: number): Promise<THREE.CanvasTexture> {
  const r = worldRect(scene.pitch);
  const rect = { x: r.x - GROUND_MARGIN, y: r.y - GROUND_MARGIN, w: r.w + GROUND_MARGIN * 2, h: r.h + GROUND_MARGIN * 2 };
  // Le cadrage choisi (demi-terrain…) ne s'applique pas à la 3D : on affiche tout le terrain.
  const pitch = { ...scene.pitch, view: scene.pitch.view === "blank" ? ("blank" as const) : ("full" as const) };
  const full = groundRect(scene);
  const scale = Math.min(maxSize / full.w, maxSize / full.h, 48);
  const width = Math.round(full.w * scale);
  const height = Math.round(full.h * scale);
  const svg = sceneToSvg({ ...scene, pitch }, { rect, width, objects: scene.objects.filter(isGroundDrawing) });
  const canvas = await loadSvg(svg, width, height);
  grassGrain(canvas, scale);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Vignette d'un objet de la banque posé à plat (échelle, plots plats, tapis…), fond transparent. */
export async function primsTexture(prims: Prim[], w: number, h: number): Promise<THREE.CanvasTexture> {
  const px = 64;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w * px)}" height="${Math.ceil(h * px)}" viewBox="${-w / 2} ${-h / 2} ${w} ${h}">${prims.map(primSvg).join("")}</svg>`;
  const canvas = await loadSvg(svg, Math.ceil(w * px), Math.ceil(h * px));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Tissu du maillot enroulé sur le corps du joueur : uni, rayé, cerclé ou deux moitiés. */
export function kitTexture(team: Team | undefined): THREE.CanvasTexture {
  const c1 = team?.color ?? "#6b7280";
  const c2 = team?.color2 ?? "#111827";
  const pattern = team?.pattern ?? "plain";
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("2d")!;
  g.fillStyle = c1;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = c2;
  if (pattern === "stripes") for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 16, 0, 16, 128);
  if (pattern === "hoops") for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 16, 256, 16);
  if (pattern === "halves") g.fillRect(128, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Maillot d'un personnage, enroulé sur le torse (cylindre three.js : u = 0,25 devant, 0,75 dans le
 * dos). Grand numéro dans le dos, petit sur la poitrine : on distingue l'avant de l'arrière.
 */
export function jerseyTexture(team: Team | undefined, number: string): THREE.CanvasTexture {
  const c1 = team?.color ?? "#6b7280";
  const c2 = team?.color2 ?? "#111827";
  const pattern = team?.pattern ?? "plain";
  const W = 512;
  const H = 208;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.fillStyle = c1;
  g.fillRect(0, 0, W, H);
  g.fillStyle = c2;
  if (pattern === "stripes") for (let i = 0; i < 10; i++) g.fillRect(i * (W / 10) + W / 40, 0, W / 20, H);
  if (pattern === "hoops") for (let i = 0; i < 4; i++) g.fillRect(0, i * (H / 4) + H / 8, W, H / 8);
  // Moitiés : gauche et droite du joueur (côtés +z / -z du cylindre).
  if (pattern === "halves") g.fillRect(W * 0.5, 0, W * 0.5, H);
  if (number) {
    const font = "Arial, Helvetica, sans-serif";
    const plate = pattern === "plain" ? null : c1;
    const ink = plate ? contrastOn(plate) : contrastOn(c1);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    const draw = (x: number, size: number) => {
      g.font = `bold ${size}px ${font}`;
      if (plate) {
        // Sur un maillot à motif, le numéro garde un contour pour rester lisible.
        g.lineWidth = size * 0.14;
        g.strokeStyle = ink === "#ffffff" ? "#111827" : "#ffffff";
        g.strokeText(number, x, H * 0.5);
      }
      g.fillStyle = ink;
      g.fillText(number, x, H * 0.52);
    };
    draw(W * 0.75, number.length > 2 ? 96 : 128);
    draw(W * 0.25 + W * 0.04, 44);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Étiquette au-dessus d'un joueur : pastille avec le numéro, nom en dessous, « C » du capitaine. */
export function labelTexture(options: { number: string; name: string; color: string; captain?: boolean }) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const g = canvas.getContext("2d")!;
  const font = "Arial, Helvetica, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (options.number) {
    g.beginPath();
    g.arc(128, 62, 54, 0, Math.PI * 2);
    g.fillStyle = options.color;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = "#ffffff";
    g.stroke();
    g.fillStyle = contrastOn(options.color);
    g.font = `bold ${options.number.length > 2 ? 46 : 60}px ${font}`;
    g.fillText(options.number, 128, 66);
  }
  if (options.captain) {
    g.beginPath();
    g.arc(184, 22, 20, 0, Math.PI * 2);
    g.fillStyle = "#facc15";
    g.fill();
    g.fillStyle = "#111827";
    g.font = `bold 26px ${font}`;
    g.fillText("C", 184, 24);
  }
  if (options.name) {
    g.font = `600 34px ${font}`;
    const width = Math.min(250, g.measureText(options.name).width + 24);
    g.fillStyle = "rgba(17,24,39,0.72)";
    g.beginPath();
    g.roundRect(128 - width / 2, 136, width, 46, 12);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(options.name, 128, 160, 236);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Surcouches d'analyse posées sur la pelouse (même cadre que `groundTexture`, fond transparent) :
 * zones d'influence et lignes du bloc, dessinées comme sur le canevas 2D.
 */
export async function analysisTexture(
  scene: Scene,
  players: PlayerObject[],
  overlays: { voronoi: boolean; blockLines: boolean },
  maxSize: number,
): Promise<THREE.CanvasTexture | null> {
  const field = worldRect(scene.pitch);
  const cells = overlays.voronoi ? voronoiCells(players, field, scene.teams) : [];
  const blocks = overlays.blockLines ? blockLines(players, scene.teams, scene.pitch.orientation, field) : [];
  if (cells.length === 0 && blocks.length === 0) return null;
  const full = groundRect(scene);
  const scale = Math.min(maxSize / full.w, maxSize / full.h, 32);
  const width = Math.round(full.w * scale);
  const height = Math.round(full.h * scale);
  const n = (v: number) => Math.round(v * 100) / 100;
  const pts = (p: number[]) => p.map(n).join(" ");
  const parts: string[] = [];
  for (const cell of cells) {
    parts.push(`<polygon points="${pts(cell.points)}" fill="${escapeXml(cell.color)}" fill-opacity="0.24" stroke="#fff" stroke-width="0.12"/>`);
  }
  for (const team of blocks) {
    for (const line of team.lines.filter((l) => l.count >= 2)) {
      parts.push(
        `<polyline points="${pts(line.points)}" fill="none" stroke="${escapeXml(team.color)}" stroke-opacity="0.85" stroke-width="0.45" stroke-dasharray="1.4 1" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
    for (const gap of team.gaps) {
      parts.push(
        `<text x="${n(gap.x)}" y="${n(gap.y)}" font-size="1.5" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="${escapeXml(scene.pitch.lines)}" stroke="rgba(17,24,39,0.6)" stroke-width="0.25" paint-order="stroke">${escapeXml(gap.label)}</text>`,
      );
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${n(full.x)} ${n(full.y)} ${n(full.w)} ${n(full.h)}" font-family="Arial, Helvetica, sans-serif">${parts.join("")}</svg>`;
  const canvas = await loadSvg(svg, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
