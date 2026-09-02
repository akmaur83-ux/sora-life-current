// ============================================================
// SSRF-safe URL validation + fetch, for the admin media importer.
//
// Only http/https on standard ports, no credentials, no internal hostnames,
// and the resolved IP(s) must be public — loopback, private, link-local
// (incl. the 169.254.169.254 cloud-metadata address), CGNAT, ULA and
// IPv4-mapped IPv6 are all rejected. Every redirect hop is re-validated.
// Bodies are size-capped by streaming so a lying/huge response can't OOM us.
// Each connection is pinned to the exact public address set validated for
// that redirect hop, eliminating the validate-then-resolve DNS-rebinding gap.
//
// Server-only. Never import from browser-bundled code.
// ============================================================
import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent } from 'undici';

export class SsrfError extends Error {
  constructor(message) { super(message); this.name = 'SsrfError'; this.status = 400; }
}

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127) return true;          // this-host / private / loopback
  if (a === 169 && b === 254) return true;                     // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;            // private
  if (a === 192 && b === 168) return true;                     // private
  if (a === 192 && b === 0 && c === 0) return true;            // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true;            // TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true;          // deprecated 6to4 relay
  if (a === 100 && b >= 64 && b <= 127) return true;           // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;        // benchmarking
  if (a === 198 && b === 51 && c === 100) return true;         // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;          // TEST-NET-3
  if (a >= 224) return true;                                   // multicast / reserved / broadcast
  return false;
}

function parseIPv6(ip) {
  let source = String(ip).toLowerCase();
  if (source.startsWith('[') && source.endsWith(']')) source = source.slice(1, -1);
  const zone = source.indexOf('%');
  if (zone !== -1) source = source.slice(0, zone);

  // Convert a dotted IPv4 tail to its two hexadecimal groups first.
  if (source.includes('.')) {
    const colon = source.lastIndexOf(':');
    if (colon === -1) return null;
    const octets = source.slice(colon + 1).split('.').map(Number);
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    source = `${source.slice(0, colon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }

  if ((source.match(/::/g) || []).length > 1) return null;
  const compressed = source.includes('::');
  const [leftRaw, rightRaw = ''] = source.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if ((compressed && missing < 1) || (!compressed && missing !== 0)) return null;
  const groups = [...left, ...Array(compressed ? missing : 0).fill('0'), ...right];
  if (groups.length !== 8) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function ipv6InRange(value, base, prefix) {
  const shift = 128n - BigInt(prefix);
  return (value >> shift) === (base >> shift);
}

function isPrivateIPv6(ip) {
  const value = parseIPv6(ip);
  if (value === null) return true;
  const range = (base, prefix) => ipv6InRange(value, parseIPv6(base), prefix);
  if (value === 0n || value === 1n) return true;                // unspecified / loopback
  if (range('::', 96)) return true;                            // IPv4-compatible/reserved
  if (range('::ffff:0:0', 96)) {                               // IPv4-mapped
    const v4 = Number(value & 0xffffffffn);
    return isPrivateIPv4([v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join('.'));
  }
  if (range('64:ff9b:1::', 48)) return true;                   // local-use translation
  if (range('100::', 64)) return true;                         // discard-only
  if (range('2001::', 23)) return true;                        // special-purpose/transition
  if (range('2001:db8::', 32)) return true;                    // documentation
  if (range('2002::', 16)) return true;                        // 6to4 transition
  if (range('3fff::', 20) || range('5f00::', 16)) return true; // documentation/reserved
  if (range('fc00::', 7)) return true;                         // unique-local
  if (range('fe80::', 10) || range('fec0::', 10)) return true; // link/site-local
  if (range('ff00::', 8)) return true;                         // multicast
  return false;
}

const isPrivateIp = (ip) => (net.isIP(ip) === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip));

const normalizedHostname = (host) => String(host).replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();

async function resolveSafeTarget(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new SsrfError('That is not a valid URL.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new SsrfError('Only http and https URLs are allowed.');
  if (u.username || u.password) throw new SsrfError('URLs containing credentials are not allowed.');
  if (u.port) throw new SsrfError('Only standard web ports (80/443) are allowed.');
  const host = normalizedHostname(u.hostname);
  if (!host || /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i.test(host)) {
    throw new SsrfError('Internal or local hostnames are not allowed.');
  }

  const literalFamily = net.isIP(host);
  let addresses;
  if (literalFamily) {
    addresses = [{ address: host, family: literalFamily }];
  } else {
    // Single-label names are environment-dependent and can resolve through
    // enterprise search domains. Imports require an explicit DNS name.
    if (!host.includes('.')) throw new SsrfError('Internal or local hostnames are not allowed.');
    try { addresses = await dns.lookup(host, { all: true, verbatim: true }); }
    catch { throw new SsrfError('Could not resolve that host.'); }
  }
  if (!addresses?.length) throw new SsrfError('Could not resolve that host.');

  const pinned = addresses.map(({ address, family }) => ({ address: normalizedHostname(address), family: Number(family) }));
  for (const candidate of pinned) {
    if (![4, 6].includes(candidate.family) || net.isIP(candidate.address) !== candidate.family || isPrivateIp(candidate.address)) {
      throw new SsrfError('That host resolves to a private or internal address.');
    }
  }
  return { url: u, host, addresses: pinned };
}

function pinnedDispatcher(target) {
  const lookup = (hostname, options, callback) => {
    if (normalizedHostname(hostname) !== target.host) {
      callback(new Error('SSRF target changed after validation.'));
      return;
    }
    const family = Number(options?.family) || 0;
    const matches = family ? target.addresses.filter((entry) => entry.family === family) : target.addresses;
    if (!matches.length) {
      callback(Object.assign(new Error('No validated address for the requested family.'), { code: 'ENOTFOUND' }));
      return;
    }
    // Undici may request all addresses for family auto-selection. In either
    // mode it receives only the immutable addresses validated above, so the
    // connection cannot perform a second attacker-controlled DNS lookup.
    if (options?.all) callback(null, matches.map((entry) => ({ ...entry })));
    else callback(null, matches[0].address, matches[0].family);
  };
  return new Agent({ connect: { lookup } });
}

// Validate a single URL string; resolves DNS and rejects any private target.
// Returns the parsed URL on success, throws SsrfError otherwise.
export async function assertSafeUrl(raw) {
  return (await resolveSafeTarget(raw)).url;
}

// Fetch with manual redirect handling (each hop re-validated) and a hard byte
// cap enforced by streaming. `as` is 'text' or 'buffer'.
export async function safeFetch(raw, { as = 'buffer', maxBytes = 8 * 1024 * 1024, timeoutMs = 8000, maxRedirects = 3 } = {}) {
  let current = String(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const target = await resolveSafeTarget(current);
    const u = target.url;
    const dispatcher = pinnedDispatcher(target);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(u.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        dispatcher,
        headers: {
          'User-Agent': 'SoraLifeMediaImporter/1.0 (+admin import)',
          Accept: as === 'text' ? 'text/html,application/xhtml+xml,*/*' : 'image/*,*/*',
        },
      });
    } catch (e) {
      clearTimeout(timer);
      await dispatcher.close().catch(() => {});
      throw new SsrfError(e?.name === 'AbortError' ? 'The source took too long to respond.' : 'Could not reach the source.');
    }
    // Manual redirects — validate the next hop before following.
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      clearTimeout(timer);
      const loc = res.headers.get('location');
      await res.body?.cancel?.().catch(() => {});
      await dispatcher.close().catch(() => {});
      if (!loc) throw new SsrfError('The source returned a redirect without a destination.');
      current = new URL(loc, u).href;
      continue;
    }
    if (!res.ok) {
      clearTimeout(timer);
      await res.body?.cancel?.().catch(() => {});
      await dispatcher.close().catch(() => {});
      throw new SsrfError(`The source responded with status ${res.status}.`);
    }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared && declared > maxBytes) {
      clearTimeout(timer);
      await res.body?.cancel?.().catch(() => {});
      await dispatcher.close().catch(() => {});
      throw new SsrfError('That file is larger than the 8MB limit.');
    }

    // Stream with a byte cap so an unbounded/lying body can't exhaust memory.
    const chunks = [];
    let total = 0;
    try {
      const reader = res.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) { await reader.cancel(); throw new SsrfError('That file is larger than the 8MB limit.'); }
        chunks.push(Buffer.from(value));
      }
    } finally {
      clearTimeout(timer);
      await dispatcher.close().catch(() => {});
    }
    const buffer = Buffer.concat(chunks, total);
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (as === 'text') return { finalUrl: u.href, contentType, text: buffer.toString('utf8') };
    return { finalUrl: u.href, contentType, buffer };
  }
  throw new SsrfError('Too many redirects while fetching the source.');
}

// Magic-byte sniff. Returns a canonical image mime or null if not an image we
// accept — never trust the server's Content-Type alone.
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]))) return 'image/png';
  if (['GIF87a', 'GIF89a'].includes(buf.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('ascii').toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix') return 'image/heic';
    // mif1 is a generic HEIF container, not proof of AVIF. Require an AVIF
    // compatible brand inside its declared ftyp box before accepting it.
    if (brand === 'mif1' && buf.length >= 16) {
      const boxSize = buf.readUInt32BE(0);
      if (boxSize >= 20 && boxSize <= buf.length) {
        for (let offset = 16; offset + 4 <= boxSize; offset += 4) {
          if (['avif', 'avis'].includes(buf.subarray(offset, offset + 4).toString('ascii'))) return 'image/avif';
        }
      }
    }
  }
  return null;
}

const EXT_BY_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif',
};
export const IMPORT_ALLOWED_MIME = Object.keys(EXT_BY_MIME);
export const extForMime = (mime) => EXT_BY_MIME[mime] || null;

export function validateDownloadedImage({ contentType, buffer }) {
  const declared = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!IMPORT_ALLOWED_MIME.includes(declared)) {
    throw new SsrfError('Missing or unsupported image Content-Type.');
  }
  const detected = sniffImageType(buffer);
  if (!IMPORT_ALLOWED_MIME.includes(detected) || detected !== declared) {
    throw new SsrfError('Image Content-Type does not match supported image bytes.');
  }
  return detected;
}

// Pull candidate product-image URLs out of a product page's HTML. Prefers
// high-quality sources (og:image, WooCommerce data-large_image), collapses
// WooCommerce "-WxH" resize variants to their original, and keeps the page's
// own host first. Returns absolute URLs; the caller still validates each.
const decodeEntities = (s) => String(s)
  .replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&').replace(/&#x0*26;/gi, '&')
  .replace(/&quot;/gi, '"').replace(/&#0*39;/g, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');

export function discoverImageUrls(html, pageUrl) {
  const found = new Set();
  const add = (u) => {
    // HTML attributes encode `&` as `&amp;`; decode before parsing so the
    // stored/imported URL is the real one (otherwise import would 404).
    try { const abs = new URL(decodeEntities(u), pageUrl).href; if (/^https?:/i.test(abs)) found.add(abs); } catch { /* ignore */ }
  };
  const IMG = '(?:jpe?g|png|webp|gif|avif)';
  for (const m of html.matchAll(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']`, 'gi'))) add(m[1]);
  for (const m of html.matchAll(/data-large_image=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(new RegExp(`data-src=["']([^"']+\\.${IMG}[^"']*)["']`, 'gi'))) add(m[1]);
  for (const m of html.matchAll(new RegExp(`<img[^>]+src=["']([^"']+\\.${IMG}[^"']*)["']`, 'gi'))) add(m[1]);
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) { const u = part.trim().split(/\s+/)[0]; if (new RegExp(`\\.${IMG}`, 'i').test(u)) add(u); }
  }
  for (const m of html.matchAll(new RegExp(`https?:\\/\\/[^"'\\s)]+\\/wp-content\\/uploads\\/[^"'\\s)]+\\.${IMG}`, 'gi'))) add(m[0]);

  // Collapse "-300x300.jpg" → ".jpg" so we import originals, and dedupe.
  const norm = (u) => u.replace(new RegExp(`-\\d+x\\d+(\\.${IMG})(\\?.*)?$`, 'i'), '$1');
  const byOriginal = new Map();
  for (const u of found) { const key = norm(u); if (!byOriginal.has(key)) byOriginal.set(key, key); }

  let pageHost = '';
  try { pageHost = new URL(pageUrl).host; } catch { /* ignore */ }
  const list = [...byOriginal.values()].map((url) => {
    let host = ''; try { host = new URL(url).host; } catch { /* ignore */ }
    return { url, host, sameSite: host === pageHost };
  });
  list.sort((a, b) => (b.sameSite ? 1 : 0) - (a.sameSite ? 1 : 0));
  const sameSite = list.filter((x) => x.sameSite);
  return (sameSite.length ? sameSite : list).slice(0, 40);
}
