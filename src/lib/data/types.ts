import type { Scene } from "@/editor/scene/types";
import type { DrillSheet, SessionSheet } from "@/lib/sheet";

export interface FolderRow {
  id: string;
  name: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  folder_id: string | null;
  tags: string[];
  favorite: boolean;
  is_template: boolean;
  sheet: SessionSheet;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BoardRow {
  id: string;
  project_id: string;
  position: number;
  name: string;
  notes: string;
  video_url: string | null;
  sheet: DrillSheet;
  scene: Scene;
}

export interface ShareRow {
  id: string;
  token: string;
  created_at: string;
}

/** Projet tel que vu par un lien public. */
export interface SharedProject {
  name: string;
  sheet: SessionSheet;
  updated_at: string;
  boards: Pick<BoardRow, "id" | "name" | "notes" | "video_url" | "sheet" | "scene">[];
}

export interface VersionMeta {
  id: string;
  created_at: string;
}

export type ProjectFilter =
  | { kind: "all" | "favorites" | "templates" | "trash" }
  | { kind: "folder"; folderId: string };
