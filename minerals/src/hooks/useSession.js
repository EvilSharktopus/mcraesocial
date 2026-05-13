// src/hooks/useSession.js
// Real-time listener on sessions/minerals in Firestore.
// Returns the currently open phase (number) and loading state.
// All phase-gating logic in the app reads from this hook.

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const SESSION_DOC = 'sessions/minerals';

/**
 * useSession()
 * Returns:
 *   phase      — number (1–5), the currently teacher-unlocked phase
 *   loading    — true while the first snapshot hasn't arrived yet
 *   error      — string | null if Firestore can't be reached
 */
export function useSession() {
  const [phase, setPhase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ref = doc(db, 'sessions', 'minerals');

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setPhase(snap.data().phase ?? 1);
        } else {
          // Document doesn't exist yet — teacher hasn't set a phase.
          // Default to phase 1 so students see the entry flow.
          setPhase(1);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('useSession snapshot error:', err);
        setError('Could not connect to the session. Please refresh.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { phase, loading, error };
}
