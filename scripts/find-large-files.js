// scripts/find-large-files.js
// Finds all files > 5MB in assets/slides (excluding already-excluded decks)
// and generates firebase.json ignore patterns for them.

const fs   = require('fs');
const path = require('path');

const SLIDES = path.join(__dirname, '..', 'assets', 'slides');
const THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB

// Already excluded from firebase.json
const ALREADY_EXCLUDED = [
  'social-10/historical/intro-to-imperial',
  'social-10/identity/intro-to-identity',
  'social-9/collective-rights',
];

const largeFiles = [];

function walk(dir, relBase) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel  = relBase ? relBase + '/' + e.name : e.name;

    if (e.isDirectory()) {
      // Skip already-excluded
      if (ALREADY_EXCLUDED.some(ex => rel === ex || rel.startsWith(ex + '/'))) continue;
      walk(full, rel);
    } else if (e.isFile()) {
      const size = fs.statSync(full).size;
      if (size >= THRESHOLD_BYTES) {
        const mb = (size / 1048576).toFixed(2);
        largeFiles.push({ rel, size, mb });
      }
    }
  }
}

walk(SLIDES, '');
largeFiles.sort((a, b) => b.size - a.size);

if (largeFiles.length === 0) {
  console.log('No files over 5 MB found (outside already-excluded decks). Upload should work!');
} else {
  console.log(`Found ${largeFiles.length} file(s) over 5 MB:\n`);
  largeFiles.forEach(f => console.log(`  ${f.mb} MB  ${f.rel}`));

  // Identify unique parent decks (3 levels deep: course/unit/deck)
  const decks = new Set();
  for (const f of largeFiles) {
    const parts = f.rel.split('/');
    if (parts.length >= 3) decks.add(parts.slice(0, 3).join('/'));
    else decks.add(parts[0]);
  }

  console.log('\nSuggested additional firebase.json ignores:');
  [...decks].forEach(d => console.log(`  "${d}/**"`));
}
