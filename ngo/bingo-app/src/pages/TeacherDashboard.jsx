// src/pages/TeacherDashboard.jsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, onSnapshot, doc, updateDoc, orderBy, query, where, getDocs, deleteDoc, setDoc
} from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useNgoSettings } from '../hooks/useNgoSettings';
import TopNav from '../components/TopNav';
import DashboardContributors from '../components/DashboardContributors';
import { Link } from 'react-router-dom';

const PHASE_LABELS = ['Setup', 'Phase 1 · Research', 'Phase 2 · Pitch Day', 'Phase 3 · Funding', 'Phase 4 · Results', 'Phase 5 · Reflection'];
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
  const { isTeacher, user } = useAuth();
  const { settings, loading: settingsLoading } = useNgoSettings();
  const [groups, setGroups]         = useState([]);
  const [scorecards, setScorecards] = useState([]);
  const [allocations, setAllocations] = useState(0);
  const [reflections, setReflections] = useState([]);
  const [stage1All, setStage1All]   = useState({});
  const [stage2All, setStage2All]   = useState({});
  const [advancingPhase, setAdvancingPhase] = useState(false);
  const [p3Amount, setP3Amount]     = useState('');
  const [savingAmount, setSavingAmount] = useState(false);
  const [sendBackNote, setSendBackNote] = useState({});
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [activeTab, setActiveTab]   = useState('groups'); // 'groups' | 'scores' | 'funding'
  const [projectorMode, setProjectorMode] = useState(false);

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
    const u4 = onSnapshot(collection(db, 'ngo_stage1'), (snap) => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data(); });
      setStage1All(data);
    });
    const u5 = onSnapshot(collection(db, 'ngo_stage2'), (snap) => {
      const data = {};
      snap.forEach(d => { data[d.id] = d.data(); });
      setStage2All(data);
    });
    const u6 = onSnapshot(collection(db, 'ngo_reflections'), (snap) => {
      setReflections(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  if (!isTeacher) return <div className="loading-screen"><p style={{ color: 'var(--error)' }}>Access denied.</p></div>;
  if (settingsLoading) return <div className="loading-screen"><span className="spinner" /></div>;

  const currentPhase  = settings?.currentPhase ?? 0;
  const phase3Open    = settings?.phase3Open ?? false;
  const phase3Locked  = settings?.phase3Locked ?? false;

  // ── Phase actions ─────────────────────────────────────────────────────────
  const advancePhase = async () => {
    if (currentPhase >= 5) return;
    setAdvancingPhase(true);
    await updateDoc(doc(db, 'ngo_settings', 'global'), { currentPhase: currentPhase + 1 });
    setAdvancingPhase(false);
  };

  const goBackPhase = async () => {
    if (currentPhase <= 0) return;
    if (!window.confirm(`Go back to ${PHASE_LABELS[currentPhase - 1]}? Students will be redirected to that phase.`)) return;
    await updateDoc(doc(db, 'ngo_settings', 'global'), { currentPhase: currentPhase - 1 });
  };

  const approveGroup = async (groupId, stage) => {
    const isStage1 = stage === 2;
    try {
      const updateData = {
        phase1Stage: isStage1 ? 3 : 5,
        teacherNote: '',
      };
      if (isStage1) updateData.stage1Approved = true;
      else updateData.stage2Approved = true;

      await updateDoc(doc(db, 'ngo_groups', groupId), updateData);
      alert('Approved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to approve: ' + e.message);
    }
  };

  const sendBack = async (groupId, stage) => {
    const note = sendBackNote[groupId] || '';
    if (!note.trim()) {
      alert('Please enter a feedback note.');
      return;
    }
    const isStage1 = stage === 2;
    try {
      await updateDoc(doc(db, 'ngo_groups', groupId), {
        phase1Stage: isStage1 ? 1 : 3,
        teacherNote: note,
      });
      setSendBackNote((p) => ({ ...p, [groupId]: '' }));
      alert('Sent back successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to send back: ' + e.message);
    }
  };

  const setPresentingGroup = async (groupId) => {
    await updateDoc(doc(db, 'ngo_settings', 'global'), { presentingGroupId: groupId });
  };

  const restartProject = async () => {
    if (!window.confirm("Are you absolutely sure you want to delete all groups, scores, and funding data? This cannot be undone.")) return;
    
    try {
      // Clear groups
      const groupsSnap = await getDocs(collection(db, 'ngo_groups'));
      groupsSnap.forEach(d => deleteDoc(d.ref));
      
      // Clear scorecards
      const scoresSnap = await getDocs(collection(db, 'ngo_scorecards'));
      scoresSnap.forEach(d => deleteDoc(d.ref));
      
      // Clear funding
      const fundingSnap = await getDocs(collection(db, 'ngo_funding'));
      fundingSnap.forEach(d => deleteDoc(d.ref));
      
      // Reset settings
      await setDoc(doc(db, 'ngo_settings', 'global'), {
        currentPhase: 0,
        perStudentAmount: 0,
        phase3Open: false,
        phase3Locked: false,
        presentingGroupId: null
      });
      
      alert("Project restarted successfully.");
    } catch (e) {
      console.error(e);
      alert("Failed to restart project: " + e.message);
    }
  };

  const seedTestData = async () => {
    if (!window.confirm('This will create 3 fake NGO groups, scores, and funding data. Existing data is not removed. OK?')) return;

    try {
      const teacherId = user?.uid ?? 'seed_teacher';

      const fakeGroups = [
        { ngoName: 'Clean Water Initiative',  tagline: 'Safe water for every community',      issue: 'water access'    },
        { ngoName: 'Reforest Tomorrow',        tagline: 'Planting trees, rebuilding futures',  issue: 'deforestation'   },
        { ngoName: 'Hunger Free Schools',      tagline: 'No child learns on an empty stomach', issue: 'food insecurity' },
      ];

      const createdGroups = [];

      for (const fg of fakeGroups) {
        // Generate a random join code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const joinCode = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

        // Fake member UIDs (teacher is member[0] so write permission holds)
        const fakeUids   = [teacherId, `seed_student_${joinCode}_2`, `seed_student_${joinCode}_3`];
        const fakeNames  = ['Teacher (seed)', 'Seed Student 2', 'Seed Student 3'];

        const groupRef = doc(collection(db, 'ngo_groups'));
        await setDoc(groupRef, {
          groupId:        groupRef.id,
          joinCode,
          members:        fakeUids,
          memberNames:    fakeNames,
          createdBy:      teacherId,
          createdAt:      new Date().toISOString(),
          ngoName:        fg.ngoName,
          tagline:        fg.tagline,
          phase1Stage:    5,         // fully approved
          stage1Approved: true,
          stage2Approved: true,
          teacherNote:    '',
          fundingReceived: 0,
          funded:         false,
        });

        // Minimal stage docs so pitch deck page doesn't crash
        await setDoc(doc(db, 'ngo_stage1', groupRef.id), {
          groupId:            groupRef.id,
          issue:              fg.issue,
          whyThisIssue:       'This is a seeded test entry.',
          globalContext:      'Global context placeholder.',
          aiPrompts:          Array.from({ length: 5 }, () => ({ prompt: 'seed prompt', hoping: 'seed result' })),
          locationChosen:     'Canada',
          locationJustification: 'Seeded for testing.',
          roughSolution:      'Seeded solution description.',
          lastUpdated:        new Date().toISOString(),
          contributors:       {},
        });

        await setDoc(doc(db, 'ngo_stage2', groupRef.id), {
          groupId:         groupRef.id,
          specificProblem: 'Seeded specific problem.',
          rootCauses:      'Seeded root causes.',
          whoAffected:     'Seeded affected population.',
          stat1:           '1 in 3 people affected',
          stat1Source:     'WHO (seeded)',
          stat2:           '$2B annual cost',
          stat2Source:     'World Bank (seeded)',
          intervention:    'Seeded intervention plan.',
          timeline:        [],
          budget:          [],
          lastUpdated:     new Date().toISOString(),
          contributors:    {},
        });

        createdGroups.push({ id: groupRef.id, ...fg });
      }

      // Seed a scorecard from the teacher for each group
      for (const g of createdGroups) {
        await setDoc(doc(db, 'ngo_scorecards', `${teacherId}_${g.id}`), {
          scorerId:        teacherId,
          targetGroupId:   g.id,
          impact: 7, feasibility: 8, urgency: 6, creativity: 9, persuasiveness: 7,
          notes:           'Auto-seeded test score.',
          submittedAt:     new Date().toISOString(),
        });
      }

      // Seed a funding allocation splitting budget evenly
      const perGroup  = Math.floor(500000 / createdGroups.length);
      const allocations = createdGroups.map(g => ({ groupId: g.id, amount: perGroup }));
      await setDoc(doc(db, 'ngo_funding', teacherId), {
        studentId:    teacherId,
        allocations,
        submittedAt:  new Date().toISOString(),
        locked:       true,
      });
      for (const g of createdGroups) {
        await updateDoc(doc(db, 'ngo_groups', g.id), {
          fundingReceived: perGroup,
        });
      }

      alert(`✅ Seeded 3 fake groups with scores and funding!\n\nNGOs created:\n${createdGroups.map(g => `• ${g.ngoName}`).join('\n')}\n\nCheck the Groups, Scores, and Funding tabs.`);
    } catch (e) {
      console.error(e);
      alert('Seeding failed: ' + e.message);
    }
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

  // ── Grading aggregate ─────────────────────────────────────────────────────
  const studentList = [];
  groups.forEach(g => {
    (g.members || []).forEach((uid, idx) => {
      const name = (g.memberNames && g.memberNames[idx]) || 'Unknown';
      
      let s1Count = 0;
      let s2Count = 0;
      const s1Tags = stage1All[g.id]?.contributors || {};
      const s2Tags = stage2All[g.id]?.contributors || {};
      
      Object.entries(s1Tags).forEach(([k, arr]) => { if (arr.includes(name)) s1Count++; });
      Object.entries(s2Tags).forEach(([k, arr]) => { if (arr.includes(name)) s2Count++; });
      
      const reflection = reflections.find(r => r.studentId === uid);
      
      const groupReflections = reflections.filter(r => r.groupId === g.id && r.studentId !== uid);
      let peerScoreTotal = 0;
      let peerScoreCount = 0;
      groupReflections.forEach(r => {
        if (r.peerScores && r.peerScores[uid] !== undefined) {
          peerScoreTotal += r.peerScores[uid];
          peerScoreCount++;
        }
      });
      const peerScoreAvg = peerScoreCount > 0 ? (peerScoreTotal / peerScoreCount).toFixed(1) : '—';
      
      studentList.push({
        uid, name, groupId: g.id, ngoName: g.ngoName,
        totalContributions: s1Count + s2Count, s1Count, s2Count, s1Tags, s2Tags,
        selfScore: reflection?.selfScore || '—', peerScoreAvg, reflection
      });
    });
  });

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
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button className="btn btn-sm btn-danger" onClick={restartProject}>Restart Project (Clear Data)</button>
            <button className="btn btn-sm btn-ghost" onClick={seedTestData} style={{ opacity: 0.7 }}>🧪 Seed Test Data</button>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>Current phase</p>
              <h2 style={{ color: 'var(--teal)', margin: 0 }}>{PHASE_LABELS[currentPhase]}</h2>
            </div>
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
                {currentPhase === 4 && 'Phase 4 is open. The simulation results are visible.'}
                {currentPhase === 5 && 'Phase 5 is open. Students are completing their reflections.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {currentPhase > 0 && (
                <button className="btn btn-sm btn-ghost" onClick={goBackPhase} style={{ opacity: 0.7 }}>
                  ← Back to {PHASE_LABELS[currentPhase - 1]}
                </button>
              )}
              {currentPhase < 5 && (
                <button id="advance-phase-btn" className="btn btn-primary" onClick={advancePhase} disabled={advancingPhase}>
                  {advancingPhase ? 'Advancing…' : `Open ${PHASE_LABELS[currentPhase + 1]} →`}
                </button>
              )}
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            {PHASE_LABELS.map((_, i) => (
              <div key={i} style={{ flex: 1, height: 6, borderRadius: 99, background: i <= currentPhase ? 'var(--teal)' : 'var(--navy-4)', transition: 'background 0.4s' }} />
            ))}
          </div>
        </div>

        {/* Phase 2 Setup Widget */}
        {currentPhase === 2 && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(0,194,179,0.3)' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>🎤 Pitch Day Controls</h3>
            <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>Select which NGO is currently presenting. Students will only be able to score the active group.</p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: (settings?.presentingGroupId == null) ? 'var(--navy-3)' : 'transparent', borderRadius: 'var(--radius)', border: (settings?.presentingGroupId == null) ? '1px solid var(--teal)' : '1px solid var(--glass-border)' }}>
                <button className={`btn btn-sm ${(settings?.presentingGroupId == null) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPresentingGroup(null)}>
                  {(settings?.presentingGroupId == null) ? 'Active' : 'Set Active'}
                </button>
                <div>
                  <strong>Waiting Screen</strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Students wait for the next pitch.</p>
                </div>
              </div>
              {groups.map((g) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: settings?.presentingGroupId === g.id ? 'var(--navy-3)' : 'transparent', borderRadius: 'var(--radius)', border: settings?.presentingGroupId === g.id ? '1px solid var(--teal)' : '1px solid var(--glass-border)' }}>
                  <button className={`btn btn-sm ${settings?.presentingGroupId === g.id ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPresentingGroup(g.id)}>
                    {settings?.presentingGroupId === g.id ? 'Presenting' : 'Set Presenting'}
                  </button>
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <strong>{g.ngoName || '(unnamed)'}</strong>
                      {!g.stage2Approved && <span className="badge badge-yellow" style={{ fontSize: '0.6rem' }}>Incomplete</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{g.memberNames.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <DashboardContributors groupId={g.id} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center' }}>
                    <Link to={`/group/${g.id}`} className="btn btn-sm btn-ghost" target="_blank" rel="noopener noreferrer">🔍 View Details</Link>
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
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[['groups', 'Groups'], ['scores', 'Scorecard Results'], ['funding', 'Funding'], ['grading', 'Grading']].map(([key, label]) => (
              <button key={key} className={`btn btn-sm ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveTab(key)} id={`tab-${key}`}>{label}</button>
            ))}
          </div>
          {activeTab === 'funding' && currentPhase >= 3 && (
            <button className="btn btn-sm btn-ghost" onClick={() => setProjectorMode(true)}>
              📺 Projector Mode
            </button>
          )}
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
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                    <Link
                      to={`/group/${g.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: '0.75rem' }}
                    >
                      View Work →
                    </Link>
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
                      <DashboardContributors groupId={g.id} />
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
            {groups.sort((a, b) => (b.fundingReceived ?? 0) - (a.fundingReceived ?? 0)).map((g) => {
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

        {/* Grading Tab */}
        {activeTab === 'grading' && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {studentList.length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
                <p>No students have joined groups yet.</p>
              </div>
            )}
            {studentList.map((st) => (
              <div className="card" key={st.uid}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', cursor: 'pointer' }}
                  onClick={() => setExpandedGroup(expandedGroup === `grading-${st.uid}` ? null : `grading-${st.uid}`)}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {st.name} 
                      <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--text-dim)' }}>
                        ({st.ngoName || 'Unnamed NGO'})
                      </span>
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Contributions</p>
                      <strong style={{ color: 'var(--teal)' }}>{st.totalContributions}</strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Self Score</p>
                      <strong style={{ color: st.selfScore === '—' ? 'var(--text-dim)' : 'var(--success)' }}>{st.selfScore}</strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Peer Avg</p>
                      <strong style={{ color: st.peerScoreAvg === '—' ? 'var(--text-dim)' : 'var(--success)' }}>{st.peerScoreAvg}</strong>
                    </div>
                  </div>
                </div>

                {expandedGroup === `grading-${st.uid}` && (
                  <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem', display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    {/* Contributions Details */}
                    <div>
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--teal)' }}>Exact Contributions</h4>
                      <p style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Stage 1 ({st.s1Count})</p>
                      <ul style={{ margin: '0 0 1rem 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {Object.entries(st.s1Tags).filter(([k, arr]) => arr.includes(st.name)).map(([k]) => (
                          <li key={`s1-${k}`}>{k}</li>
                        ))}
                        {st.s1Count === 0 && <li>None recorded</li>}
                      </ul>
                      <p style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Stage 2 ({st.s2Count})</p>
                      <ul style={{ margin: '0 0 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        {Object.entries(st.s2Tags).filter(([k, arr]) => arr.includes(st.name)).map(([k]) => (
                          <li key={`s2-${k}`}>{k}</li>
                        ))}
                        {st.s2Count === 0 && <li>None recorded</li>}
                      </ul>
                    </div>

                    {/* Reflection Details */}
                    <div>
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: 'var(--yellow)' }}>Reflection Data</h4>
                      {st.reflection ? (
                        <>
                          <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Putting it all together</span>
                              <strong>{st.reflection.projectScores?.puttingItTogether ?? '—'}/10</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Changes from AI</span>
                              <strong>{st.reflection.projectScores?.changesFromAI ?? '—'}/10</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Delivery</span>
                              <strong>{st.reflection.projectScores?.delivery ?? '—'}/10</strong>
                            </div>
                          </div>
                          {st.reflection.comments && (
                            <div style={{ background: 'var(--navy-3)', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                              <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-dim)' }}>"{st.reflection.comments}"</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>Student has not submitted their reflection yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {projectorMode && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--navy-1)', zIndex: 9999,
          padding: '3rem', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
            <div>
              <h1 style={{ fontSize: '3rem', margin: 0 }}>Live Funding</h1>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                Total Allocated: ${(groups.reduce((s, g) => s + (g.fundingReceived ?? 0), 0)).toLocaleString()}
              </p>
            </div>
            <button className="btn btn-ghost" onClick={() => setProjectorMode(false)}>Exit Projector</button>
          </div>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {groups.sort((a, b) => (b.fundingReceived ?? 0) - (a.fundingReceived ?? 0)).map((g) => {
              const pct = Math.min(((g.fundingReceived ?? 0) / 500000) * 100, 100);
              return (
                <div key={g.id} style={{ background: 'var(--navy-2)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '2rem', margin: 0 }}>{g.ngoName || '(unnamed)'}</h2>
                        {g.funded && <span className="badge badge-green" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>FUNDED</span>}
                      </div>
                      <p style={{ fontSize: '1.2rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>"{g.tagline || '—'}"</p>
                    </div>
                    <strong style={{ fontSize: '2.5rem', color: g.funded ? 'var(--success)' : 'var(--teal)', lineHeight: 1 }}>
                      ${(g.fundingReceived ?? 0).toLocaleString()}
                    </strong>
                  </div>
                  <div style={{ height: 24, borderRadius: 99, background: 'var(--navy-4)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: g.funded ? 'var(--success)' : 'var(--teal)', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
