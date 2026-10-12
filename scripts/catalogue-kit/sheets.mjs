// ============================================================
// Reading and writing the kit's sheets.
//
// CSV is read with the admin importer's own parser (storeCatalogueCsv.js), so a
// file the kit accepts is split into cells exactly as the import will split it,
// and written the way the admin export writes it (UTF-8 with a byte-order mark,
// so a spreadsheet opens "₹" and "×" as written).
//
// XLSX is read without a dependency: an .xlsx is a zip of XML parts. This reads
// the stored and deflated entries, the shared strings, and one worksheet's cells
// (text, numbers, booleans, inline strings). Cell values come back as the text
// the workbook stores — a number keeps every digit (no "1.23E+11"), which is
// one reason to prefer a supplier's .xlsx over a CSV re-saved by Excel.
// Formulas give their last computed value. Dates come back as Excel serial
// numbers; no catalogue column is a date.
// ============================================================
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { parseCsv } from '../../src/lib/storeCatalogueCsv.js';

/** Rows as arrays of trimmed-at-the-edges strings; the first row is the header. */
export function readSheetFile(path, { sheet = null } = {}) {
  const buf = readFileSync(path);
  if (/\.xlsx$/i.test(path)) return readXlsx(buf, sheet);
  if (/\.xls$/i.test(path)) throw new Error(`${path}: the old .xls format is not read. Open it and "Save As" .xlsx or CSV UTF-8.`);
  return readCsvBuffer(buf, path);
}

export function readCsvBuffer(buf, path = 'file') {
  let text = buf.toString('utf8');
  // A file saved as ANSI/Windows-1252 decodes with replacement characters; say so instead of importing "�".
  if (text.includes('�')) {
    const latin = buf.toString('latin1');
    throw Object.assign(new Error(`${path} is not UTF-8 (₹, × or — would arrive garbled). In Excel use "Save As → CSV UTF-8 (Comma delimited)".`), { latin });
  }
  return parseCsv(text);
}

// ---------- writing ----------
const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(columns, rows) {
  return `﻿${[columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\n')}\n`;
}
/** Rows as objects keyed by the (lower-cased, trimmed) header. */
export function objects(rows) {
  if (!rows.length) return { head: [], rows: [] };
  const head = rows[0].map((h) => String(h).trim());
  // __line: the spreadsheet's own row number for an .xlsx; for a CSV, the count of non-blank rows (as the admin import numbers them).
  return { head, rows: rows.slice(1).map((r, i) => ({ __line: r.rowNumber ?? i + 2, ...Object.fromEntries(head.map((h, j) => [h, String(r[j] ?? '')])) })) };
}

// ---------- xlsx ----------
function unzip(buf) {
  // End of central directory: the last "PK\x05\x06".
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('This .xlsx is not a readable zip archive.');
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('This .xlsx has a damaged central directory.');
    const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28), extraLen = buf.readUInt16LE(at + 30), commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    entries.set(name, { method, size, local });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return (name) => {
    const e = entries.get(name);
    if (!e) return null;
    const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
    const raw = buf.subarray(start, start + e.size);
    if (e.method === 0) return raw.toString('utf8');
    if (e.method === 8) return inflateRawSync(raw).toString('utf8');
    throw new Error(`This .xlsx uses an unsupported compression (${e.method}).`);
  };
}
const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (m, e) => (
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]));
/** All <t> text inside a fragment (a shared string may be split into rich-text runs). */
const textOf = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)].map((m) => unescapeXml(m[1] || '')).join('');
const colIndex = (ref) => [...ref.replace(/[0-9]/g, '')].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;

export function xlsxSheetNames(buf) {
  const read = unzip(buf);
  return [...(read('xl/workbook.xml') || '').matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unescapeXml(m[1]));
}
export function readXlsx(buf, sheetName = null) {
  const read = unzip(buf);
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new Error('This .xlsx has no workbook.');
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => ({
    name: unescapeXml(/\bname="([^"]*)"/.exec(m[1])?.[1] || ''), rid: /\br:id="([^"]*)"/.exec(m[1])?.[1],
  }));
  const chosen = sheetName == null ? sheets[0] : sheets.find((s) => s.name === sheetName);
  if (!chosen) throw new Error(`No sheet named "${sheetName}". The workbook has: ${sheets.map((s) => s.name).join(', ')}.`);
  const rels = read('xl/_rels/workbook.xml.rels') || '';
  const target = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => m[1])
    .find((attrs) => new RegExp(`\\bId="${chosen.rid}"`).test(attrs))?.match(/\bTarget="([^"]*)"/)?.[1];
  if (!target) throw new Error(`Sheet "${chosen.name}" has no part in this .xlsx.`);
  const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  const xml = read(path);
  if (!xml) throw new Error(`Sheet "${chosen.name}" could not be read.`);
  const shared = [...(read('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const r = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1] || rows.length + 1) - 1;
    const cells = [];
    for (const c of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], inner = c[2] || '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="([^"]*)"/.exec(attrs)?.[1] || 'n';
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(inner);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (v != null) value = unescapeXml(v);
      cells[ref ? colIndex(ref) : cells.length] = value;
    }
    const row = Array.from(cells, (v) => v ?? '');
    row.rowNumber = r + 1;                       // the row number Excel shows, kept through the blank-row filter
    rows[r] = row;
  }
  return Array.from(rows, (r) => r ?? []).filter((r) => r.some((v) => String(v).trim() !== ''));
}
