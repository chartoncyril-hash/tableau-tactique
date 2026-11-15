import type { CSSProperties } from "react";

type Dot = { x: number; y: number; dx?: number; dy?: number };

const teamA: Dot[] = [
  { x: 60, y: 160 },
  { x: 150, y: 70, dx: 30, dy: 10 },
  { x: 150, y: 250, dx: 30, dy: -10 },
  { x: 250, y: 120, dx: 45, dy: -25 },
  { x: 250, y: 205, dx: 40, dy: 20 },
  { x: 340, y: 160, dx: 55, dy: 0 },
];

const teamB: Dot[] = [
  { x: 540, y: 160 },
  { x: 455, y: 80, dx: -15, dy: 15 },
  { x: 455, y: 240, dx: -15, dy: -15 },
  { x: 400, y: 160, dx: 20, dy: 30 },
];

function Player({ dot, fill, n }: { dot: Dot; fill: string; n: number }) {
  const style = { "--dx": `${dot.dx ?? 0}px`, "--dy": `${dot.dy ?? 0}px` } as CSSProperties;
  return (
    <g className={dot.dx || dot.dy ? "pitch-run" : undefined} style={style}>
      <circle cx={dot.x} cy={dot.y} r="13" fill={fill} stroke="var(--pitch-line)" strokeWidth="2" />
      <text
        x={dot.x}
        y={dot.y + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#fff"
      >
        {n}
      </text>
    </g>
  );
}

export function PitchIllustration({ label }: { label: string }) {
  return (
    <svg
      viewBox="0 0 600 320"
      role="img"
      aria-label={label}
      className="w-full rounded-xl border shadow-lg"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill="var(--pitch-line)" />
        </marker>
      </defs>
      <rect width="600" height="320" fill="var(--pitch)" />
      {[0, 2, 4, 6, 8].map((i) => (
        <rect key={i} x={i * 60 + 30} width="60" height="320" fill="var(--pitch-stripe)" />
      ))}
      <g fill="none" stroke="var(--pitch-line)" strokeWidth="2">
        <rect x="20" y="20" width="560" height="280" />
        <line x1="300" y1="20" x2="300" y2="300" />
        <circle cx="300" cy="160" r="42" />
        <rect x="20" y="85" width="80" height="150" />
        <rect x="20" y="125" width="30" height="70" />
        <rect x="500" y="85" width="80" height="150" />
        <rect x="550" y="125" width="30" height="70" />
        <path d="M265 130 C 300 100, 340 110, 380 135" strokeDasharray="7 6" markerEnd="url(#arrow)" />
        <path d="M355 165 C 400 190, 440 200, 485 180" markerEnd="url(#arrow)" />
      </g>
      {teamA.map((dot, i) => (
        <Player key={`a${i}`} dot={dot} fill="var(--team-a)" n={i + 1} />
      ))}
      {teamB.map((dot, i) => (
        <Player key={`b${i}`} dot={dot} fill="var(--team-b)" n={i + 1} />
      ))}
      <circle cx="268" cy="132" r="6" fill="#fff" stroke="#111" strokeWidth="1.5" />
    </svg>
  );
}
