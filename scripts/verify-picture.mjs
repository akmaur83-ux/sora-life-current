// ============================================================
// <picture> VERIFICATION — which artwork does the browser actually fetch?
//
//   node scripts/verify-picture.mjs [url=http://localhost:4191/]
//
// The claim: below 1024px only image_url is downloaded; at 1024px and above
// only desktop_image_url is. That is the browser's decision, made from the
// <source media> attribute — so it has to be checked in a browser, by
// watching the network, not by reading markup.
//
// No hero slide carries a desktop image yet, and this script writes nothing
// to the database. Instead the Supabase REST response for hero_slides is
// intercepted in the headless browser and the first slide is given a
// desktop image that nothing else on the page uses: the locally shipped
// /media/hero-poster.jpg, which has 1024w/1600w WebP renditions beside it.
// Any request for those renditions can only have come from the <source>.
// ============================================================
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL_ = process.argv[2] || 'http://localhost:4191/';
const DESKTOP_IMAGE = '/media/hero-poster.jpg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result); }
      else if (m.method && this.handlers.has(m.method)) this.handlers.get(m.method)(m.params, m.sessionId); }); }
  send(method, params = {}, sessionId) { const id = ++this.id;
    return new Promise((res, rej) => { this.p.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
  on(method, fn) { this.handlers.set(method, fn); }
}

async function run(width, height, dpr) {
  const profile = mkdtempSync(join(tmpdir(), 'pic-'));
  const port = 9970 + Math.floor(Math.random() * 20);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300);
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(ws);
  const requests = [];
  let injected = false;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    for (const d of ['Page', 'Runtime', 'Network']) await cdp.send(`${d}.enable`, {}, sessionId);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: width < 768 }, sessionId);

    // Intercept the hero_slides response and give the first slide a desktop image.
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/rest/v1/hero_slides*', requestStage: 'Response' }] }, sessionId);
    cdp.on('Fetch.requestPaused', async (p, sid) => {
      try {
        const { body, base64Encoded } = await cdp.send('Fetch.getResponseBody', { requestId: p.requestId }, sid);
        const text = base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
        const rows = JSON.parse(text);
        if (Array.isArray(rows) && rows.length) { rows[0].desktop_image_url = DESKTOP_IMAGE; injected = true; }
        await cdp.send('Fetch.fulfillRequest', {
          requestId: p.requestId, responseCode: 200,
          responseHeaders: (p.responseHeaders || []).filter((h) => !/^content-length$/i.test(h.name)),
          body: Buffer.from(JSON.stringify(rows)).toString('base64'),
        }, sid);
      } catch (e) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }, sid).catch(() => {}); }
    });
    cdp.on('Network.requestWillBeSent', (p) => { if (p.type === 'Image') requests.push(p.request.url); });

    await cdp.send('Page.navigate', { url: URL_ }, sessionId);
    for (let t = 0; t < 40; t++) {
      await sleep(1000);
      const r = await cdp.send('Runtime.evaluate', { expression: `!!document.querySelector('.v2-hero__slide.is-active img')`, returnByValue: true }, sessionId);
      if (r.result.value) break;
    }
    await sleep(4000);

    const dom = JSON.parse((await cdp.send('Runtime.evaluate', { expression: `(() => {
      const media = document.querySelector('.v2-hero__slide.is-active .v2-hero__media');
      const pic = media && media.querySelector('picture');
      const img = media && media.querySelector('img');
      const src = pic && pic.querySelector('source');
      const r = media ? media.getBoundingClientRect() : null;
      return JSON.stringify({
        picture: !!pic,
        sourceMedia: src ? src.getAttribute('media') : null,
        chosen: img ? (img.currentSrc || '').split('/').slice(-1)[0] : null,
        natural: img ? [img.naturalWidth, img.naturalHeight] : null,
        frame: r ? [Math.round(r.width), Math.round(r.height)] : null,
        artworkClass: media ? media.classList.contains('v2-hero__media--artwork') : null,
        heroRatioVar: media ? media.style.getPropertyValue('--hero-ratio') : null,
      });
    })()`, returnByValue: true }, sessionId)).result.value);

    return { injected, dom, requests };
  } finally {
    ws.close(); chrome.kill(); await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

// Matches a full URL or a bare basename (currentSrc is reported as the latter).
const isDesktopFile = (u) => /hero-poster(-\d+)?\.(jpg|webp)/.test(u);
const isSlideObject = (u) => /product-images\/hero\//.test(u);

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n        ${detail}` : ''}`); if (!ok) failed++; };

for (const [label, w, hgt, dpr] of [['390px phone', 390, 844, 2], ['820px tablet', 820, 1100, 2], ['1440px desktop', 1440, 900, 1]]) {
  const r = await run(w, hgt, dpr);
  const desktopReqs = r.requests.filter(isDesktopFile);
  const slideReqs = r.requests.filter(isSlideObject);
  console.log(`\n${label}  (desktop image injected: ${r.injected})`);
  console.log(`   DOM: picture=${r.dom.picture} source=${r.dom.sourceMedia} chosen=${r.dom.chosen} natural=${JSON.stringify(r.dom.natural)} frame=${JSON.stringify(r.dom.frame)} artwork=${r.dom.artworkClass} ratioVar=${r.dom.heroRatioVar || '(none)'}`);
  check('the slide renders as a <picture> with a min-width:1024 source', r.dom.picture && r.dom.sourceMedia === '(min-width: 1024px)');
  if (w < 1024) {
    check('the browser fetched the mobile image_url object', slideReqs.length > 0, slideReqs[0]?.split('/').slice(-1)[0]);
    check('and NEVER the desktop file', desktopReqs.length === 0, desktopReqs.join(', '));
    check('currentSrc is the mobile image', /\.png/.test(r.dom.chosen || ''), r.dom.chosen);
  } else {
    check('the browser fetched the desktop file', desktopReqs.length > 0, desktopReqs.map((u) => u.split('/').slice(-1)[0]).join(', '));
    check('and NOT the mobile image_url object for the active slide', slideReqs.filter((u) => /ecb4356b2a4c/.test(u)).length === 0, slideReqs.map((u) => u.split('/').slice(-1)[0]).join(', ') || '(none)');
    check('currentSrc is the desktop rendition', isDesktopFile(r.dom.chosen || ''), r.dom.chosen);
    const [nw, nh] = r.dom.natural || [0, 1];
    const expected = Math.min(2.7, Math.max(1.6, nw / nh));
    check('the artwork-only frame follows the DESKTOP image\'s ratio', r.dom.artworkClass && r.dom.frame && Math.abs(r.dom.frame[0] / r.dom.frame[1] - expected) < 0.02,
      `natural ${nw}×${nh} (${(nw / nh).toFixed(3)}) → frame ${r.dom.frame?.join('×')} (${r.dom.frame ? (r.dom.frame[0] / r.dom.frame[1]).toFixed(3) : '?'})`);
  }
}
console.log(`\n${failed ? failed + ' FAILURE(S)' : 'ALL PASS — the browser downloads one artwork per viewport, chosen by the media query'}\n`);
process.exit(failed ? 1 : 0);
