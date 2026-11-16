import type { Scene } from "@/editor/scene/types";

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
  scene: Scene;
}

export interface VersionMeta {
  id: string;
  created_at: string;
}

export type ProjectFilter =
  | { kind: "all" | "favorites" | "templates" | "trash" }
  | { kind: "folder"; folderId: string };
