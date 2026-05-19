// src/hooks/useStageSync.js
// Real-time Firestore sync + local edits + auto-save for stage documents
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

export function useStageSync(collectionName, docId) {
  const [serverData, setServerData] = useState(null);
  const localRef = useRef({});            // pending edits (not yet saved)
  const [localSnap, setLocalSnap] = useState({}); // mirror for renders
  const [saving, setSaving]   = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimer = useRef(null);

  // Live listener — remote wins only for fields NOT pending locally
  useEffect(() => {
    if (!docId) return;
    const unsub = onSnapshot(doc(db, collectionName, docId), (snap) => {
      if (snap.exists()) setServerData(snap.data());
    });
    return unsub;
  }, [collectionName, docId]);

  // Computed display values: local pending overrides server
  const values = { ...serverData, ...localSnap };

  // Update a field locally (triggers re-render)
  const set = useCallback((field, value) => {
    localRef.current[field] = value;
    setLocalSnap((p) => ({ ...p, [field]: value }));
  }, []);

  // Flush pending edits to Firestore
  const save = useCallback(async () => {
    const edits = { ...localRef.current };
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, collectionName, docId), {
        ...edits,
        lastUpdated: serverTimestamp(),
      });
      // Clear only the keys we just saved
      Object.keys(edits).forEach((k) => {
        if (localRef.current[k] === edits[k]) delete localRef.current[k];
      });
      setLocalSnap({ ...localRef.current });
      setShowSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setShowSaved(false), 2500);
    } catch (e) {
      console.error('Auto-save error:', e);
    } finally {
      setSaving(false);
    }
  }, [collectionName, docId]);

  // 30-second interval auto-save
  useEffect(() => {
    const id = setInterval(() => save(), 30000);
    return () => clearInterval(id);
  }, [save]);

  const loaded = serverData !== null;
  return { values, set, save, saving, showSaved, loaded };
}
