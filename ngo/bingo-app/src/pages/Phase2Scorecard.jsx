// src/pages/Phase2Scorecard.jsx
// Phase 2 — students score each other's NGOs with 5 sliders
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot,
  doc, setDoc, updateDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useNgoSettings } from '../hooks/useNgoSettings';
import TopNav from '../components/TopNav';

const CRITERIA = [
  { key: 'impact',        label: 'Impact',        q: 'How many people does this actually help?' },
  { key: 'feasibility',   label: 'Feasibility',   q: 'Could this realistically work?' },
  { key: 'urgency',       label: 'Urgency',        q: 'Does this need solving now?' },
  { key: 'creativity',    label: 'Creativity',     q: 'Is this a fresh approach?' },
  { key: 'persuasiveness',label: 'Persuasiveness', q: 'Did they sell it?' },
];

const noPaste = (e) => e.preventDefault();

function Slider({ label, question, value, onChange, id }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</span>
          <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', marginLeft: '0.5rem' }}>{question}</span>
        </div>
        <span style={{
          fontWeight: 800, fontSize: '1.1rem',
          color: value >= 8 ? 'var(--success)' : value >= 5 ? 'var(--teal)' : 'var(--text-muted)',
          minWidth: 24, textAlign: 'right',
        }}>{value}</span>
      </div>
      <input
        id={id}
        type="range" min={1} max={10} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--teal)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
        <span>1 — Weak</span><span>10 — Outstanding</span>
      </div>
    </div>
  );
}

function NgoCard({ group, myGroupId, scorerId }) {
  const isOwn  = group.id === myGroupId;
  const cardId = `ngo-card-${group.id}`;

  // Scorecard state
  const [scores, setScores]   = useState({ impact: 5, feasibility: 5, urgency: 5, creativity: 5, persuasiveness: 5 });
  const [notes, setNotes]     = useState('');
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const savedTimer = useRef(null);
  const loadedRef = useRef(false);
  const scoresRef = useRef(scores);
  const notesRef  = useRef(notes);
  scoresRef.current = scores;
  notesRef.current  = notes;

  // Load existing scorecard
  useEffect(() => {
    if (isOwn) return;
    const ref = doc(db, 'ngo_scorecards', `${scorerId}_${group.id}`);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setScores({ impact: d.impact, feasibility: d.feasibility, urgency: d.urgency, creativity: d.creativity, persuasiveness: d.persuasiveness });
        setNotes(d.notes ?? '');
        setSubmitted(!!d.submittedAt);
      }
      loadedRef.current = true;
    }).catch(() => {
      loadedRef.current = true;
    });
  }, [isOwn, scorerId, group.id]);

  const saveCard = async () => {
    if (isOwn || !loadedRef.current) return;
    setSaving(true);
    const ref = doc(db, 'ngo_scorecards', `${scorerId}_${group.id}`);
    await setDoc(ref, {
      scorerId,
      targetGroupId: group.id,
      ...scoresRef.current,
      notes: notesRef.current,
      submittedAt: serverTimestamp(),
    }, { merge: true });
    setSaving(false);
    setSaved(true);
    setSubmitted(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  };

  // Auto-save: debounce on score/notes changes
  const debounceRef = useRef(null);
  useEffect(() => {
    if (isOwn || !loadedRef.current) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveCard(), 2000);
    return () => clearTimeout(debounceRef.current);
  }, [scores, notes]);

  // Auto-save on tab switch / page close
  useEffect(() => {
    if (isOwn) return;
    const handleVis = () => { if (document.visibilityState === 'hidden') saveCard(); };
    const handleUnload = () => saveCard();
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [isOwn]);

  return (
    <div
      id={cardId}
      className="card"
      style={{
        marginBottom: '1.25rem',
        opacity: isOwn ? 0.5 : 1,
        border: isOwn ? '1px solid var(--glass-border)' : submitted ? '1px solid rgba(52,211,153,0.3)' : '1px solid var(--glass-border)',
      }}
    >
      {/* NGO Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <h3>{group.ngoName || '(unnamed)'}</h3>
            {isOwn && <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>Your NGO</span>}
            {submitted && !isOwn && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>✓ Scored</span>}
          </div>
          <p style={{ fontSize: '0.82rem', fontStyle: 'italic', marginTop: '0.1rem' }}>"{group.tagline || '—'}"</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-dim)' }}>
            {group.memberNames?.join(', ')} · {group.issue || ''}
          </p>
        </div>
      </div>

      {isOwn ? (
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
          You cannot score your own NGO.
        </p>
      ) : (
        <>
          <hr className="divider" />
          {CRITERIA.map((c) => (
            <Slider
              key={c.key}
              id={`slider-${group.id}-${c.key}`}
              label={c.label}
              question={c.q}
              value={scores[c.key]}
              onChange={(v) => setScores((p) => ({ ...p, [c.key]: v }))}
            />
          ))}
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label htmlFor={`notes-${group.id}`}>Notes (optional)</label>
            <textarea
              id={`notes-${group.id}`}
              rows={2}
              placeholder="Quick observations — anonymous to classmates"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onPaste={noPaste}
              onBlur={saveCard}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span className={`save-indicator ${saved ? 'visible' : ''}`}>
              {saving ? '⟳ Saving…' : '✓ Saved'}
            </span>
            <button
              id={`save-score-${group.id}`}
              className="btn btn-primary btn-sm"
              onClick={saveCard}
              disabled={saving}
            >
              {submitted ? 'Update Score' : 'Save Score'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Phase2Scorecard() {
  const { user } = useAuth();
  const { settings } = useNgoSettings();
  const [myGroup, setMyGroup]   = useState(null);
  const [allGroups, setAllGroups] = useState([]);

  useEffect(() => {
    // Find my group
    const q1 = query(collection(db, 'ngo_groups'), where('members', 'array-contains', user.uid));
    const u1  = onSnapshot(q1, (snap) => {
      if (!snap.empty) setMyGroup({ id: snap.docs[0].id, ...snap.docs[0].data() });
    });
    // All groups
    const u2  = onSnapshot(collection(db, 'ngo_groups'), (snap) => {
      setAllGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, [user.uid]);

  return (
    <>
      <TopNav />
      <div className="page">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', paddingTop: '1.5rem' }}>
          <div className="phase-badge">Phase 2 · Pitch Day</div>
          <h1 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>Score the NGOs</h1>
          <p>Rate each NGO on 5 criteria as they pitch. Your scores are saved automatically.</p>
          {myGroup && (
            <a href={`/ngo/group/${myGroup.id}`} style={{ display: 'inline-block', marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--teal)' }}>
              📄 View your Phase 1 work →
            </a>
          )}
        </div>

        {allGroups.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p>No NGOs have been approved yet. Check back after your teacher opens Phase 2.</p>
          </div>
        )}

        {allGroups.length > 0 && !settings?.presentingGroupId && (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed var(--teal)' }}>
            <div className="spinner" style={{ margin: '0 auto 1.5rem auto' }} />
            <h2 style={{ marginBottom: '0.5rem' }}>Waiting...</h2>
            <p style={{ color: 'var(--text-dim)' }}>Waiting for the teacher to start the next pitch.</p>
          </div>
        )}

        {settings?.presentingGroupId && allGroups.some(g => g.id === settings.presentingGroupId) && (
          <NgoCard
            key={settings.presentingGroupId}
            group={allGroups.find(g => g.id === settings.presentingGroupId)}
            myGroupId={myGroup?.id}
            scorerId={user.uid}
          />
        )}
      </div>
    </>
  );
}
