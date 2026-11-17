// Faux Supabase en mémoire pour les parcours Playwright : authentification par mot de passe
// et sous-ensemble de PostgREST utilisé par l'application. Les règles d'accès reproduisent la
// RLS de la vraie base (contenus personnels ou de club, rôles admin / entraîneur / lecteur).
// Ne sert qu'aux tests.
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = 54321;
const PASSWORD = "motdepasse-test";
const tables = {
  folders: [], projects: [], boards: [], board_versions: [], shares: [], teams: [], players: [],
  clubs: [], club_members: [], club_invites: [], board_comments: [],
};
/** Utilisateurs connus (pour la liste des membres d'un club). */
const users = new Map();
/** Fichiers du faux stockage : chemin → { bytes, type }. */
const files = new Map();
const defaults = {
  folders: () => ({ parent_id: null, club_id: null }),
  projects: () => ({ folder_id: null, club_id: null, tags: [], favorite: false, is_template: false, sheet: {} }),
  boards: () => ({ position: 0, notes: "", video_url: null, sheet: {} }),
  board_versions: () => ({}),
  shares: () => ({ token: randomUUID().replaceAll("-", ""), revoked_at: null }),
  teams: () => ({ club: "", club_id: null, category: "", kit: {} }),
  players: () => ({ first_name: "", last_name: "", number: "", position: "", foot: "", notes: "", photo_path: null }),
  board_comments: () => ({ parent_id: null, x: null, y: null, resolved_at: null, resolved_by: null, author_name: "" }),
  club_invites: () => ({
    role: "coach", label: "", token: randomUUID().replaceAll("-", ""),
    expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), accepted_at: null, accepted_by: null, revoked_at: null,
  }),
};

// --- Droits (copie de la RLS) ------------------------------------------------
const roleOf = (club, uid) => tables.club_members.find((m) => m.club_id === club && m.user_id === uid)?.role ?? null;
const canRead = (club, owner, uid) => (club ? roleOf(club, uid) !== null : owner === uid);
const canEdit = (club, owner, uid) => (club ? ["admin", "coach"].includes(roleOf(club, uid)) : owner === uid);
const byId = (table, id) => tables[table].find((r) => r.id === id);

function readable(table, row, uid) {
  switch (table) {
    case "folders": case "projects": case "teams": return canRead(row.club_id, row.owner_id, uid);
    case "boards": { const p = byId("projects", row.project_id); return !!p && readable("projects", p, uid); }
    case "board_versions": { const b = byId("boards", row.board_id); return !!b && readable("boards", b, uid); }
    case "shares": return editable(table, row, uid);
    case "players": { const t = byId("teams", row.team_id); return !!t && readable("teams", t, uid); }
    case "clubs": return roleOf(row.id, uid) !== null;
    case "club_members": return roleOf(row.club_id, uid) !== null;
    case "club_invites": return roleOf(row.club_id, uid) === "admin";
    case "board_comments": { const b = byId("boards", row.board_id); return !!b && readable("boards", b, uid); }
  }
  return false;
}
function editable(table, row, uid) {
  switch (table) {
    case "folders": case "projects": case "teams": return canEdit(row.club_id, row.owner_id, uid);
    case "boards": case "shares": { const p = byId("projects", row.project_id); return !!p && canEdit(p.club_id, p.owner_id, uid); }
    case "board_versions": { const b = byId("boards", row.board_id); return !!b && editable("boards", b, uid); }
    case "players": { const t = byId("teams", row.team_id); return !!t && canEdit(t.club_id, t.owner_id, uid); }
    case "clubs": case "club_invites": return roleOf(row.club_id ?? row.id, uid) === "admin";
    case "club_members": return roleOf(row.club_id, uid) === "admin";
    case "board_comments": {
      if (row.author_id === uid) return true;
      const b = byId("boards", row.board_id);
      return !!b && editable("boards", b, uid);
    }
  }
  return false;
}
const deletable = (table, row, uid) => editable(table, row, uid) || (table === "club_members" && row.user_id === uid);
const denied = () => Object.assign(new Error("new row violates row-level security policy"), { status: 403 });

/** Un club garde toujours un admin. */
function keepAdmin(member, nextRole) {
  if (member.role !== "admin" || nextRole === "admin") return;
  const others = tables.club_members.some((m) => m.club_id === member.club_id && m.role === "admin" && m.user_id !== member.user_id);
  if (!others && byId("clubs", member.club_id)) throw new Error("last_admin");
}

/** Photo rangée dans le dossier de l'espace de l'équipe (vérifiée quand le chemin change). */
function checkPhoto(row, uid) {
  if (!row.photo_path) return;
  const team = byId("teams", row.team_id);
  const ok = team?.club_id ? row.photo_path.startsWith(`clubs/${team.club_id}/`) : row.photo_path.startsWith(`${uid}/`);
  if (!ok) throw denied();
}

/** Droit sur un fichier : dossier personnel, ou dossier `clubs/<club>/` selon le rôle. */
function fileRole(key, uid) {
  if (key.startsWith(`${uid}/`)) return "admin";
  const club = /^clubs\/([0-9a-f-]{36})\//.exec(key)?.[1];
  return club ? roleOf(club, uid) : null;
}
const canReadFile = (key, uid) => fileRole(key, uid) !== null;
const canWriteFile = (key, uid) => ["admin", "coach"].includes(fileRole(key, uid));

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
  users.set(user.id, email);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email, exp, role: "authenticated", aud: "authenticated" })}.test`;
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `r.${Buffer.from(email).toString("base64url")}`, user };
}
function userFromRequest(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    if (!payload.email) return null;
    const user = userFor(payload.email);
    users.set(user.id, payload.email);
    return user;
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

function insert(table, body, owner, { check = true } = {}) {
  if (typeof body.name === "string" && body.name.length === 0) throw new Error("check constraint: name");
  const row = {
    id: randomUUID(),
    owner_id: owner,
    created_at: stamp(),
    updated_at: stamp(),
    deleted_at: null,
    ...(defaults[table]?.() ?? {}),
    ...body,
  };
  if (check) {
    // Comme la RLS : pas d'insertion directe dans clubs / club_members, et droit de modifier l'espace visé.
    if (table === "clubs" || table === "club_members") throw denied();
    if (table === "board_comments") {
      // Quiconque voit le tableau commente, en son nom ; une réponse vise un fil du même tableau.
      if (row.author_id !== owner || !readable(table, row, owner)) throw denied();
      if (row.parent_id) {
        const parent = byId("board_comments", row.parent_id);
        if (!parent || parent.board_id !== row.board_id || parent.parent_id) throw denied();
      }
      Object.assign(row, { author_name: (users.get(owner) ?? "").split("@")[0], resolved_at: null, resolved_by: null });
    } else if (!editable(table, row, owner)) throw denied();
    if (table === "club_invites" && row.invited_by !== owner) throw denied();
    if (table === "players") checkPhoto(row, owner);
    if (table === "projects" && row.folder_id && byId("folders", row.folder_id)?.club_id !== row.club_id) throw denied();
  }
  tables[table].push(row);
  if (table === "boards") touchProject(row.project_id);
  return row;
}

const rpc = {
  create_project(args, owner) {
    const p = insert("projects", { name: args.p_name, folder_id: args.p_folder ?? null, club_id: args.p_club ?? null }, owner);
    insert("boards", { project_id: p.id, name: args.p_board_name, scene: args.p_scene, position: 0 }, owner);
    return p.id;
  },
  duplicate_project(args, owner) {
    const src = tables.projects.find((p) => p.id === args.p_id && readable("projects", p, owner));
    if (!src) throw new Error("project not found");
    const club = args.p_club ?? null;
    const folder = (src.club_id ?? null) === club ? src.folder_id : null;
    const p = insert("projects", { name: args.p_name, folder_id: folder, club_id: club, tags: [...src.tags], is_template: !!args.p_as_template, sheet: structuredClone(src.sheet) }, owner);
    for (const b of tables.boards.filter((x) => x.project_id === src.id && !x.deleted_at)) {
      insert("boards", { project_id: p.id, name: b.name, notes: b.notes, video_url: b.video_url, scene: structuredClone(b.scene), sheet: structuredClone(b.sheet), position: b.position }, owner);
    }
    return p.id;
  },
  search_projects(args, owner) {
    const q = String(args.q).toLowerCase();
    return tables.projects
      .filter((p) => readable("projects", p, owner) && !p.deleted_at && (p.club_id ?? null) === (args.p_club ?? null))
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
  create_club(args, owner) {
    const club = insert("clubs", { name: args.p_name, created_by: owner }, owner, { check: false });
    insert("club_members", { club_id: club.id, user_id: owner, role: "admin" }, owner, { check: false });
    return club.id;
  },
  accept_invite(args, owner) {
    const invite = tables.club_invites.find((i) => i.token === args.p_token);
    if (!invite) throw new Error("invite_not_found");
    if (roleOf(invite.club_id, owner)) return invite.club_id;
    if (invite.revoked_at || invite.accepted_at || Date.parse(invite.expires_at) < Date.now()) throw new Error("invite_invalid");
    insert("club_members", { club_id: invite.club_id, user_id: owner, role: invite.role }, owner, { check: false });
    Object.assign(invite, { accepted_by: owner, accepted_at: stamp() });
    return invite.club_id;
  },
  club_members_list(args, owner) {
    if (!roleOf(args.p_club, owner)) return [];
    const rank = { admin: 0, coach: 1, viewer: 2 };
    return tables.club_members
      .filter((m) => m.club_id === args.p_club)
      .sort((a, b) => rank[a.role] - rank[b.role] || a.created_at.localeCompare(b.created_at))
      .map((m) => ({ user_id: m.user_id, role: m.role, email: users.get(m.user_id) ?? "", display_name: null, created_at: m.created_at }));
  },
};

/** Page d'invitation : ouverte sans compte. */
function getInvite(token, uid) {
  const invite = tables.club_invites.find((i) => i.token === token);
  const club = invite && byId("clubs", invite.club_id);
  if (!club) return null;
  const status = invite.revoked_at ? "revoked" : invite.accepted_at ? "used" : Date.parse(invite.expires_at) < Date.now() ? "expired" : "valid";
  return { club_id: club.id, club_name: club.name, role: invite.role, status, member: !!(uid && roleOf(club.id, uid)) };
}

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

    if (path === "/rest/v1/rpc/get_invite") {
      const { p_token } = await readBody(req);
      return send(200, getInvite(p_token, userFromRequest(req)?.id));
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
          canReadFile(p, owner) && files.has(p)
            ? { path: p, signedURL: `/object/sign/player-photos/${p}?token=fake`, error: null }
            : { path: p, signedURL: null, error: "not found" },
        ),
      );
    }
    const upload = path.match(/^\/storage\/v1\/object\/player-photos\/(.+)$/);
    if (upload && req.method === "POST") {
      const key = decodeURIComponent(upload[1]);
      if (!canWriteFile(key, owner)) return send(403, { message: "new row violates row-level security policy" });
      files.set(key, firstFile(await readRaw(req), req.headers["content-type"]));
      return send(200, { Key: `player-photos/${key}`, Id: randomUUID() });
    }
    if (path === "/storage/v1/object/player-photos" && req.method === "DELETE") {
      const { prefixes } = await readBody(req);
      const removed = prefixes.filter((p) => canWriteFile(p, owner) && files.delete(p));
      return send(200, removed.map((name) => ({ name })));
    }
    if (path === "/storage/v1/object/copy" && req.method === "POST") {
      const { sourceKey, destinationKey } = await readBody(req);
      const file = files.get(sourceKey);
      if (!file || !canReadFile(sourceKey, owner)) return send(404, { message: "absent" });
      if (!canWriteFile(destinationKey, owner)) return send(403, { message: "new row violates row-level security policy" });
      files.set(destinationKey, file);
      return send(200, { Key: `player-photos/${destinationKey}` });
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
      const visible = () => tables[table].filter((r) => readable(table, r, owner) && matches(r, url.searchParams));
      const reply = (status, rows) => {
        const out = rows.map((r) => project(r, select));
        if (single) {
          return out.length === 1 ? send(status, out[0]) : send(406, { code: "PGRST116", message: "0 ou plusieurs lignes" });
        }
        return send(status, out);
      };

      if (req.method === "GET") {
        let rows = visible();
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
        // Le créateur d'une ligne ne change jamais (déclencheur keep_owner de la vraie base).
        const patch = await readBody(req);
        delete patch.owner_id;
        const rows = visible().filter((r) => editable(table, r, owner));
        for (const row of rows) {
          const next = { ...row, ...patch };
          // La nouvelle version doit rester modifiable (WITH CHECK).
          if (!editable(table, next, owner)) throw denied();
          if (table === "club_members") keepAdmin(row, next.role);
          if (table === "board_comments") {
            for (const k of ["board_id", "parent_id", "author_id", "author_name"]) delete patch[k];
            if ("body" in patch && patch.body !== row.body && row.author_id !== owner) throw denied();
            if ("resolved_at" in patch) patch.resolved_by = patch.resolved_at ? owner : null;
          }
          if (table === "players" && next.photo_path !== row.photo_path) checkPhoto(next, owner);
          if (table === "projects" && next.folder_id && byId("folders", next.folder_id)?.club_id !== next.club_id) throw denied();
          Object.assign(row, patch, { updated_at: stamp() });
          if (table === "boards") touchProject(row.project_id);
        }
        return wantsRows ? reply(200, rows) : send(204);
      }
      if (req.method === "DELETE") {
        const rows = visible().filter((r) => deletable(table, r, owner));
        if (table === "club_members") for (const row of rows) keepAdmin(row, null);
        const doomed = new Set(rows);
        tables[table] = tables[table].filter((r) => !doomed.has(r));
        const ids = new Set(rows.map((r) => r.id));
        if (table === "projects") tables.boards = tables.boards.filter((b) => !ids.has(b.project_id));
        if (table === "clubs") {
          // Comme ON DELETE CASCADE : membres, invitations et contenus du club disparaissent.
          for (const t of ["club_members", "club_invites", "folders", "projects", "teams"]) {
            tables[t] = tables[t].filter((r) => !ids.has(r.club_id));
          }
        }
        return wantsRows ? reply(200, rows) : send(204);
      }
    }
    send(404, { message: `route inconnue : ${req.method} ${path}` });
  } catch (error) {
    send(400, { message: String(error?.message ?? error) });
  }
});

// --- Temps réel : sous-ensemble du protocole Phoenix utilisé par realtime-js (vsn 2.0.0) -------
// Canaux privés `project:<id>` : entrée pour qui peut lire le projet ; diffusion des changements
// pour qui peut le modifier (pointeur et commentaires pour tous), comme les politiques de la base.
const sockets = new WebSocketServer({ noServer: true });
/** Abonnés par sujet : { ws, joinRef, uid, key, meta }. */
const topics = new Map();
const tokenUser = (token) => {
  try {
    return JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString()).email;
  } catch {
    return null;
  }
};
const projectOf = (topic) => byId("projects", topic.replace(/^realtime:project:/, ""));
const OPEN_EVENTS = new Set(["cursor", "cursor-out", "comments"]);

function decodeBinaryPush(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint8(0) !== 3) return null;
  const sizes = [1, 2, 3, 4, 5].map((i) => view.getUint8(i));
  const encoding = view.getUint8(6);
  let offset = 7;
  const take = (n) => {
    const out = buf.subarray(offset, offset + n).toString("utf8");
    offset += n;
    return out;
  };
  const [joinRef, ref, topic, event] = [take(sizes[0]), take(sizes[1]), take(sizes[2]), take(sizes[3])];
  take(sizes[4]);
  const raw = buf.subarray(offset);
  const payload = encoding === 1 ? JSON.parse(raw.toString("utf8")) : null;
  return { joinRef, ref, topic, event, payload };
}

sockets.on("connection", (ws) => {
  const out = (msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
  const subs = new Map();
  const leave = (topic) => {
    const sub = subs.get(topic);
    if (!sub) return;
    subs.delete(topic);
    const list = (topics.get(topic) ?? []).filter((s) => s !== sub);
    topics.set(topic, list);
    if (sub.meta) {
      for (const other of list) other.out([null, null, topic, "presence_diff", { joins: {}, leaves: { [sub.key]: { metas: [sub.meta] } } }]);
    }
  };
  const forward = (topic, event, payload, from) => {
    for (const sub of topics.get(topic) ?? []) {
      if (sub === from) continue;
      sub.out([null, null, topic, "broadcast", { type: "broadcast", event, payload }]);
    }
  };
  ws.on("message", (data, isBinary) => {
    try {
      if (isBinary) {
        const push = decodeBinaryPush(Buffer.from(data));
        const sub = push && subs.get(push.topic);
        if (!sub) return;
        const project = projectOf(push.topic);
        const allowed = project && (OPEN_EVENTS.has(push.event) || editable("projects", project, sub.uid));
        if (allowed) forward(push.topic, push.event, push.payload, sub);
        return;
      }
      const [joinRef, ref, topic, event, payload] = JSON.parse(data.toString());
      const reply = (status, response = {}) => out([joinRef, ref, topic, "phx_reply", { status, response }]);
      if (topic === "phoenix") return reply("ok");
      if (event === "phx_join") {
        const email = tokenUser(payload?.access_token);
        const uid = email ? userFor(email).id : null;
        const project = projectOf(topic);
        if (!uid || !project || !readable("projects", project, uid)) return reply("error", { reason: "Unauthorized" });
        const sub = { out, joinRef, uid, key: payload?.config?.presence?.key || randomUUID(), meta: null };
        subs.set(topic, sub);
        topics.set(topic, [...(topics.get(topic) ?? []), sub]);
        reply("ok", { postgres_changes: [] });
        const state = Object.fromEntries((topics.get(topic) ?? []).filter((s) => s.meta).map((s) => [s.key, { metas: [s.meta] }]));
        out([null, null, topic, "presence_state", state]);
        return;
      }
      const sub = subs.get(topic);
      if (event === "phx_leave") {
        leave(topic);
        return reply("ok");
      }
      if (!sub) return reply("error", { reason: "not joined" });
      if (event === "access_token") return reply("ok");
      if (event === "presence" && payload?.event === "track") {
        const previous = sub.meta;
        sub.meta = { ...payload.payload, phx_ref: randomUUID() };
        const diff = { joins: { [sub.key]: { metas: [sub.meta] } }, leaves: previous ? { [sub.key]: { metas: [previous] } } : {} };
        for (const other of topics.get(topic) ?? []) other.out([null, null, topic, "presence_diff", diff]);
        return reply("ok");
      }
      if (event === "presence" && payload?.event === "untrack") {
        const previous = sub.meta;
        sub.meta = null;
        if (previous) for (const other of topics.get(topic) ?? []) other.out([null, null, topic, "presence_diff", { joins: {}, leaves: { [sub.key]: { metas: [previous] } } }]);
        return reply("ok");
      }
      if (event === "broadcast") {
        const project = projectOf(topic);
        if (project && (OPEN_EVENTS.has(payload?.event) || editable("projects", project, sub.uid))) forward(topic, payload.event, payload.payload, sub);
        return reply("ok");
      }
      reply("ok");
    } catch (error) {
      console.error("realtime", error);
    }
  });
  ws.on("close", () => {
    for (const topic of [...subs.keys()]) leave(topic);
  });
});

server.on("upgrade", (req, socket, head) => {
  if (!req.url?.startsWith("/realtime/v1/websocket")) return socket.destroy();
  sockets.handleUpgrade(req, socket, head, (ws) => sockets.emit("connection", ws, req));
});

server.listen(PORT, "127.0.0.1", () => console.log(`faux Supabase sur http://127.0.0.1:${PORT}`));
