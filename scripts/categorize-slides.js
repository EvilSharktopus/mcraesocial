// scripts/categorize-slides.js
// Categorizes all slide decks into:
//   - PNG-based (slide_001.png pattern) → go to Firebase Storage
//   - Keynote HTML exports (index.html + assets/) → go to Firebase Hosting
// Run with: node scripts/categorize-slides.js

const fs   = require('fs');
const path = require('path');

const SLIDES_ROOT = path.join(__dirname, '..', 'assets', 'slides');

function walkDeck(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasIndex = entries.some(e => e.isFile() && e.name === 'index.html');
  const hasPngs  = entries.some(e => e.isFile() && /^slide_\d+\.(png|jpg|webp)$/.test(e.name));
  const hasUUIDs = entries.filter(e => e.isDirectory() && /^[0-9A-F]{8}-/.test(e.name)).length > 0;

  if (hasPngs) return 'png';
  if (hasIndex && hasUUIDs) return 'keynote';
  if (hasIndex) return 'keynote'; // Keynote export without UUID dirs (older format)
  return null; // not a deck, keep recursing
}

function findDecks(dir, depth = 0) {
  const decks = [];
  if (depth > 5) return decks;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Check if this directory itself is a deck
  const deckType = walkDeck(dir);
  if (deckType) {
    decks.push({ dir, type: deckType });
    return decks; // don't recurse into decks
  }

  // Otherwise recurse
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name);
      decks.push(...findDecks(sub, depth + 1));
    }
  }

  return decks;
}

const decks = findDecks(SLIDES_ROOT);
const pngDecks      = decks.filter(d => d.type === 'png');
const keynoteDecks  = decks.filter(d => d.type === 'keynote');

// Count files in each category
function countFiles(dir) {
  let n = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile()) n++;
    else if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
  }
  return n;
}

const pngFileCount     = pngDecks.reduce((s, d) => s + countFiles(d.dir), 0);
const keynoteFileCount = keynoteDecks.reduce((s, d) => s + countFiles(d.dir), 0);

const relPath = d => path.relative(SLIDES_ROOT, d.dir).replace(/\\/g, '/');

console.log(`\n=== PNG-based decks (→ Firebase Storage) [${pngDecks.length} decks, ${pngFileCount} files] ===`);
pngDecks.forEach(d => console.log('  ' + relPath(d)));

console.log(`\n=== Keynote HTML exports (→ Firebase Hosting) [${keynoteDecks.length} decks, ${keynoteFileCount} files] ===`);
keynoteDecks.forEach(d => console.log('  ' + relPath(d)));

console.log(`\nTotal decks: ${decks.length}  |  Total files: ${pngFileCount + keynoteFileCount}`);

// Write JSON summary for use by upload scripts
const summary = { pngDecks: pngDecks.map(d => relPath(d)), keynoteDecks: keynoteDecks.map(d => relPath(d)) };
fs.writeFileSync(path.join(__dirname, 'slide-manifest.json'), JSON.stringify(summary, null, 2));
console.log('\nWrote scripts/slide-manifest.json');
