// src/auth/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, isTeacher } = useAuth();

  if (user === undefined || (user && isTeacher === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--pg-bg)' }}>
        <div
          className="w-8 h-8 rounded-full border-4 animate-spin"
          style={{ borderColor: 'var(--pg-border2)', borderTopColor: 'var(--pg-primary)' }}
        />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (role === 'teacher' && !isTeacher) return <Navigate to="/dashboard" replace />;
  if (role === 'student' && isTeacher)  return <Navigate to="/teacher"   replace />;

  return children;
}
