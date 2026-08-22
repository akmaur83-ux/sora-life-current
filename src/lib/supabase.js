import { createClient } from "@supabase/supabase-js";

// These are replaced with literal strings at build time by
// @rollup/plugin-replace (see rollup.config.mjs) — nothing is read from the
// environment at runtime.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isSupabaseConfigured) {
  // Previously this threw, which crashed the very first module import and
  // rendered the entire site as a blank page. A missing build-time config
  // must degrade gracefully instead: the storefront runs on its built-in
  // data, and Supabase-backed calls simply fail and are caught by their
  // existing handlers.
  console.warn(
    "Supabase is not configured for this build — running with built-in data only. " +
    "Admin and live-content features are unavailable until VITE_SUPABASE_URL and " +
    "VITE_SUPABASE_PUBLISHABLE_KEY are available to the build step."
  );
}

// Always export a real client object so every existing import and call site
// keeps working unchanged. When unconfigured it points at an unreachable
// placeholder, so calls reject and are handled by the existing catch paths
// rather than throwing at import time.
export const supabase = createClient(
  supabaseUrl || "https://unconfigured.supabase.co",
  supabasePublishableKey || "unconfigured"
);
