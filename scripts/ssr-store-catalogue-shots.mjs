// ============================================================
// STATIC RENDER — the store catalogue admin screens at 1280 px.
//
//   node scripts/ssr-store-catalogue-shots.mjs
//   STORE_ADMIN_SHOTS_OUT=<dir> node scripts/ssr-store-catalogue-shots.mjs
//
// The real page (src/admin/pages/StoreCatalogue.jsx) inside the real admin
// shell (AdminLayout.jsx), driven by catalogue-admin-harness.mjs over the
// fixture catalogue: each screen is opened and, where it shows a state,
// brought there through the page's own handlers (a refused save, a CSV
// plan, the demo review…). The settled tree is rendered with react-dom/server,
// the stylesheets are inlined exactly as the build concatenates them
// (public/app.css, then build-css.mjs's deferred list from source, so the
// admin sheet is the current one), and each page is photographed at 1280 px
// from a file:// URL in headless Chrome with a throwaway profile and every
// http(s) request blocked. Nothing here talks to a server.
//
// Output defaults to <tmp>/sora-store-catalogue-admin (reports/ is tracked).
// ============================================================
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ROOT, read, h, loadModule, mount, openPage, imageFile, catalogueFixtures,
  fieldByLabel, buttonByText, formOf, change, submit, findAll,
} from './catalogue-admin-harness.mjs';

const OUT = resolve(process.env.STORE_ADMIN_SHOTS_OUT || join(tmpdir(), 'sora-store-catalogue-admin'));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WIDTH = 1280;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the shell ------------------------------------------------------------------------
function shell(path, pageTree) {
  const NavLink = ({ to, end, className, children }) => {
    const active = end ? path === to : path === to || path.startsWith(`${to}/`);
    return h('a', { href: to, className: typeof className === 'function' ? className({ isActive: active }) : className }, children);
  };
  const { default: AdminLayout } = loadModule('src/admin/AdminLayout.jsx', {
    NavLink, Outlet: () => pageTree, branding: { siteName: 'SORA LIFE' },
    useAdminAuth: () => ({ signOut() {}, session: { user: { email: 'admin@example.com' } } }),
  });
  return h(AdminLayout);
}

// ---- the screens ---------------------------------------------------------------------
const twoImages = () => {
  const f = catalogueFixtures();
  f.catalogue_product_media.push({ id: 'm-percale-2', product_id: 'hp-percale', storage_path: null, public_url: '/img/homeliving-product-bath-towel-set.webp', alt_text: 'Percale Sheet Set, folded', sort_order: 1, is_primary: false });
  return f;
};
const SCREENS = [
  ['list-fashion', 'Fashion products — list, status filter, demo badge', '/admin/store-catalogue/fashion', async () => openPage({ params: { store: 'fashion' } })],
  ['list-grocery', 'Grocery — not for sale yet', '/admin/store-catalogue/grocery', async () => openPage({ params: { store: 'grocery' } })],
  ['editor-inline-errors', 'Product editor — a refused save, errors beside their fields', '/admin/store-catalogue/fashion/fp-linen', async () => {
    const p = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
    const form = () => formOf(p.handle.tree, 'Linen Shirt');
    await p.handle.act(() => change(fieldByLabel(form(), 'Slug').control, 'wrap-dress'));
    await p.handle.act(() => change(fieldByLabel(form(), 'Selling price ₹ (optional)').control, '1500'));
    await p.handle.act(() => change(fieldByLabel(form(), 'HSN code (optional)').control, '62052'));
    await p.handle.act(() => submit(form()));
    return p;
  }],
  ['editor-stale', 'Product editor — saved elsewhere since it opened', '/admin/store-catalogue/fashion/fp-linen', async () => {
    const p = await openPage({ params: { store: 'fashion', productId: 'fp-linen' } });
    const theirs = await p.api.getStoreProduct('fashion', 'fp-linen');
    await p.api.saveStoreProduct('fashion', 'fp-linen', { ...theirs, description: 'Edited by another admin.' }, theirs.updated_at);
    const form = () => formOf(p.handle.tree, 'Linen Shirt');
    await p.handle.act(() => change(fieldByLabel(form(), 'Brand').control, 'Atelier'));
    await p.handle.act(() => submit(form()));
    return p;
  }],
  ['editor-homeliving', 'Home & Living editor — tax, claim warnings, gallery, variants', '/admin/store-catalogue/homeliving/hp-percale', async () => {
    const p = await openPage({ params: { store: 'homeliving', productId: 'hp-percale' }, fixtures: twoImages() });
    const form = () => formOf(p.handle.tree, 'Percale Sheet Set');
    await p.handle.act(() => change(fieldByLabel(form(), 'Description').control, 'A crisp 300-thread-count organic cotton percale set. Fast delivery across India.'));
    await p.handle.act(() => submit(form()));
    const input = findAll(p.handle.tree, (n) => n.type === 'input' && n.props.type === 'file' && n.props.multiple)[0];
    await p.handle.act(() => input.props.onChange({ target: { files: [imageFile('percale-detail.jpg', { detail: 0.08 }), imageFile('percale-noise.png', { detail: 3, type: 'image/png' })], value: '' } }));
    return p;
  }],
  ['categories', 'Categories — the editor open, a slug clash', '/admin/store-catalogue/homeliving', async () => {
    const p = await openPage({ params: { store: 'homeliving' }, search: 'tab=categories' });
    await p.handle.act(() => buttonByText(p.handle.tree, '+ Add category').props.onClick());
    const form = () => formOf(p.handle.tree, 'Add category');
    await p.handle.act(() => change(fieldByLabel(form(), 'Category name').control, 'Towels'));
    await p.handle.act(() => submit(form()));
    return p;
  }],
  ['csv-plan', 'Bulk import — a plan before applying', '/admin/store-catalogue/homeliving', async () => {
    const p = await openPage({ params: { store: 'homeliving' }, search: 'tab=import' });
    const text = ['slug,name,category,mrp,hsn_code,gst_rate,description',
      'percale-sheet-set,,,2299,6302 31,12,',
      'botanical-bedsheet-set-king,,,,630221,12,"Our sustainable cotton, delivered within 2 days."',
      'jute-rug-small,Jute Rug (Small),rugs-mats,1299,5702,12,',
      'cushion-cover-pair,Cushion Covers,cushion-covers,699,,,',
      'bath-towel-set-pack-of-2,,,,63021,,'].join('\n');
    const input = findAll(p.handle.tree, (n) => n.type === 'input' && n.props.type === 'file')[0];
    await p.handle.act(() => input.props.onChange({ target: { files: [{ name: 'homeliving-products.csv', text: async () => text }], value: '' } }));
    await p.handle.act(() => findAll(p.handle.tree, (n) => n.type === 'input' && n.props.type === 'checkbox')[1].props.onChange({ target: { checked: true } }));
    return p;
  }],
  ...[['bulk-images', 'Bulk images — the plan before uploading', false], ['bulk-images-done', 'Bulk images — after the upload', true]].map(([name, title, upload]) => [name, title, '/admin/store-catalogue/homeliving', async () => {
    const fixtures = catalogueFixtures();
    const percale = fixtures.catalogue_products.find((row) => row.id === 'hp-percale');
    for (const [id, pname, slug] of [['hp-sunlit', 'Sunlit Blossom Queen Bedsheet Set', 'sunlit-blossom-queen-bedsheet-set'], ['hp-chevron', 'Blue Chevron Single Bedsheet Set', 'blue-chevron-single-bedsheet-set']]) {
      fixtures.catalogue_products.push({ ...percale, id, name: pname, slug, brand: 'Homley', sku: null, stock: 0, images: [], is_active: false });
    }
    const p = await openPage({ params: { store: 'homeliving' }, search: 'tab=images', fixtures });
    const fits = (n) => imageFile(n, { width: 1600, height: 1435, type: 'image/webp', webpBytes: 140000 });
    const files = [...[1, 2, 3, 4, 5].map((n) => fits(`sunlit-blossom-queen-bedsheet-set-${n}.webp`)), ...[1, 2, 3, 4].map((n) => fits(`blue-chevron-single-bedsheet-set-${n}.webp`)),
      imageFile('blue-chevron-single-bedsheet-set-5.jpg', { detail: 3 }), fits('percale-sheet-set-1.webp'), fits('review-sheet.jpg')];
    const input = findAll(p.handle.tree, (n) => n.type === 'input' && n.props.type === 'file' && n.props.multiple)[0];
    await p.handle.act(() => input.props.onChange({ target: { files, value: '' } }));
    if (upload) await p.handle.act(() => findAll(p.handle.tree, (n) => n.type === 'button' && /^Upload /.test(n.props.children))[0].props.onClick());
    return p;
  }]),
  ['demo-rows', 'Demo rows — the review before deleting', '/admin/store-catalogue/homeliving', async () => {
    const p = await openPage({ params: { store: 'homeliving' } });
    await p.handle.act(() => buttonByText(p.handle.tree, 'Remove demo rows…').props.onClick());
    return p;
  }],
];

// ---- page assembly ---------------------------------------------------------------------
const deferred = [...read('build/build-css.mjs').match(/const DEFERRED = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+\.css)'/g)].map((m) => m[1]);
const dataUri = (f) => `data:image/webp;base64,${readFileSync(resolve(ROOT, 'img', f)).toString('base64')}`;
const inline = (html) => html.replace(/(src|href)="\/img\/([^"?]+\.webp)(\?[^"]*)?"/g, (_, attr, f) => `${attr}="${dataUri(f)}"`);
const css = [read('public/app.css'), ...deferred.map((rel) => `/* ${rel} */\n${read(rel)}`)].join('\n');
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style></head><body>${inline(body)}</body></html>`;

// ---- capture -------------------------------------------------------------------------
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map();
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && this.p.has(m.id)) { const { res, rej } = this.p.get(m.id); this.p.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } }); }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); }
}
async function shootAll(files) {
  const profile = mkdtempSync(join(tmpdir(), 'ssr-admin-'));
  const port = 9900 + Math.floor(Math.random() * 40);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--disable-extensions', '--mute-audio', '--hide-scrollbars', '--allow-file-access-from-files'], { stdio: 'ignore' });
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    for (const [file, png] of files) {
      await cdp.send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
      await sleep(1200);
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'Math.min(document.documentElement.scrollHeight, 9000)', returnByValue: true }, sessionId);
      const overflow = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement.scrollWidth > window.innerWidth', returnByValue: true }, sessionId);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: WIDTH, height: result.value, scale: 1 } }, sessionId);
      writeFileSync(png, Buffer.from(shot.data, 'base64'));
      console.log(`  ${png}  ${WIDTH}×${result.value}${overflow.result.value ? '  (horizontal overflow!)' : ''}`);
    }
    console.log(`  blocked network requests: ${blocked}`);
  } finally { ws.close(); chrome.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}

mkdirSync(OUT, { recursive: true });
const files = [];
for (const [name, title, path, open] of SCREENS) {
  const { handle } = await open();
  const framed = await mount(shell(path, handle.tree));
  const file = join(OUT, `${name}.html`);
  writeFileSync(file, page(`SSR — ${title}`, renderToStaticMarkup(framed.tree)));
  files.push([file, join(OUT, `${name}-${WIDTH}.png`)]);
}
console.log(`wrote ${files.length} pages under ${OUT}`);
await shootAll(files);
console.log('done');
