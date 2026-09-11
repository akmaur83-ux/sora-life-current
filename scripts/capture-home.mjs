// ============================================================
// HOMEPAGE CAPTURE — the same page, the same widths, before and after
//
//   node scripts/capture-home.mjs <label> <url>
//
// Writes to reports/home-rhythm/:
//   <label>-1440-top.png     hero → category strip → offers → first rail
//   <label>-1440-full.png    the whole page, for rhythm
//   <label>-390-top.png      the same region on a phone
//   <label>-390-full.png
//   <label>-sections.json    every section's height and padding at both widths
//
// The JSON is the part that proves "mobile unchanged": diff the 390 entries
// between two labels and every number must match.
// ============================================================
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LABEL = process.argv[2] || 'home';
const URL_ = process.argv[3] || 'http://localhost:4188/';
const OUT = join(HERE, '../reports/home-rhythm');
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

const SECTIONS = `(() => {
  const se = document.scrollingElement;
  const out = [];
  for (const s of document.querySelectorAll('main section')) {
    if (s.closest('section') !== s) continue;
    const r = s.getBoundingClientRect(); const cs = getComputedStyle(s);
    out.push({
      id: s.id || s.getAttribute('data-home-section') || s.className.split(' ').slice(0, 2).join('.'),
      h2: (s.querySelector('h2, h3')?.textContent || '').trim().slice(0, 28),
      top: Math.round(r.top + se.scrollTop), height: Math.round(r.height),
      padTop: cs.paddingTop, padBot: cs.paddingBottom, marginTop: cs.marginTop,
    });
  }
  const heroImg = [...document.querySelectorAll('.v2-hero__slide.is-active img')].find((i) => i.getBoundingClientRect().width > 300);
  const heroMedia = document.querySelector('.v2-hero__slide.is-active .v2-hero__media');
  const hero = heroImg && heroMedia ? (() => {
    const m = heroMedia.getBoundingClientRect(); const i = heroImg.getBoundingClientRect();
    const shownH = Math.min(i.height, m.height); const fullH = heroImg.naturalHeight * (i.width / heroImg.naturalWidth);
    return { natural: [heroImg.naturalWidth, heroImg.naturalHeight], frame: [Math.round(m.width), Math.round(m.height)], croppedPct: Math.round((1 - shownH / fullH) * 100) };
  })() : null;
  const poster = document.querySelector('.hp-offers__poster img');
  const cat = document.querySelector('.v2-cat__photo, .v2-cat__tile');
  return JSON.stringify({
    width: innerWidth, docHeight: se.scrollHeight, hero,
    poster: poster ? Math.round(poster.getBoundingClientRect().width) : null,
    categoryTile: cat ? Math.round(cat.getBoundingClientRect().width) : null,
    sections: out,
  });
})()`;

async function capture(width, height, dpr) {
  const profile = mkdtempSync(join(tmpdir(), 'cap-'));
  const port = 9960 + Math.floor(Math.random() * 30);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio', '--hide-scrollbars'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300);
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(ws);
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    for (const d of ['Page', 'Runtime']) await cdp.send(`${d}.enable`, {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: width < 768 }, sessionId);
    await cdp.send('Page.navigate', { url: URL_ }, sessionId);
    // Ready: rails mounted, then let the artwork land.
    for (let t = 0; t < 40; t++) {
      await sleep(1000);
      const r = await cdp.send('Runtime.evaluate', {
        expression: `document.querySelectorAll('.hd-tile__link').length >= 6 && !document.querySelector('.page-main--settling')`,
        returnByValue: true,
      }, sessionId);
      if (r.result.value) break;
    }
    // Walk the page so every deferred image is requested, then return to top.
    await cdp.send('Runtime.evaluate', {
      expression: `(async () => { const se = document.scrollingElement;
        for (let y = 0; y < se.scrollHeight; y += 600) { se.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
        se.scrollTo(0, 0); })()`, awaitPromise: true,
    }, sessionId);
    await sleep(6000);

    const meta = JSON.parse((await cdp.send('Runtime.evaluate', { expression: SECTIONS, returnByValue: true }, sessionId)).result.value);

    // The hero, at the top of the page.
    await cdp.send('Runtime.evaluate', { expression: 'document.scrollingElement.scrollTo(0, 0)' }, sessionId);
    await sleep(800);
    const heroShot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(OUT, `${LABEL}-${width}-hero.png`), Buffer.from(heroShot.data, 'base64'));

    // Top region: from the hero's bottom third through the first product rail.
    const strip = meta.sections.find((s) => /Browse by/i.test(s.h2));
    const topY = Math.max(0, (strip ? strip.top : 500) - 140);
    await cdp.send('Runtime.evaluate', { expression: `document.scrollingElement.scrollTo(0, ${topY})` }, sessionId);
    await sleep(1200);
    const top = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync(join(OUT, `${LABEL}-${width}-top.png`), Buffer.from(top.data, 'base64'));

    const offers = meta.sections.find((s) => /Current offers/i.test(s.h2));
    if (offers) {
      await cdp.send('Runtime.evaluate', { expression: `document.scrollingElement.scrollTo(0, ${offers.top - 60})` }, sessionId);
      await sleep(1000);
      const o = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      writeFileSync(join(OUT, `${LABEL}-${width}-offers.png`), Buffer.from(o.data, 'base64'));
    }
    await cdp.send('Runtime.evaluate', { expression: 'document.scrollingElement.scrollTo(0, 0)' }, sessionId);
    await sleep(600);
    const full = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.min(meta.docHeight, 9000), scale: width > 800 ? 0.5 : 1 } }, sessionId);
    writeFileSync(join(OUT, `${LABEL}-${width}-full.png`), Buffer.from(full.data, 'base64'));
    return meta;
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

mkdirSync(OUT, { recursive: true });
const desktop = await capture(Number(process.env.WIDTH || 1440), 900, 1);
const mobile = await capture(390, 844, 2);
writeFileSync(join(OUT, `${LABEL}-sections.json`), JSON.stringify({ desktop, mobile }, null, 1));

const row = (s) => `  ${String(s.id).slice(0, 26).padEnd(28)} ${String(s.h2).padEnd(30)} top ${String(s.top).padStart(5)}  h ${String(s.height).padStart(4)}  pad ${s.padTop}/${s.padBot}`;
console.log(`\n${LABEL} @1440  (poster ${desktop.poster}px, category tile ${desktop.categoryTile}px, page ${desktop.docHeight}px)`);
for (const s of desktop.sections) console.log(row(s));
console.log(`\n${LABEL} @390   (poster ${mobile.poster}px, category tile ${mobile.categoryTile}px, page ${mobile.docHeight}px)`);
for (const s of mobile.sections) console.log(row(s));
console.log(`\n→ reports/home-rhythm/${LABEL}-*.png, ${LABEL}-sections.json\n`);
