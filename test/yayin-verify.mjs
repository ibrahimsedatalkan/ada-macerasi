/* YAYIN HAZIRLIĞI testleri — CORS, sağlık ucu, preflight
   NEDEN: Oyun GitHub Pages'te (https) çalışır; sunucu farklı bir kaynakta.
   Tarayıcı, CORS başlığı olmayan isteği REDDEDER. Bu testler yayına
   çıkmadan önce o engelin kalktığını doğrular. */
import { result } from './cdp.mjs';

const SUNUCU = process.env.SUNUCU || 'http://127.0.0.1:8787';
const KAYNAK = 'https://ibrahimsedatalkan.github.io';
let pass = 0, fail = 0;
const T = (n, ok, d = '') => { result(n, ok, d); ok ? pass++ : fail++; };

const iste = async (yol, secenek = {}) => {
  try {
    const r = await fetch(SUNUCU + yol, secenek);
    const basliklar = {};
    r.headers.forEach((v, k) => { basliklar[k.toLowerCase()] = v; });
    let govde = null;
    try { govde = await r.json(); } catch (e) { govde = null; }
    return { ok: true, status: r.status, basliklar, govde };
  } catch (e) {
    return { ok: false, hata: String(e) };
  }
};

/* ---- 1) Sunucu ayakta mı + sağlık ucu ---- */
const saglik = await iste('/api/health');
T('Sunucu ayakta ve sağlık ucu var', saglik.ok && saglik.status === 200, `durum=${saglik.status}`);
T('Sağlık ucu servis bilgisi dönüyor',
  saglik.govde?.ok === true && !!saglik.govde?.servis,
  JSON.stringify(saglik.govde || {}));
T('Sağlık ucu açık oda sayısı bildiriyor', typeof saglik.govde?.oda === 'number',
  `oda=${saglik.govde?.oda}`);

/* ---- 2) CORS başlığı doğru kaynağı yansıtıyor mu? ---- */
const cors = await iste('/api/health', { headers: { Origin: KAYNAK } });
T('CORS: Access-Control-Allow-Origin başlığı var',
  cors.basliklar?.['access-control-allow-origin'] === KAYNAK,
  `gelen=${cors.basliklar?.['access-control-allow-origin']}`);
T('CORS: izin verilen metotlar bildiriliyor',
  /POST/.test(cors.basliklar?.['access-control-allow-methods'] || ''),
  cors.basliklar?.['access-control-allow-methods']);
T('CORS: Vary: Origin (önbellek güvenliği)',
  /origin/i.test(cors.basliklar?.vary || ''), cors.basliklar?.vary);

/* ---- 3) OPTIONS preflight (JSON gönderen isteklerin ön şartı) ---- */
const pre = await iste('/api/duel/create', {
  method: 'OPTIONS',
  headers: { Origin: KAYNAK, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
});
T('OPTIONS preflight 204 dönüyor', pre.ok && pre.status === 204, `durum=${pre.status}`);
T('Preflight cevabında CORS başlığı var',
  pre.basliklar?.['access-control-allow-origin'] === KAYNAK,
  `gelen=${pre.basliklar?.['access-control-allow-origin']}`);

/* ---- 4) Bilinmeyen kaynak: beyaz liste dışına çıkmıyor mu? ---- */
const yabanci = await iste('/api/health', { headers: { Origin: 'https://kotu-site.example' } });
const izinli = yabanci.basliklar?.['access-control-allow-origin'] || '';
T('Beyaz liste dışı kaynak KENDİSİ olarak yansıtılmıyor (güvenlik)',
  izinli !== 'https://kotu-site.example',
  `yansıtılan=${izinli}`);

/* ---- 5) Gerçek düello akışı CORS'lu çalışıyor mu? (uçtan uca) ---- */
const olustur = await iste('/api/duel/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: KAYNAK },
  body: JSON.stringify({ nick: 'YayinTest', classCode: '2Y' })
});
T('Düello odası CORS ile oluşturulabiliyor',
  olustur.ok && (olustur.status === 200 || olustur.status === 401),
  `durum=${olustur.status} — ${JSON.stringify(olustur.govde || {}).slice(0, 80)}`);
T('Düello cevabında CORS başlığı var',
  olustur.basliklar?.['access-control-allow-origin'] === KAYNAK,
  `gelen=${olustur.basliklar?.['access-control-allow-origin']}`);

/* ---- 6) Deploy dosyaları eksiksiz mi? ---- */
const { existsSync, readFileSync } = await import('fs');
T('systemd kurulum betiği var', existsSync('server/setup-server.sh'));
T('Yayın rehberi var', existsSync('server/DEPLOY.md'));
T('Kurulum betiği çalıştırılabilir',
  existsSync('server/setup-server.sh') && (readFileSync('server/setup-server.sh', 'utf8').includes('systemctl')));

const deploy = existsSync('server/DEPLOY.md') ? readFileSync('server/DEPLOY.md', 'utf8') : '';
T('Rehber HTTPS zorunluluğunu açıklıyor', /mixed content|https/i.test(deploy));
T('Rehber SSE tampon ayarını içeriyor (proxy_buffering off)', /proxy_buffering off/.test(deploy));
T('Rehber CORS sorun gidermeyi içeriyor', /ALLOWED_ORIGINS/.test(deploy));

console.log(`\n=== ${pass} geçti / ${fail} kaldı ===`);
process.exit(fail ? 1 : 0);
