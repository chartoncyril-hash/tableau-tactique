"use client";

import { create } from "zustand";
import { signPhotos } from "@/lib/data/roster-api";

/**
 * Photos des joueurs, chargées une fois et partagées par le canevas, la fiche et l'effectif.
 * Les adresses sont signées par lots ; une photo refusée (lien public, droits) reste absente
 * et le joueur s'affiche en pastille.
 */
export const usePhotos = create<{ images: Record<string, HTMLImageElement> }>(() => ({ images: {} }));

const pending = new Set<string>();
const failed = new Set<string>();
const waiters = new Map<string, (() => void)[]>();
let batch: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function settle(path: string) {
  pending.delete(path);
  for (const done of waiters.get(path) ?? []) done();
  waiters.delete(path);
}

async function flush() {
  const paths = batch;
  batch = [];
  let urls = new Map<string, string>();
  try {
    urls = await signPhotos(paths);
  } catch {
    // Pas de session (page publique) : les photos restent absentes.
  }
  for (const path of paths) {
    const url = urls.get(path);
    if (!url) {
      failed.add(path);
      settle(path);
      continue;
    }
    const image = new Image();
    // Indispensable pour exporter un canevas qui contient la photo (PDF).
    image.crossOrigin = "anonymous";
    image.onload = () => {
      usePhotos.setState((s) => ({ images: { ...s.images, [path]: image } }));
      settle(path);
    };
    image.onerror = () => {
      failed.add(path);
      settle(path);
    };
    image.src = url;
  }
}

export function requestPhotos(paths: Iterable<string>) {
  const images = usePhotos.getState().images;
  for (const path of paths) {
    if (!path || images[path] || pending.has(path) || failed.has(path)) continue;
    pending.add(path);
    batch.push(path);
  }
  if (batch.length && !timer) {
    timer = setTimeout(() => {
      timer = undefined;
      void flush();
    }, 30);
  }
}

/** Attend les photos demandées (5 s au plus), pour un rendu complet hors écran. */
export function ensurePhotos(paths: string[], timeout = 5000): Promise<void> {
  requestPhotos(paths);
  const waiting = paths.filter((p) => pending.has(p));
  if (waiting.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let left = waiting.length;
    const timeoutId = setTimeout(resolve, timeout);
    for (const path of waiting) {
      waiters.set(path, [
        ...(waiters.get(path) ?? []),
        () => {
          if (--left === 0) {
            clearTimeout(timeoutId);
            resolve();
          }
        },
      ]);
    }
  });
}

/** Photo recadrée au carré et réduite (JPEG, 320 px) avant envoi : légère et sans métadonnées. */
export async function preparePhoto(file: File, size = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encodage impossible"))), "image/jpeg", 0.85),
  );
}
