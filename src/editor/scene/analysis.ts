import { Delaunay } from "d3-delaunay";
import type { Box } from "./geometry";
import { clusterLines } from "./geometry";
import type { Orientation, PlayerObject, Team } from "./types";

/**
 * Surcouches d'analyse, communes au canevas 2D et à la vue 3D : zones d'influence (diagramme de
 * Voronoï des joueurs) et lignes du bloc équipe avec les écarts entre lignes.
 */

export interface VoronoiCell {
  id: string;
  color: string;
  points: number[];
}

export function voronoiCells(players: PlayerObject[], rect: Box, teams: Team[]): VoronoiCell[] {
  if (players.length < 2) return [];
  const colors = new Map(teams.map((t) => [t.id, t.color]));
  const diagram = Delaunay.from(players.map((p) => [p.x, p.y] as [number, number])).voronoi([
    rect.x,
    rect.y,
    rect.x + rect.w,
    rect.y + rect.h,
  ]);
  return players.flatMap((p, i) => {
    const cell = diagram.cellPolygon(i);
    return cell ? [{ id: p.id, color: colors.get(p.teamId) ?? "#6b7280", points: cell.flat() }] : [];
  });
}

export interface TeamBlock {
  id: string;
  color: string;
  lines: { points: number[]; mean: number; count: number }[];
  gaps: { x: number; y: number; label: string }[];
}

export function blockLines(players: PlayerObject[], teams: Team[], orientation: Orientation, rect: Box): TeamBlock[] {
  const horizontal = orientation === "horizontal";
  const depth = (p: PlayerObject) => (horizontal ? p.x : p.y);
  const lateral = (p: PlayerObject) => (horizontal ? p.y : p.x);
  return teams.flatMap((team) => {
    const outfield = players.filter((p) => p.teamId === team.id && !p.goalkeeper).sort((a, b) => depth(a) - depth(b));
    if (outfield.length < 3) return [];
    const groups = clusterLines(outfield.map(depth));
    let index = 0;
    const lines = groups.map((g) => {
      const members = outfield.slice(index, index + g.length).sort((a, b) => lateral(a) - lateral(b));
      index += g.length;
      const mean = g.reduce((a, b) => a + b, 0) / g.length;
      return { points: members.flatMap((m) => [m.x, m.y]), mean, count: members.length };
    });
    const mid = horizontal ? rect.y + rect.h / 2 : rect.x + rect.w / 2;
    const gaps = lines.slice(1).map((line, i) => {
      const at = (line.mean + lines[i].mean) / 2;
      return {
        x: horizontal ? at : mid,
        y: horizontal ? mid : at,
        label: `${Math.abs(line.mean - lines[i].mean).toFixed(1)} m`,
      };
    });
    return [{ id: team.id, color: team.color, lines, gaps }];
  });
}
