/* TEST DURUMU SIFIRLAMA
   NEDEN GEREKLİ: Tüm test paketleri AYNI tarayıcıyı ve aynı çerez deposunu
   (localStorage) paylaşır. Bir paketin bıraktığı profil/ayar, sonraki
   paketin sonucunu değiştiriyordu: tek başına 14/14 geçen bir paket, toplu
   çalıştırmada 13/1 verebiliyordu.

   Bu betik her paketten ÖNCE çağrılır ve bilinen temiz duruma döndürür:
   tüm localStorage + sessionStorage silinir, sayfa yeniden yüklenir.

   Böylece her paket kendi durumunu kendisi kurar — sıralamadan bağımsız. */
import { connect } from './cdp.mjs';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const c = await connect();
try {
  await c.goto(`${B}/index.html`, 700);
  await c.evaluate(`(() => {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    return true;
  })()`);
  // Profil/ayar kalıntısı kalmasın diye yeniden yükle
  await c.goto(`${B}/index.html`, 700);
} catch (e) {
  console.error('sıfırlama hatası:', String(e));
}
process.exit(0);
