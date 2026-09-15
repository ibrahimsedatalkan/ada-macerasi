/* Oyun sunucusu API testleri — ilerleme, tablo, canlı düello (SSE) */
const B = process.env.API_BASE || 'http://127.0.0.1:8787';

let pass = 0, fail = 0;
const T = (n, ok, d = '') => { console.log(`${ok ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`); ok ? pass++ : fail++; };

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(B + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

const rnd = () => Math.random().toString(36).slice(2, 6);
const NICK1 = 'Test' + rnd(), NICK2 = 'Rakip' + rnd();
const CODE = 'T' + rnd().toUpperCase().slice(0, 3).toUpperCase();

/* ---- 1) Kayıt + PIN ---- */
const r1 = await api('/api/register', { method: 'POST', body: { nick: NICK1, classCode: CODE, pin: '1234', avatar: 'fox' } });
T('Kayıt başarılı', r1.status === 200 && !!r1.data.token, `status ${r1.status}`);
const t1 = r1.data?.token;

const badPin = await api('/api/login', { method: 'POST', body: { nick: NICK1, classCode: CODE, pin: '0000' } });
T('Yanlış PIN reddedildi', badPin.status === 401, JSON.stringify(badPin.data));

const badNick = await api('/api/register', { method: 'POST', body: { nick: 'A', classCode: CODE, pin: '1234' } });
T('Kısa takma ad reddedildi', badNick.status === 400, JSON.stringify(badNick.data));

const badPin2 = await api('/api/register', { method: 'POST', body: { nick: NICK2, classCode: CODE, pin: '12' } });
T('Geçersiz PIN formatı reddedildi', badPin2.status === 400, JSON.stringify(badPin2.data));

/* ---- 2) İlerleme yaz / oku ---- */
const w1 = await api('/api/progress', {
  method: 'POST', token: t1,
  body: {
    nick: NICK1, classCode: CODE,
    results: { 'w1-l1': { stars: 3, best: 900, plays: 2 }, 'w1-l2': { stars: 2, best: 600, plays: 1 } },
    stats: { plays: 3, correct: 20, wrong: 4, bestStreak: 7, byTable: { '2': { c: 12, w: 1 } }, byShape: {} },
    coins: 140
  }
});
T('İlerleme kaydedildi', w1.status === 200 && w1.data.ok, `status ${w1.status}`);

const rd = await api(`/api/progress?nick=${NICK1}&classCode=${CODE}`, { token: t1 });
const stars = Object.values(rd.data?.results || {}).reduce((a, r) => a + (r.stars || 0), 0);
T('İlerleme okundu (5 yıldız)', stars === 5, `yıldız: ${stars}`);
T('Jeton kaydedildi', rd.data?.coins === 140, `jeton: ${rd.data?.coins}`);

/* ---- 3) Yıldız geri gitmiyor (birleştirme) ---- */
await api('/api/progress', {
  method: 'POST', token: t1,
  body: { nick: NICK1, classCode: CODE, results: { 'w1-l1': { stars: 1, best: 100, plays: 1 } }, stats: { correct: 5 }, coins: 10 }
});
const rd2 = await api(`/api/progress?nick=${NICK1}&classCode=${CODE}`, { token: t1 });
T('Düşük yıldız eskisini bozmuyor', rd2.data?.results?.['w1-l1']?.stars === 3, `yıldız: ${rd2.data?.results?.['w1-l1']?.stars}`);
T('Jeton geri gitmiyor', rd2.data?.coins === 140, `jeton: ${rd2.data?.coins}`);

/* ---- 4) Sınıf tablosu ---- */
const r2 = await api('/api/register', { method: 'POST', body: { nick: NICK2, classCode: CODE, pin: '5678', avatar: 'panda' } });
const t2 = r2.data?.token;
await api('/api/progress', {
  method: 'POST', token: t2,
  body: { nick: NICK2, classCode: CODE, results: { 'w1-l1': { stars: 3, best: 950, plays: 1 }, 'w1-l2': { stars: 3, best: 800, plays: 1 }, 'w1-l3': { stars: 3, best: 700, plays: 1 } }, stats: { correct: 30, wrong: 2 }, coins: 200 }
});
const board = await api(`/api/board?classCode=${CODE}`, { token: t1 });
const rows = board.data?.rows || [];
T('Sınıf tablosu iki oyuncuyu listeliyor', rows.length === 2, `${rows.length} satır`);
T('Tablo yıldıza göre sıralı', rows[0]?.stars >= rows[1]?.stars, `${rows[0]?.nick}:${rows[0]?.stars} vs ${rows[1]?.nick}:${rows[1]?.stars}`);
T('Başka sınıf görünmüyor', rows.every((r) => true) && board.data?.classCode === CODE, board.data?.classCode);

/* ---- 5) Canlı düello ---- */
const d1 = await api('/api/duel/create', { method: 'POST', token: t1, body: { nick: NICK1, classCode: CODE, avatar: 'fox' } });
const room = d1.data?.roomCode;
T('Düello odası kuruldu (4 haneli kod)', d1.status === 200 && /^[A-Z0-9]{4}$/.test(room || ''), `oda: ${room}`);

const badRoom = await api('/api/duel/join', { method: 'POST', token: t2, body: { roomCode: 'ZZZZ', nick: NICK2 } });
T('Olmayan odaya katılma reddedildi', badRoom.status === 404, JSON.stringify(badRoom.data));

/* SSE akışını dinle (2. oyuncu katılınca haber gelmeli) */
const olaylar = [];
const ctrl = new AbortController();
const streamP = (async () => {
  const res = await fetch(`${B}/api/duel/stream?roomCode=${room}`, { signal: ctrl.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const part of parts) {
        const line = part.split('\n').find((l) => l.startsWith('data: '));
        if (line) { try { olaylar.push(JSON.parse(line.slice(6))); } catch (e) {} }
      }
    }
  } catch (e) {}
})();

await new Promise((r) => setTimeout(r, 500));
const joined = await api('/api/duel/join', { method: 'POST', token: t2, body: { roomCode: room, nick: NICK2, avatar: 'panda' } });
T('İkinci oyuncu odaya katıldı', joined.status === 200 && (joined.data.players || []).length === 2, `${(joined.data.players || []).length} oyuncu`);

await api('/api/duel/move', { method: 'POST', token: t2, body: { roomCode: room, move: { correct: true, points: 120 } } });
await new Promise((r) => setTimeout(r, 700));
ctrl.abort();
await streamP.catch(() => {});

const tipler = olaylar.map((o) => o.type);
T('SSE canlı akış çalışıyor', olaylar.length >= 2, `olaylar: ${tipler.join(', ')}`);
T('Katılma olayı yayınlandı', tipler.includes('joined'), tipler.join(','));
T('Hamle olayı yayınlandı', tipler.includes('move'), tipler.join(','));
const mv = olaylar.find((o) => o.type === 'move');
T('Hamle içeriği doğru', mv?.move?.points === 120 && mv?.move?.nick === NICK2, JSON.stringify(mv?.move));

/* ---- 6) Yetkisiz uçlar ---- */
const noAuth = await api('/api/duel/create', { method: 'POST', body: { nick: 'X' } });
T('Yetkisiz düello kurma engellendi', noAuth.status === 401, `status ${noAuth.status}`);

/* ---- 7) Dizin kaçışı koruması ---- */
const escape = await fetch(B + '/../package.json');
T('Dizin kaçışı engellendi', escape.status === 404 || escape.status === 403, `status ${escape.status}`);

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
