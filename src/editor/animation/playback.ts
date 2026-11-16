import { create } from "zustand";
import { locate, posesAt, resolveStep, stepStart, totalDuration, type Pose } from "../scene/animation";
import { useEditor } from "../store";

/**
 * Lecture de l'animation. Les poses sont poussées directement vers le canevas à chaque image,
 * sans passer par React ; seuls l'étape en cours et le temps affiché sont des états.
 */
interface PlaybackState {
  mode: "idle" | "playing" | "paused";
  /** Étape en cours de lecture (à partir de 1). */
  step: number;
  /** Temps écoulé, en secondes, rafraîchi quelques fois par seconde pour l'affichage. */
  time: number;
  loop: boolean;
  speed: number;
  traces: boolean;
}

export const usePlayback = create<PlaybackState>(() => ({
  mode: "idle",
  step: 0,
  time: 0,
  loop: false,
  speed: 1,
  traces: true,
}));

/** Le canevas y branche son rendu : une carte de poses, ou null pour revenir à l'étape affichée. */
export const playbackTarget: { render: (poses: Map<string, Pose> | null) => void } = {
  render: () => {},
};

let raf = 0;
let clock = 0;
let time = 0;
let shownAt = 0;

function draw() {
  const scene = useEditor.getState().scene;
  const { step, p } = locate(scene, time);
  playbackTarget.render(posesAt(scene, step, p));
  if (usePlayback.getState().step !== step) usePlayback.setState({ step });
}

function tick(now: number) {
  const scene = useEditor.getState().scene;
  const total = totalDuration(scene);
  const state = usePlayback.getState();
  time += ((now - clock) / 1000) * state.speed;
  clock = now;
  if (time >= total) {
    if (state.loop) {
      time %= total;
    } else {
      time = total;
      draw();
      stop();
      return;
    }
  }
  draw();
  if (now - shownAt > 100) {
    shownAt = now;
    usePlayback.setState({ time });
  }
  raf = requestAnimationFrame(tick);
}

export function play() {
  const { scene, currentStep } = useEditor.getState();
  const frames = scene.frames?.length ?? 0;
  if (frames === 0) return;
  if (usePlayback.getState().mode === "idle") {
    // Depuis le départ, sauf si l'on est au milieu de l'animation : on rejoue alors l'étape affichée.
    time = currentStep >= 1 && currentStep < frames ? stepStart(scene, currentStep) : 0;
    useEditor.getState().select([]);
  }
  cancelAnimationFrame(raf);
  clock = performance.now();
  usePlayback.setState({ mode: "playing", time });
  draw();
  raf = requestAnimationFrame(tick);
}

export function pause() {
  cancelAnimationFrame(raf);
  if (usePlayback.getState().mode === "playing") usePlayback.setState({ mode: "paused", time });
}

/** Arrête la lecture et affiche l'étape sur laquelle elle s'est arrêtée. */
export function stop(toStep?: number) {
  cancelAnimationFrame(raf);
  if (usePlayback.getState().mode === "idle") return;
  const scene = useEditor.getState().scene;
  const landed = toStep ?? (time <= 0 ? 0 : locate(scene, time).step);
  usePlayback.setState({ mode: "idle", time: 0, step: 0 });
  useEditor.getState().setStep(landed);
  playbackTarget.render(null);
}

/** Déplace la tête de lecture ; met en pause sur l'image demandée. */
export function seek(seconds: number) {
  const scene = useEditor.getState().scene;
  if (!scene.frames?.length) return;
  cancelAnimationFrame(raf);
  time = Math.min(totalDuration(scene), Math.max(0, seconds));
  if (usePlayback.getState().mode === "idle") useEditor.getState().select([]);
  usePlayback.setState({ mode: "paused", time });
  draw();
}

/** Poses de l'étape affichée, pour remettre le canevas en état après la lecture. */
export function restingPoses() {
  const { scene, currentStep } = useEditor.getState();
  return resolveStep(scene, currentStep);
}

// Toute modification de la scène pendant la lecture (annulation, raccourci) l'interrompt.
useEditor.subscribe((state, previous) => {
  if (state.scene !== previous.scene && usePlayback.getState().mode !== "idle") stop();
});
