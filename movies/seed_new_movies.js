// ── Add 15 new movies to Firestore ────────────────────────────────────────
// Paste into browser console on the movies page.
// Uses your TMDB API key from config.js to pull poster images automatically.

(async () => {
  const db = firebase.firestore();
  const apiKey = CONFIG?.tmdb?.apiKey;
  const hasApiKey = apiKey && apiKey !== 'YOUR_TMDB_API_KEY';

  const newMovies = [
    { title: 'Two Pianos',                                                  releaseDate: '2026-05-08', tmdbId: 1331349  },
    { title: 'Is God Is',                                                   releaseDate: '2026-05-15', tmdbId: 1380316  },
    { title: 'Mobile Suit Gundam Hathaway: The Sorcery of Nymph Circe',    releaseDate: '2026-05-15', tmdbId: 910850   },
    { title: 'Obsession',                                                   releaseDate: '2026-05-15', tmdbId: 1339713  },
    { title: 'The Wizard of the Kremlin',                                   releaseDate: '2026-05-15', tmdbId: 1291659  },
    { title: 'Stolen Kingdom',                                              releaseDate: '2026-05-21', tmdbId: 1038727  },
    { title: 'Saccharine',                                                  releaseDate: '2026-05-22', tmdbId: 1363387  },
    { title: 'The Furious',                                                 releaseDate: '2026-05-28', tmdbId: 1510055  },
    { title: 'The Currents',                                                releaseDate: '2026-05-29', tmdbId: 1031084  },
    { title: 'Jinsei',                                                      releaseDate: '2026-06-05', tmdbId: 1441453  },
    { title: 'Stop! That! Train!',                                          releaseDate: '2026-06-12', tmdbId: 1541560  },
    { title: 'Diamond Made Man',                                            releaseDate: '2026-06-16', tmdbId: 1633499  },
    { title: 'Thrash',                                                      releaseDate: '2026-04-10', tmdbId: 1290417  },
    { title: 'The Rivals of Amziah King',                                   releaseDate: '2026-08-14', tmdbId: 1124142  },
    { title: 'Mutiny',                                                      releaseDate: '2026-08-21', tmdbId: 1288445  },
  ];

  // ── Fetch poster path from TMDB ──────────────────────────────────────────
  async function fetchPoster(tmdbId) {
    if (!hasApiKey) return null;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`);
      const data = await res.json();
      return data.poster_path || null;   // e.g. "/abc123.jpg"
    } catch (e) {
      return null;
    }
  }

  // ── Check which titles already exist in Firestore ─────────────────────
  const existingSnap = await db.collection('movies').get();
  const existingTitles = new Set(
    existingSnap.docs.map(d => d.data().title?.toLowerCase().trim())
  );

  let added = 0, skipped = 0;

  for (const m of newMovies) {
    if (existingTitles.has(m.title.toLowerCase().trim())) {
      console.log(`⏭️  Already exists: ${m.title}`);
      skipped++;
      continue;
    }

    const posterPath = await fetchPoster(m.tmdbId);
    const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;

    await db.collection('movies').add({
      title: m.title,
      releaseDate: m.releaseDate,
      tmdbId: m.tmdbId,
      posterPath: posterUrl,   // full URL stored directly so poster manager shows it
      domesticGross: 0,
      boxOfficeRank: null,
    });

    console.log(`✅ Added: ${m.title}${posterUrl ? ' (with poster)' : ' (no poster yet)'}`);
    added++;
  }

  console.log(`\n🎬 Done! ${added} added, ${skipped} already existed.`);
  if (!hasApiKey) {
    console.log('💡 No TMDB API key found — posters were not fetched.');
    console.log('   Add your key to config.js then use the 🖼 Poster Manager to paste URLs manually.');
  }
  console.log('\nHard-refresh the page (Ctrl+Shift+R) to see the new movies in the picker.');
})();
