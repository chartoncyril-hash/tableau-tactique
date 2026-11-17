import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
globalThis.self = globalThis; globalThis.window = globalThis;
const el = () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getContext: () => null });
globalThis.document = { createElementNS: el, createElement: el };
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = "data:application/octet-stream;base64," + Buffer.from(b).toString("base64"); this.onloadend?.(); }); }
};
const THREE = await import("three");
const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
const load = (f) => { const b = readFileSync(f); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ""); };
const R = "/home/claude/microsoft/microsoft-rocketbox/Assets";
mkdirSync("public", { recursive: true });

let boneNames = new Set(load(`${R}/Avatars/Professions/Sports_Male_02/Export/Sports_Male_02.fbx`).getObjectByProperty("isSkinnedMesh", true).skeleton.bones.map((b) => b.name));
const clips = {};
for (const [key, file] of [
  ["idle", "static/m_idle_neutral_01"],
  ["walk", "xy/m_walk_neutral_01"],
  ["jog", "xy/m_run_slow_01"],
  ["run", "xy/m_run_neutral_01"],
  ["sprint", "xy/m_run_fast_01"],
]) {
  const obj = load(`${R}/Animations/all_animations_max_motextr_${file}.max.fbx`);
  const clip = obj.animations[0];
  clip.name = key;
  clip.tracks = clip.tracks.filter((t) => {
    const [bone, prop] = t.name.split(".");
    if (!boneNames.has(bone)) return false;
    if (prop === "scale") return false;
    if (prop === "position") return bone === "Bip01" || bone === "Bip01_Pelvis";
    return true;
  });
  // Moins de précision : un fichier plus léger, sans différence visible.
  for (const t of clip.tracks) {
    t.times = Float32Array.from(t.times, (v) => Math.round(v * 1000) / 1000);
    t.values = Float32Array.from(t.values, (v) => Math.round(v * 10000) / 10000);
  }
  clip.optimize();
  if (key === "idle") { for (const t of clip.tracks) { const n = t.times.findIndex((v) => v > 4); if (n > 0) { const size = t.getValueSize(); t.times = t.times.slice(0, n); t.values = t.values.slice(0, n * size); } } clip.duration = 4; }
  clips[key] = clip;
  console.log(key, clip.duration.toFixed(2), clip.tracks.length);
}

for (const [name, file] of [["m301", "Sports_Male_02"], ["m300", "Sports_Male_03"]]) {
  const obj = load(`${R}/Avatars/Professions/${file}/Export/${file}.fbx`);
  obj.animations = name === "m301" ? Object.values(clips) : [];
  obj.traverse((o) => {
    if (o.isSkinnedMesh) {
      boneNames = new Set(o.skeleton.bones.map((b) => b.name));
      o.material = o.material.map((m) => new THREE.MeshStandardMaterial({ name: m.name.replace(/^m30\d_/, "") }));
      o.geometry.deleteAttribute("color");
      o.geometry.deleteAttribute("normal") ; o.geometry.computeVertexNormals();
    }
    if ((o.isMesh && !o.isSkinnedMesh) || o.isLight) o.removeFromParent();
  });
  const glb = await new GLTFExporter().parseAsync(obj, { binary: true, onlyVisible: false, animations: obj.animations });
  writeFileSync(`public/${name}.glb`, Buffer.from(glb));
  console.log(name, (glb.byteLength / 1024).toFixed(0), "Ko");
}

