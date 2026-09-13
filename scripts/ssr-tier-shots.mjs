// ============================================================
// SSR SCREENSHOTS — creator leaderboard (homepage) and the portal tier tab
//
//   node scripts/ssr-tier-shots.mjs
//
// Renders the real components with react-dom/server against FIXTURE data,
// inlines the built stylesheets, writes two self-contained HTML files under
// reports/creator-tiers/, and photographs each at 390 and 1440 from a
// file:// URL in headless Chrome with every http(s) request blocked.
//
// Nothing here talks to a server. No production request, no Supabase, no
// fonts from Google (system fallbacks stand in for Fraunces and Inter).
// ============================================================
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import * as tiers from '../src/lib/creatorTiers.js';
import * as rewardRules from '../src/lib/creatorRewards.js';
import { money2 } from '../src/lib/format.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = resolve(ROOT, 'reports/creator-tiers');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

function component(rel, name, deps = {}) {
  const { code } = transformSync(read(rel), {
    configFile: false, babelrc: false,
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    plugins: [() => ({ visitor: {
      ImportDeclaration(path) { path.remove(); },
      ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
      ExportNamedDeclaration(path) { path.node.declaration ? path.replaceWith(path.node.declaration) : path.remove(); },
    } })],
  });
  const scope = { React, ...React, ...deps };
  return new Function(...Object.keys(scope), `${code}
; return ${name};`)(...Object.values(scope));
}
const h = React.createElement;
const Link = ({ to, children, ...props }) => h('a', { ...props, href: to }, children);
const Icon = ({ name }) => h('span', { 'data-icon': name });

// ---- fixtures ---------------------------------------------------------------
const NAMES = ['Anjali Sharma', 'Riya Mehta', 'Kabir Rao', 'Neha Iyer', 'Devansh Kulkarni', 'Meera Pillai', 'Aarav Sethi', 'Sana Qureshi', 'Ishaan Bhatt', 'Tara Menon',
  'Vihaan Joshi', 'Zoya Khan', 'Rohan Desai', 'Priya Nair', 'Arjun Verma', 'Diya Chawla', 'Yash Malhotra', 'Nisha Reddy', 'Kunal Kapoor', 'Ananya Bose'];
const RANK_FOR_LEVEL = (l) => tiers.DEFAULT_LADDER.find((x) => x.level === Math.min(l, 14))?.rank || 'Crown';
const LEVELS = [16, 15, 13, 11, 9, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 2, 1];
const leaderboard = Array.from({ length: 100 }, (_, i) => {
  const level = LEVELS[i] ?? 1;
  return { rank_position: i + 1, display_name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''), rank_name: RANK_FOR_LEVEL(level), level };
});
const standing = {
  ok: true, level: 7, rank: 'Royale', rate: 16, threshold: 125000, next_level: 8, next_threshold: 150000, next_rate: 17,
  lifetime_confirmed_sales: 138420, pending_sales: 9640, pending_commission: 1542.4, confirmed_commission: 19188.6,
  leaderboard_position: 7, leaderboard_total: 100, withdrawals_open: false, beyond_step: 25000,
  ladder: tiers.DEFAULT_LADDER.map((l) => ({ level: l.level, rank: l.rank, threshold: l.threshold, rate: l.rate })),
};
const rewards = {
  ok: true, level: 7,
  claims: [
    { id: 'k1', level: 3, label: 'SORA LIFE gift box', value: 'Starter set', reward_type: 'product', status: 'fulfilled', claimed_at: '2026-06-14T00:00:00Z' },
    { id: 'k2', level: 5, label: 'Cash reward', value: '₹2,000', reward_type: 'cash', status: 'pending', claimed_at: '2026-08-30T00:00:00Z' },
  ],
  claimable: [{ level: 7, rank: 'Royale', options: [
    { id: 'o1', option_index: 1, label: 'Royale product bundle', reward_type: 'product', value: 'Six full-size products', description: 'Chosen from the current bestsellers list and shipped to you.' },
    { id: 'o2', option_index: 2, label: 'Cash reward', reward_type: 'cash', value: '₹5,000', description: 'Paid with your next payout once withdrawals open.' },
    { id: 'o3', option_index: 3, label: 'Homepage feature', reward_type: 'other', value: 'One week', description: 'Your name and link on the SORA LIFE homepage.' },
  ] }],
};

// ---- render -----------------------------------------------------------------
const LeaderboardList = component('src/components/LeaderboardList.jsx', 'LeaderboardList', { ...tiers });
const HomeLeaderboard = component('src/components/HomeLeaderboard.jsx', 'HomeLeaderboard', { Link, LeaderboardList, getCreatorLeaderboard: async () => [] });
const CreatorTier = component('src/components/creator/CreatorTier.jsx', 'CreatorTier', { Link, Icon, LeaderboardList, money2, ...tiers, ...rewardRules });

const appCss = read('public/app.css');
const deferredCss = read('public/app-deferred.css');
const page = (title, body, extraCss = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${appCss}</style><style>${extraCss}</style></head><body>${body}</body></html>`;

const homeHtml = page('SSR — creator leaderboard',
  `<main class="page-main"><div class="v2-home">
     <section class="v2-sec" style="padding:32px 0"><div class="v2-wrap"><p class="v2-eyebrow">…preceding section (stub)</p><h2 class="v2-h2">Why shop SORA LIFE</h2></div></section>
     ${renderToStaticMarkup(h(HomeLeaderboard, { rows: leaderboard }))}
   </div></main>
   <footer class="ftr"><div class="container" style="padding-block:40px"><strong style="color:#FBF8F1">SORA LIFE</strong> <span>· footer (stub) — the seam above must be closed</span></div></footer>`);

const portalHtml = page('SSR — portal tier tab',
  `<div class="crp"><div class="container crp__body" style="grid-template-columns:1fr"><main class="crp__main">
     ${renderToStaticMarkup(h(CreatorTier, { standing, rewards, leaderboard, holdDays: 7, onClaim: async () => ({ ok: true }), onChanged: async () => {} }))}
   </main></div></div>`, deferredCss);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'home-leaderboard.html'), homeHtml);
writeFileSync(join(OUT, 'portal-tier.html'), portalHtml);
console.log('wrote', join(OUT, 'home-leaderboard.html'), 'and portal-tier.html');

// ---- screenshot ---------------------------------------------------------------
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }); }
  send(method, params = {}, sessionId) { const id = ++this.id;
    return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
}

async function shoot(file, width, height, outName) {
  const profile = mkdtempSync(join(tmpdir(), 'ssr-'));
  const port = 9940 + Math.floor(Math.random() * 30);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run',
    '--disable-extensions', '--mute-audio', '--hide-scrollbars', '--allow-file-access-from-files'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(ws);
  let blocked = 0;
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    for (const d of ['Page', 'Runtime', 'Network']) await cdp.send(`${d}.enable`, {}, sessionId);
    // Belt and braces: nothing leaves the machine.
    await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] }, sessionId);
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Network.loadingFailed' && /BLOCKED/.test(m.params?.blockedReason || '')) blocked++; });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }, sessionId);
    await cdp.send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
    await sleep(1200);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'Math.min(document.documentElement.scrollHeight, 12000)', returnByValue: true }, sessionId);
    const docHeight = result.value;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: docHeight, scale: 1 } }, sessionId);
    const out = join(OUT, outName);
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
    console.log(`  ${outName}  ${width}×${docHeight}  (network requests blocked: ${blocked})`);
  } finally { ws.close(); chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}

for (const [file, base] of [[join(OUT, 'home-leaderboard.html'), 'home-leaderboard'], [join(OUT, 'portal-tier.html'), 'portal-tier']]) {
  await shoot(file, 390, 844, `${base}-390.png`);
  await shoot(file, 1440, 900, `${base}-1440.png`);
}
console.log('done');
