"use client";

import { useTranslations } from "next-intl";
import {
  BALL_SIZE,
  ballPrims,
  CATALOG,
  EQUIPMENT_SIZE,
  equipmentPrims,
  type CatalogItem,
  type Prim,
} from "../scene/catalog";
import { useEditor, type Tool } from "../store";
import { cn } from "@/lib/utils";

function PrimSvg({ p }: { p: Prim }) {
  const common = {
    fill: p.fill ?? "none",
    stroke: p.stroke,
    strokeWidth: p.sw,
    opacity: p.o,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (p.t) {
    case "circle":
      return <circle cx={p.x} cy={p.y} r={p.r} {...common} />;
    case "ellipse":
      return <ellipse cx={p.x} cy={p.y} rx={p.rx} ry={p.ry} {...common} />;
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} {...common} />;
    case "line": {
      const points = p.pts.join(" ");
      return p.closed ? <polygon points={points} {...common} /> : <polyline points={points} {...common} />;
    }
  }
}

/** Vignette SVG d'un objet de la banque, cadrée sur sa boîte. */
export function ItemThumb({ item }: { item: CatalogItem }) {
  const size = item.type === "ball" ? BALL_SIZE[item.style] : EQUIPMENT_SIZE[item.kind];
  const prims = item.type === "ball" ? ballPrims(item.style) : equipmentPrims(item.kind, item.color);
  const side = Math.max(size.w, size.h) + 0.6;
  return (
    <svg viewBox={`${-side / 2} ${-side / 2} ${side} ${side}`} className="size-9" aria-hidden>
      {prims.map((p, i) => (
        <PrimSvg key={i} p={p} />
      ))}
    </svg>
  );
}

function isActive(tool: Tool, item: CatalogItem) {
  if (item.type === "ball") return tool.type === "ball" && (tool.style ?? "classic") === item.style;
  return tool.type === "equipment" && tool.kind === item.kind && tool.color === item.color;
}

export function ObjectPalette() {
  const t = useTranslations("editor");
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);

  return (
    <div
      data-testid="object-palette"
      className="flex max-h-[30dvh] w-full flex-col gap-3 overflow-y-auto md:max-h-[70dvh] md:w-64 md:pr-1"
    >
      {CATALOG.map((category) => (
        <section key={category.id}>
          <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t(`bank.categories.${category.id}`)}
          </h3>
          <div className="grid grid-cols-6 gap-1.5 md:grid-cols-4">
            {category.items.map((item) => {
              const name =
                item.type === "ball" ? t(`bank.balls.${item.style}`) : t(`equipment.${item.kind}`);
              const active = isActive(tool, item);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={name}
                  title={name}
                  aria-pressed={active}
                  data-item={item.id}
                  onClick={() =>
                    setTool(
                      item.type === "ball"
                        ? { type: "ball", style: item.style }
                        : { type: "equipment", kind: item.kind, color: item.color },
                    )
                  }
                  className={cn(
                    // Fond sombre fixe : les objets clairs (buts, plots blancs) restent lisibles dans les deux thèmes.
                    "flex aspect-square w-full items-center justify-center rounded-lg border-2 bg-[#1f5f3c] transition-colors md:size-14",
                    active ? "border-accent" : "border-transparent hover:border-white/50",
                  )}
                >
                  <ItemThumb item={item} />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
