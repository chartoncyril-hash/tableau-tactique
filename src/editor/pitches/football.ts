import type { PitchDefinition } from "./types";

const L = 105;
const W = 68;
const cy = W / 2;
// Angle sous lequel l'arc de réparation sort de la surface (cos θ = 5,5 / 9,15).
const arcAngle = 53.05;

export const football: PitchDefinition = {
  id: "football",
  length: L,
  width: W,
  lineWidth: 0.18,
  markings: [
    { t: "rect", x: 0, y: 0, w: L, h: W },
    { t: "line", x1: L / 2, y1: 0, x2: L / 2, y2: W },
    { t: "circle", cx: L / 2, cy, r: 9.15 },
    { t: "spot", cx: L / 2, cy },
    { t: "rect", x: 0, y: cy - 20.16, w: 16.5, h: 40.32 },
    { t: "rect", x: L - 16.5, y: cy - 20.16, w: 16.5, h: 40.32 },
    { t: "rect", x: 0, y: cy - 9.16, w: 5.5, h: 18.32 },
    { t: "rect", x: L - 5.5, y: cy - 9.16, w: 5.5, h: 18.32 },
    { t: "spot", cx: 11, cy },
    { t: "spot", cx: L - 11, cy },
    { t: "arc", cx: 11, cy, r: 9.15, from: -arcAngle, to: arcAngle },
    { t: "arc", cx: L - 11, cy, r: 9.15, from: 180 - arcAngle, to: 180 + arcAngle },
    { t: "arc", cx: 0, cy: 0, r: 1, from: 0, to: 90 },
    { t: "arc", cx: L, cy: 0, r: 1, from: 90, to: 180 },
    { t: "arc", cx: L, cy: W, r: 1, from: 180, to: 270 },
    { t: "arc", cx: 0, cy: W, r: 1, from: 270, to: 360 },
    { t: "goal", x: -2, y: cy - 3.66, w: 2, h: 7.32 },
    { t: "goal", x: L, y: cy - 3.66, w: 2, h: 7.32 },
  ],
  views: {
    full: { x: 0, y: 0, w: L, h: W },
    half: { x: L / 2, y: 0, w: L / 2, h: W },
    third: { x: 70, y: 0, w: 35, h: W },
    box: { x: 80, y: 6, w: 25, h: 56 },
  },
};
