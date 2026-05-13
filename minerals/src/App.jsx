// src/App.jsx
// Root application component — fully student-led, no phase gating.
// Students advance through phases by completing each one.
// Teacher route at /minerals/teacher (progress monitoring only).

import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

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

function StudentApp({ studentName }) {
  const [studentPhase, setStudentPhase] = useState(() => {
    const saved = sessionStorage.getItem('minerals_student_phase');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [done, setDone] = useState(() => {
    return sessionStorage.getItem('minerals_done') === 'true';
  });

  const advance = (next) => {
    if (next > 5) {
      setDone(true);
      sessionStorage.setItem('minerals_done', 'true');
    } else {
      setStudentPhase(next);
      sessionStorage.setItem('minerals_student_phase', String(next));
    }
  };

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
