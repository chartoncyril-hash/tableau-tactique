"use client";

import { memo } from "react";
import { Arc, Circle, Group, Layer, Line, Rect } from "react-konva";
import { getPitch } from "../pitches";
import type { PitchSettings } from "../scene/types";

const MARGIN = 3;
const BANDS = 18;

/** Calque du terrain : jamais interactif, redessiné seulement quand les réglages changent. */
export const PitchLayer = memo(function PitchLayer({ settings }: { settings: PitchSettings }) {
  const pitch = getPitch(settings.sport);
  const { length: L, width: W, lineWidth } = pitch;
  const view = pitch.views[settings.view === "blank" ? "full" : settings.view];
  const vertical = settings.orientation === "vertical";
  const stroke = { stroke: settings.lines, strokeWidth: lineWidth, listening: false };
  const band = L / BANDS;
  const crossBand = W / 12;

  return (
    <Layer listening={false}>
      <Group
        rotation={vertical ? -90 : 0}
        y={vertical ? L : 0}
        clipX={view.x - MARGIN}
        clipY={view.y - MARGIN}
        clipWidth={view.w + MARGIN * 2}
        clipHeight={view.h + MARGIN * 2}
      >
        <Rect x={-MARGIN} y={-MARGIN} width={L + MARGIN * 2} height={W + MARGIN * 2} fill={settings.grass} />
        {settings.mow !== "plain" &&
          Array.from({ length: BANDS / 2 }, (_, i) => (
            <Rect key={`b${i}`} x={i * 2 * band} y={0} width={band} height={W} fill="#000" opacity={0.07} />
          ))}
        {settings.mow === "checker" &&
          Array.from({ length: 6 }, (_, i) => (
            <Rect key={`c${i}`} x={0} y={i * 2 * crossBand} width={L} height={crossBand} fill="#000" opacity={0.07} />
          ))}
        {settings.view !== "blank" &&
          pitch.markings.map((m, i) => {
            switch (m.t) {
              case "line":
                return <Line key={i} points={[m.x1, m.y1, m.x2, m.y2]} {...stroke} />;
              case "rect":
                return <Rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} {...stroke} />;
              case "circle":
                return <Circle key={i} x={m.cx} y={m.cy} radius={m.r} {...stroke} />;
              case "arc":
                return (
                  <Arc
                    key={i}
                    x={m.cx}
                    y={m.cy}
                    innerRadius={m.r}
                    outerRadius={m.r}
                    angle={m.to - m.from}
                    rotation={m.from}
                    {...stroke}
                  />
                );
              case "spot":
                return <Circle key={i} x={m.cx} y={m.cy} radius={0.3} fill={settings.lines} listening={false} />;
              case "goal":
                return (
                  <Rect
                    key={i}
                    x={m.x}
                    y={m.y}
                    width={m.w}
                    height={m.h}
                    fill={settings.lines}
                    opacity={0.35}
                    stroke={settings.lines}
                    strokeWidth={lineWidth}
                  />
                );
            }
          })}
      </Group>
    </Layer>
  );
});
