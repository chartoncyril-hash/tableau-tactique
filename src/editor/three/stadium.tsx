"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Stade autour du terrain, dessiné sans aucun fichier : panneaux publicitaires, tribunes avec
 * public, toits, pylônes d'éclairage et ciel. Le logo de l'espace (club ou personnel) s'affiche
 * sur les panneaux et en haut des tribunes. Repère local : longueur sur x, largeur sur z,
 * centre du terrain à l'origine.
 */

/** Tirage pseudo-aléatoire reproductible : le public ne change pas de place à chaque rendu. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Logo chargé depuis son adresse signée ; absent tant qu'il n'est pas prêt (ou en cas d'échec). */
export function useLogoImage(url: string | null | undefined) {
  const [image, setImage] = useState<{
    url: string;
    img: HTMLImageElement;
  } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => alive && setImage({ url, img });
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return url && image?.url === url ? image.img : null;
}

function drawContain(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Bandeau lumineux d'un panneau publicitaire : logo puis nom, sur fond sombre, répété le long du panneau. */
function boardTexture(logo: HTMLImageElement | null, name: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 112;
  const g = canvas.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#1e293b");
  g.fillStyle = bg;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = accent;
  g.fillRect(0, canvas.height - 10, canvas.width, 10);
  let x = 24;
  if (logo) {
    drawContain(g, logo, x, 8, 92, 92);
    x += 112;
  }
  g.fillStyle = "#ffffff";
  g.font = "700 54px system-ui, sans-serif";
  g.textBaseline = "middle";
  g.fillText(name.toUpperCase(), x, canvas.height / 2 - 2, canvas.width - x - 24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** Grand bandeau en haut d'une tribune : logo au centre, nom de part et d'autre. */
function bannerTexture(logo: HTMLImageElement | null, name: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 192;
  const g = canvas.getContext("2d")!;
  g.fillStyle = accent;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(0, canvas.height - 16, canvas.width, 16);
  const ink = contrast(accent);
  g.fillStyle = ink;
  g.font = "800 92px system-ui, sans-serif";
  g.textBaseline = "middle";
  g.textAlign = "center";
  const label = name.toUpperCase();
  if (logo) {
    drawContain(g, logo, canvas.width / 2 - 88, 12, 176, 168);
    g.fillText(label, canvas.width / 4 - 20, canvas.height / 2, canvas.width / 2 - 260);
    g.fillText(label, (canvas.width * 3) / 4 + 20, canvas.height / 2, canvas.width / 2 - 260);
  } else {
    g.fillText(label, canvas.width / 2, canvas.height / 2, canvas.width - 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function contrast(hex: string) {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.6 ? "#111827" : "#ffffff";
}

const CROWD_COLORS = [
  "#f8fafc",
  "#1f2937",
  "#334155",
  "#ef4444",
  "#2563eb",
  "#facc15",
  "#16a34a",
  "#f97316",
  "#a855f7",
  "#0f172a",
];

export interface StadiumLayout {
  /** Distance des panneaux aux lignes de touche et de but. */
  boardSide: number;
  boardEnd: number;
  /** Rangées de gradins (0 : pas de tribune). */
  rows: number;
  endRows: number;
  roofs: boolean;
}

/** Taille du stade selon le terrain : grande enceinte à 11, petites tribunes à 8, main courante à 5. */
export function stadiumLayout(length: number): StadiumLayout {
  if (length >= 90) return { boardSide: 4, boardEnd: 5, rows: 16, endRows: 10, roofs: true };
  if (length >= 55) return { boardSide: 3, boardEnd: 3.5, rows: 7, endRows: 0, roofs: false };
  return { boardSide: 2.2, boardEnd: 2.5, rows: 4, endRows: 0, roofs: false };
}

const ROW_DEPTH = 0.8;
const ROW_RISE = 0.45;
const FRONT_WALL = 1.2;

interface StandProps {
  span: number;
  rows: number;
  seat: string;
  seed: number;
  banner: THREE.Texture;
  roof: boolean;
}

/**
 * Une tribune, dans son repère : front côté terrain en z = 0, gradins vers +z. Gradins fusionnés
 * en une seule géométrie, public en une seule instance multiple.
 */
function Stand({ span, rows, seat, seed, banner, roof }: StandProps) {
  const roofRef = useRef<THREE.Group>(null);
  const standRef = useRef<THREE.Group>(null);
  const depth = rows * ROW_DEPTH;
  const top = FRONT_WALL + rows * ROW_RISE;

  const steps = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < rows; i++) {
      const h = FRONT_WALL + (i + 1) * ROW_RISE;
      const box = new THREE.BoxGeometry(span, h, ROW_DEPTH);
      box.translate(0, h / 2, i * ROW_DEPTH + ROW_DEPTH / 2);
      parts.push(box);
    }
    const merged = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    return merged;
  }, [span, rows]);

  const seats = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < rows; i++) {
      const h = FRONT_WALL + (i + 1) * ROW_RISE;
      const box = new THREE.BoxGeometry(span - 0.4, 0.18, 0.32);
      box.translate(0, h + 0.09, i * ROW_DEPTH + ROW_DEPTH * 0.62);
      parts.push(box);
    }
    const merged = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    return merged;
  }, [span, rows]);

  // Le public : environ deux places sur trois occupées.
  const crowd = useMemo(() => {
    const rand = random(seed);
    const spots: {
      x: number;
      y: number;
      z: number;
      color: THREE.Color;
      s: number;
    }[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < rows; i++) {
      const h = FRONT_WALL + (i + 1) * ROW_RISE;
      for (let x = -span / 2 + 0.6; x < span / 2 - 0.6; x += 0.55) {
        if (rand() > 0.68) continue;
        const tone = rand() < 0.35 ? seat : CROWD_COLORS[Math.floor(rand() * CROWD_COLORS.length)];
        spots.push({
          x: x + (rand() - 0.5) * 0.18,
          y: h,
          z: i * ROW_DEPTH + ROW_DEPTH * 0.5,
          color: color.set(tone).clone(),
          s: 0.85 + rand() * 0.3,
        });
      }
    }
    return spots;
  }, [span, rows, seat, seed]);

  const people = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = people.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    crowd.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y + 0.45 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, p.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [crowd]);

  useEffect(
    () => () => {
      steps.dispose();
      seats.dispose();
    },
    [steps, seats],
  );

  // Caméra derrière la tribune (vue de télévision, depuis l'autre côté) : la tribune se retire,
  // sinon son dos masquerait le bord du terrain ; un peu en avant, seul le toit se retire.
  const local = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const g = standRef.current;
    if (!g?.parent) return;
    local.copy(camera.position);
    g.parent.worldToLocal(local);
    g.visible = local.z < depth + 0.5;
    if (roofRef.current) roofRef.current.visible = local.z < depth * 0.4;
  });

  const bannerW = Math.min(span * 0.6, 48);
  const bays = Math.max(2, Math.round(span / 18));
  const columns = Array.from({ length: bays + 1 }, (_, i) => -span / 2 + (span * i) / bays);
  return (
    <group ref={standRef}>
      <mesh geometry={steps} castShadow receiveShadow>
        <meshStandardMaterial color="#9aa1aa" roughness={0.95} />
      </mesh>
      <mesh geometry={seats}>
        <meshStandardMaterial color={seat} roughness={0.7} />
      </mesh>
      <instancedMesh ref={people} args={[undefined, undefined, crowd.length]} key={crowd.length}>
        {/* Silhouette très simple : des milliers de spectateurs restent légers à dessiner. */}
        <boxGeometry args={[0.38, 0.9, 0.3]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      {/* Mur du fond, avec le bandeau du club tourné vers le terrain. */}
      <mesh position={[0, (top + 3.2) / 2, depth + 0.2]} castShadow receiveShadow>
        <boxGeometry args={[span, top + 3.2, 0.4]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>
      <mesh position={[0, top + 1.55, depth - 0.01]} rotation-y={Math.PI}>
        <planeGeometry args={[bannerW, bannerW * (192 / 2048)]} />
        <meshBasicMaterial map={banner} toneMapped={false} />
      </mesh>
      {roof && (
        <group ref={roofRef}>
          <mesh position={[0, top + 5.4, depth * 0.55]} rotation-x={-0.08} castShadow>
            <boxGeometry args={[span + 2, 0.3, depth * 1.05]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.5} metalness={0.3} />
          </mesh>
          {columns.map((x) => (
            <mesh key={x} position={[x, (top + 5.6) / 2, depth + 0.2]} castShadow>
              <cylinderGeometry args={[0.22, 0.28, top + 5.6, 10]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** Panneau publicitaire : face lumineuse vers le terrain, caisson sombre derrière. */
function Board({ length, texture }: { length: number; texture: THREE.Texture }) {
  const map = useMemo(() => {
    const t = texture.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(length / 9)), 1);
    return t;
  }, [texture, length]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <group>
      <mesh position={[0, 0.45, 0.06]} castShadow>
        <boxGeometry args={[length, 0.9, 0.12]} />
        <meshStandardMaterial color="#111827" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.47, -0.005]} rotation-y={Math.PI}>
        <planeGeometry args={[length, 0.82]} />
        <meshBasicMaterial map={map} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Floodlight({ height }: { height: number }) {
  return (
    <group>
      <mesh position-y={height / 2} castShadow>
        <cylinderGeometry args={[0.3, 0.55, height, 12]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.5} />
      </mesh>
      <group position-y={height} rotation-x={-0.55}>
        <mesh>
          <boxGeometry args={[5, 3, 0.5]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
        <mesh position-z={-0.26} rotation-y={Math.PI}>
          <planeGeometry args={[4.6, 2.6]} />
          <meshBasicMaterial color="#fffbe6" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Ciel en dégradé, sur une grande sphère vue de l'intérieur. */
export function Sky() {
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(900, 32, 16);
    const top = new THREE.Color("#2f6fb3");
    const horizon = new THREE.Color("#bcdcf2");
    const colors: number[] = [];
    const pos = g.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 900);
      c.copy(horizon).lerp(top, Math.pow(t, 0.45));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

export interface StadiumProps {
  length: number;
  width: number;
  name: string;
  logo: HTMLImageElement | null;
  /** Couleur des sièges et des bandeaux (équipe qui reçoit). */
  accent: string;
}

export function Stadium({ length: L, width: W, name, logo, accent }: StadiumProps) {
  const layout = stadiumLayout(L);
  const board = useMemo(() => boardTexture(logo, name, accent), [logo, name, accent]);
  const banner = useMemo(() => bannerTexture(logo, name, accent), [logo, name, accent]);
  useEffect(() => () => board.dispose(), [board]);
  useEffect(() => () => banner.dispose(), [banner]);
  const seat = useMemo(() => "#" + new THREE.Color(accent).multiplyScalar(0.75).getHexString(), [accent]);

  const sideZ = W / 2 + layout.boardSide;
  const endX = L / 2 + layout.boardEnd;
  const standGap = 2.6;
  const sideStand = sideZ + standGap;
  const endStand = endX + standGap;
  const lightH = Math.max(14, Math.round(L * 0.3));
  const sideDepth = layout.rows * ROW_DEPTH;
  const endDepth = layout.endRows * ROW_DEPTH;

  return (
    <group>
      {/* Parvis bétonné entre la pelouse et les tribunes. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
        <planeGeometry args={[(endStand + endDepth + 30) * 2, (sideStand + sideDepth + 30) * 2]} />
        <meshStandardMaterial color="#7d848c" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.025} receiveShadow>
        <planeGeometry args={[endX * 2 + 2.4, sideZ * 2 + 2.4]} />
        <meshStandardMaterial color="#3f7a3f" roughness={1} />
      </mesh>

      <Dugouts width={W} boardSide={layout.boardSide} />
      <group position={[0, 0, sideZ]}>
        <Board length={L + 6} texture={board} />
      </group>
      <group position={[0, 0, -sideZ]} rotation-y={Math.PI}>
        <Board length={L + 6} texture={board} />
      </group>
      <group position={[endX, 0, 0]} rotation-y={Math.PI / 2}>
        <Board length={W + layout.boardSide * 2} texture={board} />
      </group>
      <group position={[-endX, 0, 0]} rotation-y={-Math.PI / 2}>
        <Board length={W + layout.boardSide * 2} texture={board} />
      </group>

      {layout.rows > 0 && (
        <>
          <group position={[0, 0, sideStand]}>
            <Stand span={L + 8} rows={layout.rows} seat={seat} seed={11} banner={banner} roof={layout.roofs} />
          </group>
          <group position={[0, 0, -sideStand]} rotation-y={Math.PI}>
            <Stand span={L + 8} rows={layout.rows} seat={seat} seed={23} banner={banner} roof={layout.roofs} />
          </group>
        </>
      )}
      {layout.endRows > 0 && (
        <>
          <group position={[endStand, 0, 0]} rotation-y={Math.PI / 2}>
            <Stand span={W + 4} rows={layout.endRows} seat={seat} seed={37} banner={banner} roof={false} />
          </group>
          <group position={[-endStand, 0, 0]} rotation-y={-Math.PI / 2}>
            <Stand span={W + 4} rows={layout.endRows} seat={seat} seed={41} banner={banner} roof={false} />
          </group>
        </>
      )}

      {[
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ].map(([sx, sz]) => (
        <group
          key={`${sx}${sz}`}
          position={[sx * (endStand + endDepth * 0.5 + 3), 0, sz * (sideStand + sideDepth * 0.4 + 3)]}
          rotation-y={Math.atan2(sx, sz)}
        >
          <Floodlight height={lightH} />
        </group>
      ))}
    </group>
  );
}

function netTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 3;
  g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Hauteur des buts selon leur largeur : 2,44 m à 11, 2,10 m à 8, 1,50 m à 5. */
const goalHeight = (width: number) => (width > 7 ? 2.44 : width >= 6 ? 2.1 : 1.5);

/**
 * Buts du terrain en relief (montants, barre, filet), d'après le tracé du terrain. Repère local :
 * longueur sur x, centre du terrain à l'origine.
 */
export function PitchGoals({
  goals,
  length,
  width,
}: {
  goals: { x: number; y: number; w: number; h: number }[];
  length: number;
  width: number;
}) {
  const net = useMemo(() => {
    const map = netTexture();
    map.repeat.set(14, 6);
    return new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);
  useEffect(
    () => () => {
      net.map?.dispose();
      net.dispose();
    },
    [net],
  );
  return (
    <>
      {goals.map((goal, i) => {
        const left = goal.x < length / 2;
        const lineX = (left ? 0 : length) - length / 2;
        const depth = goal.w;
        const span = goal.h;
        const z = goal.y + span / 2 - width / 2;
        const h = goalHeight(span);
        const dir = left ? -1 : 1;
        const r = span > 7 ? 0.06 : 0.05;
        const mat = <meshStandardMaterial color="#ffffff" roughness={0.35} />;
        return (
          <group key={i} position={[lineX, 0, z]}>
            {[-span / 2, span / 2].map((pz) => (
              <mesh key={pz} position={[0, h / 2, pz]} castShadow>
                <cylinderGeometry args={[r, r, h, 12]} />
                {mat}
              </mesh>
            ))}
            <mesh position={[0, h, 0]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[r, r, span + r * 2, 12]} />
              {mat}
            </mesh>
            {/* Filet : toit incliné, fond et côtés. */}
            <mesh position={[(dir * depth) / 2, h * 0.85, 0]} rotation={[0, 0, -dir * Math.atan2(h * 0.3, depth)]}>
              <boxGeometry args={[Math.hypot(depth, h * 0.3), 0.01, span]} />
              <primitive object={net} attach="material" />
            </mesh>
            <mesh position={[dir * depth, (h * 0.7) / 2, 0]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[span, h * 0.7]} />
              <primitive object={net} attach="material" />
            </mesh>
            {[-span / 2, span / 2].map((pz) => (
              <mesh key={`s${pz}`} position={[(dir * depth) / 2, h / 2, pz]}>
                <planeGeometry args={[depth, h]} />
                <primitive object={net} attach="material" />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

/** Drapeaux de coin : mât de 1,5 m et fanion, aux quatre coins du terrain (repère local). */
export function CornerFlags({ length, width, color = "#facc15" }: { length: number; width: number; color?: string }) {
  const pennant = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.45, -0.15);
    shape.lineTo(0, -0.32);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  useEffect(() => () => pennant.dispose(), [pennant]);
  return (
    <>
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <group key={`${sx}${sz}`} position={[(sx * length) / 2, 0, (sz * width) / 2]} rotation-y={Math.atan2(-sz, sx) - Math.PI / 2}>
          <mesh position-y={0.75} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 1.5, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.4} />
          </mesh>
          <mesh geometry={pennant} position-y={1.5}>
            <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Banc de touche : coque, sièges et toit transparent arrondi, ouvert vers le terrain (vers -z). */
function Dugout({ length }: { length: number }) {
  const seats = Math.max(4, Math.round(length / 0.6));
  return (
    <group>
      <mesh position={[0, 0.06, 0.55]} receiveShadow>
        <boxGeometry args={[length + 0.3, 0.12, 1.4]} />
        <meshStandardMaterial color="#4b5563" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.1, 1.22]} castShadow>
        <boxGeometry args={[length + 0.3, 2.2, 0.08]} />
        <meshStandardMaterial color="#1f2937" roughness={0.6} />
      </mesh>
      {Array.from({ length: seats }, (_, i) => (
        <group key={i} position={[-length / 2 + 0.3 + (i * (length - 0.6)) / Math.max(1, seats - 1), 0, 0.8]}>
          <mesh position-y={0.48}>
            <boxGeometry args={[0.46, 0.08, 0.44]} />
            <meshStandardMaterial color="#1d4ed8" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.82, 0.2]}>
            <boxGeometry args={[0.46, 0.62, 0.06]} />
            <meshStandardMaterial color="#1d4ed8" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* Toit en plexiglas : quart de cylindre de l'arrière vers l'avant. */}
      <mesh position={[0, 0.1, 1.22]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[2.1, 2.1, length + 0.3, 24, 1, true, Math.PI, Math.PI / 2]} />
        <meshStandardMaterial color="#cfe8ff" transparent opacity={0.28} side={THREE.DoubleSide} roughness={0.1} metalness={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Deux bancs de touche de part et d'autre de la ligne médiane, du côté opposé à la caméra de tribune. */
export function Dugouts({ width, boardSide }: { width: number; boardSide: number }) {
  const z = -(width / 2 + Math.max(1.6, boardSide - 1.9));
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 8, 0, z]} rotation-y={Math.PI}>
          <Dugout length={5.5} />
        </group>
      ))}
    </>
  );
}
