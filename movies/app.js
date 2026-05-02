/* Summer Movie Wager 2026 */

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────
  let db = null;
  let state = {
    phase: 'pre',           // 'pre' | 'post'
    participant: null,      // { id, name, avatar_url, picks_submitted }
    avatarFile: null,
    picks: [],              // [{ movieId, rank, isDarkHorse }] sorted by rank
    movies: [],             // all eligible movies from db
    participants: [],       // all participants
    selectedParticipantId: null,
    adminMode: false,
    posterCache: {},        // movieId -> url
  };

  // ── Scoring constants ──────────────────────────────────────────────────
  const PTS_EXACT_BOOKEND = 13;
  const PTS_EXACT         = 10;
  const PTS_OFF1          = 7;
  const PTS_OFF2          = 5;
  const PTS_IN_TOP10      = 3;
  const PTS_DARK_HORSE    = 1;
  const BOOKEND_RANKS     = new Set([1, 10]);

  // ── Init ───────────────────────────────────────────────────────────────
  async function init() {
    renderFilmHoles();
    showScreen('screenLoading');

    if (!isConfigured()) {
      showScreen('screenSetup');
      return;
    }

    db = supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);

    state.phase = new Date() >= CONFIG.deadline ? 'post' : 'pre';
    state.adminMode = new URLSearchParams(location.search).get('admin') === '1';

    try {
      const [moviesRes, participantsRes] = await Promise.all([
        db.from('movies').select('*').eq('is_eligible', true).order('release_date'),
        db.from('participants').select('*').order('created_at'),
      ]);
      if (moviesRes.error) throw moviesRes.error;
      if (participantsRes.error) throw participantsRes.error;

      state.movies = moviesRes.data;
      state.participants = participantsRes.data;

      updateDeadlineBadge();

      if (state.phase === 'post') {
        showResultsScreen();
      } else {
        showLanding();
      }
    } catch (err) {
      showScreen('screenLoading');
      document.getElementById('screenLoading').innerHTML =
        `<div class="loading-state"><div style="font-size:2rem;margin-bottom:1rem;">⚠️</div><div>Could not connect to the database.<br><small style="color:var(--text-dim)">${err.message}</small></div></div>`;
    }
  }

  function isConfigured() {
    return (
      CONFIG.supabase.url !== 'YOUR_SUPABASE_URL' &&
      CONFIG.supabase.anonKey !== 'YOUR_SUPABASE_ANON_KEY'
    );
  }

  // ── Film strip decoration ──────────────────────────────────────────────
  function renderFilmHoles() {
    ['filmHoles', 'filmHoles2'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = Array(30).fill('<div class="film-hole"></div>').join('');
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
      <button class="participant-chip" onclick="App.selectExistingParticipant(${p.id})" title="Click to pick as ${esc(p.name)}">
        ${p.avatar_url
          ? `<img class="chip-avatar" src="${esc(p.avatar_url)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="chip-avatar-placeholder">🎬</div>`}
        <div class="chip-name">${esc(p.name)}</div>
        <div class="chip-status ${p.picks_submitted ? 'submitted' : ''}">
          ${p.picks_submitted ? '✓ Submitted' : 'In Progress'}
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
      // look up existing participant
      const { data: existing } = await db
        .from('participants')
        .select('*')
        .ilike('name', name)
        .maybeSingle();

      if (existing) {
        state.participant = existing;
        await loadExistingPicks();
        showPicksScreen();
      } else {
        // create new participant record (no picks yet)
        const { data: created, error } = await db
          .from('participants')
          .insert({ name })
          .select()
          .single();
        if (error) throw error;
        state.participant = created;
        state.picks = [];
        showScreen('screenAvatar');
      }
    } catch (err) {
      toast('Something went wrong: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Let\'s Go';
    }
  }

  async function selectExistingParticipant(id) {
    const p = state.participants.find(x => x.id === id);
    if (!p) return;
    state.participant = p;
    await loadExistingPicks();
    showPicksScreen();
  }

  async function loadExistingPicks() {
    const { data, error } = await db
      .from('picks')
      .select('*')
      .eq('participant_id', state.participant.id)
      .order('rank');
    if (error) throw error;
    state.picks = (data || []).map(r => ({
      movieId: r.movie_id,
      rank: r.rank,
      isDarkHorse: r.is_dark_horse,
    }));
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

    // drag/drop style
    const zone = document.getElementById('avatarZone');
    zone?.addEventListener('dragover', ev => { ev.preventDefault(); zone.classList.add('drag-over'); });
    zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone?.addEventListener('drop', ev => {
      ev.preventDefault();
      zone.classList.remove('drag-over');
      const f = ev.dataTransfer.files[0];
      if (f) handleAvatarFile(f);
    });
  }

  async function submitAvatar() {
    const btn = document.getElementById('avatarContinueBtn');
    if (!state.avatarFile || !state.participant) { showPicksScreen(); return; }

    btn.disabled = true;
    btn.textContent = 'Uploading…';

    try {
      const ext = state.avatarFile.name.split('.').pop() || 'jpg';
      const path = `${state.participant.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage
        .from('avatars')
        .upload(path, state.avatarFile, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      const { error: updateErr } = await db
        .from('participants')
        .update({ avatar_url: avatarUrl })
        .eq('id', state.participant.id);
      if (updateErr) throw updateErr;

      state.participant.avatar_url = avatarUrl;
      // Update local participants list
      const idx = state.participants.findIndex(p => p.id === state.participant.id);
      if (idx >= 0) state.participants[idx].avatar_url = avatarUrl;

      showPicksScreen();
    } catch (err) {
      toast('Avatar upload failed: ' + err.message, 'error');
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
    renderRankingSlots();
    renderMoviePool();
    showScreen('screenPicks');
  }

  function renderMoviePool(filter = '') {
    const grid = document.getElementById('movieGrid');
    if (!grid) return;

    const q = filter.toLowerCase();
    const filtered = q
      ? state.movies.filter(m => m.title.toLowerCase().includes(q))
      : state.movies;

    const selectedIds = new Set(state.picks.map(p => p.movieId));

    grid.innerHTML = filtered.map(m => {
      const posterUrl = getPosterUrl(m);
      const isSelected = selectedIds.has(m.id);
      return `
        <div class="movie-card ${isSelected ? 'selected' : ''}" data-id="${m.id}" onclick="App.addToPicks(${m.id})">
          ${posterUrl
            ? `<img class="movie-poster" src="${esc(posterUrl)}" alt="${esc(m.title)}" loading="lazy" onerror="this.parentNode.querySelector('.movie-poster-placeholder').style.display='flex';this.style.display='none'">`
            : ''}
          <div class="movie-poster-placeholder" style="${posterUrl ? 'display:none' : ''}">
            <div class="poster-icon">🎬</div>
          </div>
          <div class="movie-card-title">${esc(m.title)}</div>
          <div class="movie-card-date">${formatDate(m.release_date)}</div>
        </div>
      `;
    }).join('');

    // Kick off poster fetches for movies without a cached poster
    filtered.forEach(m => {
      if (!m.poster_path && !state.posterCache[m.id]) {
        fetchAndCachePoster(m);
      }
    });
  }

  function filterPool(val) {
    renderMoviePool(val);
  }

  function renderRankingSlots() {
    const list = document.getElementById('rankingList');
    if (!list) return;
    list.innerHTML = '';

    for (let rank = 1; rank <= 10; rank++) {
      const pick = state.picks.find(p => p.rank === rank);
      const movie = pick ? state.movies.find(m => m.id === pick.movieId) : null;

      const slot = document.createElement('div');
      slot.className = `rank-slot ${pick ? '' : 'empty'}`;
      slot.dataset.rank = rank;

      slot.setAttribute('draggable', pick ? 'true' : 'false');
      slot.addEventListener('dragstart', onDragStart);
      slot.addEventListener('dragover', onDragOver);
      slot.addEventListener('drop', onDrop);
      slot.addEventListener('dragend', onDragEnd);

      const isBookend = rank === 1 || rank === 10;
      const posterUrl = movie ? getPosterUrl(movie) : null;

      slot.innerHTML = `
        <div class="rank-number ${isBookend ? 'bookend' : ''}">${rank}</div>
        ${pick && movie ? `
          <div class="drag-handle" title="Drag to reorder">⠿</div>
          ${posterUrl
            ? `<img class="rank-poster-thumb" src="${esc(posterUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">`
            : `<div class="rank-thumb-placeholder">🎬</div>`}
          <div class="rank-info">
            <div class="rank-title">${esc(movie.title)}</div>
          </div>
          <button class="dark-horse-btn ${pick.isDarkHorse ? 'active' : ''}"
            title="Mark as dark horse (+1 bonus if it cracks the top 10)"
            onclick="App.toggleDarkHorse(${movie.id})">
            ${pick.isDarkHorse ? '🐴 Dark Horse' : 'Dark Horse'}
          </button>
          <button class="remove-pick-btn" onclick="App.removeFromPicks(${movie.id})" title="Remove">✕</button>
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
    if (hint) hint.textContent = n < 10 ? `Select ${10 - n} more movie${10 - n !== 1 ? 's' : ''} to submit` : 'Ready to lock in your picks!';
  }

  function addToPicks(movieId) {
    if (state.picks.length >= 10) { toast('You\'ve already picked 10 movies!', 'error'); return; }
    if (state.picks.find(p => p.movieId === movieId)) return;
    const nextRank = state.picks.length + 1;
    state.picks.push({ movieId, rank: nextRank, isDarkHorse: false });
    renderRankingSlots();
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  function removeFromPicks(movieId) {
    state.picks = state.picks.filter(p => p.movieId !== movieId);
    // Re-number ranks 1..n
    state.picks.sort((a, b) => a.rank - b.rank).forEach((p, i) => p.rank = i + 1);
    renderRankingSlots();
    renderMoviePool(document.getElementById('poolSearch')?.value || '');
  }

  function toggleDarkHorse(movieId) {
    const pick = state.picks.find(p => p.movieId === movieId);
    if (pick) {
      pick.isDarkHorse = !pick.isDarkHorse;
      renderRankingSlots();
    }
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
    if (dragFromRank && toRank && dragFromRank !== toRank) {
      reorderPicks(dragFromRank, toRank);
    }
    document.querySelectorAll('.rank-slot').forEach(s => s.classList.remove('drag-over'));
  }

  function onDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.rank-slot').forEach(s => s.classList.remove('drag-over'));
    dragFromRank = null;
  }

  function reorderPicks(fromRank, toRank) {
    const fromPick = state.picks.find(p => p.rank === fromRank);
    const toPick   = state.picks.find(p => p.rank === toRank);

    // Move fromPick to toRank, shifting others
    const direction = toRank > fromRank ? 1 : -1;
    state.picks.forEach(p => {
      if (p === fromPick) {
        p.rank = toRank;
      } else if (
        direction === 1 && p.rank > fromRank && p.rank <= toRank ||
        direction === -1 && p.rank >= toRank && p.rank < fromRank
      ) {
        p.rank -= direction;
      }
    });
    state.picks.sort((a, b) => a.rank - b.rank);
    renderRankingSlots();
  }

  // ── Submit picks ───────────────────────────────────────────────────────
  async function submitPicks() {
    if (state.picks.length < 10) { toast('You need exactly 10 picks.', 'error'); return; }
    if (!state.participant) return;

    const btn = document.getElementById('submitPicksBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      // Delete existing picks for this participant
      await db.from('picks').delete().eq('participant_id', state.participant.id);

      // Insert new picks
      const rows = state.picks.map(p => ({
        participant_id: state.participant.id,
        movie_id: p.movieId,
        rank: p.rank,
        is_dark_horse: p.isDarkHorse,
      }));
      const { error } = await db.from('picks').insert(rows);
      if (error) throw error;

      // Mark submitted
      await db.from('participants')
        .update({ picks_submitted: true })
        .eq('id', state.participant.id);

      state.participant.picks_submitted = true;
      const idx = state.participants.findIndex(p => p.id === state.participant.id);
      if (idx >= 0) state.participants[idx].picks_submitted = true;

      toast('Your picks are locked in! 🎬', 'success');
      btn.textContent = '✓ Picks Saved';

      // Update submit hint
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
    if (movie.poster_path) {
      const url = `https://image.tmdb.org/t/p/w342${movie.poster_path}`;
      state.posterCache[movie.id] = url;
      return url;
    }
    return null;
  }

  async function fetchAndCachePoster(movie) {
    if (!CONFIG.tmdb?.apiKey || CONFIG.tmdb.apiKey === 'YOUR_TMDB_API_KEY') return;
    try {
      const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 2026;
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${CONFIG.tmdb.apiKey}&query=${encodeURIComponent(movie.title)}&year=${year}&language=en-US`
      );
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.poster_path) {
        state.posterCache[movie.id] = `https://image.tmdb.org/t/p/w342${result.poster_path}`;

        // Save poster_path and tmdb_id back to Supabase so we only fetch once
        await db.from('movies').update({
          poster_path: result.poster_path,
          tmdb_id: result.id,
        }).eq('id', movie.id);

        movie.poster_path = result.poster_path;
        movie.tmdb_id = result.id;

        // Re-render the card if visible
        const card = document.querySelector(`.movie-card[data-id="${movie.id}"] .movie-poster-placeholder`);
        if (card) {
          const img = card.previousElementSibling;
          if (img?.classList.contains('movie-poster')) {
            img.src = state.posterCache[movie.id];
            img.style.display = '';
            card.style.display = 'none';
          }
        }
      }
    } catch (_) { /* silently ignore */ }
  }

  // ── Scoring ────────────────────────────────────────────────────────────
  function scoreParticipantPicks(picks) {
    // Build actual rankings from movies sorted by box_office_rank
    const ranked = state.movies
      .filter(m => m.box_office_rank && m.box_office_rank <= 10)
      .sort((a, b) => a.box_office_rank - b.box_office_rank);

    const actualRank = {};        // movieId -> rank (1-indexed)
    ranked.forEach((m, i) => { actualRank[m.id] = i + 1; });

    let total = 0;
    const scored = picks.map(pick => {
      const ar = actualRank[pick.movieId];
      let pts = 0;
      let label = '';

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
        if (pick.isDarkHorse) {
          pts += PTS_DARK_HORSE; label += ' +1🐴';
        }
      }

      total += pts;
      return { ...pick, pts, label, actualRank: ar };
    });

    return { scored, total };
  }

  // ── Results screen ─────────────────────────────────────────────────────
  async function showResultsScreen() {
    showScreen('screenResults');

    // Admin mode check
    if (state.adminMode) {
      const pw = sessionStorage.getItem('adminPw') || prompt('Admin password:');
      if (pw === CONFIG.adminPassword) {
        sessionStorage.setItem('adminPw', pw);
        document.getElementById('adminBar')?.classList.remove('hidden');
      } else if (pw !== null) {
        toast('Incorrect password.', 'error');
      }
    }

    await Promise.all([
      renderLeaderboard(),
      renderBoxOffice(),
    ]);
  }

  async function renderLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;

    // Fetch all picks
    const { data: allPicks, error } = await db
      .from('picks')
      .select('*')
      .order('rank');
    if (error) { list.innerHTML = '<div class="text-dim" style="padding:1rem;">Error loading picks.</div>'; return; }

    // Group picks by participant
    const picksByParticipant = {};
    allPicks.forEach(row => {
      if (!picksByParticipant[row.participant_id]) picksByParticipant[row.participant_id] = [];
      picksByParticipant[row.participant_id].push({
        movieId: row.movie_id,
        rank: row.rank,
        isDarkHorse: row.is_dark_horse,
      });
    });

    // Score each participant
    const scored = state.participants
      .filter(p => p.picks_submitted)
      .map(p => {
        const picks = picksByParticipant[p.id] || [];
        const { total } = scoreParticipantPicks(picks);
        return { ...p, score: total, picks };
      })
      .sort((a, b) => b.score - a.score);

    // Cache picks for detail view
    state._picksByParticipant = picksByParticipant;

    list.innerHTML = scored.length ? scored.map((p, i) => `
      <div class="leaderboard-row ${state.selectedParticipantId === p.id ? 'active' : ''}"
           onclick="App.showParticipantDetail(${p.id})">
        <div class="lb-rank">${i + 1}</div>
        ${p.avatar_url
          ? `<img class="lb-avatar" src="${esc(p.avatar_url)}" alt="${esc(p.name)}" loading="lazy">`
          : `<div class="lb-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🎬</div>`}
        <div class="lb-name">${esc(p.name)}</div>
        <div class="lb-score">${p.score}</div>
      </div>
    `).join('') : '<div class="text-dim" style="padding:1rem;font-size:0.8rem;">No picks submitted yet.</div>';
  }

  function showParticipantDetail(participantId) {
    state.selectedParticipantId = participantId;

    // Highlight in leaderboard
    document.querySelectorAll('.leaderboard-row').forEach(row => {
      row.classList.toggle('active', row.onclick?.toString().includes(participantId));
    });

    const participant = state.participants.find(p => p.id === participantId);
    if (!participant) return;
    const picks = (state._picksByParticipant?.[participantId] || []).sort((a, b) => a.rank - b.rank);
    const { scored, total } = scoreParticipantPicks(picks);

    const panel = document.getElementById('detailPanel');
    if (!panel) return;

    const getPts = pts => {
      if (pts >= 13) return 'exact';
      if (pts >= 7)  return 'close';
      if (pts >= 3)  return 'in-top';
      return 'miss';
    };

    panel.innerHTML = `
      <div class="detail-header">
        ${participant.avatar_url
          ? `<img class="detail-avatar" src="${esc(participant.avatar_url)}" alt="${esc(participant.name)}">`
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
          const ptsClass = getPts(pick.pts);
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
              <div class="dp-pts ${ptsClass}">${pick.pts}</div>
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
      .filter(m => m.box_office_rank && m.box_office_rank <= 10)
      .sort((a, b) => a.box_office_rank - b.box_office_rank);

    if (!ranked.length) {
      boList.innerHTML = '<div class="text-dim" style="padding:1rem;font-size:0.8rem;">Box office data not yet available.<br>Check back soon!</div>';
      return;
    }

    boList.innerHTML = ranked.map((m, i) => {
      const rank = i + 1;
      const posterUrl = getPosterUrl(m);
      const gross = m.domestic_gross ? `$${(m.domestic_gross / 1_000_000).toFixed(1)}M` : '—';
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
        <td>
          <input type="number" class="bo-edit-input" data-id="${m.id}"
            value="${m.domestic_gross || ''}" placeholder="0" min="0">
        </td>
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
        id: parseInt(inp.dataset.id),
        domestic_gross: parseInt(inp.value) || 0,
      }));

      // Calculate ranks: sort by gross desc, assign ranks
      const sorted = [...updates].sort((a, b) => b.domestic_gross - a.domestic_gross);
      sorted.forEach((u, i) => { u.box_office_rank = u.domestic_gross > 0 ? i + 1 : null; });

      for (const u of sorted) {
        await db.from('movies').update({
          domestic_gross: u.domestic_gross,
          box_office_rank: u.box_office_rank,
        }).eq('id', u.id);

        const movie = state.movies.find(m => m.id === u.id);
        if (movie) {
          movie.domestic_gross = u.domestic_gross;
          movie.box_office_rank = u.box_office_rank;
        }
      }

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
      if (!movie.tmdb_id) await fetchAndCachePoster(movie);
      if (!movie.tmdb_id) continue;

      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${CONFIG.tmdb.apiKey}`
        );
        const data = await res.json();
        if (data.revenue > 0) {
          await db.from('movies').update({ domestic_gross: data.revenue }).eq('id', movie.id);
          movie.domestic_gross = data.revenue;
          updated++;
        }
      } catch (_) { /* skip */ }
    }

    // Recalculate ranks
    const eligible = state.movies.filter(m => m.domestic_gross > 0)
      .sort((a, b) => b.domestic_gross - a.domestic_gross);
    for (let i = 0; i < eligible.length; i++) {
      const rank = i + 1;
      await db.from('movies').update({ box_office_rank: rank }).eq('id', eligible[i].id);
      eligible[i].box_office_rank = rank;
    }

    toast(`Synced ${updated} movies from TMDB.`, 'success');
    if (status) status.textContent = `TMDB sync: ${updated} movies updated.`;
    await Promise.all([renderLeaderboard(), renderBoxOffice()]);
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  let toastTimer = null;
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
    init,
    handleNameSubmit,
    handleAvatarFile,
    submitAvatar,
    skipAvatar,
    goToLanding,
    selectExistingParticipant,
    addToPicks,
    removeFromPicks,
    toggleDarkHorse,
    filterPool,
    submitPicks,
    showParticipantDetail,
    showBoEditor,
    hideBoEditor,
    saveBoxOffice,
    tmdbSync,
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
