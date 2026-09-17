// The three shapes a printed Diploma Vault can take, and how to build them.
import { tagCounts, tagKey } from './tags';

export const PRINT_MODES = [
  { key: 'package', label: 'Print package',
    blurb: 'Exactly what is on screen, in this order.' },
  { key: 'term',    label: 'Group by term',
    blurb: 'One section per tag — Illiberalism, Imposition, Russia… A passage with several tags appears under each of them.' },
  { key: 'chrono',  label: 'Sort chronologically',
    blurb: 'In time-period order, 1700s to today, under each reading’s heading.' },
];

export const fmtDate = (d) => d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

// Build the sections for a mode. `readingIndex` maps readingId -> position in
// the curriculum so chronological really means the course order, not the
// order the student happened to flag things.
export function buildSections(mode, flags, readingIndex) {
  const order = (id) => readingIndex.get(id) ?? Number.MAX_SAFE_INTEGER;
  const byCourse = (a, b) =>
    order(a.readingId) - order(b.readingId)
    || (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);

  if (mode === 'term') {
    const sections = tagCounts(flags).map(([key, { label, count }]) => ({
      heading: label,
      count,
      flags: flags.filter(f => (f.tags || []).some(t => tagKey(t) === key)).sort(byCourse),
    }));
    const untagged = flags.filter(f => !(f.tags || []).some(t => tagKey(t))).sort(byCourse);
    if (untagged.length) sections.push({ heading: 'Untagged', count: untagged.length, flags: untagged });
    return sections;
  }

  if (mode === 'chrono') {
    const groups = new Map();
    for (const f of flags.slice().sort(byCourse)) {
      const k = f.readingId || '?';
      if (!groups.has(k)) groups.set(k, { heading: f.readingTitle || 'Other', count: 0, flags: [] });
      const g = groups.get(k);
      g.flags.push(f);
      g.count += 1;
    }
    return [...groups.values()];
  }

  return [{ heading: null, count: flags.length, flags }];
}
