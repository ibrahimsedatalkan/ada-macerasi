/* ============================================================
   Ada Macerası — Oyun Sunucusu (AŞAMA 2)
   Sıfır bağımlılık: yalnızca Node.js standart kütüphanesi.
   - Statik dosya sunumu (oyunun kendisi)
   - Hesap: takma ad + sınıf kodu + 4 haneli PIN (e-posta YOK)
   - İlerleme senkronu + sınıf liderlik tablosu
   - Canlı düello: oda kodu, REST + Server-Sent Events

   Çalıştır:  node server/server.mjs [--port 8787]
   ============================================================ */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const PORT = Number(process.env.PORT) || (process.argv.includes('--port') ? Number(process.argv[process.argv.indexOf('--port') + 1]) : 8787);
const HOST = process.env.HOST || '127.0.0.1';

/* CORS — oyun GitHub Pages'te (https) çalışır, sunucu başka bir adreste.
   Tarayıcı farklı kaynaktan gelen isteği CORS başlığı olmadan REDDEDER.
   Varsayılan: GitHub Pages + yerel geliştirme. Canlıda ALLOWED_ORIGINS
   ortam değişkeniyle kendi alan adınızı ekleyin (virgülle ayrılmış). */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://ibrahimsedatalkan.github.io,http://127.0.0.1:8123,http://localhost:8123')
  .split(',').map((x) => x.trim()).filter(Boolean);

function corsHeaders(req) {
  const origin = req?.headers?.origin || '';
  const izinli = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': izinli,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-app-password, x-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

/* ---------------- Veri katmanı (tek JSON dosyası) ---------------- */
let db = { accounts: {}, progress: {}, duels: {} };
let writeTimer = null;

async function loadDb() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = Object.assign({ accounts: {}, progress: {}, duels: {} }, parsed);
  } catch (e) {
    db = { accounts: {}, progress: {}, duels: {} };
  }
}

function saveDbSoon() {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try { await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 1)); } catch (e) { /* yazma hatası yoksay */ }
  }, 400);
}

/* ---------------- Yardımcılar ---------------- */
const normNick = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 14);
const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'SINIF';
const acctKey = (nick, code) => normCode(code) + '|' + normNick(nick).toLocaleLowerCase('tr');
const roomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPRSTUVYZ23456789';   // karışan harfler yok
  let s = '';
  for (let i = 0; i < 4; i++) s += alphabet[crypto.randomInt(0, alphabet.length)];
  return s;
};

function hashPin(pin, salt) {
  return crypto.pbkdf2Sync(String(pin), salt, 120000, 32, 'sha256').toString('hex');
}
function newToken() { return crypto.randomBytes(24).toString('base64url'); }

function json(res, code, obj, req = null) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, corsHeaders(req || res.__req)));
  res.end(body);
}

async function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('gövde çok büyük')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('geçersiz JSON')); }
    });
    req.on('error', reject);
  });
}

/* Basit hız sınırı: IP başına dakikada N istek */
const buckets = new Map();
function rateLimit(ip, max = 240) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++;
  buckets.set(ip, b);
  return b.n <= max;
}

function auth(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/.exec(h);
  if (!m) return null;
  return db.accounts[m[1]] ? { token: m[1], acc: db.accounts[m[1]] } : null;
}

/* ---------------- Canlı düello odaları ---------------- */
const rooms = new Map();   // code -> { code, players:[], moves:[], createdAt, clients:Set }
const ROOM_TTL = 45 * 60 * 1000;

function roomBroadcast(room, event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of room.clients) {
    try { res.write(payload); } catch (e) { /* bağlantı koptu */ }
  }
}
function pruneRooms() {
  const now = Date.now();
  for (const [k, r] of rooms) {
    if (now - r.createdAt > ROOM_TTL) {
      for (const res of r.clients) { try { res.end(); } catch (e) {} }
      rooms.delete(k);
    }
  }
}

/* ---------------- API ---------------- */
async function handleApi(req, res, url) {
  // json() çağrılarının hepsi CORS başlığı alsın diye isteği bağla
  res.__req = req;
  const yol0 = url.pathname;

  /* Tarayıcı ön kontrolü (preflight): JSON gönderen isteklerde önce
     OPTIONS gelir. Cevap verilmezse tarayıcı asıl isteği HİÇ göndermez. */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  /* Sağlık ucu — yayında olduğunu doğrulamak ve izlemek için */
  if (yol0 === '/api/health') {
    return json(res, 200, {
      ok: true, servis: 'ada-macerasi', surum: '1.0',
      oda: rooms.size, zaman: new Date().toISOString()
    });
  }
  const p = url.pathname;
  const ip = req.socket.remoteAddress || '?';
  if (!rateLimit(ip)) return json(res, 429, { error: 'Çok fazla istek, biraz bekle.' });

  /* Kayıt */
  if (p === '/api/register' && req.method === 'POST') {
    const b = await readBody(req);
    const nick = normNick(b.nick), code = normCode(b.classCode), pin = String(b.pin || '');
    if (nick.length < 2) return json(res, 400, { error: 'Takma ad en az 2 harf olmalı.' });
    if (!/^\d{4}$/.test(pin)) return json(res, 400, { error: 'PIN 4 haneli sayı olmalı.' });
    const key = acctKey(nick, code);
    if (db.accounts[key] || db.accounts[key] === undefined && Object.keys(db.accounts).some((k) => k === key)) {
      return json(res, 409, { error: 'Bu takma ad bu sınıfta kayıtlı. Giriş yap.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const token = newToken();
    db.accounts[token] = { nick, classCode: code, salt, pinHash: hashPin(pin, salt), avatar: String(b.avatar || '').slice(0, 8), createdAt: Date.now(), token };
    // Aynı (nick,code) için ikinci token üretilmesin
    for (const [t, a] of Object.entries(db.accounts)) {
      if (t !== token && acctKey(a.nick, a.classCode) === key) delete db.accounts[t];
    }
    saveDbSoon();
    return json(res, 200, { token, profile: { nick, classCode: code } });
  }

  /* Giriş */
  if (p === '/api/login' && req.method === 'POST') {
    const b = await readBody(req);
    const key = acctKey(b.nick, b.classCode);
    const found = Object.entries(db.accounts).find(([, a]) => acctKey(a.nick, a.classCode) === key);
    if (!found) return json(res, 404, { error: 'Hesap bulunamadı. Önce kayıt ol.' });
    const [oldToken, acc] = found;
    if (hashPin(String(b.pin || ''), acc.salt) !== acc.pinHash) return json(res, 401, { error: 'PIN yanlış.' });
    const token = newToken();
    delete db.accounts[oldToken];
    acc.token = token;
    db.accounts[token] = acc;
    saveDbSoon();
    return json(res, 200, { token, profile: { nick: acc.nick, classCode: acc.classCode, avatar: acc.avatar } });
  }

  /* İlerleme yaz */
  if (p === '/api/progress' && req.method === 'POST') {
    const s = auth(req);
    if (!s) return json(res, 401, { error: 'Yetkisiz.' });
    const b = await readBody(req);
    const key = acctKey(s.acc.nick, s.acc.classCode);
    const cur = db.progress[key] || {};
    // Yıldızlar geri gitmesin: birleştir (en yükseği koru)
    const results = Object.assign({}, cur.results || {});
    for (const [lid, r] of Object.entries(b.results || {})) {
      const eski = results[lid] || { stars: 0, best: 0, plays: 0 };
      results[lid] = {
        stars: Math.max(eski.stars || 0, r?.stars || 0),
        best: Math.max(eski.best || 0, r?.best || 0),
        plays: (eski.plays || 0) + (r?.plays || 0)
      };
    }
    const st = cur.stats || {};
    const nb = b.stats || {};
    const byTable = mergeCounters(st.byTable, nb.byTable);
    const byShape = mergeCounters(st.byShape, nb.byShape);
    db.progress[key] = {
      nick: s.acc.nick, classCode: s.acc.classCode, avatar: s.acc.avatar,
      results,
      stats: {
        plays: (st.plays || 0), correct: Math.max(st.correct || 0, nb.correct || 0),
        wrong: Math.max(st.wrong || 0, nb.wrong || 0),
        byTable, byShape,
        bestStreak: Math.max(st.bestStreak || 0, nb.bestStreak || 0)
      },
      coins: Math.max(cur.coins || 0, b.coins || 0),
      updatedAt: Date.now()
    };
    saveDbSoon();
    return json(res, 200, { ok: true, savedAt: db.progress[key].updatedAt });
  }

  /* İlerleme oku */
  if (p === '/api/progress' && req.method === 'GET') {
    const s = auth(req);
    if (!s) return json(res, 401, { error: 'Yetkisiz.' });
    const key = acctKey(url.searchParams.get('nick') || s.acc.nick, url.searchParams.get('classCode') || s.acc.classCode);
    return json(res, 200, db.progress[key] || null);
  }

  /* Sınıf tablosu */
  if (p === '/api/board' && req.method === 'GET') {
    const s = auth(req);
    if (!s) return json(res, 401, { error: 'Yetkisiz.' });
    const code = normCode(url.searchParams.get('classCode') || s.acc.classCode);
    const rows = Object.entries(db.progress)
      .filter(([k]) => k.startsWith(code + '|'))
      .map(([, v]) => ({
        nick: v.nick, avatar: v.avatar,
        stars: Object.values(v.results || {}).reduce((a, r) => a + (r.stars || 0), 0),
        coins: v.coins || 0,
        correct: v.stats?.correct || 0
      }))
      .sort((a, b) => b.stars - a.stars || b.correct - a.correct);
    return json(res, 200, { classCode: code, rows });
  }

  /* Düello: oda kur */
  if (p === '/api/duel/create' && req.method === 'POST') {
    const s = auth(req);
    if (!s) return json(res, 401, { error: 'Yetkisiz.' });
    pruneRooms();
    let code = roomCode();
    while (rooms.has(code)) code = roomCode();
    const room = { code, players: [{ nick: s.acc.nick, avatar: s.acc.avatar, ready: false }], moves: [], createdAt: Date.now(), clients: new Set() };
    rooms.set(code, room);
    return json(res, 200, { roomCode: code, players: room.players });
  }

  /* Düello: katıl */
  if (p === '/api/duel/join' && req.method === 'POST') {
    const s = auth(req);
    if (!s) return json(res, 401, { error: 'Yetkisiz.' });
    const b = await readBody(req);
    const code = String(b.roomCode || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: 'Oda bulunamadı. Kodu kontrol et.' });
    if (room.players.length >= 2 && !room.players.some((x) => x.nick === s.acc.nick)) {
      return json(res, 409, { error: 'Oda dolu.' });
    }
    if (!room.players.some((x) => x.nick === s.acc.nick)) {
      room.players.push({ nick: s.acc.nick, avatar: s.acc.avatar, ready: false });
    }
    roomBroadcast(room, { type: 'joined', players: room.players });
    return json(res, 200, { roomCode: code, players: room.players });
  }

  /* Düello: hamle */
  if (p === '/api/duel/move' && req.method === 'POST') {
    const s = auth(req);
    if (!s) return json(res, 401, { error: 'Yetkisiz.' });
    const b = await readBody(req);
    const room = rooms.get(String(b.roomCode || '').toUpperCase());
    if (!room) return json(res, 404, { error: 'Oda yok.' });
    const move = { nick: s.acc.nick, ...(b.move || {}), at: Date.now() };
    room.moves.push(move);
    if (room.moves.length > 400) room.moves.shift();
    roomBroadcast(room, { type: 'move', move });
    return json(res, 200, { ok: true });
  }

  /* Düello: canlı olay akışı (SSE) */
  if (p === '/api/duel/stream' && req.method === 'GET') {
    const code = String(url.searchParams.get('roomCode') || '').toUpperCase();
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: 'Oda yok.' });
    res.writeHead(200, Object.assign({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }, corsHeaders(req)));
    res.write(`data: ${JSON.stringify({ type: 'hello', code, players: room.players })}\n\n`);
    room.clients.add(res);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch (e) {} }, 20000);
    req.on('close', () => { clearInterval(ping); room.clients.delete(res); });
    return;
  }

  return json(res, 404, { error: 'Bilinmeyen uç.' });
}

function mergeCounters(a = {}, b = {}) {
  const out = Object.assign({}, a);
  for (const [k, v] of Object.entries(b || {})) {
    const e = out[k] || { c: 0, w: 0 };
    out[k] = { c: Math.max(e.c || 0, v?.c || 0), w: Math.max(e.w || 0, v?.w || 0) };
  }
  return out;
}

/* ---------------- Statik dosya sunumu ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.join(ROOT, rel);
  // Dizin kaçışı koruması
  if (!full.startsWith(ROOT)) return json(res, 403, { error: 'Yasak.' });
  try {
    const st = await fsp.stat(full);
    if (st.isDirectory()) return serveStatic(req, res, new URL(rel + '/index.html', 'http://x'));
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'X-Content-Type-Options': 'nosniff',
      // Oyun dosyaları sık değişir → doğrulamalı önbellek
      'Cache-Control': ext === '.jpg' || ext === '.png' ? 'public, max-age=86400' : 'public, max-age=0, must-revalidate'
    });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 — bulunamadı');
  }
}

/* ---------------- Sunucu ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: e.message || 'İstek hatası' });
  }
});

await loadDb();
setInterval(pruneRooms, 5 * 60 * 1000).unref?.();

server.listen(PORT, HOST, () => {
  console.log(`Ada Macerası sunucusu → http://${HOST}:${PORT}`);
  console.log(`Oyun:      http://${HOST}:${PORT}/`);
  console.log(`API tabanı: http://${HOST}:${PORT}  (oyunda: localStorage['ada.api'] = bu adres)`);
});
