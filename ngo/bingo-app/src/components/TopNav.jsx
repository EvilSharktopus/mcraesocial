// src/components/TopNav.jsx
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';

export default function TopNav({ showTeacherLink = false }) {
  const { user, isTeacher, signOut } = useAuth();

  return (
    <nav className="top-nav">
      <Link to="/" className="nav-logo" id="nav-logo">
        <span className="bi">bi</span><span className="ngo">NGO</span>
      </Link>

      <div className="nav-user">
        {isTeacher && (
          <Link to="/teacher" className="btn btn-sm btn-ghost" id="nav-teacher-link">
            Dashboard
          </Link>
        )}
        <span>{user?.displayName || user?.email}</span>
        <button
          className="btn btn-sm btn-ghost"
          onClick={signOut}
          id="nav-signout-btn"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
