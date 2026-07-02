import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { PENDULUM_READINGS as HARDCODED_READINGS } from '../data/pendulumReadings';

export function useReadings() {
  const [readings, setReadings] = useState(HARDCODED_READINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'masterReadings'), (snap) => {
      if (snap.exists() && snap.data().readings) {
        setReadings(snap.data().readings);
      } else {
        // Fallback to hardcoded if not set yet
        setReadings(HARDCODED_READINGS);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching masterReadings:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { readings, loading };
}
