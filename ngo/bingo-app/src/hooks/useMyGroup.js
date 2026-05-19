// src/hooks/useMyGroup.js
// Returns the group document for the currently signed-in student (if any).
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';

export function useMyGroup() {
  const { user } = useAuth();
  const [group, setGroup]   = useState(undefined); // undefined = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroup(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'ngo_groups'),
      where('members', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setGroup(null);
        } else {
          const doc = snap.docs[0];
          setGroup({ id: doc.id, ...doc.data() });
        }
        setLoading(false);
      },
      (err) => {
        console.error('useMyGroup onSnapshot error:', err);
        setGroup(null);
        setLoading(false);
      }
    );

    return unsub;
  }, [user]);

  return { group, loading };
}
