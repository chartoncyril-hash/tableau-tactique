"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { memo } from "react";
import { Arrow, Circle, Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text } from "react-konva";
import { BALL_SIZE, ballPrims, EQUIPMENT_SIZE, equipmentPrims, type Prim } from "../scene/catalog";
import { arrowHead, endBar, objectBox, offsetPolyline, PLAYER_RADIUS, sampleLine } from "../scene/geometry";
import type { SceneObject, Team } from "../scene/types";
import { ARMS, FACING_TIP } from "../export/svg";

const JERSEY =
  "M-1.1,-1.6 L-0.45,-1.6 Q0,-1.15 0.45,-1.6 L1.1,-1.6 L2.05,-0.75 L1.5,-0.1 L1.1,-0.45 L1.1,1.6 L-1.1,1.6 L-1.1,-0.45 L-1.5,-0.1 L-2.05,-0.75 Z";

export function contrastOn(hex: string) {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.replace(/./g, "$&$&") : c;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111827" : "#ffffff";
}

/** Remplissage d'un jeton : uni, ou bandes nettes via un dégradé à paliers. */
function teamFill(team: Team | undefined, extent: number) {
  const c1 = team?.color ?? "#6b7280";
  const pattern = team?.pattern ?? "plain";
  if (pattern === "plain") return { fill: c1 };
  const c2 = team?.color2 ?? "#111827";
  const bands = pattern === "halves" ? [c1, c2] : [c1, c2, c1, c2, c1];
  const stops: (number | string)[] = [];
  bands.forEach((c, i) => stops.push(i / bands.length, c, (i + 1) / bands.length, c));
  const across = pattern !== "hoops";
  return {
    fillPriority: "linear-gradient",
    fillLinearGradientStartPoint: { x: across ? -extent : 0, y: across ? 0 : -extent },
    fillLinearGradientEndPoint: { x: across ? extent : 0, y: across ? 0 : extent },
    fillLinearGradientColorStops: stops,
  };
}

const hatchTiles = new Map<string, HTMLCanvasElement>();

/** Tuile de hachures diagonales, raccordable, mise en cache par couleur. */
function hatchTile(color: string) {
  let tile = hatchTiles.get(color);
  if (!tile) {
    tile = document.createElement("canvas");
    tile.width = tile.height = 32;
    const g = tile.getContext("2d")!;
    g.strokeStyle = color;
    g.lineWidth = 9;
    for (const o of [-32, 0, 32]) {
      g.beginPath();
      g.moveTo(o - 4, 36);
      g.lineTo(o + 36, -4);
      g.stroke();
    }
    hatchTiles.set(color, tile);
  }
  return tile;
}

export interface NodeHandlers {
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  onDragStart: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
}

interface Props {
  obj: SceneObject;
  team: Team | undefined;
  /** Photo chargée du joueur, s'il en a une. */
  photo?: HTMLImageElement;
  ink: string;
  draggable: boolean;
  handlers: NodeHandlers;
  /** Montre l'orientation des joueurs (bras et pointe). */
  showFacing?: boolean;
}

const flat = { perfectDrawEnabled: false, shadowForStrokeEnabled: false } as const;

const MIN_TOUCH = 20;

/** Zone de saisie circulaire, jamais plus petite qu'une cible tactile à l'écran. */
function HitDisc({ radius }: { radius: number }) {
  return (
    <Circle
      radius={radius}
      fill="rgba(0,0,0,0)"
      hitFunc={(ctx, shape) => {
        const scale = shape.getAbsoluteScale().x || 1;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(radius, MIN_TOUCH / scale), 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStrokeShape(shape);
      }}
      {...flat}
    />
  );
}

/** Rend une liste de primitives de la banque d'objets. */
function Prims({ prims, w, h }: { prims: Prim[]; w: number; h: number }) {
  return (
    <>
      {/* Zone de saisie : toute la boîte de l'objet, même là où le dessin est creux. */}
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill="rgba(0,0,0,0)"
        hitFunc={(ctx, shape) => {
          const scale = shape.getAbsoluteScale().x || 1;
          const hw = Math.max(w / 2, MIN_TOUCH / scale);
          const hh = Math.max(h / 2, MIN_TOUCH / scale);
          ctx.beginPath();
          ctx.rect(-hw, -hh, hw * 2, hh * 2);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
        {...flat}
      />
      {prims.map((p, i) => {
        const common = {
          fill: p.fill,
          stroke: p.stroke,
          strokeWidth: p.sw,
          opacity: p.o,
          listening: false,
          ...flat,
        };
        switch (p.t) {
          case "circle":
            return <Circle key={i} {...common} x={p.x} y={p.y} radius={p.r} />;
          case "ellipse":
            return <Ellipse key={i} {...common} x={p.x} y={p.y} radiusX={p.rx} radiusY={p.ry} />;
          case "rect":
            return <Rect key={i} {...common} x={p.x} y={p.y} width={p.w} height={p.h} cornerRadius={p.r} />;
          case "line":
            return <Line key={i} {...common} points={p.pts} closed={p.closed} lineCap="round" lineJoin="round" />;
        }
      })}
    </>
  );
}

function Arms({ color }: { color: string }) {
  return (
    <>
      {ARMS.map((a, i) => (
        <Ellipse
          key={i}
          x={a.x}
          y={a.y}
          rotation={a.rotation}
          radiusX={0.7}
          radiusY={0.42}
          fill={color}
          stroke="#fff"
          strokeWidth={0.16}
          listening={false}
          {...flat}
        />
      ))}
    </>
  );
}

function Shape({
  obj,
  team,
  ink,
  photo,
  facing,
}: Pick<Props, "obj" | "team" | "ink" | "photo"> & { facing: boolean }) {
  switch (obj.type) {
    case "player": {
      const R = PLAYER_RADIUS;
      const color = team?.color ?? "#6b7280";
      const patterned = !!team?.pattern && team.pattern !== "plain";
      const fill = teamFill(team, obj.look === "jersey" ? 2.05 : R);
      const jersey = obj.look === "jersey";
      return (
        <>
          <HitDisc radius={R} />
          {/* Bras : ils sortent des épaules, côté avant (le repère tourne avec le joueur). */}
          {facing && !jersey && <Arms color={color} />}
          {/* Tout ce qui se lit reste droit à l'écran, quelle que soit l'orientation. */}
          <Group name="upright" rotation={-obj.rotation} listening={false}>
            {obj.goalkeeper && <Circle radius={R + 0.42} stroke="#facc15" strokeWidth={0.26} listening={false} />}
            {jersey ? (
              <Path data={JERSEY} {...fill} stroke="#fff" strokeWidth={0.16} lineJoin="round" {...flat} />
            ) : (
              <Circle radius={R} {...fill} stroke="#fff" strokeWidth={0.22} {...flat} />
            )}
            {photo && !jersey && (
              <>
                {/* Photo ronde, cerclée aux couleurs de l'équipe ; le numéro passe en pastille. */}
                <Group
                  listening={false}
                  clipFunc={(ctx) => {
                    ctx.arc(0, 0, R - 0.2, 0, Math.PI * 2);
                  }}
                >
                  <KonvaImage image={photo} x={-R} y={-R} width={R * 2} height={R * 2} />
                </Group>
                <Circle radius={R - 0.1} stroke={color} strokeWidth={0.32} listening={false} />
                <Circle x={R * 0.78} y={R * 0.78} radius={0.75} fill={color} stroke="#fff" strokeWidth={0.1} listening={false} />
                <Text
                  text={obj.number}
                  x={R * 0.78}
                  y={R * 0.78}
                  fontSize={0.85}
                  fontStyle="bold"
                  fill={contrastOn(color)}
                  width={1.5}
                  height={1.5}
                  offsetX={0.75}
                  offsetY={0.7}
                  align="center"
                  verticalAlign="middle"
                  listening={false}
                />
              </>
            )}
            <Text
              visible={!(photo && !jersey)}
              text={obj.number}
              fontSize={1.7}
              fontStyle="bold"
              fill={patterned ? "#ffffff" : contrastOn(color)}
              stroke={patterned ? "#111827" : undefined}
              strokeWidth={patterned ? 0.32 : 0}
              fillAfterStrokeEnabled
              width={R * 2}
              height={R * 2}
              offsetX={R}
              offsetY={R - 0.08}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
            {obj.captain && (
              <>
                <Circle x={R * 0.85} y={-R * 0.85} radius={0.62} fill="#facc15" stroke="#111827" strokeWidth={0.1} listening={false} />
                <Text
                  text="C"
                  x={R * 0.85}
                  y={-R * 0.85}
                  fontSize={0.85}
                  fontStyle="bold"
                  fill="#111827"
                  width={1.24}
                  height={1.24}
                  offsetX={0.62}
                  offsetY={0.58}
                  align="center"
                  verticalAlign="middle"
                  listening={false}
                />
              </>
            )}
            {obj.name ? (
              <Text
                text={obj.name}
                y={R + 0.35}
                fontSize={1.3}
                fontStyle="600"
                fill={ink}
                width={16}
                offsetX={8}
                align="center"
                listening={false}
              />
            ) : null}
            {obj.role ? (
              <Text
                text={obj.role}
                y={-R - 1.55}
                fontSize={1.05}
                fill={ink}
                opacity={0.85}
                width={10}
                offsetX={5}
                align="center"
                listening={false}
              />
            ) : null}
          </Group>
          {/* Pointe vers l'avant : le regard du joueur. */}
          {facing && <Line points={FACING_TIP} closed fill="#ffffff" stroke="rgba(17,24,39,0.45)" strokeWidth={0.08} lineJoin="round" listening={false} />}
        </>
      );
    }
    case "ball": {
      const style = obj.style ?? "classic";
      return <Prims prims={ballPrims(style)} {...BALL_SIZE[style]} />;
    }
    case "equipment":
      return <Prims prims={equipmentPrims(obj.kind, obj.color)} {...EQUIPMENT_SIZE[obj.kind]} />;
    case "zone": {
      const paint =
        obj.pattern === "hatch"
          ? {
              fillPatternImage: hatchTile(obj.fill) as unknown as HTMLImageElement,
              fillPatternScale: { x: 2.6 / 32, y: 2.6 / 32 },
              fillPatternRepeat: "repeat",
              fillPriority: "pattern",
            }
          : { fill: obj.fill };
      const common = { ...paint, opacity: obj.opacity, stroke: obj.fill, strokeWidth: 0.25, ...flat };
      if (obj.shape === "rect") {
        return (
          <Rect width={obj.width} height={obj.height} offsetX={obj.width / 2} offsetY={obj.height / 2} {...common} />
        );
      }
      if (obj.shape === "ellipse") {
        return <Ellipse radiusX={obj.width / 2} radiusY={obj.height / 2} {...common} />;
      }
      return <Line points={obj.points} closed {...common} />;
    }
    case "text": {
      const box = objectBox(obj);
      const w = box.w + obj.size;
      return (
        <>
          {obj.label && (
            <Rect
              width={box.w + obj.size * 0.8}
              height={box.h + obj.size * 0.3}
              offsetX={(box.w + obj.size * 0.8) / 2}
              offsetY={(box.h + obj.size * 0.3) / 2}
              cornerRadius={obj.size * 0.3}
              fill={contrastOn(obj.color)}
              opacity={0.9}
              {...flat}
            />
          )}
          <Text
            text={obj.text}
            fontSize={obj.size}
            fontStyle="600"
            lineHeight={1.2}
            fill={obj.color}
            width={w}
            height={box.h}
            offsetX={w / 2}
            offsetY={box.h / 2}
            align="center"
            verticalAlign="middle"
            {...flat}
          />
        </>
      );
    }
    case "line": {
      const points = sampleLine(obj);
      const head = 0.9 + obj.width * 1.6;
      const stroke = {
        stroke: obj.color,
        strokeWidth: obj.width,
        lineCap: "round" as const,
        lineJoin: "round" as const,
        dash: obj.dashed ? [1.1, 0.9] : undefined,
        ...flat,
      };
      const bar = obj.barEnd ? (
        <Line points={endBar(points, 0.9 + obj.width)} {...stroke} dash={undefined} listening={false} />
      ) : null;
      if (obj.double) {
        const gap = obj.width * 0.9 + 0.14;
        return (
          <>
            {/* Trait invisible : sert uniquement de zone de saisie. */}
            <Line points={points} stroke="rgba(0,0,0,0)" strokeWidth={gap * 2} hitStrokeWidth={2.4} {...flat} />
            <Line points={offsetPolyline(points, gap)} {...stroke} listening={false} />
            <Line points={offsetPolyline(points, -gap)} {...stroke} listening={false} />
            {obj.arrowEnd && <Line points={arrowHead(points, true, head * 1.5)} closed fill={obj.color} listening={false} />}
            {obj.arrowStart && <Line points={arrowHead(points, false, head * 1.5)} closed fill={obj.color} listening={false} />}
            {bar}
          </>
        );
      }
      return (
        <>
          {obj.arrowStart || obj.arrowEnd ? (
            <Arrow
              points={points}
              {...stroke}
              hitStrokeWidth={2.4}
              fill={obj.color}
              pointerLength={head}
              pointerWidth={head}
              pointerAtBeginning={obj.arrowStart}
              pointerAtEnding={obj.arrowEnd}
            />
          ) : (
            <Line points={points} {...stroke} hitStrokeWidth={2.4} />
          )}
          {bar}
        </>
      );
    }
    case "freehand":
      return (
        <Line
          points={obj.points}
          stroke={obj.color}
          strokeWidth={obj.width}
          hitStrokeWidth={2.4}
          tension={0.4}
          lineCap="round"
          lineJoin="round"
          {...flat}
        />
      );
  }
}

/** Un objet de la scène. Mémoïsé : seul un objet modifié est rendu à nouveau. */
export const ObjectNode = memo(function ObjectNode({ obj, team, ink, photo, draggable, handlers, showFacing = true }: Props) {
  const scale = obj.type === "equipment" ? obj.scale : 1;
  return (
    <Group
      id={obj.id}
      name={`object ${obj.type}`}
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation}
      scaleX={scale}
      scaleY={scale}
      draggable={draggable}
      onPointerDown={handlers.onPointerDown}
      onDragStart={handlers.onDragStart}
      onDragMove={handlers.onDragMove}
      onDragEnd={handlers.onDragEnd}
    >
      <Shape obj={obj} team={team} ink={ink} photo={photo} facing={showFacing} />
    </Group>
  );
});

export type KonvaNode = Konva.Node;

/** Contre-rotation de la partie lisible d'un joueur (numéro, nom…) quand on le tourne sans React. */
export function keepUpright(node: Konva.Node, rotation: number) {
  if (!node.hasName("player")) return;
  (node as Konva.Group).findOne(".upright")?.rotation(-rotation);
}
