import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import TopNav from '../components/TopNav';

export default function PhaseReflection() {
  const { user } = useAuth();
  const [myGroup, setMyGroup] = useState(null);
  
  // Scoring state
  const [selfScore, setSelfScore] = useState(10);
  const [peerScores, setPeerScores] = useState({});
  const [projectScores, setProjectScores] = useState({
    puttingItTogether: 10,
    changesFromAI: 10,
    delivery: 10
  });
  const [comments, setComments] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Find my group
    const q1 = query(collection(db, 'ngo_groups'), where('members', 'array-contains', user.uid));
    const unsub = onSnapshot(q1, (snap) => {
      if (!snap.empty) {
        const groupData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setMyGroup(groupData);
        
        // Initialize peer scores if not set
        setPeerScores(prev => {
          if (Object.keys(prev).length > 0) return prev;
          const initial = {};
          groupData.members?.forEach((uid, idx) => {
            if (uid !== user.uid) {
              initial[uid] = { name: groupData.memberNames[idx] || 'Unknown', score: 10 };
            }
          });
          return initial;
        });
      }
    });
    return () => unsub();
  }, [user.uid]);

  const handleSubmit = async () => {
    if (!myGroup) return;
    setSaving(true);
    try {
      const ref = doc(db, 'ngo_reflections', user.uid);
      
      // Flatten peer scores to just numbers
      const finalPeerScores = {};
      Object.keys(peerScores).forEach(uid => {
        finalPeerScores[uid] = peerScores[uid].score;
      });

      await setDoc(ref, {
        studentId: user.uid,
        studentName: user.displayName || user.email,
        groupId: myGroup.id,
        selfScore,
        peerScores: finalPeerScores,
        projectScores,
        comments,
        submittedAt: new Date().toISOString()
      });
      setSubmitted(true);
    } catch (e) {
      console.error(e);
      alert('Failed to submit reflection: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const RangeSlider = ({ label, value, onChange }) => (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem' }}>{label}</strong>
        <span style={{ 
          fontWeight: 'bold', 
          color: value >= 8 ? 'var(--success)' : value >= 5 ? 'var(--teal)' : 'var(--text-muted)' 
        }}>{value} / 10</span>
      </div>
      <input
        type="range" min={1} max={10} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--teal)' }}
      />
    </div>
  );

  return (
    <>
      <TopNav />
      <div className="page" style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem', paddingTop: '1.5rem' }}>
          <div className="phase-badge">Phase 5 · Reflection</div>
          <h1 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>Project Reflection</h1>
          <p style={{ color: 'var(--text-dim)' }}>
            The simulation is over! Please take a moment to reflect on your contributions, your team's dynamics, and the overall project.
          </p>
        </div>

        {submitted ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(52,211,153,0.3)' }}>
            <h2 style={{ color: 'var(--success)', marginBottom: '1rem' }}>✓ Reflection Submitted</h2>
            <p>Thank you for participating! You can close this window now, or look at the projector to see the final funding results.</p>
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Personal Contribution</h3>
            <RangeSlider 
              label="How would you rate your own contributions to the project?" 
              value={selfScore} 
              onChange={setSelfScore} 
            />

            {Object.keys(peerScores).length > 0 && (
              <>
                <h3 style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Team Contributions</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                  Rate the contributions of your group members. This is private and will only be seen by the teacher.
                </p>
                {Object.keys(peerScores).map(uid => (
                  <RangeSlider 
                    key={uid}
                    label={`${peerScores[uid].name}'s Contribution`} 
                    value={peerScores[uid].score} 
                    onChange={(v) => setPeerScores(p => ({ ...p, [uid]: { ...p[uid], score: v } }))} 
                  />
                ))}
              </>
            )}

            <h3 style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Overall Project</h3>
            <RangeSlider 
              label="Putting it all together (Overall cohesion and structure)" 
              value={projectScores.puttingItTogether} 
              onChange={(v) => setProjectScores(p => ({ ...p, puttingItTogether: v }))} 
            />
            <RangeSlider 
              label="Changes from the AI-produced PowerPoint (How well did you adapt/improve the AI draft?)" 
              value={projectScores.changesFromAI} 
              onChange={(v) => setProjectScores(p => ({ ...p, changesFromAI: v }))} 
            />
            <RangeSlider 
              label="Delivery (Pitch presentation quality)" 
              value={projectScores.delivery} 
              onChange={(v) => setProjectScores(p => ({ ...p, delivery: v }))} 
            />

            <h3 style={{ marginTop: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>Final Thoughts</h3>
            <div className="form-group">
              <label>Any additional comments about the project, your group, or the simulation?</label>
              <textarea 
                rows={4} 
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Optional comments..."
              />
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !myGroup}>
                {saving ? 'Submitting...' : 'Submit Reflection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
