"use client";

import {
  CircleDot,
  Cone,
  Hand,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Shapes,
  Shield,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { EQUIPMENT_KINDS, LINE_KINDS, type ZoneShape } from "../scene/types";
import { useEditor, type Tool } from "../store";
import { Chip, ColorInput, IconButton } from "./controls";

const TOOLS: { tool: Tool; icon: LucideIcon; key: string }[] = [
  { tool: { type: "select" }, icon: MousePointer2, key: "select" },
  { tool: { type: "pan" }, icon: Hand, key: "pan" },
  { tool: { type: "player", goalkeeper: false }, icon: User, key: "player" },
  { tool: { type: "player", goalkeeper: true }, icon: Shield, key: "goalkeeper" },
  { tool: { type: "ball" }, icon: CircleDot, key: "ball" },
  { tool: { type: "equipment", kind: "cone" }, icon: Cone, key: "equipment" },
  { tool: { type: "zone", shape: "rect" }, icon: Shapes, key: "zone" },
  { tool: { type: "line", kind: "pass" }, icon: MoveUpRight, key: "line" },
  { tool: { type: "freehand" }, icon: Pencil, key: "freehand" },
  { tool: { type: "text", label: false }, icon: Type, key: "text" },
];

const ZONES: ZoneShape[] = ["rect", "ellipse", "polygon"];

function sameTool(a: Tool, b: Tool) {
  if (a.type !== b.type) return false;
  if (a.type === "player" && b.type === "player") return a.goalkeeper === b.goalkeeper;
  return true;
}

export function Toolbar() {
  const t = useTranslations("editor");
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const teams = useEditor((s) => s.scene.teams);
  const activeTeamId = useEditor((s) => s.activeTeamId);
  const setActiveTeam = useEditor((s) => s.setActiveTeam);
  const look = useEditor((s) => s.playerLook);
  const setLook = useEditor((s) => s.setPlayerLook);
  const ink = useEditor((s) => s.ink);
  const setInk = useEditor((s) => s.setInk);

  const inkPicker = (
    <label className="flex shrink-0 items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("panel.ink")}</span>
      <ColorInput value={ink} onChange={(e) => setInk(e.target.value)} />
    </label>
  );

  let options: React.ReactNode = null;
  if (tool.type === "player") {
    options = (
      <>
        {teams.map((team) => (
          <Chip key={team.id} active={team.id === activeTeamId} onClick={() => setActiveTeam(team.id)}>
            <span className="size-3 rounded-full border border-white/70" style={{ background: team.color }} />
            {team.name}
          </Chip>
        ))}
        {(["disc", "jersey"] as const).map((l) => (
          <Chip key={l} active={look === l} onClick={() => setLook(l)}>
            {t(`looks.${l}`)}
          </Chip>
        ))}
      </>
    );
  } else if (tool.type === "equipment") {
    options = EQUIPMENT_KINDS.map((kind) => (
      <Chip key={kind} active={tool.kind === kind} onClick={() => setTool({ type: "equipment", kind })}>
        {t(`equipment.${kind}`)}
      </Chip>
    ));
  } else if (tool.type === "zone") {
    options = (
      <>
        {ZONES.map((shape) => (
          <Chip key={shape} active={tool.shape === shape} onClick={() => setTool({ type: "zone", shape })}>
            {t(`zones.${shape}`)}
          </Chip>
        ))}
        {tool.shape === "polygon" && (
          <p className="max-w-52 shrink-0 text-xs text-muted-foreground">{t("panel.polygonHint")}</p>
        )}
      </>
    );
  } else if (tool.type === "line") {
    options = (
      <>
        {LINE_KINDS.map((kind) => (
          <Chip key={kind} active={tool.kind === kind} onClick={() => setTool({ type: "line", kind })}>
            {t(`lines.${kind}`)}
          </Chip>
        ))}
        {inkPicker}
      </>
    );
  } else if (tool.type === "freehand") {
    options = inkPicker;
  } else if (tool.type === "text") {
    options = (
      <>
        <Chip active={!tool.label} onClick={() => setTool({ type: "text", label: false })}>
          {t("tools.text")}
        </Chip>
        <Chip active={tool.label} onClick={() => setTool({ type: "text", label: true })}>
          {t("tools.label")}
        </Chip>
        {inkPicker}
      </>
    );
  }

  return (
    <div className="relative z-20 order-last flex shrink-0 flex-col-reverse border-t bg-card md:order-first md:flex-row md:border-t-0 md:border-r">
      <div
        role="toolbar"
        aria-label={t("toolbarLabel")}
        className="flex gap-1 overflow-x-auto p-1.5 md:flex-col md:overflow-x-visible"
      >
        {TOOLS.map(({ tool: item, icon, key }) => (
          <IconButton
            key={key}
            icon={icon}
            label={t(`tools.${key}`)}
            active={sameTool(tool, item)}
            onClick={() => setTool(item)}
          />
        ))}
      </div>
      {options && (
        <div
          data-testid="tool-options"
          className="flex items-center gap-2 overflow-x-auto border-b bg-card p-1.5 md:absolute md:top-2 md:left-full md:ml-2 md:flex-col md:items-stretch md:overflow-visible md:rounded-lg md:border md:p-2 md:shadow-lg"
        >
          {options}
        </div>
      )}
    </div>
  );
}
