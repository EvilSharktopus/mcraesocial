// src/pages/PhaseGate.jsx
// Holding screen shown to students during Phase 0 (setup)
import TopNav from '../components/TopNav';

export default function PhaseGate() {
  return (
    <>
      <TopNav />
      <div className="page" style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: '1.5rem',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          🌍
        </div>
        <h1 style={{ marginBottom: '1rem' }}>
          <span style={{ color: 'var(--teal)' }}>bi</span>
          <span style={{ color: 'var(--yellow)' }}>NGO</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          Your teacher is setting things up.
        </p>
        <p style={{ color: 'var(--text-dim)' }}>
          This page will update automatically when Phase 1 opens — no need to refresh.
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}
