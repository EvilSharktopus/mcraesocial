// src/App.jsx
// Root application component.
// Handles:
//   - Student name gate (localStorage → Entry screen)
//   - Phase gate logic (useSession → blocks access beyond teacher-unlocked phase)
//   - React Router v6 with basename="/minerals"
//   - Teacher route at /minerals/teacher (no phase gate)
//
// Student phase progression is LOCAL — the student's "furthest reached" phase
// is stored in component state and capped by the teacher's current open phase.
// Students who have completed a phase see it as "done" if the teacher moves back.

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from './hooks/useSession';

import Entry   from './pages/Entry';
import Phase1  from './pages/Phase1';
import Phase2  from './pages/Phase2';
import Phase3  from './pages/Phase3';
import Phase4  from './pages/Phase4';
import Phase5  from './pages/Phase5';
import Done    from './pages/Done';
import Teacher from './pages/Teacher';

const LS_NAME_KEY = 'minerals_student_name';

// ─── Phase gate wrapper ───────────────────────────────────────────────────────
// Reads teacher's current open phase from Firestore.
// studentPhase = how far the student has personally progressed.
// Students can only see phases ≤ teacherPhase AND ≤ studentPhase + 1.

function StudentApp({ studentName, onClearName }) {
  const { phase: teacherPhase, loading, error } = useSession();

  // The highest phase the student has "unlocked" locally this session.
  // Initialise from sessionStorage so refreshes don't reset it.
  const [studentPhase, setStudentPhase] = useState(() => {
    const saved = sessionStorage.getItem('minerals_student_phase');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Track if Phase 5 has been submitted (to show Done screen)
  const [done, setDone] = useState(() => {
    return sessionStorage.getItem('minerals_done') === 'true';
  });

  // Cap to teacher's phase whenever it changes
  const effectivePhase = Math.min(studentPhase, teacherPhase ?? 1);

  const advancePhase = (next) => {
    const newPhase = Math.min(next, teacherPhase ?? 1);
    setStudentPhase(newPhase);
    sessionStorage.setItem('minerals_student_phase', String(newPhase));
  };

  const handlePhaseComplete = (completedPhase) => {
    if (completedPhase === 5) {
      setDone(true);
      sessionStorage.setItem('minerals_done', 'true');
    } else {
      advancePhase(completedPhase + 1);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
      </div>
    );
  }

  // ── Firestore error ───────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-white/8 text-white/60 text-sm hover:bg-white/12 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (done) {
    return <Done studentName={studentName} />;
  }

  // ── Waiting screen (teacher hasn't opened any phase yet edge-case) ────────
  if (!teacherPhase) {
    return <WaitingScreen />;
  }

  // ── Phase gate: render the correct phase ──────────────────────────────────
  // Show the phase the student is currently on, but never beyond teacher's open phase.
  const displayPhase = effectivePhase;

  switch (displayPhase) {
    case 1:
      return (
        <Phase1
          studentName={studentName}
          onComplete={() => {
            // Phase 1 "complete" just means they can proceed — teacher must open Phase 2
            if ((teacherPhase ?? 1) >= 2) {
              advancePhase(2);
            } else {
              advancePhase(2); // student advances locally; gate will block if teacher < 2
            }
          }}
        />
      );

    case 2:
      return teacherPhase >= 2
        ? <Phase2 studentName={studentName} onComplete={() => handlePhaseComplete(2)} />
        : <WaitingScreen phase={1} teacherPhase={teacherPhase} />;

    case 3:
      return teacherPhase >= 3
        ? <Phase3 studentName={studentName} onComplete={() => handlePhaseComplete(3)} />
        : <WaitingScreen phase={2} teacherPhase={teacherPhase} />;

    case 4:
      return teacherPhase >= 4
        ? <Phase4 studentName={studentName} onComplete={() => handlePhaseComplete(4)} />
        : <WaitingScreen phase={3} teacherPhase={teacherPhase} />;

    case 5:
      return teacherPhase >= 5
        ? <Phase5 studentName={studentName} onComplete={() => handlePhaseComplete(5)} />
        : <WaitingScreen phase={4} teacherPhase={teacherPhase} />;

    default:
      return <WaitingScreen />;
  }
}

// ─── Waiting screen ───────────────────────────────────────────────────────────
function WaitingScreen({ phase, teacherPhase } = {}) {
  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0d0f_70%)] pointer-events-none" />
      <div className="relative z-10 text-center max-w-sm">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-400 animate-pulse" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Waiting for your teacher</h2>
        <p className="text-white/40 text-sm leading-relaxed">
          {teacherPhase && phase
            ? `Your teacher hasn't opened Phase ${phase + 1} yet. Sit tight — this page will update automatically.`
            : 'Your teacher will open the next phase shortly. This page will update automatically.'}
        </p>
        <div className="mt-6 flex justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-amber-500/40 animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root with router ─────────────────────────────────────────────────────────
export default function App() {
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem(LS_NAME_KEY) ?? null;
  });

  const handleEnter = (name) => {
    setStudentName(name);
  };

  return (
    <BrowserRouter basename="/minerals">
      <Routes>
        {/* Teacher dashboard — no phase gate, no name gate */}
        <Route path="/teacher" element={<Teacher />} />

        {/* Student flow */}
        <Route
          path="/*"
          element={
            !studentName
              ? <Entry onEnter={handleEnter} />
              : <StudentApp studentName={studentName} onClearName={() => setStudentName(null)} />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
