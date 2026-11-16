import { create } from "zustand";
import type { CameraPreset } from "./layout";

/** Vue affichée dans l'éditeur (2D modifiable ou 3D en lecture) et état de la vue 3D. */
interface View3dState {
  mode: "2d" | "3d";
  camera: CameraPreset;
  /** Pelouse chargée et objets en relief affichés (lu par l'interface et les tests). */
  ready: boolean;
  objects: number;
}

export const useView3d = create<View3dState>(() => ({ mode: "2d", camera: "broadcast", ready: false, objects: 0 }));

export function setViewMode(mode: "2d" | "3d") {
  useView3d.setState(mode === "3d" ? { mode } : { mode, ready: false });
}

export function setCameraPreset(camera: CameraPreset) {
  useView3d.setState({ camera });
}
