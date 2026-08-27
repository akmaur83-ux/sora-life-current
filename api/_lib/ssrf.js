// ============================================================
// SSRF-safe URL validation + fetch, for the admin media importer.
//
// Only http/https on standard ports, no credentials, no internal hostnames,
// and the resolved IP(s) must be public — loopback, private, link-local
// (incl. the 169.254.169.254 cloud-metadata address), CGNAT, ULA and
// IPv4-mapped IPv6 are all rejected. Every redirect hop is re-validated.
// Bodies are size-capped by streaming so a lying/huge response can't OOM us.
// Limitation: global fetch resolves DNS again after validation. DNS-rebinding
// TOCTOU is NOT eliminated; addresses are not pinned to the validated lookup.
//
// Server-only. Never import from browser-bundled code.
// ============================================================
import dns from 'node:dns/promises';
import net from 'node:net';

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
  if (a === 100 && b >= 64 && b <= 127) return true;           // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true;        // benchmarking
  if (a >= 224) return true;                                   // multicast / reserved / broadcast
  return false;
}

function isPrivateIPv6(ip) {
  const s = ip.toLowerCase();
  if (s === '::1' || s === '::') return true;                  // loopback / unspecified
  if (/^fe[89ab]/.test(s)) return true;                        // fe80::/10 link-local
  if (/^f[cd]/.test(s)) return true;                           // fc00::/7 unique-local
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);          // IPv4-mapped
  if (m) return isPrivateIPv4(m[1]);
  return false;
}

const isPrivateIp = (ip) => (net.isIP(ip) === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip));

// Validate a single URL string; resolves DNS and rejects any private target.
// Returns the parsed URL on success, throws SsrfError otherwise.
export async function assertSafeUrl(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { throw new SsrfError('That is not a valid URL.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new SsrfError('Only http and https URLs are allowed.');
  if (u.username || u.password) throw new SsrfError('URLs containing credentials are not allowed.');
  const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
  if (port !== 80 && port !== 443) throw new SsrfError('Only standard web ports (80/443) are allowed.');
  const host = u.hostname;
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i.test(host)) {
    throw new SsrfError('Internal or local hostnames are not allowed.');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError('That URL points at a private or internal address.');
    return u;
  }
  let res;
  try { res = await dns.lookup(host, { all: true }); } catch { throw new SsrfError('Could not resolve that host.'); }
  if (!res || !res.length) throw new SsrfError('Could not resolve that host.');
  for (const r of res) {
    if (isPrivateIp(r.address)) throw new SsrfError('That host resolves to a private or internal address.');
  }
  return u;
}

// Fetch with manual redirect handling (each hop re-validated) and a hard byte
// cap enforced by streaming. `as` is 'text' or 'buffer'.
export async function safeFetch(raw, { as = 'buffer', maxBytes = 8 * 1024 * 1024, timeoutMs = 8000, maxRedirects = 3 } = {}) {
  let current = String(raw);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = await assertSafeUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(u.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SoraLifeMediaImporter/1.0 (+admin import)',
          Accept: as === 'text' ? 'text/html,application/xhtml+xml,*/*' : 'image/*,*/*',
        },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new SsrfError(e?.name === 'AbortError' ? 'The source took too long to respond.' : 'Could not reach the source.');
    }
    // Manual redirects — validate the next hop before following.
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      clearTimeout(timer);
      const loc = res.headers.get('location');
      if (!loc) throw new SsrfError('The source returned a redirect without a destination.');
      current = new URL(loc, u).href;
      continue;
    }
    if (!res.ok) { clearTimeout(timer); throw new SsrfError(`The source responded with status ${res.status}.`); }

    const declared = Number(res.headers.get('content-length') || 0);
    if (declared && declared > maxBytes) { clearTimeout(timer); throw new SsrfError('That file is larger than the 8MB limit.'); }

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
