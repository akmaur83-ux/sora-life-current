// ============================================================
// HOMEPAGE SCROLL — frame cost through the discovery rails, 390px, 4× CPU
//
//   node scripts/perf-home-scroll.mjs [runs=5] [url=http://localhost:4173/]
//
// The standing gate for anything that touches the homepage: a phone-sized
// viewport, the renderer throttled 4×, a scripted scroll from the top down
// through Shop by Category and Shop by Concerns, counting the rAF callbacks
// serviced and the long tasks raised while it happens.
//
// FRESH BROWSER PER RUN — a new Chrome process and profile each iteration,
// so nothing warm carries over. Median and worst are both reported; a gate
// is about the worst case.
//
// The page must be READY before the scroll is timed: settings loaded, both
// rails mounted with tiles. A page still bootstrapping would scroll through
// nothing and report a ceiling, which is the mistake the very first homepage
// measurement in this project made.
//
// Also captures the Shop by Category rail at 390px, and records each tile's
// href, so the frame and the routing can be checked from the same run.
// ============================================================
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUNS = Number(process.argv[2] || 5);
const URL_ = process.argv[3] || 'http://localhost:4173/';
const LABEL = process.argv[4] || 'home';
const OUT = join(HERE, '../reports/home-tiles');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result); } }); }
  send(method, params = {}, sessionId) { const id = ++this.id;
    return new Promise((res, rej) => { this.p.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
}

const PROBE = `
window.__m = { long: [] };
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.long.push(Math.round(e.duration)); })
    .observe({ type: 'longtask', buffered: true });
} catch (e) {}
`;

const SCROLL = `(async () => {
  window.__m.long.length = 0;
  const se = document.scrollingElement;
  se.scrollTo({ top: 0, behavior: 'instant' });
  await new Promise(r => setTimeout(r, 400));
  const t0 = performance.now(); let frames = 0;
  let raf = 0; const tick = () => { frames++; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
  for (let i = 0; i < 12; i++) { se.scrollBy({ top: 500, behavior: 'instant' }); await new Promise(r => setTimeout(r, 250)); }
  cancelAnimationFrame(raf);
  const dur = performance.now() - t0;
  return JSON.stringify({
    fps: +(frames / (dur / 1000)).toFixed(1),
    longTasks: window.__m.long.length,
    worst: window.__m.long.length ? Math.max(...window.__m.long) : 0,
    tiles: document.querySelectorAll('.hd-tile__link').length,
  });
})()`;

async function freshChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'home-'));
  const port = 9930 + Math.floor(Math.random() * 60);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300);
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
  if (!wsUrl) throw new Error('Chrome did not expose a debugging endpoint');
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  return { chrome, profile, ws, cdp: new CDP(ws) };
}

async function openHome(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  for (const d of ['Page', 'Runtime']) await cdp.send(`${d}.enable`, {}, sessionId);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE }, sessionId);
  await cdp.send('Page.navigate', { url: URL_ }, sessionId);
  // Ready: not settling, both rails mounted with tiles.
  let ready = null;
  for (let t = 0; t < 60; t++) {
    await sleep(1000);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({ settling: !!document.querySelector('.page-main--settling'),
        rails: document.querySelectorAll('.hd-section').length,
        tiles: document.querySelectorAll('.hd-tile__link').length })`,
      returnByValue: true,
    }, sessionId);
    ready = JSON.parse(r.result.value);
    if (!ready.settling && ready.rails >= 2 && ready.tiles >= 6) break;
  }
  if (!(ready && !ready.settling && ready.rails >= 2 && ready.tiles >= 6)) {
    throw new Error(`homepage never became ready: ${JSON.stringify(ready)}`);
  }
  await sleep(1500);
  return { targetId, sessionId };
}

async function timedRun() {
  const { chrome, profile, ws, cdp } = await freshChrome();
  try {
    const { sessionId } = await openHome(cdp);
    return JSON.parse((await cdp.send('Runtime.evaluate', {
      expression: SCROLL, awaitPromise: true, returnByValue: true,
    }, sessionId)).result.value);
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function captureRun() {
  mkdirSync(OUT, { recursive: true });
  const { chrome, profile, ws, cdp } = await freshChrome();
  try {
    const { sessionId } = await openHome(cdp);
    const hrefs = JSON.parse((await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify([...document.querySelectorAll('.hd-section')].map(s => ({
        section: s.querySelector('h2')?.textContent?.trim(),
        links: [...s.querySelectorAll('a.hd-tile__link')].map(a => a.getAttribute('href')) })))`,
      returnByValue: true,
    }, sessionId)).result.value);
    // Frame the category rail, and rewind its scroller so the first tiles show.
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const h = [...document.querySelectorAll('.hd-section h2')].find(x => /category/i.test(x.textContent));
        const sec = h.closest('.hd-section');
        const y = sec.getBoundingClientRect().top + document.scrollingElement.scrollTop - 72;
        document.scrollingElement.scrollTo(0, y);
        const rail = sec.querySelector('[class*="rail"], ul'); if (rail) rail.scrollLeft = 0; })()`,
    }, sessionId);
    // Long enough for the tile artwork (Supabase storage, decoded at 4× CPU)
    // to finish painting; a frame with half-decoded tiles proves nothing.
    await sleep(7000);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const file = join(OUT, `${LABEL}-category-rail-390.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    return { hrefs, file };
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(`\n${LABEL} · 390×844 @2x · CPU 4× · fresh Chrome per run · ${RUNS} runs · ${URL_}`);
const runs = [];
for (let i = 0; i < RUNS; i++) { runs.push(await timedRun()); process.stdout.write('.'); }
const fps = runs.map((r) => r.fps); const lt = runs.map((r) => r.longTasks);
console.log(`\n   tiles mounted ${runs[0].tiles}`);
console.log(`   scroll FPS    median ${med(fps)}   worst ${Math.min(...fps)}   runs [${fps.join(', ')}]`);
console.log(`   long tasks    median ${med(lt)}   worst ${Math.max(...runs.map((r) => r.worst))}ms   runs [${lt.join(', ')}]`);

const cap = await captureRun();
console.log(`\n   screenshot → ${cap.file.replace(/\\/g, '/').split('/reports/')[1]}`);
for (const s of cap.hrefs) {
  console.log(`   ${s.section}`);
  for (const l of s.links) console.log(`      ${l}`);
}
const pass = Math.min(...fps) >= 60;
console.log(`\n${pass ? 'GATE PASSED' : 'GATE FAILED'} — worst run ${Math.min(...fps)} fps vs 60 floor\n`);
process.exit(pass ? 0 : 1);
