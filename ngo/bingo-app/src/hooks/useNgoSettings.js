// src/hooks/useNgoSettings.js
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useNgoSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'ngo_settings', 'global'),
      (snap) => {
        setSettings(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        console.error('useNgoSettings onSnapshot error:', err);
        setSettings(null);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { settings, loading };
}
