"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { memo } from "react";
import { Arrow, Circle, Ellipse, Group, Line, Path, Rect, Text } from "react-konva";
import { BALL_SIZE, ballPrims, EQUIPMENT_SIZE, equipmentPrims, type Prim } from "../scene/catalog";
import { objectBox, PLAYER_RADIUS, sampleLine } from "../scene/geometry";
import type { SceneObject } from "../scene/types";

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

export interface NodeHandlers {
  onPointerDown: (e: KonvaEventObject<PointerEvent>) => void;
  onDragStart: (e: KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
}

interface Props {
  obj: SceneObject;
  teamColor: string;
  ink: string;
  draggable: boolean;
  handlers: NodeHandlers;
}

const flat = { perfectDrawEnabled: false, shadowForStrokeEnabled: false } as const;

/** Rend une liste de primitives de la banque d'objets. */
function Prims({ prims, w, h }: { prims: Prim[]; w: number; h: number }) {
  return (
    <>
      {/* Zone de saisie : toute la boîte de l'objet, même là où le dessin est creux. */}
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="rgba(0,0,0,0)" {...flat} />
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

function Shape({ obj, teamColor, ink }: Pick<Props, "obj" | "teamColor" | "ink">) {
  switch (obj.type) {
    case "player": {
      const R = PLAYER_RADIUS;
      const onColor = contrastOn(teamColor);
      return (
        <>
          {obj.goalkeeper && (
            <Circle radius={R + 0.42} stroke="#facc15" strokeWidth={0.26} listening={false} />
          )}
          {obj.look === "jersey" ? (
            <Path data={JERSEY} fill={teamColor} stroke="#fff" strokeWidth={0.16} lineJoin="round" {...flat} />
          ) : (
            <Circle radius={R} fill={teamColor} stroke="#fff" strokeWidth={0.22} {...flat} />
          )}
          <Text
            text={obj.number}
            fontSize={1.7}
            fontStyle="bold"
            fill={onColor}
            width={R * 2}
            height={R * 2}
            offsetX={R}
            offsetY={R - 0.08}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
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
        </>
      );
    }
    case "ball": {
      const style = obj.style ?? "classic";
      return <Prims prims={ballPrims(style)} {...BALL_SIZE[style]} />;
    }
    case "equipment":
      return <Prims prims={equipmentPrims(obj.kind, obj.color)} {...EQUIPMENT_SIZE[obj.kind]} />;
    case "zone":
      if (obj.shape === "rect") {
        return (
          <Rect
            width={obj.width}
            height={obj.height}
            offsetX={obj.width / 2}
            offsetY={obj.height / 2}
            fill={obj.fill}
            opacity={obj.opacity}
            stroke={obj.fill}
            strokeWidth={0.2}
            {...flat}
          />
        );
      }
      if (obj.shape === "ellipse") {
        return (
          <Ellipse
            radiusX={obj.width / 2}
            radiusY={obj.height / 2}
            fill={obj.fill}
            opacity={obj.opacity}
            stroke={obj.fill}
            strokeWidth={0.2}
            {...flat}
          />
        );
      }
      return (
        <Line points={obj.points} closed fill={obj.fill} opacity={obj.opacity} stroke={obj.fill} strokeWidth={0.2} {...flat} />
      );
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
      const common = {
        points,
        stroke: obj.color,
        strokeWidth: obj.width,
        hitStrokeWidth: 2.4,
        lineCap: "round" as const,
        lineJoin: "round" as const,
        dash: obj.dashed ? [1.1, 0.9] : undefined,
        ...flat,
      };
      if (!obj.arrowStart && !obj.arrowEnd) return <Line {...common} />;
      return (
        <Arrow
          {...common}
          fill={obj.color}
          pointerLength={0.9 + obj.width * 1.6}
          pointerWidth={0.9 + obj.width * 1.6}
          pointerAtBeginning={obj.arrowStart}
          pointerAtEnding={obj.arrowEnd}
        />
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
export const ObjectNode = memo(function ObjectNode({ obj, teamColor, ink, draggable, handlers }: Props) {
  const scale = obj.type === "equipment" ? obj.scale : 1;
  return (
    <Group
      id={obj.id}
      name="object"
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
      <Shape obj={obj} teamColor={teamColor} ink={ink} />
    </Group>
  );
});

export type KonvaNode = Konva.Node;
