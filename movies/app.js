/* Summer Movie Wager 2026 — Firebase edition */

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let db = null;
  let storage = null;
  let state = {
    phase: 'pre',
    participant: null,      // { id, name, avatarUrl, picksSubmitted }
    avatarFile: null,
    picks: [],              // [{ movieId, rank, isDarkHorse }]
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
      await loadMovies();
      await loadParticipants();
      updateDeadlineBadge();

      if (state.phase === 'post') {
        showResultsScreen();
      } else {
        showLanding();
      }
    } catch (err) {
      document.getElementById('screenLoading').innerHTML =
        `<div class="loading-state"><div style="font-size:2rem;margin-bottom:1rem;">⚠️</div>
         <div>Could not connect to Firebase.<br><small style="color:var(--text-dim)">${err.message}</small></div></div>`;
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
    state.participants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
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
    showScreen('screenLanding');
    document.getElementById('nameInput')?.focus();
  }

  function renderParticipantGrid() {
    const grid = document.getElementById('participantGrid');
    if (!grid) return;
    if (!state.participants.length) {
      grid.innerHTML = '<div class="text-dim" style="font-size:0.8rem;width:100%;text-align:center;">Be the first to submit picks!</div>';
      return;
    }
    grid.innerHTML = state.participants.map(p => `
      <button class="participant-chip" onclick="App.selectExistingParticipant('${esc(p.id)}')" title="Pick as ${esc(p.name)}">
        ${p.avatarUrl
          ? `<img class="chip-avatar" src="${esc(p.avatarUrl)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="chip-avatar-placeholder">🎬</div>`}
        <div class="chip-name">${esc(p.name)}</div>
        <div class="chip-status ${p.picksSubmitted ? 'submitted' : ''}">
          ${p.picksSubmitted ? '✓ Submitted' : 'In Progress'}
        </div>
      </button>
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
    await loadExistingPicks(id);
    showPicksScreen();
  }

  async function loadExistingPicks(participantId) {
    const snap = await db.collection('picks').get();
    const allPicks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.picks = allPicks
      .filter(p => p.participantId === participantId)
      .map(p => ({ movieId: p.movieId, rank: p.rank, isDarkHorse: p.isDarkHorse }))
      .sort((a, b) => a.rank - b.rank);
  }

  function goToLanding() {
    state.participant = null;
    state.picks = [];
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
    if (state.adminMode) document.getElementById('adminPosterBtn')?.classList.remove('hidden');
    renderPlayerAvatarThumb();
    renderRankingSlots();
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
    const selectedIds = new Set(state.picks.map(p => p.movieId));

    grid.innerHTML = filtered.map(m => {
      const posterUrl = getPosterUrl(m);
      const isSelected = selectedIds.has(m.id);
      return `
        <div class="movie-card ${isSelected ? 'selected' : ''}" data-id="${m.id}" onclick="App.addToPicks('${m.id}')">
          ${posterUrl ? `<img class="movie-poster" src="${esc(posterUrl)}" alt="${esc(m.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <div class="movie-poster-placeholder" style="${posterUrl ? 'display:none' : ''}">
            <div class="poster-icon">🎬</div>
          </div>
          <div class="movie-card-title">${esc(m.title)}</div>
          <div class="movie-card-date">${formatDate(m.releaseDate)}</div>
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
            <div class="rank-title">${esc(movie.title)}</div>
          </div>
          <button class="dark-horse-btn ${pick.isDarkHorse ? 'active' : ''}"
            onclick="App.toggleDarkHorse('${movie.id}')" title="Mark as dark horse (+1 bonus if it cracks top 10)">
            ${pick.isDarkHorse ? '🐴 Dark Horse' : 'Dark Horse'}
          </button>
          <button class="remove-pick-btn" onclick="App.removeFromPicks('${movie.id}')" title="Remove">✕</button>
        ` : `
          <div class="rank-info">
            <div class="rank-empty-hint">${isBookend ? '⭐ Bookend bonus (13 pts)' : 'Empty slot'}</div>
          </div>
        `}
      `;
      list.appendChild(slot);
    }
    updatePickCount();
  }

  function updatePickCount() {
    const n = state.picks.length;
    const el = document.getElementById('pickCountNum');
    if (el) el.textContent = n;
    const btn = document.getElementById('submitPicksBtn');
    const hint = document.getElementById('submitHint');
    if (btn) btn.disabled = n < 10;
    if (hint) hint.textContent = n < 10
      ? `Select ${10 - n} more movie${10 - n !== 1 ? 's' : ''} to submit`
      : 'Ready to lock in your picks!';
  }

  function addToPicks(movieId) {
    if (state.picks.length >= 10) { toast('You've already picked 10 movies!', 'error'); return; }
    if (state.picks.find(p => p.movieId === movieId)) return;
    state.picks.push({ movieId, rank: state.picks.length + 1, isDarkHorse: false });
    renderRankingSlots();
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  function removeFromPicks(movieId) {
    state.picks = state.picks.filter(p => p.movieId !== movieId);
    state.picks.sort((a, b) => a.rank - b.rank).forEach((p, i) => p.rank = i + 1);
    renderRankingSlots();
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  function toggleDarkHorse(movieId) {
    const pick = state.picks.find(p => p.movieId === movieId);
    if (pick) { pick.isDarkHorse = !pick.isDarkHorse; renderRankingSlots(); }
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
    if (state.picks.length < 10 || !state.participant) return;
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

      // Write new picks
      const writeBatch = db.batch();
      state.picks.forEach(pick => {
        const ref = db.collection('picks').doc();
        writeBatch.set(ref, {
          participantId: state.participant.id,
          movieId: pick.movieId,
          rank: pick.rank,
          isDarkHorse: pick.isDarkHorse,
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
            ${posterUrl ? '↑ Replace' : '+ Upload'}
            <input type="file" accept="image/*" class="hidden" onchange="App.handlePosterUpload('${m.id}', this.files[0])">
          </label>
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
    const ranked = state.movies
      .filter(m => m.boxOfficeRank && m.boxOfficeRank <= 10)
      .sort((a, b) => a.boxOfficeRank - b.boxOfficeRank);

    const actualRank = {};
    ranked.forEach((m, i) => { actualRank[m.id] = i + 1; });

    let total = 0;
    const scored = picks.map(pick => {
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
        if (pick.isDarkHorse) { pts += PTS_DARK_HORSE; label += ' +1🐴'; }
      }

      total += pts;
      return { ...pick, pts, label, actualRank: ar };
    });

    return { scored, total };
  }

  // ── Results screen ─────────────────────────────────────────────────────
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

    await Promise.all([renderLeaderboard(), renderBoxOffice()]);
  }

  async function renderLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    const snap = await db.collection('picks').get();
    const allPicks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const picksByParticipant = {};
    allPicks.forEach(row => {
      if (!picksByParticipant[row.participantId]) picksByParticipant[row.participantId] = [];
      picksByParticipant[row.participantId].push({
        movieId: row.movieId, rank: row.rank, isDarkHorse: row.isDarkHorse,
      });
    });
    state._picksByParticipant = picksByParticipant;

    const scored = state.participants
      .filter(p => p.picksSubmitted)
      .map(p => {
        const picks = picksByParticipant[p.id] || [];
        const { total } = scoreParticipantPicks(picks);
        return { ...p, score: total };
      })
      .sort((a, b) => b.score - a.score);

    list.innerHTML = scored.length ? scored.map((p, i) => `
      <div class="leaderboard-row" onclick="App.showParticipantDetail('${esc(p.id)}')">
        <div class="lb-rank">${i + 1}</div>
        ${p.avatarUrl
          ? `<img class="lb-avatar" src="${esc(p.avatarUrl)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="lb-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🎬</div>`}
        <div class="lb-name">${esc(p.name)}</div>
        <div class="lb-score">${p.score}</div>
      </div>
    `).join('') : '<div class="text-dim" style="padding:1rem;font-size:0.8rem;">No picks submitted yet.</div>';
  }

  function showParticipantDetail(participantId) {
    state.selectedParticipantId = participantId;
    document.querySelectorAll('.leaderboard-row').forEach(row => {
      row.classList.toggle('active', row.getAttribute('onclick')?.includes(`'${participantId}'`));
    });

    const participant = state.participants.find(p => p.id === participantId);
    if (!participant) return;
    const picks = (state._picksByParticipant?.[participantId] || []).sort((a, b) => a.rank - b.rank);
    const { scored, total } = scoreParticipantPicks(picks);

    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    const ptsClass = pts => pts >= 13 ? 'exact' : pts >= 7 ? 'close' : pts >= 3 ? 'in-top' : 'miss';

    panel.innerHTML = `
      <div class="detail-header">
        ${participant.avatarUrl
          ? `<img class="detail-avatar" src="${esc(participant.avatarUrl)}" alt="${esc(participant.name)}">`
          : `<div class="detail-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1.8rem;background:var(--bg3);border:2px solid var(--gold);">🎬</div>`}
        <div>
          <div class="detail-name">${esc(participant.name)}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);">Summer 2026 Picks</div>
        </div>
        <div class="detail-score-total">
          <div class="score-val">${total}</div>
          <div class="score-label">pts</div>
        </div>
      </div>
      <div class="detail-picks">
        ${scored.map(pick => {
          const movie = state.movies.find(m => m.id === pick.movieId);
          if (!movie) return '';
          const posterUrl = getPosterUrl(movie);
          const isBookend = pick.rank === 1 || pick.rank === 10;
          return `
            <div class="detail-pick-row">
              <div class="dp-rank ${isBookend ? 'bookend' : ''}">${pick.rank}</div>
              ${posterUrl
                ? `<img class="dp-poster" src="${esc(posterUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="dp-poster" style="background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:0.9rem;">🎬</div>`}
              <div class="dp-info">
                <div class="dp-title">${esc(movie.title)}</div>
                <div class="dp-actual">${pick.label || '—'}</div>
              </div>
              ${pick.isDarkHorse ? '<div class="dp-dh">🐴 Dark Horse</div>' : ''}
              <div class="dp-pts ${ptsClass(pick.pts)}">${pick.pts}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async function renderBoxOffice() {
    const boList = document.getElementById('boList');
    const boUpdated = document.getElementById('boUpdated');
    if (!boList) return;

    const ranked = state.movies
      .filter(m => m.boxOfficeRank && m.boxOfficeRank <= 10)
      .sort((a, b) => a.boxOfficeRank - b.boxOfficeRank);

    if (!ranked.length) {
      boList.innerHTML = '<div class="text-dim" style="padding:1rem;font-size:0.8rem;">Box office data not yet available.<br>Check back soon!</div>';
      return;
    }

    boList.innerHTML = ranked.map((m, i) => {
      const rank = i + 1;
      const posterUrl = getPosterUrl(m);
      const gross = m.domesticGross ? `$${(m.domesticGross / 1_000_000).toFixed(1)}M` : '—';
      return `
        <div class="bo-row">
          <div class="bo-rank-num ${rank <= 3 ? 'top3' : ''}">${rank}</div>
          ${posterUrl
            ? `<img class="bo-poster" src="${esc(posterUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="bo-poster" style="background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:0.8rem;">🎬</div>`}
          <div class="bo-info">
            <div class="bo-title">${esc(m.title)}</div>
            <div class="bo-gross">${gross} domestic</div>
          </div>
        </div>
      `;
    }).join('');

    if (boUpdated) boUpdated.textContent = `Updated ${new Date().toLocaleDateString()}`;
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
      await Promise.all([renderLeaderboard(), renderBoxOffice()]);
    } catch (err) {
      toast('Save failed: ' + err.message, 'error');
      if (status) status.textContent = 'Save failed.';
    }
  }

  async function tmdbSync() {
    if (!CONFIG.tmdb?.apiKey || CONFIG.tmdb.apiKey === 'YOUR_TMDB_API_KEY') {
      toast('Add your TMDB API key to config.js first.', 'error');
      return;
    }
    const status = document.getElementById('adminStatus');
    if (status) status.textContent = 'Fetching from TMDB…';

    let updated = 0;
    for (const movie of state.movies) {
      if (!movie.tmdbId) await fetchAndCachePoster(movie);
      if (!movie.tmdbId) continue;
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdbId}?api_key=${CONFIG.tmdb.apiKey}`);
        const data = await res.json();
        if (data.revenue > 0) {
          await db.collection('movies').doc(movie.id).update({ domesticGross: data.revenue });
          movie.domesticGross = data.revenue;
          updated++;
        }
      } catch (_) { /* skip */ }
    }

    const eligible = state.movies.filter(m => m.domesticGross > 0)
      .sort((a, b) => b.domesticGross - a.domesticGross);
    const batch = db.batch();
    eligible.forEach((m, i) => {
      m.boxOfficeRank = i + 1;
      batch.update(db.collection('movies').doc(m.id), { boxOfficeRank: i + 1 });
    });
    await batch.commit();

    toast(`Synced ${updated} movies from TMDB.`, 'success');
    if (status) status.textContent = `TMDB sync: ${updated} movies updated.`;
    await Promise.all([renderLeaderboard(), renderBoxOffice()]);
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
    addToPicks, removeFromPicks, toggleDarkHorse, filterPool, submitPicks,
    showParticipantDetail, showBoEditor, hideBoEditor, saveBoxOffice, tmdbSync,
    showPosterManager, hidePosterManager, handlePosterUpload,
    changeAvatar,
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
