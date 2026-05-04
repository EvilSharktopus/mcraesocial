// ── Summer Movie Wager — Daily Box Office Sync ────────────────────────────
// Runs via GitHub Actions at 9AM PDT every day.
// Reads movies from Firestore, fetches real domestic grosses from Box Office
// Mojo via the Apify trovevault/movie-box-office-tracker actor, then writes
// updated grosses + ranks back to Firestore — no browser required.

const APIFY_TOKEN   = process.env.APIFY_TOKEN;
const PROJECT_ID    = 'movies-1999c';
const FIREBASE_KEY  = 'AIzaSyBLaQWGOpqm-W1GhCKpFht96hKb8epgyno'; // public client key
const FS_BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Firestore helpers ──────────────────────────────────────────────────────

function parseDoc(doc) {
  const id     = doc.name.split('/').pop();
  const fields = doc.fields || {};
  return {
    id,
    title:         fields.title?.stringValue        ?? '',
    releaseDate:   fields.releaseDate?.stringValue  ?? null,
    domesticGross: Number(fields.domesticGross?.integerValue ?? fields.domesticGross?.doubleValue ?? 0),
    boxOfficeRank: fields.boxOfficeRank?.integerValue != null
                     ? Number(fields.boxOfficeRank.integerValue)
                     : null,
  };
}

async function fsGet(collection) {
  const movies = [];
  let nextPageToken = null;

  do {
    const url = new URL(`${FS_BASE}/${collection}`);
    url.searchParams.set('key', FIREBASE_KEY);
    url.searchParams.set('pageSize', '100');
    if (nextPageToken) url.searchParams.set('pageToken', nextPageToken);

    const res  = await fetch(url.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(`Firestore GET failed: ${JSON.stringify(data)}`);

    (data.documents || []).forEach(doc => movies.push(parseDoc(doc)));
    nextPageToken = data.nextPageToken ?? null;
  } while (nextPageToken);

  return movies;
}

async function fsPatch(id, gross, rank) {
  const url = new URL(`${FS_BASE}/movies/${id}`);
  url.searchParams.set('key', FIREBASE_KEY);
  url.searchParams.set('updateMask.fieldPaths', 'domesticGross');
  url.searchParams.append('updateMask.fieldPaths', 'boxOfficeRank');

  const body = {
    fields: {
      domesticGross: { integerValue: String(gross) },
      boxOfficeRank: rank != null ? { integerValue: String(rank) } : { nullValue: null },
    },
  };

  const res = await fetch(url.toString(), {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`  ⚠️  Firestore PATCH failed for ${id}: ${err}`);
  }
}

// ── Apify call ────────────────────────────────────────────────────────────

async function fetchBOM(movieList) {
  console.log(`  Querying Apify for ${movieList.length} movies…`);
  const res = await fetch(
    `https://api.apify.com/v2/acts/trovevault~movie-box-office-tracker/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=180`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ movies: movieList }),
    }
  );
  if (!res.ok) throw new Error(`Apify error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────

(async () => {
  if (!APIFY_TOKEN) { console.error('❌ APIFY_TOKEN not set.'); process.exit(1); }

  console.log('📥 Loading movies from Firestore…');
  const movies = await fsGet('movies');
  console.log(`   Found ${movies.length} movies.`);

  // Build title list for Apify (include year to disambiguate)
  const movieList = movies.map(m => {
    const year = m.releaseDate?.slice(0, 4) ?? '';
    return year ? `${m.title} ${year}` : m.title;
  });

  console.log('🎬 Fetching grosses from Box Office Mojo…');
  const results = await fetchBOM(movieList);
  console.log(`   Got ${results.length} result(s) from Apify.`);

  // Match Apify results back to our movies
  let updated = 0;
  for (const row of results) {
    if (!row.domesticGross) continue;
    const gross = typeof row.domesticGross === 'number'
      ? row.domesticGross
      : parseInt(String(row.domesticGross).replace(/[^0-9]/g, ''), 10);
    if (!gross || gross <= 0) continue;

    const rowTitle = (row.title ?? '').toLowerCase();
    const match    = movies.find(m => {
      const t = m.title.toLowerCase();
      return t === rowTitle || t.includes(rowTitle) || rowTitle.includes(t);
    });
    if (!match) { console.warn(`  ⚠️  No match for BOM result: "${row.title}"`); continue; }

    match.domesticGross = gross;
    updated++;
  }

  // Recalculate ranks across all movies
  const withGross    = [...movies].filter(m => m.domesticGross > 0)
                                  .sort((a, b) => b.domesticGross - a.domesticGross);
  withGross.forEach((m, i) => { m.boxOfficeRank = i + 1; });
  movies.filter(m => !m.domesticGross).forEach(m => { m.boxOfficeRank = null; });

  // Write back to Firestore
  console.log(`💾 Writing ${movies.length} movies to Firestore…`);
  for (const m of movies) {
    await fsPatch(m.id, m.domesticGross, m.boxOfficeRank);
  }

  console.log(`\n✅ Done! ${updated} movie(s) updated with real grosses.`);
  if (withGross.length) {
    console.log('\n🏆 Current top 5:');
    withGross.slice(0, 5).forEach((m, i) =>
      console.log(`   ${i + 1}. ${m.title} — $${(m.domesticGross / 1_000_000).toFixed(1)}M`)
    );
  }
})();
