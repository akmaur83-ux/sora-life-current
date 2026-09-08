import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { productBySlug } from '../data/products.js';
import { useBootstrapReady } from '../lib/bootstrapReady.js';
import { mountScrollBackground, supportsScrollBackground } from '../lib/scrollBackground.js';

// Decoration is independent of content, image loading and entrance animations.
export default function StorefrontBackground() {
  const { pathname } = useLocation();
  const ready = useBootstrapReady();
  useEffect(() => {
    if (!ready || !supportsScrollBackground(pathname)) return;
    const root = document.querySelector('.page-main');
    if (root) {
      const segment = pathname.split('/')[2] || '';
      let slug;
      try { slug = decodeURIComponent(segment); } catch { slug = segment; }
      return mountScrollBackground(root, {
        product: pathname.startsWith('/product/') ? productBySlug[slug] : undefined,
        category: pathname.startsWith('/category/') ? slug : undefined,
      });
    }
  }, [pathname, ready]);
  return null;
}
