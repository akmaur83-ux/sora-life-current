import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  mountScrollBackground, supportsScrollBackground, scenesAreStaticAt, SCENE_MOTION_MIN_WIDTH,
} from '../src/lib/scrollBackground.js';

const browser = readFileSync(new URL('../src/components/ProductBrowser.jsx', import.meta.url), 'utf8');
assert.ok(browser.indexOf('className={`v2-fd') > browser.indexOf('{/* Mobile filter drawer */}'));

for (const path of ['/', '/shop', '/category/hair-care', '/category/skin-care/', '/product/example']) assert.ok(supportsScrollBackground(path));
for (const path of ['/cart', '/checkout', '/account', '/admin', '/creator', '/privacy']) assert.ok(!supportsScrollBackground(path));

// Scenes mount at every width now; below the desktop breakpoint they hold
// still instead of drifting.
assert.equal(SCENE_MOTION_MIN_WIDTH, 1024);
assert.equal(scenesAreStaticAt(false), true, 'narrow viewports get static scenes');
assert.equal(scenesAreStaticAt(true), false, 'desktop keeps the drift');

const listeners = new Map(), frames = new Map(), timers = new Map();
let serial = 0, intersect, mutate, disconnects = 0;
const classes = () => {
  const set = new Set();
  return { add: x => set.add(x), remove: x => set.delete(x), contains: x => set.has(x), toggle: (x, on) => on ? set.add(x) : set.delete(x) };
};
function element() {
  return { children: [], classList: classes(), dataset: {}, values: {},
    style: { setProperty(key, value) { this[key] = value; } },
    setAttribute(k, v) { this.values[k] = v; },
    appendChild(child) { this.children.push(child); },
    remove() { this.removed = true; },
    matches: selector => selector.split(', ').includes('.v2-shop__body'),
    replaceChildren(...children) { this.children = children; },
    getBoundingClientRect: () => ({ top: -2400, height: 5000 }),
  };
}
const host = element();
let present = true;
const root = { querySelectorAll: selector => {
  assert.ok(!selector.split(', ').includes('.v2-shop') && !selector.split(', ').includes('.v2-pdp-root'), 'scope excludes ancestors of fixed controls');
  return present ? [host] : [];
}, contains: () => present };
const reduced = { matches: false, addEventListener: (_, fn) => listeners.set('preference', fn), removeEventListener: () => listeners.delete('preference') };
globalThis.window = { innerHeight: 900, matchMedia: () => reduced, IntersectionObserver: true,
  addEventListener: (n, f) => listeners.set(n, f), removeEventListener: n => listeners.delete(n) };
globalThis.document = { hidden: false, createElement: element,
  addEventListener: (n, f) => listeners.set(n, f), removeEventListener: n => listeners.delete(n) };
globalThis.IntersectionObserver = class {
  constructor(fn) { intersect = fn; } observe() {} unobserve() {} disconnect() { disconnects++; }
};
globalThis.MutationObserver = class { constructor(fn) { mutate = fn; } observe() {} disconnect() { disconnects++; } };
globalThis.requestAnimationFrame = fn => { frames.set(++serial, fn); return serial; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.setTimeout = fn => { timers.set(++serial, fn); return serial; };
globalThis.clearTimeout = id => timers.delete(id);
const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };

const cleanup = mountScrollBackground(root);
assert.equal(host.children.length, 1);
const scene = host.children[0];
assert.equal(scene.values['aria-hidden'], 'true');
assert.equal(scene.children.length, 6, 'bounded decoration count, no product media');
mutate();
assert.equal(host.children.length, 1, 'unrelated DOM updates never duplicate scenes');
intersect([{ target: host, isIntersecting: true }]);
for (let n = 0; n < 30; n++) listeners.get('scroll')();
assert.equal(frames.size, 1, 'scroll events batch into one frame');
flush();
assert.ok(scene.classList.contains('sl-bg--moving'));
assert.equal(scene.style['--sl-bg-y'], '2400.0px');
assert.equal(scene.dataset.theme, 'nutrient', 'long listings change scene with scroll');
assert.equal(timers.size, 0, 'visible ambient motion does not schedule an idle cutoff');
assert.equal(frames.size, 0, 'CSS ambient motion needs no continuous JavaScript frame loop');
assert.ok(scene.classList.contains('sl-bg--moving'), 'visible scenes stay alive after scrolling stops');
listeners.get('scroll')(); flush();
document.hidden = true;
listeners.get('visibilitychange')();
assert.ok(!scene.classList.contains('sl-bg--moving'), 'background tabs pause');
document.hidden = false;
reduced.matches = true;
listeners.get('preference')(); listeners.get('scroll')();
assert.equal(frames.size, 0, 'reduced-motion users do not receive scroll frames');
reduced.matches = false;
listeners.get('preference')(); flush();
intersect([{ target: host, isIntersecting: false }]);
assert.ok(!scene.classList.contains('sl-bg--moving'), 'offscreen scenes pause');
present = false; mutate();
assert.ok(scene.removed, 'removed async sections release decorations');
cleanup();
assert.equal(disconnects, 2);
assert.equal(listeners.size, 0);
assert.equal(frames.size, 0);
assert.equal(timers.size, 0);
assert.ok(!host.classList.contains('sl-bg-host'));

// Static mode: scenes are still built and themed, but nothing is wired up to
// write to them afterwards. This is the whole point of the mode — the layer's
// content stops changing, so scrolling composites a cached paint.
{
  const staticHost = { ...element(), dataset: {}, matches: () => false };
  const staticRoot = { querySelectorAll: () => [staticHost], contains: () => true };
  const before = listeners.size;
  const cleanupStatic = mountScrollBackground(staticRoot, { staticScenes: true });

  assert.equal(staticHost.children.length, 1, 'a static scene is still built');
  assert.equal(staticHost.children[0].children.length, 6, 'and still carries its shapes');
  assert.ok(staticHost.classList.contains('sl-bg-host'));
  assert.equal(listeners.has('scroll'), false, 'no scroll listener in static mode');
  assert.equal(listeners.has('resize'), false, 'no resize listener in static mode');
  assert.equal(listeners.has('visibilitychange'), false, 'nothing to pause, nothing to watch');
  assert.equal(listeners.size, before, 'static mode registers no window listeners at all');

  // Even if something calls the waker, no frame is scheduled and no scene is
  // marked as moving, so the CSS keyframes stay paused.
  assert.equal(frames.size, 0);
  assert.ok(!staticHost.children[0].classList.contains('sl-bg--moving'));
  assert.equal(staticHost.children[0].style['--sl-bg-y'], undefined, 'no parallax write');

  cleanupStatic();
  assert.ok(!staticHost.classList.contains('sl-bg-host'), 'static mode still cleans up');
  assert.equal(listeners.size, 0);
  assert.equal(frames.size, 0);
}

console.log('PASS background route isolation, static-below-desktop scenes, bounded scenes, live CSS motion, scroll batching, offscreen/reduced-motion pause and cleanup');
