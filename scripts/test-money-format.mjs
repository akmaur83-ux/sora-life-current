// ============================================================
// Regression tests for the shared financial currency formatter.
//
//   node scripts/test-money-format.mjs
//
// Imports the REAL money2 / money from src/lib/format.js (package is
// "type":"module"), so a regression in the source is caught here.
// money2  → creator-program financial amounts, ALWAYS 2 decimals.
// money   → storefront/catalogue prices, unchanged (no forced decimals).
// ============================================================
import { money2, money } from '../src/lib/format.js';

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  if (got === want) { console.log(`  PASS  ${label}: ${got}`); pass++; }
  else { console.log(`  FAIL  ${label}: got ${got}, want ${want}`); fail++; }
};

console.log('\n— money2: required 2-decimal cases —');
eq(money2(393.6), '₹393.60', '393.6 → ₹393.60');
eq(money2(393.60), '₹393.60', '393.60 → ₹393.60');
eq(money2(0), '₹0.00', '0 → ₹0.00');
eq(money2(1000), '₹1,000.00', '1000 → ₹1,000.00');
eq(money2(12345.678), '₹12,345.68', '12345.678 → 2-decimal rounding');

console.log('\n— money2: robustness —');
eq(money2(100000), '₹1,00,000.00', 'Indian lakh grouping');
eq(money2(393.6, '$'), '$393.60', 'currency symbol override');
eq(money2(-100), '₹-100.00', 'reversal (negative) keeps 2 decimals');
eq(money2(393.605), '₹393.61', 'half-up rounding at the 2nd decimal');
eq(money2(2936), '₹2,936.00', 'whole rupees still show .00');
eq(money2(null), '₹0.00', 'null → ₹0.00 (no NaN)');
eq(money2(undefined), '₹0.00', 'undefined → ₹0.00 (no NaN)');
eq(money2(NaN), '₹0.00', 'NaN → ₹0.00');
eq(money2('393.6'), '₹393.60', 'numeric string coerces');

console.log('\n— money2: always exactly 2 decimals (invariant) —');
for (const v of [0, 5, 393.6, 393.605, 1000, 3936, 12345.678, 100000.1]) {
  const s = money2(v);
  (/\.\d{2}$/.test(s) ? pass++ : fail++, console.log(`  ${/\.\d{2}$/.test(s) ? 'PASS' : 'FAIL'}  ${v} → ${s} ends in 2 decimals`));
}

console.log('\n— money (storefront) unchanged: NO forced decimals —');
eq(money(1968), '₹1,968', 'whole price stays ₹1,968 (not ₹1,968.00)');
eq(money(0), '₹0', 'storefront 0 → ₹0');
eq(money(100000), '₹1,00,000', 'storefront lakh grouping, no decimals');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
