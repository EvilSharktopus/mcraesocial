// src/pages/Reflect.jsx
// Post-seminar: student can adjust their plot and write a reflection.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';

const PLACEHOLDER = {
  title: 'Economic Systems Compared',
  originalPosition: -20,
};

export default function Reflect() {
  const { id } = useParams();
  const [position,   setPosition]   = useState(PLACEHOLDER.originalPosition);
  const [reflection, setReflection] = useState('');
  const [saved,      setSaved]      = useState(false);

  const hasChanged = position !== PLACEHOLDER.originalPosition;

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // TODO: write to Firestore reflections/
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
          {PLACEHOLDER.title}
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
            secondaryDot={{ value: PLACEHOLDER.originalPosition, label: 'Your original position' }}
          />
          {hasChanged && (
            <p className="text-xs text-center mt-4" style={{ color: 'var(--pg-primary)' }}>
              You moved {Math.abs(position - PLACEHOLDER.originalPosition)} units {position > PLACEHOLDER.originalPosition ? 'right →' : '← left'}
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
