"use client";

import * as THREE from "three";
import { contrastOn, primSvg, sceneToSvg } from "../export/svg";
import { worldRect } from "../pitches";
import type { Prim } from "../scene/catalog";
import type { Box } from "../scene/geometry";
import type { Scene, Team } from "../scene/types";
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
