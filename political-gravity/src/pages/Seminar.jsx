// src/pages/Seminar.jsx
// Teacher-triggered seminar: shows all student dots on a shared spectrum.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';

// Placeholder student data
const PLACEHOLDER_STUDENTS = [
  { name: 'Alex T.',    x: -62, y:  15 },
  { name: 'Bailey M.',  x:  14, y: -20 },
  { name: 'Cameron R.', x: -28, y:  40 },
  { name: 'Dana K.',    x:  55, y: -10 },
  { name: 'Evan P.',    x:   0, y:   0 },
  { name: 'Fiona L.',   x: -45, y: -60 },
  { name: 'Grace H.',   x:  72, y:  80 },
  { name: 'Hayden S.',  x: -10, y:  10 },
  { name: 'Iris W.',    x:  35, y:  25 },
  { name: 'Jordan B.',  x: -80, y: -40 },
];

const PLACEHOLDER_COMMENTS = [
  { author: 'Bailey M.', text: 'I think markets do a better job allocating resources than central planning.', ts: '9:14 AM' },
  { author: 'Fiona L.',  text: 'But what about public goods like healthcare? Markets fail there.', ts: '9:15 AM' },
  { author: 'Dana K.',   text: 'Scandinavian countries show you can have both — high tax AND high GDP.',    ts: '9:16 AM' },
];

function SeminarSpectrum({ students, axis }) {
  // Group students by approximate position bucket to avoid overlap
  const buckets = {};
  students.forEach(s => {
    const val = s[axis];
    const bucket = Math.round(val / 10) * 10;
    if (!buckets[bucket]) buckets[bucket] = [];
    buckets[bucket].push(s);
  });

  return (
    <div className="relative select-none" style={{ paddingTop: '80px', paddingBottom: '24px' }}>
      {/* Student dots — above the groove */}
      {Object.entries(buckets).map(([bucket, group]) =>
        group.map((s, i) => {
          const val = s[axis];
          const pct = (val + 100) / 2;
          return (
            <div
              key={s.name}
              className="absolute flex flex-col items-center"
              style={{
                left: `${pct}%`,
                bottom: `calc(50% + ${16 + i * 26}px)`,
                transform: 'translateX(-50%)',
              }}
            >
              {/* Dot */}
              <div
                className="w-4 h-4 rounded-full border-2 shadow"
                style={{
                  backgroundColor: 'var(--pg-primary)',
                  borderColor: 'var(--pg-bg)',
                  opacity: 0.85,
                }}
                title={`${s.name}: ${val > 0 ? '+' : ''}${val}`}
              />
              {/* Connector line */}
              <div style={{
                width: '1px',
                height: `${16 + i * 26 - 4}px`,
                backgroundColor: 'var(--pg-border)',
                position: 'absolute',
                top: '16px',
              }} />
              {/* Name chip */}
              <div
                className="absolute text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  bottom: 'calc(100% + 3px)',
                  backgroundColor: 'var(--pg-surface2)',
                  color: 'var(--pg-muted)',
                  border: '1px solid var(--pg-border)',
                }}
              >
                {s.name.split(' ')[0]}
              </div>
            </div>
          );
        })
      )}

      {/* Groove */}
      <div
        className="relative rounded-full"
        style={{ height: '6px', backgroundColor: 'var(--pg-border2)' }}
      >
        {/* Center tick */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full" style={{ backgroundColor: 'var(--pg-border2)' }} />
      </div>
    </div>
  );
}

export default function Seminar() {
  const { id } = useParams();
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(PLACEHOLDER_COMMENTS);

  const [consensusX, setConsensusX] = useState(0);
  const [consensusY, setConsensusY] = useState(0);
  const [saved, setSaved] = useState(false);

  function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setComments(prev => [...prev, { author: 'You', text: comment, ts: 'Just now' }]);
    setComment('');
  }

  async function saveConsensus() {
    setSaved(true);
    await setDoc(doc(db, 'settings', 'consensus'), {
      [id]: { x: consensusX, y: consensusY }
    }, { merge: true });
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar
        extra={
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse"
            style={{ backgroundColor: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}
          >
            ● LIVE
          </span>
        }
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-8 flex flex-col gap-8">
        
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--pg-text)' }}>
            Seminar: {id}
          </h1>
          <span className="text-xs" style={{ color: 'var(--pg-dim)' }}>
            {PLACEHOLDER_STUDENTS.length} students
          </span>
        </div>

        {/* ── Class spectrums ── */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--pg-text)' }}>Student Positions</h2>
          
          <h3 className="text-center font-bold text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Economic Spectrum</h3>
          <SeminarSpectrum students={PLACEHOLDER_STUDENTS} axis="x" />
          
          <div className="flex justify-between items-center mt-2 mb-6 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Collectivism</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Individualism</span>
          </div>

          <h3 className="text-center font-bold text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Political Spectrum</h3>
          <SeminarSpectrum students={PLACEHOLDER_STUDENTS} axis="y" />
        </div>

        {/* ── Set Class Consensus ── */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--pg-text)' }}>Class Consensus</h2>
              <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>Drag to record where the class landed. This sets the starting point for the next reading.</p>
            </div>
            <button
              onClick={saveConsensus}
              className="font-semibold px-6 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-35"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
            >
              {saved ? '✓ Saved' : 'Save Consensus'}
            </button>
          </div>
          
          <h3 className="text-center font-bold text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Economic Spectrum</h3>
          <Spectrum value={consensusX} onChange={setConsensusX} leftLabel={null} rightLabel={null} sublabels={[]} showValue={false} />
          
          <div className="flex justify-between items-center my-3 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Collectivism</span>
            <span className="text-[11px] text-pg-dim">◆</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Individualism</span>
          </div>

          <Spectrum value={consensusY} onChange={setConsensusY} leftLabel={null} rightLabel={null} sublabels={[]} showValue={false} />
          <h3 className="text-center font-bold text-xs mt-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Political Spectrum</h3>
        </div>

        {/* ── Backchannel ── */}
        <div className="rounded-2xl flex flex-col" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--pg-border)' }}>
            <h2 className="font-display font-bold" style={{ color: 'var(--pg-text)' }}>Backchannel</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>Live discussion — messages are visible to everyone</p>
          </div>
          <div className="flex-1 px-5 py-4 space-y-4 max-h-64 overflow-y-auto">
            {comments.map((c, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-semibold" style={{ color: 'var(--pg-primary)' }}>{c.author}</span>
                  <span className="text-[10px]" style={{ color: 'var(--pg-faint)' }}>{c.ts}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--pg-muted)' }}>{c.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={submitComment} className="px-5 py-4 flex gap-3" style={{ borderTop: '1px solid var(--pg-border)' }}>
            <input
              type="text"
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add to the discussion…"
              className="flex-1 rounded-xl px-4 py-2 text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: 'var(--pg-surface2)',
                border: '1px solid var(--pg-border)',
                color: 'var(--pg-text)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--pg-primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--pg-border)'}
            />
            <button
              type="submit"
              className="font-semibold px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-35"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
              disabled={!comment.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
