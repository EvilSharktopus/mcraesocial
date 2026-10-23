// src/hooks/useRoster.js
//
// The teacher's view of who a student is. After the privacy switch, a
// student's account and every document they write carry only a first name
// and a code. Desk keeps the full name in its teacher-only `roster`
// collection, keyed by the account uid, in this same Firebase project, so
// the teacher pages read it from here. Students cannot read it (rules), so
// only teacher pages call this hook.
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export function useRoster() {
  const [roster, setRoster] = useState({});   // uid -> { fullName, firstName, code, course, stream }
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roster'),
      snap => setRoster(Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))),
      err => console.warn('Roster unavailable:', err.code));
    return unsub;
  }, []);
  return roster;
}

/** Full name from the roster, else whatever the app already knew. */
export function fullNameFor(roster, uid, fallback) {
  return roster[uid]?.fullName || fallback;
}
