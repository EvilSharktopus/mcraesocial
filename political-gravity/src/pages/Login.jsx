// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

// ── Policy text ───────────────────────────────────────────────────────────────

const TERMS_CONTENT = `
## Terms of Use

**Political Gravity** is a classroom learning tool operated by Adam McRae, a teacher at Springbank Community High School, Rocky View School Division No. 41.

### Authorized Users
Access is restricted to students currently enrolled in Mr. McRae's Social Studies 30 class and to Mr. McRae in his instructional capacity.

### Authentication
Sign-in requires a valid email address.

### Acceptable Use
By signing in, you agree to:
- Use this application only for submitting genuine, original academic work.
- Not attempt to access or alter another student's submissions or positions.
- Engage respectfully in seminar and backchannel features.

### Academic Integrity
Students are expected to complete all written justifications and reflections themselves, in accordance with Rocky View Schools' Academic Integrity Policy.

### No Guarantee of Availability
This application is provided as a convenience tool. Mr. McRae is not liable for data loss due to technical failure. Students are encouraged to retain copies of completed work.

### Parental Consent
Student access to this application must be supported by written consent from a parent or guardian.

_Last updated: May 2026_
`;

const PRIVACY_CONTENT = `
## Privacy Policy

**Operator:** Adam McRae — Springbank Community High School, Rocky View Schools
**Data location:** Toronto, Canada (northamerica-northeast2)

### Information Collected
When you sign in and use this application, the following is collected and stored:

| Data | Purpose |
|---|---|
| Full name | Identify you in submissions and seminar views |
| Email address | Authenticate you; link work to your account |
| Political compass plots | Record your reading positions |
| Justifications and reflections | Record your written responses |
| Seminar comments | Support live backchannel discussion |
| Submission timestamps | Track when work was saved and submitted |

This application does not collect passwords, phone numbers, home addresses, photos, microphone or camera data, or location data.

### Who Can See Your Data
Your work is visible only to you and Mr. McRae, except during seminar view where all student plots are revealed simultaneously as part of the activity.

### Third-Party Services
| Service | Provider | Data location |
|---|---|---|
| Firebase Auth / Firestore | Google LLC | Canada (Toronto) |
| Vercel | Vercel Inc. | Global CDN |

All student data is stored in Canada.

### Data Retention
Data is retained for the current school year and may be archived by Mr. McRae. You may request access to or deletion of your data by emailing amcrae@rvschools.ab.ca.

### POPA Rights (Alberta)
Under Alberta's Protection of Privacy Act (POPA), you have the right to request access to or correction of your information. Contact Mr. McRae or Rocky View Schools' Privacy Officer (403-945-4000).

_Last updated: May 2026_
`;

// ── Policy Modal ──────────────────────────────────────────────────────────────

function PolicyModal({ title, content, onClose }) {
  const lines = content.trim().split('\n');
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--pg-border)' }}>
          <h2 className="font-display font-bold" style={{ color: 'var(--pg-text)' }}>{title}</h2>
          <button onClick={onClose} className="text-xl leading-none transition-opacity opacity-50 hover:opacity-100" style={{ color: 'var(--pg-text)' }}>✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-4 text-sm space-y-2" style={{ color: 'var(--pg-muted)' }}>
          {lines.map((line, i) => {
            if (line.startsWith('## '))  return <h2 key={i} className="font-display text-lg font-bold mt-2" style={{ color: 'var(--pg-text)' }}>{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="font-semibold mt-3" style={{ color: 'var(--pg-primary)' }}>{line.slice(4)}</h3>;
            if (line.startsWith('| ') || line.startsWith('|---')) return null;
            if (line.startsWith('_'))    return <p key={i} className="text-xs italic mt-2" style={{ color: 'var(--pg-dim)' }}>{line.replace(/_/g, '')}</p>;
            if (line.trim() === '')     return null;
            if (line.startsWith('- '))  return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
            const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--pg-muted)' }}>{label}</label>
      <input
        {...props}
        className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
        style={{
          backgroundColor: 'var(--pg-surface2)',
          border: '1px solid var(--pg-border)',
          color: 'var(--pg-text)',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--pg-primary)'}
        onBlur={e  => e.target.style.borderColor = 'var(--pg-border)'}
      />
    </div>
  );
}

// ── Login Page ────────────────────────────────────────────────────────────────

export default function Login() {
  const { signIn, signUp, user, isTeacher } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to={isTeacher ? '/teacher' : '/dashboard'} replace />;

  const [mode,     setMode]     = useState('signin');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [agreed,   setAgreed]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [modal,    setModal]    = useState(null);

  const friendlyError = (code, message) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':       return 'Incorrect email or password.';
      case 'auth/email-already-in-use': return 'An account with that email already exists.';
      case 'auth/weak-password':        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':    return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/unauthorized-domain':  return 'This domain is not yet authorized — contact Mr. McRae.';
      default: return `Error (${code ?? 'unknown'}): ${message ?? 'Please try again.'}`;
    }
  };

  function switchMode(m) {
    setMode(m); setError('');
    setEmail(''); setPassword(''); setName(''); setAgreed(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password, name);
      navigate('/');
    } catch (err) {
      const msg = err.message?.startsWith('Please use')
        ? err.message : friendlyError(err.code, err.message);
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative" style={{ backgroundColor: 'var(--pg-bg)' }}>
      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl">⚖️</span>
            <h1 className="font-display font-bold text-3xl tracking-tight" style={{ color: 'var(--pg-text)' }}>
              Political <span style={{ color: 'var(--pg-primary)' }}>Gravity</span>
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>
            Social Studies 30 &nbsp;·&nbsp; History's ideological orbits
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-7 shadow-lg" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          {/* Mode tabs */}
          <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: 'var(--pg-surface2)' }}>
            {[['signin', 'Sign In'], ['signup', 'Create Account']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={mode === m
                  ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }
                  : { color: 'var(--pg-muted)' }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Field label="Full name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Firstname Lastname" />
            )}
            <Field label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
            <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />

            {mode === 'signup' && (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded" style={{ accentColor: 'var(--pg-primary)' }} />
                <span className="text-xs leading-relaxed" style={{ color: 'var(--pg-dim)' }}>
                  I have read and agree to the{' '}
                  <button type="button" onClick={() => setModal('terms')} className="underline underline-offset-2 transition-opacity hover:opacity-80" style={{ color: 'var(--pg-primary)' }}>Terms of Use</button>
                  {' '}and{' '}
                  <button type="button" onClick={() => setModal('privacy')} className="underline underline-offset-2 transition-opacity hover:opacity-80" style={{ color: 'var(--pg-primary)' }}>Privacy Policy</button>
                  , and confirm parental consent.
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm rounded-xl px-4 py-2.5" style={{ backgroundColor: 'var(--pg-error-bg)', border: '1px solid var(--pg-error-border)', color: 'var(--pg-error)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || (mode === 'signup' && !agreed)}
              className="w-full font-semibold py-2.5 rounded-xl transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Policy links */}
        <div className="flex items-center justify-center gap-3 mt-5 text-xs" style={{ color: 'var(--pg-faint)' }}>
          <button onClick={() => setModal('terms')} className="hover:opacity-80 transition-opacity">Terms of Use</button>
          <span>·</span>
          <button onClick={() => setModal('privacy')} className="hover:opacity-80 transition-opacity">Privacy Policy</button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: 'var(--pg-faint)' }}>
          Same credentials as your Desk account
        </p>
      </div>

      {modal === 'terms'   && <PolicyModal title="Terms of Use"   content={TERMS_CONTENT}   onClose={() => setModal(null)} />}
      {modal === 'privacy' && <PolicyModal title="Privacy Policy" content={PRIVACY_CONTENT} onClose={() => setModal(null)} />}
    </div>
  );
}
