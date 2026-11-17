"use client";

import { Box, Expand, Shrink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useEditor } from "../store";
import { setViewMode, useView3d } from "../three/view-mode";
import { IconButton } from "./controls";

export const STAGE_ID = "editor-stage";

/**
 * Plein écran de la zone de travail (tableau, vue 3D et barre d'animation). Absent quand le
 * navigateur ne le permet pas (Safari sur iPhone).
 */
export function FullscreenButton() {
  const t = useTranslations("editor.anim");
  const tView = useTranslations("editor.view3d");
  const view3d = useView3d((s) => s.mode === "3d");
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capacité du navigateur, connue au montage
    setSupported(!!document.fullscreenEnabled);
    const sync = () => setOn(document.fullscreenElement?.id === STAGE_ID);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!supported) return null;
  return (
    <>
      {/* En plein écran, la barre du haut est masquée : la bascule 2D / 3D se retrouve ici. */}
      {on && (
        <IconButton
          icon={Box}
          label={tView("toggle")}
          active={view3d}
          onClick={() => {
            useEditor.getState().select([]);
            setViewMode(view3d ? "2d" : "3d");
          }}
        />
      )}
      <IconButton
        icon={on ? Shrink : Expand}
        label={t(on ? "exitFullscreen" : "fullscreen")}
        active={on}
        onClick={() => {
          if (on) void document.exitFullscreen().catch(() => undefined);
          else
            void document
              .getElementById(STAGE_ID)
              ?.requestFullscreen()
              .catch(() => undefined);
        }}
      />
    </>
  );
}
