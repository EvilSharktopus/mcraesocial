// src/components/LegacyNotice.jsx
//
// Shown to an old email account after the switch to student codes. The
// account still exists (other apps on the project may use it), but
// Political Gravity, like Desk, only accepts codes now.
import { useAuth } from '../auth/AuthContext';

export default function LegacyNotice() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <div className="w-full max-w-sm rounded-2xl p-7 shadow-lg text-center" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
        <div className="text-3xl mb-2">⚖️</div>
        <h1 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--pg-text)' }}>Political Gravity now uses student codes</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--pg-muted)' }}>
          Sign in with the code and password Mr. McRae gave you for Desk. Your positions, reflections and study package came across with it.
        </p>
        <button
          onClick={signOut}
          className="w-full font-semibold py-2.5 rounded-xl"
          style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
        >
          Sign in with my code
        </button>
      </div>
    </div>
  );
}
