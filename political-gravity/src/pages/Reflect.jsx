// src/pages/Reflect.jsx
// Post-seminar: student can adjust their plot and write a reflection.
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { PENDULUM_READINGS } from '../data/pendulumReadings';

export default function Reflect() {
  const { id } = useParams();
  const { user } = useAuth();
  const reading = PENDULUM_READINGS.find(r => r.id === id);

  const [originalPosition, setOriginalPosition] = useState(0);
  const [position,   setPosition]   = useState(0);
  const [reflection, setReflection] = useState('');
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    async function loadPlot() {
      if (!user || !reading) return;
      const snap = await getDoc(doc(db, 'plots', `${user.uid}_${reading.id}`));
      if (snap.exists()) {
        const x = snap.data().positionX || 0;
        setOriginalPosition(x);
        setPosition(x);
      }
    }
    loadPlot();
  }, [user, reading]);

  const hasChanged = position !== originalPosition;

  async function handleSave() {
    if (!user || !reading) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    try {
      await setDoc(doc(db, 'pg_reflections', `${user.uid}_${reading.id}`), {
        uid: user.uid,
        readingId: reading.id,
        originalPosition,
        newPosition: position,
        reflection,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to save reflection", err);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar backTo="/dashboard" backLabel="Dashboard" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">
        <div className="mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--pg-primary)' }}>
            Post-Seminar Reflection
          </span>
        </div>
        <h1 className="font-display font-bold text-2xl mb-6" style={{ color: 'var(--pg-text)' }}>
          {reading?.title || 'Reflection'}
        </h1>

        {/* Spectrum — with ghost dot at original position */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}
        >
          <h2 className="font-semibold text-sm mb-1" style={{ color: 'var(--pg-text)' }}>
            Adjust your position
          </h2>
          <p className="text-xs mb-6" style={{ color: 'var(--pg-dim)' }}>
            The faint dot shows where you started. Did the seminar change your thinking?
          </p>
          <Spectrum
            value={position}
            onChange={setPosition}
            leftLabel="Collective"
            rightLabel="Individual"
            secondaryDot={{ value: originalPosition, label: 'Your original position' }}
          />
          {hasChanged && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--pg-primary)' }}>
              You moved {Math.abs(position - originalPosition)} units {position > originalPosition ? 'right →' : '← left'}
            </p>
          )}
        </div>

        {/* Reflection */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}
        >
          <label className="block font-semibold text-sm mb-1" style={{ color: 'var(--pg-text)' }}>
            Written reflection
          </label>
          <p className="text-xs mb-3" style={{ color: 'var(--pg-dim)' }}>
            What did you hear in the seminar that challenged or confirmed your thinking?
            {hasChanged ? ' What caused you to shift your position?' : ''}
          </p>
          <textarea
            value={reflection}
            onChange={e => setReflection(e.target.value)}
            onPaste={e => {
              e.preventDefault();
              alert('Pasting is not allowed.');
            }}
            placeholder="During the seminar, I heard…"
            rows={7}
            className="w-full resize-none rounded-xl p-4 text-sm focus:outline-none transition-colors"
            style={{
              backgroundColor: 'var(--pg-surface2)',
              border: '1px solid var(--pg-border)',
              color: 'var(--pg-text)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--pg-primary)'}
            onBlur={e  => e.target.style.borderColor = 'var(--pg-border)'}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!reflection.trim()}
          className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
          style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
        >
          {saved ? '✓ Reflection Saved!' : 'Submit Reflection'}
        </button>
      </main>
    </div>
  );
}
