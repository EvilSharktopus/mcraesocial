// src/hooks/useStageSync.js
// Real-time Firestore sync + local edits + auto-save for stage documents
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

export function useStageSync(collectionName, docId) {
  const [serverData, setServerData] = useState(null);
  const [error, setError] = useState(null);
  const localRef = useRef({});            // pending edits (not yet saved)
  const [localSnap, setLocalSnap] = useState({}); // mirror for renders
  const pendingSaveRef = useRef({});       // values we saved but server hasn't confirmed
  const [saving, setSaving]   = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimer = useRef(null);

  // Live listener — remote wins only for fields NOT pending locally or awaiting confirm
  useEffect(() => {
    if (!docId) return;
    const unsub = onSnapshot(
      doc(db, collectionName, docId),
      (snap) => {
        setError(null);
        const data = snap.exists() ? snap.data() : {};

        // Clear pending-save keys that the server has confirmed
        const pending = pendingSaveRef.current;
        Object.keys(pending).forEach(k => {
          const serverVal = data[k];
          const savedVal = pending[k];
          // Consider confirmed if server value matches what we saved (deep compare for objects/arrays)
          if (JSON.stringify(serverVal) === JSON.stringify(savedVal)) {
            delete pending[k];
            // Also clear from localRef if user hasn't typed MORE since the save
            if (JSON.stringify(localRef.current[k]) === JSON.stringify(savedVal)) {
              delete localRef.current[k];
            }
          }
        });

        setLocalSnap({ ...localRef.current });
        setServerData(data);
      },
      (err) => {
        console.error(`useStageSync(${collectionName}/${docId}) error:`, err);
        setError(err.message || 'Firestore read error');
        setServerData((prev) => prev ?? {});
      }
    );
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
      // Track what we saved — DON'T clear localRef/localSnap yet.
      // They stay in place so the UI never flashes back to stale server data.
      // onSnapshot will clear them once the server confirms.
      Object.keys(edits).forEach(k => {
        pendingSaveRef.current[k] = edits[k];
      });
      setShowSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setShowSaved(false), 2500);
    } catch (e) {
      console.error('Auto-save error:', e);
      throw e; // Bubble up so handleSubmit can catch it and prevent stage advancement if save fails
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
  return { values, set, save, saving, showSaved, loaded, error };
}

