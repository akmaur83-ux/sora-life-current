// Offline regression tests: no settings/storage writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformSync } from '@babel/core';
import { mergeHeroCta, sanitizeHeroCta, heroCtaStyle } from '../src/lib/heroCtaAppearance.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

check('legacy slides receive bounded sensible defaults', () => {
  const value = sanitizeHeroCta();
  assert.equal(value.desktopPosition, 'flow');
  assert.equal(value.mobilePosition, 'auto');
  assert.equal(value.mobileX, 50); assert.equal(value.mobileY, 95);
  assert.equal(value.width, 118); assert.equal(value.paddingX, 14); assert.equal(value.paddingY, 7);
  assert.equal(value.fontSize, 13); assert.equal(value.fontWeight, 700);
});

check('unsafe and out-of-range fields are rejected or clamped', () => {
  const value = sanitizeHeroCta({ mobileX: -20, mobileY: 200, radius: 999, backgroundColor: 'red', textureUrl: 'javascript:alert(1)', iconUrl: 'https://cdn.example.com/icon.png' });
  assert.equal(value.mobileX, 0); assert.equal(value.mobileY, 100); assert.equal(value.radius, 40);
  assert.equal(value.backgroundColor, ''); assert.equal(value.textureUrl, ''); assert.equal(value.iconUrl, 'https://cdn.example.com/icon.png');
});

check('saving one slide preserves unrelated Homepage data and other slides', () => {
  const current = { bestseller_title: 'Loved', visuals: { offers: { gap: 24 } }, heroCtas: { first: { mobileX: 10 }, second: { mobileX: 80 } } };
  const next = mergeHeroCta(current, 'first', { mobileX: 20, textColor: '#ffffff' });
  assert.equal(next.visuals.offers.gap, 24); assert.equal(next.heroCtas.second.mobileX, 80);
  assert.equal(next.heroCtas.first.mobileX, 20); assert.equal(next.heroCtas.first.textColor, '#ffffff');
});

check('prototype-like slide IDs are rejected', () => assert.throws(() => mergeHeroCta({}, '__proto__', {}), /Invalid slide ID/));

check('structured styles expose no raw CSS input', () => {
  const style = heroCtaStyle({ backgroundColor: '#123456', fontSize: 15, shadow: 'subtle', width: 180 });
  assert.equal(style['--hcta-bg'], '#123456'); assert.equal(style['--hcta-font'], '15px'); assert.equal(style['--hcta-width'], '180px');
  assert.match(style['--hcta-shadow'], /0 2px 6px/);
});

check('Auto ignores legacy coordinates and resolves to the safe centered default', () => {
  const style = heroCtaStyle({ mobilePosition: 'auto', mobileX: 0, mobileY: 100 });
  assert.equal(style['--hcta-mobile-x'], '50%'); assert.equal(style['--hcta-mobile-y'], '95%');
});

function loadComponent() {
  const source = readFileSync(new URL('../src/components/HeroCta.jsx', import.meta.url), 'utf8');
  const { code } = transformSync(source, { configFile: false, babelrc: false, presets: [['@babel/preset-react', { runtime: 'classic' }]], plugins: [() => ({ visitor: {
    ImportDeclaration(path) { path.remove(); }, ExportDefaultDeclaration(path) { path.replaceWith(path.node.declaration); },
  } })] });
  const Link = ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children);
  const DeferredImage = (props) => React.createElement('img', props);
  return new Function('React', 'useState', 'Link', 'DeferredImage', 'sanitizeHeroCta', 'heroCtaStyle', `${code}; return HeroCta;`)(React, React.useState, Link, DeferredImage, sanitizeHeroCta, heroCtaStyle);
}

check('texture and icon render as decorative images in their selected order', () => {
  const HeroCta = loadComponent();
  const html = renderToStaticMarkup(React.createElement(HeroCta, { cta: { to: '/shop', label: 'Shop now' }, appearance: {
    textureUrl: 'https://cdn.example.com/texture.webp', iconUrl: 'https://cdn.example.com/icon.png', iconSide: 'right',
  } }));
  assert.match(html, /hero-cta__texture/); assert.match(html, /hero-cta__label[^>]*>Shop now/); assert.match(html, /hero-cta__icon/);
  assert.ok(html.indexOf('hero-cta__label') < html.indexOf('hero-cta__icon'));
});

check('Admin upload completion uses latest functional state', () => {
  const admin = readFileSync(new URL('../src/admin/components/HeroCtaAppearanceControls.jsx', import.meta.url), 'utf8');
  assert.match(admin, /onChange\(\(latest\) => \(\{ \.\.\.latest, \[name\]: url \}\)\)/);
  assert.match(admin, /Reset defaults/);
  assert.match(admin, /disabled=.*appearance\.mobilePosition !== 'custom'/s);
  assert.match(admin, /X runs left \(0%\) to right \(100%\)/);
});

console.log(`${passed} hero CTA appearance tests passed`);
