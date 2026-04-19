/**
 * assignment-status.js
 * Included on every unit page of mcraesocial.com.
 * Checks Firestore for each "Write Assignment" button on the page — if the
 * matching assignment is closed (isOpen !== true) the button is hidden.
 *
 * No auth required. Firestore assignment reads are public.
 */
(async () => {
  // Only run on unit pages that actually have Write Assignment buttons
  const writeBtns = document.querySelectorAll('a.utility-btn--work');
  if (!writeBtns.length) return;

  // ── Detect course + stream from page context ──────────────────────────────
  const path = window.location.pathname; // e.g. /social-30/economics/

  const courseMatch = path.match(/\/(social-(\d+))\//);
  if (!courseMatch) return;
  const courseSlug  = courseMatch[1];              // "social-30"
  const courseLabel = `Social ${courseMatch[2]}`;  // "Social 30"

  // ── Firebase Firestore lite (no auth needed, tree-shakeable) ─────────────
  const CDN = 'https://www.gstatic.com/firebasejs/10.14.1';
  const { initializeApp }    = await import(`${CDN}/firebase-app.js`);
  const { getFirestore, collection, query, where, getDocs }
    = await import(`${CDN}/firebase-firestore-lite.js`);

  const app = initializeApp({
    apiKey:            'AIzaSyCIiW1edciPp0kC72oQHYhhTmfTPoSdajA',
    authDomain:        'mcrae-assignments.firebaseapp.com',
    projectId:         'mcrae-assignments',
    storageBucket:     'mcrae-assignments.firebasestorage.app',
    messagingSenderId: '924165074686',
    appId:             '1:924165074686:web:67ec3909e1be195aa93faf',
  }, 'mcrae-status'); // named app to avoid conflicts

  const db = getFirestore(app);

  // ── Fetch all assignments for this course ─────────────────────────────────
  let assignments = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'assignments'), where('course', '==', courseLabel))
    );
    assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[assignment-status] Firestore fetch failed:', err);
    return; // fail open — leave all buttons visible
  }

  // ── Walk each assignment-block and check its status ───────────────────────
  document.querySelectorAll('.assignment-block').forEach(block => {
    const writeBtn = block.querySelector('a.utility-btn--work');
    if (!writeBtn) return;

    const labelEl   = block.querySelector('.assignment-block__label');
    const name      = labelEl ? labelEl.textContent.trim() : '';
    const streamRaw = block.getAttribute('data-stream'); // "1", "2", or null
    const stream    = streamRaw ? `-${streamRaw}` : null;

    // Find best-matching assignment: name + stream
    const match = assignments.find(a => {
      const nameMatch   = a.name === name;
      const streamMatch = stream ? a.stream === stream : true;
      return nameMatch && streamMatch;
    });

    const isOpen = match ? match.isOpen !== false : false; // default closed if not in DB

    if (!isOpen) {
      writeBtn.style.display = 'none';
    } else {
      writeBtn.style.display = ''; // restore if previously hidden
    }
  });
})();
