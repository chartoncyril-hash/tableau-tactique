"use client";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { playbackTarget, restingPoses, usePlayback } from "../animation/playback";
import { viewRect, worldRect } from "../pitches";
import type { Pose } from "../scene/animation";
import type { PlayerObject, Scene, SceneObject } from "../scene/types";
import { displayObjects, useEditor } from "../store";
import { cameraPose, isGroundDrawing, sceneOrigin, toWorld, yaw } from "./layout";
import { Ball3D, Equipment3D, Figure3D, Player3D, strides } from "./models";
import { analysisTexture, groundRect, groundTexture } from "./textures";
import { useView3d } from "./view-mode";

const FOV = 40;

/** Caméra orbitale courante : coupée pendant qu'on fait glisser un objet. */
let orbit: OrbitControls | null = null;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const setCursor = (cursor: string) => {
  document.body.style.cursor = cursor;
};

function Ground({ scene, origin }: { scene: Scene; origin: { x: number; y: number } }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  // La pelouse ne dépend que du terrain et des dessins au sol.
  const drawings = useMemo(() => scene.objects.filter(isGroundDrawing), [scene.objects]);
  const key = JSON.stringify([scene.pitch, drawings]);
  useEffect(() => {
    let alive = true;
    let made: THREE.Texture | null = null;
    const max = Math.min(gl.capabilities.maxTextureSize, 4096);
    void groundTexture({ ...scene, objects: drawings }, max).then((t) => {
      made = t;
      if (!alive) return t.dispose();
      setTexture(t);
      invalidate();
      useView3d.setState({ ready: true });
    });
    return () => {
      alive = false;
      made?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const rect = groundRect(scene);
  const [cx, , cz] = toWorld(rect.x + rect.w / 2, rect.y + rect.h / 2, origin);
  return (
    <>
      {/* Pelouse alentour, au-delà du terrain dessiné. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial color={new THREE.Color(scene.pitch.grass).multiplyScalar(0.82)} roughness={1} />
      </mesh>
      {texture && (
        <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} receiveShadow>
          <planeGeometry args={[rect.w, rect.h]} />
          <meshStandardMaterial map={texture} roughness={0.95} />
        </mesh>
      )}
    </>
  );
}

/** Zones d'influence et lignes du bloc, sur la pelouse, quand elles sont activées dans le panneau. */
function AnalysisLayer({ scene, step, origin }: { scene: Scene; step: number; origin: { x: number; y: number } }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const overlays = useEditor((s) => s.overlays);
  const [shown, setShown] = useState<{ key: string; texture: THREE.Texture | null } | null>(null);
  const players = useMemo(
    () => displayObjects(scene, step).filter((o): o is PlayerObject => o.type === "player"),
    [scene, step],
  );
  const active = overlays.voronoi || overlays.blockLines;
  const key = active ? JSON.stringify([overlays, scene.teams, scene.pitch, players.map((p) => [p.id, p.x, p.y, p.teamId, p.goalkeeper])]) : "";
  useEffect(() => {
    invalidate();
    if (!key) return;
    let alive = true;
    let made: THREE.Texture | null = null;
    // Pendant un glisser, on attend un court instant de calme avant de redessiner.
    const timer = setTimeout(() => {
      void analysisTexture(scene, players, overlays, Math.min(gl.capabilities.maxTextureSize, 2048)).then((t) => {
        made = t;
        if (!alive) return t?.dispose();
        setShown({ key, texture: t });
        invalidate();
      });
    }, 60);
    return () => {
      alive = false;
      clearTimeout(timer);
      made?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Pendant le recalcul, l'ancienne image reste affichée ; désactivée, elle disparaît aussitôt.
  const texture = key ? shown?.texture : null;
  if (!texture) return null;
  const rect = groundRect(scene);
  const [cx, , cz] = toWorld(rect.x + rect.w / 2, rect.y + rect.h / 2, origin);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[cx, 0.015, cz]} renderOrder={1}>
      <planeGeometry args={[rect.w, rect.h]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function ObjectModel({ obj, scene, people }: { obj: SceneObject; scene: Scene; people: boolean }) {
  switch (obj.type) {
    case "player": {
      const team = scene.teams.find((t) => t.id === obj.teamId);
      return people ? <Figure3D obj={obj} team={team} /> : <Player3D obj={obj} team={team} />;
    }
    case "ball":
      return <Ball3D style={obj.style} />;
    case "equipment":
      return <Equipment3D obj={obj} />;
    default:
      return null;
  }
}

/** Taille de la zone de prise d'un objet (avant son échelle propre). */
function grabSize(obj: SceneObject) {
  if (obj.type === "player") return { r: 1.3, h: 3.4 };
  if (obj.type === "ball") return { r: 0.9, h: 1 };
  return { r: 1.1, h: 1.6 };
}

/** Objets en relief ; leurs positions suivent l'étape affichée, ou la lecture image par image. */
function Objects({ scene, step, origin }: { scene: Scene; step: number; origin: { x: number; y: number } }) {
  const invalidate = useThree((s) => s.invalidate);
  const refs = useRef(new Map<string, THREE.Group>());
  const people = useView3d((s) => s.figures === "people");
  const readOnly = useEditor((s) => s.readOnly);
  const playing = usePlayback((s) => s.mode !== "idle");
  const drag = useRef<{ id: string; dx: number; dz: number } | null>(null);
  const field = worldRect(scene.pitch);
  const canMove = (obj: SceneObject) => !readOnly && !playing && !obj.locked;

  // Glisser un objet sur la pelouse : même historique (annuler / rétablir) que le glisser en 2D.
  const hit = (e: ThreeEvent<PointerEvent>) => e.ray.intersectPlane(GROUND, new THREE.Vector3());
  const onDown = (obj: SceneObject) => (e: ThreeEvent<PointerEvent>) => {
    if (!canMove(obj) || e.button !== 0) return;
    const point = hit(e);
    if (!point) return;
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    const [x, , z] = toWorld(obj.x, obj.y, origin);
    drag.current = { id: obj.id, dx: x - point.x, dz: z - point.z };
    if (orbit) orbit.enabled = false;
    setCursor("grabbing");
    useEditor.getState().select([obj.id]);
    useEditor.getState().beginLive();
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d) return;
    const point = hit(e);
    if (!point) return;
    e.stopPropagation();
    // Reste sur le terrain (avec une petite marge).
    const x = Math.min(field.x + field.w + 3, Math.max(field.x - 3, point.x + d.dx + origin.x));
    const y = Math.min(field.y + field.h + 3, Math.max(field.y - 3, point.z + d.dz + origin.y));
    useEditor.getState().live((draft) => {
      const target = draft.objects.find((o) => o.id === d.id);
      if (target) {
        target.x = Math.round(x * 10) / 10;
        target.y = Math.round(y * 10) / 10;
      }
    });
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    drag.current = null;
    if (orbit) orbit.enabled = true;
    setCursor("");
    useEditor.getState().endLive("move");
  };
  const objects = displayObjects(scene, step).filter((o) => !isGroundDrawing(o));

  useEffect(() => {
    useView3d.setState({ objects: objects.length });
  }, [objects.length]);

  useEffect(() => {
    // Foulée des personnages : la phase avance avec la distance parcourue, l'amplitude suit la vitesse.
    const gait = new Map<string, { x: number; y: number; t: number; phase: number; amount: number }>();
    const place = (poses: Map<string, Pose>, playing: boolean) => {
      const now = performance.now();
      for (const [id, group] of refs.current) {
        const pose = poses.get(id);
        if (!pose) continue;
        const [x, , z] = toWorld(pose.x, pose.y, origin);
        group.position.set(x, pose.lift, z);
        group.rotation.y = yaw(pose.rotation);
        const stride = strides.get(id);
        if (!stride) continue;
        const g = gait.get(id);
        if (!playing || !g) {
          gait.set(id, { x: pose.x, y: pose.y, t: now, phase: 0, amount: 0 });
          stride(0, 0);
          continue;
        }
        const d = Math.hypot(pose.x - g.x, pose.y - g.y);
        const dt = Math.max(1, now - g.t) / 1000;
        const target = Math.min(1, d / dt / 5);
        g.amount += (target - g.amount) * 0.25;
        g.phase += d * 1.9;
        g.x = pose.x;
        g.y = pose.y;
        g.t = now;
        stride(g.phase, g.amount);
      }
      invalidate();
    };
    return playbackTarget.listen((poses) => place(poses ?? restingPoses(), poses !== null));
  }, [origin, invalidate]);

  return (
    <>
      {objects.map((obj) => {
        const [x, , z] = toWorld(obj.x, obj.y, origin);
        const scale = obj.type === "equipment" ? obj.scale : 1;
        return (
          <group
            key={obj.id}
            ref={(g) => {
              if (g) refs.current.set(obj.id, g);
              else refs.current.delete(obj.id);
            }}
            position={[x, 0, z]}
            rotation-y={yaw(obj.rotation)}
            scale={scale}
            onPointerDown={onDown(obj)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerOver={() => {
              if (canMove(obj) && !drag.current) setCursor("grab");
            }}
            onPointerOut={() => {
              if (!drag.current) setCursor("");
            }}
          >
            {/* Zone de prise invisible, plus large que le modèle : facile à attraper même de loin. */}
            {canMove(obj) && (
              <mesh position-y={grabSize(obj).h / 2}>
                <cylinderGeometry args={[grabSize(obj).r, grabSize(obj).r, grabSize(obj).h, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
            <ObjectModel obj={obj} scene={scene} people={people} />
          </group>
        );
      })}
    </>
  );
}

/** Caméra orbitale ; un changement de point de vue glisse en douceur vers la nouvelle position. */
function CameraRig({ scene }: { scene: Scene }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const preset = useView3d((s) => s.camera);
  const controls = useRef<OrbitControls | null>(null);
  const placed = useRef(false);
  const origin = sceneOrigin(scene.pitch);
  const view = viewRect(scene.pitch);
  const vertical = scene.pitch.orientation === "vertical";
  const aspect = size.width / Math.max(1, size.height);
  const goal = cameraPose(preset, { ...view, x: view.x - origin.x, y: view.y - origin.y }, vertical, FOV, aspect);
  const goalKey = goal.position.map((v) => v.toFixed(2)).join(",");

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    orbit = c;
    c.enableDamping = false;
    c.maxPolarAngle = Math.PI * 0.49;
    c.minDistance = 4;
    c.maxDistance = 260;
    const redraw = () => invalidate();
    c.addEventListener("change", redraw);
    controls.current = c;
    return () => {
      c.removeEventListener("change", redraw);
      c.dispose();
      if (orbit === c) orbit = null;
    };
  }, [camera, gl, invalidate]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const from = camera.position.clone();
    const fromTarget = c.target.clone();
    const to = new THREE.Vector3(...goal.position);
    const toTarget = new THREE.Vector3(...goal.target);
    const first = !placed.current;
    placed.current = true;
    if (first || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      camera.position.copy(to);
      c.target.copy(toTarget);
      c.update();
      invalidate();
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      camera.position.lerpVectors(from, to, e);
      c.target.lerpVectors(fromTarget, toTarget, e);
      c.update();
      invalidate();
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, goalKey]);

  return null;
}

export default function View3D() {
  const scene = useEditor((s) => s.scene);
  const step = useEditor((s) => s.currentStep);
  const origin = useMemo(() => sceneOrigin(scene.pitch), [scene.pitch]);
  const world = groundRect(scene);
  useEffect(() => () => setCursor(""), []);
  const shadowSpan = Math.max(world.w, world.h) / 2 + 4;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ fov: FOV, near: 0.5, far: 1200, position: [0, 0, 0] }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#a9cfe8"]} />
      <fog attach="fog" args={["#a9cfe8", 140, 320]} />
      <hemisphereLight args={["#ffffff", "#3d6b45", 1.1]} />
      <directionalLight
        position={[-30, 60, 25]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={shadowSpan}
        shadow-camera-bottom={-shadowSpan}
        shadow-camera-far={200}
        shadow-bias={-0.0004}
      />
      <Ground scene={scene} origin={origin} />
      <AnalysisLayer scene={scene} step={step} origin={origin} />
      <Objects scene={scene} step={step} origin={origin} />
      <CameraRig scene={scene} />
    </Canvas>
  );
}
