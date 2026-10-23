// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import { HANDOUT_URL } from '../data/readings';

// ── Policy text ───────────────────────────────────────────────────────────────

const TERMS_CONTENT = `
## Terms of Use

**Political Gravity** is a classroom learning tool operated by Adam McRae, a teacher at Springbank Community High School, Rocky View School Division No. 41.

### Authorized Users
Access is restricted to students currently enrolled in Mr. McRae's Social Studies 30 class and to Mr. McRae in his instructional capacity.

### Authentication
Students sign in with a student code issued by Mr. McRae and a password, the same ones used for Desk. No email address is required or stored for students.

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
| First name | Identify you to Mr. McRae and, in seminar view, to classmates |
| Student code | Sign you in; link work to your account. It is not an email address and is never sent anywhere. |
| Political compass plots | Record your reading positions |
| Justifications and reflections | Record your written responses |
| Seminar comments | Support live backchannel discussion |
| Submission timestamps | Track when work was saved and submitted |

This application does not collect passwords, phone numbers, home addresses, photos, microphone or camera data, or location data.

### Who Can See Your Data
Your work is visible only to you and Mr. McRae, except during seminar view where all student plots are revealed simultaneously, by first name, as part of the activity. Your full name is kept only in Mr. McRae's private class roster.

### Third-Party Services
| Service | Provider | Data location |
|---|---|---|
| Firebase Auth / Firestore | Google LLC | Canada (Toronto) |
| Vercel | Vercel Inc. | Global CDN |

All student data is stored in Canada.

### Data Retention
Data is retained for the current school year and may be archived by Mr. McRae. You may request access to or deletion of your data by asking Mr. McRae.

### POPA Rights (Alberta)
Under Alberta's Protection of Privacy Act (POPA), you have the right to request access to or correction of your information. Contact Mr. McRae or Rocky View Schools' Privacy Officer (403-945-4000).

_Last updated: October 2026_
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
//
// Students sign in with the code and password Mr. McRae gave them for Desk.
// There is no sign-up here (accounts are made on Desk's Roster tab) and no
// student password reset (the teacher does it from the same tab). The
// teacher signs in with an email address behind the small link below.

export default function Login() {
  const { signIn, signInWithCode, resetPassword, user, isTeacher, isLegacyStudent } = useAuth();
  const navigate = useNavigate();

  const [who,      setWho]      = useState('student');   // 'student' | 'teacher'
  const [code,     setCode]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [notice,   setNotice]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [resetting, setResetting] = useState(false);
  const [modal,    setModal]    = useState(null);

  // Must come after every hook above: returning earlier changes the number of
  // hooks between renders once auth resolves, which unmounts the whole app.
  // Wait for the role before redirecting, or a teacher lands on the student
  // dashboard for a moment first. A legacy email account goes to the root,
  // which shows it the notice.
  if (user && (isTeacher !== undefined || isLegacyStudent)) {
    return <Navigate to={isLegacyStudent ? '/' : isTeacher ? '/teacher' : '/dashboard'} replace />;
  }

  const friendlyError = (err) => {
    switch (err?.code) {
      case 'pg/bad-code':               return err.message;
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':       return who === 'student' ? 'That code and password do not match. Check the sheet, or ask Mr. McRae to reset your password.' : 'Incorrect email or password.';
      case 'auth/invalid-email':        return who === 'student' ? 'That does not look like a student code.' : 'Please enter a valid email address.';
      case 'auth/too-many-requests':    return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/unauthorized-domain':  return 'This domain is not yet authorized — contact Mr. McRae.';
      default: return `Error (${err?.code ?? 'unknown'}): ${err?.message ?? 'Please try again.'}`;
    }
  };

  function switchWho(w) {
    setWho(w); setError(''); setNotice('');
    setCode(''); setEmail(''); setPassword('');
  }

  async function handleForgot() {
    setError(''); setNotice('');
    const addr = email.trim();
    if (!addr) { setError('Type your email address above first, then press “Forgot password?” again.'); return; }
    setResetting(true);
    try {
      await resetPassword(addr);
      setNotice(`Reset link sent to ${addr}.`);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setResetting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (who === 'student') await signInWithCode(code, password);
      else await signIn(email, password);
      navigate('/');
      // `loading` stays set on purpose: the profile lookup in AuthContext is
      // still running, and this component unmounts on redirect.
    } catch (err) {
      setError(friendlyError(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}images/icon.jfif)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.14,
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, var(--pg-bg) 0%, transparent 75%)' }}
      />

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl">⚖️</span>
            <h1 className="font-display font-bold text-3xl tracking-tight" style={{ color: 'var(--pg-text)' }}>
              Political <span style={{ color: 'var(--pg-primary)' }}>Gravity</span>
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>
            Social Studies 30 &nbsp;·&nbsp; The ideological orbit of history
          </p>
        </div>

        <div className="rounded-2xl p-7 shadow-lg" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--pg-text)' }}>
            {who === 'student' ? 'Sign in with your student code' : 'Teacher sign-in'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {who === 'student' ? (
              <Field label="Student code" type="text" value={code} onChange={e => setCode(e.target.value)} required
                placeholder="Like S30-7K4Q" autoComplete="username" autoCapitalize="characters" spellCheck={false} />
            ) : (
              <Field label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@rvschools.ab.ca" autoComplete="username" />
            )}
            <Field label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" />

            {who === 'teacher' && (
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={handleForgot}
                  disabled={resetting || loading}
                  className="text-xs font-medium underline underline-offset-2 transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ color: 'var(--pg-primary)' }}
                >
                  {resetting ? 'Sending reset link…' : 'Forgot password?'}
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm rounded-xl px-4 py-2.5" role="alert" style={{ backgroundColor: 'var(--pg-error-bg)', border: '1px solid var(--pg-error-border)', color: 'var(--pg-error)' }}>
                {error}
              </p>
            )}
            {notice && (
              <p className="text-sm rounded-xl px-4 py-2.5" role="status" style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid #22c55e', color: 'var(--pg-text)' }}>
                ✓ {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold py-2.5 rounded-xl transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
            >
              {loading ? 'Signing you in…' : 'Sign In'}
            </button>
          </form>

          {who === 'student' && (
            <p className="text-xs mt-4 leading-relaxed" style={{ color: 'var(--pg-dim)' }}>
              Same code and password as Desk. Forgotten it? Ask Mr. McRae for a new password.
            </p>
          )}
        </div>

        <a
          href={HANDOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            backgroundColor: 'var(--pg-surface)',
            border: '1px solid var(--pg-border)',
            color: 'var(--pg-text)',
          }}
        >
          Project Overview
          <span aria-hidden="true" style={{ color: 'var(--pg-dim)' }}>↗</span>
        </a>

        <div className="flex items-center justify-center gap-3 mt-5 text-xs" style={{ color: 'var(--pg-faint)' }}>
          <button onClick={() => setModal('terms')} className="hover:opacity-80 transition-opacity">Terms of Use</button>
          <span>·</span>
          <button onClick={() => setModal('privacy')} className="hover:opacity-80 transition-opacity">Privacy Policy</button>
          <span>·</span>
          <button onClick={() => switchWho(who === 'student' ? 'teacher' : 'student')} className="hover:opacity-80 transition-opacity">
            {who === 'student' ? 'Teacher sign-in' : 'Student sign-in'}
          </button>
        </div>
      </div>

      {modal === 'terms'   && <PolicyModal title="Terms of Use"   content={TERMS_CONTENT}   onClose={() => setModal(null)} />}
      {modal === 'privacy' && <PolicyModal title="Privacy Policy" content={PRIVACY_CONTENT} onClose={() => setModal(null)} />}
    </div>
  );
}
