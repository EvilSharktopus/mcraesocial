// src/auth/LoginPage.jsx
import { useState } from 'react';
import { useAuth } from './AuthContext';
import '../styles/login.css';

export default function LoginPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError('Incorrect email or password. Use your McRae Submit login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-glow" />
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-bi">bi</span>
          <span className="logo-ngo">NGO</span>
        </div>
        <p className="login-tagline">And Saving the World Was Its Name-o</p>
        <p className="login-sub">Social Studies 10-1 · McRae</p>

        <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
          <input
            id="ngo-email"
            type="email"
            className="login-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          <input
            id="ngo-password"
            type="password"
            className="login-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            id="email-signin-btn"
            type="submit"
            className="btn-google"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {error && <p className="login-error">{error}</p>}

        <p className="login-hint">Use your <strong>McRae Submit</strong> login</p>
      </div>
    </div>
  );
}
