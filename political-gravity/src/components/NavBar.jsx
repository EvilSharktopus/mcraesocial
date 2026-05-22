// src/components/NavBar.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function NavBar({ backTo, backLabel, extra }) {
  const { user, isTeacher, signOut } = useAuth();

  return (
    <header
      className="shrink-0 border-b px-5 py-3 flex items-center justify-between gap-4"
      style={{
        borderColor: 'var(--pg-border)',
        backgroundColor: 'var(--pg-surface)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {backTo ? (
          <Link
            to={backTo}
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--pg-muted)' }}
            onMouseEnter={e => e.target.style.color = 'var(--pg-text)'}
            onMouseLeave={e => e.target.style.color = 'var(--pg-muted)'}
          >
            ← {backLabel ?? 'Back'}
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/images/icon.jfif" alt="Political Gravity Icon" className="w-6 h-6 rounded-md object-cover" />
            <span
              className="font-display font-bold text-base tracking-tight"
              style={{ color: 'var(--pg-text)' }}
            >
              Political Gravity
            </span>
          </Link>
        )}
        {isTeacher && !backTo && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: 'var(--pg-primary)',
              color: 'var(--pg-on-primary)',
            }}
          >
            Teacher
          </span>
        )}
        {extra}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 shrink-0">
        <ThemeToggle />
        {user && (
          <>
            <span
              className="text-xs hidden sm:block truncate max-w-[160px]"
              style={{ color: 'var(--pg-dim)' }}
            >
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="text-xs font-medium transition-colors px-2 py-1 rounded"
              style={{ color: 'var(--pg-muted)' }}
              onMouseEnter={e => e.target.style.color = 'var(--pg-text)'}
              onMouseLeave={e => e.target.style.color = 'var(--pg-muted)'}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
