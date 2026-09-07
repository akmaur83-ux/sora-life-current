import { createContext, useContext } from 'react';

// Public catalogue/settings hydrate together in main.jsx. Storefront routes
// that are shaped by that data use this signal to avoid painting the bundled
// fallback layout immediately before the live layout replaces it.
export const BootstrapReadyContext = createContext(true);

export function useBootstrapReady() {
  return useContext(BootstrapReadyContext);
}
