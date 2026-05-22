// scripts/deploy-slides-batched.js
// Deploys slides to Firebase Hosting one course at a time.
// Firebase deduplicates by content hash, so each batch only uploads new files.
// The final deploy includes ALL courses (Firebase Hosting merges them via the version).
//
// Strategy:
//   1. Deploy social-9 only → small upload
//   2. Deploy social-9 + social-10 → upload social-10 diff only
//   3. Deploy all four → upload social-20 + social-30 diff only
//   Each batch is ~3k files max instead of 11k all at once.
//
// Usage: node scripts/deploy-slides-batched.js

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const SLIDES_SRC  = path.join(ROOT, 'assets', 'slides');
const STAGING_DIR = path.join(ROOT, 'assets', 'slides-staging');
const PROJECT     = 'project-7910201586224417193';
const SITE        = 'mcraesocial-slides';

const COURSES = ['social-9', 'social-10', 'social-20', 'social-30'];

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function firebaseDeploy() {
  // Temporarily point firebase.json public to staging dir
  const fbConfig = {
    firestore: { rules: 'firestore.rules' },
    hosting: [{
      site: SITE,
      public: 'assets/slides-staging',
      ignore: ['firebase.json', '**/.*'],
      headers: [
        { source: '**/*.@(png|jpg|jpeg|webp|gif|svg)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        { source: '**/*.@(js|css|html)', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
        { source: '**', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }
      ]
    }]
  };

  fs.writeFileSync(path.join(ROOT, 'firebase.json'), JSON.stringify(fbConfig, null, 2));

  const result = spawnSync(
    'cmd.exe',
    ['/c', `firebase deploy --only hosting:${SITE} --project ${PROJECT}`],
    { cwd: ROOT, stdio: 'inherit', timeout: 300000 }
  );

  return result.status === 0;
}

// Clean staging dir
if (fs.existsSync(STAGING_DIR)) fs.rmSync(STAGING_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });

for (let i = 0; i < COURSES.length; i++) {
  const course = COURSES[i];
  const courseSrc  = path.join(SLIDES_SRC, course);
  const courseDest = path.join(STAGING_DIR, course);

  if (!fs.existsSync(courseSrc)) {
    console.log(`\n⚠️  Skipping ${course} — directory not found`);
    continue;
  }

  console.log(`\n📁 Adding ${course} to staging...`);
  copyDir(courseSrc, courseDest);

  console.log(`\n🚀 Deploying batch ${i + 1}/${COURSES.length}: ${COURSES.slice(0, i + 1).join(' + ')}...`);

  let success = false;
  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`  Attempt ${attempt}...`);
    if (firebaseDeploy()) {
      success = true;
      console.log(`  ✅ Batch ${i + 1} deployed!`);
      break;
    }
    console.log(`  ❌ Failed, retrying...`);
    // Wait 5 seconds before retry
    const wait = new Promise(r => setTimeout(r, 5000));
    // Sync wait
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  }

  if (!success) {
    console.error(`\n❌ Batch ${i + 1} failed after 5 attempts. Stopping.`);
    process.exit(1);
  }
}

// Restore proper firebase.json
const finalConfig = {
  firestore: { rules: 'firestore.rules' },
  hosting: [{
    site: SITE,
    public: 'assets/slides',
    ignore: ['firebase.json', '**/.*'],
    headers: [
      { source: '**/*.@(png|jpg|jpeg|webp|gif|svg)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '**/*.@(js|css|html)', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600' }] },
      { source: '**', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }
    ]
  }]
};
fs.writeFileSync(path.join(ROOT, 'firebase.json'), JSON.stringify(finalConfig, null, 2));

// Clean up staging
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

console.log('\n🎉 All slides deployed to https://mcraesocial-slides.web.app');
console.log('Next step: node scripts/rewrite-slide-refs.js');
