/* Minimal, bağımlılıksız CDP sürücüsü (Node 22 global WebSocket).
   Yerel test için: chrome --headless=new --remote-debugging-port=9222 */
import fs from 'node:fs';

export async function connect(port = 9222) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('CDP page target yok');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const events = [];
  const consoleMsgs = [];

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    events.push(m);
    if (m.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push(m.params.type + ': ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    }
  };

  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
      console.log('   [eval hatası] ' + (r.result.exceptionDetails.exception?.description || '').split('\n')[0] + '  ← ' + expression.slice(0, 70));
      return null;
    }
    return r.result?.result?.value;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const goto = async (url, waitMs = 1500, secenek = {}) => {
    await send('Page.navigate', { url });
    await sleep(waitMs);
    // Test hızlı modu: açılış ekranını ve bölüm geri sayımını atla.
    // (secenek.keepIntro = true ise açılış ekranı KORUNUR — onu test eden
    //  dosyalar için: sahne-verify)
    if (!secenek.keepIntro) try {
      await evaluate(`(() => {
        window.__hizliMod = true;
        try { sessionStorage.setItem('ada_hizli', '1'); } catch (e) {}
        // Açılış ekranı DOKUNMA bekler; yalnız silmek boot'u durdurur
        // (promise çözülmez). Bu yüzden önce TIKLA, sonra sil.
        const a = document.querySelector('.acilis');
        if (a) { try { a.click(); } catch (e) {} a.remove(); }
        return true;
      })()`);
    } catch (e) {}

  };

  const clickSelector = async (sel, waitMs = 350) => {
    const ok = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
    await sleep(waitMs);
    return ok;
  };

  const clickByText = async (text, tag = 'button', waitMs = 400) => {
    const ok = await evaluate(`(() => {
      const nodes = [...document.querySelectorAll(${JSON.stringify(tag)})];
      const e = nodes.find(n => (n.textContent||'').trim().includes(${JSON.stringify(text)}));
      if (!e) return false; e.click(); return true; })()`);
    await sleep(waitMs);
    return ok;
  };

  const screenshot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (!r.result?.data) return null;
    fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    return file;
  };

  const viewport = async (width = 1280, height = 900) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  };

  const mouse = async (type, x, y, extra = {}) => {
    await send('Input.dispatchMouseEvent', Object.assign({
      type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1
    }, extra));
  };

  const initErrors = async () => {
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: 'window.__errs=[];window.addEventListener("error",e=>window.__errs.push("ERR: "+e.message+" @"+e.filename+":"+e.lineno));window.addEventListener("unhandledrejection",e=>window.__errs.push("REJ: "+e.reason));'
    });
  };

  const errors = async () => (await evaluate('JSON.stringify(window.__errs||[])')) || '[]';

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  return { send, evaluate, goto, clickSelector, clickByText, screenshot, mouse, viewport, sleep, initErrors, errors, consoleMsgs, events, ws };
}

export const result = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  return ok;
};
