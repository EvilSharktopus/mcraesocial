// src/pages/Teacher.jsx
// Teacher Dashboard — route: /minerals/teacher
// Password gate: "teacher101" — stored in component state ONLY, never Firestore.
// Features:
//   - Phase control panel (5 buttons, live highlight, backwards warning)
//   - Live student progress table (onSnapshot, flags column with modal)
//   - Tabs: Gallery | Responses | Reflections

import { useState, useEffect } from 'react';
import {
  doc, setDoc, collection,
  onSnapshot, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

const TEACHER_PASSWORD = 'teacher101';

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
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-4">
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
function Dashboard() {
  const [currentPhase, setCurrentPhase] = useState(null);
  const [students, setStudents]         = useState({}); // { name: data }
  const [gallery, setGallery]           = useState([]);
  const [responses, setResponses]       = useState([]);
  const [tab, setTab]                   = useState('progress'); // 'progress' | 'gallery' | 'responses' | 'reflections'
  const [flagModal, setFlagModal]       = useState(null); // { student, data }
  const [phaseWarning, setPhaseWarning] = useState(null);
  const [settingPhase, setSettingPhase] = useState(false);

  const sessionRef  = doc(db, 'sessions', 'minerals');
  const studentsCol = collection(db, 'sessions', 'minerals', 'students');
  const galleryCol  = collection(db, 'sessions', 'minerals', 'gallery');
  const responsesCol = collection(db, 'sessions', 'minerals', 'responses');

  // ── Live listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubSession = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) setCurrentPhase(snap.data().phase ?? 1);
      else setCurrentPhase(1);
    });

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

    return () => {
      unsubSession();
      unsubStudents();
      unsubGallery();
      unsubResponses();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase control ───────────────────────────────────────────────────────
  const setPhase = async (n) => {
    if (n < currentPhase) {
      setPhaseWarning(n);
      return;
    }
    await commitPhase(n);
  };

  const commitPhase = async (n) => {
    setSettingPhase(true);
    try {
      await setDoc(sessionRef, { phase: n }, { merge: true });
    } catch (e) {
      console.error('Phase set error:', e);
    } finally {
      setSettingPhase(false);
      setPhaseWarning(null);
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
    <div className="min-h-screen bg-[#0d0d0f] px-4 py-8">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0d0f_65%)] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Teacher Dashboard</h1>
            <p className="text-white/30 text-sm">Blood Minerals — Take a Stand</p>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/50 text-xs">Live</span>
            <span className="text-white/30 text-xs mx-1">·</span>
            <span className="text-white/50 text-xs">{studentNames.length} student{studentNames.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* ── Phase control panel ──────────────────────────────────────────── */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
          <p className="text-xs text-white/40 uppercase tracking-widest font-semibold mb-4">
            Active Phase
          </p>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                id={`set-phase-${n}`}
                onClick={() => setPhase(n)}
                disabled={settingPhase}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl border font-semibold text-sm transition-all duration-200',
                  currentPhase === n
                    ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/80',
                ].join(' ')}
              >
                Phase {n}
                {currentPhase === n && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black/40" />
                )}
              </button>
            ))}
          </div>
          {currentPhase && (
            <p className="mt-3 text-xs text-white/25">
              Phase {currentPhase} is currently open for students
            </p>
          )}
        </div>

        {/* Backwards phase warning */}
        {phaseWarning !== null && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 mb-6">
            <p className="text-orange-300 text-sm font-medium mb-3">
              ⚠ You are about to go backwards to Phase {phaseWarning}. Students who have progressed further will be locked back. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => commitPhase(phaseWarning)}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black text-sm font-semibold transition-colors"
              >
                Yes, set Phase {phaseWarning}
              </button>
              <button
                onClick={() => setPhaseWarning(null)}
                className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/12 text-white/60 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button id="tab-progress"    className={tabClass('progress')}    onClick={() => setTab('progress')}>Student Progress</button>
          <button id="tab-gallery"     className={tabClass('gallery')}     onClick={() => setTab('gallery')}>Gallery ({gallery.length})</button>
          <button id="tab-responses"   className={tabClass('responses')}   onClick={() => setTab('responses')}>Responses ({responses.length})</button>
          <button id="tab-reflections" className={tabClass('reflections')} onClick={() => setTab('reflections')}>Reflections</button>
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
