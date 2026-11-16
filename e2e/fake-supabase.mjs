// Faux Supabase en mémoire pour les parcours Playwright : authentification par mot de passe
// et sous-ensemble de PostgREST utilisé par l'application. Chaque ligne appartient à
// l'utilisateur du jeton, ce qui reproduit l'effet de la RLS. Ne sert qu'aux tests.
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = 54321;
const PASSWORD = "motdepasse-test";
const tables = { folders: [], projects: [], boards: [], board_versions: [], shares: [], teams: [], players: [] };
/** Fichiers du faux stockage : chemin → { bytes, type }. */
const files = new Map();
const defaults = {
  folders: () => ({ parent_id: null }),
  projects: () => ({ folder_id: null, tags: [], favorite: false, is_template: false, sheet: {} }),
  boards: () => ({ position: 0, notes: "", video_url: null, sheet: {} }),
  board_versions: () => ({}),
  shares: () => ({ token: randomUUID().replaceAll("-", ""), revoked_at: null }),
  teams: () => ({ club: "", category: "", kit: {} }),
  players: () => ({ first_name: "", last_name: "", number: "", position: "", foot: "", notes: "", photo_path: null }),
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const userFor = (email) => ({
  id: createHash("sha1").update(email).digest("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, "$1-$2-$3-$4-$5"),
  aud: "authenticated",
  role: "authenticated",
  email,
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date(0).toISOString(),
});
function session(email) {
  const user = userFor(email);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email, exp, role: "authenticated", aud: "authenticated" })}.test`;
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `r.${Buffer.from(email).toString("base64url")}`, user };
}
function userFromRequest(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.email ? userFor(payload.email) : null;
  } catch {
    return null;
  }
}

let tick = 0;
/** Horodatage strictement croissant, pour un tri stable par date de modification. */
const stamp = () => new Date(Date.now() + ++tick).toISOString();

function matches(row, params) {
  for (const [key, raw] of params) {
    if (["select", "order", "limit", "offset", "columns"].includes(key)) continue;
    const value = row[key];
    if (raw === "is.null") {
      if (value != null) return false;
    } else if (raw === "not.is.null") {
      if (value == null) return false;
    } else if (raw.startsWith("eq.")) {
      if (String(value) !== raw.slice(3)) return false;
    } else {
      throw new Error(`filtre non géré : ${key}=${raw}`);
    }
  }
  return true;
}

function project(row, select) {
  if (!select || select === "*") return row;
  return Object.fromEntries(select.split(",").map((c) => [c.trim(), row[c.trim()]]));
}

function touchProject(id) {
  const p = tables.projects.find((x) => x.id === id);
  if (p) p.updated_at = stamp();
}

function insert(table, body, owner) {
  if (typeof body.name === "string" && body.name.length === 0) throw new Error("check constraint: name");
  const row = {
    id: randomUUID(),
    owner_id: owner,
    created_at: stamp(),
    updated_at: stamp(),
    deleted_at: null,
    ...defaults[table](),
    ...body,
  };
  tables[table].push(row);
  if (table === "boards") touchProject(row.project_id);
  return row;
}

const rpc = {
  create_project(args, owner) {
    const p = insert("projects", { name: args.p_name, folder_id: args.p_folder ?? null }, owner);
    insert("boards", { project_id: p.id, name: args.p_board_name, scene: args.p_scene, position: 0 }, owner);
    return p.id;
  },
  duplicate_project(args, owner) {
    const src = tables.projects.find((p) => p.id === args.p_id && p.owner_id === owner);
    if (!src) throw new Error("project not found");
    const p = insert("projects", { name: args.p_name, folder_id: src.folder_id, tags: [...src.tags], is_template: !!args.p_as_template, sheet: structuredClone(src.sheet) }, owner);
    for (const b of tables.boards.filter((x) => x.project_id === src.id && !x.deleted_at)) {
      insert("boards", { project_id: p.id, name: b.name, notes: b.notes, video_url: b.video_url, scene: structuredClone(b.scene), sheet: structuredClone(b.sheet), position: b.position }, owner);
    }
    return p.id;
  },
  search_projects(args, owner) {
    const q = String(args.q).toLowerCase();
    return tables.projects
      .filter((p) => p.owner_id === owner && !p.deleted_at)
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          tables.boards.some(
            (b) => b.project_id === p.id && !b.deleted_at && `${b.name} ${b.notes}`.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },
};

function readRaw(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** Extrait le premier fichier d'un envoi multipart (ce qu'envoie le client de stockage). */
function firstFile(raw, contentType) {
  const boundary = /boundary=([^;]+)/.exec(contentType ?? "")?.[1];
  if (!boundary) return { bytes: raw, type: contentType || "application/octet-stream" };
  const marker = Buffer.from(`--${boundary}`);
  let start = raw.indexOf(marker);
  while (start !== -1) {
    const next = raw.indexOf(marker, start + marker.length);
    if (next === -1) break;
    const part = raw.subarray(start + marker.length, next);
    const split = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, split).toString();
    if (/filename=/.test(head)) {
      return {
        bytes: part.subarray(split + 4, part.length - 2),
        type: /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? "application/octet-stream",
      };
    }
    start = next;
  }
  return { bytes: raw, type: "application/octet-stream" };
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const cors = {
    "access-control-allow-origin": req.headers.origin ?? "*",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-expose-headers": "content-range",
  };
  const send = (status, body) => {
    res.writeHead(status, { ...cors, "content-type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  if (req.method === "OPTIONS") return send(204);

  try {
    const path = url.pathname;

    if (path === "/auth/v1/token") {
      const body = await readBody(req);
      if (url.searchParams.get("grant_type") === "refresh_token") {
        const email = Buffer.from(String(body.refresh_token).slice(2), "base64url").toString();
        return send(200, session(email));
      }
      if (body.password !== PASSWORD) {
        return send(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      }
      return send(200, session(body.email));
    }
    if (path === "/auth/v1/user") {
      const user = userFromRequest(req);
      return user ? send(200, user) : send(401, { code: 401, error_code: "no_authorization", msg: "no session" });
    }
    if (path === "/auth/v1/logout") return send(204);

    // Faux stockage : lecture d'une photo par adresse signée, sans compte.
    const signed = path.match(/^\/storage\/v1\/object\/sign\/player-photos\/(.+)$/);
    if (signed && req.method === "GET") {
      const file = files.get(decodeURIComponent(signed[1]));
      if (!file || url.searchParams.get("token") !== "fake") return send(404, { message: "absent" });
      res.writeHead(200, { ...cors, "access-control-allow-origin": "*", "content-type": file.type });
      return res.end(file.bytes);
    }

    // Seule fonction ouverte sans compte, comme dans la vraie base.
    if (path === "/rest/v1/rpc/get_shared_project") {
      const { p_token } = await readBody(req);
      const share = tables.shares.find((x) => x.token === p_token && !x.revoked_at);
      const project = share && tables.projects.find((x) => x.id === share.project_id && !x.deleted_at);
      if (!project) return send(200, null);
      const boards = tables.boards
        .filter((b) => b.project_id === project.id && !b.deleted_at)
        .sort((a, b) => a.position - b.position)
        .map(({ id, name, notes, video_url, sheet, scene }) => ({ id, name, notes, video_url, sheet, scene }));
      return send(200, { name: project.name, sheet: project.sheet, updated_at: project.updated_at, boards });
    }

    const user = userFromRequest(req);
    if (!user) return send(401, { message: "JWT manquant" });
    const owner = user.id;

    // Faux stockage : chacun n'écrit, ne signe et ne supprime que dans son dossier.
    if (path === "/storage/v1/object/sign/player-photos" && req.method === "POST") {
      const { paths } = await readBody(req);
      return send(
        200,
        paths.map((p) =>
          p.startsWith(`${owner}/`) && files.has(p)
            ? { path: p, signedURL: `/object/sign/player-photos/${p}?token=fake`, error: null }
            : { path: p, signedURL: null, error: "not found" },
        ),
      );
    }
    const upload = path.match(/^\/storage\/v1\/object\/player-photos\/(.+)$/);
    if (upload && req.method === "POST") {
      const key = decodeURIComponent(upload[1]);
      if (!key.startsWith(`${owner}/`)) return send(403, { message: "new row violates row-level security policy" });
      files.set(key, firstFile(await readRaw(req), req.headers["content-type"]));
      return send(200, { Key: `player-photos/${key}`, Id: randomUUID() });
    }
    if (path === "/storage/v1/object/player-photos" && req.method === "DELETE") {
      const { prefixes } = await readBody(req);
      const removed = prefixes.filter((p) => p.startsWith(`${owner}/`) && files.delete(p));
      return send(200, removed.map((name) => ({ name })));
    }

    if (path.startsWith("/rest/v1/rpc/")) {
      const fn = rpc[path.slice("/rest/v1/rpc/".length)];
      if (!fn) return send(404, { message: "fonction inconnue" });
      return send(200, fn(await readBody(req), owner));
    }

    if (path.startsWith("/rest/v1/")) {
      const table = path.slice("/rest/v1/".length);
      if (!tables[table]) return send(404, { message: `table inconnue : ${table}` });
      const select = url.searchParams.get("select");
      const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      const wantsRows = (req.headers.prefer ?? "").includes("return=representation");
      const mine = () => tables[table].filter((r) => r.owner_id === owner && matches(r, url.searchParams));
      const reply = (status, rows) => {
        const out = rows.map((r) => project(r, select));
        if (single) {
          return out.length === 1 ? send(status, out[0]) : send(406, { code: "PGRST116", message: "0 ou plusieurs lignes" });
        }
        return send(status, out);
      };

      if (req.method === "GET") {
        let rows = mine();
        for (const part of (url.searchParams.get("order") ?? "").split(",").filter(Boolean).reverse()) {
          const [col, dir] = part.split(".");
          rows = [...rows].sort((a, b) => {
            const cmp = a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0;
            return dir === "desc" ? -cmp : cmp;
          });
        }
        const limit = Number(url.searchParams.get("limit"));
        return reply(200, limit ? rows.slice(0, limit) : rows);
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const rows = (Array.isArray(body) ? body : [body]).map((b) => insert(table, b, owner));
        return wantsRows ? reply(201, rows) : send(201);
      }
      if (req.method === "PATCH") {
        const patch = await readBody(req);
        const rows = mine();
        for (const row of rows) {
          Object.assign(row, patch, { updated_at: stamp() });
          if (table === "boards") touchProject(row.project_id);
        }
        return wantsRows ? reply(200, rows) : send(204);
      }
      if (req.method === "DELETE") {
        const rows = mine();
        const ids = new Set(rows.map((r) => r.id));
        tables[table] = tables[table].filter((r) => !ids.has(r.id));
        if (table === "projects") tables.boards = tables.boards.filter((b) => !ids.has(b.project_id));
        return wantsRows ? reply(200, rows) : send(204);
      }
    }
    send(404, { message: `route inconnue : ${req.method} ${path}` });
  } catch (error) {
    send(400, { message: String(error?.message ?? error) });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`faux Supabase sur http://127.0.0.1:${PORT}`));
