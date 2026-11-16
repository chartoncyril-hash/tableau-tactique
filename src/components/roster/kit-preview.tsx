import type { Kit } from "@/lib/roster";

/** Maillot vu de face, aux couleurs et au motif de l'équipe. */
export function KitPreview({ kit, className }: { kit: Kit; className?: string }) {
  const c1 = kit.color;
  const c2 = kit.color2 ?? "#111827";
  const id = `kit-${c1.slice(1)}-${c2.slice(1)}-${kit.pattern ?? "plain"}`;
  const bands =
    kit.pattern === "stripes"
      ? [0, 2, 4].map((i) => <rect key={i} x={6 + i * 7.2} y="0" width="7.2" height="48" fill={c2} />)
      : kit.pattern === "hoops"
        ? [1, 3].map((i) => <rect key={i} x="0" y={8 + i * 7.5} width="48" height="7.5" fill={c2} />)
        : kit.pattern === "halves"
          ? [<rect key="h" x="24" y="0" width="24" height="48" fill={c2} />]
          : [];
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <clipPath id={id}>
          <path d="M16 4h5q3 4 6 0h5l10 7-4 9-4-2v26H14V18l-4 2-4-9z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="48" height="48" fill={c1} />
        {bands}
      </g>
      <path d="M16 4h5q3 4 6 0h5l10 7-4 9-4-2v26H14V18l-4 2-4-9z" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
    </svg>
  );
}
