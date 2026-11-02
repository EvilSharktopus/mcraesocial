// src/hooks/useRoster.js
//
// The teacher's view of who a student is. After the privacy switch, a
// student's account and every document they write carry only a first name
// and a code; so does Desk's teacher-only `roster` collection, keyed by the
// account uid, in this same Firebase project. Full names are in the
// teacher's own spreadsheet, keyed by code, which is why the code is shown
// beside the name here. Students cannot read the roster (rules), so only
// teacher pages call this hook.
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export function useRoster() {
  const [roster, setRoster] = useState({});   // uid -> { firstName, code, course, stream }
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roster'),
      snap => setRoster(Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))),
      err => console.warn('Roster unavailable:', err.code));
    return unsub;
  }, []);
  return roster;
}

/** "First · CODE" from the roster, else whatever the app already knew. */
export function nameFor(roster, uid, fallback) {
  const row = roster[uid];
  if (!row) return fallback;
  return [String(row.firstName || '').trim(), row.code].filter(Boolean).join(' · ') || fallback;
}
