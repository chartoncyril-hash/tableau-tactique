import type { PitchDefinition } from "./types";

/**
 * Terrains réduits de l'école de foot (règlements FFF) :
 * - foot à 8 (U10 à U13) : demi-terrain de 65 × 50 m, surfaces de 26 × 13 m, point de penalty
 *   à 9 m, buts de 6 m ;
 * - foot à 5 (U6 à U9) : 40 × 30 m, zone protégée de 8 m sur toute la largeur, penalty à 6 m,
 *   buts de 4 m.
 */

const L8 = 65;
const W8 = 50;
const c8 = W8 / 2;

export const football8: PitchDefinition = {
  id: "football8",
  length: L8,
  width: W8,
  lineWidth: 0.14,
  markings: [
    { t: "rect", x: 0, y: 0, w: L8, h: W8 },
    { t: "line", x1: L8 / 2, y1: 0, x2: L8 / 2, y2: W8 },
    { t: "circle", cx: L8 / 2, cy: c8, r: 6 },
    { t: "spot", cx: L8 / 2, cy: c8 },
    { t: "rect", x: 0, y: c8 - 13, w: 13, h: 26 },
    { t: "rect", x: L8 - 13, y: c8 - 13, w: 13, h: 26 },
    { t: "spot", cx: 9, cy: c8 },
    { t: "spot", cx: L8 - 9, cy: c8 },
    { t: "arc", cx: 0, cy: 0, r: 1, from: 0, to: 90 },
    { t: "arc", cx: L8, cy: 0, r: 1, from: 90, to: 180 },
    { t: "arc", cx: L8, cy: W8, r: 1, from: 180, to: 270 },
    { t: "arc", cx: 0, cy: W8, r: 1, from: 270, to: 360 },
    { t: "goal", x: -1.6, y: c8 - 3, w: 1.6, h: 6 },
    { t: "goal", x: L8, y: c8 - 3, w: 1.6, h: 6 },
  ],
  views: {
    full: { x: 0, y: 0, w: L8, h: W8 },
    half: { x: L8 / 2, y: 0, w: L8 / 2, h: W8 },
    third: { x: (L8 * 2) / 3, y: 0, w: L8 / 3, h: W8 },
    box: { x: L8 - 20, y: 5, w: 20, h: W8 - 10 },
  },
};

const L5 = 40;
const W5 = 30;
const c5 = W5 / 2;

export const football5: PitchDefinition = {
  id: "football5",
  length: L5,
  width: W5,
  lineWidth: 0.12,
  markings: [
    { t: "rect", x: 0, y: 0, w: L5, h: W5 },
    { t: "line", x1: L5 / 2, y1: 0, x2: L5 / 2, y2: W5 },
    { t: "circle", cx: L5 / 2, cy: c5, r: 4 },
    { t: "spot", cx: L5 / 2, cy: c5 },
    { t: "line", x1: 8, y1: 0, x2: 8, y2: W5 },
    { t: "line", x1: L5 - 8, y1: 0, x2: L5 - 8, y2: W5 },
    { t: "spot", cx: 6, cy: c5 },
    { t: "spot", cx: L5 - 6, cy: c5 },
    { t: "goal", x: -1.2, y: c5 - 2, w: 1.2, h: 4 },
    { t: "goal", x: L5, y: c5 - 2, w: 1.2, h: 4 },
  ],
  views: {
    full: { x: 0, y: 0, w: L5, h: W5 },
    half: { x: L5 / 2, y: 0, w: L5 / 2, h: W5 },
    third: { x: (L5 * 2) / 3, y: 0, w: L5 / 3, h: W5 },
    box: { x: L5 - 12, y: 3, w: 12, h: W5 - 6 },
  },
};
