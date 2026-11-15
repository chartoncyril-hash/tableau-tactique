"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { memo } from "react";
import { Arrow, Circle, Ellipse, Group, Line, Path, Rect, RegularPolygon, Text } from "react-konva";
import { BALL_RADIUS, objectBox, PLAYER_RADIUS, sampleLine } from "../scene/geometry";
import type { EquipmentObject, SceneObject } from "../scene/types";

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

function Equipment({ obj }: { obj: EquipmentObject }) {
  const c = obj.color;
  switch (obj.kind) {
    case "cone":
      return <RegularPolygon sides={3} radius={0.85} fill={c} stroke="#fff" strokeWidth={0.12} {...flat} />;
    case "marker":
      return (
        <>
          <Circle radius={0.6} fill={c} stroke="rgba(0,0,0,0.35)" strokeWidth={0.1} {...flat} />
          <Circle radius={0.22} fill="rgba(0,0,0,0.25)" listening={false} />
        </>
      );
    case "pole":
      return (
        <>
          <Circle radius={0.42} fill="rgba(0,0,0,0.25)" {...flat} />
          <Circle radius={0.24} fill={c} stroke="#fff" strokeWidth={0.08} listening={false} />
        </>
      );
    case "hurdle":
      return (
        <Line
          points={[-1.2, 0.4, -1.2, -0.4, 1.2, -0.4, 1.2, 0.4]}
          stroke={c}
          strokeWidth={0.22}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={1.2}
          {...flat}
        />
      );
    case "ladder":
      return (
        <>
          <Rect x={-2.5} y={-0.6} width={5} height={1.2} stroke={c} strokeWidth={0.14} fill="rgba(0,0,0,0.08)" {...flat} />
          {[-1.875, -1.25, -0.625, 0, 0.625, 1.25, 1.875].map((x) => (
            <Line key={x} points={[x, -0.6, x, 0.6]} stroke={c} strokeWidth={0.12} listening={false} />
          ))}
        </>
      );
    case "mannequin":
      return (
        <>
          <Rect x={-0.55} y={-0.2} width={1.1} height={1} cornerRadius={0.25} fill={c} {...flat} />
          <Circle y={-0.5} radius={0.38} fill={c} stroke="#fff" strokeWidth={0.08} {...flat} />
        </>
      );
    case "minigoal":
      return (
        <>
          <Rect x={-0.6} y={-1.2} width={1.2} height={2.4} fill={c} opacity={0.25} {...flat} />
          <Line points={[0.6, -1.2, -0.6, -1.2, -0.6, 1.2, 0.6, 1.2]} stroke={c} strokeWidth={0.2} lineJoin="round" listening={false} />
        </>
      );
    case "goal":
      return (
        <>
          <Rect x={-1} y={-3.66} width={2} height={7.32} fill={c} opacity={0.25} {...flat} />
          <Line points={[1, -3.66, -1, -3.66, -1, 3.66, 1, 3.66]} stroke={c} strokeWidth={0.26} lineJoin="round" listening={false} />
        </>
      );
  }
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
    case "ball":
      return (
        <>
          <Circle radius={BALL_RADIUS} fill="#fff" stroke="#111827" strokeWidth={0.14} {...flat} />
          <RegularPolygon sides={5} radius={0.32} fill="#111827" listening={false} />
        </>
      );
    case "equipment":
      return <Equipment obj={obj} />;
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
