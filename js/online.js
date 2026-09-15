/* ============================================================
   online.js — sunucu adaptörü (AŞAMA 2)
   Şu an: API_BASE boşsa oyun tamamen çevrimdışı çalışır.
   Sunucu kurulduğunda: localStorage'a 'ada.api' = 'https://...'
   yazılınca kayıt, ilerleme senkronu, sınıf tablosu ve canlı
   düello uçları devreye girer. Aynı arayüz, iki mod.
   ============================================================ */

const API_KEY = 'ada.api';

export function apiBase() {
  try { return localStorage.getItem(API_KEY) || ''; } catch (e) { return ''; }
}
export function setApiBase(url) {
  try {
    if (url) localStorage.setItem(API_KEY, url.replace(/\/$/, ''));
    else localStorage.removeItem(API_KEY);
  } catch (e) {}
}
export function isConfigured() { return !!apiBase(); }

async function call(path, { method = 'GET', body, token, timeout = 6000 } = {}) {
  const base = apiBase();
  if (!base) throw new Error('offline');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(base + path, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  } finally {
    clearTimeout(t);
  }
}

/* ---------- Hesap (takma ad + sınıf kodu + 4 haneli PIN) ---------- */
export async function register({ nick, classCode, pin, avatar }) {
  return call('/api/register', { method: 'POST', body: { nick, classCode, pin, avatar } });
}
export async function login({ nick, classCode, pin }) {
  return call('/api/login', { method: 'POST', body: { nick, classCode, pin } });
}

/* ---------- İlerleme senkronu ---------- */
export async function pushProgress(profile, token) {
  return call('/api/progress', {
    method: 'POST', token,
    body: { nick: profile.nick, classCode: profile.classCode, results: profile.results, stats: profile.stats, coins: profile.coins, updatedAt: profile.updatedAt }
  });
}
export async function pullProgress({ nick, classCode }, token) {
  return call(`/api/progress?nick=${encodeURIComponent(nick)}&classCode=${encodeURIComponent(classCode)}`, { token });
}

/* ---------- Sınıf liderlik tablosu ---------- */
export async function classBoard(classCode, token) {
  return call(`/api/board?classCode=${encodeURIComponent(classCode)}`, { token });
}

/* ---------- Canlı düello (SSE + REST; ek bağımlılık yok) ---------- */
export async function duelCreate({ nick, classCode, avatar }, token) {
  return call('/api/duel/create', { method: 'POST', token, body: { nick, classCode, avatar } });
}
export async function duelJoin({ roomCode, nick, avatar }, token) {
  return call('/api/duel/join', { method: 'POST', token, body: { roomCode, nick, avatar } });
}
export async function duelMove({ roomCode, move }, token) {
  return call('/api/duel/move', { method: 'POST', token, body: { roomCode, move } });
}

/** Sunucudan gelen olayları dinle (Server-Sent Events) */
export function duelStream(roomCode, { onEvent, onError } = {}) {
  if (!isConfigured()) return { close() {} };
  const es = new EventSource(apiBase() + '/api/duel/stream?roomCode=' + encodeURIComponent(roomCode));
  es.onmessage = (e) => { try { onEvent?.(JSON.parse(e.data)); } catch (err) {} };
  es.onerror = (e) => onError?.(e);
  return es;
}

/* ---------- Çevrimdışı yedek: her istek güvenli şekilde başarısız olur ---------- */
export async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { return typeof fallback === 'function' ? fallback(e) : fallback; }
}
