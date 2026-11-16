"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// Konva a besoin du navigateur : l'éditeur est chargé à la demande, hors rendu serveur.
const EditorApp = dynamic(() => import("./editor-app"), {
  ssr: false,
  loading: () => <div className="h-dvh animate-pulse bg-muted" aria-busy="true" />,
});

const SessionSheetApp = dynamic(() => import("./sheet/session-sheet-app"), {
  ssr: false,
  loading: () => <div className="h-dvh animate-pulse bg-muted" aria-busy="true" />,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = "00000000-0000-0000-0000-000000000000";

/** Identifiants lus dans l'adresse ; un identifiant mal formé est traité comme introuvable, sans requête. */
function useIds() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const board = params.get("board") ?? "";
  return { id: UUID.test(id) ? id : MISSING, board: UUID.test(board) ? board : undefined };
}

/** Éditeur de démonstration : brouillon gardé sur l'appareil. */
export function EditorLoader() {
  return <EditorApp />;
}

/** Éditeur d'un projet enregistré : `?id=` désigne le projet, `?board=` le tableau à ouvrir. */
export function ProjectEditorLoader() {
  const { id, board } = useIds();
  return <EditorApp key={`${id}:${board ?? ""}`} projectId={id} boardId={board} />;
}

/** Fiche de séance d'un projet enregistré, modifiable en place. */
export function SessionSheetLoader() {
  const { id } = useIds();
  return <SessionSheetApp key={id} projectId={id} />;
}
