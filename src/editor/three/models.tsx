"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { EQUIPMENT_SIZE, equipmentPrims } from "../scene/catalog";
import type { BallStyle, EquipmentObject, PlayerObject, Team } from "../scene/types";
import { kitTexture, labelTexture, primsTexture } from "./textures";

/**
 * Modèles 3D, en mètres, posés sur le sol (y = 0) et orientés dans le repère local de l'objet
 * (x et z = axes x et y du dessin 2D). Volontairement simples et un peu plus gros que nature,
 * pour rester lisibles de loin. Dessins originaux.
 */

const WHITE = "#f8fafc";
/** Agrandissement des joueurs et du petit matériel, comme les jetons du tableau 2D. */
export const PLAYER_SCALE = 1.8;
const PROP_SCALE = 1.6;
const STEEL = "#9ca3af";

export const BALL_RADIUS = 0.34;
const BALL_COLORS: Record<BallStyle, string> = {
  classic: WHITE,
  blue: "#2563eb",
  red: "#dc2626",
  yellow: "#facc15",
  futsal: "#fde047",
  rugby: "#92400e",
  volley: "#f1f5f9",
  tennis: "#d9f99d",
  medicine: "#7c2d12",
};

export function Player3D({ obj, team }: { obj: PlayerObject; team: Team | undefined }) {
  const color = team?.color ?? "#6b7280";
  const kit = useMemo(() => kitTexture(team), [team]);
  const label = useMemo(
    () => labelTexture({ number: obj.number, name: obj.name, color, captain: obj.captain }),
    [obj.number, obj.name, color, obj.captain],
  );
  useEffect(() => () => kit.dispose(), [kit]);
  useEffect(() => () => label.dispose(), [label]);
  return (
    <group scale={PLAYER_SCALE}>
      {obj.goalkeeper && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.03}>
          <ringGeometry args={[0.85, 1.02, 40]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      )}
      <mesh position-y={0.04} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.76, 0.08, 32]} />
        <meshStandardMaterial color={WHITE} roughness={0.6} />
      </mesh>
      <mesh position-y={0.74} castShadow>
        <cylinderGeometry args={[0.42, 0.56, 1.32, 32]} />
        <meshStandardMaterial map={kit} roughness={0.7} />
      </mesh>
      <mesh position-y={1.42} scale={[1, 0.55, 1]} castShadow>
        <sphereGeometry args={[0.43, 24, 16]} />
        <meshStandardMaterial map={kit} roughness={0.7} />
      </mesh>
      <mesh position-y={1.82} castShadow>
        <sphereGeometry args={[0.27, 24, 16]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
      </mesh>
      <sprite position-y={2.85} scale={[2.3, 1.72, 1]} renderOrder={2}>
        <spriteMaterial map={label} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}

export function Ball3D({ style = "classic" }: { style?: BallStyle }) {
  const r = style === "medicine" ? BALL_RADIUS * 1.3 : style === "tennis" ? BALL_RADIUS * 0.6 : BALL_RADIUS;
  return (
    <mesh position-y={r} scale={style === "rugby" ? [1.45, 1, 1] : 1} castShadow>
      <sphereGeometry args={[r, 24, 16]} />
      <meshStandardMaterial color={BALL_COLORS[style]} roughness={0.45} />
    </mesh>
  );
}

function Mat({ color, opacity }: { color: string; opacity?: number }) {
  return opacity === undefined ? (
    <meshStandardMaterial color={color} roughness={0.6} />
  ) : (
    <meshStandardMaterial color={color} roughness={0.6} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
  );
}

/** Barre cylindrique entre deux points. */
function Bar({ from, to, r, color }: { from: [number, number, number]; to: [number, number, number]; r: number; color: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { position: a.add(b).multiplyScalar(0.5), quaternion: q, length: dir.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[r, r, length, 12]} />
      <Mat color={color} />
    </mesh>
  );
}

function Mannequin({ color, x = 0 }: { color: string; x?: number }) {
  return (
    <group position-x={x}>
      <mesh position-y={0.05}>
        <cylinderGeometry args={[0.32, 0.36, 0.1, 20]} />
        <Mat color="#374151" />
      </mesh>
      <mesh position-y={0.9} castShadow>
        <cylinderGeometry args={[0.26, 0.2, 1.6, 20]} />
        <Mat color={color} />
      </mesh>
      <mesh position-y={1.9} castShadow>
        <sphereGeometry args={[0.2, 20, 14]} />
        <Mat color={color} />
      </mesh>
    </group>
  );
}

/** But : poteaux et barre côté ouverture (x > 0), filet tendu vers l'arrière, comme le dessin 2D. */
function Goal({ width, depth, height, color }: { width: number; depth: number; height: number; color: string }) {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.max(0.04, height * 0.025);
  const net = useMemo(() => {
    // Filet : arrière, toit incliné et deux côtés, en une seule géométrie.
    const back = height * 0.6;
    const v = [
      [hd, height, -hw], [hd, height, hw], [-hd, back, hw], [-hd, back, -hw], // toit
      [-hd, back, -hw], [-hd, back, hw], [-hd, 0, hw], [-hd, 0, -hw], // arrière
      [hd, height, -hw], [-hd, back, -hw], [-hd, 0, -hw], [hd, 0, -hw], // côté
      [hd, height, hw], [-hd, back, hw], [-hd, 0, hw], [hd, 0, hw], // côté
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(v.flat(), 3));
    const index: number[] = [];
    for (let q = 0; q < 4; q++) index.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3);
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }, [hw, hd, height]);
  useEffect(() => () => net.dispose(), [net]);
  return (
    <>
      <Bar from={[hd, 0, -hw]} to={[hd, height, -hw]} r={r} color={color} />
      <Bar from={[hd, 0, hw]} to={[hd, height, hw]} r={r} color={color} />
      <Bar from={[hd, height, -hw]} to={[hd, height, hw]} r={r} color={color} />
      <Bar from={[-hd, 0, -hw]} to={[-hd, 0, hw]} r={r * 0.7} color={STEEL} />
      <Bar from={[-hd, 0, -hw]} to={[hd, 0, -hw]} r={r * 0.7} color={STEEL} />
      <Bar from={[-hd, 0, hw]} to={[hd, 0, hw]} r={r * 0.7} color={STEEL} />
      <mesh geometry={net}>
        <meshBasicMaterial color={WHITE} wireframe transparent opacity={0.55} />
      </mesh>
      <mesh geometry={net}>
        <Mat color={WHITE} opacity={0.12} />
      </mesh>
    </>
  );
}

/** Objet de la banque sans relief notable, posé à plat avec son dessin 2D. */
function FlatEquipment({ obj }: { obj: EquipmentObject }) {
  const size = EQUIPMENT_SIZE[obj.kind];
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    let made: THREE.Texture | null = null;
    void primsTexture(equipmentPrims(obj.kind, obj.color), size.w, size.h).then((t) => {
      made = t;
      if (alive) setTexture(t);
      else t.dispose();
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [obj.kind, obj.color, size.w, size.h]);
  if (!texture) return null;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.025} receiveShadow>
      <planeGeometry args={[size.w, size.h]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={0.8} />
    </mesh>
  );
}

/** Les buts gardent leurs dimensions réelles ; le petit matériel est agrandi pour rester visible. */
export function Equipment3D({ obj }: { obj: EquipmentObject }) {
  const real = obj.kind === "goal" || obj.kind === "goal5" || obj.kind === "minigoal" || !SOLID.has(obj.kind);
  return (
    <group scale={real ? 1 : PROP_SCALE}>
      <EquipmentModel obj={obj} />
    </group>
  );
}

const SOLID = new Set(["cone", "pole", "flag", "hurdle", "mannequin", "wall", "rebounder", "bench", "box", "bosu", "goal", "goal5", "minigoal"]);

function EquipmentModel({ obj }: { obj: EquipmentObject }) {
  const c = obj.color;
  switch (obj.kind) {
    case "cone":
      return (
        <>
          <mesh position-y={0.03} castShadow>
            <boxGeometry args={[0.95, 0.06, 0.95]} />
            <Mat color={c} />
          </mesh>
          <mesh position-y={0.5} castShadow>
            <coneGeometry args={[0.36, 0.9, 24]} />
            <Mat color={c} />
          </mesh>
          <mesh position-y={0.52}>
            <cylinderGeometry args={[0.2, 0.25, 0.14, 24, 1, true]} />
            <Mat color={WHITE} />
          </mesh>
        </>
      );
    case "pole":
      return (
        <>
          <mesh position-y={0.04}>
            <cylinderGeometry args={[0.28, 0.3, 0.08, 20]} />
            <Mat color="#374151" />
          </mesh>
          <Bar from={[0, 0, 0]} to={[0, 1.7, 0]} r={0.045} color={c} />
        </>
      );
    case "flag":
      return (
        <>
          <Bar from={[0, 0, 0]} to={[0, 1.6, 0]} r={0.03} color="#e5e7eb" />
          <mesh position={[0.32, 1.38, 0]}>
            <planeGeometry args={[0.6, 0.42]} />
            <Mat color={c} opacity={0.95} />
          </mesh>
        </>
      );
    case "hurdle":
      return (
        <>
          <Bar from={[-1.1, 0, 0]} to={[-1.1, 0.55, 0]} r={0.05} color={c} />
          <Bar from={[1.1, 0, 0]} to={[1.1, 0.55, 0]} r={0.05} color={c} />
          <Bar from={[-1.1, 0.55, 0]} to={[1.1, 0.55, 0]} r={0.05} color={c} />
          <Bar from={[-1.1, 0.03, -0.35]} to={[-1.1, 0.03, 0.35]} r={0.04} color={c} />
          <Bar from={[1.1, 0.03, -0.35]} to={[1.1, 0.03, 0.35]} r={0.04} color={c} />
        </>
      );
    case "mannequin":
      return <Mannequin color={c} />;
    case "wall":
      return (
        <>
          <Mannequin color={c} x={-1.2} />
          <Mannequin color={c} />
          <Mannequin color={c} x={1.2} />
        </>
      );
    case "minigoal":
      return <Goal width={2.4} depth={1.2} height={1.1} color={c} />;
    case "goal5":
      return <Goal width={5} depth={1.6} height={2} color={c} />;
    case "goal":
      return <Goal width={7.32} depth={2} height={2.44} color={c} />;
    case "rebounder":
      return (
        <>
          <group position={[0, 0.65, -0.15]} rotation-x={-0.35}>
            <mesh>
              <planeGeometry args={[2, 1.2]} />
              <Mat color={c} opacity={0.35} />
            </mesh>
            <mesh>
              <planeGeometry args={[2, 1.2, 8, 5]} />
              <meshBasicMaterial color={c} wireframe />
            </mesh>
          </group>
          <Bar from={[-1, 0, 0.1]} to={[-1, 0.9, -0.2]} r={0.04} color={STEEL} />
          <Bar from={[1, 0, 0.1]} to={[1, 0.9, -0.2]} r={0.04} color={STEEL} />
        </>
      );
    case "bench":
      return (
        <>
          <mesh position-y={0.45} castShadow>
            <boxGeometry args={[4, 0.08, 0.5]} />
            <Mat color={c} />
          </mesh>
          {[-1.7, 1.7].map((x) => (
            <mesh key={x} position={[x, 0.22, 0]} castShadow>
              <boxGeometry args={[0.08, 0.44, 0.42]} />
              <Mat color={STEEL} />
            </mesh>
          ))}
        </>
      );
    case "box":
      return (
        <mesh position-y={0.3} castShadow>
          <boxGeometry args={[1.2, 0.6, 1.2]} />
          <Mat color={c} />
        </mesh>
      );
    case "bosu":
      return (
        <mesh scale={[1, 0.4, 1]} castShadow>
          <sphereGeometry args={[0.85, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color={c} />
        </mesh>
      );
    default:
      return <FlatEquipment obj={obj} />;
  }
}
