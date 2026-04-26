#!/usr/bin/env node
/**
 * convert-to-webp.js
 * Converts all local JPG/PNG image assets to WebP alongside the originals.
 * Run: node tools/convert-to-webp.js
 * Requires: npm install -g sharp-cli  OR just use npx (handled below via child_process)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'assets', 'images');
const QUALITY = 82;

// Exclude favicon — it needs to stay as PNG for browser tab support
const EXCLUDE = ['favicon.png'];

function findImages(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findImages(full));
    } else if (/\.(jpe?g|png)$/i.test(entry.name) && !EXCLUDE.includes(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const images = findImages(IMAGES_DIR);
console.log(`\nFound ${images.length} images to convert.\n`);

let converted = 0;
let skipped = 0;

for (const imgPath of images) {
  const webpPath = imgPath.replace(/\.(jpe?g|png)$/i, '.webp');
  const rel = path.relative(ROOT, imgPath);
  const relWebp = path.relative(ROOT, webpPath);

  if (fs.existsSync(webpPath)) {
    console.log(`  SKIP  ${relWebp} (already exists)`);
    skipped++;
    continue;
  }

  try {
    // Use npx sharp-cli — no global install required
    execSync(
      `npx --yes sharp-cli --input "${imgPath}" --output "${webpPath}" --format webp --quality ${QUALITY}`,
      { stdio: 'pipe' }
    );
    const origKB = Math.round(fs.statSync(imgPath).size / 1024);
    const webpKB = Math.round(fs.statSync(webpPath).size / 1024);
    const savings = Math.round((1 - webpKB / origKB) * 100);
    console.log(`  OK    ${rel} → ${relWebp}  (${origKB}KB → ${webpKB}KB, -${savings}%)`);
    converted++;
  } catch (err) {
    console.error(`  ERROR ${rel}: ${err.message}`);
  }
}

console.log(`\nDone. Converted: ${converted}, Skipped (already exist): ${skipped}\n`);
console.log('Commit the new .webp files to git and deploy to Vercel.\n');
