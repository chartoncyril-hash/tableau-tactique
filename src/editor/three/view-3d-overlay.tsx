"use client";

import { LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CAMERA_PRESETS } from "./layout";
import { setCameraPreset, useView3d } from "./view-mode";

// three.js n'est téléchargé qu'à la première ouverture de la vue 3D.
const View3D = dynamic(() => import("./view-3d"), { ssr: false });

function webglAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Vue 3D posée par-dessus le canevas 2D (qui reste monté, avec son état et la lecture). */
export function View3dOverlay() {
  const t = useTranslations("editor.view3d");
  const mode = useView3d((s) => s.mode);
  const camera = useView3d((s) => s.camera);
  const ready = useView3d((s) => s.ready);
  const objects = useView3d((s) => s.objects);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- détection côté navigateur uniquement
    if (mode === "3d" && supported === null) setSupported(webglAvailable());
  }, [mode, supported]);

  if (mode !== "3d") return null;

  return (
    <section
      aria-label={t("label")}
      data-testid="view-3d"
      data-ready={ready}
      data-objects={objects}
      data-camera={camera}
      className="absolute inset-0 z-20 bg-[#a9cfe8]"
    >
      {supported === false ? (
        <div className="flex h-full items-center justify-center p-6">
          <p role="alert" className="max-w-sm rounded-lg bg-card p-4 text-center text-sm shadow">
            {t("unsupported")}
          </p>
        </div>
      ) : (
        supported && <View3D />
      )}
      {supported && !ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-white drop-shadow" aria-hidden />
          <span className="sr-only">{t("loading")}</span>
        </div>
      )}
      {supported && (
        <>
          <div
            role="radiogroup"
            aria-label={t("cameras")}
            className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] gap-1 overflow-x-auto rounded-lg bg-card/90 p-1 shadow backdrop-blur"
          >
            {CAMERA_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                role="radio"
                aria-checked={camera === preset}
                onClick={() => setCameraPreset(preset)}
                className={cn(
                  "h-9 shrink-0 rounded-md px-3 text-sm whitespace-nowrap transition-colors",
                  camera === preset ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {t(`camera.${preset}`)}
              </button>
            ))}
          </div>
          <p className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-md bg-black/55 px-2 py-1 text-xs text-white">
            {t("readOnly")}
          </p>
        </>
      )}
    </section>
  );
}
