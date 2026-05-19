// src/pages/TeacherDashboard.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, onSnapshot, doc, updateDoc, orderBy, query, where,
} from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useNgoSettings } from '../hooks/useNgoSettings';
import TopNav from '../components/TopNav';

const PHASE_LABELS = ['Setup', 'Phase 1 · Research', 'Phase 2 · Pitch Day', 'Phase 3 · Funding', 'Complete'];
const STAGE_LABELS = {
  0: { label: 'Not started',         badge: 'badge-gray' },
  1: { label: 'Stage 1 in progress', badge: 'badge-teal' },
  2: { label: 'Stage 1 · Awaiting',  badge: 'badge-yellow' },
  3: { label: 'Stage 2 in progress', badge: 'badge-teal' },
  4: { label: 'Stage 2 · Awaiting',  badge: 'badge-yellow' },
  5: { label: 'Phase 1 Complete',    badge: 'badge-green' },
};
const CRITERIA = ['impact','feasibility','urgency','creativity','persuasiveness'];

export default function TeacherDashboard() {
  const { isTeacher } = useAuth();
  const { settings, loading: settingsLoading } = useNgoSettings();
  const [groups, setGroups]         = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [allocations, setAllocations] = useState(0);
  const [advancingPhase, setAdvancingPhase] = useState(false);
  const [p3Amount, setP3Amount]     = useState('');
  const [savingAmount, setSavingAmount] = useState(false);
  const [sendBackNote, setSendBackNote] = useState({});
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [activeTab, setActiveTab]   = useState('groups'); // 'groups' | 'scores' | 'funding'

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'ngo_groups'), orderBy('createdAt', 'asc')),
      (snap) => setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(collection(db, 'ngo_scorecards'),
      (snap) => setScorecards(snap.docs.map((d) => d.data()))
    );
    const u3 = onSnapshot(collection(db, 'ngo_funding'),
      (snap) => setAllocations(snap.size)
    );
    return () => { u1(); u2(); u3(); };
  }, []);

  if (!isTeacher) return <div className="loading-screen"><p style={{ color: 'var(--error)' }}>Access denied.</p></div>;
  if (settingsLoading) return <div className="loading-screen"><span className="spinner" /></div>;

  const currentPhase  = settings?.currentPhase ?? 0;
  const phase3Open    = settings?.phase3Open ?? false;
  const phase3Locked  = settings?.phase3Locked ?? false;

  // ── Phase actions ─────────────────────────────────────────────────────────
  const advancePhase = async () => {
    if (currentPhase >= 4) return;
    setAdvancingPhase(true);
    await updateDoc(doc(db, 'ngo_settings', 'global'), { currentPhase: currentPhase + 1 });
    setAdvancingPhase(false);
  };

  const approveGroup = async (groupId, stage) => {
    const isStage1 = stage === 2;
    await updateDoc(doc(db, 'ngo_groups', groupId), {
      phase1Stage:    isStage1 ? 3 : 5,
      stage1Approved: isStage1 ? true : undefined,
      stage2Approved: !isStage1 ? true : undefined,
      teacherNote:    '',
    });
  };

  const sendBack = async (groupId, stage) => {
    const note = sendBackNote[groupId] || '';
    if (!note.trim()) return;
    const isStage1 = stage === 2;
    await updateDoc(doc(db, 'ngo_groups', groupId), {
      phase1Stage: isStage1 ? 1 : 3,
      teacherNote: note,
    });
    setSendBackNote((p) => ({ ...p, [groupId]: '' }));
  };

  // ── Phase 3 controls ──────────────────────────────────────────────────────
  const approvedGroups = groups.filter((g) => g.stage2Approved);
  const studentCount   = [...new Set(groups.flatMap((g) => g.members ?? []))].length;
  const suggested      = approvedGroups.length > 0 && studentCount > 0
    ? Math.round((approvedGroups.length * 500000 * 0.6) / studentCount)
    : 0;

  const openFundingRound = async () => {
    const amount = parseInt(p3Amount, 10) || suggested;
    if (!amount || amount <= 0) return;
    setSavingAmount(true);
    await updateDoc(doc(db, 'ngo_settings', 'global'), {
      perStudentAmount: amount,
      phase3Open:       true,
    });
    setSavingAmount(false);
  };

  const closeRound = async () => {
    await updateDoc(doc(db, 'ngo_settings', 'global'), { phase3Locked: true });
  };

  // ── Aggregate scorecard ───────────────────────────────────────────────────
  const scoresByGroup = {};
  scorecards.forEach((sc) => {
    if (!scoresByGroup[sc.targetGroupId]) scoresByGroup[sc.targetGroupId] = [];
    scoresByGroup[sc.targetGroupId].push(sc);
  });

  const avg = (scores, key) => {
    if (!scores || scores.length === 0) return 0;
    return (scores.reduce((s, sc) => s + (sc[key] || 0), 0) / scores.length).toFixed(1);
  };

  const awaitingApproval = groups.filter((g) => g.phase1Stage === 2 || g.phase1Stage === 4);

  return (
    <>
      <TopNav />
      <div className="page-wide">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="phase-badge" style={{ marginBottom: '0.5rem' }}>Teacher Dashboard</div>
            <h1>bi<span style={{ color: 'var(--teal)' }}>NGO</span> Controls</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Current phase</p>
            <h2 style={{ color: 'var(--teal)', margin: 0 }}>{PHASE_LABELS[currentPhase]}</h2>
          </div>
        </div>

        {/* Phase Control */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3>Phase Control</h3>
              <p style={{ marginTop: '0.25rem' }}>
                {currentPhase === 0 && 'Students see a holding screen. Advance to open group formation.'}
                {currentPhase === 1 && 'Phase 1 is open. Students are forming groups and researching.'}
                {currentPhase === 2 && 'Phase 2 is open. Students are scoring each other\'s pitches.'}
                {currentPhase === 3 && 'Phase 3 is open. Students are allocating funding.'}
                {currentPhase === 4 && 'The simulation is complete. Results are visible.'}
              </p>
            </div>
            {currentPhase < 4 && (
              <button id="advance-phase-btn" className="btn btn-primary" onClick={advancePhase} disabled={advancingPhase}>
                {advancingPhase ? 'Advancing…' : `Open ${PHASE_LABELS[currentPhase + 1]} →`}
              </button>
            )}
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            {PHASE_LABELS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= currentPhase ? 'var(--teal)' : 'var(--navy-4)', transition: 'background 0.4s' }} />
            ))}
          </div>
        </div>

        {/* Phase 3 Setup Widget */}
        {currentPhase === 3 && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(0,194,179,0.3)' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>💰 Funding Round Setup</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Students', val: studentCount },
                { label: 'Approved NGOs', val: approvedGroups.length },
                { label: 'Suggested per-student', val: `$${suggested.toLocaleString()}` },
                { label: 'Allocations submitted', val: allocations },
              ].map((stat) => (
                <div key={stat.label} style={{ background: 'var(--navy-3)', borderRadius: 'var(--radius)', padding: '0.85rem 1rem' }}>
                  <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.25rem' }}>{stat.label}</p>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--teal)' }}>{stat.val}</strong>
                </div>
              ))}
            </div>
            {!phase3Open && (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>$</span>
                  <input
                    id="per-student-amount-input"
                    type="number" min={0} step={1000}
                    placeholder={suggested || 'Amount per student'}
                    value={p3Amount}
                    onChange={(e) => setP3Amount(e.target.value)}
                    style={{ width: 160 }}
                  />
                </div>
                <button id="open-funding-btn" className="btn btn-primary" onClick={openFundingRound} disabled={savingAmount}>
                  {savingAmount ? 'Opening…' : 'Open Funding Round'}
                </button>
              </div>
            )}
            {phase3Open && !phase3Locked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className="badge badge-green">● Round Open — ${(settings?.perStudentAmount ?? 0).toLocaleString()} per student</span>
                <button id="close-round-btn" className="btn btn-danger btn-sm" onClick={closeRound}>
                  Close Round &amp; Lock Results
                </button>
              </div>
            )}
            {phase3Locked && (
              <span className="badge badge-red">🔒 Round Closed — Final results locked</span>
            )}
          </div>
        )}

        {/* Approval Queue */}
        {awaitingApproval.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>📬 Awaiting Approval <span className="badge badge-yellow" style={{ marginLeft: '0.5rem' }}>{awaitingApproval.length}</span></h3>
            {awaitingApproval.map((g) => (
              <div className="card" key={g.id} style={{ marginBottom: '0.75rem', border: '1px solid rgba(245,200,66,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong>{g.ngoName || '(unnamed)'}</strong>
                      <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>{g.phase1Stage === 2 ? 'Stage 1' : 'Stage 2'}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem' }}>{g.memberNames.join(', ')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button className="btn btn-sm btn-primary" id={`approve-${g.id}`} onClick={() => approveGroup(g.id, g.phase1Stage)}>✓ Approve</button>
                    <button className="btn btn-sm btn-ghost" id={`sendback-toggle-${g.id}`} onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)}>↩ Send Back</button>
                  </div>
                </div>
                {expandedGroup === g.id && (
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <input type="text" placeholder="Feedback note for students…"
                      value={sendBackNote[g.id] || ''} id={`sendback-note-${g.id}`} style={{ flex: 1 }}
                      onChange={(e) => setSendBackNote((p) => ({ ...p, [g.id]: e.target.value }))} />
                    <button className="btn btn-sm btn-danger" onClick={() => sendBack(g.id, g.phase1Stage)}>Send</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {[['groups', 'Groups'], ['scores', 'Scorecard Results'], ['funding', 'Funding']].map(([key, label]) => (
            <button key={key} className={`btn btn-sm ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(key)} id={`tab-${key}`}>{label}</button>
          ))}
        </div>

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {groups.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
                <p>No groups yet.</p>
              </div>
            )}
            {groups.map((g) => {
              const si = STAGE_LABELS[g.phase1Stage ?? 0];
              return (
                <div className="card" key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong>{g.ngoName || '(no name yet)'}</strong>
                      <span className={`badge ${si.badge}`} style={{ fontSize: '0.65rem' }}>{si.label}</span>
                      {g.funded && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>FUNDED</span>}
                    </div>
                    <p style={{ fontSize: '0.78rem' }}>
                      Code: <code style={{ color: 'var(--yellow)' }}>{g.joinCode}</code>
                      &nbsp;·&nbsp;{g.memberNames.join(', ')}
                    </p>
                    {g.tagline && <p style={{ fontSize: '0.78rem', fontStyle: 'italic', color: 'var(--text-dim)', marginTop: '0.1rem' }}>"{g.tagline}"</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>${(g.fundingReceived || 0).toLocaleString()} received</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{g.members.length}/4 members</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Scores Tab */}
        {activeTab === 'scores' && (
          <div>
            {approvedGroups.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
                <p>No approved NGOs yet. Scores will appear here after groups are approved.</p>
              </div>
            )}
            {approvedGroups.map((g) => {
              const gScores = scoresByGroup[g.id] ?? [];
              return (
                <div className="card" key={g.id} style={{ marginBottom: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong>{g.ngoName || '(unnamed)'}</strong>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{gScores.length} scorer{gScores.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                      Avg total: {gScores.length > 0 ? (CRITERIA.reduce((s, k) => s + parseFloat(avg(gScores, k)), 0) / CRITERIA.length).toFixed(1) : '—'}/10
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {CRITERIA.map((k) => (
                      <div key={k} style={{ background: 'var(--navy-3)', borderRadius: 'var(--radius)', padding: '0.5rem 0.85rem', textAlign: 'center', flex: '1 0 80px' }}>
                        <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2rem' }}>{k}</p>
                        <strong style={{ color: 'var(--teal)', fontSize: '1.1rem' }}>{avg(gScores, k)}</strong>
                      </div>
                    ))}
                  </div>
                  {gScores.some((sc) => sc.notes?.trim()) && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Anonymous notes</p>
                      {gScores.filter((sc) => sc.notes?.trim()).map((sc, i) => (
                        <p key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.2rem' }}>"{sc.notes}"</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Funding Tab */}
        {activeTab === 'funding' && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {approvedGroups.sort((a, b) => (b.fundingReceived ?? 0) - (a.fundingReceived ?? 0)).map((g) => {
              const pct = Math.min(((g.fundingReceived ?? 0) / 500000) * 100, 100);
              return (
                <div className="card" key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <strong>{g.ngoName || '(unnamed)'}</strong>
                      {g.funded && <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>FUNDED</span>}
                    </div>
                    <strong style={{ color: g.funded ? 'var(--success)' : 'var(--teal)' }}>${(g.fundingReceived ?? 0).toLocaleString()}</strong>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'var(--navy-4)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: g.funded ? 'var(--success)' : 'var(--teal)', transition: 'width 0.5s', borderRadius: 99 }} />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>{pct.toFixed(1)}% of $500,000</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
