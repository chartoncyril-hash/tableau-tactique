"use client";

import type Konva from "konva";
import { keepUpright } from "../canvas/object-node";
import { ensurePhotos, usePhotos } from "@/lib/photos";
import { locate, posesAt, totalDuration } from "../scene/animation";
import type { Scene } from "../scene/types";
import { frameRect, frameSize, mountStage, type Framing } from "../snapshot";
import { objectsAtStep, stepArrows } from "./frame";
export { fileName } from "./frame";
import { sceneToSvg } from "./svg";

/**
 * Exports d'un tableau : image (PNG, SVG) de l'étape affichée, animation (GIF, vidéo).
 * Tout est calculé dans le navigateur ; rien n'est envoyé au serveur.
 */

export type Progress = (ratio: number) => void;

/** Le navigateur ne sait encoder aucun format vidéo. */
export class VideoUnsupportedError extends Error {}

/** Pause sur la première et la dernière image d'une animation exportée, en secondes. */
const HOLD_START = 0.6;
const HOLD_END = 1.2;

function photoPaths(scene: Scene) {
  return scene.objects.flatMap((o) => (o.type === "player" && o.photo ? [o.photo] : []));
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas"))), type, quality),
  );
}

const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);

export async function exportPng(
  scene: Scene,
  step: number,
  options: { framing: Framing; width: number; pixelRatio: number },
): Promise<Blob> {
  const { stage, dispose } = await mountStage(scene, { step, rect: frameRect(scene, options.framing), width: options.width });
  try {
    return await canvasBlob(stage.toCanvas({ pixelRatio: options.pixelRatio }), "image/png");
  } finally {
    dispose();
  }
}

/** Photos des joueurs en data URL, pour qu'elles voyagent dans le fichier SVG. */
async function photoData(scene: Scene): Promise<Record<string, string>> {
  const paths = photoPaths(scene);
  await ensurePhotos(paths);
  const images = usePhotos.getState().images;
  const out: Record<string, string> = {};
  for (const path of new Set(paths)) {
    const image = images[path];
    if (!image) continue;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    canvas.getContext("2d")!.drawImage(image, 0, 0, 160, 160);
    try {
      out[path] = canvas.toDataURL("image/jpeg", 0.85);
    } catch {
      // Image d'une autre origine non autorisée : le joueur reste sans photo.
    }
  }
  return out;
}

export async function exportSvg(scene: Scene, step: number, options: { framing: Framing; width: number }): Promise<Blob> {
  const svg = sceneToSvg(scene, {
    rect: frameRect(scene, options.framing),
    width: options.width,
    objects: objectsAtStep(scene, step),
    arrows: stepArrows(scene, step),
    photos: await photoData(scene),
  });
  return new Blob([svg], { type: "image/svg+xml" });
}

interface AnimationOptions {
  framing: Framing;
  width: number;
  fps: number;
  onProgress?: Progress;
  signal?: AbortSignal;
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Export annulé", "AbortError");
}

/** Laisse le navigateur respirer (barre de progression, bouton Annuler). */
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Rend l'animation image par image dans un canevas de taille fixe et appelle `draw` à chaque
 * image. Les poses sont appliquées directement aux nœuds Konva, comme pendant la lecture.
 */
async function renderAnimation(
  scene: Scene,
  options: AnimationOptions,
  draw: (canvas: HTMLCanvasElement, index: number, count: number) => Promise<void> | void,
) {
  const rect = frameRect(scene, options.framing);
  const size = frameSize(rect, options.width);
  const { stage, dispose } = await mountStage(scene, { step: 0, rect, width: options.width, arrows: false });
  try {
    const layer = stage.findOne(".objects") as Konva.Layer;
    const nodes = layer.getChildren();
    const canvas = document.createElement("canvas");
    canvas.width = even(size.width);
    canvas.height = even(size.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const duration = totalDuration(scene);
    const count = Math.max(1, Math.round((HOLD_START + duration + HOLD_END) * options.fps));
    for (let i = 0; i < count; i++) {
      checkAbort(options.signal);
      const time = Math.min(duration, Math.max(0, i / options.fps - HOLD_START));
      const { step, p } = locate(scene, time);
      const poses = posesAt(scene, step, p);
      for (const node of nodes) {
        const pose = poses.get(node.id());
        if (!pose) continue;
        node.position({ x: pose.x, y: pose.y - pose.lift * 0.35 });
        node.rotation(pose.rotation);
        keepUpright(node, pose.rotation);
        if (node.hasName("ball")) {
          const scale = 1 + pose.lift * 0.09;
          node.scale({ x: scale, y: scale });
        }
      }
      ctx.drawImage(stage.toCanvas({ pixelRatio: 1 }), 0, 0, canvas.width, canvas.height);
      await draw(canvas, i, count);
      options.onProgress?.((i + 1) / count);
      if (i % 2 === 0) await breathe();
    }
  } finally {
    dispose();
  }
}

/** Nombre d'images d'une animation exportée (utile aux tests et à l'estimation). */
export function frameCount(scene: Scene, fps: number) {
  return Math.max(1, Math.round((HOLD_START + totalDuration(scene) + HOLD_END) * fps));
}

export const GIF_FPS = 12.5;

export async function exportGif(scene: Scene, options: Omit<AnimationOptions, "fps">): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  let palette: ReturnType<typeof quantize> | null = null;
  const delay = Math.round(1000 / GIF_FPS);
  await renderAnimation(scene, { ...options, fps: GIF_FPS }, (canvas) => {
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    // Une seule palette, calculée sur la première image : couleurs stables, pas de scintillement.
    palette ??= quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay, repeat: 0 });
  });
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
}

export const VIDEO_FPS = 30;

/** Vidéo MP4 (H.264) si le navigateur sait l'encoder, sinon WebM (VP9). */
export async function exportVideo(scene: Scene, options: Omit<AnimationOptions, "fps">): Promise<{ blob: Blob; extension: string }> {
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec } =
    await import("mediabunny");
  const size = frameSize(frameRect(scene, options.framing), options.width);
  const width = even(size.width);
  const height = even(size.height);
  const codec =
    typeof VideoEncoder === "undefined" ? null : await getFirstEncodableVideoCodec(["avc", "vp9", "vp8"], { width, height });
  if (!codec) throw new VideoUnsupportedError();
  const format = codec === "avc" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat();
  const output = new Output({ format, target: new BufferTarget() });
  let source: InstanceType<typeof CanvasSource> | null = null;
  try {
    await renderAnimation(scene, { ...options, fps: VIDEO_FPS }, async (canvas, index) => {
      if (!source) {
        source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
        output.addVideoTrack(source, { frameRate: VIDEO_FPS });
        await output.start();
      }
      await source.add(index / VIDEO_FPS, 1 / VIDEO_FPS);
    });
    await output.finalize();
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") await output.cancel().catch(() => {});
    throw error;
  }
  return {
    blob: new Blob([output.target.buffer!], { type: format.mimeType }),
    extension: format.fileExtension.replace(/^\./, ""),
  };
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
