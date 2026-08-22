import { createContext, useContext, useEffect, useMemo, useReducer, useState, useCallback } from 'react';
import { productById } from '../data/products.js';

// ============================================================
// Global store — cart, wishlist, saved-for-later, toasts.
// Persisted to localStorage so the prototype feels real.
// ============================================================
const StoreCtx = createContext(null);
const KEY = 'sora.store.v1';

const initial = { cart: [], wishlist: [], saved: [] };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch {}
  return initial;
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { id, qty = 1, variant = null } = action;
      const key = id + (variant ? '::' + variant : '');
      const existing = state.cart.find((l) => l.key === key);
      const cart = existing
        ? state.cart.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l))
        : [...state.cart, { key, id, variant, qty }];
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
    case 'TOGGLE_WISH': {
      const has = state.wishlist.includes(action.id);
      return { ...state, wishlist: has ? state.wishlist.filter((x) => x !== action.id) : [...state.wishlist, action.id] };
    }
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState([]);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, [state]);

  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 2600);
  }, []);

  const addToCart = useCallback((product, qty = 1, variant = null) => {
    dispatch({ type: 'ADD', id: product.id, qty, variant });
    toast(`Added to cart`, { product: product.id, kind: 'cart' });
  }, [toast]);

  const toggleWish = useCallback((product) => {
    dispatch({ type: 'TOGGLE_WISH', id: product.id });
    const wasIn = state.wishlist.includes(product.id);
    toast(wasIn ? 'Removed from wishlist' : 'Saved to wishlist', { kind: 'wish' });
  }, [state.wishlist, toast]);

  const cartDetailed = useMemo(() =>
    state.cart.map((l) => ({ ...l, product: productById[l.id] })).filter((l) => l.product),
    [state.cart]);
  const savedDetailed = useMemo(() =>
    state.saved.map((l) => ({ ...l, product: productById[l.id] })).filter((l) => l.product),
    [state.saved]);

  const cartCount = useMemo(() => state.cart.reduce((s, l) => s + l.qty, 0), [state.cart]);
  const subtotal = useMemo(() => cartDetailed.reduce((s, l) => s + l.product.price * l.qty, 0), [cartDetailed]);
  const savings = useMemo(() => cartDetailed.reduce((s, l) => s + Math.max(0, (l.product.mrp || l.product.price) - l.product.price) * l.qty, 0), [cartDetailed]);

  const value = {
    ...state,
    dispatch,
    toasts,
    toast,
    addToCart,
    toggleWish,
    isWished: (id) => state.wishlist.includes(id),
    cartDetailed,
    savedDetailed,
    cartCount,
    wishCount: state.wishlist.length,
    subtotal,
    savings,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
