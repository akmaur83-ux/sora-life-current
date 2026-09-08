import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const checkout = read('src/pages/Checkout.jsx');
const account = read('src/pages/Account.jsx');
const passport = read('src/pages/Passport.jsx');
const header = read('src/components/Header.jsx');

for (const id of [
  'checkout-email', 'checkout-phone', 'checkout-first-name', 'checkout-last-name',
  'checkout-address', 'checkout-apartment', 'checkout-landmark', 'checkout-city',
  'checkout-state', 'checkout-pin',
]) {
  assert.match(checkout, new RegExp(`htmlFor="${id}"`));
  assert.match(checkout, new RegExp(`id="${id}"`));
}

for (const id of ['account-full-name', 'account-email', 'account-password']) {
  assert.match(account, new RegExp(`htmlFor="${id}"`));
  assert.match(account, new RegExp(`id="${id}"`));
}

for (const id of ['passport-order-number', 'passport-email']) {
  assert.match(passport, new RegExp(`htmlFor="${id}"`));
  assert.match(passport, new RegExp(`id="${id}"`));
}

assert.match(header, /className="input" aria-label="Search for products" placeholder="Search for products\.\.\."/);

console.log('PASS checkout, account, Passport, and drawer search inputs have programmatic labels');
