import { createContext, useContext, useEffect, useMemo, useReducer, useState, useCallback, useRef } from 'react';
import { productById, getCatalogVersion, isPurchasable } from '../data/products.js';
import { useCustomerAuth } from './customerAuth.jsx';
import { listWishlist, addWishlistItem, removeWishlistItem, mergeWishlist } from './wishlistData.js';
import {
  normalizeKey, normalizeKeys, visibleWishlist, wishlistReducer,
  planWishlistSync, loadPersistedWishlist, pickPersisted, PERSISTED_KEYS, initialWishlistState,
} from './wishlistState.js';

// ============================================================
// Global store — cart, wishlist, saved-for-later, toasts.
//
// WISHLIST OWNERSHIP MODEL
//
// There are deliberately TWO wishlists, not one:
//
//   guestWish    items this BROWSER saved. Persisted to localStorage,
//                belongs to nobody, survives sign-out.
//   accountWish  items the SIGNED-IN customer has saved. Held in memory
//                only, sourced from customer_wishlist, and dropped the
//                moment the session ends.
//
// What the UI shows:
//   signed out -> guestWish
//   signed in  -> union(guestWish, accountWish)
//
// Collapsing these into one persisted array is the bug this design exists
// to prevent: A signs in, A's account items merge into the local list, A
// signs out, B signs in — and B is looking at A's wishlist. Because
// accountWish is never written to localStorage and is cleared on sign-out,
// that cannot happen. An account-only item disappears when its owner leaves;
// only the browser's own guest items remain.
//
// Guest items DO flow the other way on login: they are pushed into the
// signed-in customer's remote wishlist, because the person who saved them is
// the person now signing in. Account-only items never flow back into
// guestWish.
// ============================================================
const StoreCtx = createContext(null);
const KEY = 'sora.store.v1';

// PERSISTED_KEYS, the ownership rules and every wishlist reducer case live
// in wishlistState.js so they can be executed directly in tests.
const initial = { cart: [], saved: [], ...initialWishlistState };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const saved = JSON.parse(raw);
    // Legacy migration: before cross-device sync this was a single
    // `wishlist` array of raw product ids (numbers on some paths, strings on
    // others). Those items belong to the browser, so they become guestWish —
    // normalised, so 5 and '5' stop being two entries.
    const guest = loadPersistedWishlist(saved);
    return {
      ...initial,
      cart: Array.isArray(saved.cart) ? saved.cart : [],
      saved: Array.isArray(saved.saved) ? saved.saved : [],
      guestWish: guest,
    };
  } catch {}
  return initial;
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { id, qty = 1, variant = null, variantId = null } = action;
      // Two different pack sizes of the same product are two cart lines, so
      // the key includes the variant. variantId is what the server prices
      // against; `variant` is only the human label shown in the UI.
      const key = id + (variantId ? '::' + variantId : variant ? '::' + variant : '');
      const existing = state.cart.find((l) => l.key === key);
      const cart = existing
        ? state.cart.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
        : [...state.cart, { key, id, variant, variantId, qty }];
      return { ...state, cart };
    }
    case 'SET_QTY': {
      const cart = state.cart
        .map((l) => (l.key === action.key ? { ...l, qty: Math.max(1, action.qty) } : l));
      return { ...state, cart };
    }
    case 'REMOVE':
      return { ...state, cart: state.cart.filter((l) => l.key !== action.key) };
    case 'SAVE_LATER': {
      const line = state.cart.find((l) => l.key === action.key);
      if (!line) return state;
      return { ...state, cart: state.cart.filter((l) => l.key !== action.key), saved: [...state.saved, line] };
    }
    case 'MOVE_TO_CART': {
      const line = state.saved.find((l) => l.key === action.key);
      if (!line) return state;
      const existing = state.cart.find((l) => l.key === line.key);
      const cart = existing
        ? state.cart.map((l) => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l))
        : [...state.cart, line];
      return { ...state, cart, saved: state.saved.filter((l) => l.key !== action.key) };
    }
    case 'REMOVE_SAVED':
      return { ...state, saved: state.saved.filter((l) => l.key !== action.key) };
    // ---- Wishlist ------------------------------------------------
    // Delegated so the ownership rules have exactly ONE implementation,
    // executable in tests without React (see src/lib/wishlistState.js).
    case 'WISH_GUEST_TOGGLE':
    case 'WISH_ACCOUNT_ADD':
    case 'WISH_ACCOUNT_REMOVE':
    case 'WISH_SYNCED':
    case 'WISH_SESSION_CLEARED':
      return wishlistReducer(state, action);
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState([]);
  const { user } = useCustomerAuth();
  const userId = user?.id ?? null;

  // Persist a WHITELIST, never the whole state. accountWish and syncedUserId
  // must not reach localStorage — see the ownership note at the top.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(pickPersisted(state)));
    } catch {}
  }, [state.cart, state.saved, state.guestWish]);

  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 2600);
  }, []);

  // `variant` accepts either a variant object ({ id, label, ... }) or a plain
  // label string, so existing call sites that pass a label keep working.
  const addToCart = useCallback((product, qty = 1, variant = null) => {
    const isObj = variant && typeof variant === 'object';
    // Nothing without a real price may enter the cart. Every add path funnels
    // through here — cards, quick view, PDP, "add all to cart" — so this is
    // the one place that has to hold. The buttons are disabled too, but a
    // disabled button is a courtesy; this is the guarantee.
    if (!isPurchasable(product, isObj ? variant : null)) {
      toast('This item isn’t available to buy yet.', { kind: 'cart' });
      return false;
    }
    const label = isObj ? (variant.label ?? null) : variant;
    // A variantId is only meaningful when it identifies a priced row in
    // product_variants. Catalogue variants that carry a label but no price
    // are display-only, and sending their local id would make the server
    // reject the line ("selected size is no longer available").
    const variantId = isObj && variant.price != null ? (variant.id ?? null) : null;
    dispatch({ type: 'ADD', id: product.id, qty, variant: label, variantId });
    toast(`Added to cart`, { product: product.id, kind: 'cart' });
    return true;
  }, [toast]);

  // What the UI renders. Recomputed from the two lists, never stored.
  const wishlist = useMemo(() => visibleWishlist(state), [state.guestWish, state.accountWish, state.syncedUserId]);

  // ---- Wishlist sync lifecycle ---------------------------------------
  //
  // Identifies the request that is allowed to apply its result. An account
  // switch bumps it, so a slow response for the previous customer can never
  // land in the new customer's wishlist.
  const syncTokenRef = useRef(0);

  useEffect(() => {
    // Signed out (or signed out of an account we had synced): drop the
    // account list and fall back to the guest list. Never deletes anything
    // remote — the customer's wishlist stays in the database for next time.
    if (!userId) {
      syncTokenRef.current += 1;
      if (state.syncedUserId) dispatch({ type: 'WISH_SESSION_CLEARED' });
      return;
    }
    // Already synced for this exact user — nothing to do. This is also what
    // makes StrictMode's double effect invocation harmless.
    if (state.syncedUserId === userId) return;

    const token = (syncTokenRef.current += 1);
    // Snapshot BEFORE awaiting: this is the true guest list at login time.
    // Reading it after the fetch could pick up a toggle made meanwhile.
    const guestAtLogin = normalizeKeys(state.guestWish);

    (async () => {
      const remote = await listWishlist();
      // A different user signed in (or out) while this was in flight.
      if (token !== syncTokenRef.current) return;

      const { missing, union } = planWishlistSync({ guestAtLogin, remote });
      if (missing.length) {
        // One duplicate-safe upsert for the whole set, so a retry or a
        // double-invocation cannot create duplicate rows.
        await mergeWishlist(missing);
        if (token !== syncTokenRef.current) return;
      }

      dispatch({ type: 'WISH_SYNCED', userId, keys: union });
    })();
    // state.guestWish is read through the snapshot above rather than tracked
    // as a dependency: re-running this on every guest toggle would re-fetch
    // and re-merge on each heart tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, state.syncedUserId]);

  const toggleWish = useCallback((product) => {
    const key = normalizeKey(product?.id);
    // A product with no usable id must never become a wishlist row.
    if (!key) return;

    const signedIn = Boolean(userId) && state.syncedUserId === userId;
    const wasIn = visibleWishlist(state).includes(key);

    // Signed out: purely local, no network, instant.
    if (!signedIn) {
      dispatch({ type: 'WISH_GUEST_TOGGLE', key });
      toast(wasIn ? 'Removed from wishlist' : 'Saved to wishlist', { kind: 'wish' });
      return;
    }

    // Signed in: update optimistically so the heart responds immediately,
    // then persist. If the write fails we put the state back rather than
    // leaving the customer believing something was saved that was not.
    const inGuestBefore = state.guestWish.includes(key);
    dispatch({ type: wasIn ? 'WISH_ACCOUNT_REMOVE' : 'WISH_ACCOUNT_ADD', key });
    toast(wasIn ? 'Removed from wishlist' : 'Saved to wishlist', { kind: 'wish' });

    (async () => {
      const ok = wasIn ? await removeWishlistItem(key) : await addWishlistItem(key);
      if (ok) return;
      // Roll back to exactly the previous state, including the guest copy
      // that WISH_ACCOUNT_REMOVE cleared.
      if (wasIn) {
        dispatch({ type: 'WISH_ACCOUNT_ADD', key });
        if (inGuestBefore) dispatch({ type: 'WISH_GUEST_TOGGLE', key });
      } else {
        dispatch({ type: 'WISH_ACCOUNT_REMOVE', key });
      }
      toast('Could not sync wishlist. Please try again.', { kind: 'wish' });
    })();
  }, [state, userId, toast]);

  // Resolve the chosen pack size so a line is priced at ITS price, not the
  // product's base price. These figures are for display only — the payable
  // amount is always recomputed server-side (api/_lib/pricing.js).
  const hydrate = (l) => {
    const product = productById[l.id];
    if (!product) return null;
    const variantObj = l.variantId
      ? (product.variants || []).find((v) => String(v.id) === String(l.variantId)) || null
      : null;
    const unitPrice = variantObj?.price ?? product.price;
    const unitMrp = variantObj?.mrp ?? product.mrp ?? unitPrice;
    return {
      ...l,
      product,
      variantObj,
      variantLabel: variantObj?.label ?? l.variant ?? null,
      unitPrice,
      unitMrp: Math.max(unitMrp, unitPrice),
      lineTotal: unitPrice * l.qty,
      // A line already persisted in localStorage from before this guard
      // existed — or one whose price disappeared when the catalogue
      // hydrated — must not be checkout-able. The cart says so plainly
      // instead of letting the server refuse the whole order later.
      purchasable: isPurchasable(product, variantObj),
    };
  };

  // Variants arrive from Supabase AFTER first render. Memoising on state.cart
  // alone meant a line added with a 750 ml variantId kept the pre-variant
  // base price (250 ml) forever, because the cart array never changed. Read
  // the catalogue version during render so the async load invalidates these.
  const catalogVersion = getCatalogVersion();
  const cartDetailed = useMemo(() => state.cart.map(hydrate).filter(Boolean), [state.cart, catalogVersion]);
  const savedDetailed = useMemo(() => state.saved.map(hydrate).filter(Boolean), [state.saved, catalogVersion]);

  // Lines that cannot be paid for. Cart and Checkout read this to block the
  // order instead of letting the customer discover it at the payment step.
  const blockedCartLines = useMemo(
    () => cartDetailed.filter((l) => !l.purchasable),
    [cartDetailed],
  );
  const cartCount = useMemo(() => state.cart.reduce((s, l) => s + l.qty, 0), [state.cart]);
  const subtotal = useMemo(() => cartDetailed.reduce((s, l) => s + l.lineTotal, 0), [cartDetailed]);
  const mrpTotal = useMemo(() => cartDetailed.reduce((s, l) => s + l.unitMrp * l.qty, 0), [cartDetailed]);
  const savings = useMemo(() => cartDetailed.reduce((s, l) => s + Math.max(0, l.unitMrp - l.unitPrice) * l.qty, 0), [cartDetailed]);

  const value = {
    ...state,
    // The visible union replaces the old raw array, so every existing
    // consumer (Wishlist page, Account tab, header counts) keeps reading
    // `wishlist` and gets the right list for the current session.
    wishlist,
    dispatch,
    toasts,
    toast,
    addToCart,
    toggleWish,
    // Normalised on both sides: a caller passing the numeric 5 still matches
    // a stored '5'.
    isWished: (id) => wishlist.includes(normalizeKey(id)),
    cartDetailed,
    savedDetailed,
    blockedCartLines,
    cartCount,
    wishCount: wishlist.length,
    subtotal,
    mrpTotal,
    savings,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
