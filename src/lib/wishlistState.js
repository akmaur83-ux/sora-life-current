// ============================================================
// Wishlist state machine — pure, no React, no Supabase.
//
// Lives apart from store.jsx so the ownership invariants can be executed
// directly in Node (scripts/test-wishlist-sync.mjs) rather than asserted
// against source text. The rule this file exists to enforce:
//
//   guestWish    belongs to the BROWSER. Persisted. Survives sign-out.
//   accountWish  belongs to the SIGNED-IN CUSTOMER. Memory only. Cleared
//                on sign-out.
//
// One customer's saved items must never become visible to the next person
// who signs in on the same browser, and the only thing that guarantees that
// is accountWish never being persisted and always being cleared.
// ============================================================

// Matches the length bound in migration 0021.
export const MAX_KEY_LENGTH = 64;

// The only fields written to localStorage. accountWish and syncedUserId are
// deliberately absent.
export const PERSISTED_KEYS = ['cart', 'saved', 'guestWish'];

export const initialWishlistState = {
  guestWish: [],
  accountWish: [],
  syncedUserId: null,
};

/**
 * The single definition of a wishlist key.
 *
 * The catalogue exposes ids as `biosash_id || id`, so a numeric row id
 * arrives as a number on some paths and a string on others. productById is a
 * plain object whose keys are strings either way, so normalising to String is
 * what stops 5 and '5' becoming two entries.
 *
 * Returns '' for anything unusable; every caller treats that as "skip".
 */
export function normalizeKey(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object') return '';
  const key = String(raw).trim();
  if (!key || key.length > MAX_KEY_LENGTH) return '';
  // What String() produces from a failed lookup — never a real catalogue key.
  if (key === 'undefined' || key === 'null' || key === 'NaN') return '';
  return key;
}

/** Normalise a list, dropping invalid entries and duplicates, order kept. */
export function normalizeKeys(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const key = normalizeKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** The array the UI renders: guest items, plus account items when signed in. */
export function visibleWishlist(state) {
  const guest = state.guestWish || [];
  if (!state.syncedUserId) return guest;
  const seen = new Set(guest);
  return [...guest, ...(state.accountWish || []).filter((k) => !seen.has(k))];
}

/**
 * What a login merge should do, given the guest list captured at login and
 * the customer's existing remote list.
 *
 * `missing` is what must be written (guest items not already saved);
 * `union` is what the account list becomes. Pure, so the merge rules are
 * testable without a network or a React tree.
 */
export function planWishlistSync({ guestAtLogin, remote }) {
  const guest = normalizeKeys(guestAtLogin);
  const saved = normalizeKeys(remote);
  const savedSet = new Set(saved);
  const missing = guest.filter((k) => !savedSet.has(k));
  return { missing, union: [...saved, ...missing] };
}

/**
 * Wishlist reducer cases. Returns the SAME state object when an action is
 * not a wishlist action, so store.jsx can delegate and fall through.
 */
export function wishlistReducer(state, action) {
  switch (action.type) {
    // Signed OUT: the browser's own list, no network involved.
    case 'WISH_GUEST_TOGGLE': {
      const key = normalizeKey(action.key);
      if (!key) return state;
      const has = state.guestWish.includes(key);
      return {
        ...state,
        guestWish: has ? state.guestWish.filter((k) => k !== key) : [...state.guestWish, key],
      };
    }

    // Signed IN, saving: ACCOUNT list only. Adding it to guestWish as well
    // would make it survive sign-out and show up for whoever signs in next.
    case 'WISH_ACCOUNT_ADD': {
      const key = normalizeKey(action.key);
      if (!key || state.accountWish.includes(key)) return state;
      return { ...state, accountWish: [...state.accountWish, key] };
    }

    // Signed IN, removing: clears BOTH lists. The visible list is their
    // union, so a leftover guest copy would make the item reappear and the
    // removal look broken.
    case 'WISH_ACCOUNT_REMOVE': {
      const key = normalizeKey(action.key);
      if (!key) return state;
      return {
        ...state,
        accountWish: state.accountWish.filter((k) => k !== key),
        guestWish: state.guestWish.filter((k) => k !== key),
      };
    }

    // A completed login merge.
    case 'WISH_SYNCED':
      return { ...state, accountWish: normalizeKeys(action.keys), syncedUserId: action.userId };

    // Sign-out or account switch. Drops every account-only item; the guest
    // list is untouched, and nothing remote is deleted.
    case 'WISH_SESSION_CLEARED':
      return { ...state, accountWish: [], syncedUserId: null };

    default:
      return state;
  }
}

/**
 * Parse persisted store state, migrating the pre-sync format.
 *
 * Before cross-device sync this was a single `wishlist` array of raw product
 * ids. Those items belong to the browser, so they become guestWish.
 */
export function loadPersistedWishlist(saved) {
  if (!saved || typeof saved !== 'object') return [];
  return normalizeKeys(Array.isArray(saved.guestWish) ? saved.guestWish : (saved.wishlist || []));
}

/** The object written to localStorage — the whitelist, nothing else. */
export function pickPersisted(state) {
  const out = {};
  for (const k of PERSISTED_KEYS) out[k] = state[k];
  return out;
}
