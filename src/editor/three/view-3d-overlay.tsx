"use client";

import { ImagePlus, LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { clearBrandLogo, uploadBrandLogo, useBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { roleIn, useWorkspace } from "@/lib/workspace";
import { useProject } from "../project-session";
import { useEditor } from "../store";
import { CAMERA_PRESETS } from "./layout";
import { FIGURES, setCameraPreset, setDecor, setFigures, useView3d } from "./view-mode";

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

function Choice<T extends string>({
  label,
  value,
  options,
  text,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly T[];
  text: (v: T) => string;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-1 rounded-lg bg-card/90 p-1 text-card-foreground shadow backdrop-blur", className)}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "h-9 shrink-0 rounded-md px-3 text-sm whitespace-nowrap transition-colors",
            value === option ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {text(option)}
        </button>
      ))}
    </div>
  );
}

/** Logo du stade : celui du club du projet (administrateurs) ou de l'espace personnel. */
function LogoButton() {
  const t = useTranslations("editor.view3d");
  const ready = useProject((p) => p.status === "ready");
  const clubId = useProject((p) => p.project?.club_id ?? null);
  const clubs = useWorkspace((w) => w.clubs);
  const brand = useBrand(clubId);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!ready || roleIn(clubId, clubs) !== "admin") return null;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try {
      await job();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-card/90 p-1 text-card-foreground shadow backdrop-blur">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        aria-label={t(clubId ? "logoClub" : "logoMine")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(() => uploadBrandLogo(clubId, file));
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="flex h-9 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap hover:bg-muted disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
        {t(brand?.path ? "logoChange" : "logoAdd")}
      </button>
      {brand?.path && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => clearBrandLogo(clubId))}
          className="h-9 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          {t("logoRemove")}
        </button>
      )}
      {error && (
        <span role="status" className="px-1 text-xs text-destructive">
          {t("logoError")}
        </span>
      )}
    </div>
  );
}

/**
 * Vue 3D et ses réglages (point de vue, joueurs, décor), à la taille de son conteneur. Sert dans
 * l'éditeur et dans la présentation (`interactive` à faux : rien ne se déplace).
 */
export function View3dStage({ interactive = true }: { interactive?: boolean }) {
  const t = useTranslations("editor.view3d");
  const camera = useView3d((s) => s.camera);
  const ready = useView3d((s) => s.ready);
  const objects = useView3d((s) => s.objects);
  const traces = useView3d((s) => s.traces);
  const realistic = useView3d((s) => s.realistic);
  const figures = useView3d((s) => s.figures);
  const decor = useView3d((s) => s.decor);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- détection côté navigateur uniquement
    setSupported(webglAvailable());
  }, []);

  return (
    <div
      data-testid="view-3d"
      data-ready={ready}
      data-objects={objects}
      data-traces={traces}
      data-realistic={realistic}
      data-camera={camera}
      data-decor={decor}
      className="absolute inset-0 bg-[#a9cfe8]"
    >
      {supported === false ? (
        <div className="flex h-full items-center justify-center p-6">
          <p role="alert" className="max-w-sm rounded-lg bg-card p-4 text-center text-sm text-card-foreground shadow">
            {t("unsupported")}
          </p>
        </div>
      ) : (
        supported && <View3D interactive={interactive} />
      )}
      {supported && !ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <LoaderCircle className="size-8 animate-spin text-white drop-shadow" aria-hidden />
          <span className="sr-only">{t("loading")}</span>
        </div>
      )}
      {supported && (
        <>
          <Choice
            label={t("cameras")}
            value={camera}
            options={CAMERA_PRESETS}
            text={(p) => t(`camera.${p}`)}
            onChange={setCameraPreset}
            className="absolute top-2 left-2 max-w-[calc(100%-1rem)] overflow-x-auto"
          />
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5 max-sm:top-14 max-sm:right-auto max-sm:left-2 max-sm:items-start">
            <Choice
              label={t("figures")}
              value={figures}
              options={FIGURES}
              text={(v) => t(`figure.${v}`)}
              onChange={setFigures}
            />
            <Choice
              label={t("decor")}
              value={decor}
              options={["stadium", "plain"] as const}
              text={(v) => t(`decors.${v}`)}
              onChange={setDecor}
            />
            {interactive && decor === "stadium" && <LogoButton />}
          </div>
        </>
      )}
    </div>
  );
}

/** Vue 3D posée par-dessus le canevas 2D (qui reste monté, avec son état et la lecture). */
export function View3dOverlay() {
  const t = useTranslations("editor.view3d");
  const mode = useView3d((s) => s.mode);
  const presenting = useView3d((s) => s.presenting);
  const readOnly = useEditor((s) => s.readOnly);
  // Pendant la présentation, la vue 3D vit dans la présentation : une seule à la fois.
  if (mode !== "3d" || presenting) return null;

  return (
    <section aria-label={t("label")} className="absolute inset-0 z-20">
      <View3dStage />
      <p className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-md bg-black/55 px-2 py-1 text-xs text-white">
        {t(readOnly ? "readOnly" : "help")}
      </p>
    </section>
  );
}
