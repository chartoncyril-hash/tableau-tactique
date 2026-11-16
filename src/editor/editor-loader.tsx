"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// Konva a besoin du navigateur : l'éditeur est chargé à la demande, hors rendu serveur.
const EditorApp = dynamic(() => import("./editor-app"), {
  ssr: false,
  loading: () => <div className="h-dvh animate-pulse bg-muted" aria-busy="true" />,
});

/** Éditeur de démonstration : brouillon gardé sur l'appareil. */
export function EditorLoader() {
  return <EditorApp />;
}

/** Éditeur d'un projet enregistré, désigné par `?id=` dans l'adresse. */
export function ProjectEditorLoader() {
  const id = useSearchParams().get("id") ?? "";
  // Un identifiant mal formé est traité comme un projet introuvable, sans requête.
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  return <EditorApp key={id} projectId={valid ? id : "00000000-0000-0000-0000-000000000000"} />;
}
