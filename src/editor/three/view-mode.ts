import { create } from "zustand";
import type { CameraPreset } from "./layout";

/** Vue affichée dans l'éditeur (2D modifiable ou 3D en lecture) et état de la vue 3D. */
interface View3dState {
  mode: "2d" | "3d";
  camera: CameraPreset;
  /** Pelouse chargée et objets en relief affichés (lu par l'interface et les tests). */
  ready: boolean;
  objects: number;
  /** Trajectoires tracées en relief (lu par les tests). */
  traces: number;
  /** Joueurs en personnages (par défaut) ou en pions. */
  figures: "people" | "pawns";
  /** Décor : stade avec tribunes (par défaut) ou simple pelouse. */
  decor: "stadium" | "plain";
  /** La présentation affiche sa propre vue 3D : celle de l'éditeur se retire. */
  presenting: boolean;
}

export const useView3d = create<View3dState>(() => ({
  mode: "2d",
  camera: "broadcast",
  ready: false,
  objects: 0,
  traces: 0,
  figures: "people",
  decor: "stadium",
  presenting: false,
}));

export function setViewMode(mode: "2d" | "3d") {
  useView3d.setState(mode === "3d" ? { mode } : { mode, ready: false });
}

export function setCameraPreset(camera: CameraPreset) {
  useView3d.setState({ camera });
}

export function setFigures(figures: "people" | "pawns") {
  useView3d.setState({ figures });
}

export function setDecor(decor: "stadium" | "plain") {
  useView3d.setState({ decor });
}

export function setPresenting3d(presenting: boolean) {
  useView3d.setState({ presenting, ready: false });
}
