// src/App.jsx
// Root application component — fully student-led, no phase gating.
// Students advance through phases by completing each one.
// Teacher route at /minerals/teacher (progress monitoring only).
//
// Phase resumption: on mount, we do a single Firestore read to derive the
// student's true phase from submitted flags. This means closing/reopening the
// tab always drops students back at the right phase, not Phase 1.

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

import Entry   from './pages/Entry';
import Phase1  from './pages/Phase1';
import Phase2  from './pages/Phase2';
import Phase3  from './pages/Phase3';
import Phase4  from './pages/Phase4';
import Phase5  from './pages/Phase5';
import Done    from './pages/Done';
import Teacher from './pages/Teacher';
import Feed    from './pages/Feed';

const LS_NAME_KEY = 'minerals_student_name';

// Inspect a student's Firestore document and return which phase they should be on.
function derivePhaseFromData(data) {
  if (!data) return 1;
  if (data.phase5?.submitted) return 6; // → Done screen
  if (data.phase4?.submitted) return 5;
  if (data.phase3?.submitted) return 4;
  if (data.phase2?.submitted) return 3;
  if (data.phase1?.submitted) return 2;
  return 1;
}

function StudentApp({ studentName }) {
  const [studentPhase, setStudentPhase] = useState(null);
  const [done, setDone]                 = useState(false);
  const [resolving, setResolving]       = useState(true);

  // ── On mount: reconcile Firestore progress with sessionStorage ─────────────
  useEffect(() => {
    const studentRef = doc(db, 'sessions', 'minerals', 'students', studentName);

    getDoc(studentRef)
      .then((snap) => {
        const firestorePhase = derivePhaseFromData(snap.exists() ? snap.data() : null);
        const sessionRaw     = sessionStorage.getItem('minerals_student_phase');
        const sessionPhase   = sessionRaw ? parseInt(sessionRaw, 10) : 1;
        const sessionDone    = sessionStorage.getItem('minerals_done') === 'true';

        if (sessionDone || firestorePhase > 5) {
          // Student already finished
          setDone(true);
          sessionStorage.setItem('minerals_done', 'true');
        } else {
          // Trust whichever source puts them further ahead
          const resolved = Math.max(firestorePhase, sessionPhase);
          setStudentPhase(resolved);
          sessionStorage.setItem('minerals_student_phase', String(resolved));
        }
      })
      .catch(() => {
        // Network error — fall back to sessionStorage so the app still works
        const saved = sessionStorage.getItem('minerals_student_phase');
        setStudentPhase(saved ? parseInt(saved, 10) : 1);
      })
      .finally(() => setResolving(false));
  }, [studentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = (next) => {
    if (next > 5) {
      setDone(true);
      sessionStorage.setItem('minerals_done', 'true');
    } else {
      setStudentPhase(next);
      sessionStorage.setItem('minerals_student_phase', String(next));
    }
  };

  // ── Loading spinner while we resolve the phase ────────────────────────────
  if (resolving) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    );
  }

  if (done) return <Done studentName={studentName} />;

  switch (studentPhase) {
    case 1: return <Phase1 studentName={studentName} onComplete={() => advance(2)} />;
    case 2: return <Phase2 studentName={studentName} onComplete={() => advance(3)} />;
    case 3: return <Phase3 studentName={studentName} onComplete={() => advance(4)} />;
    case 4: return <Phase4 studentName={studentName} onComplete={() => advance(5)} />;
    case 5: return <Phase5 studentName={studentName} onComplete={() => advance(6)} />;
    default: return <Done studentName={studentName} />;
  }
}

export default function App() {
  const [studentName, setStudentName] = useState(() => {
    return localStorage.getItem(LS_NAME_KEY) ?? null;
  });

  return (
    <BrowserRouter basename="/minerals">
      <Routes>
        <Route path="/teacher" element={<Teacher />} />
        <Route path="/feed" element={<Feed />} />
        <Route
          path="/*"
          element={
            !studentName
              ? <Entry onEnter={setStudentName} />
              : <StudentApp studentName={studentName} />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
