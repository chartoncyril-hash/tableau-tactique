"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { playbackTarget, restingPoses } from "../animation/playback";
import { viewRect } from "../pitches";
import type { Pose } from "../scene/animation";
import type { Scene, SceneObject } from "../scene/types";
import { displayObjects, useEditor } from "../store";
import { cameraPose, isGroundDrawing, sceneOrigin, toWorld, yaw } from "./layout";
import { Ball3D, Equipment3D, Figure3D, Player3D, strides } from "./models";
import { groundRect, groundTexture } from "./textures";
import { useView3d } from "./view-mode";

const FOV = 40;

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

/** Objets en relief ; leurs positions suivent l'étape affichée, ou la lecture image par image. */
function Objects({ scene, step, origin }: { scene: Scene; step: number; origin: { x: number; y: number } }) {
  const invalidate = useThree((s) => s.invalidate);
  const refs = useRef(new Map<string, THREE.Group>());
  const people = useView3d((s) => s.figures === "people");
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
          >
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
      <Objects scene={scene} step={step} origin={origin} />
      <CameraRig scene={scene} />
    </Canvas>
  );
}
