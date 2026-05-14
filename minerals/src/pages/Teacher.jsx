// src/pages/Teacher.jsx
// Teacher Dashboard — route: /minerals/teacher
// Password gate: "teacher101" — stored in component state ONLY, never Firestore.
// Features:
//   - Live student progress table (onSnapshot, flags column with modal)
//   - Tabs: Gallery | Responses | Reflections
//   - Wipe test data button

import { useState, useEffect } from 'react';
import {
  doc, collection, onSnapshot,
  writeBatch, getDocs, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

const TEACHER_PASSWORD = 'teacher101';
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY ?? '';
const RUBRIC_LS_KEY = 'minerals_teacher_rubric';

const POSITION_LABELS = {
  A: 'Corporations are most responsible',
  B: 'Governments / International Law',
  C: 'Consumers have more power than they think',
  D: 'The system hurts more than it helps',
};

// ─── Position colours (shared) ────────────────────────────────────────────────
const BADGE = {
  A: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  B: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  C: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  D: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
};

// ─── Password Gate ────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [pw, setPw]       = useState('');
  const [error, setError] = useState(false);

  const attempt = () => {
    if (pw === TEACHER_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setPw('');
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-1 text-center">Teacher Dashboard</h1>
        <p className="text-white/30 text-sm text-center mb-8">Blood Minerals — Take a Stand</p>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-7">
          <label className="block text-sm text-white/60 mb-2" htmlFor="teacher-pw">
            Dashboard password
          </label>
          <input
            id="teacher-pw"
            type="password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && attempt()}
            placeholder="Enter password"
            className={[
              'w-full rounded-lg border bg-white/5 px-4 py-3 text-white text-sm',
              'focus:outline-none focus:ring-2 transition-colors',
              error
                ? 'border-red-500/60 focus:ring-red-500/30'
                : 'border-white/10 focus:ring-amber-500/40',
            ].join(' ')}
          />
          {error && <p className="mt-2 text-xs text-red-400">Incorrect password.</p>}
          <button
            onClick={attempt}
            className="mt-4 w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition-colors"
          >
            Unlock Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Flag Modal ───────────────────────────────────────────────────────────────
function FlagModal({ student, data, onClose }) {
  const phases = ['phase2', 'phase3', 'phase4', 'phase5'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#141416] border border-white/10 rounded-2xl p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">
            🚩 Flags — <span className="text-amber-400">{student}</span>
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {phases.map((phase) => {
            const phaseData = data?.[phase];
            if (!phaseData?.flags) return null;
            const flags = phaseData.flags;
            const fields = Object.keys(flags);
            return (
              <div key={phase} className="bg-white/5 rounded-xl p-4 border border-white/8">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3">
                  {phase.replace('phase', 'Phase ')}
                </p>
                {fields.map((field) => {
                  const f = flags[field];
                  return (
                    <div key={field} className="mb-2 last:mb-0">
                      <p className="text-sm text-white/70 font-medium mb-1">{field}</p>
                      <div className="flex flex-wrap gap-2">
                        {f.injectionFlag && (
                          <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                            Injection detected
                          </span>
                        )}
                        {f.velocityFlag && (
                          <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                            Velocity flag
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 text-sm transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
// ── Gemini AI marking helper ─────────────────────────────────────────────────
async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  // Strip markdown fences if present
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(clean);
}

function buildPrompt(rubric, name, data) {
  const p3 = data.phase3 ?? {};
  const p4 = data.phase4 ?? {};
  const p5 = data.phase5 ?? {};
  const pos = p3.position ? `${p3.position} — ${POSITION_LABELS[p3.position] ?? ''}` : 'Not submitted';
  return `You are a teacher's assistant grading a high school inquiry assignment about blood minerals.

RUBRIC:
${rubric}

STUDENT: ${name}

PHASE 3 — Take a Stand
Position chosen: ${pos}
Defence (written argument):
${p3.defence ?? '(not submitted)'}

PHASE 4 — Gallery Walk Challenge
${p4.response ?? '(not submitted)'}

PHASE 5 — Reflection
Q1: Which position surprised you most in the gallery, and why?
${p5.answers?.q1 ?? '(not submitted)'}

Q2: Did reading other students' posts change your thinking at all? Explain.
${p5.answers?.q2 ?? '(not submitted)'}

Q3: Name one concrete thing corporations, governments, or consumers could do tomorrow to make a difference. Be specific.
${p5.answers?.q3 ?? '(not submitted)'}

Using the rubric above, assess this student's work. Return ONLY valid JSON — no extra text, no markdown fences:
{
  "overall": "e.g. 18 / 24",
  "comment": "2-3 sentence overall summary for the teacher",
  "phase3": "brief comment on their position and defence",
  "phase4": "brief comment on their challenge/counterargument",
  "phase5": "brief comment on the quality of their reflections"
}`;
}

function Dashboard() {
  const [students, setStudents]     = useState({}); // { name: data }
  const [gallery, setGallery]       = useState([]);
  const [responses, setResponses]   = useState([]);
  const [tab, setTab]               = useState('progress');
  const [flagModal, setFlagModal]   = useState(null);
  const [wiping, setWiping]         = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);

  // AI marking state
  const [rubric, setRubric]         = useState(() => localStorage.getItem(RUBRIC_LS_KEY) ?? '');
  const [aiResults, setAiResults]   = useState({});  // { name: { overall, comment, phase3, phase4, phase5 } }
  const [marking, setMarking]       = useState(new Set()); // names currently being graded
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [aiError, setAiError]       = useState('');

  const studentsCol  = collection(db, 'sessions', 'minerals', 'students');
  const galleryCol   = collection(db, 'sessions', 'minerals', 'gallery');
  const responsesCol = collection(db, 'sessions', 'minerals', 'responses');

  // ── Live listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubStudents = onSnapshot(studentsCol, (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data(); });
      setStudents(map);
    });
    const unsubGallery = onSnapshot(galleryCol, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
      setGallery(entries);
    });
    const unsubResponses = onSnapshot(responsesCol, (snap) => {
      const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      entries.sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0));
      setResponses(entries);
    });
    return () => { unsubStudents(); unsubGallery(); unsubResponses(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save rubric to localStorage whenever it changes ────────────────────
  const saveRubric = (val) => {
    setRubric(val);
    localStorage.setItem(RUBRIC_LS_KEY, val);
  };

  // ── Mark a single student ─────────────────────────────────────────────
  const markStudent = async (name) => {
    if (!GEMINI_KEY || GEMINI_KEY === 'your_key_here') {
      setAiError('No Gemini API key set. Add VITE_GEMINI_KEY to your .env file.');
      return;
    }
    if (!rubric.trim()) { setAiError('Paste your rubric first.'); return; }
    setAiError('');
    setMarking((prev) => new Set([...prev, name]));
    try {
      const data = students[name] ?? {};
      const result = await callGemini(buildPrompt(rubric, name, data));
      // Save to Firestore
      await setDoc(
        doc(db, 'sessions', 'minerals', 'students', name),
        { aiMark: { ...result, markedAt: Date.now() } },
        { merge: true }
      );
      setAiResults((prev) => ({ ...prev, [name]: result }));
    } catch (e) {
      console.error('AI mark error:', e);
      setAiError(`Error marking ${name}: ${e.message}`);
    } finally {
      setMarking((prev) => { const s = new Set(prev); s.delete(name); return s; });
    }
  };

  // ── Mark all students who have completed phase 5 ──────────────────────
  const markAll = async () => {
    if (!GEMINI_KEY || GEMINI_KEY === 'your_key_here') {
      setAiError('No Gemini API key set. Add VITE_GEMINI_KEY to your .env file.');
      return;
    }
    if (!rubric.trim()) { setAiError('Paste your rubric first.'); return; }
    setAiError('');
    setMarkAllLoading(true);
    const targets = Object.keys(students).filter((n) => students[n]?.phase5?.submitted);
    for (const name of targets) {
      await markStudent(name);
    }
    setMarkAllLoading(false);
  };

  // ── Wipe all test data ──────────────────────────────────────────────────
  const wipeData = async () => {
    setWiping(true);
    try {
      const cols = [studentsCol, galleryCol, responsesCol];
      for (const col of cols) {
        const snap = await getDocs(col);
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        if (snap.docs.length > 0) await batch.commit();
      }
    } catch (e) {
      console.error('Wipe error:', e);
    } finally {
      setWiping(false);
      setWipeConfirm(false);
    }
  };



  // ── Flag check helper ───────────────────────────────────────────────────
  const hasFlags = (data) => {
    const phases = ['phase2', 'phase3', 'phase4', 'phase5'];
    return phases.some((ph) => {
      const flags = data?.[ph]?.flags;
      if (!flags) return false;
      return Object.values(flags).some((f) => f.injectionFlag || f.velocityFlag);
    });
  };

  // ── Student list ────────────────────────────────────────────────────────
  const studentNames = Object.keys(students).sort();

  // ── Tab styles ──────────────────────────────────────────────────────────
  const tabClass = (t) => [
    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
    tab === t
      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
      : 'text-white/40 hover:text-white/70',
  ].join(' ');

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-transparent px-4 py-8">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(26,18,0,0.5)_0%,transparent_65%)] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
            <p className="text-white/30 text-sm">Blood Minerals — Take a Stand</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/50 text-xs">Live</span>
              <span className="text-white/30 text-xs mx-1">·</span>
              <span className="text-white/50 text-xs">{studentNames.length} student{studentNames.length !== 1 ? 's' : ''}</span>
            </div>
            {/* Wipe data */}
            {!wipeConfirm ? (
              <button
                id="wipe-btn"
                onClick={() => setWipeConfirm(true)}
                className="px-3 py-2 rounded-xl border border-red-500/20 text-red-400/60 text-xs hover:border-red-500/40 hover:text-red-400 transition-colors"
              >
                Wipe data
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Are you sure?</span>
                <button
                  onClick={wipeData}
                  disabled={wiping}
                  className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {wiping ? 'Wiping…' : 'Yes, wipe'}
                </button>
                <button
                  onClick={() => setWipeConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/8 text-white/50 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button id="tab-progress"    className={tabClass('progress')}    onClick={() => setTab('progress')}>Student Progress</button>
          <button id="tab-gallery"     className={tabClass('gallery')}     onClick={() => setTab('gallery')}>Gallery ({gallery.length})</button>
          <button id="tab-responses"   className={tabClass('responses')}   onClick={() => setTab('responses')}>Responses ({responses.length})</button>
          <button id="tab-reflections" className={tabClass('reflections')} onClick={() => setTab('reflections')}>Reflections</button>
          <button id="tab-ai-mark"     className={tabClass('ai-mark')}     onClick={() => setTab('ai-mark')}>
            ✦ AI Mark
          </button>
        </div>

        {/* ── Student Progress Table ───────────────────────────────────────── */}
        {tab === 'progress' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
            {studentNames.length === 0 ? (
              <div className="py-16 text-center text-white/25 text-sm">
                No students yet — they will appear here as they join.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      {['Student', 'P1 Sources Read', 'P2 Submitted', 'P3 Position', 'P4 Responded', 'P5 Submitted', 'Flags'].map((h) => (
                        <th key={h} className="text-left text-xs text-white/30 font-semibold uppercase tracking-wider px-5 py-4">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentNames.map((name, i) => {
                      const d      = students[name] ?? {};
                      const p1Read = d.phase1?.readIds?.length ?? 0;
                      const p2Done = d.phase2?.submitted ? '✓' : '—';
                      const p3Pos  = d.phase3?.position ?? '—';
                      const p4Done = d.phase4?.submitted ? '✓' : '—';
                      const p5Done = d.phase5?.submitted ? '✓' : '—';
                      const flagged = hasFlags(d);

                      return (
                        <tr
                          key={name}
                          className={[
                            'border-b border-white/5 last:border-0 transition-colors',
                            i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]',
                            'hover:bg-white/[0.04]',
                          ].join(' ')}
                        >
                          <td className="px-5 py-3.5 font-medium text-white">{name}</td>
                          <td className="px-5 py-3.5 text-white/60">{p1Read} / 6</td>
                          <td className="px-5 py-3.5">
                            <span className={p2Done === '✓' ? 'text-emerald-400' : 'text-white/25'}>{p2Done}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {p3Pos !== '—' ? (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${BADGE[p3Pos] ?? 'text-white/40'}`}>
                                {p3Pos}
                              </span>
                            ) : (
                              <span className="text-white/25">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={p4Done === '✓' ? 'text-emerald-400' : 'text-white/25'}>{p4Done}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={p5Done === '✓' ? 'text-emerald-400' : 'text-white/25'}>{p5Done}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {flagged ? (
                              <button
                                id={`flag-btn-${name.replace(/\s/g, '-')}`}
                                onClick={() => setFlagModal({ student: name, data: d })}
                                className="text-lg hover:scale-110 transition-transform"
                                title="View flag details"
                              >
                                🚩
                              </button>
                            ) : (
                              <span className="text-white/15 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Gallery Tab ──────────────────────────────────────────────────── */}
        {tab === 'gallery' && (
          <div>
            {gallery.length === 0 ? (
              <div className="py-16 text-center text-white/25 text-sm bg-white/[0.02] border border-white/8 rounded-2xl">
                No positions submitted yet.
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                {gallery.map((entry) => (
                  <div
                    key={entry.id}
                    className="break-inside-avoid bg-white/[0.03] border border-white/8 rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-sm font-semibold text-white">
                        {entry.studentName ?? entry.id}
                      </span>
                      {entry.position && (
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${BADGE[entry.position] ?? ''}`}>
                          {entry.position}
                        </span>
                      )}
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{entry.defence}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Responses Tab ────────────────────────────────────────────────── */}
        {tab === 'responses' && (
          <div className="space-y-3">
            {responses.length === 0 ? (
              <div className="py-16 text-center text-white/25 text-sm bg-white/[0.02] border border-white/8 rounded-2xl">
                No responses submitted yet.
              </div>
            ) : (
              responses.map((r) => (
                <div
                  key={r.id}
                  className="bg-white/[0.03] border border-white/8 rounded-xl p-5"
                >
                  <p className="text-xs text-white/35 mb-2 font-medium">{r.from}</p>
                  <p className="text-white/70 text-sm leading-relaxed">{r.response}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Reflections Tab ──────────────────────────────────────────────── */}
        {tab === 'reflections' && (
          <div className="space-y-4">
            {studentNames.filter((n) => students[n]?.phase5?.answers).length === 0 ? (
              <div className="py-16 text-center text-white/25 text-sm bg-white/[0.02] border border-white/8 rounded-2xl">
                No reflections submitted yet.
              </div>
            ) : (
              studentNames
                .filter((n) => students[n]?.phase5?.answers)
                .map((name) => {
                  const answers = students[name].phase5.answers;
                  return (
                    <div
                      key={name}
                      className="bg-white/[0.03] border border-white/8 rounded-2xl p-6"
                    >
                      <p className="text-sm font-semibold text-white mb-4">{name}</p>
                      <div className="space-y-4">
                        {['q1', 'q2', 'q3'].map((q, idx) => (
                          answers[q] && (
                            <div key={q}>
                              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">
                                Question {idx + 1}
                              </p>
                              <p className="text-white/65 text-sm leading-relaxed">{answers[q]}</p>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}

        {/* ── AI Mark Tab ──────────────────────────────────────────────────── */}
        {tab === 'ai-mark' && (
          <div className="space-y-6">

            {/* Rubric editor */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white/80">Rubric</p>
                <span className="text-xs text-white/25">Saved automatically to this browser</span>
              </div>
              <textarea
                id="ai-rubric-input"
                value={rubric}
                onChange={(e) => saveRubric(e.target.value)}
                rows={8}
                placeholder="Paste your rubric here in plain text — e.g. criteria names, point values, and what each level looks like. The AI will interpret it."
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/40 placeholder:text-white/20"
              />
            </div>

            {/* Error banner */}
            {aiError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {aiError}
              </div>
            )}

            {/* Mark All button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/30">
                {Object.keys(students).filter((n) => students[n]?.phase5?.submitted).length} student{Object.keys(students).filter((n) => students[n]?.phase5?.submitted).length !== 1 ? 's' : ''} with Phase 5 complete
              </p>
              <button
                id="ai-mark-all-btn"
                onClick={markAll}
                disabled={markAllLoading || !rubric.trim()}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200',
                  markAllLoading || !rubric.trim()
                    ? 'bg-white/5 text-white/25 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20 hover:-translate-y-0.5',
                ].join(' ')}
              >
                {markAllLoading ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Marking all…</>
                ) : (
                  <>✦ Mark All Students</>
                )}
              </button>
            </div>

            {/* Results table */}
            {Object.keys(students).length === 0 ? (
              <div className="py-16 text-center text-white/25 text-sm bg-white/[0.02] border border-white/8 rounded-2xl">
                No students yet.
              </div>
            ) : (
              <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        {['Student', 'Overall', 'P3 — Stand', 'P4 — Challenge', 'P5 — Reflection', 'Comment', ''].map((h) => (
                          <th key={h} className="text-left text-xs text-white/30 font-semibold uppercase tracking-wider px-4 py-4 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(students).sort().map((name, i) => {
                        const d = students[name] ?? {};
                        const res = aiResults[name] ?? d.aiMark ?? null;
                        const isMarking = marking.has(name);
                        const canMark = !!d.phase3?.submitted;
                        return (
                          <tr
                            key={name}
                            className={[
                              'border-b border-white/5 last:border-0 align-top',
                              i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]',
                            ].join(' ')}
                          >
                            <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{name}</td>
                            <td className="px-4 py-3">
                              {res ? (
                                <span className="text-amber-400 font-mono font-bold text-xs">{res.overall}</span>
                              ) : <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              <p className="text-white/55 text-xs leading-relaxed">{res?.phase3 ?? <span className="text-white/20">—</span>}</p>
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              <p className="text-white/55 text-xs leading-relaxed">{res?.phase4 ?? <span className="text-white/20">—</span>}</p>
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              <p className="text-white/55 text-xs leading-relaxed">{res?.phase5 ?? <span className="text-white/20">—</span>}</p>
                            </td>
                            <td className="px-4 py-3 max-w-[220px]">
                              <p className="text-white/65 text-xs leading-relaxed italic">{res?.comment ?? <span className="text-white/20">—</span>}</p>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                id={`ai-mark-btn-${name.replace(/\s/g, '-')}`}
                                onClick={() => markStudent(name)}
                                disabled={isMarking || !canMark || !rubric.trim()}
                                className={[
                                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                                  isMarking
                                    ? 'bg-amber-500/10 text-amber-400/50'
                                    : canMark && rubric.trim()
                                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                                      : 'bg-white/5 text-white/20 cursor-not-allowed',
                                ].join(' ')}
                              >
                                {isMarking ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full border border-amber-400/40 border-t-amber-400 animate-spin" />
                                    Marking…
                                  </span>
                                ) : res ? '↺ Re-mark' : '✦ Mark'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Flag modal */}
      {flagModal && (
        <FlagModal
          student={flagModal.student}
          data={flagModal.data}
          onClose={() => setFlagModal(null)}
        />
      )}
    </div>
  );
}

// ─── Export: password-gated entry ────────────────────────────────────────────
export default function Teacher() {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <Dashboard />;
}
