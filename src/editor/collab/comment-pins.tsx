"use client";

import { Circle, Group, Path, Text } from "react-konva";
import { openComments, threads, useComments } from "./comments";

const BUBBLE = "M0,0 C-7,-9 -11,-13 -11,-20 A11,11 0 1 1 11,-20 C11,-13 7,-9 0,0 Z";

/** Épingles des fils ouverts sur le tableau ; un clic ouvre le fil dans le panneau. */
export function CommentPins({ px }: { px: number }) {
  const rows = useComments((s) => s.rows);
  const draft = useComments((s) => s.draftPin);
  const pinned = threads(rows).filter((t) => t.pin !== null);
  return (
    <>
      {pinned.map((t) => (
        <Group
          key={t.root.id}
          x={t.root.x!}
          y={t.root.y!}
          scaleX={px}
          scaleY={px}
          name="comment-pin"
          onPointerDown={(e) => {
            e.cancelBubble = true;
            openComments(t.root.id);
          }}
        >
          <Path data={BUBBLE} fill="#f59e0b" stroke="#fff" strokeWidth={2} shadowColor="#000" shadowBlur={4} shadowOpacity={0.3} />
          <Text text={String(t.pin)} x={-11} y={-28} width={22} height={16} align="center" verticalAlign="middle" fontSize={12} fontStyle="bold" fill="#111827" />
        </Group>
      ))}
      {draft && (
        <Group x={draft.x} y={draft.y} scaleX={px} scaleY={px} listening={false} opacity={0.85}>
          <Path data={BUBBLE} fill="#f59e0b" stroke="#fff" strokeWidth={2} dash={[3, 2]} />
          <Circle y={-20} radius={3} fill="#111827" />
        </Group>
      )}
    </>
  );
}
