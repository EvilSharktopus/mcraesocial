/* Summer Movie Wager 2026 — Firebase edition */

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let db = null;
  let storage = null;
  let state = {
    phase: 'pre',
    participant: null,      // { id, name, avatarUrl, picksSubmitted }
    avatarFile: null,
    picks: [],              // [{ movieId, rank }]  — top 10 ranked
    darkHorses: [],         // [movieId, movieId, movieId] — 3 long shots
    movies: [],             // all eligible movies
    participants: [],       // all participants
    selectedParticipantId: null,
    adminMode: false,
    posterCache: {},        // movieId -> url
    _picksByParticipant: {},
  };

  // ── Scoring constants ──────────────────────────────────────────────────
  const PTS_EXACT_BOOKEND = 13;
  const PTS_EXACT         = 10;
  const PTS_OFF1          = 7;
  const PTS_OFF2          = 5;
  const PTS_IN_TOP10      = 3;
  const PTS_DARK_HORSE    = 1;
  const BOOKEND_RANKS     = new Set([1, 10]);

  // ── Seed data (used on first run if Firestore movies collection is empty) ──
  const SEED_MOVIES = [
    { title: 'Billie Eilish: Hit Me Hard and Soft (Live in 3D)', releaseDate: '2026-05-08' },
    { title: 'Mortal Kombat II',                                  releaseDate: '2026-05-08' },
    { title: 'The Sheep Detectives',                              releaseDate: '2026-05-08' },
    { title: 'In the Grey',                                       releaseDate: '2026-05-15' },
    { title: 'I Love Boosters',                                   releaseDate: '2026-05-22' },
    { title: 'Star Wars: The Mandalorian & Grogu',                releaseDate: '2026-05-22' },
    { title: 'Backrooms',                                         releaseDate: '2026-05-29' },
    { title: 'Pressure',                                          releaseDate: '2026-05-29' },
    { title: 'The Breadwinner',                                   releaseDate: '2026-05-29' },
    { title: 'Tuner',                                             releaseDate: '2026-05-29' },
    { title: 'Masters of the Universe',                           releaseDate: '2026-06-05' },
    { title: 'Power Ballad',                                      releaseDate: '2026-06-05' },
    { title: 'Scary Movie',                                       releaseDate: '2026-06-05' },
    { title: 'Disclosure Day',                                    releaseDate: '2026-06-12' },
    { title: 'The Death of Robin Hood',                           releaseDate: '2026-06-19' },
    { title: 'Toy Story 5',                                       releaseDate: '2026-06-19' },
    { title: 'The Invite',                                        releaseDate: '2026-06-26' },
    { title: 'Jackass: Best and Last',                            releaseDate: '2026-06-26' },
    { title: 'Supergirl',                                         releaseDate: '2026-06-26' },
    { title: 'Minions & Monsters',                                releaseDate: '2026-07-01' },
    { title: 'Young Washington',                                  releaseDate: '2026-07-03' },
    { title: 'Evil Dead Burn',                                    releaseDate: '2026-07-10' },
    { title: 'Gail Daughtry and the Celebrity Sex Pass',          releaseDate: '2026-07-10' },
    { title: 'Moana',                                             releaseDate: '2026-07-10' },
    { title: 'The Odyssey',                                       releaseDate: '2026-07-17' },
    { title: 'I Want Your Sex',                                   releaseDate: '2026-07-31' },
    { title: 'Spider-Man: Brand New Day',                         releaseDate: '2026-07-31' },
    { title: 'Ice Cream Man',                                     releaseDate: '2026-08-07' },
    { title: 'Super Troopers 3',                                  releaseDate: '2026-08-07' },
    { title: 'Teenage Sex and Death at Camp Miasma',              releaseDate: '2026-08-07' },
    { title: 'The End of Oak Street',                             releaseDate: '2026-08-14' },
    { title: 'PAW Patrol: The Dino Movie',                        releaseDate: '2026-08-14' },
    { title: 'Insidious: Out of the Further',                     releaseDate: '2026-08-21' },
    { title: 'Spa Weekend',                                       releaseDate: '2026-08-21' },
    { title: 'Coyote vs. Acme',                                   releaseDate: '2026-08-28' },
    { title: 'The Dog Stars',                                     releaseDate: '2026-08-28' },
    { title: 'Idiots',                                            releaseDate: '2026-08-28' },
  ];

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    renderFilmHoles();
    showScreen('screenLoading');

    if (!isConfigured()) {
      showScreen('screenSetup');
      return;
    }

    try {
      firebase.initializeApp(CONFIG.firebase);
      db = firebase.firestore();
      storage = firebase.storage();
    } catch (e) {
      // already initialized (e.g. hot reload)
      db = firebase.firestore();
      storage = firebase.storage();
    }

    state.phase = new Date() >= CONFIG.deadline ? 'post' : 'pre';
    state.adminMode = new URLSearchParams(location.search).get('admin') === '1';

    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check that Firestore is enabled in your Firebase Console.')), 10000)
      );
      await Promise.race([Promise.all([loadMovies(), loadParticipants()]), timeout]);
      updateDeadlineBadge();

      if (state.phase === 'post') {
        showResultsScreen();
      } else {
        showLanding();
      }
    } catch (err) {
      console.error('Firebase init error:', err);
      const hint = err.message?.includes('offline') || err.code === 'unavailable'
        ? 'Firestore may not be enabled yet. Go to Firebase Console → Firestore Database → Create database.'
        : err.message;
      document.getElementById('screenLoading').innerHTML = `
        <div style="text-align:center;padding:3rem 1.5rem;max-width:500px;margin:0 auto;">
          <div style="font-size:2.5rem;margin-bottom:1rem;">⚠️</div>
          <div style="font-size:1rem;color:#f0e6d3;margin-bottom:0.75rem;font-weight:600;">Could not connect to Firebase</div>
          <div style="font-size:0.82rem;color:#9a8e7e;line-height:1.6;">${hint}</div>
        </div>`;
      showScreen('screenLoading');
    }
  }

  function isConfigured() {
    return CONFIG.firebase.projectId !== 'YOUR_PROJECT_ID';
  }

  async function loadMovies() {
    const snap = await db.collection('movies').get();

    // Seed on first run
    if (snap.empty) {
      const batch = db.batch();
      SEED_MOVIES.forEach(m => {
        const ref = db.collection('movies').doc();
        batch.set(ref, { ...m, isEligible: true, domesticGross: 0, boxOfficeRank: null, posterPath: null, tmdbId: null });
      });
      await batch.commit();
      const seeded = await db.collection('movies').get();
      state.movies = seeded.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.isEligible !== false)
        .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    } else {
      state.movies = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.isEligible !== false)
        .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    }
  }

  async function loadParticipants() {
    const snap = await db.collection('participants').get();
    const excludeExact = ['verifier', 'admin'];
    state.participants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => {
        const name = (p.name || '').toLowerCase();
        return !excludeExact.includes(name) && !name.startsWith('console.log');
      })
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  }

  // ── Film strip decoration ──────────────────────────────────────────────
  function renderFilmHoles() {
    ['filmHoles', 'filmHoles2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = Array(30).fill('<div class="film-hole"></div>').join('');
    });
  }

  function updateDeadlineBadge() {
    const badge = document.getElementById('deadlineBadge');
    if (!badge) return;
    if (state.phase === 'post') {
      badge.textContent = '🔒 Picks Locked';
      badge.classList.add('locked');
    }
  }

  // ── Screen navigation ──────────────────────────────────────────────────
  function showScreen(id) {
    ['screenSetup','screenLoading','screenLanding','screenAvatar','screenPicks','screenResults']
      .forEach(s => document.getElementById(s)?.classList.add('hidden'));
    document.getElementById(id)?.classList.remove('hidden');
  }

  // ── Landing screen ─────────────────────────────────────────────────────
  function showLanding() {
    renderParticipantGrid();
    renderPosterWall();
    showScreen('screenLanding');
    document.getElementById('nameInput')?.focus();
  }

  function renderPosterWall() {
    const wall  = document.getElementById('posterWall');
    const strip = document.getElementById('participantStrip');

    // ── Movie poster rows ──────────────────────────────────────────────
    if (wall) {
      const withPosters = state.movies.filter(m => m.posterPath);
      if (withPosters.length < 4) {
        wall.style.display = 'none';
      } else {
        const doubled = [...withPosters, ...withPosters];
        const half    = Math.ceil(doubled.length / 2);
        const row1    = doubled.slice(0, half);
        const row2    = doubled.slice(half).reverse();

        function makeStrip(movies, cls) {
          return `<div class="poster-strip ${cls}">${
            movies.map(m => `<img src="${esc(m.posterPath)}" alt="${esc(m.title)}" class="poster-strip-img" loading="lazy" onerror="this.style.display='none'">`).join('')
          }</div>`;
        }

        wall.innerHTML = makeStrip(row1, 'strip-ltr') + makeStrip(row2, 'strip-rtl');
        wall.style.display = 'flex';
      }
    }

    // ── Participant avatar row ─────────────────────────────────────────
    if (strip) {
      const participants = state.participants;
      if (!participants.length) {
        strip.style.display = 'none';
      } else {
        strip.style.display = '';
        strip.innerHTML = participants.map(p => `
          <div class="ps-card">
            ${p.avatarUrl
              ? `<img src="${esc(p.avatarUrl)}" alt="${esc(p.name)}" class="ps-poster">`
              : `<div class="ps-poster ps-poster-ph">🎬</div>`}
            <div class="ps-nameplate"><div class="ps-name">${esc(p.name)}</div></div>
            ${p.picksSubmitted ? '<div class="ps-check">✓</div>' : ''}
          </div>`).join('');
      }
    }
  }

  function renderParticipantGrid() {
    const grid = document.getElementById('participantGrid');
    if (!grid) return;
    if (!state.participants.length) {
      grid.innerHTML = '<div class="text-dim" style="font-size:0.8rem;width:100%;text-align:center;">Be the first to submit picks!</div>';
      return;
    }
    // Pre-deadline: chips are display-only (picks are private until May 8)
    // Post-deadline: chips are clickable to view picks on the results screen
    const isPreDeadline = state.phase === 'pre';
    grid.innerHTML = state.participants.map(p => `
      <div class="participant-chip ${isPreDeadline ? 'no-click' : ''}"
        ${isPreDeadline ? '' : `onclick="App.selectExistingParticipant('${esc(p.id)}')" title="View ${esc(p.name)}'s picks"`}>
        ${p.avatarUrl
          ? `<img class="chip-avatar" src="${esc(p.avatarUrl)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="chip-avatar-placeholder">🎬</div>`}
        <div class="chip-name">${esc(p.name)}</div>
        <div class="chip-status ${p.picksSubmitted ? 'submitted' : ''}">
          ${p.picksSubmitted ? '✓ Submitted' : 'In Progress'}
        </div>
      </div>
    `).join('');
  }

  async function handleNameSubmit() {
    const nameEl = document.getElementById('nameInput');
    const name = nameEl?.value.trim();
    if (!name) { toast('Enter your name first.', 'error'); return; }

    const btn = document.getElementById('nameSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Loading…';

    try {
      // Case-insensitive lookup via nameLower field
      const snap = await db.collection('participants')
        .where('nameLower', '==', name.toLowerCase())
        .get();

      if (!snap.empty) {
        const doc = snap.docs[0];
        state.participant = { id: doc.id, ...doc.data() };
        if (state.participant.name.toUpperCase() === 'MCRAE') state.adminMode = true;
        await loadExistingPicks(doc.id);
        showPicksScreen();
      } else {
        const ref = await db.collection('participants').add({
          name,
          nameLower: name.toLowerCase(),
          avatarUrl: null,
          picksSubmitted: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        state.participant = { id: ref.id, name, nameLower: name.toLowerCase(), avatarUrl: null, picksSubmitted: false };
        if (name.toUpperCase() === 'MCRAE') state.adminMode = true;
        state.participants.push(state.participant);
        state.picks = [];
        showScreen('screenAvatar');
      }
    } catch (err) {
      toast('Something went wrong: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = "Let's Go";
    }
  }

  async function selectExistingParticipant(id) {
    const p = state.participants.find(x => x.id === id);
    if (!p) return;
    state.participant = p;
    if (state.participant.name.toUpperCase() === 'MCRAE') state.adminMode = true;
    await loadExistingPicks(id);
    showPicksScreen();
  }

  async function loadExistingPicks(participantId) {
    const snap = await db.collection('picks').get();
    const allPicks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const mine = allPicks.filter(p => p.participantId === participantId);
    state.picks = mine
      .filter(p => !p.isDarkHorse)
      .map(p => ({ movieId: p.movieId, rank: p.rank }))
      .sort((a, b) => a.rank - b.rank);
    state.darkHorses = mine
      .filter(p => p.isDarkHorse)
      .map(p => p.movieId);
  }

  function goToLanding() {
    state.participant = null;
    state.adminMode = new URLSearchParams(location.search).get('admin') === '1';
    state.picks = [];
    state.darkHorses = [];
    state.avatarFile = null;
    showLanding();
  }

  // ── Avatar screen ──────────────────────────────────────────────────────
  function handleAvatarFile(file) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast('Image must be under 4MB.', 'error'); return; }
    state.avatarFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      const preview = document.getElementById('avatarPreview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      document.getElementById('avatarPlaceholder').classList.add('hidden');
      document.getElementById('avatarContinueBtn').disabled = false;
    };
    reader.readAsDataURL(file);

    const zone = document.getElementById('avatarZone');
    if (zone) {
      zone.addEventListener('dragover', ev => { ev.preventDefault(); zone.classList.add('drag-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', ev => {
        ev.preventDefault();
        zone.classList.remove('drag-over');
        const f = ev.dataTransfer.files[0];
        if (f) handleAvatarFile(f);
      });
    }
  }

  async function submitAvatar() {
    if (!state.avatarFile || !state.participant) { showPicksScreen(); return; }
    const btn = document.getElementById('avatarContinueBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading…';

    try {
      const ext = state.avatarFile.name.split('.').pop() || 'jpg';
      const path = `avatars/${state.participant.id}-${Date.now()}.${ext}`;
      const ref = storage.ref(path);
      await ref.put(state.avatarFile);
      const avatarUrl = await ref.getDownloadURL();

      await db.collection('participants').doc(state.participant.id).update({ avatarUrl });
      state.participant.avatarUrl = avatarUrl;
      const idx = state.participants.findIndex(p => p.id === state.participant.id);
      if (idx >= 0) state.participants[idx].avatarUrl = avatarUrl;

      showPicksScreen();
    } catch (err) {
      toast('Upload failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Continue to Picks →';
    }
  }

  function skipAvatar() {
    state.avatarFile = null;
    showPicksScreen();
  }

  // ── Picks screen ───────────────────────────────────────────────────────
  function showPicksScreen() {
    document.getElementById('currentPlayerName').textContent = state.participant?.name || '';
    if (state.adminMode) {
      document.getElementById('adminPosterBtn')?.classList.remove('hidden');
    } else {
      document.getElementById('adminPosterBtn')?.classList.add('hidden');
    }
    renderPlayerAvatarThumb();
    renderRankingSlots();
    renderDarkHorseSlots();
    renderMoviePool();
    showScreen('screenPicks');
  }

  function renderPlayerAvatarThumb() {
    const el = document.getElementById('playerAvatarThumb');
    if (!el) return;
    const p = state.participant;
    el.innerHTML = p?.avatarUrl
      ? `<img class="player-avatar-thumb" src="${esc(p.avatarUrl)}" alt="${esc(p.name)}" title="Click to change your avatar">`
      : `<div class="player-avatar-placeholder" title="Click to add an avatar">🎬</div>`;
  }

  async function changeAvatar(file) {
    if (!file || !state.participant) return;
    if (file.size > 4 * 1024 * 1024) { toast('Image must be under 4MB.', 'error'); return; }

    const thumb = document.getElementById('playerAvatarThumb');
    if (thumb) thumb.style.opacity = '0.4';

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${state.participant.id}-${Date.now()}.${ext}`;
      const ref = storage.ref(path);
      await ref.put(file);
      const avatarUrl = await ref.getDownloadURL();

      await db.collection('participants').doc(state.participant.id).update({ avatarUrl });
      state.participant.avatarUrl = avatarUrl;
      const idx = state.participants.findIndex(p => p.id === state.participant.id);
      if (idx >= 0) state.participants[idx].avatarUrl = avatarUrl;

      renderPlayerAvatarThumb();
      toast('Avatar updated! 🎬', 'success');
    } catch (err) {
      toast('Upload failed: ' + err.message, 'error');
    } finally {
      if (thumb) thumb.style.opacity = '';
    }
  }

  function renderMoviePool(filter = '') {
    const grid = document.getElementById('movieGrid');
    if (!grid) return;
    const q = filter.toLowerCase();
    const filtered = q ? state.movies.filter(m => m.title.toLowerCase().includes(q)) : state.movies;
    const rankedIds = new Set(state.picks.map(p => p.movieId));
    const dhIds = new Set(state.darkHorses);

    grid.innerHTML = filtered.map(m => {
      const posterUrl = getPosterUrl(m);
      const isRanked = rankedIds.has(m.id);
      const isDH = dhIds.has(m.id);
      const cls = isRanked ? 'selected' : isDH ? 'dh-selected' : '';
      return `
        <div class="movie-card ${cls}" data-id="${m.id}" onclick="App.addToPicks('${m.id}')">
          ${posterUrl ? `<img class="movie-poster" src="${esc(posterUrl)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <div class="movie-poster-placeholder" style="${posterUrl ? 'display:none' : ''}">
            <div class="poster-icon">${isDH ? '🐴' : '🎬'}</div>
          </div>
          <div class="movie-card-title">${esc(m.title)}</div>
          <div class="movie-card-date">${isDH ? '🐴 Dark Horse' : formatDate(m.releaseDate)}</div>
        </div>
      `;
    }).join('');

    filtered.forEach(m => {
      if (!m.posterPath && !state.posterCache[m.id]) fetchAndCachePoster(m);
    });
  }

  function filterPool(val) { renderMoviePool(val); }

  function renderRankingSlots() {
    const list = document.getElementById('rankingList');
    if (!list) return;
    list.innerHTML = '';

    for (let rank = 1; rank <= 10; rank++) {
      const pick = state.picks.find(p => p.rank === rank);
      const movie = pick ? state.movies.find(m => m.id === pick.movieId) : null;
      const isBookend = rank === 1 || rank === 10;
      const posterUrl = movie ? getPosterUrl(movie) : null;

      const slot = document.createElement('div');
      slot.className = `rank-slot ${pick ? '' : 'empty'}`;
      slot.dataset.rank = rank;
      slot.setAttribute('draggable', pick ? 'true' : 'false');
      slot.addEventListener('dragstart', onDragStart);
      slot.addEventListener('dragover', onDragOver);
      slot.addEventListener('drop', onDrop);
      slot.addEventListener('dragend', onDragEnd);

      slot.innerHTML = `
        <div class="rank-number ${isBookend ? 'bookend' : ''}">${rank}</div>
        ${pick && movie ? `
          <div class="drag-handle">⠿</div>
          ${posterUrl
            ? `<img class="rank-poster-thumb" src="${esc(posterUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="rank-thumb-placeholder">🎬</div>`}
          <div class="rank-info">
            <div class="rank-title rank-title-full">${esc(movie.title)}</div>
            <div class="rank-title rank-title-abbrev">${esc(abbrev(movie.title))}</div>
          </div>
          <button class="remove-pick-btn" onclick="App.removeFromPicks('${movie.id}')" title="Remove">✕</button>
        ` : `
          <div class="rank-info">
            <div class="rank-empty-hint"><span class="hidden-mobile">${isBookend ? '⭐ Bookend bonus (13 pts)' : 'Empty slot'}</span><span class="show-mobile">${isBookend ? '⭐ Bookend' : 'Empty'}</span></div>
          </div>
        `}
      `;
      list.appendChild(slot);
    }
    updatePickCount();
  }

  function renderDarkHorseSlots() {
    const list = document.getElementById('darkHorseList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const movieId = state.darkHorses[i];
      const movie = movieId ? state.movies.find(m => m.id === movieId) : null;
      const posterUrl = movie ? getPosterUrl(movie) : null;
      const slot = document.createElement('div');
      slot.className = `dh-slot ${movie ? '' : 'empty'}`;
      if (movie) {
        slot.innerHTML = `
          <span class="dh-badge">🐴</span>
          ${posterUrl ? `<img class="dh-thumb" src="${esc(posterUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="dh-thumb-placeholder">🎬</div>'}
          <div class="dh-title dh-title-full">${esc(movie.title)}</div>
          <div class="dh-title dh-title-abbrev">${esc(abbrev(movie.title))}</div>
          <button class="remove-pick-btn" onclick="App.removeDarkHorse('${movie.id}')" title="Remove">✕</button>
        `;
      } else {
        slot.innerHTML = `
          <span class="dh-badge" style="opacity:0.25">🐴</span>
          <div class="dh-title" style="color:var(--text-dim);font-style:italic;"><span class="hidden-mobile">Pick from movie pool</span><span class="show-mobile">Empty</span></div>
        `;
      }
      list.appendChild(slot);
    }
    updatePickCount();
  }

  function updatePickCount() {
    const n = state.picks.length;
    const dh = state.darkHorses.length;
    const el = document.getElementById('pickCountNum');
    if (el) el.textContent = n + dh;
    const btn = document.getElementById('submitPicksBtn');
    const hint = document.getElementById('submitHint');
    const ready = n === 10 && dh === 3;
    if (btn) btn.disabled = !ready;
    if (hint) {
      if (n < 10) hint.textContent = `Add ${10 - n} more ranked pick${10 - n !== 1 ? 's' : ''}`;
      else if (dh < 3) hint.textContent = `Add ${3 - dh} more dark horse${3 - dh !== 1 ? 's' : ''} to submit`;
      else hint.textContent = 'Ready to lock in your picks!';
    }
  }

  function addToPicks(movieId) {
    if (state.picks.find(p => p.movieId === movieId)) return;
    if (state.darkHorses.includes(movieId)) return;
    if (state.picks.length < 10) {
      state.picks.push({ movieId, rank: state.picks.length + 1 });
      renderRankingSlots();
    } else if (state.darkHorses.length < 3) {
      state.darkHorses.push(movieId);
      renderDarkHorseSlots();
    } else {
      toast("All 13 picks are filled! Remove one to swap.", 'error');
      return;
    }
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  function removeFromPicks(movieId) {
    state.picks = state.picks.filter(p => p.movieId !== movieId);
    state.picks.sort((a, b) => a.rank - b.rank).forEach((p, i) => p.rank = i + 1);
    renderRankingSlots();
    renderDarkHorseSlots();
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  function removeDarkHorse(movieId) {
    state.darkHorses = state.darkHorses.filter(id => id !== movieId);
    renderDarkHorseSlots();
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  // ── Drag & drop reordering ─────────────────────────────────────────────
  let dragFromRank = null;

  function onDragStart(e) {
    dragFromRank = parseInt(this.dataset.rank);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.rank-slot').forEach(s => s.classList.remove('drag-over'));
    this.classList.add('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    const toRank = parseInt(this.dataset.rank);
    if (dragFromRank && toRank && dragFromRank !== toRank) reorderPicks(dragFromRank, toRank);
    document.querySelectorAll('.rank-slot').forEach(s => s.classList.remove('drag-over'));
  }

  function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.rank-slot').forEach(s => s.classList.remove('drag-over'));
    dragFromRank = null;
  }

  function reorderPicks(fromRank, toRank) {
    const direction = toRank > fromRank ? 1 : -1;
    state.picks.forEach(p => {
      if (p.rank === fromRank) {
        p.rank = toRank;
      } else if (
        direction === 1  && p.rank > fromRank && p.rank <= toRank ||
        direction === -1 && p.rank >= toRank  && p.rank < fromRank
      ) {
        p.rank -= direction;
      }
    });
    state.picks.sort((a, b) => a.rank - b.rank);
    renderRankingSlots();
  }

  // ── Submit picks ───────────────────────────────────────────────────────
  async function submitPicks() {
    if (state.picks.length < 10 || state.darkHorses.length < 3 || !state.participant) return;
    const btn = document.getElementById('submitPicksBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      // Delete existing picks for this participant
      const existing = await db.collection('picks')
        .where('participantId', '==', state.participant.id).get();
      const deleteBatch = db.batch();
      existing.docs.forEach(d => deleteBatch.delete(d.ref));
      await deleteBatch.commit();

      // Write ranked picks + dark horses
      const writeBatch = db.batch();
      state.picks.forEach(pick => {
        const ref = db.collection('picks').doc();
        writeBatch.set(ref, {
          participantId: state.participant.id,
          movieId: pick.movieId,
          rank: pick.rank,
          isDarkHorse: false,
        });
      });
      state.darkHorses.forEach(movieId => {
        const ref = db.collection('picks').doc();
        writeBatch.set(ref, {
          participantId: state.participant.id,
          movieId,
          rank: null,
          isDarkHorse: true,
        });
      });
      await writeBatch.commit();

      await db.collection('participants').doc(state.participant.id).update({ picksSubmitted: true });
      state.participant.picksSubmitted = true;
      const idx = state.participants.findIndex(p => p.id === state.participant.id);
      if (idx >= 0) state.participants[idx].picksSubmitted = true;

      toast('Your picks are locked in! 🎬', 'success');
      btn.textContent = '✓ Picks Saved';
      const hint = document.getElementById('submitHint');
      if (hint) hint.textContent = 'Picks submitted! You can update them before May 8.';
    } catch (err) {
      toast('Failed to save: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Lock In My Picks';
    }
  }

  // ── Poster fetching ────────────────────────────────────────────────────
  function getPosterUrl(movie) {
    if (state.posterCache[movie.id]) return state.posterCache[movie.id];
    if (movie.posterPath) {
      // Full URL (Firebase Storage upload) vs TMDB path
      const url = movie.posterPath.startsWith('http')
        ? movie.posterPath
        : `https://image.tmdb.org/t/p/w342${movie.posterPath}`;
      state.posterCache[movie.id] = url;
      return url;
    }
    return null;
  }

  // ── Poster manager ─────────────────────────────────────────────────────
  function showPosterManager() {
    const grid = document.getElementById('pmGrid');
    if (!grid) return;

    grid.innerHTML = state.movies.map(m => {
      const posterUrl = getPosterUrl(m);
      return `
        <div class="pm-card" id="pm-${m.id}">
          ${posterUrl
            ? `<img class="pm-poster" src="${esc(posterUrl)}" alt="${esc(m.title)}" loading="lazy">`
            : `<div class="pm-poster-placeholder"><div class="pm-icon">🎬</div><span>No poster</span></div>`}
          <div class="pm-title">${esc(m.title)}</div>
          <label class="pm-upload-label">
            ${posterUrl ? '↑ Replace file' : '+ Upload file'}
            <input type="file" accept="image/*" class="hidden" onchange="App.handlePosterUpload('${m.id}', this.files[0])">
          </label>
          <div class="pm-url-row">
            <input
              type="text"
              class="pm-url-input"
              id="pm-url-${m.id}"
              placeholder="…or paste image URL"
              onkeydown="if(event.key==='Enter'){App.handlePosterUrlSet('${m.id}',this.value);this.value='';}"
            >
            <button class="pm-url-btn" onclick="App.handlePosterUrlSet('${m.id}',document.getElementById('pm-url-${m.id}').value);document.getElementById('pm-url-${m.id}').value='';">Set</button>
          </div>
          <div class="pm-spinner"><span class="spinner"></span></div>
        </div>
      `;
    }).join('');

    document.getElementById('posterManager')?.classList.remove('hidden');
  }

  function hidePosterManager() {
    document.getElementById('posterManager')?.classList.add('hidden');
  }

  async function handlePosterUpload(movieId, file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('Image must be under 8MB.', 'error'); return; }

    const card = document.getElementById(`pm-${movieId}`);
    card?.classList.add('uploading');

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const ref = storage.ref(`posters/${movieId}.${ext}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();

      await db.collection('movies').doc(movieId).update({ posterPath: url });

      const movie = state.movies.find(m => m.id === movieId);
      if (movie) { movie.posterPath = url; state.posterCache[movieId] = url; }

      // Update the card in the manager
      if (card) {
        card.innerHTML = `
          <img class="pm-poster" src="${esc(url)}" alt="" loading="lazy">
          <div class="pm-title">${esc(movie?.title || '')}</div>
          <label class="pm-upload-label">
            ↑ Replace
            <input type="file" accept="image/*" class="hidden" onchange="App.handlePosterUpload('${movieId}', this.files[0])">
          </label>
          <div class="pm-spinner"><span class="spinner"></span></div>
        `;
      }

      toast(`Poster saved for ${movie?.title || 'movie'}!`, 'success');
      // Refresh pool/ranking if visible
      renderMoviePool(document.getElementById('poolSearch')?.value || '');
      renderRankingSlots();
    } catch (err) {
      toast('Upload failed: ' + err.message, 'error');
    } finally {
      card?.classList.remove('uploading');
    }
  }

  async function handlePosterUrlSet(movieId, url) {
    url = (url || '').trim();
    if (!url) { toast('Paste a URL first.', 'error'); return; }
    if (!/^https?:\/\//.test(url)) { toast('URL must start with http:// or https://', 'error'); return; }

    const card = document.getElementById(`pm-${movieId}`);
    card?.classList.add('uploading');

    try {
      await db.collection('movies').doc(movieId).update({ posterPath: url });

      const movie = state.movies.find(m => m.id === movieId);
      if (movie) { movie.posterPath = url; state.posterCache[movieId] = url; }

      // Swap placeholder / old image for the new one
      const existing = card?.querySelector('.pm-poster, .pm-poster-placeholder');
      if (existing) {
        const newImg = document.createElement('img');
        newImg.className = 'pm-poster';
        newImg.src = url;
        newImg.alt = '';
        newImg.loading = 'lazy';
        existing.replaceWith(newImg);
      }

      toast(`Poster URL saved for ${movie?.title || 'movie'}! 🎬`, 'success');
      renderMoviePool(document.getElementById('poolSearch')?.value || '');
      renderRankingSlots();
    } catch (err) {
      toast('Failed to save URL: ' + err.message, 'error');
    } finally {
      card?.classList.remove('uploading');
    }
  }

  async function fetchAndCachePoster(movie) {
    if (!CONFIG.tmdb?.apiKey || CONFIG.tmdb.apiKey === 'YOUR_TMDB_API_KEY') return;
    try {
      const year = movie.releaseDate ? new Date(movie.releaseDate + 'T12:00:00').getFullYear() : 2026;
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${CONFIG.tmdb.apiKey}&query=${encodeURIComponent(movie.title)}&year=${year}&language=en-US`
      );
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.poster_path) {
        const posterUrl = `https://image.tmdb.org/t/p/w342${result.poster_path}`;
        state.posterCache[movie.id] = posterUrl;
        await db.collection('movies').doc(movie.id).update({
          posterPath: result.poster_path,
          tmdbId: result.id,
        });
        movie.posterPath = result.poster_path;
        movie.tmdbId = result.id;

        // Update card if visible
        const card = document.querySelector(`.movie-card[data-id="${movie.id}"]`);
        if (card) {
          const img = card.querySelector('.movie-poster');
          const placeholder = card.querySelector('.movie-poster-placeholder');
          if (img) { img.src = posterUrl; img.style.display = ''; }
          if (placeholder) placeholder.style.display = 'none';
        }
      }
    } catch (_) { /* silently ignore */ }
  }

  // ── Scoring ────────────────────────────────────────────────────────────
  function scoreParticipantPicks(picks) {
    const actualTop10 = state.movies
      .filter(m => m.boxOfficeRank && m.boxOfficeRank <= 10)
      .sort((a, b) => a.boxOfficeRank - b.boxOfficeRank);

    const actualRank = {};
    actualTop10.forEach((m, i) => { actualRank[m.id] = i + 1; });

    let total = 0;
    const rankedPicks = picks.filter(p => !p.isDarkHorse);
    const dhPicks = picks.filter(p => p.isDarkHorse);

    const scoredRanked = rankedPicks.map(pick => {
      const ar = actualRank[pick.movieId];
      let pts = 0, label = '';
      if (ar === undefined) {
        pts = 0; label = 'Not in top 10';
      } else {
        const diff = Math.abs(pick.rank - ar);
        if (diff === 0) {
          pts = BOOKEND_RANKS.has(pick.rank) ? PTS_EXACT_BOOKEND : PTS_EXACT;
          label = 'Exact! 🎯';
        } else if (diff === 1) {
          pts = PTS_OFF1; label = '1 spot off';
        } else if (diff === 2) {
          pts = PTS_OFF2; label = '2 spots off';
        } else {
          pts = PTS_IN_TOP10; label = `In top 10 (#${ar})`;
        }
      }
      total += pts;
      return { ...pick, pts, label, actualRank: ar };
    });

    const scoredDH = dhPicks.map(pick => {
      const ar = actualRank[pick.movieId];
      const pts = ar !== undefined ? PTS_DARK_HORSE : 0;
      const label = ar !== undefined ? `🐴 Made it! (#${ar})` : '🐴 Missed';
      total += pts;
      return { ...pick, pts, label, actualRank: ar };
    });

    return { scored: [...scoredRanked, ...scoredDH], total };
  }

  // ── Results screen ─────────────────────────────────────────────────────
  const MOVIE_PALETTE = [
    '#ef5350','#ec407a','#ab47bc','#7e57c2','#5c6bc0',
    '#42a5f5','#00acc1','#26a69a','#66bb6a','#d4e157',
    '#ffca28','#ffa726','#ff7043','#a1887f','#78909c',
    '#29b6f6','#9ccc65','#fff176','#f06292','#ce93d8',
    '#80cbc4','#aed581','#ffd54f','#ff8a65','#b0bec5',
    '#e57373','#4dd0e1','#81c784','#ffb74d','#9575cd',
  ];

  function abbrev(title) {
    const stop = /^(the|and|of|&|in|a|an|to|at|by|for|from|with|on|vs|best|last|hit|me|hard|soft|live|3d)$/i;
    const words = title.split(/[\s:&\-–!]+/).filter(Boolean);
    const sig = words.filter(w => !stop.test(w));
    const src = sig.length ? sig : words;
    if (src.length === 1) return src[0].slice(0, 5).toUpperCase();
    return src.map(w => w[0].toUpperCase()).join('').slice(0, 6);
  }

  function moviePtsForPlayer(movieId, picks, actualRankMap) {
    const rp = picks.filter(p => !p.isDarkHorse).find(p => p.movieId === movieId);
    const dp = picks.filter(p => p.isDarkHorse).find(p => p.movieId === movieId);
    if (!rp && !dp) return null;
    const ar = actualRankMap[movieId];
    if (rp) {
      if (ar === undefined) return 0;
      const diff = Math.abs(rp.rank - ar);
      if (diff === 0) return BOOKEND_RANKS.has(rp.rank) ? PTS_EXACT_BOOKEND : PTS_EXACT;
      if (diff === 1) return PTS_OFF1;
      if (diff === 2) return PTS_OFF2;
      return PTS_IN_TOP10;
    }
    return ar !== undefined ? PTS_DARK_HORSE : 0;
  }

  async function showResultsScreen() {
    showScreen('screenResults');

    if (state.adminMode) {
      const pw = sessionStorage.getItem('adminPw') || prompt('Admin password:');
      if (pw === CONFIG.adminPassword) {
        sessionStorage.setItem('adminPw', pw);
        document.getElementById('adminBar')?.classList.remove('hidden');
      } else if (pw !== null) {
        toast('Incorrect password.', 'error');
      }
    }

    // Load all picks once, share across renderers
    const snap = await db.collection('picks').get();
    const allPicks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const pbp = {};
    allPicks.forEach(row => {
      if (!pbp[row.participantId]) pbp[row.participantId] = [];
      pbp[row.participantId].push({ movieId: row.movieId, rank: row.rank, isDarkHorse: row.isDarkHorse });
    });
    state._picksByParticipant = pbp;

    // Sort participants by score
    const withScores = state.participants
      .filter(p => p.picksSubmitted)
      .map(p => { const { total } = scoreParticipantPicks(pbp[p.id] || []); return { ...p, score: total }; })
      .sort((a, b) => b.score - a.score);

    renderLeaderboard(withScores);
    renderQuickLookGrid(withScores, pbp);
    renderBoxOfficeTable(withScores, pbp);
  }

  function renderLeaderboard(participants) {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    const topScore = participants.length ? participants[0].score : null;

    // Assign display medals by score tier (not position)
    let tierIdx = -1;
    let lastScore = null;
    const tierMedals = ['👑', '🥈', '🥉'];
    const withTier = participants.map(p => {
      if (p.score !== lastScore) { tierIdx++; lastScore = p.score; }
      return { ...p, tier: tierIdx };
    });

    list.innerHTML = withTier.length ? withTier.map((p) => {
      const isFirst = p.score === topScore && topScore !== null;
      const medal = tierMedals[p.tier] ?? (p.tier + 1);
      return `
      <div class="leaderboard-row${isFirst ? ' lb-first' : ''}">
        <div class="lb-rank${isFirst ? ' lb-rank-first' : ''}">${medal}</div>
        ${p.avatarUrl
          ? `<img class="lb-avatar" src="${esc(p.avatarUrl)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="lb-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🎬</div>`}
        <div class="lb-name${isFirst ? ' lb-name-first' : ''}">${esc(p.name)}</div>
        <div class="lb-score${isFirst ? ' lb-score-first' : ''}">${p.score}</div>
      </div>`;
    }).join('') : '<div class="text-dim" style="padding:1rem;font-size:0.8rem;">No picks submitted yet.</div>';
  }

  function renderQuickLookGrid(participants, pbp) {
    const grid = document.getElementById('comparisonGrid');
    if (!grid || !participants.length) { if (grid) grid.innerHTML = ''; return; }

    // Assign colors in first-appearance order
    const colorMap = {};
    let ci = 0;
    const color = id => { if (!colorMap[id]) colorMap[id] = MOVIE_PALETTE[ci++ % MOVIE_PALETTE.length]; return colorMap[id]; };
    participants.forEach(p => {
      const picks = pbp[p.id] || [];
      [...picks.filter(x=>!x.isDarkHorse).sort((a,b)=>a.rank-b.rank),
       ...picks.filter(x=>x.isDarkHorse)].forEach(pk => color(pk.movieId));
    });

    const cell = (movieId) => {
      if (!movieId) return `<td class="cg-cell cg-empty">—</td>`;
      const m = state.movies.find(m => m.id === movieId);
      return `<td class="cg-cell" style="background:${color(movieId)};" title="${m ? esc(m.title) : ''}">${m ? abbrev(m.title) : '?'}</td>`;
    };

    let html = `<div class="cg-scroll"><table class="cg-table"><thead><tr>
      <th class="cg-th cg-row-label"></th>
      ${participants.map(p=>`<th class="cg-th">${esc(p.name)}</th>`).join('')}
    </tr></thead><tbody>`;

    for (let r = 1; r <= 10; r++) {
      html += `<tr><td class="cg-row-label${r===1||r===10?' cg-bookend':''}">${r}</td>`;
      participants.forEach(p => {
        const pk = (pbp[p.id]||[]).filter(x=>!x.isDarkHorse).find(x=>x.rank===r);
        html += cell(pk?.movieId);
      });
      html += '</tr>';
    }
    for (let dhi = 0; dhi < 3; dhi++) {
      html += `<tr><td class="cg-row-label cg-dh-label">🐴</td>`;
      participants.forEach(p => {
        const dhs = (pbp[p.id]||[]).filter(x=>x.isDarkHorse);
        html += cell(dhs[dhi]?.movieId);
      });
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    // Legend
    const legendItems = Object.keys(colorMap)
      .map(id => ({ id, bg: colorMap[id], m: state.movies.find(m=>m.id===id) }))
      .filter(x=>x.m);
    html += `<div class="cg-legend">${legendItems.map(x=>`
      <div class="cg-legend-item">
        <span class="cg-swatch" style="background:${x.bg};"></span>
        <span class="cg-ab">${abbrev(x.m.title)}</span>
        <span class="cg-legend-full">${esc(x.m.title)}</span>
      </div>`).join('')}</div>`;

    grid.innerHTML = html;
  }

  function renderBoxOfficeTable(participants, pbp) {
    const wrap = document.getElementById('boTableWrap');
    const updatedEl = document.getElementById('boUpdated');
    if (!wrap) return;

    const hasGross = state.movies.filter(m => m.domesticGross > 0).sort((a,b) => b.domesticGross - a.domesticGross);
    if (!hasGross.length) {
      wrap.innerHTML = '<div class="text-dim" style="padding:1rem;font-size:0.8rem;">Box office data not yet available. Check back soon!</div>';
      return;
    }

    const actualRankMap = {};
    state.movies.filter(m => m.boxOfficeRank && m.boxOfficeRank <= 10).forEach(m => { actualRankMap[m.id] = m.boxOfficeRank; });

    const ptTotals = {};
    participants.forEach(p => { ptTotals[p.id] = 0; });

    let html = `<table class="bot-table"><thead><tr>
      <th class="bot-rank-h">#</th>
      <th class="bot-poster-h"></th>
      <th class="bot-title-h">Movie</th>
      <th class="bot-gross-h">Domestic Gross</th>
      ${participants.map(p=>`<th class="bot-player-h">${esc(p.name)}</th>`).join('')}
    </tr></thead><tbody>`;

    hasGross.forEach((m, i) => {
      const posterUrl = getPosterUrl(m);
      const rank = m.boxOfficeRank || '—';
      const gross = `$${(m.domesticGross/1_000_000).toFixed(1)}M`;
      const inTop10 = m.boxOfficeRank && m.boxOfficeRank <= 10;

      html += `<tr class="bot-row${i%2?' bot-odd':''}">
        <td class="bot-rank-cell${inTop10?' bot-top10':''}">${rank}</td>
        <td class="bot-poster-cell">${posterUrl
          ? `<img src="${esc(posterUrl)}" class="bot-poster-img" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="bot-poster-ph">🎬</div>`}</td>
        <td class="bot-title-cell">${esc(m.title)}</td>
        <td class="bot-gross-cell">${gross}</td>`;

      participants.forEach(p => {
        const picks = pbp[p.id] || [];
        const pts = moviePtsForPlayer(m.id, picks, actualRankMap);
        const isDH = picks.filter(x=>x.isDarkHorse).some(x=>x.movieId===m.id);
        const isAny = picks.some(x=>x.movieId===m.id);
        if (pts !== null && pts > 0) ptTotals[p.id] += pts;
        const cls = pts===null ? 'bot-none' : pts>=13 ? 'bot-exact' : pts>=7 ? 'bot-close' : pts>0 ? 'bot-ok' : isAny ? 'bot-zero' : 'bot-none';
        const disp = pts===null ? '' : isDH && pts>0 ? `🐴 +${pts}` : pts>0 ? pts : isAny ? (isDH?'🐴 0':'0') : '';
        html += `<td class="bot-pts-cell ${cls}">${disp}</td>`;
      });
      html += '</tr>';
    });

    html += `<tr class="bot-totals-row">
      <td colspan="4">Total Points</td>
      ${participants.map(p=>`<td class="bot-pts-cell bot-total">${ptTotals[p.id]}</td>`).join('')}
    </tr></tbody></table>`;

    wrap.innerHTML = html;
    if (updatedEl) updatedEl.textContent = `🎯 Box Office — Updated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`;
  }


  // ── Admin: Box Office editor ───────────────────────────────────────────
  function showBoEditor() {
    const tbody = document.querySelector('#boEditTable tbody');
    if (!tbody) return;
    tbody.innerHTML = state.movies.map(m => `
      <tr>
        <td>${esc(m.title)}</td>
        <td><input type="number" class="bo-edit-input" data-id="${m.id}" value="${m.domesticGross || ''}" placeholder="0" min="0"></td>
      </tr>
    `).join('');
    document.getElementById('boEditor')?.classList.remove('hidden');
  }

  function hideBoEditor() {
    document.getElementById('boEditor')?.classList.add('hidden');
  }

  async function saveBoxOffice() {
    const inputs = document.querySelectorAll('#boEditTable .bo-edit-input');
    const status = document.getElementById('adminStatus');
    if (status) status.textContent = 'Saving…';

    try {
      const updates = Array.from(inputs).map(inp => ({
        id: inp.dataset.id,
        domesticGross: parseInt(inp.value) || 0,
      }));
      const sorted = [...updates].sort((a, b) => b.domesticGross - a.domesticGross);
      sorted.forEach((u, i) => { u.boxOfficeRank = u.domesticGross > 0 ? i + 1 : null; });

      const batch = db.batch();
      sorted.forEach(u => {
        batch.update(db.collection('movies').doc(u.id), {
          domesticGross: u.domesticGross,
          boxOfficeRank: u.boxOfficeRank,
        });
        const movie = state.movies.find(m => m.id === u.id);
        if (movie) { movie.domesticGross = u.domesticGross; movie.boxOfficeRank = u.boxOfficeRank; }
      });
      await batch.commit();

      toast('Box office updated! 🎬', 'success');
      if (status) status.textContent = `Last saved ${new Date().toLocaleTimeString()}`;
      hideBoEditor();
      // Re-render results with updated data
      const snap2 = await db.collection('picks').get();
      const pbp2 = {};
      snap2.docs.forEach(d => {
        const r = d.data();
        if (!pbp2[r.participantId]) pbp2[r.participantId] = [];
        pbp2[r.participantId].push({ movieId: r.movieId, rank: r.rank, isDarkHorse: r.isDarkHorse });
      });
      const ws2 = state.participants
        .filter(p => p.picksSubmitted)
        .map(p => { const {total} = scoreParticipantPicks(pbp2[p.id]||[]); return {...p,score:total}; })
        .sort((a,b) => b.score - a.score);
      renderLeaderboard(ws2);
      renderQuickLookGrid(ws2, pbp2);
      renderBoxOfficeTable(ws2, pbp2);
    } catch (err) {
      toast('Save failed: ' + err.message, 'error');
      if (status) status.textContent = 'Save failed.';
    }
  }

  async function apifySync() {
    const token = CONFIG.apify?.token;
    if (!token || token === 'YOUR_APIFY_TOKEN') {
      toast('Add your Apify token to config.js first. Free at console.apify.com/account/integrations', 'error');
      return;
    }
    const status = document.getElementById('adminStatus');
    if (status) status.textContent = 'Fetching from Box Office Mojo via Apify…';

    // Send all movies — BOM returns nothing for unreleased ones, which is fine
    const released = state.movies.filter(m => m.title);
    if (!released.length) { toast('No movies loaded yet.', 'error'); return; }

    const movieList = released.map(m => {
      const year = m.releaseDate ? m.releaseDate.slice(0, 4) : '';
      return year ? `${m.title} ${year}` : m.title;
    });

    try {
      if (status) status.textContent = `Querying Box Office Mojo for ${movieList.length} movies… (~30s)`;
      const res = await fetch(
        `https://api.apify.com/v2/acts/trovevault~movie-box-office-tracker/run-sync-get-dataset-items?token=${token}&timeout=120`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movies: movieList }) }
      );
      if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
      const results = await res.json();
      if (!results.length) { toast('Apify returned no results.', 'error'); return; }

      let updated = 0;
      const batch = db.batch();
      for (const row of results) {
        if (!row.domesticGross) continue;
        const gross = typeof row.domesticGross === 'number'
          ? row.domesticGross
          : parseInt(String(row.domesticGross).replace(/[^0-9]/g, ''));
        if (!gross || gross <= 0) continue;
        const rowTitle = (row.title || '').toLowerCase();
        const match = released.find(m => {
          const t = m.title.toLowerCase();
          return t === rowTitle || t.includes(rowTitle) || rowTitle.includes(t);
        });
        if (!match) { console.warn('No BOM match for:', row.title); continue; }
        batch.update(db.collection('movies').doc(match.id), { domesticGross: gross });
        match.domesticGross = gross;
        updated++;
      }

      // Recalculate all ranks
      const withGross = state.movies.filter(m => m.domesticGross > 0).sort((a, b) => b.domesticGross - a.domesticGross);
      withGross.forEach((m, i) => { m.boxOfficeRank = i + 1; batch.update(db.collection('movies').doc(m.id), { boxOfficeRank: i + 1 }); });
      state.movies.filter(m => !m.domesticGross && m.boxOfficeRank).forEach(m => { m.boxOfficeRank = null; batch.update(db.collection('movies').doc(m.id), { boxOfficeRank: null }); });
      await batch.commit();

      toast(`✅ Synced ${updated} movies from Box Office Mojo!`, 'success');
      if (status) status.textContent = `BOM sync: ${updated} updated · ${new Date().toLocaleTimeString()}`;

      const snap2 = await db.collection('picks').get();
      const pbp2 = {};
      snap2.docs.forEach(d => { const r = d.data(); if (!pbp2[r.participantId]) pbp2[r.participantId] = []; pbp2[r.participantId].push({ movieId: r.movieId, rank: r.rank, isDarkHorse: r.isDarkHorse }); });
      const ws2 = state.participants.filter(p => p.picksSubmitted).map(p => { const {total} = scoreParticipantPicks(pbp2[p.id]||[]); return {...p,score:total}; }).sort((a,b) => b.score-a.score);
      renderLeaderboard(ws2); renderQuickLookGrid(ws2, pbp2); renderBoxOfficeTable(ws2, pbp2);
    } catch (err) {
      toast('Sync failed: ' + err.message, 'error');
      if (status) status.textContent = 'Sync failed: ' + err.message;
    }
  }


  async function deleteUser() {
    if (!state.participant) return;
    if (!confirm('Are you sure you want to delete your player profile? This will permanently erase your picks.')) return;

    try {
      const existing = await db.collection('picks')
        .where('participantId', '==', state.participant.id).get();
      const batch = db.batch();
      existing.docs.forEach(d => batch.delete(d.ref));

      batch.delete(db.collection('participants').doc(state.participant.id));
      await batch.commit();

      state.participants = state.participants.filter(p => p.id !== state.participant.id);
      toast('Player profile deleted.', 'success');
      goToLanding();
    } catch (err) {
      toast('Failed to delete user: ' + err.message, 'error');
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  function toast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    init, handleNameSubmit, goToLanding, selectExistingParticipant,
    handleAvatarFile, submitAvatar, skipAvatar,
    addToPicks, removeFromPicks, filterPool, submitPicks,
    showBoEditor, hideBoEditor, saveBoxOffice, apifySync,
    showPosterManager, hidePosterManager, handlePosterUpload, handlePosterUrlSet,
    changeAvatar, removeDarkHorse, deleteUser,
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
