// src/pages/Phase4.jsx
// Phase 4 — Gallery Walk
// Shows 4 randomly selected positions from the gallery (anonymous, no names).
// Each card is collapsible — position badge visible, defence hidden until expanded.
// One IntegrityTextbox at the bottom for a challenge/question (80-char min, one submission).

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  doc, setDoc, collection, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import IntegrityTextbox from '../components/IntegrityTextbox';

const MIN_CHARS = 80;

const BADGE_STYLES = {
  A: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  B: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  C: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  D: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
};

const POSITION_LABELS = {
  A: 'Corporations are most responsible',
  B: 'Governments / International Law',
  C: 'Consumers have more power than they think',
  D: 'The system hurts more than it helps',
};

// Deterministically pick N random items from an array using a seed
function seededSample(arr, n, seed) {
  const shuffled = [...arr];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// ── Collapsible position card ─────────────────────────────────────────────────
function GalleryCard({ entry, index }) {
  const [open, setOpen] = useState(false);
  const badge = BADGE_STYLES[entry.position] ?? 'bg-white/10 text-white/50 border border-white/15';
  const label = POSITION_LABELS[entry.position] ?? entry.position;

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden transition-all duration-200">
      {/* Header — always visible */}
      <button
        id={`gallery-card-${index}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Anonymous label */}
          <span className="text-xs text-white/30 font-medium w-16 flex-shrink-0">
            Response {index + 1}
          </span>
          {/* Position badge */}
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badge}`}>
            {entry.position}
          </span>
          <span className="text-sm text-white/50 hidden sm:block truncate max-w-xs">
            {label}
          </span>
        </div>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible defence text */}
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-white/8">
          <p className="text-sm text-white/50 mb-2 italic">Position label: <span className="text-white/70 not-italic font-medium">{label}</span></p>
          <p className="text-white/70 text-sm leading-relaxed">{entry.defence}</p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Phase4({ studentName, onComplete }) {
  const [gallery, setGallery]     = useState([]);
  const [response, setResponse]   = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [loaded, setLoaded]       = useState(false);

  const studentRef   = doc(db, 'sessions', 'minerals', 'students', studentName);
  const responsesCol = collection(db, 'sessions', 'minerals', 'responses');
  const responseRef  = useRef(response);
  responseRef.current = response;

  // ── Live gallery listener ──────────────────────────────────────────────────
  useEffect(() => {
    const galleryCol = collection(db, 'sessions', 'minerals', 'gallery');
    const unsub = onSnapshot(galleryCol, (snap) => {
      const entries = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        // Exclude the student's own submission
        .filter((e) => e.id !== studentName && e.studentName !== studentName);
      entries.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
      setGallery(entries);
    });
    return () => unsub();
  }, [studentName]);

  // ── Load student's existing Phase 4 data ──────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(studentRef, (snap) => {
      if (snap.exists()) {
        const p4 = snap.data().phase4;
        if (p4?.response) setResponse(p4.response);
        if (p4?.submitted) setSubmitted(true);
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pick 4 random entries, stable per student (seeded by name hash) ────────
  const displayed = useMemo(() => {
    if (gallery.length === 0) return [];
    // Seed from student name so their 4 don't change on re-render
    const seed = studentName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return seededSample(gallery, Math.min(4, gallery.length), seed);
  }, [gallery, studentName]);

  // ── Submit response ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const trimmed = responseRef.current.trim();
    if (trimmed.length < MIN_CHARS || submitted) return;
    setSaving(true);
    try {
      await setDoc(
        studentRef,
        { phase4: { response: trimmed, submitted: true, submittedAt: Date.now() } },
        { merge: true }
      );
      const newResponseRef = doc(responsesCol);
      await setDoc(newResponseRef, { from: studentName, response: trimmed, submittedAt: Date.now() });
      setSubmitted(true);
      onComplete();
    } catch (e) {
      console.error('Phase4 submit error:', e);
    } finally {
      setSaving(false);
    }
  };

  const charCount = response.trim().length;
  const charsLeft = Math.max(0, MIN_CHARS - charCount);
  const canSubmit = charCount >= MIN_CHARS && !submitted;

  return (
    <div className="min-h-screen bg-transparent px-4 py-10">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(13,0,26,0.5)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto">

        {/* Phase badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-violet-500/15 border border-violet-500/25 text-violet-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
            Phase 4
          </span>
          <span className="text-white/30 text-xs">Gallery Walk</span>
          {saving && <span className="ml-auto text-xs text-violet-400/60 animate-pulse">Saving…</span>}
        </div>

        {/* Instruction */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
          <p className="text-white/70 text-sm leading-relaxed">
            Read the positions below. Expand any card to read the full argument. Then scroll down and write a question or counterargument — pick a position you disagree with.
          </p>
        </div>

        {/* Gallery cards */}
        {gallery.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm bg-white/[0.02] border border-white/8 rounded-2xl mb-8">
            No positions submitted yet — check back shortly.
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {displayed.map((entry, i) => (
              <GalleryCard key={entry.id} entry={entry} index={i} />
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-white/25 uppercase tracking-widest">Your Response</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Response textbox */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
          <p className="text-white/55 text-xs italic mb-3">
            "Choose one position you disagree with or want to challenge. Write a question or counterargument. You can reference which position (A, B, C, or D) you're responding to."
          </p>
          <IntegrityTextbox
            value={response}
            onChange={setResponse}
            placeholder="Write your challenge or question here…"
            studentName={studentName}
            phaseKey="phase4"
            fieldKey="response"
            rows={5}
            disabled={submitted}
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-white/25">Reference the position letter (A, B, C, or D)</p>
            <p className={`text-xs font-mono transition-colors ${charCount >= MIN_CHARS ? 'text-emerald-400' : 'text-white/30'}`}>
              {charCount >= MIN_CHARS ? `${charCount} chars ✓` : `${charsLeft} more chars needed`}
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col items-center gap-3">
          {submitted && (
            <p className="text-xs text-white/40">Response submitted — scroll up to re-read the positions.</p>
          )}
          <button
            id="phase4-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300',
              canSubmit
                ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5'
                : 'bg-white/5 text-white/20 cursor-not-allowed',
            ].join(' ')}
          >
            {submitted ? '✓ Response Submitted' : 'Submit Response →'}
          </button>
        </div>

      </div>
    </div>
  );
}
