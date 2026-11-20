// ============================================================
// CSV for the admin's downloads (2026-11-20: orders, partner sales). Opens in Excel and
// Google Sheets. Every cell is quoted; a cell that starts with = + - @ (or a tab/CR) is
// prefixed with ' so a spreadsheet never runs it as a formula (CSV injection).
// ============================================================

/** One cell, quoted and made safe. Numbers stay numbers. Pure. */
function csvCell(v) {
  if (v === null || v === undefined) return '""';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  let t = String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

/** rows → CSV text with a header row; `columns` is [[header, row => value], …]. Pure. */
function toCsv(rows, columns) {
  const head = columns.map(([h]) => csvCell(h)).join(',');
  const body = (Array.isArray(rows) ? rows : []).map(r => columns.map(([, get]) => csvCell(get(r))).join(','));
  return [head, ...body].join('\r\n');
}

/** Saves the text as a .csv file in the browser (with a BOM so Excel reads ₹ and Hindi right). */
function downloadCsv(filename, text) {
  const blob = new Blob(['﻿', text], {
    type: 'text/csv;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { downloadCsv as d, toCsv as t };
//# sourceMappingURL=csv.js.map
