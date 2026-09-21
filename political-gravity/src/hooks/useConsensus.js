// src/hooks/useConsensus.js
//
// settings/consensus is one small document holding every period's recorded class
// position: { [readingId]: { x } }. Two hooks because the two pages need different
// things — the teacher's seminar board must react the moment a consensus is saved,
// while a student's reading page has no use for liveness and already carries four
// subscriptions.
import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const ref = () => doc(db, 'settings', 'consensus');
const valueOf = (snap) => (snap.exists() ? snap.data() : {});

// One-shot read. `loaded` stays false until we know one way or the other, so
// callers can hold off rendering rather than flash a wrong answer.
export function useConsensus() {
  const [consensus, setConsensus] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(ref());
        if (!cancelled) setConsensus(valueOf(snap));
      } catch (err) {
        // Nothing here is essential to doing the work, so a failure just means
        // no arrow — but say so, or it silently never appears.
        console.error('Could not load the class consensus:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { consensus, loaded };
}

export function useConsensusLive() {
  const [consensus, setConsensus] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(ref(),
      snap => { setConsensus(valueOf(snap)); setLoaded(true); },
      err => { console.error('Could not load the class consensus:', err); setLoaded(true); });
    return () => unsub();
  }, []);

  return { consensus, loaded };
}
