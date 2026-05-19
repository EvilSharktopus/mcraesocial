// src/pages/Phase3Funding.jsx
// Phase 3 — student allocation UI with Firestore transaction
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  doc, getDoc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useNgoSettings } from '../hooks/useNgoSettings';
import TopNav from '../components/TopNav';

const BUDGET_MAX = 500000;

export default function Phase3Funding() {
  const { user }                         = useAuth();
  const { settings }                     = useNgoSettings();
  const perStudent                       = settings?.perStudentAmount ?? 0;

  const [myGroupId, setMyGroupId]        = useState(null);
  const [allGroups, setAllGroups]        = useState([]);
  const [amounts, setAmounts]            = useState({});    // groupId → string
  const [submitting, setSubmitting]      = useState(false);
  const [submitted, setSubmitted]        = useState(false);
  const [error, setError]                = useState('');

  useEffect(() => {
    // My group
    const q1 = query(collection(db, 'ngo_groups'), where('members', 'array-contains', user.uid));
    const u1  = onSnapshot(q1, (snap) => {
      if (!snap.empty) setMyGroupId(snap.docs[0].id);
    });
    // All approved groups
    const q2 = query(collection(db, 'ngo_groups'), where('stage2Approved', '==', true));
    const u2  = onSnapshot(q2, (snap) => {
      setAllGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    // Check if already submitted
    getDoc(doc(db, 'ngo_funding', user.uid)).then((snap) => {
      if (snap.exists() && snap.data().locked) setSubmitted(true);
    });
    return () => { u1(); u2(); };
  }, [user.uid]);

  const total  = Object.values(amounts).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
  const diff   = perStudent - total;
  const exact  = diff === 0 && perStudent > 0;

  const setAmount = (gid, val) => {
    // Whole numbers only
    const n = Math.floor(Number(val));
    setAmounts((p) => ({ ...p, [gid]: isNaN(n) || n < 0 ? '' : String(n) }));
  };

  const handleSubmit = async () => {
    if (!exact || submitting || submitted) return;
    setError('');
    setSubmitting(true);
    try {
      // Build allocations array (exclude own group — enforced here + Firestore rules)
      const allocations = allGroups
        .filter((g) => g.id !== myGroupId)
        .map((g) => ({ groupId: g.id, amount: parseInt(amounts[g.id] || '0', 10) }))
        .filter((a) => a.amount > 0);

      await runTransaction(db, async (tx) => {
        // Verify perStudentAmount hasn't changed
        const settingsDoc = await tx.get(doc(db, 'ngo_settings', 'global'));
        if (settingsDoc.data().phase3Locked) throw new Error('The funding round is now closed.');

        // Verify each target won't exceed $500K
        for (const alloc of allocations) {
          const gDoc = await tx.get(doc(db, 'ngo_groups', alloc.groupId));
          const current = gDoc.data().fundingReceived ?? 0;
          const newTotal = current + alloc.amount;
          if (newTotal > BUDGET_MAX) throw new Error(`${gDoc.data().ngoName} would exceed $500K. Reduce your allocation.`);
        }

        // Write ngo_funding doc
        tx.set(doc(db, 'ngo_funding', user.uid), {
          studentId:   user.uid,
          allocations,
          submittedAt: serverTimestamp(),
          locked:      true,
        });

        // Increment fundingReceived + set funded flag
        for (const alloc of allocations) {
          const gRef = doc(db, 'ngo_groups', alloc.groupId);
          const gDoc = await tx.get(gRef);
          const newTotal = (gDoc.data().fundingReceived ?? 0) + alloc.amount;
          tx.update(gRef, {
            fundingReceived: newTotal,
            funded:          newTotal >= BUDGET_MAX,
          });
        }
      });

      setSubmitted(true);
    } catch (e) {
      setError(e.message || 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <>
        <TopNav />
        <div className="page" style={{ textAlign: 'center', paddingTop: '5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
          <h2>Funding Submitted!</h2>
          <p style={{ marginTop: '0.5rem' }}>Your allocations have been locked in. Watch the funding board to see how your NGOs do.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopNav />
      <div className="page">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', paddingTop: '1.5rem' }}>
          <div className="phase-badge">Phase 3 · Funding Round</div>
          <h1 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>Allocate Your Funding</h1>
          <p>
            You have <strong style={{ color: 'var(--yellow)', fontSize: '1.1rem' }}>${perStudent.toLocaleString()}</strong> to allocate.
            You cannot fund your own NGO.
          </p>
        </div>

        {allGroups.map((g) => {
          const isOwn   = g.id === myGroupId;
          const isFunded = g.funded || (g.fundingReceived ?? 0) >= BUDGET_MAX;
          const disabled = isOwn || isFunded;
          const pct      = Math.min(((g.fundingReceived ?? 0) / BUDGET_MAX) * 100, 100);

          return (
            <div
              key={g.id}
              className="card"
              style={{ marginBottom: '0.9rem', opacity: disabled ? 0.5 : 1 }}
              id={`fund-card-${g.id}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <strong>{g.ngoName || '(unnamed)'}</strong>
                    {isOwn   && <span className="badge badge-yellow" style={{ fontSize: '0.62rem' }}>Your NGO</span>}
                    {isFunded && <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>FUNDED</span>}
                  </div>
                  <p style={{ fontSize: '0.78rem', fontStyle: 'italic' }}>"{g.tagline || '—'}"</p>
                  {/* Funding progress bar */}
                  <div style={{ marginTop: '0.5rem', height: 5, borderRadius: 99, background: 'var(--navy-4)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: isFunded ? 'var(--success)' : 'var(--teal)', transition: 'width 0.5s' }} />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                    ${(g.fundingReceived ?? 0).toLocaleString()} / $500,000
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>$</span>
                  <input
                    id={`amount-${g.id}`}
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    disabled={disabled}
                    value={amounts[g.id] ?? ''}
                    onChange={(e) => setAmount(g.id, e.target.value)}
                    onPaste={(e) => e.preventDefault()}
                    style={{ width: 110, textAlign: 'right', fontSize: '1rem', fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Running total */}
        <div style={{
          position: 'sticky', bottom: '1.5rem',
          background: exact ? 'rgba(52,211,153,0.12)' : total > perStudent ? 'rgba(248,113,113,0.12)' : 'var(--navy-3)',
          border: `1px solid ${exact ? 'var(--success)' : total > perStudent ? 'var(--error)' : 'var(--glass-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '1.1rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          marginTop: '1.5rem',
        }}>
          <div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.1rem' }}>Total allocated</p>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: exact ? 'var(--success)' : total > perStudent ? 'var(--error)' : 'var(--text)' }}>
              ${total.toLocaleString()}
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}> / ${perStudent.toLocaleString()}</span>
            {!exact && diff !== 0 && (
              <p style={{ fontSize: '0.75rem', color: diff > 0 ? 'var(--text-dim)' : 'var(--error)' }}>
                {diff > 0 ? `$${diff.toLocaleString()} remaining` : `$${Math.abs(diff).toLocaleString()} over budget`}
              </p>
            )}
          </div>
          <div>
            {error && <p style={{ color: 'var(--error)', fontSize: '0.82rem', marginBottom: '0.5rem', textAlign: 'right' }}>{error}</p>}
            <button
              id="submit-funding-btn"
              className="btn btn-primary btn-lg"
              disabled={!exact || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting…' : 'Lock In Funding →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
