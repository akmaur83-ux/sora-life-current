import { applyHomepage } from './settings.js';
import { adminGetSetting } from './adminApi.js';

// Same-origin tabs receive an invalidation, never an unchecked settings payload.
// Each open Home reads the saved public setting using the existing RLS client.
const CHANNEL = 'sora-homepage-appearance';
export function watchHomepageVisuals() {
  let stopped = false;
  let channel;
  const refresh = async () => {
    try {
      const saved = await adminGetSetting('homepage');
      if (!stopped && saved) applyHomepage(saved);
    } catch { /* Keep the last successfully hydrated presentation. */ }
  };
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => { if (event.data === 'saved') refresh(); };
  }
  window.addEventListener('focus', refresh);
  return () => { stopped = true; channel?.close(); window.removeEventListener('focus', refresh); };
}
export function announceHomepageSaved(saved) {
  applyHomepage(saved);
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage('saved');
    channel.close();
  }
}
