// Band Kit Worker: serves the app (static assets) and a small JSON API over this deployment's own D1 database.
// Every band runs as its own deployment with its own database, password and settings, exactly like the other club apps.
// The database tables are created automatically on first use, so a new band needs no manual migration step.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, code TEXT UNIQUE, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pieces (id TEXT PRIMARY KEY, code TEXT UNIQUE, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, data TEXT NOT NULL)`
];
const PREFIX = { instrument: 'INS', uniform: 'UNI', accessory: 'EQ', piece: 'MUS' };
const COLLECTIONS = { members: { code: false }, items: { code: true }, pieces: { code: true } };
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 10000; // kept modest so login fits Workers CPU limits; runs once per sign-in
const MAX_IMAGE_BYTES = 1_200_000;
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (status, error) => json({ error }, status);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let schemaReady = null;
function ensureSchema(env) {
  schemaReady ||= env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  return schemaReady;
}

// ---------- meta helpers ----------
const getMeta = async (db, key) => (await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first())?.value ?? null;
const setMeta = (db, key, value) =>
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value);
const getSettings = async (db) => { try { return JSON.parse((await getMeta(db, 'settings')) || 'null') || {}; } catch { return {}; } };

// ---------- crypto ----------
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function derive(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256));
}
async function hashPassword(password) {
  const salt = randomHex(16);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${await derive(password, salt, PBKDF2_ITERATIONS)}`;
}
async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash) return false;
  return safeEqual(await derive(password, salt, Number(iter)), hash);
}
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}
async function issueToken(db) {
  const secret = await getMeta(db, 'session_secret');
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return `${exp}.${await hmac(secret, String(exp))}`;
}
async function isAuthed(request, db) {
  const m = /^Bearer (\d+)\.([0-9a-f]{64})$/.exec(request.headers.get('authorization') || '');
  if (!m || Number(m[1]) < Date.now()) return false;
  const secret = await getMeta(db, 'session_secret');
  return !!secret && safeEqual(await hmac(secret, m[1]), m[2]);
}

// ---------- images (stored in D1 as base64, no extra service needed) ----------
function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function serveImage(db, id) {
  const row = await db.prepare('SELECT content_type AS t, data AS d FROM images WHERE id = ?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(fromBase64(row.d), {
    headers: { 'content-type': row.t, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' }
  });
}

// ---------- data ----------
const parseRows = (rows) => rows.map((r) => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);

async function readState(db) {
  const [members, items, pieces, counters] = await Promise.all([
    db.prepare('SELECT data FROM members').all(),
    db.prepare('SELECT data FROM items').all(),
    db.prepare('SELECT data FROM pieces').all(),
    db.prepare("SELECT key, value FROM meta WHERE key LIKE 'counter:%'").all()
  ]);
  const c = {};
  counters.results.forEach((r) => { c[r.key.slice(8)] = Number(r.value) || 0; });
  return { settings: await getSettings(db), members: parseRows(members.results), items: parseRows(items.results), pieces: parseRows(pieces.results), counters: c };
}

async function nextCode(db, kind) {
  if (!PREFIX[kind]) return null;
  const row = await db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 RETURNING value`
  ).bind(`counter:${kind}`).first();
  return `${PREFIX[kind]}-${String(Number(row.value)).padStart(3, '0')}`;
}


// Keep the server counter at or above any code a device has used, so new codes never clash.
async function bumpCounter(db, kind, code) {
  const n = parseInt(String(code).split('-')[1], 10);
  if (!PREFIX[kind] || !(n > 0)) return;
  await db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = MAX(CAST(value AS INTEGER), CAST(excluded.value AS INTEGER))`
  ).bind(`counter:${kind}`, String(n)).run();
}

const batchInChunks = async (db, stmts) => { for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80)); };

function upsertStmt(db, table, doc, withCode) {
  const now = new Date().toISOString();
  const data = JSON.stringify(doc);
  return withCode
    ? db.prepare(`INSERT INTO ${table} (id, code, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code = excluded.code, data = excluded.data, updated_at = excluded.updated_at`).bind(doc.id, doc.code, data, now)
    : db.prepare(`INSERT INTO ${table} (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(doc.id, data, now);
}

const validDoc = (doc, withCode, id) =>
  doc && typeof doc === 'object' && !Array.isArray(doc) && doc.id === id && ID_RE.test(id) && (!withCode || (typeof doc.code === 'string' && doc.code.length > 0 && doc.code.length <= 40));

// ---------- API ----------
async function handleApi(request, env, url) {
  const db = env.DB;
  await ensureSchema(env);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [name, id] = parts;
  const method = request.method;
  const body = async () => request.json().catch(() => ({}));

  // Public: lets the sign-in screen show the band's name and logo.
  if (name === 'status' && method === 'GET') {
    const settings = await getSettings(db);
    return json({ cloud: true, configured: !!(await getMeta(db, 'admin_hash')), bandName: settings.bandName || null, logo: settings.logo || null });
  }

  if (name === 'setup' && method === 'POST') {
    if (await getMeta(db, 'admin_hash')) return fail(409, 'This band is already set up.');
    const { password, bandName } = await body();
    if (typeof password !== 'string' || password.length < 6 || password.length > 200) return fail(400, 'Choose a password of at least 6 characters.');
    const settings = await getSettings(db);
    if (typeof bandName === 'string' && bandName.trim()) settings.bandName = bandName.trim().slice(0, 60);
    await db.batch([
      setMeta(db, 'admin_hash', await hashPassword(password)),
      setMeta(db, 'session_secret', randomHex(32)),
      setMeta(db, 'settings', JSON.stringify(settings))
    ]);
    return json({ token: await issueToken(db) }, 201);
  }

  if (name === 'login' && method === 'POST') {
    const { password } = await body();
    const stored = await getMeta(db, 'admin_hash');
    if (!stored) return fail(409, 'This band is not set up yet.');
    if (typeof password !== 'string' || !(await verifyPassword(password, stored))) { await sleep(500); return fail(401, 'Wrong password.'); }
    return json({ token: await issueToken(db) });
  }

  if (name === 'img' && method === 'GET') return id && ID_RE.test(id) ? serveImage(db, id) : new Response('Not found', { status: 404 });

  // Everything below needs a valid session.
  if (!(await isAuthed(request, db))) { await sleep(300); return fail(401, 'Sign in required.'); }

  if (name === 'state' && method === 'GET') return json(await readState(db));

  if (name === 'settings' && method === 'PUT') {
    const doc = await body();
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return fail(400, 'Bad settings.');
    await setMeta(db, 'settings', JSON.stringify(doc)).run();
    return json({ ok: true });
  }

  if (name === 'code' && method === 'POST') {
    const { kind } = await body();
    const code = await nextCode(db, kind);
    return code ? json({ code }) : fail(400, 'Unknown kind.');
  }

  if (COLLECTIONS[name]) {
    const withCode = COLLECTIONS[name].code;
    if (!id) return fail(400, 'id required');
    if (method === 'PUT') {
      const doc = await body();
      if (!validDoc(doc, withCode, id)) return fail(400, 'Bad record.');
      try {
        await upsertStmt(db, name, doc, withCode).run();
        if (withCode) await bumpCounter(db, name === 'pieces' ? 'piece' : doc.kind, doc.code);
      }
      catch (e) { return /UNIQUE/i.test(String(e)) ? fail(409, 'That code is already in use.') : fail(500, String(e.message || e)); }
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      if (!ID_RE.test(id)) return fail(400, 'Bad id');
      await db.prepare(`DELETE FROM ${name} WHERE id = ?`).bind(id).run();
      return json({ ok: true });
    }
  }

  if (name === 'upload' && method === 'POST') {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return fail(400, 'Empty file');
    if (bytes.length > MAX_IMAGE_BYTES) return fail(413, 'Image too large (max about 1.2 MB)');
    const type = (request.headers.get('content-type') || '').split(';')[0];
    if (!/^image\/(png|jpeg|webp|gif)$/.test(type)) return fail(415, 'Use a PNG, JPG, WebP or GIF image');
    const imgId = randomHex(12);
    await db.prepare('INSERT INTO images (id, content_type, data) VALUES (?, ?, ?)').bind(imgId, type, toBase64(bytes)).run();
    return json({ url: `/api/img/${imgId}` }, 201);
  }

  if (name === 'password' && method === 'POST') {
    const { current, next } = await body();
    if (typeof next !== 'string' || next.length < 6 || next.length > 200) return fail(400, 'Choose a password of at least 6 characters.');
    if (typeof current !== 'string' || !(await verifyPassword(current, await getMeta(db, 'admin_hash')))) { await sleep(500); return fail(401, 'Current password is wrong.'); }
    await db.batch([setMeta(db, 'admin_hash', await hashPassword(next)), setMeta(db, 'session_secret', randomHex(32))]);
    return json({ token: await issueToken(db) }); // other devices are signed out
  }

  if (name === 'import' && method === 'POST') {
    const data = await body();
    if (!data || !Array.isArray(data.items)) return fail(400, 'That is not a Band Kit backup.');
    const members = Array.isArray(data.members) ? data.members : [];
    const pieces = Array.isArray(data.pieces) ? data.pieces : [];
    const all = [...members.map((d) => ['members', d, false]), ...data.items.map((d) => ['items', d, true]), ...pieces.map((d) => ['pieces', d, true])];
    if (all.some(([t, d, c]) => !validDoc(d, c, d && d.id))) return fail(400, 'The backup contains a record that cannot be read.');
    const counters = { instrument: 0, uniform: 0, accessory: 0, piece: 0, ...(data.counters || {}) };
    const bump = (kind, code) => { const n = parseInt(String(code).split('-')[1], 10); if (n > (counters[kind] || 0)) counters[kind] = n; };
    data.items.forEach((i) => bump(i.kind, i.code));
    pieces.forEach((p) => bump('piece', p.code));
    await db.batch([db.prepare('DELETE FROM members'), db.prepare('DELETE FROM items'), db.prepare('DELETE FROM pieces'), db.prepare("DELETE FROM meta WHERE key LIKE 'counter:%'")]);
    await batchInChunks(db, [
      ...all.map(([t, d, c]) => upsertStmt(db, t, d, c)),
      ...Object.entries(counters).map(([k, v]) => setMeta(db, `counter:${k}`, String(Number(v) || 0))),
      setMeta(db, 'settings', JSON.stringify(data.settings && typeof data.settings === 'object' ? data.settings : await getSettings(db)))
    ]);
    return json({ ok: true });
  }

  if (name === 'erase' && method === 'POST') {
    const settings = await getSettings(db);
    await db.batch([
      db.prepare('DELETE FROM members'), db.prepare('DELETE FROM items'), db.prepare('DELETE FROM pieces'),
      db.prepare("DELETE FROM meta WHERE key LIKE 'counter:%'"),
      setMeta(db, 'settings', JSON.stringify({ bandName: settings.bandName || 'My Youth Band' }))
    ]);
    return json({ ok: true });
  }

  return fail(404, 'Not found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await handleApi(request, env, url); }
      catch (e) { return fail(500, String(e && e.message ? e.message : e)); }
    }
    return env.ASSETS.fetch(request);
  }
};
