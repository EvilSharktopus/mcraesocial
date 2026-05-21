// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }      from './auth/AuthContext';
import { useNgoSettings }             from './hooks/useNgoSettings';
import LoginPage                      from './auth/LoginPage';
import PhaseGate                      from './pages/PhaseGate';
import StudentHome                    from './pages/StudentHome';
import GroupWorksite                  from './pages/GroupWorksite';
import TeacherDashboard               from './pages/TeacherDashboard';
import FundingBoard                   from './pages/FundingBoard';
import Phase2Scorecard                from './pages/Phase2Scorecard';
import Phase3Funding                  from './pages/Phase3Funding';
import PhaseReflection                from './pages/PhaseReflection';

// ── Inner router — needs auth + settings context ───────────────────────────
function AppRoutes() {
  const { user, isTeacher } = useAuth();
  const { settings, loading: settingsLoading } = useNgoSettings();

  // Auth loading
  if (user === undefined || settingsLoading) {
    return <div className="loading-screen"><span className="spinner" /></div>;
  }

  // Not signed in
  if (!user) return <LoginPage />;

  // Teacher routes
  if (isTeacher) {
    return (
      <Routes>
        <Route path="/teacher"        element={<TeacherDashboard />} />
        <Route path="/funding-board"  element={<FundingBoard />} />
        <Route path="/group/:groupId" element={<GroupWorksite />} />
        <Route path="*"               element={<Navigate to="/teacher" replace />} />
      </Routes>
    );
  }

  // Student — phase-gated
  const phase = settings?.currentPhase ?? 0;

  // Determine student landing by phase
  const studentLanding = () => {
    if (phase === 0) return <PhaseGate />;
    if (phase === 1) return <StudentHome />;
    if (phase === 2) return <Phase2Scorecard />;
    if (phase === 3) return <Phase3Funding />;
    if (phase === 4) return <Phase3Funding />; // results shown in Phase3Funding post-lock
    if (phase >= 5) return <PhaseReflection />;
    return <PhaseGate />;
  };

  return (
    <Routes>
      <Route path="/funding-board"  element={<FundingBoard />} />
      <Route path="/group/:groupId" element={
        phase === 1 ? <GroupWorksite /> : <Navigate to="/" replace />
      } />
      <Route path="/"               element={studentLanding()} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/ngo">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
