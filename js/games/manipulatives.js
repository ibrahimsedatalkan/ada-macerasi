/* ============================================================
   manipulatives.js — DOKUNARAK SAYMA (somut → soyut köprüsü)

   PEDAGOJİK GEREKÇE
   -----------------
   7 yaş çocuğu Piaget'in "somut işlemler" dönemindedir: soyut sembolü
   (3 × 4) doğrudan kavramakta zorlanır, SOMUT NESNEYLE saymaya ihtiyaç
   duyar. Araştırmada en güçlü müdahale, çarpımı GRUP olarak göstermek ve
   parmakla saydırmaktır ("3 grup, her grupta 4'er tane").

   Bu araç:
     • Çarpımı görsel gruplara çevirir (3 × 4 = 3 grup × 4 nokta)
     • Her dokunuşta sayar: 1, 2, 3... (sesli + görsel)
     • Çocuk TOPLAMI kendi sayarak bulur — cevap verilmez, KEŞFETTİRİLİR
     • Keşif sonrası soyut cümle gösterilir: "3 × 4 = 12"
     • Böylece somut sayma ile soyut çarpım BAĞLANIR

   Neden cevabı söylemiyoruz: kendi sayarak bulan çocuk, sonucu ezberlemez,
   ANLAR. Bu, akılda kalıcılığı ölçülebilir biçimde artırır.
   ============================================================ */

import { el, clear } from '../ui.js';
import { speak, resetSpeech } from '../audio.js';
import { sayiMetni } from './questions.js';
import { sfx } from '../audio.js';

let aktif = null;      // açık olan sayaç (aynı anda tek)

/** Sayaç penceresini kapat */
export function sayaciKapat() {
  if (aktif) { aktif.remove(); aktif = null; resetSpeech(); }
}

/**
 * Dokunarak sayma panelini göster.
 * @param {{a:number,b:number}} q  — çarpım sorusu
 * @param {Element} ata           — panelin ekleneceği kapsayıcı
 * @param {Function} bitti        — tüm noktalar sayıldığında çağrılır
 */
export function sayaciAc(q, ata, bitti) {
  sayaciKapat();
  const a = Math.max(1, Math.min(10, Number(q.a) || 2));   // grup sayısı
  const b = Math.max(1, Math.min(10, Number(q.b) || 2));   // her grupta kaç tane
  let sayilan = 0;
  const toplam = a * b;

  const sayacEl = el('div', { class: 'sayac-sayi', text: '0' });
  const ipucuEl = el('div', { class: 'sayac-ipucu', text: `${a} grup var. Her grupta ${b} tane. Hepsine dokun ve say!` });
  const gruplar = el('div', { class: 'sayac-gruplar' });
  const noktalar = [];

  for (let g = 0; g < a; g++) {
    const grup = el('div', { class: 'sayac-grup' },
      el('div', { class: 'sayac-grup-no', text: `${g + 1}. grup` }));
    const ic = el('div', { class: 'sayac-grup-ic' });
    for (let i = 0; i < b; i++) {
      const n = el('button', { class: 'sayac-nokta', 'aria-label': `sayı ${g * b + i + 1}` });
      n.addEventListener('click', () => dokun(n));
      ic.append(n);
      noktalar.push(n);
    }
    grup.append(ic);
    gruplar.append(grup);
  }

  const sonucEl = el('div', { class: 'sayac-sonuc' });

  const panel = el('div', { class: 'sayac-panel' },
    el('div', { class: 'sayac-ust' },
      el('div', { class: 'sayac-baslik', text: '🔵 Dokunarak Say' }),
      el('button', { class: 'btn ghost sm', text: 'Kapat', onClick: () => sayaciKapat() })
    ),
    ipucuEl,
    gruplar,
    el('div', { class: 'sayac-alt' },
      el('div', { class: 'sayac-sayac' }, el('span', { class: 'sayac-etiket', text: 'Saydığın:' }), sayacEl),
      el('div', { class: 'sayac-toplam', text: `/ ${a * b}` })
    ),
    sonucEl
  );

  ata.append(panel);
  aktif = panel;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  function dokun(node) {
    if (node.classList.contains('sayildi')) return;
    node.classList.add('sayildi');
    sayilan++;
    sayacEl.textContent = String(sayilan);
    sfx('tap');
    // Sayıyı sesli oku — sayma becerisini pekiştirir
    speak(sayiMetni(sayilan), { force: true, key: 'sayac-' + sayilan + '-' + Date.now() });
    // Kısa titreşim (mobil)
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}

    if (sayilan === toplam) {
      // Keşif tamamlandı → SOYUT cümleye bağla
      sonucEl.append(
        el('div', { class: 'sayac-kesif' },
          el('div', { class: 'sk-satir', text: `Toplam ${toplam} tane saydın!` }),
          el('div', { class: 'sk-soyut', text: `${a} × ${b} = ${toplam}` }),
          el('div', { class: 'sk-aciklama', text: `${a} grup, her grupta ${b} tane → toplamda ${toplam}.` })
        )
      );
      sfx('unlock');
      resetSpeech();
      setTimeout(() => speak(`Toplam ${sayiMetni(toplam)}. Yani ${sayiMetni(a)} çarpı ${sayiMetni(b)} eşittir ${sayiMetni(toplam)}.`, { force: true }), 300);
      if (typeof bitti === 'function') setTimeout(() => bitti(toplam), 2200);
    }
  }

  return panel;
}
