// src/pages/Reading.jsx
// Split-screen: reading text on left, Spectrum + justification on right.
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import { PENDULUM_READINGS } from '../data/pendulumReadings';

const DEFAULT_SUBLABELS = [];

export default function Reading() {
  const { id } = useParams();
  const reading = PENDULUM_READINGS.find(r => r.id === id);

  const [positionX,     setPositionX]     = useState(null);
  const [positionY,     setPositionY]     = useState(null);
  const [justification, setJustification] = useState('');
  const [saved,         setSaved]         = useState(false);

  useEffect(() => {
    async function loadConsensus() {
      const idx = PENDULUM_READINGS.findIndex(r => r.id === id);
      if (idx > 0) {
        const prevId = PENDULUM_READINGS[idx - 1].id;
        const snap = await getDoc(doc(db, 'settings', 'consensus'));
        if (snap.exists()) {
          const data = snap.data();
          if (data[prevId]) {
            // Set initial position based on previous class consensus
            setPositionX(data[prevId].x);
            setPositionY(data[prevId].y);
          }
        }
      }
    }
    loadConsensus();
  }, [id]);

  function handleSave() {
    if (positionX === null || positionY === null) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    // TODO: write to Firestore plots/{uid}_{readingId}
  }

  if (!reading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--pg-bg)' }}>
        <NavBar backTo="/dashboard" backLabel="Dashboard" />
        <h1 className="text-2xl font-bold mt-10">Reading not found</h1>
        <Link to="/dashboard" className="text-blue-500 hover:underline mt-4">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar backTo="/dashboard" backLabel="Dashboard" />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Google Doc iframe ── */}
        <div
          className="flex-1 overflow-hidden"
          style={{ borderRight: '1px solid var(--pg-border)' }}
        >
          <iframe 
            src={reading.url} 
            title={reading.title}
            className="w-full h-full border-none"
            allow="autoplay"
          />
        </div>

        {/* ── Right: dual spectrums + justification ── */}
        <div
          className="w-96 shrink-0 flex flex-col overflow-y-auto p-6 gap-6"
          style={{ backgroundColor: 'var(--pg-surface)' }}
        >
          <div>
            <h2 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--pg-text)' }}>
              Where do you stand?
            </h2>
            <p className="text-xs mb-5" style={{ color: 'var(--pg-dim)' }}>
              Drag the markers to place your position on both spectrums.
            </p>

            <div className="flex flex-col">
              <h3 className="text-center font-bold text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Economic Spectrum</h3>
              <Spectrum
                value={positionX ?? 0}
                onChange={setPositionX}
                leftLabel={null}
                rightLabel={null}
                sublabels={[]}
              />
              
              <div className="flex justify-between items-center my-3 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Collectivism</span>
                <span className="text-[11px] text-pg-dim">◆</span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Individualism</span>
              </div>

              <Spectrum
                value={positionY ?? 0}
                onChange={setPositionY}
                leftLabel={null}
                rightLabel={null}
                sublabels={[]}
              />
              <h3 className="text-center font-bold text-xs mt-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Political Spectrum</h3>
            </div>

            {(positionX === null || positionY === null) && (
              <p className="text-xs text-center mt-4 font-medium" style={{ color: 'var(--pg-primary)' }}>
                Move both markers to record your position
              </p>
            )}
          </div>

          {/* Justification */}
          <div className="flex-1 flex flex-col">
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: 'var(--pg-text)' }}
            >
              Justify your position
            </label>
            <p className="text-xs mb-3" style={{ color: 'var(--pg-dim)' }}>
              Use at least one piece of evidence from the reading to support your placement.
            </p>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              onPaste={e => {
                e.preventDefault();
                alert('Pasting is not allowed on this site.');
              }}
              placeholder="The text argues that…"
              className="flex-1 resize-none rounded-xl p-4 text-sm focus:outline-none transition-colors min-h-[140px]"
              style={{
                backgroundColor: 'var(--pg-surface2)',
                border: '1px solid var(--pg-border)',
                color: 'var(--pg-text)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--pg-primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--pg-border)'}
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={positionX === null || positionY === null || !justification.trim()}
            className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
            style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
          >
            {saved ? '✓ Saved!' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}
