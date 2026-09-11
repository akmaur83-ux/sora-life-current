// ============================================================
// COUPON CELEBRATION — frame cost during the confetti, 390px, 4× CPU
//
//   node scripts/perf-coupon-celebration.mjs [runs=5] [url=http://localhost:4187/cart]
//
// The gate: the modal must hold 60fps WHILE the confetti is falling, on a
// phone-sized viewport with the renderer throttled 4×. "Idle" is not measured
// — the counter starts the moment .celebrate appears and runs for the window
// in which every particle and ribbon is in flight.
//
// FRESH BROWSER PER RUN. Each iteration spawns its own Chrome with its own
// profile directory, so no compositor state, layer cache or JIT warmth
// carries from one run to the next. The median is reported, and the worst
// run is reported beside it because a gate is about the worst case.
//
// Two conditions, same harness:
//   confetti     prefers-reduced-motion: no-preference → 36 bits + 2 ribbons
//   reduced      prefers-reduced-motion: reduce        → no particles at all
// The reduced run is the ceiling: what the same page does with the same modal
// but nothing animating. The confetti number is read against it.
//
// The FPS figure is what this harness has always reported — the rAF callbacks
// the main thread could service per second. Headless Chrome does not vsync-
// cap it, so the ceiling sits well above 60; the gate is the floor.
//
// A third pass, not timed, captures screenshots at fixed offsets after the
// click so the mid-animation frame can be seen. Screenshots force paints, so
// they are never taken during a timed run.
//
// Uses the fixture server (scripts/dev-coupon-preview.mjs), never the live
// site: the live coupons table is empty, and it stays that way.
// ============================================================
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const RUNS = Number(process.argv[2] || 5);
const URL_ = process.argv[3] || 'http://localhost:4187/cart';
const CODE = 'SAVE15';
const MEASURE_MS = 2400;   // longest particle: 320ms delay + 2100ms fall
const OUT = join(HERE, '../reports/coupon-celebration');
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

// Seeds the cart before the app boots, and installs the long-task observer.
const BOOT = `
localStorage.setItem('sora.store.v1', JSON.stringify({
  cart: [{ key: '160', id: 160, variant: null, variantId: null, qty: 1 }],
  saved: [], couponCode: '', guestWish: [],
}));
window.__m = { long: [] };
try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.long.push(Math.round(e.duration)); })
    .observe({ type: 'longtask', buffered: true });
} catch (e) {}
`;

// Clicks Apply, waits for the modal, then counts frames for the full window
// in which particles are in flight. Returns null if the modal never came.
const MEASURE = `(async () => {
  const btn = document.querySelector('[aria-label="Apply ${CODE}"]');
  if (!btn) return JSON.stringify({ error: 'apply button not present' });
  window.__m.long.length = 0;
  btn.click();
  let modal = null;
  for (let i = 0; i < 100 && !modal; i++) { await new Promise(r => setTimeout(r, 50)); modal = document.querySelector('.celebrate'); }
  if (!modal) return JSON.stringify({ error: 'modal did not open' });
  const bits = modal.querySelectorAll('.celebrate__bit').length;
  const ribbons = modal.querySelectorAll('.celebrate__ribbon').length;
  const t0 = performance.now(); let frames = 0;
  let raf = 0; const tick = () => { frames++; raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick);
  await new Promise(r => setTimeout(r, ${MEASURE_MS}));
  cancelAnimationFrame(raf);
  const dur = performance.now() - t0;
  const stillOpen = !!document.querySelector('.celebrate');
  return JSON.stringify({
    fps: +(frames / (dur / 1000)).toFixed(1),
    frames, ms: Math.round(dur),
    longTasks: window.__m.long.length,
    worst: window.__m.long.length ? Math.max(...window.__m.long) : 0,
    bits, ribbons, stillOpen,
    saved: modal.querySelector('.celebrate__savedamt')?.textContent,
    total: modal.querySelector('.celebrate__total strong')?.textContent,
  });
})()`;

async function freshChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'celeb-'));
  const port = 9920 + Math.floor(Math.random() * 60);
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

async function openCart(cdp, reduced) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  for (const d of ['Page', 'Runtime']) await cdp.send(`${d}.enable`, {}, sessionId);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
  }, sessionId);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: BOOT }, sessionId);
  await cdp.send('Page.navigate', { url: URL_ }, sessionId);

  // Ready means: the offer to apply is on screen and the cart's own quote
  // has settled, so the click is the only thing the measurement contains.
  for (let t = 0; t < 40; t++) {
    await sleep(500);
    const r = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({ btn: !!document.querySelector('[aria-label="Apply ${CODE}"]'),
        requoting: !!document.querySelector('.is-requoting') })`,
      returnByValue: true,
    }, sessionId);
    const s = JSON.parse(r.result.value);
    if (s.btn && !s.requoting) { await sleep(800); return { targetId, sessionId }; }
  }
  throw new Error('cart never became ready');
}

async function timedRun(reduced) {
  const { chrome, profile, ws, cdp } = await freshChrome();
  try {
    const { sessionId } = await openCart(cdp, reduced);
    const r = JSON.parse((await cdp.send('Runtime.evaluate', {
      expression: MEASURE, awaitPromise: true, returnByValue: true,
    }, sessionId)).result.value);
    if (r.error) throw new Error(r.error);
    return r;
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function screenshotRun() {
  mkdirSync(OUT, { recursive: true });
  const { chrome, profile, ws, cdp } = await freshChrome();
  try {
    const { sessionId } = await openCart(cdp, false);
    const shot = async (name) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    };
    // Scroll the panel into view for the "panel" frame.
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector('.cartcoupon');
        const y = el.getBoundingClientRect().top + (document.scrollingElement.scrollTop) - 90;
        document.scrollingElement.scrollTo(0, y); return y; })()`,
    }, sessionId);
    await sleep(600);
    await shot('01-panel-390');

    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('[aria-label="Apply ${CODE}"]').click()`,
    }, sessionId);
    // The quote debounce is 250ms; the modal follows the response. 900ms
    // after the click lands inside the shower.
    await sleep(900);
    await shot('02-celebration-390');
    await sleep(500);
    await shot('03-celebration-late-390');
    // Let it auto-close, then frame the applied ticket.
    await sleep(2200);
    await cdp.send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector('.cartcoupon');
        const y = el.getBoundingClientRect().top + (document.scrollingElement.scrollTop) - 90;
        document.scrollingElement.scrollTo(0, y); })()`,
    }, sessionId);
    await sleep(500);
    await shot('04-applied-390');
    const state = JSON.parse((await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({ modalClosed: !document.querySelector('.celebrate'),
        applied: document.querySelector('.cartcoupon__applied')?.innerText.replace(/\\n+/g, ' | ') })`,
      returnByValue: true,
    }, sessionId)).result.value);
    return state;
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const report = (label, runs) => {
  const fps = runs.map((r) => r.fps); const lt = runs.map((r) => r.longTasks);
  console.log(`\n${label}`);
  console.log(`   bits ${runs[0].bits} · ribbons ${runs[0].ribbons} · modal still open at end: ${runs.every((r) => r.stillOpen)}`);
  console.log(`   figures shown  ${runs[0].saved}  →  new total ${runs[0].total}`);
  console.log(`   FPS during confetti   median ${med(fps)}   worst ${Math.min(...fps)}   runs [${fps.join(', ')}]`);
  console.log(`   long tasks            median ${med(lt)}   worst ${Math.max(...runs.map((r) => r.worst))}ms   runs [${lt.join(', ')}]`);
  return { median: med(fps), worst: Math.min(...fps) };
};

console.log(`\n390×844 @2x · CPU 4× · fresh Chrome per run · ${RUNS} runs · ${URL_}`);
const confetti = [];
for (let i = 0; i < RUNS; i++) { confetti.push(await timedRun(false)); process.stdout.write('.'); }
const reduced = [];
for (let i = 0; i < Math.min(RUNS, 3); i++) { reduced.push(await timedRun(true)); process.stdout.write('.'); }

const a = report('CONFETTI  (prefers-reduced-motion: no-preference)', confetti);
const b = report('CEILING   (prefers-reduced-motion: reduce — modal, no particles)', reduced);

const shots = await screenshotRun();
console.log(`\nscreenshots → reports/coupon-celebration/   (modal auto-closed: ${shots.modalClosed})`);
console.log(`   applied ticket reads: ${shots.applied}`);

const pass = a.worst >= 60;
console.log(`\n${pass ? 'GATE PASSED' : 'GATE FAILED'} — worst confetti run ${a.worst} fps vs 60 floor (ceiling ${b.median})\n`);
process.exit(pass ? 0 : 1);
