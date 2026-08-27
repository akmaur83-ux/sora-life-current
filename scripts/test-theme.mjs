// ============================================================
// Storefront Appearance theme — regression tests
//
//   node scripts/test-theme.mjs
//
// OFFLINE  — the pure theme.js core (defaults, validation, injection rejection,
//            the --st-* mapping, presets, independence guarantees).
// STATIC   — the 0015 migration's security shape.
// LIVE     — anon read/write posture (NOTEs if 0015 isn't applied yet).
// ============================================================
import { readFileSync } from 'node:fs';
import {
  TOKENS, DEFAULT_THEME, PRESETS, PRESET_LIST, HEX_RE,
  validateThemeValue, sanitizeTheme, themeToCssVars, overlayRgba,
} from '../src/lib/theme.js';

let pass = 0, fail = 0, note = 0;
const ok = (m, k = 'OFFLINE') => { console.log(`  PASS [${k}] ${m}`); pass++; };
const bad = (m, k = 'OFFLINE') => { console.log(`  FAIL [${k}] ${m}`); fail++; };
const inf = (m) => { console.log(`  NOTE ${m}`); note++; };
const t = (c, m, k) => (c ? ok(m, k) : bad(m, k));

const SQL = readFileSync('supabase/migrations/0015_storefront_theme.sql', 'utf8');

console.log('\n— Defaults —');
t(TOKENS.length >= 40, `theme exposes ${TOKENS.length} tokens`);
t(Object.keys(DEFAULT_THEME).length === TOKENS.length, 'DEFAULT_THEME covers every token');
t(TOKENS.filter((x) => x.type === 'color').every((x) => HEX_RE.test(x.default)), 'every color default is a valid #RRGGBB');
t(DEFAULT_THEME.category_bg === '#1A3226', 'category default = forest-800 (current)');
t(DEFAULT_THEME.discount_bg === '#E8B04B' && DEFAULT_THEME.discount_text === '#14261C', 'discount badge default = honey/dark (current)');
t(DEFAULT_THEME.new_bg === '#1E3A2F' && DEFAULT_THEME.new_text === '#F0F6F2', 'NEW badge default = forest-700/50 (current)');

console.log('\n— Existing appearance unchanged with defaults —');
t(Object.keys(themeToCssVars(DEFAULT_THEME)).length === 0, 'SORA Classic sets ZERO css vars (byte-identical storefront)');
t(Object.keys(themeToCssVars(PRESETS.sora_classic.theme)).length === 0, 'SORA Classic preset also sets zero vars');

console.log('\n— Storefront receives theme variables —');
{
  const vars = themeToCssVars({ ...DEFAULT_THEME, category_bg: '#D08E2C' });
  t(vars['--st-category-bg'] === '#D08E2C', 'category strip follows theme (--st-category-bg set)');
  t(!('--st-discount-bg' in vars) && !('--st-new-bg' in vars), 'unrelated tokens untouched when only category changes');
}
{
  const vars = themeToCssVars({ ...DEFAULT_THEME, discount_bg: '#B4552E', discount_text: '#FFFFFF' });
  t(vars['--st-discount-bg'] === '#B4552E' && vars['--st-discount-text'] === '#FFFFFF', 'discount badge follows theme');
  t(!('--st-new-bg' in vars) && !('--st-new-text' in vars), 'NEW badge is NOT affected by discount changes (independent)');
}
{
  const vars = themeToCssVars({ ...DEFAULT_THEME, new_bg: '#7A5476' });
  t(vars['--st-new-bg'] === '#7A5476', 'NEW badge independently controllable');
  t(!('--st-discount-bg' in vars), 'changing NEW badge does not touch the discount badge');
}
{
  const vars = themeToCssVars({ ...DEFAULT_THEME, brand_primary: '#123456' });
  t(vars['--color-primary'] === '#123456' && vars['--st-brand-primary'] === '#123456', 'brand tokens override the semantic :root token centrally');
}
{
  const vars = themeToCssVars({ ...DEFAULT_THEME, hero_overlay: 'strong' });
  t(vars['--st-hero-overlay'] === overlayRgba('strong'), 'overlay enum maps to an rgba value');
}

console.log('\n— Validation & injection rejection —');
t(validateThemeValue('category_bg', '#1A3226'), 'valid hex accepted');
t(!validateThemeValue('category_bg', '#GGG'), 'malformed hex rejected');
t(!validateThemeValue('category_bg', 'red'), 'named color rejected');
t(validateThemeValue('heading_scale', 'large') && !validateThemeValue('heading_scale', 'huge'), 'scale enum enforced');
t(validateThemeValue('hero_overlay', 'subtle') && !validateThemeValue('hero_overlay', 'evil'), 'overlay enum enforced');
for (const inj of ['url(https://x)', 'javascript:alert(1)', '#000;background:url(x)', '<script>', 'red;color:blue', '#fff " onload="']) {
  t(!validateThemeValue('category_bg', inj), `injection rejected: ${inj.slice(0, 24)}`);
}
{
  const dirty = { category_bg: 'url(evil)', discount_bg: '#E8B04B', evil_key: '<script>', __proto__hack: 'x' };
  const clean = sanitizeTheme(dirty);
  t(clean.category_bg === DEFAULT_THEME.category_bg, 'invalid color falls back to default in sanitizeTheme');
  t(clean.discount_bg === '#E8B04B', 'valid value preserved');
  t(!('evil_key' in clean) && !('__proto__hack' in clean), 'unknown keys whitelisted away');
  t(Object.keys(clean).length === TOKENS.length, 'sanitized theme contains only known keys');
}

console.log('\n— Presets —');
t(PRESET_LIST.length === 4, 'four presets exposed');
t(JSON.stringify(sanitizeTheme(PRESETS.sora_classic.theme)) === JSON.stringify(DEFAULT_THEME), 'SORA Classic preset == defaults');
for (const p of PRESET_LIST) {
  const clean = sanitizeTheme(p.theme);
  t(TOKENS.every((tk) => validateThemeValue(tk.key, clean[tk.key])), `preset “${p.name}” is fully valid`);
}
t(PRESETS.forest_orange.theme.discount_bg === '#D08E2C', 'Forest & Orange changes the discount badge');

console.log('\n— Migration security shape (STATIC) —');
t(/key in \('branding', 'announcement', 'contact', 'homepage', 'storefront_theme'\)/.test(SQL), 'public read allowlist includes storefront_theme (and nothing else new)', 'STATIC');
t(/create or replace function public\.admin_set_storefront_theme/.test(SQL), 'validating RPC defined', 'STATIC');
t(/if not public\.is_sora_admin\(\) then raise exception 'admin only'/.test(SQL), 'RPC is admin-gated', 'STATIC');
t(/revoke all on function public\.admin_set_storefront_theme\(jsonb\) from public, anon/.test(SQL), 'RPC revoked from anon', 'STATIC');
t(/\^#\[0-9A-Fa-f\]\{6\}\$/.test(SQL), 'RPC enforces #RRGGBB server-side', 'STATIC');
t(/raise exception 'invalid color for %/.test(SQL), 'RPC rejects invalid colors', 'STATIC');
t(/not in \('none','subtle','medium','strong'\)/.test(SQL) && /not in \('compact','normal','large'\)/.test(SQL), 'RPC enforces the closed enums', 'STATIC');
t(/v_out := coalesce\(v_defaults/.test(SQL), 'RPC rebuilds from defaults → unknown keys never stored (whitelist)', 'STATIC');
t(/on conflict \(key\) do nothing/.test(SQL), 'seed will not clobber an existing saved theme', 'STATIC');

console.log('\n— Live posture (anon) —');
try {
  const bundle = readFileSync('public/bundle.js', 'utf8');
  const URL = (bundle.match(/https:\/\/[a-z0-9]{15,}\.supabase\.co/) || [])[0];
  const KEY = (bundle.match(/sb_publishable_[A-Za-z0-9_\-]+/) || [])[0];
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  // anon cannot execute the admin writer
  const w = await fetch(`${URL}/rest/v1/rpc/admin_set_storefront_theme`, { method: 'POST', headers: H, body: JSON.stringify({ p_theme: { category_bg: '#000000' } }) });
  if (w.status === 404) inf('admin_set_storefront_theme not found — apply migration 0015 to enable saving');
  else t(w.status === 401 || w.status === 403, `anon cannot call admin_set_storefront_theme (${w.status})`, 'LIVE');
  // anon read of the theme (only works once 0015 adds it to the allowlist)
  const r = await fetch(`${URL}/rest/v1/site_settings?select=value&key=eq.storefront_theme`, { headers: H });
  const rows = await r.json().catch(() => []);
  if (Array.isArray(rows) && rows.length) ok('anon can READ storefront_theme (public presentation key)', 'LIVE');
  else inf('storefront_theme not yet public-readable — apply migration 0015');
} catch (e) { inf(`live probe skipped: ${e.message}`); }

console.log(`\n${pass} passed, ${fail} failed, ${note} notes\n`);
process.exit(fail ? 1 : 0);
