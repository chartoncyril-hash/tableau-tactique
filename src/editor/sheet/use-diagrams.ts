"use client";

import { useEffect, useState } from "react";
import type { Scene } from "../scene/types";
import { diagramAspect, diagramSteps, renderDiagram } from "../snapshot";

/** Images déjà calculées, par scène (référence immuable) et mode d'impression. */
const cache = new WeakMap<Scene, Map<string, string[]>>();
let queue: Promise<unknown> = Promise.resolve();

/** Rendu en file : un seul schéma à la fois, pour ne pas figer la page. */
function renderAll(scene: Scene, mode: "steps" | "board" | undefined) {
  const job = queue.then(async () => {
    const images: string[] = [];
    for (const step of diagramSteps(scene, mode)) images.push(await renderDiagram(scene, step, 640));
    return images;
  });
  queue = job.catch(() => undefined);
  return job;
}

/** Schémas d'un exercice tels qu'imprimés dans la fiche ; recalculés quand la scène change. */
export function useDiagrams(scene: Scene, mode: "steps" | "board" | undefined) {
  const key = mode ?? "steps";
  const [state, setState] = useState<{ scene: Scene; key: string; images: string[] } | null>(null);
  const cached = cache.get(scene)?.get(key);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    renderAll(scene, mode)
      .then((images) => {
        const byMode = cache.get(scene) ?? new Map<string, string[]>();
        byMode.set(key, images);
        cache.set(scene, byMode);
        if (!cancelled) setState({ scene, key, images });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [scene, mode, key, cached]);

  const images = cached ?? (state?.scene === scene && state.key === key ? state.images : null);
  return { images, aspect: diagramAspect(scene) };
}
