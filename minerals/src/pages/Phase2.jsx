// src/pages/Phase2.jsx
// Phase 2 — Source Notes
// For each source the student marked as read in Phase 1, shows a card with:
//   - Source title
//   - Single IntegrityTextbox: "In one sentence, what is the strongest claim this source makes?"
// All textboxes use IntegrityTextbox (paste blocking, keystroke logging, flagging).
// Auto-saves to Firestore every 5 seconds.
// "Submit Notes" posts to sessions/minerals/students/{studentName}/phase2.

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SOURCES } from '../data/sources';
import IntegrityTextbox from '../components/IntegrityTextbox';

const AUTOSAVE_INTERVAL_MS = 5000;

export default function Phase2({ studentName, onComplete }) {
  // notes: { [sourceId]: string }
  const [notes, setNotes] = useState({});
  // Which source IDs the student read in Phase 1
  const [readIds, setReadIds] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const studentRef = doc(db, 'sessions', 'minerals', 'students', studentName);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // ── Load Phase 1 readIds + any existing Phase 2 notes ────────────────────
  useEffect(() => {
    const unsub = onSnapshot(studentRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Phase 1 read sources
        if (data.phase1?.readIds) {
          setReadIds(data.phase1.readIds);
        }
        // Phase 2 existing notes
        if (data.phase2?.notes) {
          setNotes(data.phase2.notes);
        }
        // Submitted state
        if (data.phase2?.submitted) {
          setSubmitted(true);
        }
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save every 5 seconds ─────────────────────────────────────────────
  const save = useCallback(async (notesSnapshot) => {
    setSaving(true);
    try {
      await setDoc(
        studentRef,
        { phase2: { notes: notesSnapshot } },
        { merge: true }
      );
    } catch (e) {
      console.error('Phase2 autosave error:', e);
    } finally {
      setSaving(false);
    }
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      save(notesRef.current);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loaded, save]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    try {
      await setDoc(
        studentRef,
        { phase2: { notes: notesRef.current, submitted: true } },
        { merge: true }
      );
      setSubmitted(true);
      onComplete();
    } catch (e) {
      console.error('Phase2 submit error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Filter sources to only those the student read ────────────────────────
  const readSources = SOURCES.filter((s) => readIds.includes(s.id));

  // All read sources must have at least some text to submit
  const allFilled = readSources.length > 0 &&
    readSources.every((s) => (notes[s.id] ?? '').trim().length > 0);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] px-4 py-10">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0d0f_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">

        {/* Phase badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
            Phase 2
          </span>
          <span className="text-white/30 text-xs">Source Notes</span>
          {saving && (
            <span className="ml-auto text-xs text-amber-400/60 animate-pulse">Saving…</span>
          )}
        </div>

        {/* Instruction */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
          <p className="text-white/70 text-sm leading-relaxed">
            For each source you read, write <span className="text-white font-medium">one sentence</span> capturing the strongest claim it makes. Your own words — no copying.
          </p>
        </div>

        {/* Source note cards */}
        <div className="space-y-6">
          {readSources.map((source, idx) => (
            <div
              key={source.id}
              className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors"
            >
              {/* Source header */}
              <div className="flex items-start gap-3 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-xs font-bold text-amber-400">
                  {source.id}
                </span>
                <div>
                  <h2 className="text-white font-semibold text-sm leading-snug">
                    {source.title}
                  </h2>
                  <p className="text-white/35 text-xs mt-0.5">{source.outlet}</p>
                </div>
              </div>

              {/* Prompt */}
              <p className="text-white/55 text-xs mb-3 italic">
                "In one sentence, what is the strongest claim this source makes?"
              </p>

              {/* IntegrityTextbox */}
              <IntegrityTextbox
                value={notes[source.id] ?? ''}
                onChange={(val) => setNotes((prev) => ({ ...prev, [source.id]: val }))}
                placeholder="Write your one-sentence summary here…"
                studentName={studentName}
                phaseKey="phase2"
                fieldKey={`source_${source.id}`}
                rows={2}
                disabled={submitted}
              />

              {/* Character hint */}
              <p className="mt-1.5 text-right text-xs text-white/20">
                {(notes[source.id] ?? '').length > 0
                  ? `${(notes[source.id] ?? '').split(/\s+/).filter(Boolean).length} words`
                  : 'Start typing…'}
              </p>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="mt-10 flex flex-col items-center gap-3">
          {!allFilled && !submitted && (
            <p className="text-xs text-white/30">
              Add a note for every source you read to unlock submission
            </p>
          )}
          <button
            id="phase2-submit-btn"
            onClick={handleSubmit}
            disabled={!allFilled || submitted}
            className={[
              'w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300',
              allFilled && !submitted
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5'
                : 'bg-white/5 text-white/20 cursor-not-allowed',
            ].join(' ')}
          >
            {submitted ? '✓ Notes Submitted' : 'Submit Notes →'}
          </button>
        </div>

      </div>
    </div>
  );
}
