// scripts/sync-slides.js
// Run this whenever you add new slides to assets/slides/.
// It deploys the slides folder to Firebase Hosting (mcraesocial-slides).
// Only changed files are uploaded (Firebase hashes files and skips unchanged ones).
//
// Usage:
//   node scripts/sync-slides.js
//   (or double-click sync-slides.bat)

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

console.log('\n⬆️  Syncing slides to Firebase Hosting (mcraesocial-slides.web.app)...\n');

try {
  execSync(
    'firebase deploy --only hosting:mcraesocial-slides --project project-7910201586224417193',
    { cwd: ROOT, stdio: 'inherit', shell: 'cmd.exe' }
  );
  console.log('\n✅ Done! New slides are live at https://mcraesocial-slides.web.app');
} catch (err) {
  console.error('\n❌ Deploy failed:', err.message);
  process.exit(1);
}
