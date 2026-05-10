// ── Summer Movie Wager — July 10 Demo Seeder ──────────────────────────────
// Paste this entire script into the browser console while on the movies page.
// It will seed fake box office data + 5 fake participants with picks.
// Then change config.js deadline to new Date('2026-01-01') and refresh.

(async () => {
  const db = firebase.firestore();

  // ── Step 1: Load movies ────────────────────────────────────────────────
  console.log('Loading movies...');
  const snap = await db.collection('movies').get();
  const movies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const find = q => movies.find(m => m.title.toLowerCase().includes(q.toLowerCase()));

  // ── Step 2: Fake box office (July 10 snapshot) ─────────────────────────
  // Real top 10 — used for scoring
  const boxOffice = [
    { q: 'Star Wars',          gross: 450_000_000, rank: 1  },
    { q: 'Toy Story 5',        gross: 382_000_000, rank: 2  },
    { q: 'Scary Movie',        gross: 221_000_000, rank: 3  },
    { q: 'Masters of the',     gross: 178_000_000, rank: 4  },
    { q: 'Mortal Kombat',      gross: 156_000_000, rank: 5  },
    { q: 'Supergirl',          gross: 141_000_000, rank: 6  },
    { q: 'Minions',            gross: 129_000_000, rank: 7  },
    { q: 'Evil Dead',          gross: 94_000_000,  rank: 8  },
    { q: 'Moana',              gross: 87_000_000,  rank: 9  },
    { q: 'Jackass',            gross: 81_000_000,  rank: 10 },
    // Outside top 10
    { q: 'Billie Eilish',      gross: 74_000_000,  rank: null },
    { q: 'Backrooms',          gross: 63_000_000,  rank: null },
    { q: 'Death of Robin Hood',gross: 58_000_000,  rank: null },
    { q: 'Disclosure Day',     gross: 44_000_000,  rank: null },
    { q: 'In the Grey',        gross: 39_000_000,  rank: null },
    { q: 'Power Ballad',       gross: 31_000_000,  rank: null },
    { q: 'Jackass: Best',      gross: 81_000_000,  rank: 10  }, // duplicate guard
    { q: 'Young Washington',   gross: 28_000_000,  rank: null },
    { q: 'Minions & Monsters', gross: 129_000_000, rank: 7   },
    { q: 'I Love Boosters',    gross: 18_000_000,  rank: null },
    { q: 'Tuner',              gross: 12_000_000,  rank: null },
    { q: 'The Breadwinner',    gross: 9_000_000,   rank: null },
    { q: 'Pressure',           gross: 22_000_000,  rank: null },
    { q: 'Sheep Detectives',   gross: 35_000_000,  rank: null },
  ];

  const boBatch = db.batch();
  let boUpdated = 0;
  for (const item of boxOffice) {
    const m = find(item.q);
    if (m) {
      boBatch.update(db.collection('movies').doc(m.id), {
        domesticGross: item.gross,
        boxOfficeRank: item.rank,
      });
      boUpdated++;
    }
  }
  await boBatch.commit();
  console.log(`✅ Box office data set for ${boUpdated} movies`);

  // Re-load movies with updated data
  const snap2 = await db.collection('movies').get();
  const movies2 = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
  const findId = q => movies2.find(m => m.title.toLowerCase().includes(q.toLowerCase()))?.id;

  // ── Step 3: Clean up old demo participants ─────────────────────────────
  const demoNames = ['Maeve', 'Devin', 'Jordan', 'Sam', 'Riley'];
  const pSnap = await db.collection('participants').get();
  const delBatch = db.batch();
  pSnap.docs.forEach(d => {
    if (demoNames.includes(d.data().name)) delBatch.delete(d.ref);
  });
  const picksSnap = await db.collection('picks').get();
  // (picks will be re-created; old ones deleted below per participant)
  await delBatch.commit();
  console.log('🧹 Old demo participants removed');

  // ── Step 4: Participants + picks ───────────────────────────────────────
  // Actual top 10 by rank: SW=1, TS5=2, Scary=3, Masters=4, MK2=5, SG=6, Minions=7, EvilDead=8, Moana=9, Jackass=10

  const participants = [
    {
      name: 'Maeve',
      ranked: [
        'Star Wars', 'Toy Story 5', 'Scary Movie', 'Masters of the',
        'Supergirl', 'Mortal Kombat', 'Minions', 'Moana', 'Evil Dead', 'Jackass'
      ],
      dh: ['Billie Eilish', 'Backrooms', 'Power Ballad'],
    },
    {
      name: 'Devin',
      ranked: [
        'Star Wars', 'Toy Story 5', 'Mortal Kombat', 'Scary Movie', 'Masters of the',
        'Supergirl', 'Evil Dead', 'Minions', 'Moana', 'Jackass'
      ],
      dh: ['Billie Eilish', 'Power Ballad', 'Backrooms'],
    },
    {
      name: 'Jordan',
      ranked: [
        'Toy Story 5', 'Star Wars', 'Mortal Kombat', 'Masters of the', 'Scary Movie',
        'Minions', 'Supergirl', 'Evil Dead', 'Jackass', 'Moana'
      ],
      dh: ['Billie Eilish', 'Death of Robin Hood', 'Backrooms'],
    },
    {
      name: 'Sam',
      ranked: [
        'Mortal Kombat', 'Toy Story 5', 'Star Wars', 'Scary Movie', 'Backrooms',
        'Masters of the', 'Death of Robin Hood', 'Evil Dead', 'Supergirl', 'Billie Eilish'
      ],
      dh: ['Minions', 'Moana', 'Jackass'],
    },
    {
      name: 'Riley',
      ranked: [
        'Billie Eilish', 'In the Grey', 'Power Ballad', 'Backrooms', 'Disclosure Day',
        'Tuner', 'The Breadwinner', 'Death of Robin Hood', 'Minions', 'I Love Boosters'
      ],
      dh: ['Star Wars', 'Toy Story 5', 'Scary Movie'],
    },
  ];

  for (const p of participants) {
    // Create participant
    const ref = await db.collection('participants').add({
      name: p.name,
      nameLower: p.name.toLowerCase(),
      avatarUrl: null,
      picksSubmitted: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    const pid = ref.id;

    // Write ranked picks
    const pickBatch = db.batch();
    p.ranked.forEach((q, i) => {
      const mid = findId(q);
      if (mid) {
        pickBatch.set(db.collection('picks').doc(), {
          participantId: pid, movieId: mid, rank: i + 1, isDarkHorse: false,
        });
      } else { console.warn(`⚠️ ranked not found: ${q}`); }
    });
    // Write DH picks
    p.dh.forEach(q => {
      const mid = findId(q);
      if (mid) {
        pickBatch.set(db.collection('picks').doc(), {
          participantId: pid, movieId: mid, rank: null, isDarkHorse: true,
        });
      } else { console.warn(`⚠️ DH not found: ${q}`); }
    });
    await pickBatch.commit();
    console.log(`✅ Created ${p.name}`);
  }

  console.log('\n🎬 DONE! Now change config.js deadline to:');
  console.log("  deadline: new Date('2026-01-01'),");
  console.log('Then hard-refresh (Ctrl+Shift+R) to see the results screen.');
})();
