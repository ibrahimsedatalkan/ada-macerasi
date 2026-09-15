/* ============================================================
   main.js — akış: giriş → harita → bölüm → oyun → sonuç
   Engine sözleşmesi (her oyun modülü aynı arayüzü kullanır):
     createXGame({ root, level, api }) → { start(), destroy() }
   api: { speak, sfx, confetti, toast, recordAnswer, finish, profile }
   ============================================================ */

import { WORLDS, findWorld, findLevel, TYPE_LABEL, levelTopics } from './worlds.js';
import * as S from './state.js';
import { el, clear, dialog, confirmBox, toast, confetti, starsEl, mascot, mascotHTML, avatarHTML, avatarInline, esc, randInt, shuffle } from './ui.js';
import { audio, sfx, speak, stopSpeaking, unlockAudio, toggleMusic, startMusic, stopMusic } from './audio.js';
import { createMultiplyGame } from './games/multiply.js';
import * as C from './collect.js';
import { createSidesGame } from './games/sides.js';
import { createShapeHuntGame } from './games/shapehunt.js';
import { createDrawGame } from './games/draw.js';
import { createBossGame } from './games/boss.js';
import { createDuel } from './duel.js';
import { createDuelOnline } from './duel-online.js';
import * as online from './online.js';
import { Journey, expectedSteps } from './journey.js';

const ACTIVE_KEY = 'ada.active.v2';
const ENGINE_BY_TYPE = {
  multiply: createMultiplyGame,
  sides: createSidesGame,
  shapehunt: createShapeHuntGame,
  draw: createDrawGame,
  boss: createBossGame
};

let profile = null;
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
  document.getElementById('hud-avatar').innerHTML = profile
    ? C.avatarDressed(profile, { size: 30, avatarHTML })
    : avatarHTML('🦊', { size: 28 });
  document.getElementById('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
  document.getElementById('btn-voice').setAttribute('aria-pressed', String(!!settings.voice));
  document.getElementById('btn-music').setAttribute('aria-pressed', String(!!settings.music));
}

function persistSettings() {
  S.saveSettings(settings);
  audio.sound = settings.sound;
  audio.voice = settings.voice;
  if (settings.music) { if (!audio.music) startMusic(); } else if (audio.music) stopMusic();
  updateHud();
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
  speak: (t) => speak(t),
  sfx: (n) => sfx(n),
  confetti: (o) => confetti(o),
  toast: (m) => toast(m),
  recordAnswer: (a) => {
    if (profile) S.recordAnswer(profile, a);
    if (!journey) return;
    if (currentLevel?.level?.type === 'draw') return;   // çizimde ilerleme kapsama oranına bağlı
    if (a.correct) { journey.advance(); sfx('step'); } else { journey.stumble(); }
  },
  journeyProgress: (fraction) => journey?.setProgress(fraction),
  saveProfile: () => { if (profile) S.saveProfile(profile); },
  finish: (result) => finishLevel(result)
};

/* ---------------- 1) GİRİŞ ---------------- */
function renderLogin() {
  const root = showScreen('login');
  const panel = el('div', { class: 'panel narrow' },
    el('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } },
      el('div', { html: mascotHTML(92) }),
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
    el('div', { class: 'hint-pill', text: `★ ${stars} / ${maxS}` }),
    el('button', { class: 'btn sm yellow', text: '🎁 Dükkân', onClick: () => renderShop() }),
    el('button', { class: 'btn sm purple', text: '📖 Albüm', onClick: () => renderAlbum() }),
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
    sfx('unlock');
    confetti({ count: 70 });
    const ilk = yeni[0];
    speak(`Yeni çıkartma kazandın: ${ilk.name}!`, { force: true });
    dialog(el('div', { class: 'center' },
      el('div', { class: 'sticker-big', html: svgWrap(ilk.art) }),
      el('h2', { text: 'Yeni Çıkartma!' }),
      el('p', { class: 'hint-title', text: ilk.name }),
      el('p', { class: 'muted', text: ilk.desc }),
      yeni.length > 1 ? el('p', { class: 'small', text: `+${yeni.length - 1} çıkartma daha kazandın!` }) : null,
      el('div', { class: 'btn-row', style: { justifyContent: 'center', marginTop: '12px' } },
        el('button', { class: 'btn green', text: 'Harika!', onClick: () => close() }))
    ));
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
  currentEngine = factory({ root: stage, level, api });
  currentEngine.start();
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
function computeStars({ completed, correct, wrong }) {
  const total = correct + wrong;
  const acc = total ? correct / total : 0;
  if (!completed) return 0;
  if (acc >= 0.95) return 3;
  if (acc >= 0.78) return 2;
  return 1;
}

function finishLevel(result) {
  const { world, level } = currentLevel || {};
  if (!world || !level) return renderMap();
  if (currentEngine?.destroy) currentEngine.destroy();
  currentEngine = null;
  stopSpeaking();

  const stars = computeStars(result);
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
  renderResult({ world, level, result, stars, score, coins, improved: stars > before.stars, unlockedNew, nextLevel, seri, yeniHazine, yeniCikartma });
}

function renderResult({ world, level, result, stars, score, coins, improved, unlockedNew, nextLevel, seri = null, yeniHazine = [], yeniCikartma = [] }) {
  const root = showScreen('result');
  const mood = stars === 3 ? 'cheer' : stars === 2 ? 'happy' : stars === 1 ? 'think' : 'sad';
  const total = (result.correct || 0) + (result.wrong || 0);
  const acc = total ? Math.round(((result.correct || 0) / total) * 100) : 0;
  const msg = stars === 3 ? 'Muhteşem! Her şeyi doğru yaptın!' : stars === 2 ? 'Çok iyi! Neredeyse hepsi doğru.' : stars === 1 ? 'Güzel! Bir daha denersen daha iyi olacak.' : 'Olsun! Tekrar denemek en güzel öğrenme yoludur.';

  const starLine = el('div', { class: 'result-stars' });
  for (let i = 0; i < 3; i++) {
    const s = el('span', { class: 's' + (i < stars ? ' on' : ''), text: '★' });
    if (i < stars) s.style.animationDelay = (i * 0.22) + 's';
    starLine.append(s);
  }

  const panel = el('div', { class: 'panel' },
    el('div', { class: 'result-hero' },
      el('div', { style: { display: 'flex', justifyContent: 'center' } }, el('div', { html: mascotHTML(120, mood) })),
      el('h1', { text: stars > 0 ? 'Bölüm tamam!' : 'Tekrar deneyelim' }),
      el('p', { class: 'small', text: `${world.name} · ${level.title}` }),
      starLine,
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

function renderParent() {
  const root = showScreen('parent');
  const st = profile.stats;
  const total = st.correct + st.wrong;
  const acc = total ? Math.round((st.correct / total) * 100) : 0;

  const worldRows = WORLDS.map((w) => {
    const got = S.worldStars(profile, w);
    const max = w.levels.length * 3;
    return el('div', { class: 'mastery-row' },
      el('div', { text: `${w.emoji} ${w.name}` }),
      el('div', { class: 'mastery-bar' }, el('i', { style: { width: Math.round((got / max) * 100) + '%' } })),
      el('div', { class: 'muted', text: `★ ${got}/${max}` })
    );
  });

  const panel = el('div', { class: 'panel wide' },
    el('h1', { text: '👨‍👩‍👦 Veli / Öğretmen Paneli' }),
    el('p', { html: `${avatarInline(profile.avatar, 22)}<b>${esc(profile.nick)}</b> · Sınıf ${esc(profile.classCode)} · Toplam ★ ${S.totalStars(profile)} · Doğruluk %${acc} (${st.correct} doğru / ${st.wrong} yanlış)` }),

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
function bindHud() {
  document.getElementById('hud-profile').addEventListener('click', () => { sfx('tap'); openProfileDialog(); });
  document.getElementById('btn-sound').addEventListener('click', () => { settings.sound = !settings.sound; persistSettings(); sfx('click'); });
  document.getElementById('btn-voice').addEventListener('click', () => { settings.voice = !settings.voice; persistSettings(); if (settings.voice) speak('Sesli anlatım açık.'); });
  document.getElementById('btn-music').addEventListener('click', () => { settings.music = !settings.music; persistSettings(); if (settings.music) { unlockAudio(); startMusic(); } else stopMusic(); });
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
  window.adaConfetti = confetti;
  bindHud();
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
