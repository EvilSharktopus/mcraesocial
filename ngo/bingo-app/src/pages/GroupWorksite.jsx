// src/pages/GroupWorksite.jsx
// Shell page — routes to Stage1, Stage2, PitchDeck etc. based on group's phase1Stage
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import TopNav from '../components/TopNav';

// Lazy-load stage components (will be built in Pages 3–5)
import Stage1Form   from '../components/Stage1Form';
import Stage2Form   from '../components/Stage2Form';
import PitchDeck    from './PitchDeck';

const STAGE_LABELS = {
  0: 'Not Started',
  1: 'Stage 1 · Research',
  2: 'Stage 1 · Awaiting Approval',
  3: 'Stage 2 · Evidence & Plan',
  4: 'Stage 2 · Awaiting Approval',
  5: 'Phase 1 Complete',
};

export default function GroupWorksite() {
  const { groupId } = useParams();
  const { user, isTeacher } = useAuth();
  const [group, setGroup]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [notMember, setNotMember] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'ngo_groups', groupId),
      (snap) => {
        if (!snap.exists()) { setLoading(false); return; }
        const data = { id: snap.id, ...snap.data() };
        setGroup(data);
        setNotMember(!data.members.includes(user?.uid) && !isTeacher);
        setLoading(false);
      },
      (err) => {
        console.error('GroupWorksite onSnapshot error:', err);
        setError(err.message || 'Permission denied reading ngo_groups');
        setLoading(false);
      }
    );
    return unsub;
  }, [groupId, user, isTeacher]);

  if (loading) return <div className="loading-screen"><span className="spinner" /></div>;

  if (error) return (
    <div className="loading-screen" style={{ flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: 'var(--error)' }}>Error: {error}</p>
    </div>
  );

  if (!group) return (
    <div className="loading-screen" style={{ flexDirection: 'column', gap: '1rem' }}>
      <p>Group not found.</p>
    </div>
  );

  if (notMember) return (
    <div className="loading-screen" style={{ flexDirection: 'column', gap: '1rem' }}>
      <p style={{ color: 'var(--error)' }}>You are not a member of this group.</p>
    </div>
  );

  const stage = group.phase1Stage ?? 0;

  return (
    <>
      <TopNav />

      {/* Teacher send-back note banner */}
      {group.teacherNote && (stage === 1 || stage === 3) && (
        <div style={{ background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid var(--warning)', padding: '0.75rem 1.5rem' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem' }}>📝</span>
            <div>
              <strong style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>Teacher Feedback:</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.1rem' }}>{group.teacherNote}</p>
            </div>
          </div>
        </div>
      )}

      <div className="page">
        {/* Group header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
              <h2 style={{ margin: 0 }}>{group.ngoName || 'Your NGO'}</h2>
              <span className="badge badge-teal">{STAGE_LABELS[stage]}</span>
            </div>
            <p style={{ fontSize: '0.8rem' }}>
              Join code: <strong style={{ color: 'var(--yellow)', letterSpacing: '0.15em', fontFamily: 'monospace' }}>{group.joinCode}</strong>
              &nbsp;·&nbsp;{group.memberNames.join(', ')}
            </p>
          </div>
        </div>

        {/* Awaiting approval screens */}
        {(stage === 2 || stage === 4) && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
            <h2>Awaiting teacher approval</h2>
            <p style={{ marginTop: '0.5rem' }}>
              {stage === 2 ? 'Stage 1 has been submitted.' : 'Stage 2 has been submitted.'}
              <br />Your teacher will review and approve or send it back with feedback.
            </p>
          </div>
        )}

        {/* Active stages */}
        {(stage === 1) && <Stage1Form groupId={groupId} />}
        {(stage === 3) && <Stage2Form groupId={groupId} />}
        {(stage === 5) && <PitchDeck groupId={groupId} />}
      </div>
    </>
  );
}
