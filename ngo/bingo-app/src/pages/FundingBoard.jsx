// src/pages/FundingBoard.jsx
// Projector-mode fullscreen funding board — real-time via onSnapshot
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useNgoSettings } from '../hooks/useNgoSettings';

const BUDGET_MAX = 500000;

function NgoFundingCard({ group }) {
  const pct    = Math.min(((group.fundingReceived ?? 0) / BUDGET_MAX) * 100, 100);
  const funded = group.funded || (group.fundingReceived ?? 0) >= BUDGET_MAX;

  return (
    <div
      id={`board-card-${group.id}`}
      style={{
        background: funded ? 'rgba(52,211,153,0.08)' : 'var(--navy-3)',
        border: `1px solid ${funded ? 'var(--success)' : 'var(--glass-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.5s, background 0.5s',
      }}
    >
      {/* FUNDED stamp */}
      {funded && (
        <div style={{
          position: 'absolute', top: '50%', right: '-20px',
          transform: 'translateY(-50%) rotate(-15deg)',
          fontSize: '3rem', fontWeight: 900, color: 'var(--success)',
          opacity: 0.15, letterSpacing: '-0.05em', pointerEvents: 'none',
          userSelect: 'none',
        }}>
          FUNDED
        </div>
      )}
      {funded && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'var(--success)', color: '#fff',
          borderRadius: 99, padding: '0.2rem 0.7rem',
          fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em',
        }}>
          ✓ FUNDED
        </div>
      )}

      <h3 style={{ marginBottom: '0.2rem', fontSize: '1.1rem' }}>
        {group.ngoName || '(unnamed)'}
      </h3>
      <p style={{ fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '1rem', color: 'var(--text-muted)' }}>
        "{group.tagline || '—'}"
      </p>

      {/* Progress bar */}
      <div style={{ height: 10, borderRadius: 99, background: 'var(--navy-4)', overflow: 'hidden', marginBottom: '0.6rem' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: funded
            ? 'linear-gradient(90deg, var(--success), #6ee7b7)'
            : 'linear-gradient(90deg, var(--teal), var(--teal-dark))',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          borderRadius: 99,
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: funded ? 'var(--success)' : 'var(--teal)' }}>
          ${(group.fundingReceived ?? 0).toLocaleString()}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          of $500,000 · {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export default function FundingBoard() {
  const { settings } = useNgoSettings();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'ngo_groups'), where('stage2Approved', '==', true));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort: funded first (by fundingReceived desc), then unfunded
      list.sort((a, b) => (b.fundingReceived ?? 0) - (a.fundingReceived ?? 0));
      setGroups(list);
    });
  }, []);

  const isLocked  = settings?.phase3Locked;
  const isOpen    = settings?.phase3Open;
  const phase     = settings?.currentPhase ?? 0;

  const funded   = groups.filter((g) => g.funded || (g.fundingReceived ?? 0) >= BUDGET_MAX);
  const unfunded = groups.filter((g) => !g.funded && (g.fundingReceived ?? 0) < BUDGET_MAX);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', padding: '0' }}>
      {/* Top bar */}
      <div style={{
        background: 'rgba(11,15,26,0.95)',
        borderBottom: '1px solid var(--glass-border)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--yellow)' }}>bi</span>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--teal)' }}>NGO</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
            Live Funding Board
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {isLocked && (
            <span style={{
              background: 'rgba(248,113,113,0.15)', color: 'var(--error)',
              border: '1px solid var(--error)', borderRadius: 99,
              padding: '0.3rem 1rem', fontSize: '0.8rem', fontWeight: 700,
            }}>
              🔒 Round Closed — Final Results
            </span>
          )}
          {isOpen && !isLocked && (
            <span style={{
              background: 'rgba(52,211,153,0.15)', color: 'var(--success)',
              border: '1px solid var(--success)', borderRadius: 99,
              padding: '0.3rem 1rem', fontSize: '0.8rem', fontWeight: 700,
              animation: 'pulse 2s ease-in-out infinite',
            }}>
              ● Live
            </span>
          )}
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            {funded.length}/{groups.length} funded
          </span>
        </div>
      </div>

      {/* Pre-phase-3 holding */}
      {phase < 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 65px)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💰</div>
          <h2>Funding board will go live during Phase 3</h2>
          <p style={{ color: 'var(--text-dim)' }}>Your teacher will open the funding round when it's time.</p>
        </div>
      )}

      {/* Cards grid */}
      {phase >= 3 && (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {groups.map((g) => <NgoFundingCard key={g.id} group={g} />)}
          </div>

          {/* Final results summary when locked */}
          {isLocked && groups.length > 0 && (
            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Final Results</h2>
              <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {/* Funded */}
                {funded.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Funded ✓
                    </p>
                    {funded.map((g) => (
                      <p key={g.id} style={{ color: 'var(--success)', fontWeight: 600 }}>{g.ngoName}</p>
                    ))}
                  </div>
                )}
                {/* Unfunded */}
                {unfunded.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.5rem' }}>
                      Unfunded
                    </p>
                    {unfunded.map((g) => (
                      <p key={g.id} style={{ color: 'var(--warning)' }}>{g.ngoName} — ${(g.fundingReceived ?? 0).toLocaleString()}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
