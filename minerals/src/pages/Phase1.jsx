// src/pages/Phase1.jsx
// Phase 1 — Context + Sources
// Shows the framing blurb and 6 source cards with:
//   - Bias/perspective tag pill
//   - "Read source →" external link
//   - "Mark as read" checkbox
// Read state auto-saves to Firestore: sessions/minerals/students/{studentName}/phase1
// "Continue to Phase 2" unlocks once MIN_READ_REQUIRED sources are checked.

import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SOURCES, MIN_READ_REQUIRED } from '../data/sources';

// Colour map for bias tags
const TAG_COLOURS = {
  'NGO / advocacy':              'bg-rose-500/15 text-rose-300 border-rose-500/25',
  'Current events / 2025':       'bg-sky-500/15 text-sky-300 border-sky-500/25',
  'Journalism / lived experience':'bg-violet-500/15 text-violet-300 border-violet-500/25',
  'Consumer / policy':           'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'Policy critique':             'bg-orange-500/15 text-orange-300 border-orange-500/25',
  'Reform / solutions':          'bg-teal-500/15 text-teal-300 border-teal-500/25',
};

function tagClass(tag) {
  return TAG_COLOURS[tag] ?? 'bg-white/10 text-white/60 border-white/15';
}

export default function Phase1({ studentName, onComplete }) {
  // read is a Set of source IDs the student has checked
  const [read, setRead] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const studentRef = doc(db, 'sessions', 'minerals', 'students', studentName);

  // ── Load existing read state from Firestore on mount ──────────────────────
  useEffect(() => {
    const unsub = onSnapshot(studentRef, (snap) => {
      if (snap.exists()) {
        const p1 = snap.data().phase1;
        if (p1?.readIds && Array.isArray(p1.readIds)) {
          setRead(new Set(p1.readIds));
        }
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle a source's read state ─────────────────────────────────────────
  const toggle = async (id) => {
    const next = new Set(read);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setRead(next);

    // Persist immediately
    setSaving(true);
    try {
      await setDoc(
        studentRef,
        { phase1: { readIds: Array.from(next) } },
        { merge: true }
      );
    } catch (e) {
      console.error('Phase1 save error:', e);
    } finally {
      setSaving(false);
    }
  };

  const readCount = read.size;
  const canContinue = readCount >= MIN_READ_REQUIRED;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-transparent px-4 py-10">
      <div className="max-w-3xl mx-auto">

        {/* Phase badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
            Phase 1
          </span>
          <span className="text-white/30 text-xs">Context + Sources</span>
        </div>

        {/* Framing blurb */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-8">
          <p className="text-white/80 text-base leading-relaxed">
            You've probably heard of blood diamonds. But the minerals inside your phone, laptop, and electric vehicle may be funding active wars right now. Read the sources below before forming a position.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-white/40">
            {readCount < MIN_READ_REQUIRED
              ? `Read at least ${MIN_READ_REQUIRED} sources to continue — ${readCount}/${MIN_READ_REQUIRED} so far`
              : `${readCount} of 6 sources marked — ready to continue`}
          </p>
          {saving && (
            <span className="text-xs text-amber-400/60 animate-pulse">Saving…</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/5 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((readCount / 6) * 100, 100)}%` }}
          />
        </div>

        {/* Source cards */}
        <div className="space-y-4">
          {SOURCES.map((source, idx) => {
            const isRead = read.has(source.id);
            return (
              <div
                key={source.id}
                className={[
                  'group relative rounded-xl border p-5 transition-all duration-300',
                  isRead
                    ? 'bg-amber-500/[0.07] border-amber-500/30'
                    : 'bg-white/[0.03] border-white/8 hover:border-white/15 hover:bg-white/[0.05]',
                ].join(' ')}
              >
                {/* Top row: number + tag */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-xs font-bold text-white/50">
                      {idx + 1}
                    </span>
                    <span className={[
                      'text-xs font-medium px-2.5 py-0.5 rounded-full border',
                      tagClass(source.tag),
                    ].join(' ')}>
                      {source.tag}
                    </span>
                  </div>
                  {isRead && (
                    <span className="text-amber-400 text-xs font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Read
                    </span>
                  )}
                </div>

                {/* Title + outlet */}
                <h2 className="text-white font-semibold text-base mb-0.5 leading-snug">
                  {source.title}
                </h2>
                <p className="text-white/40 text-sm mb-4">{source.outlet}</p>

                {/* Actions row */}
                <div className="flex items-center justify-between gap-4">
                  {/* External link */}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    id={`source-link-${source.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors font-medium"
                  >
                    Read source
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  {/* Mark as read checkbox */}
                  <label
                    id={`source-check-${source.id}`}
                    className="flex items-center gap-2.5 cursor-pointer select-none group/check"
                  >
                    <span className="text-sm text-white/50 group-hover/check:text-white/70 transition-colors">
                      Mark as read
                    </span>
                    <div
                      onClick={() => toggle(source.id)}
                      className={[
                        'w-5 h-5 rounded flex items-center justify-center border-2 transition-all duration-200',
                        isRead
                          ? 'bg-amber-500 border-amber-500'
                          : 'bg-transparent border-white/20 group-hover/check:border-white/40',
                      ].join(' ')}
                    >
                      {isRead && (
                        <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Continue button */}
        <div className="mt-10 flex flex-col items-center gap-3">
          {!canContinue && (
            <p className="text-xs text-white/30">
              Mark {MIN_READ_REQUIRED - readCount} more source{MIN_READ_REQUIRED - readCount !== 1 ? 's' : ''} as read to unlock Phase 2
            </p>
          )}
          <button
            id="phase1-continue-btn"
            onClick={onComplete}
            disabled={!canContinue || !loaded}
            className={[
              'w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300',
              canContinue
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5'
                : 'bg-white/5 text-white/20 cursor-not-allowed',
            ].join(' ')}
          >
            Continue to Phase 2 →
          </button>
        </div>

      </div>
    </div>
  );
}
