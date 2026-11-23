// src/hooks/useThemeColors.js
//
// The theme's CSS variables as literal colour values, re-read whenever the
// theme flips. For drawing that has to survive without a stylesheet — the
// final project map is serialised into a PNG, where var(--…) means nothing.
import { useMemo, useSyncExternalStore } from 'react';

const VARS = ['bg', 'surface', 'surface2', 'text', 'muted', 'dim', 'border', 'border2', 'primary', 'on-primary'];

// The theme lives in data-theme on <html> (see ThemeContext), so that
// attribute is the thing to watch.
function subscribe(onChange) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
}
function snapshot() {
  const cs = getComputedStyle(document.documentElement);
  return VARS.map(v => cs.getPropertyValue(`--pg-${v}`).trim()).join('|');
}

export function useThemeColors() {
  const joined = useSyncExternalStore(subscribe, snapshot);
  return useMemo(() => {
    const values = joined.split('|');
    return Object.fromEntries(VARS.map((v, i) => [v, values[i]]));
  }, [joined]);
}
