"use client";

import dynamic from "next/dynamic";

// Konva a besoin du navigateur : l'éditeur est chargé à la demande, hors rendu serveur.
const EditorApp = dynamic(() => import("./editor-app"), {
  ssr: false,
  loading: () => <div className="h-dvh animate-pulse bg-muted" aria-busy="true" />,
});

export function EditorLoader() {
  return <EditorApp />;
}
