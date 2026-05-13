// src/pages/Phase5.jsx
// Phase 5 — Reflection
// Three IntegrityTextboxes, each with a 40-char minimum.
// On submit: saves to sessions/minerals/students/{studentName}/phase5
// then navigates to Done screen. No further navigation after that.

import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import IntegrityTextbox from '../components/IntegrityTextbox';

const MIN_CHARS = 40;

const PROMPTS = [
  {
    id: 'q1',
    prompt: 'Which position surprised you most in the gallery, and why?',
  },
  {
    id: 'q2',
    prompt: 'Did reading other students\u2019 posts change your thinking at all? Explain.',
  },
  {
    id: 'q3',
    prompt: 'Name one concrete thing \u2014 corporations, governments, or consumers could do tomorrow \u2014 to make a difference. Be specific.',
  },
];

export default function Phase5({ studentName, onComplete }) {
  const [answers, setAnswers]     = useState({ q1: '', q2: '', q3: '' });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [loaded, setLoaded]       = useState(false);

  const studentRef = doc(db, 'sessions', 'minerals', 'students', studentName);

  // ── Load any existing Phase 5 data ───────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(studentRef, (snap) => {
      if (snap.exists()) {
        const p5 = snap.data().phase5;
        if (p5?.answers) setAnswers((prev) => ({ ...prev, ...p5.answers }));
        if (p5?.submitted) setSubmitted(true);
      }
      setLoaded(true);
    });
    return () => unsub();
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!allFilled || submitted) return;
    setSaving(true);
    try {
      await setDoc(
        studentRef,
        {
          phase5: {
            answers,
            submitted: true,
            submittedAt: Date.now(),
          },
        },
        { merge: true }
      );
      setSubmitted(true);
      onComplete();
    } catch (e) {
      console.error('Phase5 submit error:', e);
    } finally {
      setSaving(false);
    }
  };

  const allFilled = PROMPTS.every(
    (p) => (answers[p.id] ?? '').trim().length >= MIN_CHARS
  );
  const canSubmit = allFilled && !submitted;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0f] px-4 py-10">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#001a12_0%,_#0d0d0f_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">

        {/* Phase badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-teal-500/15 border border-teal-500/25 text-teal-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
            Phase 5
          </span>
          <span className="text-white/30 text-xs">Reflection</span>
          {saving && (
            <span className="ml-auto text-xs text-teal-400/60 animate-pulse">Saving…</span>
          )}
        </div>

        {/* Instruction */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
          <p className="text-white/70 text-sm leading-relaxed">
            Take a moment to think before you type. These are your final thoughts — make them count.
          </p>
        </div>

        {/* Reflection questions */}
        <div className="space-y-6 mb-10">
          {PROMPTS.map((item, idx) => {
            const val      = answers[item.id] ?? '';
            const charCount = val.trim().length;
            const charsLeft = Math.max(0, MIN_CHARS - charCount);
            const met       = charCount >= MIN_CHARS;

            return (
              <div
                key={item.id}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors"
              >
                {/* Question number + prompt */}
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-xs font-bold text-teal-400">
                    {idx + 1}
                  </span>
                  <p className="text-white/80 text-sm font-medium leading-snug pt-0.5">
                    {item.prompt}
                  </p>
                </div>

                <IntegrityTextbox
                  value={val}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [item.id]: v }))}
                  placeholder="Your response…"
                  studentName={studentName}
                  phaseKey="phase5"
                  fieldKey={item.id}
                  rows={4}
                  disabled={submitted}
                />

                {/* Char counter */}
                <div className="mt-2 flex justify-end">
                  <p className={[
                    'text-xs font-mono transition-colors',
                    met ? 'text-teal-400' : 'text-white/25',
                  ].join(' ')}>
                    {met ? `${charCount} chars ✓` : `${charsLeft} more chars needed`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div className="flex flex-col items-center gap-3">
          {!allFilled && !submitted && (
            <p className="text-xs text-white/30">
              All three responses need at least {MIN_CHARS} characters
            </p>
          )}
          <button
            id="phase5-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={[
              'w-full max-w-sm py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300',
              canSubmit
                ? 'bg-teal-500 hover:bg-teal-400 text-black shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5'
                : 'bg-white/5 text-white/20 cursor-not-allowed',
            ].join(' ')}
          >
            {submitted ? '✓ Reflection Submitted' : 'Submit Reflection →'}
          </button>
        </div>

      </div>
    </div>
  );
}
