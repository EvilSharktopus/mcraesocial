// Diploma Vault tags.
//
// Tags are free text, so over a year "Cold War", "cold war" and "Cold war "
// would otherwise become three separate filters. Everything here treats tags
// as equal when they differ only in case or spacing, and always displays the
// spelling that was used first.

export const PREDEFINED_TAGS = [
  'Left', 'Right', 'Economics', 'Politics', 'Illiberalism', 'Imposition',
  'Democracy', 'Dictatorship', 'USA', 'Russia', 'Canada', 'Europe', 'China',
];

// The identity of a tag: what two spellings must share to be the same tag.
export const tagKey = (tag) => String(tag ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Tidy a typed tag and, if it already exists in `known` under another
// spelling, return that spelling instead so the vault never forks.
export function canonicalTag(raw, known = []) {
  const clean = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  const key = tagKey(clean);
  return known.find(k => tagKey(k) === key) ?? clean;
}

// Remove duplicates that differ only by case/spacing, keeping first spelling.
export function dedupeTags(tags) {
  const seen = new Set();
  return tags.filter(t => {
    const k = tagKey(t);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// { key: { label, count } } across a set of flags, most used first.
export function tagCounts(flags) {
  const out = {};
  for (const f of flags) {
    for (const t of f.tags || []) {
      const k = tagKey(t);
      if (!k) continue;
      if (!out[k]) out[k] = { label: t.trim().replace(/\s+/g, ' '), count: 0 };
      out[k].count += 1;
    }
  }
  return Object.entries(out).sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
}

// Every tag a student has ever used, as canonical spellings, presets first.
export function knownTags(flags) {
  return dedupeTags([...PREDEFINED_TAGS, ...tagCounts(flags).map(([, v]) => v.label)]);
}
