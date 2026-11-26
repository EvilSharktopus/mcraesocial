// src/hooks/useCatchUp.js
//
// A student's own work across every time period, live, and the queue of
// what is still owed. Shared by the dashboard (the button and its count)
// and the reading page (where am I in the queue, what is next).
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useReadings } from './useReadings';
import { catchUpQueue, duePeriods } from '../data/catchup';

// Each query is on the student's own uid — the rules allow that even where
// there is nothing yet, which a direct get of a missing document is not.
function useMine(name, uid) {
  const [byReading, setByReading] = useState(null);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, name), where('uid', '==', uid)),
      snap => setByReading(Object.fromEntries(snap.docs.map(d => [d.data().readingId, d.data({ serverTimestamps: 'estimate' })]))),
      err => { console.error(`Could not read your ${name}`, err); setByReading({}); });
  }, [name, uid]);
  return byReading;
}

export function useCatchUp(uid) {
  const { readings, loading } = useReadings();
  const plots = useMine('plots', uid);
  const reflections = useMine('pg_reflections', uid);
  const grades = useMine('pg_grades', uid);
  const [openIds, setOpenIds] = useState(null);
  useEffect(() => onSnapshot(doc(db, 'settings', 'global'),
    s => setOpenIds(s.exists() ? (s.data().openReadings || []) : []),
    err => { console.error('Could not read which periods are open', err); setOpenIds([]); }), []);

  const ready = !loading && !!plots && !!reflections && !!grades && openIds !== null;
  return useMemo(() => {
    if (!ready) return { ready: false, queue: [], due: [], work: null };
    const work = { plots, reflections, grades };
    return { ready: true, queue: catchUpQueue(readings, openIds, work), due: duePeriods(readings, openIds), work };
  }, [ready, readings, openIds, plots, reflections, grades]);
}
