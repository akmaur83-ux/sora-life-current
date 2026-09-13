// ============================================================
// PORTAL COLOUR AUDIT — is purple really gone, and is the studio cream?
//
//   node scripts/audit-portal-colors.mjs
//
// Opens the SSR pages written by ssr-portal-shots.mjs (file://, every
// network request blocked), reads the COMPUTED colour of every element —
// text, background, borders, outlines, and the backgrounds of ::before /
// ::after — and reports any that sit in the violet band of the hue wheel
// (250–300°) with enough saturation to be seen. Also confirms the page
// ground is near-black forest and that the storefront leaderboard page did
// not inherit a portal token.
//
// Exit 1 on any violation. Offline by construction.
// ============================================================
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = resolve(ROOT, 'reports/creator-portal');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }); }
  send(method, params = {}, sessionId) { const id = ++this.id;
    return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
}

// Runs in the page. Returns violations + the ground colour.
const AUDIT = `(() => {
  const toHsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
    return [h, s, l]; };
  const parse = (c) => { const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]] : null; };
  const props = ['color', 'background-color', 'border-top-color', 'border-left-color', 'outline-color', 'text-decoration-color'];
  const violations = []; let checked = 0;
  const gradientViolet = [];
  for (const el of document.querySelectorAll('*')) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && cs.content === 'none') continue;
      for (const p of props) {
        const rgba = parse(cs.getPropertyValue(p)); if (!rgba || rgba[3] < 0.05) continue; checked++;
        const [h, s, l] = toHsl(rgba[0], rgba[1], rgba[2]);
        if (h >= 250 && h <= 300 && s > 0.30 && l > 0.15 && l < 0.9) violations.push({ tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal === undefined ? String(el.className).slice(0, 60) : '', pseudo, prop: p, value: cs.getPropertyValue(p) });
      }
      const bg = cs.backgroundImage || '';
      for (const m of bg.matchAll(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/g)) { const [h, s] = toHsl(+m[1], +m[2], +m[3]); if (h >= 250 && h <= 300 && s > 0.3) gradientViolet.push({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), pseudo, bg: bg.slice(0, 80) }); }
    }
  }
  const root = document.querySelector('.crp') || document.querySelector('.hm-leaderboard') || document.body;
  const ground = getComputedStyle(root).backgroundColor;
  const side = document.querySelector('.cs-side'); const hasGlass = side ? getComputedStyle(side).backgroundColor : 'n/a';
  const storefrontLeak = document.querySelector('.hm-leaderboard') && !document.querySelector('.crp') ? getComputedStyle(document.body).getPropertyValue('--s-bg').trim() : '';
  return JSON.stringify({ checked, violations: violations.slice(0, 20), violationCount: violations.length, gradientViolet: gradientViolet.slice(0, 5), ground, hasGlass, storefrontLeak });
})()`;

async function audit(file) {
  const profile = mkdtempSync(join(tmpdir(), 'audit-'));
  const port = 9900 + Math.floor(Math.random() * 30);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio', '--allow-file-access-from-files'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(ws);
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    for (const d of ['Page', 'Runtime', 'Network']) await cdp.send(`${d}.enable`, {}, sessionId);
    await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] }, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
    await sleep(1500);
    const { result } = await cdp.send('Runtime.evaluate', { expression: AUDIT, returnByValue: true }, sessionId);
    return JSON.parse(result.value);
  } finally { ws.close(); chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}

let failed = 0;
for (const name of ['portal-dashboard', 'portal-dashboard-reference', 'portal-earnings', 'portal-analytics', 'portal-tier', 'portal-dashboard-empty', 'portal-earnings-empty', 'home-leaderboard']) {
  const file = join(DIR, `${name}.html`);
  if (!existsSync(file)) { console.log(`  SKIP  ${name} — run scripts/ssr-portal-shots.mjs first`); failed++; continue; }
  const r = await audit(file);
  const portal = name.startsWith('portal-');
  const groundOk = portal ? /rgb\(246, 243, 235\)/.test(r.ground) : true;
  const sideOk = !portal || /rgb\(30, 58, 47\)/.test(r.hasGlass);
  const ok = r.violationCount === 0 && r.gradientViolet.length === 0 && groundOk && sideOk && !r.storefrontLeak;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${r.checked} colours checked, ${r.violationCount} violet, ${r.gradientViolet.length} violet gradients, ground ${r.ground}${portal ? `, sidebar ${r.hasGlass}` : `, portal token leak: ${r.storefrontLeak || 'none'}`}`);
  for (const v of r.violations) console.log(`        ${v.tag}.${v.cls}${v.pseudo || ''} ${v.prop}: ${v.value}`);
  for (const v of r.gradientViolet) console.log(`        ${v.tag}.${v.cls}${v.pseudo || ''} background-image: ${v.bg}`);
  if (!ok) failed++;
}
console.log(failed ? `\n${failed} page(s) failed` : '\nALL PASS — no violet anywhere in the portal, ground is cream #F6F3EB, sidebar is forest, storefront untouched');
process.exit(failed ? 1 : 0);
