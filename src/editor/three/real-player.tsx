"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { contrastOn } from "../export/svg";
import type { PlayerObject, Team } from "../scene/types";
import { strides } from "./models";
import { labelTexture } from "./textures";

/**
 * Footballeurs réalistes : avatars « Sports_Male_02 » et « Sports_Male_03 » de la bibliothèque
 * Microsoft Rocketbox (licence MIT, voir public/models/players/LICENSE-Rocketbox.md), convertis en
 * glTF compressé, avec leurs animations (repos, course lente, course, sprint).
 *
 * La tenue est recolorée à l'affichage : un masque (R maillot, G liserés, B short, A chaussettes)
 * dit où appliquer les couleurs de l'équipe ; les plis du tissu viennent de la carte de normales.
 * Chargés à la première demande seulement.
 */

const BASE = "/models/players";
const AVATARS = ["m301", "m300"] as const;
type AvatarId = (typeof AVATARS)[number];

/** Taille réelle × 1,25 : lisibles de loin sans écraser les buts. */
export const REAL_SCALE = 1.25;

interface Avatar {
  scene: THREE.Group;
  body: THREE.Texture;
  bodyNormal: THREE.Texture;
  mask: THREE.Texture;
  head: THREE.Texture;
  headNormal: THREE.Texture;
  hair: THREE.Texture | null;
}

interface Assets {
  avatars: Record<AvatarId, Avatar>;
  clips: Record<string, THREE.AnimationClip>;
}

let loading: Promise<Assets> | null = null;

function loadTexture(url: string, color: boolean) {
  return new THREE.TextureLoader().loadAsync(url).then((t) => {
    // Les UV exportées gardent la convention de three.js (v vers le haut), comme les textures d'origine.
    t.flipY = true;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

export function loadRealPlayers(): Promise<Assets> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const entries = await Promise.all(
      AVATARS.map(async (id) => {
        const [gltf, body, bodyNormal, mask, head, headNormal, hair] = await Promise.all([
          loader.loadAsync(`${BASE}/${id}.glb`),
          loadTexture(`${BASE}/${id}_body.jpg`, true),
          loadTexture(`${BASE}/${id}_body_n.jpg`, false),
          loadTexture(`${BASE}/${id}_mask.png`, false),
          loadTexture(`${BASE}/${id}_head.jpg`, true),
          loadTexture(`${BASE}/${id}_head_n.jpg`, false),
          id === "m300" ? loadTexture(`${BASE}/${id}_hair.png`, true) : Promise.resolve(null),
        ]);
        mask.minFilter = THREE.NearestFilter;
        mask.magFilter = THREE.NearestFilter;
        mask.generateMipmaps = false;
        return [id, { gltf, avatar: { scene: gltf.scene, body, bodyNormal, mask, head, headNormal, hair } }] as const;
      }),
    );
    const clips: Record<string, THREE.AnimationClip> = {};
    for (const [, { gltf }] of entries) for (const clip of gltf.animations) clips[clip.name] = clip;
    return { avatars: Object.fromEntries(entries.map(([id, e]) => [id, e.avatar])) as Record<AvatarId, Avatar>, clips };
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Avatars prêts (null pendant le chargement, ou en cas d'échec : on garde alors les personnages simples). */
export type RealAssets = Assets;

export function useRealPlayers(enabled: boolean) {
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadRealPlayers()
      .then((a) => alive && setAssets(a))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? assets : null;
}

export interface Kit {
  shirt: string;
  accent: string;
  shorts: string;
  socks: string;
  /** 0 uni, 1 rayures, 2 cerceaux, 3 moitiés. */
  pattern: number;
}

const PATTERNS = { plain: 0, stripes: 1, hoops: 2, halves: 3 } as const;

/** Tenue d'un joueur : couleurs de l'équipe ; le gardien a un maillot à part. */
export function kitFor(team: Team | undefined, goalkeeper: boolean): Kit {
  const color = team?.color ?? "#6b7280";
  const second = team?.color2 ?? (contrastOn(color) === "#ffffff" ? "#f8fafc" : "#111827");
  if (goalkeeper) {
    // Vert, sauf si l'équipe est déjà verte : jaune.
    const { h } = new THREE.Color(color).getHSL({ h: 0, s: 0, l: 0 });
    const keeper = h > 0.2 && h < 0.45 ? "#facc15" : "#22c55e";
    return { shirt: keeper, accent: "#111827", shorts: "#111827", socks: keeper, pattern: 0 };
  }
  const pattern = PATTERNS[team?.pattern ?? "plain"] ?? 0;
  return {
    shirt: color,
    accent: second,
    shorts: pattern === 0 ? second : (team?.color2 ?? "#111827"),
    socks: color,
    pattern,
  };
}

const kitMaterials = new Map<string, THREE.MeshStandardMaterial>();

/** Matériau du corps teint aux couleurs d'une tenue ; partagé par tous les joueurs de la même équipe. */
function bodyMaterial(id: AvatarId, avatar: Avatar, kit: Kit) {
  const key = `${id}|${kit.shirt}|${kit.accent}|${kit.shorts}|${kit.socks}|${kit.pattern}`;
  const cached = kitMaterials.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    map: avatar.body,
    normalMap: avatar.bodyNormal,
    roughness: 0.78,
    metalness: 0,
  });
  const uniforms = {
    kitMask: { value: avatar.mask },
    kitShirt: { value: new THREE.Color(kit.shirt) },
    kitAccent: { value: new THREE.Color(kit.accent) },
    kitShorts: { value: new THREE.Color(kit.shorts) },
    kitSocks: { value: new THREE.Color(kit.socks) },
    kitPattern: { value: kit.pattern },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform sampler2D kitMask;
uniform vec3 kitShirt;
uniform vec3 kitAccent;
uniform vec3 kitShorts;
uniform vec3 kitSocks;
uniform int kitPattern;`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
{
  vec4 m = texture2D(kitMask, vMapUv);
  vec3 shirt = kitShirt;
  // Motifs dessinés dans l'espace de la texture : bandes verticales du torse, cerceaux, moitiés.
  if (kitPattern == 1 && fract(vMapUv.x / 0.062) > 0.5) shirt = kitAccent;
  if (kitPattern == 2 && fract(vMapUv.y / 0.07) > 0.5) shirt = kitAccent;
  if (kitPattern == 3 && vMapUv.x > 0.5) shirt = kitAccent;
  vec3 tint = vec3(1.0);
  tint = mix(tint, shirt, m.r);
  tint = mix(tint, kitAccent, m.g * m.r);
  tint = mix(tint, kitShorts, m.b);
  tint = mix(tint, kitSocks, m.a);
  diffuseColor.rgb *= tint;
}`,
      );
  };
  material.customProgramCacheKey = () => "kit";
  kitMaterials.set(key, material);
  return material;
}

const headMaterials = new Map<AvatarId, { head: THREE.MeshStandardMaterial; hair: THREE.MeshStandardMaterial | null }>();

function headMaterial(id: AvatarId, avatar: Avatar) {
  let m = headMaterials.get(id);
  if (!m) {
    m = {
      head: new THREE.MeshStandardMaterial({ map: avatar.head, normalMap: avatar.headNormal, roughness: 0.6 }),
      hair: avatar.hair
        ? new THREE.MeshStandardMaterial({ map: avatar.hair, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 })
        : null,
    };
    headMaterials.set(id, m);
  }
  return m;
}

/** Choix stable de l'avatar d'un joueur, d'après son identifiant. */
function avatarFor(id: string): AvatarId {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATARS[Math.abs(h) % AVATARS.length];
}

/**
 * Un footballeur réaliste, tourné vers +x comme les autres représentations. Au repos, il prend la
 * pose de repos de l'animation ; en lecture, la course se mélange au repos selon la vitesse, et le
 * pas suit la distance parcourue (les pieds ne glissent pas).
 */
export function RealPlayer3D({ obj, team, assets }: { obj: PlayerObject; team: Team | undefined; assets: Assets }) {
  const id = avatarFor(obj.id);
  const avatar = assets.avatars[id];
  const kit = kitFor(team, obj.goalkeeper);
  const kitKey = JSON.stringify(kit);
  const color = team?.color ?? "#6b7280";

  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(avatar.scene) as THREE.Group;
    const body = bodyMaterial(id, avatar, JSON.parse(kitKey) as Kit);
    const { head, hair } = headMaterial(id, avatar);
    clone.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const pick = (m: THREE.Material) => (m.name.includes("head") ? head : m.name.includes("opacity") ? (hair ?? head) : body);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(pick) : pick(mesh.material);
    });
    return clone;
  }, [avatar, id, kitKey]);

  const mixer = useMemo(() => {
    const m = new THREE.AnimationMixer(model);
    const idle = m.clipAction(assets.clips.idle);
    const run = m.clipAction(assets.clips.run);
    for (const a of [idle, run]) {
      a.play();
      a.enabled = true;
    }
    idle.setEffectiveWeight(1);
    run.setEffectiveWeight(0);
    m.update(0);
    return { m, idle, run };
  }, [model, assets]);

  useEffect(() => {
    // Phase de foulée en radians (2π par cycle) → temps de l'animation de course.
    strides.set(obj.id, (phase, amount) => {
      const { m, idle, run } = mixer;
      const a = Math.min(1, Math.max(0, amount));
      idle.setEffectiveWeight(1 - a);
      run.setEffectiveWeight(a);
      idle.time = 0.6;
      const cycle = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
      run.time = cycle * run.getClip().duration;
      m.update(0);
    });
    return () => {
      strides.delete(obj.id);
    };
  }, [obj.id, mixer]);

  useEffect(
    () => () => {
      mixer.m.stopAllAction();
    },
    [mixer],
  );

  const label = useMemo(
    () => labelTexture({ number: obj.number, name: obj.name, color, captain: obj.captain }),
    [obj.number, obj.name, color, obj.captain],
  );
  useEffect(() => () => label.dispose(), [label]);

  return (
    <group>
      {obj.goalkeeper && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
          <ringGeometry args={[0.6, 0.72, 40]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.012}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      {/* Rocketbox : centimètres, regard vers +z ; on le tourne vers +x. */}
      <primitive object={model} scale={0.01 * REAL_SCALE} rotation-y={Math.PI / 2} />
      <sprite position-y={2.95} scale={[1.5, 1.13, 1]} renderOrder={2}>
        <spriteMaterial map={label} depthWrite={false} transparent />
      </sprite>
    </group>
  );
}
