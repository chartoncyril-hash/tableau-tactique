"use client";

import { useDiagrams } from "@/editor/sheet/use-diagrams";
import type { Scene } from "@/editor/scene/types";

/** Vignette d'un exercice : le schéma recadré, calculé dans le navigateur. */
export function DrillThumb({ scene, title }: { scene: Scene; title: string }) {
  const { images, aspect } = useDiagrams(scene, "board");
  return (
    <div className="overflow-hidden rounded-md bg-muted" style={{ aspectRatio: String(aspect) }}>
      {images?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element -- image générée dans le navigateur
        <img src={images[0]} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full animate-pulse" aria-hidden />
      )}
    </div>
  );
}
