// scripts/rewrite-slide-refs.js
// Rewrites all /assets/slides/... references in HTML files to point to Firebase Hosting.
// Run AFTER deploying slides to Firebase Hosting.
// Usage: node scripts/rewrite-slide-refs.js [--dry-run]

const fs   = require('fs');
const path = require('path');

const SLIDES_CDN   = 'https://mcraesocial-slides.web.app';
const OLD_PREFIX   = '/assets/slides/';
const NEW_PREFIX   = SLIDES_CDN + '/';
const SITE_ROOT    = path.join(__dirname, '..');
const DRY_RUN      = process.argv.includes('--dry-run');

// These decks have large embedded files (videos/PDFs) that can't be uploaded
// to Firebase Hosting via the CLI. They remain on Vercel, so their paths
// must NOT be rewritten.
const VERCEL_DECKS = [
  'social-10/historical/intro-to-imperial',
  'social-10/identity/intro-to-identity',
  'social-9/collective-rights',
];

function shouldSkip(ref) {
  return VERCEL_DECKS.some(deck => ref.startsWith(OLD_PREFIX + deck + '/') || ref === OLD_PREFIX + deck);
}

function rewriteRef(ref) {
  if (shouldSkip(ref)) return ref; // keep on Vercel
  return ref.replace(OLD_PREFIX, NEW_PREFIX);
}

// Directories that contain HTML pages we need to rewrite
// (excludes assets/slides itself — those are moving to Firebase Hosting)
const PAGE_DIRS = [
  'social-9',
  'social-10',
  'social-20',
  'social-30',
  'index.html',
];

let filesChecked = 0;
let filesChanged = 0;
let replacements  = 0;

function rewriteFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  filesChecked++;

  if (!original.includes(OLD_PREFIX)) return;

  // Replace each occurrence individually so we can skip Vercel-hosted decks
  const updated = original.replace(
    new RegExp(OLD_PREFIX.replace(/\//g, '\\/') + '[^"\' \\n>]+', 'g'),
    match => rewriteRef(match)
  );

  if (updated === original) return; // nothing actually changed (all were skipped)

  const count = (original.match(new RegExp(OLD_PREFIX.replace(/\//g, '\\/'), 'g')) || []).length;
  const skipped = VERCEL_DECKS.reduce((n, d) => {
    const rx = new RegExp(OLD_PREFIX.replace(/\//g, '\\/') + d.replace(/\//g, '\\/'), 'g');
    return n + (original.match(rx) || []).length;
  }, 0);

  if (DRY_RUN) {
    console.log(`  [DRY] Would rewrite ${count} reference(s) in: ${path.relative(SITE_ROOT, filePath)}`);
  } else {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`  ✓ Rewrote ${count} reference(s) in: ${path.relative(SITE_ROOT, filePath)}`);
  }

  filesChanged++;
  replacements += count;
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip the slides directory itself (it's moving to Firebase Hosting)
      if (entry.name === 'slides' && dir.endsWith('assets')) continue;
      // Skip node_modules, .git, etc.
      if (['.git', 'node_modules', 'dist', '.next', 'political-gravity', 'mcrae-submit'].includes(entry.name)) continue;
      walkDir(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      rewriteFile(full);
    }
  }
}

console.log(DRY_RUN ? '\n=== DRY RUN — no files will be changed ===\n' : '\n=== Rewriting slide references ===\n');

// Walk the whole site root
walkDir(SITE_ROOT);

console.log(`\nDone. ${filesChecked} HTML files checked, ${filesChanged} changed, ${replacements} references rewritten.`);
if (DRY_RUN) {
  console.log('\nRun without --dry-run to apply changes.');
}
