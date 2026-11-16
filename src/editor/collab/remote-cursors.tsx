"use client";

import { Group, Line, Rect, Text } from "react-konva";
import { useProject } from "../project-session";
import { useCollab } from "./session";

/** Pointeurs des autres entraîneurs sur le tableau affiché, à taille constante à l'écran. */
export function RemoteCursors({ px }: { px: number }) {
  const cursors = useCollab((s) => s.cursors);
  const peers = useCollab((s) => s.peers);
  const board = useProject((s) => s.currentId);
  const byKey = new Map(peers.map((p) => [p.key, p]));
  return (
    <>
      {Object.entries(cursors).map(([key, cursor]) => {
        const peer = byKey.get(key);
        if (!peer || cursor.board !== board) return null;
        const label = peer.name.slice(0, 18);
        const width = (label.length * 7 + 12) * px;
        return (
          <Group key={key} x={cursor.x} y={cursor.y} listening={false} name="remote-cursor">
            <Line
              points={[0, 0, 0, 16 * px, 4.5 * px, 12 * px, 8 * px, 19 * px, 10.5 * px, 18 * px, 7 * px, 11 * px, 12 * px, 11 * px]}
              closed
              fill={peer.color}
              stroke="#fff"
              strokeWidth={1.2 * px}
              lineJoin="round"
            />
            <Rect x={12 * px} y={16 * px} width={width} height={18 * px} cornerRadius={4 * px} fill={peer.color} />
            <Text x={18 * px} y={19 * px} text={label} fontSize={12 * px} fontStyle="600" fill="#fff" />
          </Group>
        );
      })}
    </>
  );
}
