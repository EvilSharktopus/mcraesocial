// src/pages/Phase4.jsx
// Phase 4 — Gallery Walk
// Live onSnapshot on sessions/minerals/gallery — shows all Phase 3 submissions.
// 2-column masonry-style grid of student position cards.
// One IntegrityTextbox at the bottom: challenge/question directed at a classmate.
// 80-char minimum. One submission per student. After submitting, gallery stays readable.
// Saves to: students/{name}/phase4 AND appended to sessions/minerals/responses

import { useState, useEffect, useRef } from 'react';
import {
  doc, setDoc, collection,
  onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import IntegrityTextbox from '../components/IntegrityTextbox';

const MIN_CHARS = 80;

// Position colour badges — same palette as Phase3
const BADGE_STYLES = {
  A: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  B: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  C: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  D: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
};

const CARD_ACCENT = {
  A: 'border-rose-500/15 hover:border-rose-500/30',
  B: 'border-sky-500/15 hover:border-sky-500/30',
  C: 'border-emerald-500/15 hover:border-emerald-500/30',
  D: 'border-violet-500/15 hover:border-violet-500/30',
};

export default function Phase4({ studentName, onComplete }) {
  const [gallery, setGallery]       = useState([]); // array of {studentName, position, defence}
  const [response, setResponse]     = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [loaded, setLoaded]         = useState(false);

  const studentRef  = doc(db, 'sessions', 'minerals', 'students', studentName);
  const responsesCol = collection(db, 'sessions', 'minerals', 'responses');
  const responseRef = useRef(response);
  responseRef.current = response;

  // ── Live gallery listener ─────────────────────────────────────────────────
  useEffect(() => {
    const galleryCol = collection(db, 'sessions', 'minerals', 'gallery');
    const unsub = onSnapshot(galleryCol, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by submittedAt so newest appear last (consistent ordering)
      entries.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
      setGallery(entries);
    });
    return () => unsub();
  }, []);

  // ── Load student's existing Phase 4 data ─────────────────────────────────
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

  // ── Submit response ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const trimmed = responseRef.current.trim();
    if (trimmed.length < MIN_CHARS || submitted) return;
    setSaving(true);

    const payload = {
      from: studentName,
      response: trimmed,
      submittedAt: Date.now(),
    };

    try {
      // Save to student record
      await setDoc(
        studentRef,
        { phase4: { response: trimmed, submitted: true, submittedAt: Date.now() } },
        { merge: true }
      );
      // Append to shared responses collection
      const newResponseRef = doc(responsesCol);
      await setDoc(newResponseRef, payload);

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d0d0f] px-4 py-10">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#0d001a_0%,_#0d0d0f_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">

        {/* Phase badge */}
        <div className="flex items-center gap-2 mb-6">
          <span className="bg-violet-500/15 border border-violet-500/25 text-violet-400 text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
            Phase 4
          </span>
          <span className="text-white/30 text-xs">Gallery Walk</span>
          {saving && (
            <span className="ml-auto text-xs text-violet-400/60 animate-pulse">Saving…</span>
          )}
        </div>

        {/* Instruction */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
          <p className="text-white/70 text-sm leading-relaxed">
            Read your classmates' positions. Then scroll to the bottom and write a question or counterargument directed at someone you disagree with. Name them by name.
          </p>
        </div>

        {/* Gallery grid */}
        {gallery.length === 0 ? (
          <div className="text-center py-16 text-white/20 text-sm">
            No positions submitted yet — check back shortly.
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 gap-4 space-y-4 mb-12">
            {gallery.map((entry) => {
              const badgeClass = BADGE_STYLES[entry.position] ?? 'bg-white/10 text-white/50 border border-white/15';
              const cardClass  = CARD_ACCENT[entry.position]  ?? 'border-white/10';
              const isOwn      = entry.studentName === studentName || entry.id === studentName;
              return (
                <div
                  key={entry.id}
                  className={[
                    'break-inside-avoid rounded-xl border p-5 transition-colors duration-200',
                    'bg-white/[0.03]',
                    cardClass,
                    isOwn ? 'ring-1 ring-white/10' : '',
                  ].join(' ')}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {/* Avatar initial */}
                      <div className="w-7 h-7 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-xs font-bold text-white/50 flex-shrink-0">
                        {(entry.studentName ?? entry.id ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-white">
                        {entry.studentName ?? entry.id}
                        {isOwn && (
                          <span className="ml-1.5 text-xs text-white/30 font-normal">(you)</span>
                        )}
                      </span>
                    </div>
                    {/* Position badge */}
                    <span className={[
                      'text-xs font-bold px-2.5 py-0.5 rounded-full',
                      badgeClass,
                    ].join(' ')}>
                      {entry.position}
                    </span>
                  </div>

                  {/* Defence text */}
                  <p className="text-white/65 text-sm leading-relaxed">
                    {entry.defence}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-white/25 uppercase tracking-widest">Your Response</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Challenge textbox */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
          <p className="text-white/55 text-xs italic mb-3">
            "Choose one post you disagree with or want to challenge. Write a question or counterargument directed at that person. Name them by name."
          </p>

          <IntegrityTextbox
            value={response}
            onChange={setResponse}
            placeholder="Name the student and write your challenge or question…"
            studentName={studentName}
            phaseKey="phase4"
            fieldKey="response"
            rows={5}
            disabled={submitted}
          />

          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-white/25">Name the student you're responding to</p>
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

        {/* Submit */}
        <div className="flex flex-col items-center gap-3">
          {submitted && (
            <p className="text-xs text-white/40">
              Response submitted — you can still scroll and read the gallery above.
            </p>
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
