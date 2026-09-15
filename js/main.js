/* ============================================================
   main.js — akış: giriş → harita → bölüm → oyun → sonuç
   Engine sözleşmesi (her oyun modülü aynı arayüzü kullanır):
     createXGame({ root, level, api }) → { start(), destroy() }
   api: { speak, sfx, confetti, toast, recordAnswer, finish, profile }
   ============================================================ */

import { WORLDS, findWorld, findLevel, TYPE_LABEL, levelTopics } from './worlds.js';
import * as S from './state.js';
import { el, clear, dialog, confirmBox, toast, confetti, starsEl, mascot, mascotHTML, avatarHTML, avatarInline, esc, randInt, shuffle, canlandir, avatarSevin, avatarUzul, avatarDusun, maskotCanlandir } from './ui.js';
import { audio, sfx, speak, stopSpeaking, unlockAudio, toggleMusic, startMusic, stopMusic, setSpeechRate, getSpeechRate, preloadSpeech, sayGreeting } from './audio.js';
import { createMultiplyGame } from './games/multiply.js';
import { muzikBaslat, muzikModu, muzikYogunluk, muzikDurdur, muzikCaliyor, zaferFanfari, odulParlitisi } from './music.js';
import { titretDogru, titretYanlis, titretKombo, titretTrofe, titretDokun, konusmaDurumu, ortamBaslat, ortamDurdur } from './his.js';
import * as C from './collect.js';
import { createSidesGame } from './games/sides.js';
import { createShapeHuntGame } from './games/shapehunt.js';
import { createDrawGame } from './games/draw.js';
import { createBossGame } from './games/boss.js';
import { createDuel } from './duel.js';
import { createAddSubGame } from './games/addsub.js';
import { createDuelOnline } from './duel-online.js';
import * as online from './online.js';
import { Journey, expectedSteps } from './journey.js';
import { buildAdvice, adviceToText } from './advice.js';
import { SHAPE_LESSONS, GEO_INTRO, dersKey, practiceLevelFor } from './lessons.js';
import { shapeSVG, SHAPES } from './shapes.js';

const ACTIVE_KEY = 'ada.active.v2';
const ENGINE_BY_TYPE = {
  multiply: createMultiplyGame,
  addsub: createAddSubGame,
  sides: createSidesGame,
  shapehunt: createShapeHuntGame,
  draw: createDrawGame,
  boss: createBossGame
};

let profile = null;
let selamlandi = false;   // kişisel karşılama oturumda bir kez
let settings = S.loadSettings();
let currentEngine = null;
let currentLevel = null;
let journey = null;
let screenNow = 'login';

/* ---------------- yardımcılar ---------------- */
const screenEl = (name) => document.querySelector(`.screen[data-screen="${name}"]`);

function showScreen(name) {
  screenNow = name;
  document.body.dataset.view = name;
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.dataset.screen === name);
  clear(screenEl(name));
  return screenEl(name);
}

function updateHud() {
  const stars = profile ? S.totalStars(profile) : 0;
  document.getElementById('hud-stars').textContent = '★ ' + stars;
  document.getElementById('hud-coins').textContent = '● ' + (profile?.coins || 0);
  document.getElementById('hud-nick').textContent = profile?.nick || 'Oyuncu';
  // HUD avatarı da giydirilmiş hâlde — çocuk aksesuarını her ekranda görsün
  const hudAv = document.getElementById('hud-avatar');
  hudAv.innerHTML = profile
    ? C.avatarDressed(profile, { size: 30, avatarHTML })
    : avatarHTML('🦊', { size: 28 });
  hudAv.classList.add('canli');          // karakter sürekli nefes alsın (statik durmasın)
  document.getElementById('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
  document.getElementById('btn-voice').setAttribute('aria-pressed', String(!!settings.voice));
  document.getElementById('btn-music').setAttribute('aria-pressed', String(!!settings.music));
  document.getElementById('btn-bigtext').setAttribute('aria-pressed', String(!!settings.bigText));
}

function persistSettings() {
  S.saveSettings(settings);
  audio.sound = settings.sound;
  audio.voice = settings.voice;
  if (settings.music) { if (!audio.music) startMusic(); } else if (audio.music) stopMusic();
  applyTextSize();
  applyFreeMode();
  applySpeechSpeed();
  updateHud();
}

/** Büyük yazı ayarı — görme güçlüğü olan çocuklar için (ölçek %18 büyür) */
function applyTextSize() {
  document.body.classList.toggle('big-text', !!settings.bigText);
}

/** Serbest Mod — veli açarsa tüm bölümler kilitsiz açılır */
/**
 * ZORLUK — konsol oyunları oyuna başlarken zorluk sorar.
 * Çocuğun seviyesine göre can sayısı ve süre ayarlanır.
 */
export const ZORLUKLAR = {
  kolay:  { ad: 'Kolay',  can: 5, sure: 'off',    aciklama: 'Bol can, süre yok — yeni başlayanlar' },
  normal: { ad: 'Normal', can: 3, sure: 'normal', aciklama: 'Dengeli — önerilen' },
  zor:    { ad: 'Zor',    can: 2, sure: 'tight',  aciklama: 'Az can, kısa süre — ustalar' }
};

/**
 * ZORLUK SEÇİMİ EKRANI — konsol oyunları oyuna başlarken zorluk sorar.
 * İlk oyunda otomatik açılır; sonra Veli Paneli'nden değiştirilir.
 */
function zorlukSecimi(ilkKez = false) {
  const simdi = settings.difficulty || 'normal';
  const secenekler = Object.entries(ZORLUKLAR).map(([id, z]) =>
    el('button', {
      class: 'zorluk-kart' + (id === simdi ? ' secili' : ''),
      onClick: () => {
        settings.difficulty = id;
        settings.zorlukSecildi = true;
        persistSettings();
        sfx('unlock');
        close();
        toast(`Zorluk: ${z.ad}`);
        renderMap();
      }
    },
      el('div', { class: 'zk-ad', text: z.ad }),
      el('div', { class: 'zk-can', text: '❤️'.repeat(z.can) }),
      el('div', { class: 'zk-aciklama', text: z.aciklama })
    ));

  dialog(el('div', { class: 'center zorluk-dialog' },
    el('h2', { text: ilkKez ? 'Zorluk seç' : 'Zorluk' }),
    el('p', { class: 'muted', text: ilkKez
      ? 'Bu ayarı sonra Veli Paneli\'nden değiştirebilirsin.'
      : 'Çocuğunun seviyesine göre seç.' }),
    el('div', { class: 'zorluk-grid' }, ...secenekler),
    ilkKez ? el('span') : el('div', { class: 'btn-row', style: { justifyContent: 'center' } },
      el('button', { class: 'btn ghost sm', text: 'Kapat', onClick: () => close() }))
  ));
}

function applyFreeMode() {
  S.setFreeMode(!!settings.freeMode);
}

/** Konuşma hızı — kayıtlı ayarı ses motoruna uygula */
function applySpeechSpeed() {
  const v = Number(settings.speechSpeed);
  setSpeechRate(Number.isFinite(v) && v > 0 ? v : 0.72);
}

/**
 * Zaman baskısı ayarı — aile seçer.
 *   'off'    → süre yok (kaygılı çocuklar için)
 *   'normal' → bölümün kendi süresi
 *   'tight'  → %20 kısa (meydan okuma isteyenler için)
 * Oyun mantığı değişmez, yalnızca süre ayarlanır.
 */
/**
 * Bölüm ayarını aile ayarlarına göre uyarla:
 *   1) Süre modu (Velî Paneli → Zaman baskısı): kapalı / normal / sıkı
 *   2) Zorluk (Kolay / Normal / Zor): can sayısı + süre
 * İkisi birlikte uygulanır; erken dönüş YOK — aksi hâlde zorluk atlanır.
 */
export function withTimeMode(level) {
  const cfg = Object.assign({}, level.cfg || {});

  // 1) Süre modu
  const mod = settings?.timeMode || 'normal';
  if (mod === 'off') {
    cfg.time = 0;
    cfg.timePerQ = 0;
  } else if (mod === 'tight') {
    if (cfg.time) cfg.time = Math.max(6, Math.round(cfg.time * 0.8));
    if (cfg.timePerQ) cfg.timePerQ = Math.max(6, Math.round(cfg.timePerQ * 0.8));
  }

  // 2) Zorluk (can + süre) — her zaman uygulanır
  const z = ZORLUKLAR[settings?.difficulty] || ZORLUKLAR.normal;
  if (cfg.lives != null) cfg.lives = z.can;                    // net can sayısı
  if (z.sure === 'off') { cfg.time = 0; cfg.timePerQ = 0; }    // Kolay: süre yok
  else if (z.sure === 'tight') {
    if (cfg.time) cfg.time = Math.max(6, Math.round(cfg.time * 0.75));
    if (cfg.timePerQ) cfg.timePerQ = Math.max(6, Math.round(cfg.timePerQ * 0.75));
  }

  return Object.assign({}, level, { cfg });
}

function setActive(nick, classCode) {
  try { localStorage.setItem(ACTIVE_KEY, JSON.stringify({ nick, classCode })); } catch (e) {}
}
function getActive() {
  try { return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null'); } catch (e) { return null; }
}
function clearActive() { try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {} }

const api = {
  get profile() { return profile; },
  speak: (t, opts) => speak(t, opts),
  sfx: (n) => sfx(n),
  confetti: (o) => confetti(o),
  toast: (m) => toast(m),
  recordAnswer: (a) => {
    if (profile) S.recordAnswer(profile, a);
    // KARAKTER TEPKİSİ — konsol oyunlarında karakter her olaya cevap verir
    const hud = document.getElementById('hud-avatar');
    if (hud) { if (a.correct) avatarSevin(hud, 1); else avatarUzul(hud); }
    // HAPTİK — mobilde titreşim (PS5 DualSense'in karşılığı)
    if (a.correct) titretDogru(); else titretYanlis();
    // GÜNLÜK GÖREV yalnız DOĞRU cevaplarla ilerler
    if (profile && a.correct) {
      const odul = S.gorevIlerlet(profile, 1);
      if (odul) {
        setTimeout(() => {                 // görev tamamlandı — konsol hissi
          confetti({ count: 80 });
          try { odulParlitisi(); } catch (e) {}
          toast(`🎯 Günlük görev tamam! +${odul.odul} jeton`);
          updateHud();
        }, 650);
      }
    }
    if (!journey) return;
    if (currentLevel?.level?.type === 'draw') return;   // çizimde ilerleme kapsama oranına bağlı
    if (a.correct) { journey.advance(); sfx('step'); } else { journey.stumble(); }
  },
  journeyProgress: (fraction) => journey?.setProgress(fraction),
  saveProfile: () => { if (profile) S.saveProfile(profile); },
  finish: (result) => finishLevel(result)
};

/* ---------------- 1) GİRİŞ ---------------- */
/**
 * AÇILIŞ EKRANI — konsol oyunlarındaki yükleme ekranı + ipucu.
 * Hem atmosfer kurar hem de çocuğa oyunu öğretir (ipuçları dönüşümlü).
 */
const ACILIS_IPUCLARI = [
  'İpucu: "Nasıl düşünmeliyim?" düğmesi cevabı söylemez — sana yöntem öğretir.',
  'İpucu: Bir soruyu kaçırdıysan "Soruyu tekrar dinle" düğmesine bas.',
  'İpucu: Üst üste doğru yaparsan müzik coşar ve kombo yazısı çıkar!',
  'İpucu: Her doğru cevap günlük görevini ilerletir ve jeton kazandırır.',
  'İpucu: Trofe Odası\'nda bronz, gümüş, altın ve PLATİN trofeler var.',
  'İpucu: Bölümleri 3 yıldızla bitirirsen yeni adalar açılır.',
  'İpucu: Çizim bölümlerinde noktalı kâğıdı ve okları takip et.',
  'İpucu: Dersler ekranı her zaman açık — istediğin konuyu önce öğren.'
];

/** Zayıf tablo için akıldan hesap tekniği */
const TABLO_IPUCU = {
  2: '2\'ler için: aynı sayıyı kendisiyle topla.',
  3: '3\'ler için: 3-6-9-12 diye üçer üçer say.',
  4: '4\'ler için: önce 2 ile çarp, sonucu bir daha 2 ile çarp.',
  5: '5\'ler için: 5-10-15-20 diye beşer say. Sonuç 0 ya da 5 ile biter.',
  6: '6\'lar için: 5 katı + 1 katı. Mesela 6×7 = (5×7) + 7.',
  7: '7\'ler için: 5 katı + 2 katı. Mesela 7×8 = (5×8) + (2×8).',
  8: '8\'ler için: iki kez iki katına çıkar (2→4→8).',
  9: '9\'lar için: 10 katından 1 katını çıkar. 9×7 = 70 − 7.',
  10: '10\'lar için: sona bir sıfır ekle.'
};

/**
 * KİŞİSELLEŞEN İPUCU — yükleme ekranında çocuğun kendi verisine göre
 * öneri gösterilir. Konsol oyunlarında ipuçları oyuncuya göre değişir.
 */
function kisiselIpucu() {
  const genel = () => ACILIS_IPUCLARI[Math.floor(Math.random() * ACILIS_IPUCLARI.length)];
  // Açılış ekranı, profil yüklenmeden ÖNCE çalışır — o yüzden kayıtlı
  // oyuncuyu burada kendimiz okuyoruz. Aksi hâlde ipucu hep genel kalır.
  let p = profile;
  if (!p) {
    const aktif = getActive();
    if (aktif) { try { p = S.loadProfile(aktif.nick, aktif.classCode); } catch (e) { p = null; } }
  }
  if (!p) return genel();
  const st = p.stats || {};
  const byTable = st.byTable || {};

  // 1) Zayıf tablo var mı? (en az 3 deneme, doğruluk %70 altı)
  const zayiflar = Object.entries(byTable)
    .filter(([, v]) => v.c + v.w >= 3 && v.c / (v.c + v.w) < 0.7)
    .sort((a, b) => (b[1].w - a[1].w))
    .map(([t]) => Number(t));
  if (zayiflar.length) {
    const t = zayiflar[0];
    const teknik = TABLO_IPUCU[t];
    if (teknik) return `Senin için: ${teknik}`;
  }

  // 2) İpucu bağımlılığı (cevapların yarısından çoğunda ipucu)
  const toplamCevap = (st.correct || 0) + (st.wrong || 0);
  const ipucsuzOran = toplamCevap ? (st.correctNoHint || 0) / Math.max(1, st.correct || 1) : 1;
  if (toplamCevap >= 15 && ipucsuzOran < 0.3) {
    return 'Senin için: İpucu almadan denemeyi dene — beynin daha hızlı öğrenir. Zorlanırsan ipucu hep orada.';
  }

  // 3) Güçlü gidiyorsa meydan okuma
  if (st.correct >= 40 && (st.correct / Math.max(1, toplamCevap)) >= 0.85) {
    return 'Senin için: Harika gidiyorsun! Bir zorluk seviyesi yükseltmeye hazır mısın? (Haritadaki zorluk rozeti)';
  }

  // 4) Günlük görev
  const g = S.gunlukGorev(p);
  if (g.yapilan >= g.hedef) return 'Bugünün görevi tamam! Yarın yeni bir görev var.';

  // 5) Günlük seri
  const seri = p.streak?.count || 0;
  if (seri >= 2) return `Senin için: ${seri} gündür oynuyorsun — seriyi bozma!`;

  return genel();
}

function acilisEkrani(bitti) {
  const ipucu = kisiselIpucu();
  const kat = el('div', { class: 'acilis' },
    el('div', { class: 'ac-logo' },
      el('div', { class: 'ac-maskot', html: mascotHTML(116) }),
      el('h1', { class: 'ac-ad', text: 'ADA MACERASI' }),
      el('p', { class: 'ac-alt', text: 'Sayılar ve Şekiller Adası' })
    ),
    el('div', { class: 'ac-ipucu', text: ipucu }),
    el('div', { class: 'ac-yukleniyor' }, el('i')),
    el('div', { class: 'ac-devam', text: 'Başlamak için dokun' })
  );
  document.body.append(kat);
  if (!muzikCaliyor()) muzikBaslat('menu');
  speak('Ada Macerası. Başlamak için dokun.');
  let gecti = false;
  const gec = () => {
    if (gecti) return; gecti = true;
    kat.classList.add('gidiyor');
    setTimeout(() => { kat.remove(); bitti(); }, 480);
  };
  kat.addEventListener('click', gec);
  window.addEventListener('keydown', gec, { once: true });
  setTimeout(gec, 4200);              // dokunmazsa kendi geçsin
}

function renderLogin() {
  const root = showScreen('login');
  if (!muzikCaliyor()) muzikBaslat('menu');   // tema müziği ilk ekrandan
  muzikYogunluk(1);
  // PS5 oyunlarında tema müziği İLK EKRANDAN başlar — atmosfer kurar
  if (!muzikCaliyor()) muzikBaslat('menu');
  muzikYogunluk(1);
  const panel = el('div', { class: 'panel narrow' },
    el('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } },
      el('div', { class: 'canli', html: mascotHTML(92) }),
      el('div', {},
        el('h1', { text: 'Ada Macerası' }),
        el('p', { text: 'Sayılar ve şekiller diyarında maceraya hoş geldin!' })
      )
    )
  );

  const nickInput = el('input', { type: 'text', maxlength: 14, placeholder: 'Örn: Ali', value: getActive()?.nick || '' });
  const codeInput = el('input', { type: 'text', maxlength: 8, placeholder: 'Örn: 2A', value: getActive()?.classCode || '2A' });

  let avatar = getActive()?.nick ? (S.loadProfile(getActive().nick, getActive().classCode)?.avatar || S.AVATARS[0]) : S.AVATARS[0];
  const avatarGrid = el('div', { class: 'avatar-grid' });
  const buildAvatars = () => {
    clear(avatarGrid);
    for (const a of S.AVATARS) {
      const b = el('button', { class: 'avatar-opt', type: 'button', html: avatarHTML(a, { size: 64 }), ariaPressed: avatar === a });
      b.addEventListener('click', () => { sfx('tap'); avatar = a; buildAvatars(); });
      avatarGrid.append(b);
    }
  };
  buildAvatars();

  const startBtn = el('button', {
    class: 'btn primary wide', text: '▶️ Maceraya başla', onClick: () => {
      const nick = (nickInput.value || '').trim();
      const code = (codeInput.value || '').trim();
      if (nick.length < 2) { toast('Takma adını yaz (en az 2 harf)'); nickInput.focus(); return; }
      if (code.length < 1) { toast('Sınıf kodunu yaz'); codeInput.focus(); return; }
      const existing = S.loadProfile(nick, code);
      profile = existing || S.newProfile(nick, code, avatar);
      profile.avatar = avatar;
      S.saveProfile(profile);
      setActive(profile.nick, profile.classCode);
      sfx('unlock');
      speak(`Merhaba ${profile.nick}! Maceraya hoş geldin.`);
      renderMap();
    }
  });

  const list = S.listProfiles();
  const chips = el('div', { class: 'btn-row', style: { marginTop: '4px' } });
  for (const p of list.slice(0, 6)) {
    chips.append(el('button', {
      class: 'btn ghost sm', html: `${avatarInline(p.avatar, 20)}${esc(p.nick)} ★${p.stars}`,
      onClick: () => {
        sfx('tap');
        profile = S.loadProfile(p.nick, p.classCode) || S.newProfile(p.nick, p.classCode, p.avatar);
        setActive(profile.nick, profile.classCode);
        renderMap();
      }
    }));
  }

  panel.append(
    el('div', { style: { display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', marginTop: '16px' } },
      el('div', { class: 'field' }, el('label', { text: 'Takma adın' }), nickInput),
      el('div', { class: 'field' }, el('label', { text: 'Sınıf kodu' }), codeInput)
    ),
    el('div', { class: 'field' }, el('label', { text: 'Karakterini seç' }), avatarGrid),
    startBtn,
    list.length ? el('div', {}, el('div', { class: 'field' }, el('label', { text: 'Bu cihazdaki oyuncular' })), chips) : el('span'),
    el('p', { class: 'small muted', text: 'E-posta veya kişisel bilgi istemiyoruz. Sadece takma ad ve sınıf kodu yeterli.' })
  );
  root.append(panel);

  startBtn.classList.add('tap-hint');
  nickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startBtn.click(); });
}

/* ---------------- 2) HARİTA ---------------- */
function renderMap() {
  if (!profile) return renderLogin();
  updateHud();
  const root = showScreen('map');
  const maxS = WORLDS.reduce((a, w) => a + w.levels.length * 3, 0);
  const stars = S.totalStars(profile);
  document.body.dataset.world = firstUnfinishedWorld().id;

  const head = el('div', { class: 'map-head' },
    el('div', {}, el('h1', { text: stars > 0 ? 'Maceraya devam' : 'Maceraya başla' }), el('p', { html: `${avatarInline(profile.avatar, 22)}<b>${esc(profile.nick)}</b> · Sınıf ${esc(profile.classCode)}` })),
    el('div', { class: 'grow', style: { flex: '1' } }),
    streakChip(),
    trophyChip(),
    gorevChip(),
    zorlukChip(),
    el('div', { class: 'hint-pill', text: `★ ${stars} / ${maxS}` }),
    el('button', { class: 'btn sm blue', text: '📚 Dersler', onClick: () => renderLessons() }),
    el('button', { class: 'btn sm yellow', text: '🎁 Dükkân', onClick: () => renderShop() }),
    el('button', { class: 'btn sm purple', text: '🏆 Trofeler', onClick: () => renderTrophies() }),
    el('button', { class: 'btn sm blue', text: '⚔️ Düello', onClick: () => renderDuel() }),
    el('button', { class: 'btn sm green', text: '🏅 Sınıf Tablosu', onClick: () => renderBoard() }),
    el('button', { class: 'btn sm ghost', text: '👨‍👩‍👦 Veli Paneli', onClick: () => renderParent() }),
    el('button', { class: 'btn sm ghost', text: '🔄 Oyuncu', onClick: () => { clearActive(); profile = null; renderLogin(); } })
  );

  const treasureStrip = renderTreasureStrip();

  const grid = el('div', { class: 'map-grid' });
  WORLDS.forEach((w, i) => {
    const unlocked = S.isWorldUnlocked(profile, w);
    const got = S.worldStars(profile, w);
    const max = w.levels.length * 3;
    const card = el('button', {
      class: 'world-card' + (unlocked ? '' : ' locked'), type: 'button',
      onClick: () => {
        if (!unlocked) {
          const prev = WORLDS[i - 1];
          toast(`Önce ${prev.name} son bölümünü bitir!`);
          sfx('wrong');
          return;
        }
        sfx('click');
        openWorld(w);
      }
    },
      el('div', { class: 'wc-emoji', text: w.emoji }),
      el('div', { class: 'wc-name', text: w.name }),
      el('div', { class: 'wc-desc', text: w.intro }),
      el('div', { class: 'wc-prog' }, el('i', { style: { width: Math.round((got / max) * 100) + '%' } })),
      el('div', { class: 'small muted', style: { marginTop: '6px' }, text: `★ ${got} / ${max} · ${w.levels.length} bölüm` }),
      !unlocked ? el('div', { class: 'wc-lock', text: '🔒' }) : el('span')
    );
    grid.append(card);
    card.classList.add('photo');
    card.style.backgroundImage = `linear-gradient(180deg, rgba(8,20,38,.10) 22%, rgba(8,20,38,.86)), url('assets/bg/${w.id}.jpg')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
  });

  root.append(head, treasureStrip, grid);
  try { ortamDurdur(); } catch (e) {}          // ada atmosferi bitti
  if (muzikCaliyor()) muzikModu('menu'); else muzikBaslat('menu');
  muzikYogunluk(1);

  // Kişisel karşılama — dosyalar hazırsa doğal sesle, değilse tarayıcı sesiyle
  if (!selamlandi && profile?.nick) {
    selamlandi = true;
    setTimeout(() => { sayGreeting(profile.nick).catch(() => {}); }, 700);
  }
  // ZORLUK SEÇİMİ — konsollar gibi ilk oyunda bir kez sorulur.
  // (Test hızlı modunda atlanır; zorluk-verify bunu ayrıca test eder.)
  if (!settings.zorlukSecildi && !window.__hizliMod) {
    settings.zorlukSecildi = true;
    persistSettings();
    setTimeout(() => zorlukSecimi(true), 2400);
  }

  if (!Object.keys(profile.results || {}).length) {
    setTimeout(() => speak('Haritadan bir ada seç ve maceraya başla!'), 400);
  }
}

/* ============================================================
   GÜNLÜK SERİ · HAZİNE · DÜKKÂN · ALBÜM
   ============================================================ */

/** Haritada günlük seri rozeti */
function streakChip() {
  const s = profile?.streak || { count: 0, best: 0 };
  if (!s.count) return el('span');
  const bugun = S.playedToday(profile);
  return el('div', {
    class: 'hint-pill streak' + (bugun ? ' on' : ''),
    title: `En iyi seri: ${s.best} gün${bugun ? '' : ' — bugün henüz oynamadın!'}`
  }, `🔥 ${s.count} gün`);
}

/** Pofi'nin hazine sandığı — hikaye ilerlemesi */
function renderTreasureStrip() {
  const got = profile?.treasures || [];
  const tamam = C.treasureComplete(profile);
  const wrap = el('div', { class: 'treasure-strip' + (tamam ? ' complete' : '') });
  wrap.append(el('div', { class: 'ts-label' },
    tamam ? 'Pofi tüm hazineyi topladı! Ada senin oldu.'
          : `Pofi'nin hazine sandığı — ${got.length}/${C.ALL_TREASURES.length} parça`));
  const row = el('div', { class: 'ts-row' });
  WORLDS.forEach((w, i) => {
    const has = got.includes(w.id);
    row.append(el('div', { class: 'ts-slot' + (has ? ' has' : ''), title: has ? (S.TREASURE_NAMES[w.id] || w.name) : 'Bu adayı bitirince açılır' },
      el('div', { class: 'ts-art', html: C.treasureSVG(has, i) }),
      el('div', { class: 'ts-name', text: has ? (S.TREASURE_NAMES[w.id] || w.name) : '???' })
    ));
  });
  wrap.append(row);
  return wrap;
}

/** Profil değişikliklerinden sonra çıkartma kontrolü + kutlama */
function checkStickers({ sessiz = false } = {}) {
  const yeni = C.evaluateStickers(profile);
  if (!yeni.length) return [];
  S.saveProfile(profile);
  updateHud();
  if (!sessiz) {
    const tier = ilk.tier || 'bronze';
    const meta = C.TROPHY_META[tier];
    sfx('trophy');
    titretTrofe();                 // haptik: konsollardaki ödül hissi
    confetti({ count: 80 });
    // Konsol tarzı: önce sağ üstten kayan trofe bildirimi
    yeni.forEach((st, k) => setTimeout(() => trophyPopup(st), k * 1100));
    speak(`${meta.ad} trofe kazandın: ${ilk.name}!`, { force: true });
    setTimeout(() => {
      dialog(el('div', { class: 'center trophy-dialog tier-' + tier },
        el('div', { class: 'td-medal', html: C.trophySVG(tier, 92) }),
        el('h2', { text: meta.ad.toUpperCase() + ' TROFE' }),
        el('p', { class: 'hint-title', text: ilk.name }),
        el('p', { class: 'muted', text: ilk.desc }),
        yeni.length > 1 ? el('p', { class: 'small', text: `+${yeni.length - 1} trofe daha kazandın!` }) : null,
        el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '12px' } },
          el('button', { class: 'btn green', text: 'Harika!', onClick: () => close() }))
      ));
    }, 320);
  }
  return yeni;
}

function svgWrap(inner, vb = 100) {
  return `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/* ---------------- DÜKKÂN ---------------- */
function renderShop() {
  if (!profile) return renderLogin();
  updateHud();
  const root = showScreen('shop');

  const coinChip = () => el('div', { class: 'hint-pill coin-live', text: `● ${profile.coins || 0} jeton` });

  const build = () => {
    clear(root);
    const headRow = el('div', { class: 'shop-head' },
      el('button', { class: 'btn sm ghost', text: '← Haritaya dön', onClick: () => { sfx('click'); renderMap(); } }),
      el('div', { class: 'grow', style: { flex: '1' } }),
      coinChip()
    );

    const preview = el('div', { class: 'shop-preview' },
      el('div', { class: 'sp-avatar', html: C.avatarDressed(profile, { size: 120, avatarHTML }) }),
      el('div', {},
        el('div', { class: 'sp-name', text: profile.nick }),
        el('div', { class: 'small muted', text: 'Karakterini süsle! Kazandığın jetonlarla al.' })
      )
    );

    const sections = [['Şapkalar', 'head'], ['Evcil Hayvanlar', 'pet'], ['Çerçeveler', 'frame']];
    const body = el('div', { class: 'shop-body' });
    for (const [title, slot] of sections) {
      body.append(el('h3', { class: 'shop-sec', text: title }));
      const grid = el('div', { class: 'shop-grid' });
      for (const it of C.ITEMS.filter((x) => x.slot === slot)) {
        const owned = C.ownsItem(profile, it.id);
        const equipped = (profile.equipped || {})[it.slot] === it.id;
        const afford = (profile.coins || 0) >= it.price;
        const card = el('div', { class: 'shop-item' + (owned ? ' owned' : '') + (equipped ? ' equipped' : '') },
          el('div', { class: 'si-art', html: it.slot === 'frame' ? framePreview(it) : svgWrap(it.art) }),
          el('div', { class: 'si-name', text: it.name }),
          owned
            ? el('button', {
                class: 'btn sm ' + (equipped ? 'green' : 'ghost'),
                text: it.slot === 'frame' ? 'Aktif' : (equipped ? 'Takılı ✓' : 'Tak'),
                onClick: () => {
                  sfx('tap');
                  C.toggleEquip(profile, it.id);
                  S.saveProfile(profile);
                  build();
                  speak(equipped ? 'Çıkardın.' : 'Harika görünüyor!');
                }
              })
            : el('button', {
                class: 'btn sm ' + (afford ? 'yellow' : 'ghost'),
                text: afford ? `● ${it.price}` : `● ${it.price} — yetersiz`,
                onClick: () => {
                  const r = C.buyItem(profile, it.id);
                  if (!r.ok) { sfx('wrong'); toast(r.reason === 'jeton yetersiz' ? 'Yeterli jetonun yok. Bölüm bitirip jeton kazan!' : r.reason); return; }
                  sfx('coin');
                  confetti({ count: 50 });
                  S.saveProfile(profile);
                  updateHud();
                  speak(`${it.name} senin oldu!`, { force: true });
                  toast(`${it.name} alındı!`);
                  if (it.slot !== 'frame') C.toggleEquip(profile, it.id);
                  S.saveProfile(profile);
                  build();
                }
              })
        );
        grid.append(card);
      }
      body.append(grid);
    }

    root.append(headRow, preview, body);
  };

  build();
  speak('Jeton dükkânı! Kazandığın jetonlarla karakterini süsleyebilirsin.');
}

function framePreview(it) {
  const [c1, c2] = it.ring;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="${c2}" stroke="#23324d" stroke-width="5"/>
    <circle cx="50" cy="50" r="29" fill="${c1}" stroke="#23324d" stroke-width="4"/>
    <circle cx="50" cy="50" r="19" fill="#fff" stroke="#23324d" stroke-width="4"/>
  </svg>`;
}

/* ============================================================
   TROFELER — PS5 tarzı sunum
   ============================================================ */

/** Trofe kazanıldığında sağ üstten kayan bildirim (konsol hissi) */
function trophyPopup(sticker) {
  const tier = sticker.tier || 'bronze';
  const meta = C.TROPHY_META[tier];
  const kutu = el('div', { class: 'trophy-pop tier-' + tier },
    el('div', { class: 'tp-icon', html: C.trophySVG(tier, 44) }),
    el('div', { class: 'tp-text' },
      el('div', { class: 'tp-label', text: meta.ad + ' Trofe Kazandın!' }),
      el('div', { class: 'tp-name', text: sticker.name })
    )
  );
  document.body.append(kutu);
  sfx('trophy');                      // PS5'te trofe sesi ayrı ve belirgindir
  requestAnimationFrame(() => kutu.classList.add('in'));
  setTimeout(() => {
    kutu.classList.remove('in');
    setTimeout(() => kutu.remove(), 500);
  }, 3600);
}

/** Haritadaki trofe rozeti — kazanılan/toplam */
/**
 * Günlük görev rozeti — "bugün şunu yap" hedefi.
 * Okuldan gelince dönme sebebi: ulaşılabilir, somut, her gün taze.
 */
function gorevChip() {
  const g = S.gunlukGorev(profile);
  const tamam = g.yapilan >= g.hedef;
  return el('div', {
    class: 'hint-pill gorev-chip' + (tamam ? ' tamam' : ''),
    title: tamam ? 'Bugünün görevi tamamlandı!' : `Bugünün görevi: ${g.hedef} soru`
  },
    el('span', { class: 'gc-ikon', text: tamam ? '✓' : '🎯' }),
    el('span', { text: tamam ? 'Görev tamam!' : `${g.yapilan}/${g.hedef}` })
  );
}

/**
 * Zorluk rozeti — dokununca değiştirilir.
 * Konsol oyunlarında zorluk her zaman görünür bir ayardır.
 */
function zorlukChip() {
  const z = ZORLUKLAR[settings.difficulty] || ZORLUKLAR.normal;
  return el('button', {
    class: 'hint-pill zorluk-chip',
    title: 'Zorluğu değiştir',
    onClick: () => { sfx('tap'); zorlukSecimi(false); }        // el() onClick bekler (onclick DEĞİL)
  },
    el('span', { text: z.ad }),
    el('span', { class: 'zc-can', text: '❤️'.repeat(z.can) })
  );
}

function trophyChip() {
  const kazanilan = C.evaluateStickers(profile).length;
  const hepsi = C.STICKERS.length;
  return el('div', { class: 'hint-pill trophy-chip', title: `Trofe puanı: ${C.trophyScore(profile)}` },
    el('span', { class: 'tc-ikon', html: C.trophySVG('gold', 18) }),
    el('span', { text: `${kazanilan}/${hepsi}` })
  );
}

/** TROFE ODASI — kademelere göre gruplanmış koleksiyon */
function renderTrophies() {
  if (!profile) return renderLogin();
  updateHud();
  const root = showScreen('album');
  const kazanilan = C.evaluateStickers(profile);
  const t = C.trophyCounts(profile);
  const toplam = C.trophyTotals();
  const puan = C.trophyScore(profile);
  const hepsiAlindi = kazanilan.length >= C.STICKERS.length;

  const ozet = el('div', { class: 'trophy-summary' });
  for (const k of C.TROPHY_ORDER) {
    const m = C.TROPHY_META[k];
    ozet.append(el('div', { class: 'tsum tier-' + k },
      el('div', { class: 'tsum-ikon', html: C.trophySVG(k, 34) }),
      el('div', { class: 'tsum-ad', text: m.ad }),
      el('div', { class: 'tsum-sayi', text: `${t[k]}/${toplam[k]}` }),
      el('div', { class: 'tsum-bar' }, el('i', { style: { width: (toplam[k] ? (t[k] / toplam[k]) * 100 : 0) + '%' } }))
    ));
  }

  const govde = el('div', { class: 'trophy-groups' });
  for (const k of [...C.TROPHY_ORDER].reverse()) {          // platin en üstte
    const liste = C.STICKERS.filter((s) => (s.tier || 'bronze') === k);
    const alinan = liste.filter((s) => kazanilan.includes(s.id)).length;
    govde.append(el('h3', { class: 'trophy-h tier-' + k },
      el('span', { class: 'th-ikon', html: C.trophySVG(k, 24) }),
      el('span', { text: `${C.TROPHY_META[k].ad} Trofeler` }),
      el('span', { class: 'th-sayi', text: `${alinan}/${liste.length}` })
    ));
    const izgara = el('div', { class: 'trophy-grid' });
    for (const s of liste) {
      const alindi = kazanilan.includes(s.id);
      izgara.append(el('div', {
        class: 'trophy-slot tier-' + k + (alindi ? ' has' : ''),
        title: s.desc,
        onClick: () => { sfx('tap'); if (alindi) toast(s.name + ' — ' + s.desc); }
      },
        el('div', { class: 'trok', html: C.trophySVG(k, 38) }),
        el('div', { class: 'tname', text: alindi ? s.name : '???' }),
        el('div', { class: 'tdesc', text: s.desc })
      ));
    }
    govde.append(izgara);
  }

  root.append(el('div', { class: 'panel wide' },
    el('h2', { class: 'page-title', text: 'Trofe Odası' }),
    el('p', { class: 'page-sub', text: `Konsol oyunlarındaki gibi trofe topla! Toplam puan: ${puan}` }),
    hepsiAlindi
      ? el('div', { class: 'platinum-banner' },
          el('div', { class: 'pb-ikon', html: C.trophySVG('platinum', 48) }),
          el('div', { class: 'pb-text', text: 'PLATİN TROFE! Tüm trofeleri topladın!' }))
      : el('span'),
    ozet,
    govde,
    el('div', { class: 'btn-row', style: { marginTop: '16px' } },
      el('button', { class: 'btn ghost sm', text: '🗺️ Haritaya dön', onClick: () => renderMap() })
    )
  ));
  speak('Trofe odası. Kazandığın madalyalar burada.');
  return root;
}

/* ---------------- ÇIKARTMA ALBÜMÜ ---------------- */
function renderAlbum() {
  if (!profile) return renderLogin();
  updateHud();
  const root = showScreen('album');
  const owned = new Set(profile.stickers || []);
  const total = C.STICKERS.length;

  root.append(
    el('div', { class: 'shop-head' },
      el('button', { class: 'btn sm ghost', text: '← Haritaya dön', onClick: () => { sfx('click'); renderMap(); } }),
      el('div', { class: 'grow', style: { flex: '1' } }),
      el('div', { class: 'hint-pill', text: `📖 ${owned.size} / ${total} çıkartma` })
    ),
    el('h2', { class: 'page-title', text: 'Çıkartma Albümüm' }),
    el('p', { class: 'page-sub', text: 'Çıkartmalar satın alınmaz — oynayarak kazanılır!' })
  );

  const grid = el('div', { class: 'album-grid' });
  for (const s of C.STICKERS) {
    const has = owned.has(s.id);
    grid.append(el('div', { class: 'album-slot' + (has ? ' has' : '') },
      el('div', { class: 'as-art', html: has ? svgWrap(s.art) : placeholderSticker() }),
      el('div', { class: 'as-name', text: has ? s.name : '???' }),
      el('div', { class: 'as-desc', text: s.desc })
    ));
  }
  root.append(grid);

  const kalan = total - owned.size;
  root.append(el('p', { class: 'small muted', style: { textAlign: 'center', marginTop: '14px' },
    text: kalan ? `${kalan} çıkartma kaldı — oynamaya devam!` : 'Tebrikler! Tüm çıkartmaları topladın!' }));
  speak(kalan ? `${owned.size} çıkartman var, ${kalan} tane kaldı.` : 'Tüm çıkartmaları topladın, harikasın!');
}

function placeholderSticker() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="36" fill="#e6ecf5" stroke="#b6c3d4" stroke-width="5" stroke-dasharray="9 7"/>
    <text x="50" y="64" text-anchor="middle" font-size="34" font-weight="900" fill="#b6c3d4"
      font-family="Fredoka, Nunito, system-ui, sans-serif">?</text>
  </svg>`;
}

function firstUnfinishedWorld() {
  for (const w of WORLDS) {
    const last = w.levels[w.levels.length - 1];
    if (!S.hasStars(profile, last.id)) return w;
  }
  return WORLDS[WORLDS.length - 1];
}

function openWorld(world) {
  const grid = el('div', { class: 'level-grid' });
  world.levels.forEach((level, i) => {
    const unlocked = S.isLevelUnlocked(profile, world, i);
    const res = S.getResult(profile, level.id);
    const node = el('button', {
      class: 'level-node' + (unlocked ? '' : ' locked') + (res.stars ? ' done' : ''), type: 'button',
      onClick: () => {
        if (!unlocked) { toast('Önce bir önceki bölümü bitir!'); sfx('wrong'); return; }
        sfx('click');
        close();
        openLevelIntro(world, level);
      }
    },
      el('div', { class: 'ln-no', text: `Bölüm ${i + 1} · ${TYPE_LABEL[level.type] || ''}` }),
      el('div', { class: 'ln-title', text: level.title }),
      starsEl(res.stars),
      !unlocked ? el('div', { style: { position: 'absolute', top: '8px', right: '10px', fontSize: '18px' }, text: '🔒' }) : el('span')
    );
    grid.append(node);
  });

  const banner = el('div', { class: 'dialog-banner' },
    el('h2', { text: `${world.emoji} ${world.name}` }),
    el('p', { class: 'small', text: world.intro })
  );
  banner.style.backgroundImage = `linear-gradient(180deg, rgba(8,20,38,.10), rgba(8,20,38,.82)), url('assets/bg/${world.id}.jpg')`;

  const body = el('div', {}, banner, grid);
  const close = dialog(body);
}

function openLevelIntro(world, level) {
  const topics = levelTopics(level);
  const banner = el('div', { class: 'dialog-banner' },
    el('h2', { text: `${world.emoji} ${level.title}` }),
    el('p', { class: 'small', text: level.story || '' })
  );
  banner.style.backgroundImage = `linear-gradient(180deg, rgba(8,20,38,.12), rgba(8,20,38,.80)), url('assets/bg/${world.id}.jpg')`;
  const body = el('div', { class: 'center' },
    banner,
    el('div', { html: mascotHTML(104), style: { marginBottom: '6px' } }),
    el('div', { class: 'hint-pill', text: topics.join(' · ') }),
    el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '16px' } },
      el('button', { class: 'btn primary', text: '🚀 Başla!', onClick: () => { close(); startLevel(world, level); } }),
      el('button', { class: 'btn ghost', text: 'Sonra', onClick: () => close() })
    )
  );
  const close = dialog(body);
  speak(`${level.title}. ${level.story || ''}`);
}

/* ---------------- 3) OYUN ---------------- */
/**
 * Bölüm öncesi geri sayım — konsol oyunlarındaki "hazırlan" anı.
 * Beklenti yaratır ve çocuğu ekrana kilitler.
 */
/**
 * HİKÂYE SAHNESİ — bölümden önce kısa anlatım.
 * Konsol oyunlarında bölümler sinematikle başlar. Bizde Pofi konuşur:
 * adanın tanıtımı + bölümün hikâyesi, sesli olarak.
 * (Sesler `ada-<id>` ve `bolum-<id>` olarak önceden üretilmişti.)
 */
function sahneOynat(world, level, bitti) {
  if (window.__hizliMod || sessionStorage.getItem('ada_hizli') === '1') { bitti(); return; }

  const kat = el('div', { class: 'sahne sahne-' + world.id },
    el('div', { class: 'sn-icerik' },
      el('div', { class: 'sn-maskot canli', html: mascotHTML(96) }),
      el('div', { class: 'sn-ada', text: world.name }),
      el('h2', { class: 'sn-bolum', text: level.title }),
      el('p', { class: 'sn-hikaye', text: level.story || world.intro || '' }),
      el('div', { class: 'sn-devam', text: 'Başlamak için dokun' })
    )
  );
  document.body.append(kat);

  // Sesli anlatım: önce adanın tanıtımı, sonra bölümün hikâyesi
  const adaSes = world.intro || '';
  const bolumSes = level.story || '';
  if (adaSes) speak(adaSes, { force: true, key: 'sahne-ada-' + world.id });
  if (bolumSes) setTimeout(() => speak(bolumSes, { force: true, key: 'sahne-bolum-' + level.id }), adaSes ? 3400 : 0);

  let gecti = false;
  const gec = () => {
    if (gecti) return;
    gecti = true;
    stopSpeaking();
    kat.classList.add('gidiyor');
    setTimeout(() => { kat.remove(); bitti(); }, 420);
  };
  kat.addEventListener('click', gec);
  setTimeout(gec, 7000);            // dokunmazsa kendi geçsin
}

function geriSayim(container, bitti) {
  // Test hızlı modu: geri sayımı atla (testler 2.8 sn beklemesin)
  if (window.__hizliMod || sessionStorage.getItem('ada_hizli') === '1') { bitti(); return; }
  const kat = el('div', { class: 'countdown' });
  container.append(kat);
  let n = 3;
  const goster = (metin, buyuk) => {
    kat.innerHTML = '';
    kat.append(el('div', { class: 'cd-sayi' + (buyuk ? ' buyuk' : ''), text: metin }));
  };
  sfx('tap');
  goster('3');
  const t = setInterval(() => {
    n--;
    if (n >= 1) { goster(String(n)); sfx('tap'); }
    else if (n === 0) { goster('BAŞLA!', true); sfx('unlock'); }
    else { clearInterval(t); kat.remove(); bitti(); }
  }, 700);
}

function startLevel(world, level) {
  if (currentEngine?.destroy) currentEngine.destroy();
  currentEngine = null;
  currentLevel = { world, level };
  document.body.dataset.world = world.id;
  const root = showScreen('game');

  const top = el('div', { class: 'game-bar' },
    el('button', { class: 'btn ghost sm', text: '⏹️ Çık', onClick: () => { quitLevel(); } }),
    el('div', { class: 'hint-pill', text: `${world.emoji} ${world.name} · ${level.title}` }),
    el('div', { class: 'grow' })
  );
  const stage = el('div', { class: 'game-wrap' });
  if (journey) { journey.destroy(); journey = null; }
  journey = new Journey({
    steps: expectedSteps(level),
    worldId: world.id,
    avatar: profile?.avatar || '🦊',
    goalLabel: world.goalLabel
  });
  const journeyHost = el('div', { class: 'journey-host' });
  journey.mount(journeyHost);
  const wrap = el('div', { class: 'game-wrap' });
  wrap.append(top, journeyHost, stage);
  root.append(wrap);

  const factory = ENGINE_BY_TYPE[level.type];
  if (!factory) { toast('Bu bölüm tipi henüz yok'); renderMap(); return; }
  muzikModu('play');               // oyun müziği (tempolu)
  muzikYogunluk(1);
  // Bölüm öncesi geri sayım — konsol oyunlarındaki "hazırlan" anı.
  // Beklenti yaratır; çocuk soru gelmeden ekrana kilitlenir.
  // Ortam sesi — adanın kendi atmosferi (kuş, su damlası, rüzgâr, dalga, yıldız)
  if (settings.sound) { try { ortamBaslat(world.id, 1); } catch (e) {} }

  // Önce hikâye sahnesi, sonra geri sayım, sonra oyun
  sahneOynat(world, level, () => {
    geriSayim(stage, () => {
      currentEngine = factory({ root: stage, level: withTimeMode(level), api });
      currentEngine.start();
    });
  });
  api._stage = stage;
}

async function quitLevel() {
  const ok = await confirmBox('Oyundan çıkmak istiyor musun? Bu bölümdeki ilerleme kaydedilmez.', { yes: 'Evet, çık', no: 'Devam et', title: 'Çıkış' });
  if (ok) {
    stopSpeaking();
    if (currentEngine?.destroy) currentEngine.destroy();
    currentEngine = null;
    if (journey) { journey.destroy(); journey = null; }
    renderMap();
  }
}

/* ---------------- 4) SONUÇ ---------------- */
/**
 * Yıldız hesabı — SADECE doğruluk değil.
 * Önce: %95 → 3★, %78 → 2★ (ipucu spamlayan çocuk da 3★ alıyordu)
 * Şimdi: ipucu kullanımı puanı düşürür, seri bonus verir.
 *   3★ = gerçekten öğrenmiş (yüksek doğruluk + az ipucu)
 *   2★ = iyi ama desteğe ihtiyaç duymuş
 *   1★ = bitirdi, tekrar çalışmalı
 */
function computeStars({ completed, correct, wrong, hintsUsed = 0, best = 0, rounds = 1 }) {
  if (!completed) return 0;
  const toplam = correct + wrong;
  const dogruluk = toplam ? correct / toplam : 0;

  // Puan: doğruluk temeli, ipucu cezası, seri ödülü
  let puan = dogruluk * 100;
  const ipucuOrani = Math.min(1, hintsUsed / Math.max(1, toplam));
  puan -= ipucuOrani * 40;                                  // her %10 ipucu → 4 puan
  puan += Math.min(8, (best / Math.max(1, rounds)) * 12);    // seri bonusu (en fazla +8)

  if (puan >= 90) return 3;
  if (puan >= 68) return 2;
  return 1;
}

/**
 * RÜTBE — konsol oyunlarındaki gibi (S en iyi)
 * Yıldız + ipucsuzluk + seri birlikte değerlendirilir.
 */
function computeRank({ stars, correct, wrong, hintsUsed = 0, best = 0, rounds = 1 }) {
  const toplam = correct + wrong;
  const dogruluk = toplam ? correct / toplam : 0;
  if (stars >= 3 && hintsUsed === 0 && dogruluk >= 0.98) return 'S';
  if (stars >= 3) return 'A';
  if (stars === 2) return 'B';
  if (stars === 1) return 'C';
  return 'D';
}

export const RANK_META = {
  S: { ad: 'MÜKEMMEL',  renk: '#ffd23d', renk2: '#ff9a3d', aciklama: 'Hiç ipucu almadan, kusursuz!' },
  A: { ad: 'HARİKA',    renk: '#58cf6a', renk2: '#1c93d8', aciklama: 'Çok iyi iş çıkardın!' },
  B: { ad: 'İYİ',       renk: '#4aa8ff', renk2: '#2a6fd8', aciklama: 'Güzel, biraz daha çalış.' },
  C: { ad: 'GEÇTİN',    renk: '#ffb03d', renk2: '#d97a00', aciklama: 'Bitirdin! Tekrar dene.' },
  D: { ad: 'TEKRAR DENE', renk: '#b9c6d8', renk2: '#8d99a8', aciklama: 'Bu bölümü bir daha oyna.' }
};

function finishLevel(result) {
  const { world, level } = currentLevel || {};
  if (!world || !level) return renderMap();
  if (currentEngine?.destroy) currentEngine.destroy();
  currentEngine = null;
  stopSpeaking();

  const stars = computeStars(result);
  const rank = computeRank({ stars, ...result });
  const score = (result.correct || 0) * 100 + (result.streak || 0) * 50 + (result.dragonDefeated ? 300 : 0);
  const before = S.getResult(profile, level.id);
  const saved = S.saveLevelResult(profile, level, { stars, score });

  /* --- Ödül ekonomisi --- */
  const seri = S.touchDailyStreak(profile);          // günlük seri
  S.markKindDone(profile, level.type);               // çizim / boss sayacı
  const hasatliJeton = (result.correct || 0) * 2 + stars * 6;
  const seriBonusu = seri.artti ? Math.min(seri.count, 5) * 3 : 0;   // günlük seri ödülü
  const coins = hasatliJeton + seriBonusu;
  S.addCoins(profile, coins);
  S.pushBoard(profile);

  const yeniHazine = S.markWorldProgress(profile, WORLDS);           // hikaye parçası
  const yeniCikartma = C.evaluateStickers(profile);                  // çıkartma ödülü
  if (yeniCikartma.length) S.saveProfile(profile);
  const completedRun = !!result.completed;
  const perfectRun = (result.wrong || 0) === 0 && completedRun;
  if (journey) {
    journey.arrive({ completed: completedRun, perfect: perfectRun });
    if (completedRun) { sfx('goalArrive'); if (perfectRun) setTimeout(() => sfx('star'), 500); }
  }
  if (online.isConfigured()) {
    online.safe(() => online.pushProgress(profile, profile.token));
  }

  // Yeni bölüm açıldı mı?
  const idx = world.levels.indexOf(level);
  const nextLevel = world.levels[idx + 1];
  const unlockedNew = stars > 0 && nextLevel && before.stars === 0 && S.hasStars(profile, level.id);
  if (unlockedNew) setTimeout(() => { sfx('unlock'); toast('🔓 Yeni bölüm açıldı!'); }, 900);

  updateHud();
  zaferFanfari('menu');            // coşkulu zafer fanfarı
  // Maskot kutlasın — sonuç ekranı çizildikten sonra ruh haline göre zıplasın/üzülsün
  setTimeout(() => {
    const m = document.querySelector('.maskot-canli');
    if (m) maskotCanlandir(m, stars === 3 ? 'cheer' : stars === 2 ? 'happy' : 'sad');
  }, 260);
  renderResult({ world, level, result, stars, rank, score, coins, improved: stars > before.stars, unlockedNew, nextLevel, seri, yeniHazine, yeniCikartma });
}

function renderResult({ world, level, result, stars, rank, score, coins, improved, unlockedNew, nextLevel, seri = null, yeniHazine = [], yeniCikartma = [] }) {
  const root = showScreen('result');
  const mood = stars === 3 ? 'cheer' : stars === 2 ? 'happy' : stars === 1 ? 'think' : 'sad';
  const total = (result.correct || 0) + (result.wrong || 0);
  const acc = total ? Math.round(((result.correct || 0) / total) * 100) : 0;
  const msg = stars === 3 ? 'Muhteşem! Her şeyi doğru yaptın!' : stars === 2 ? 'Çok iyi! Neredeyse hepsi doğru.' : stars === 1 ? 'Güzel! Bir daha denersen daha iyi olacak.' : 'Olsun! Tekrar denemek en güzel öğrenme yoludur.';

  // RÜTBE — konsol oyunlarındaki gibi büyük harf notu
  const rm = RANK_META[rank] || RANK_META.C;
  const rankBox = el('div', { class: 'rank-box rank-' + (rank || 'C') },
    el('div', { class: 'rank-letter', text: rank || 'C' }),
    el('div', { class: 'rank-info' },
      el('div', { class: 'rank-ad', text: rm.ad }),
      el('div', { class: 'rank-aciklama', text: rm.aciklama })
    )
  );
  const starLine = el('div', { class: 'result-stars' });
  for (let i = 0; i < 3; i++) {
    const s = el('span', { class: 's' + (i < stars ? ' on' : ''), text: '★' });
    if (i < stars) s.style.animationDelay = (i * 0.22) + 's';
    starLine.append(s);
  }

  const panel = el('div', { class: 'panel' },
    el('div', { class: 'result-hero' },
      el('div', { style: { display: 'flex', justifyContent: 'center' } },
        el('div', { class: 'canli maskot-canli', html: mascotHTML(120, mood) })),
      el('h1', { text: stars > 0 ? 'Bölüm tamam!' : 'Tekrar deneyelim' }),
      el('p', { class: 'small', text: `${world.name} · ${level.title}` }),
      starLine,
      rankBox,
      el('h2', { text: msg }),
      el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '8px' } },
        el('span', { class: 'hint-pill', text: `✅ ${result.correct || 0} doğru` }),
        el('span', { class: 'hint-pill', text: `❌ ${result.wrong || 0} yanlış` }),
        el('span', { class: 'hint-pill', text: `🎯 %${acc}` }),
        el('span', { class: 'hint-pill', text: `● +${coins}` }),
        result.streak ? el('span', { class: 'hint-pill', text: `🔥 En uzun seri: ${result.streak}` }) : el('span'),
        result.dragonDefeated ? el('span', { class: 'hint-pill', text: '🐉 Ejderha yenildi!' }) : el('span')
      ),
      improved || unlockedNew ? el('p', { class: 'small', text: unlockedNew ? '🔓 Yeni bölüm açıldı!' : '⭐ Yıldızını artırdın!' }) : el('span'),
      rewardBlock({ seri, yeniHazine, yeniCikartma }),
      el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '16px' } },
        el('button', { class: 'btn primary', text: '🔁 Tekrar oyna', onClick: () => { sfx('click'); startLevel(world, level); } }),
        nextLevel && stars > 0 && S.isLevelUnlocked(profile, world, world.levels.indexOf(nextLevel))
          ? el('button', { class: 'btn green', text: '➡️ Sonraki bölüm', onClick: () => { sfx('click'); openLevelIntro(world, nextLevel); renderMapSilently(); } })
          : el('span'),
        el('button', { class: 'btn ghost', text: '🗺️ Harita', onClick: () => { sfx('click'); renderMap(); } })
      )
    )
  );
  if (journey?.root) panel.prepend(journey.root);
  root.append(panel);

  if (stars > 0) { confetti({ count: 120 + stars * 30, duration: 2400 }); sfx('win'); if (stars === 3) setTimeout(() => sfx('star'), 700); }
  speak(stars > 0 ? msg : 'Tekrar dene, başarabilirsin!');
}

function renderMapSilently() { /* sonraki bölüm açılırken haritayı arkada güncelle */
  if (profile) { S.pushBoard(profile); updateHud(); }
}

/** Bölüm sonu ödül bloğu: seri, hazine parçası, çıkartma */
function rewardBlock({ seri, yeniHazine, yeniCikartma }) {
  const satirlar = [];

  if (seri && seri.artti) {
    satirlar.push(el('div', { class: 'reward-row streak' },
      el('span', { class: 'rw-ico', text: '🔥' }),
      el('span', {}, `Günlük seri: ${seri.count} gün! `),
      el('b', { text: `+${Math.min(seri.count, 5) * 3} jeton bonus` })
    ));
  }
  if (seri && seri.yeniRekor && seri.best > 1) {
    satirlar.push(el('div', { class: 'reward-row' },
      el('span', { class: 'rw-ico', text: '🏆' }),
      el('span', {}, `Yeni rekor: ${seri.best} gün üst üste!`)
    ));
  }

  for (const h of (yeniHazine || [])) {
    satirlar.push(el('div', { class: 'reward-row treasure' },
      el('span', { class: 'rw-ico', html: svgWrap(C.treasureSVG(true, WORLDS.findIndex((w) => w.id === h.worldId))) }),
      el('span', {}, 'Hazine parçası kazandın: '),
      el('b', { text: h.name })
    ));
  }

  for (const s of (yeniCikartma || [])) {
    satirlar.push(el('div', { class: 'reward-row sticker' },
      el('span', { class: 'rw-ico', html: svgWrap(s.art) }),
      el('span', {}, 'Yeni çıkartma: '),
      el('b', { text: s.name })
    ));
  }

  if (!satirlar.length) return el('span');
  return el('div', { class: 'reward-box' }, satirlar);
}

/* ---------------- 5) SINIF TABLOSU ---------------- */
async function renderBoard() {
  const root = showScreen('board');
  const panel = el('div', { class: 'panel wide' },
    el('h1', { text: '🏅 Sınıf Tablosu' }),
    el('p', { text: `Sınıf kodu: ${profile.classCode} — arkadaşların aynı sınıf kodunu yazınca bu tabloda birlikte görünürsünüz.` })
  );
  const tableBox = el('div');
  panel.append(tableBox,
    el('div', { class: 'btn-row', style: { marginTop: '14px' } },
      el('button', { class: 'btn ghost', text: '🗺️ Haritaya dön', onClick: () => renderMap() }),
      el('button', { class: 'btn ghost sm', text: '🔄 Yenile', onClick: () => renderBoard() })
    ));
  root.append(panel);

  const rows = S.readBoard().sort((a, b) => b.stars - a.stars || b.correct - a.correct);
  const tbody = el('tbody');
  rows.forEach((r, i) => {
    const me = r.nick === profile.nick && r.classCode === profile.classCode;
    tbody.append(el('tr', { class: me ? 'me' : '' },
      el('td', {}, el('span', { class: 'badge rank-' + (i < 3 ? (i + 1) : 'n'), text: String(i + 1) })),
      el('td', { html: `${avatarInline(r.avatar, 20)}${esc(r.nick)}` }),
      el('td', { text: '★ ' + r.stars }),
      el('td', { text: '● ' + (r.coins || 0) }),
      el('td', { text: String(r.correct || 0) })
    ));
  });
  if (!rows.length) tbody.append(el('tr', {}, el('td', { colspan: 5, text: 'Henüz kayıt yok. Bir bölüm bitir, tabloya gir!' })));

  tableBox.append(el('table', { class: 'table' },
    el('thead', {}, el('tr', {}, el('th', { text: '#' }), el('th', { text: 'Oyuncu' }), el('th', { text: 'Yıldız' }), el('th', { text: 'Jeton' }), el('th', { text: 'Doğru' }))),
    tbody
  ));

  if (online.isConfigured()) {
    const note = el('p', { class: 'small muted', text: 'Sunucu tablosu yükleniyor...' });
    tableBox.append(note);
    online.safe(() => online.classBoard(profile.classCode, profile.token), null).then((data) => {
      if (!data || !data.rows) { clear(note); return; }
      clear(note);
      const tb = el('tbody');
      data.rows.slice(0, 20).forEach((r, i) => tb.append(el('tr', {}, el('td', { text: String(i + 1) }), el('td', { text: `${r.avatar || ''} ${r.nick}` }), el('td', { text: '★ ' + (r.stars || 0) }), el('td', { text: '● ' + (r.coins || 0) }), el('td', { text: String(r.correct || 0) }))));
      tableBox.append(el('h3', { text: '🌐 Çevrimiçi sınıf' }), el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, el('th', { text: '#' }), el('th', { text: 'Oyuncu' }), el('th', { text: 'Yıldız' }), el('th', { text: 'Jeton' }), el('th', { text: 'Doğru' }))), tb));
    });
  } else {
    tableBox.append(el('p', { class: 'small muted', text: 'Not: Bu tablo şimdilik cihazda saklanıyor. Sunucu bağlandığında tüm sınıf ortak tabloda yarışır (README → Aşama 2).' }));
  }
}

/* ---------------- 6) VELİ / ÖĞRETMEN PANELİ ---------------- */
function masteryRows(map, labelFn, order) {
  const keys = order || Object.keys(map);
  const rows = [];
  for (const k of keys) {
    const v = map[k];
    if (!v) continue;
    const total = v.c + v.w;
    const pct = total ? Math.round((v.c / total) * 100) : 0;
    rows.push(el('div', { class: 'mastery-row' },
      el('div', { text: labelFn(k) }),
      el('div', { class: 'mastery-bar' }, el('i', { style: { width: pct + '%' } })),
      el('div', { class: 'muted', text: `%${pct} (${v.c}/${total})` })
    ));
  }
  return rows.length ? rows : [el('p', { class: 'small muted', text: 'Henüz veri yok.' })];
}

/* ============================================================
   DERSLER — alıştırmadan ÖNCE anlatım
   Kilitli DEĞİL: çocuk konuyu okulda görmeden de açabilir.
   ============================================================ */

function renderLessons() {
  const root = showScreen('lessons');
  const gorulen = profile?.lessonsSeen || [];
  const kartlar = [];

  // Giriş dersi
  kartlar.push(el('button', { class: 'lesson-card intro', onClick: () => renderLesson('geo') },
    el('div', { class: 'lc-art', text: '📐' }),
    el('div', { class: 'lc-title', text: GEO_INTRO.title }),
    el('div', { class: 'lc-sub', text: 'Kenar ve köşe nedir?' }),
    el('div', { class: 'lc-state' + (gorulen.includes(dersKey('geo')) ? ' ok' : ''), text: gorulen.includes(dersKey('geo')) ? 'Görüldü' : 'Yeni' })
  ));

  for (const [id, ders] of Object.entries(SHAPE_LESSONS)) {
    const s = SHAPES[id];
    const gor = gorulen.includes(dersKey(id));
    kartlar.push(el('button', { class: 'lesson-card', onClick: () => renderLesson(id) },
      el('div', { class: 'lc-art', html: shapeSVG(id, 74) }),
      el('div', { class: 'lc-title', text: ders.title }),
      el('div', { class: 'lc-sub', text: s.sides === 0 ? 'Kenarı ve köşesi yok' : `${s.sides} kenar · ${s.corners} köşe` }),
      el('div', { class: 'lc-state' + (gor ? ' ok' : ''), text: gor ? 'Görüldü' : 'Yeni' })
    ));
  }

  root.append(el('div', { class: 'panel wide' },
    el('h2', { class: 'page-title', text: 'Dersler' }),
    el('p', { class: 'page-sub', text: 'Alıştırmaya başlamadan önce konuyu buradan öğren. Bölüm kilidi gerekmez.' }),
    el('div', { class: 'lesson-grid' }, ...kartlar),
    el('div', { class: 'btn-row', style: { marginTop: '16px' } },
      el('button', { class: 'btn ghost sm', text: '🗺️ Haritaya dön', onClick: () => renderMap() })
    )
  ));
  speak('Dersler. Bir şekil seç, önce öğren sonra çiz.');
}

/** Slayt slayt ders anlatımı */
function renderLesson(shapeId) {
  const root = showScreen('lesson');
  const ders = shapeId === 'geo' ? GEO_INTRO : SHAPE_LESSONS[shapeId];
  const slaytlar = ders.slides;
  let i = 0;

  const ilerleme = el('div', { class: 'lesson-dots' });
  const sahne = el('div', { class: 'lesson-stage' });
  const baslik = el('div', { class: 'lesson-h' });
  const metin = el('div', { class: 'lesson-p' });
  const sesBtn = el('button', { class: 'btn sm blue', text: '🔊 Tekrar dinle', onClick: () => konus() });
  const geriBtn = el('button', { class: 'btn ghost sm', text: '◀ Geri', onClick: () => { i = Math.max(0, i - 1); ciz(); } });
  const ileriBtn = el('button', { class: 'btn primary', text: 'İleri ▶', onClick: () => { if (i < slaytlar.length - 1) { i++; ciz(); } else dene(); } });

  function konus() {
    if (!slaytlar[i]) return;
    speak(slaytlar[i].ses || slaytlar[i].metin, { force: true, key: 'ders-' + shapeId + '-' + i + '-' + Date.now() });
  }

  function ciz() {
    const s = slaytlar[i];
    clear(sahne); clear(ilerleme);
    // Slayt noktaları
    slaytlar.forEach((_, k) => ilerleme.append(el('span', { class: 'dot' + (k === i ? ' on' : '') })));
    // Görsel: şekil varsa büyük SVG, yoksa emoji
    if (shapeId === 'geo') {
      sahne.append(el('div', { class: 'lesson-emoji', text: i === 0 ? '🔷 🔺 ⚪' : i === 1 ? '📏' : '🔢' }));
    } else {
      sahne.append(el('div', { class: 'lesson-shape', html: shapeSVG(shapeId, 180) }));
      const sh = SHAPES[shapeId];
      sahne.append(el('div', { class: 'lesson-meta', text: sh.sides === 0 ? 'Kenar yok · Köşe yok' : `Kenar: ${sh.sides} · Köşe: ${sh.corners}` }));
    }
    baslik.textContent = s.baslik;
    metin.textContent = s.metin;
    geriBtn.style.visibility = i === 0 ? 'hidden' : '';
    ileriBtn.textContent = i === slaytlar.length - 1 ? '✏️ Şimdi dene!' : 'İleri ▶';
    konus();
  }

  /** Slaytlar bitince ilgili alıştırmayı aç — KİLİDİ ATLAYARAK */
  function dene() {
    markLessonSeen(shapeId);
    if (shapeId === 'geo') { renderLessons(); return; }
    const hedef = practiceLevelFor(shapeId, WORLDS);
    if (!hedef) { renderLessons(); return; }
    if (journey) { journey.destroy(); journey = null; }
    startLevel(hedef.world, hedef.level);   // kilit kontrolü yok
  }

  root.append(el('div', { class: 'panel wide lesson-panel' },
    ilerleme,
    sahne,
    baslik,
    metin,
    el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '14px' } }, geriBtn, sesBtn, ileriBtn),
    el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '10px' } },
      el('button', { class: 'btn ghost sm', text: '📚 Ders listesi', onClick: () => renderLessons() }),
      el('button', { class: 'btn ghost sm', text: '🗺️ Haritaya dön', onClick: () => renderMap() })
    )
  ));
  ciz();
}

/** Ders görüldü olarak işaretle (veli paneli ve çıkartmalar için) */
function markLessonSeen(shapeId) {
  if (!profile) return;
  profile.lessonsSeen = profile.lessonsSeen || [];
  const k = dersKey(shapeId);
  if (!profile.lessonsSeen.includes(k)) {
    profile.lessonsSeen.push(k);
    S.saveProfile(profile);
  }
}

/** Veli paneli: veriyi "şunu yap" tavsiyesine çeviren bölüm */
function adviceSection() {
  const oneriler = buildAdvice(profile);
  const ikon = { acil: '!', onemli: '▲', iyi: '★', bilgi: 'i' };
  const kartlar = oneriler.map((a) => el('div', { class: 'advice-card tip-' + a.tip },
    el('div', { class: 'adv-head' },
      el('span', { class: 'adv-ico', text: ikon[a.tip] || 'i' }),
      el('b', { text: a.baslik })
    ),
    el('div', { class: 'adv-neden', text: a.neden }),
    el('div', { class: 'adv-eylem', text: '👉 ' + a.eylem })
  ));

  return el('div', { class: 'advice-box' },
    el('h3', { style: { marginTop: '0' }, text: 'Ne yapmalı? — kişiye özel öneriler' }),
    ...kartlar,
    el('div', { class: 'btn-row', style: { marginTop: '10px' } },
      el('button', {
        class: 'btn ghost sm', text: 'Önerileri kopyala',
        onClick: () => {
          const t = adviceToText(profile, oneriler);
          try { navigator.clipboard?.writeText(t); toast('Öneriler kopyalandı'); }
          catch (e) { toast('Kopyalanamadı'); }
          sfx('tap');
        }
      })
    )
  );
}

/** Veli paneli: zaman baskısı ayarı (kaygılı çocuk için kapatılabilir) */
function timeModeSection() {
  const mod = settings.timeMode || 'normal';
  const secenekler = [
    ['off', 'Kapalı', 'Süre yok. Kaygılanan ya da yeni başlayan çocuklar için.'],
    ['normal', 'Normal', 'Bölümün kendi süresi (önerilen).'],
    ['tight', 'Sıkı', '%20 daha kısa süre. Sıkılan / meydan okuma isteyen çocuklar için.']
  ];
  return el('div', { class: 'advice-box' },
    el('h3', { style: { marginTop: '0' }, text: 'Zaman baskısı' }),
    el('p', { class: 'small muted', style: { marginTop: '0' },
      text: 'Süre kaygısı öğrenmeyi engelleyebilir. Çocuğunuz acele ederken hata yapıyorsa "Kapalı" seçin.' }),
    el('div', { class: 'btn-row' },
      ...secenekler.map(([val, ad, aciklama]) => el('button', {
        class: 'btn sm ' + (mod === val ? 'green' : 'ghost'),
        text: ad,
        title: aciklama,
        onClick: () => {
          settings.timeMode = val;
          persistSettings();
          sfx('tap');
          toast(aciklama);
          renderParent();
        }
      }))
    ),
    el('p', { class: 'small', style: { marginTop: '8px' },
      text: secenekler.find((s) => s[0] === mod)?.[2] || '' })
  );
}

/**
 * Veli paneli: KONUŞMA HIZI
 * Ses ne çok hızlı ne çok yavaş olmalı. Her çocuk farklı — veli
 * "Dene" ile dinleyip kendisi seçer.
 */
function speechSpeedSection() {
  const suanki = Number(settings.speechSpeed) || 0.72;
  const secenekler = [
    [0.58, 'Çok Yavaş'],
    [0.66, 'Yavaş'],
    [0.72, 'Normal'],
    [0.82, 'Hızlı']
  ];
  // En yakın seçeneği işaretle
  const enYakin = secenekler.reduce((a, b) => (Math.abs(b[0] - suanki) < Math.abs(a[0] - suanki) ? b : a))[0];

  return el('div', { class: 'advice-box' },
    el('h3', { style: { marginTop: '0' }, text: 'Konuşma hızı' }),
    el('p', { class: 'small muted', style: { marginTop: '0' },
      text: 'Ders ve ipuçları sesli okunur. Çocuğunuz yetiştiremiyorsa yavaşlatın, sıkılıyorsa hızlandırın.' }),
    el('div', { class: 'btn-row' },
      ...secenekler.map(([deger, ad]) => el('button', {
        class: 'btn sm ' + (deger === enYakin ? 'green' : 'ghost'),
        text: ad,
        onClick: () => {
          settings.speechSpeed = deger;
          persistSettings();
          renderParent();
          // Seçilen hızla hemen örnek oku — kulakla karşılaştırsın
          setTimeout(() => speak('Kare çiz. Dört eşit kenar. Sağa git, sonra aşağı.',
            { force: true, key: 'speed-ornek-' + Date.now() }), 120);
        }
      }))
    ),
    el('div', { class: 'btn-row', style: { marginTop: '8px' } },
      el('button', {
        class: 'btn ghost sm', text: '🔊 Seçili hızı dene',
        onClick: () => speak('Karenin dört kenarı vardır. Hepsi birbirine eşittir.',
          { force: true, key: 'speed-dene-' + Date.now() })
      })
    ),
    el('p', { class: 'small', style: { marginTop: '8px' },
      text: `Şu anki hız: ${suanki.toFixed(2)} — "Normal" (0.72) önerilen dengedir.` })
  );
}

/**
 * Veli paneli: SERBEST MOD
 * Çocuk okulda konuyu görmeden ilgili bölüme giremiyordu (kilit).
 * Öğretmen/veli bu anahtarı açınca tüm bölümler kilitsiz açılır.
 */
function freeModeSection() {
  const acik = !!settings.freeMode;
  return el('div', { class: 'advice-box' },
    el('h3', { style: { marginTop: '0' }, text: 'Serbest Mod (bölüm kilidi)' }),
    el('p', { class: 'small muted', style: { marginTop: '0' },
      text: 'Normalde bir bölümü açmak için öncekinin bitirilmesi gerekir. Çocuk okulda henüz görmediği bir konuya çalışmak isterse bu kilidi açın.' }),
    el('div', { class: 'btn-row' },
      el('button', {
        class: 'btn sm ' + (acik ? 'green' : 'ghost'),
        text: acik ? 'Serbest Mod: AÇIK' : 'Serbest Modu Aç',
        onClick: () => {
          settings.freeMode = !settings.freeMode;
          persistSettings();
          sfx('tap');
          toast(settings.freeMode ? 'Tüm bölümler açıldı' : 'Bölüm kilidi geri açıldı');
          renderParent();
        }
      }),
      el('button', {
        class: 'btn ghost sm', text: '📚 Derslere git',
        onClick: () => renderLessons()
      })
    ),
    el('p', { class: 'small', style: { marginTop: '8px' },
      text: acik
        ? 'Açık: çocuk istediği bölüme doğrudan girebilir. Yıldızlar yine kazanılarak toplanır.'
        : 'Kapalı: bölümler sırayla açılır (önerilen). Ders ekranı her zaman açıktır.' })
  );
}

function renderParent() {
  const root = showScreen('parent');
  const st = profile.stats;
  const total = st.correct + st.wrong;
  const acc = total ? Math.round((st.correct / total) * 100) : 0;

  const worldRows = WORLDS.map((w) => {
    const got = S.worldStars(profile, w);
    const max = w.levels.length * 3;
    return el('div', { class: 'mastery-row' },
      el('div', { text: w.name }),
      el('div', { class: 'mastery-bar' }, el('i', { style: { width: Math.round((got / max) * 100) + '%' } })),
      el('div', { class: 'muted', text: `★ ${got}/${max}` })
    );
  });

  const panel = el('div', { class: 'panel wide' },
    el('h1', { text: '👨‍👩‍👦 Veli / Öğretmen Paneli' }),
    el('p', { html: `${avatarInline(profile.avatar, 22)}<b>${esc(profile.nick)}</b> · Sınıf ${esc(profile.classCode)} · Toplam ★ ${S.totalStars(profile)} · Doğruluk %${acc} (${st.correct} doğru / ${st.wrong} yanlış)` }),

    adviceSection(),

    speechSpeedSection(),

    timeModeSection(),

    freeModeSection(),

    el('h3', { text: 'Çarpım tablosu ustalığı' }),
    el('div', { class: 'mastery', style: { marginBottom: '18px' } }, ...masteryRows(st.byTable || {}, (k) => `${k}'ler`, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])),

    el('h3', { text: 'Geometri ustalığı' }),
    el('div', { class: 'mastery', style: { marginBottom: '18px' } }, ...masteryRows(st.byShape || {}, (k) => k)),

    el('h3', { text: 'Ada ilerlemesi' }),
    el('div', { class: 'mastery', style: { marginBottom: '18px' } }, ...worldRows),

    el('div', { class: 'btn-row' },
      el('button', { class: 'btn ghost sm', text: '🗺️ Haritaya dön', onClick: () => renderMap() }),
      el('button', { class: 'btn ghost sm', text: '⬇️ İlerlemeyi indir (JSON)', onClick: exportProgress }),
      el('button', { class: 'btn ghost sm', text: '🧹 Yerel tabloyu temizle', onClick: async () => { if (await confirmBox('Sınıf tablosundaki kayıtlar silinsin mi?', { yes: 'Sil' })) { S.clearBoard(); toast('Tablo temizlendi'); } } }),
      el('button', { class: 'btn ghost sm', text: '⚠️ Bu profili sıfırla', onClick: resetProfile })
    ),
    el('p', { class: 'small muted', style: { marginTop: '14px' }, text: 'İlerleme bu cihazın tarayıcısında saklanır. Sunucu modu açıldığında sınıfın tümü ortak tabloda yarışır ve ilerleme cihazlar arasında eşitlenir.' })
  );
  root.append(panel);
}

function exportProgress() {
  const data = JSON.stringify(profile, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `ada-macerasi-${profile.nick}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('İlerleme indirildi');
}

async function resetProfile() {
  const ok = await confirmBox('Bu oyuncunun tüm yıldızları ve ilerlemesi silinecek. Emin misin?', { yes: 'Sıfırla', no: 'Vazgeç', title: 'Profili sıfırla' });
  if (!ok) return;
  S.deleteProfile(profile.nick, profile.classCode);
  clearActive();
  profile = null;
  toast('Profil sıfırlandı');
  renderLogin();
}

/* ---------------- 7) DÜELLO ---------------- */
function renderDuel(mode) {
  const root = showScreen('duel');
  const container = el('div', { class: 'game-wrap' });
  root.append(container);

  // Mod seçilmemişse: aynı cihaz mı, canlı mı?
  if (!mode) {
    container.append(
      el('div', { class: 'duel-head' },
        el('button', { class: 'btn sm ghost', text: '← Haritaya dön', onClick: () => { sfx('click'); renderMap(); } })
      ),
      el('div', { class: 'panel' },
        el('h1', { text: 'Düello' }),
        el('p', { class: 'small muted', text: 'Nasıl oynamak istersiniz?' }),
        el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '14px' } },
          el('button', { class: 'btn primary', text: 'Arkadaşınla canlı (oda kodu)', onClick: () => { sfx('click'); renderDuel('online'); } }),
          el('button', { class: 'btn blue', text: 'Aynı cihazda 2 kişi', onClick: () => { sfx('click'); renderDuel('local'); } })
        ),
        el('p', { class: 'small muted', style: { textAlign: 'center' } , text: 'Canlı düelloda arkadaşın kendi cihazından aynı sorulara cevap verir.' })
      )
    );
    speak('Düello! Arkadaşınla canlı mı, yoksa aynı cihazda mı oynamak istersin?');
    return;
  }

  if (mode === 'online') {
    const duel = createDuelOnline({
      root: container,
      api: Object.assign({}, api, { speak: (t) => speak(t) }),
      onExit: (yerel) => { duel.destroy(); if (yerel === 'local') renderDuel('local'); else renderMap(); }
    });
    currentEngine = duel;
    duel.start();
    return;
  }

  const duel = createDuel({
    root: container,
    api: Object.assign({}, api, { speak: (t) => speak(t) }),
    onExit: () => { duel.destroy(); renderMap(); }
  });
  currentEngine = duel;
  duel.start();
}

/* ---------------- 8) PROFİL DİYALOĞU ---------------- */
function openProfileDialog() {
  if (!profile) return renderLogin();
  const grid = el('div', { class: 'avatar-grid', style: { maxWidth: '360px' } });
  const build = () => {
    clear(grid);
    for (const a of S.AVATARS) {
      const b = el('button', { class: 'avatar-opt', type: 'button', html: avatarHTML(a, { size: 64 }), ariaPressed: profile.avatar === a });
      b.addEventListener('click', () => { sfx('tap'); profile.avatar = a; S.saveProfile(profile); build(); updateHud(); });
      grid.append(b);
    }
  };
  build();
  const body = el('div', { class: 'center' },
    el('div', { class: 'profile-head' },
      el('div', { html: avatarHTML(profile.avatar, { size: 40 }) }),
      el('h2', { text: profile.nick })
    ),
    el('p', { class: 'small', text: `Sınıf ${profile.classCode} · ★ ${S.totalStars(profile)} · ● ${profile.coins}` }),
    el('div', { class: 'field' }, el('label', { text: 'Karakter değiştir' }), grid),
    el('div', { class: 'btn-row', style: { justifyContent: 'center' } },
      el('button', { class: 'btn primary sm', text: 'Tamam', onClick: () => close() }),
      el('button', {
        class: 'btn ghost sm', text: 'Oyuncu değiştir',
        onClick: () => { close(); clearActive(); profile = null; renderLogin(); }
      })
    )
  );
  const close = dialog(body);
}

/* ---------------- AÇILIŞ ---------------- */
/**
 * KLAVYE DESTEĞİ — konsol oyunlarında tuş takımı esastır.
 * 1-4: seçenek seç · Enter/Space: ileri · Esc: geri · M: müzik
 * Ayrıca fiziksel klavyesi olan tabletlerde oyun hissi artar.
 */
function klavyeBagla() {
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // yazı yazarken karışma
    const ekran = document.querySelector('.screen.active')?.dataset.screen;
    const tus = e.key;

    // 1-4 → cevap seçenekleri (oyun ekranlarında)
    if (ekran === 'game' && /^[1-4]$/.test(tus)) {
      const secenekler = [...document.querySelectorAll('.opt, .answer-btn, .choice')]
        .filter((b) => !b.disabled && b.offsetParent !== null);
      const hedef = secenekler[Number(tus) - 1];
      if (hedef) { e.preventDefault(); hedef.click(); }
      return;
    }
    // Enter / Space → ekrandaki ana buton
    if (tus === 'Enter' || tus === ' ') {
      const ana = [...document.querySelectorAll('button.btn.primary, button.btn.green, .dialog button')]
        .filter((b) => b.offsetParent !== null)[0];
      if (ana) { e.preventDefault(); ana.click(); }
      return;
    }
    // Esc → çık / geri
    if (tus === 'Escape') {
      if (ekran === 'game') { e.preventDefault(); quitLevel(); }
      else if (ekran && !['login', 'map'].includes(ekran)) { e.preventDefault(); renderMap(); }
      return;
    }
    // D → dersler, T → trofeler, S → dükkân (kısayol)
    if (ekran === 'map') {
      if (tus === 'd' || tus === 'D') renderLessons();
      if (tus === 't' || tus === 'T') renderTrophies();
      if (tus === 's' || tus === 'S') renderShop();
    }
  });
}

function bindHud() {
  document.getElementById('hud-profile').addEventListener('click', () => { sfx('tap'); openProfileDialog(); });
  document.getElementById('btn-sound').addEventListener('click', () => { settings.sound = !settings.sound; persistSettings(); sfx('click'); });
  document.getElementById('btn-voice').addEventListener('click', () => { settings.voice = !settings.voice; persistSettings(); if (settings.voice) speak('Sesli anlatım açık.'); });
  document.getElementById('btn-music').addEventListener('click', () => { settings.music = !settings.music; persistSettings(); if (settings.music) { unlockAudio(); startMusic(); } else stopMusic(); });
  document.getElementById('btn-bigtext').addEventListener('click', () => {
    settings.bigText = !settings.bigText;
    persistSettings();
    sfx('click');
    speak(settings.bigText ? 'Yazılar büyütüldü.' : 'Yazılar normal boyutta.');
  });
  document.getElementById('hud-stars').addEventListener('click', () => toast(`Toplam ${profile ? S.totalStars(profile) : 0} yıldız`));
}

/** Ortam görsellerini önceden yükle (ilk bölümde arka plan boş kalmasın) */
function preloadArt() {
  const ids = ['hero', ...WORLDS.map((w) => w.id)];
  for (const id of ids) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/bg/${id}.jpg`;
  }
  for (const slug of Object.values(S.AVATAR_SLUGS)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = `assets/avatars/${slug}.jpg`;
  }
  const pofi = new Image();
  pofi.src = 'assets/mascot/pofi.jpg';
}

function sparkles() {
  const box = document.getElementById('sparkles');
  if (!box) return;
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 70 + '%';
    s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
    box.append(s);
  }
}

function boot() {
  settings = S.loadSettings();
  audio.sound = settings.sound;
  audio.voice = settings.voice;
  S.bindWorlds(WORLDS);
  applyTextSize();                       // kayıtlı büyük-yazı ayarını uygula
  applyFreeMode();                       // kayıtlı serbest mod ayarını uygula
  applySpeechSpeed();                    // kayıtlı konuşma hızını uygula
  preloadSpeech();                       // doğal ses dosyalarını arka planda yükle
  window.adaConfetti = confetti;
  // Açılış ekranı (konsol oyunlarındaki yükleme + ipucu anı)
  acilisEkrani(() => {

  });

  bindHud();
  klavyeBagla();
  sparkles();
  preloadArt();
  document.addEventListener('pointerdown', () => unlockAudio(), { once: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopSpeaking(); });

  const act = getActive();
  const found = act ? S.loadProfile(act.nick, act.classCode) : null;
  if (found) {
    profile = found;
    renderMap();
    setTimeout(() => speak(`Hoş geldin ${profile.nick}!`), 300);
  } else {
    renderLogin();
  }
}

boot();
