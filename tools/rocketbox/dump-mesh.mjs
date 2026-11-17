import { readFileSync, writeFileSync } from "node:fs";
globalThis.self = globalThis; globalThis.window = globalThis;
const el = () => ({ style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getContext: () => null });
globalThis.document = { createElementNS: el, createElement: el };
const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
const [file, out] = process.argv.slice(2);
const buf = readFileSync(file);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
let mesh; obj.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
const g = mesh.geometry;
const bones = mesh.skeleton.bones.map((b) => b.name);
const pos = g.attributes.position, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
mesh.updateMatrixWorld(true);
const v = new (await import("three")).Vector3();
const verts = [];
for (let i = 0; i < pos.count; i++) {
  v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  verts.push([+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2), +uv.getX(i).toFixed(5), +uv.getY(i).toFixed(5), bones[best]]);
}
const groups = g.groups.map((gr) => ({ start: gr.start, count: gr.count, material: gr.materialIndex }));
const index = g.index ? Array.from(g.index.array) : null;
writeFileSync(out, JSON.stringify({ verts, groups, index, materials: mesh.material.map((m) => m.name) }));
console.log(pos.count, groups, !!index);
