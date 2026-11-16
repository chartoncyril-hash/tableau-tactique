import type { Orientation, PitchSettings } from "../scene/types";
import { football } from "./football";
import type { PitchDefinition, Rect } from "./types";

const registry: Record<string, PitchDefinition> = {
  football,
};

export function getPitch(sport: string): PitchDefinition {
  return registry[sport] ?? football;
}

export const availableSports = Object.keys(registry);

/** Passe un point du repère horizontal au repère vertical (l'attaque monte). */
export function toVertical(x: number, y: number, length: number) {
  return { x: y, y: length - x };
}

export function toHorizontal(x: number, y: number, length: number) {
  return { x: length - y, y: x };
}

function orientRect(rect: Rect, orientation: Orientation, length: number): Rect {
  if (orientation === "horizontal") return rect;
  return { x: rect.y, y: length - rect.x - rect.w, w: rect.h, h: rect.w };
}

/** Zone visible du terrain, dans le repère du monde (orientation appliquée). */
export function viewRect(settings: PitchSettings): Rect {
  const pitch = getPitch(settings.sport);
  const view = settings.view === "blank" ? "full" : settings.view;
  return orientRect(pitch.views[view], settings.orientation, pitch.length);
}

/** Terrain entier dans le repère du monde. */
export function worldRect(settings: PitchSettings): Rect {
  const pitch = getPitch(settings.sport);
  return orientRect(pitch.views.full, settings.orientation, pitch.length);
}
