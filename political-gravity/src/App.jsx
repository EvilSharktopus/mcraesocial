// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Reading      from './pages/Reading';
import Seminar      from './pages/Seminar';
import Reflect      from './pages/Reflect';
import Teacher      from './pages/Teacher';
import StudyPackage from './pages/StudyPackage';

function RootRedirect() {
  const { user, isTeacher } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--pg-bg)' }}>
        <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--pg-border2)', borderTopColor: 'transparent' }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isTeacher ? '/teacher' : '/dashboard'} replace />;
}

export default function App() {
  const basename = window.location.pathname.startsWith('/gravity') ? '/gravity' : '';

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter basename={basename}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<RootRedirect />} />
              <Route path="/dashboard"     element={<ProtectedRoute role="student"><Dashboard /></ProtectedRoute>} />
              <Route path="/reading/:id"   element={<ProtectedRoute role="student"><Reading /></ProtectedRoute>} />
              <Route path="/reflect/:id"   element={<ProtectedRoute role="student"><Reflect /></ProtectedRoute>} />
              <Route path="/study-package" element={<ProtectedRoute role="student"><StudyPackage /></ProtectedRoute>} />
              <Route path="/teacher"       element={<ProtectedRoute role="teacher"><Teacher /></ProtectedRoute>} />
              <Route path="/seminar/:id"   element={<ProtectedRoute><Seminar /></ProtectedRoute>} />
              <Route path="*"              element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
