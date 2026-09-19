// ============================================================
// Fashion store — SSR screenshots at 390 and 1440, no network.
//
//   node scripts/ssr-fashion-shots.mjs
//
// Renders the real pages through the real router with the seeded
// catalogue (scripts/fashion-ssr.mjs), inlines the built stylesheets and
// the six demo images as data URIs, and captures each page from file://
// with every http(s)/ws request blocked at the CDP level. Writes to
// reports/fashion/.
// ============================================================
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, buildFashionApp } from './fashion-ssr.mjs';
// Review only: SSR_FONTS_CSS may point at a stylesheet of inline @font-face rules so the zero-network file measures with the real faces. Not set in the repo.
const REVIEW_FONTS = process.env.SSR_FONTS_CSS ? readFileSync(process.env.SSR_FONTS_CSS, 'utf8') : '';

const OUT = resolve(ROOT, 'reports/fashion');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inlineCss = (css) => css.replace(/url\('\/img\/([^']+\.webp)'\)/g, (_, f) => `url('${dataUri(f)}')`);
// Every image eager for the capture: a lazy image below the first viewport
// would otherwise never decode in a file:// page that is never scrolled.
const inlineMarkup = (html) => html.replace(/src="\/img\/([^"]+\.webp)"/g, (_, f) => `src="${dataUri(f)}"`).replace(/loading="lazy"/g, 'loading="eager"');
const appCss = inlineCss(read('public/app.css'));
const deferredCss = inlineCss(read('public/app-deferred.css'));
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${REVIEW_FONTS}</style><style>${appCss}</style><style>${deferredCss}</style><style>body{margin:0;background:#FBF8F1}</style></head><body>${inlineMarkup(body)}</body></html>`;

const app = await buildFashionApp({ cartCount: 4, wishlist: ['00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000506'] });
mkdirSync(OUT, { recursive: true });
const pages = {
  'fashion-home': page('SSR — fashion home', app.render('/fashion')),
  'fashion-category-clothing': page('SSR — fashion category (level 1)', app.render('/fashion/c/clothing')),
  'fashion-category-mens-shirts-filtered': page('SSR — fashion category (level 3, filtered, list)', app.render('/fashion/c/mens-shirts?size=M&colour=Navy&view=list')),
  'fashion-pdp': page('SSR — fashion product page', app.render('/fashion/p/meadow-linen-shirt-sage')),
  'fashion-pdp-m-sage': page('SSR — fashion product page, M + Sage (out of stock)', app.render('/fashion/p/meadow-linen-shirt-sage?size=M&colour=Sage')),
  'fashion-pdp-m-navy': page('SSR — fashion product page, M + Navy (in stock)', app.render('/fashion/p/meadow-linen-shirt-sage?size=M&colour=Navy')),
  'fashion-empty': page('SSR — fashion home, nothing stocked', app.render('/fashion', { categories: [], products: [] })),
};
for (const [name, html] of Object.entries(pages)) writeFileSync(join(OUT, `${name}.html`), html);
console.log('wrote', Object.keys(pages).join(', '), 'under', OUT);

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
      if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }); }
  send(method, params = {}, sessionId) { const id = ++this.id;
    return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
}

async function shoot(file, width, height, outName) {
  const profile = mkdtempSync(join(tmpdir(), 'ssr-'));
  const port = 9970 + Math.floor(Math.random() * 25);
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
    await cdp.send('Network.setBlockedURLs', { urls: ['http://*', 'https://*', 'ws://*', 'wss://*'] }, sessionId);
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Network.loadingFailed' && /BLOCKED/.test(m.params?.blockedReason || '')) blocked++; });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 }, sessionId);
    await cdp.send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
    await sleep(3000);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'Math.min(document.documentElement.scrollHeight, 14000)', returnByValue: true }, sessionId);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: result.value, scale: 1 } }, sessionId);
    writeFileSync(join(OUT, outName), Buffer.from(shot.data, 'base64'));
    console.log(`  ${outName}  ${width}×${result.value}  (blocked requests: ${blocked})`);
  } finally {
    ws.close(); chrome.kill();
    await sleep(300);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

for (const name of Object.keys(pages)) {
  await shoot(join(OUT, `${name}.html`), 390, 844, `${name}-390.png`);
  await shoot(join(OUT, `${name}.html`), 1440, 900, `${name}-1440.png`);
}
console.log('done');
