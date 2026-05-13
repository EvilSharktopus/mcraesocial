// src/pages/Phase3.jsx
// Phase 3 — Take a Stand
// Four selectable position cards (label only).
// After selecting, shows an IntegrityTextbox with 150-char minimum.
// On submit: writes to students/{name}/phase3 AND gallery/{name} for the live feed.

import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import IntegrityTextbox from '../components/IntegrityTextbox';

const POSITIONS = [
  {
    id: 'A',
    label: 'A — Corporations are most responsible',
    colour: 'rose',
  },
  {
    id: 'B',
    label: 'B — Governments / International Law is the only real solution',
    colour: 'sky',
  },
  {
    id: 'C',
    label: 'C — Consumers have more power than they think',
    colour: 'emerald',
  },
  {
    id: 'D',
    label: 'D — The system hurts more than it helps',
    colour: 'violet',
  },
];

// Tailwind colour maps (must be string literals for purge to keep them)
const POSITION_STYLES = {
  A: {
    idle:     'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 hover:bg-rose-500/10',
    selected: 'border-rose-500/60 bg-rose-500/15 ring-2 ring-rose-500/30',
    badge:    'bg-rose-500/20 text-rose-300 border-rose-500/30',
    letter:   'text-rose-400',
  },
  B: {
    idle:     'border-sky-500/20 bg-sky-500/5 hover:border-sky-500/40 hover:bg-sky-500/10',
    selected: 'border-sky-500/60 bg-sky-500/15 ring-2 ring-sky-500/30',
    badge:    'bg-sky-500/20 text-sky-300 border-sky-500/30',
    letter:   'text-sky-400',
  },
  C: {
    idle:     'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10',
    selected: 'border-emerald-500/60 bg-emerald-500/15 ring-2 ring-emerald-500/30',
    badge:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    letter:   'text-emerald-400',
  },
  D: {
    idle:     'border-violet-500/20 bg-violet-500/5 hover:border-violet-500/40 hover:bg-violet-500/10',
    selected: 'border-violet-500/60 bg-violet-500/15 ring-2 ring-violet-500/30',
    badge:    'bg-violet-500/20 text-violet-300 border-violet-500/30',
    letter:   'text-violet-400',
  },
};

const MIN_CHARS = 150;

export default function Phase3({ studentName, onComplete }) {
  const [position, setPosition]   = useState(null);
  const [defence, setDefence]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [loaded, setLoaded]       = useState(false);

  const studentRef = doc(db, 'sessions', 'minerals', 'students', studentName);
  const galleryRef = doc(db, 'sessions', 'minerals', 'gallery', studentName);

  // ── Load any existing Phase 3 data ───────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(studentRef, (snap) => {
      if (snap.exists()) {
        const p3 = snap.data().phase3;
        if (p3?.position) setPosition(p3.position);
        if (p3?.defence)  setDefence(p3.defence);
        if (p3?.submitted) setSubmitted(true);
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!position || defence.trim().length < MIN_CHARS) return;
    setSaving(true);
    const payload = {
      studentName,
      position,
      defence: defence.trim(),
      submittedAt: Date.now(),
    };
    try {
      // Write to student record
      await setDoc(
        studentRef,
        { phase3: { ...payload, submitted: true } },
        { merge: true }
      );
      // Write to gallery for live feed
      await setDoc(galleryRef, payload);
      setSubmitted(true);
      onComplete();
    } catch (e) {
      console.error('Phase3 submit error:', e);
    } finally {
      setSaving(false);
    }
  };

  const charCount    = defence.trim().length;
  const charsLeft    = Math.max(0, MIN_CHARS - charCount);
  const canSubmit    = position !== null && charCount >= MIN_CHARS && !submitted;
  const styles       = position ? POSITION_STYLES[position] : null;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-10">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(26,18,0,0.5)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">

        {/* Phase badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
            Phase 3
          </span>
          <span className="text-white/30 text-xs">Take a Stand</span>
          {saving && (
            <span className="ml-auto text-xs text-amber-400/60 animate-pulse">Saving…</span>
          )}
        </div>

        {/* Instruction */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
          <p className="text-white/70 text-sm leading-relaxed">
            Based on what you read, choose the position you can best defend. There is no right answer — only your argument.
          </p>
        </div>

        {/* Position cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {POSITIONS.map((pos) => {
            const s = POSITION_STYLES[pos.id];
            const isSelected = position === pos.id;
            return (
              <button
                key={pos.id}
                id={`position-${pos.id}`}
                onClick={() => !submitted && setPosition(pos.id)}
                disabled={submitted}
                className={[
                  'relative text-left rounded-xl border p-5 transition-all duration-250 cursor-pointer',
                  'disabled:cursor-not-allowed',
                  isSelected ? s.selected : s.idle,
                ].join(' ')}
              >
                {/* Letter badge */}
                <span className={[
                  'inline-flex w-8 h-8 rounded-lg items-center justify-center',
                  'text-lg font-black mb-3 border',
                  s.badge,
                ].join(' ')}>
                  {pos.id}
                </span>

                {/* Label */}
                <p className={[
                  'text-sm font-semibold leading-snug',
                  isSelected ? 'text-white' : 'text-white/60',
                ].join(' ')}>
                  {pos.label}
                </p>

                {/* Selected checkmark */}
                {isSelected && (
                  <span className={['absolute top-3 right-3', s.letter].join(' ')}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Defence textbox — shown after a position is selected */}
        {position && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-8 transition-all duration-300">
            <p className="text-white/55 text-xs italic mb-3">
              "Defend your position in 3–5 sentences. You must name at least two of the sources you read."
            </p>

            <IntegrityTextbox
              value={defence}
              onChange={setDefence}
              placeholder="Write your defence here…"
              studentName={studentName}
              phaseKey="phase3"
              fieldKey="defence"
              rows={6}
              disabled={submitted}
            />

            {/* Char counter */}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-white/25">
                Name at least two sources in your defence
              </p>
              <p className={[
                'text-xs font-mono transition-colors',
                charCount >= MIN_CHARS ? 'text-emerald-400' : 'text-white/30',
              ].join(' ')}>
                {charCount >= MIN_CHARS
                  ? `${charCount} chars ✓`
                  : `${charsLeft} more chars needed`}
              </p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col items-center gap-3">
          {!position && (
            <p className="text-xs text-white/30">Select a position above to continue</p>
          )}
          {position && !canSubmit && !submitted && (
            <p className="text-xs text-white/30">
              {charsLeft > 0
                ? `Write ${charsLeft} more character${charsLeft !== 1 ? 's' : ''} to unlock submission`
                : 'Choose a position to submit'}
            </p>
          )}
          <button
            id="phase3-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300',
              canSubmit
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5'
                : 'bg-white/5 text-white/20 cursor-not-allowed',
            ].join(' ')}
          >
            {submitted ? '✓ Position Submitted' : 'Submit Position →'}
          </button>
        </div>

      </div>
    </div>
  );
}
