// src/components/Stage2Form.jsx
import { useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useStageSync } from '../hooks/useStageSync';
import ContributorTags from './ContributorTags';
import '../styles/worksite.css';

const noPaste = (e) => e.preventDefault();

const BUDGET_EMPTY = { category: '', amount: '' };
const TIMELINE_EMPTY = { month: '', milestone: '' };

function SectionHeader({ num, title, subtitle }) {
  return (
    <div className="section-header">
      <div className="section-num">{num}</div>
      <div>
        <div className="section-title">{title}</div>
        {subtitle && <div className="section-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

function SaveIndicator({ showSaved, saving }) {
  return (
    <span className={`save-indicator ${showSaved ? 'visible' : ''}`}>
      {saving ? '⟳ Saving…' : '✓ Saved'}
    </span>
  );
}

// ── Timeline Component ────────────────────────────────────────────────────
function TimelineEditor({ rows, onChange, onBlur }) {
  const add = () => {
    if (rows.length >= 6) return;
    onChange([...rows, { ...TIMELINE_EMPTY }]);
  };
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          <input
            type="number"
            id={`timeline-month-${i}`}
            placeholder="Mo."
            min={1}
            max={36}
            style={{ width: 70, flexShrink: 0, textAlign: 'center' }}
            value={row.month}
            onChange={(e) => update(i, 'month', e.target.value)}
            onBlur={onBlur}
            onPaste={noPaste}
          />
          <input
            type="text"
            id={`timeline-ms-${i}`}
            placeholder={`Milestone ${i + 1}`}
            style={{ flex: 1 }}
            value={row.milestone}
            onChange={(e) => update(i, 'milestone', e.target.value)}
            onBlur={onBlur}
            onPaste={noPaste}
          />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => remove(i)}
            style={{ flexShrink: 0 }}
            aria-label="Remove milestone"
          >✕</button>
        </div>
      ))}
      <button
        id="add-milestone-btn"
        className="btn btn-sm btn-ghost"
        onClick={add}
        disabled={rows.length >= 6}
        style={{ marginTop: '0.25rem' }}
      >
        + Add Milestone {rows.length > 0 ? `(${rows.length}/6)` : ''}
      </button>
      <span className="field-hint" style={{ marginLeft: '0.75rem' }}>4–6 milestones required</span>
    </div>
  );
}

// ── Horizontal Timeline Preview ───────────────────────────────────────────
function TimelinePreview({ rows }) {
  const sorted = [...rows].filter(r => r.month && r.milestone).sort((a, b) => a.month - b.month);
  if (sorted.length === 0) return null;
  return (
    <div style={{ overflowX: 'auto', paddingBottom: '0.5rem', marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, minWidth: `${sorted.length * 140}px`, position: 'relative' }}>
        {/* Connector line */}
        <div style={{ position: 'absolute', top: 16, left: 40, right: 40, height: 2, background: 'var(--teal)', opacity: 0.3 }} />
        {sorted.map((r, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--teal)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, zIndex: 1, flexShrink: 0,
            }}>
              M{r.month}
            </div>
            <p style={{ fontSize: '0.72rem', textAlign: 'center', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {r.milestone}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Budget Component ──────────────────────────────────────────────────────
const BUDGET_MAX = 500000;

function BudgetEditor({ rows, onChange, onBlur }) {
  const add = () => onChange([...rows, { ...BUDGET_EMPTY }]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  const total = rows.reduce((sum, r) => sum + (parseInt(r.amount, 10) || 0), 0);
  const diff  = BUDGET_MAX - total;
  const exact = total === BUDGET_MAX;

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Category</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Amount ($)</span>
        <span />
      </div>

      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 36px', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <input
            type="text"
            id={`budget-cat-${i}`}
            placeholder="e.g. Staff salaries"
            value={row.category}
            onChange={(e) => update(i, 'category', e.target.value)}
            onBlur={onBlur}
            onPaste={noPaste}
          />
          <input
            type="number"
            id={`budget-amt-${i}`}
            placeholder="0"
            min={0}
            step={1}
            value={row.amount}
            onChange={(e) => update(i, 'amount', Math.floor(Number(e.target.value)).toString())}
            onBlur={onBlur}
            onPaste={noPaste}
            style={{ textAlign: 'right' }}
          />
          <button className="btn btn-sm btn-ghost" onClick={() => remove(i)} aria-label="Remove">✕</button>
        </div>
      ))}

      <button id="add-budget-btn" className="btn btn-sm btn-ghost" onClick={add} style={{ marginTop: '0.25rem' }}>
        + Add Line Item
      </button>

      {/* Running total */}
      <div style={{
        marginTop: '1rem',
        padding: '0.9rem 1.1rem',
        borderRadius: 'var(--radius)',
        background: exact ? 'rgba(52,211,153,0.1)' : total > BUDGET_MAX ? 'rgba(248,113,113,0.1)' : 'var(--navy-3)',
        border: `1px solid ${exact ? 'var(--success)' : total > BUDGET_MAX ? 'var(--error)' : 'var(--glass-border)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700 }}>Total</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            color: exact ? 'var(--success)' : total > BUDGET_MAX ? 'var(--error)' : 'var(--text)',
          }}>
            ${total.toLocaleString()}
          </span>
          {!exact && (
            <p style={{ fontSize: '0.75rem', margin: 0, color: diff > 0 ? 'var(--text-dim)' : 'var(--error)' }}>
              {diff > 0 ? `$${diff.toLocaleString()} remaining` : `$${Math.abs(diff).toLocaleString()} over budget`}
            </p>
          )}
          {exact && <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--success)' }}>✓ Exactly $500,000</p>}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────
export default function Stage2Form({ groupId }) {
  const s2  = useStageSync('ngo_stage2', groupId);
  const grp = useStageSync('ngo_groups',  groupId);

  const submittingRef = useRef(false);
  const submitErrRef  = useRef('');
  const [, setTick] = useState(0);
  const tick = () => setTick((x) => x + 1);

  const v = s2.values;
  const blurSave = () => s2.save();

  // Timeline helpers
  const timeline = v.timeline ?? [];
  const setTimeline = (rows) => { s2.set('timeline', rows); };

  // Budget helpers
  const budget = v.budget ?? [];
  const setBudget = (rows) => { s2.set('budget', rows); };
  const budgetTotal = budget.reduce((sum, r) => sum + (parseInt(r.amount, 10) || 0), 0);
  const budgetExact = budgetTotal === 500000;

  // ── Validation ───────────────────────────────────────────────────────────
  const checks = [
    { label: 'Specific problem',     ok: !!(v.specificProblem?.trim()) },
    { label: 'Root causes',          ok: !!(v.rootCauses?.trim()) },
    { label: 'Who is affected',      ok: !!(v.whoAffected?.trim()) },
    { label: 'Statistic 1 + source', ok: !!(v.stat1?.trim() && v.stat1Source?.trim()) },
    { label: 'Statistic 2 + source', ok: !!(v.stat2?.trim() && v.stat2Source?.trim()) },
    { label: 'Intervention',         ok: !!(v.intervention?.trim()) },
    { label: '4–6 timeline milestones', ok: timeline.filter(r => r.month && r.milestone).length >= 4 },
    { label: 'Budget totals exactly $500,000', ok: budgetExact },
  ];

  // Helper to check if a field has at least one contributor
  const hasContributor = (fieldId) => (v.contributors?.[fieldId]?.length || 0) > 0;

  const tagChecks = [
    { label: 'Contributors: Specific problem', ok: hasContributor('specificProblem') },
    { label: 'Contributors: Root causes', ok: hasContributor('rootCauses') },
    { label: 'Contributors: Who is affected', ok: hasContributor('whoAffected') },
    { label: 'Contributors: Statistic 1', ok: hasContributor('stat1') },
    { label: 'Contributors: Statistic 2', ok: hasContributor('stat2') },
    { label: 'Contributors: Intervention', ok: hasContributor('intervention') },
    { label: 'Contributors: Timeline', ok: hasContributor('timeline') },
    { label: 'Contributors: Budget', ok: hasContributor('budget') },
  ];

  const allChecks = [...checks, ...tagChecks];
  const allGood = allChecks.every((c) => c.ok);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!allGood || submittingRef.current) return;
    submitErrRef.current = '';
    submittingRef.current = true;
    tick();
    try {
      await s2.save();
      await updateDoc(doc(db, 'ngo_groups', groupId), {
        phase1Stage: 4,
        teacherNote: '',
      });
    } catch (e) {
      submitErrRef.current = 'Submission failed. Please try again.';
      submittingRef.current = false;
      tick();
    }
  };

  if (!s2.loaded || !grp.loaded) {
    return <div className="loading-screen"><span className="spinner" /></div>;
  }

  return (
    <div>
      {/* Save bar */}
      <div className="save-bar">
        <div className="save-bar-left">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Stage 2 · Problem, Evidence &amp; Intervention
          </span>
          <SaveIndicator showSaved={s2.showSaved} saving={s2.saving} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Auto-saves every 30s · no copy-paste
        </span>
      </div>

      {/* ── Section 1: Problem ──────────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="1" title="The Problem in Your Location" subtitle="Zoom in from your Stage 1 research to the specific community you chose." />
        <div className="form-group">
          <label htmlFor="s2-specific-problem">What is the specific problem in this community?</label>
          <ContributorTags syncObj={s2} fieldId="specificProblem" memberNames={grp.values.memberNames || []} />
          <textarea id="s2-specific-problem" rows={4} placeholder="Describe the exact problem as it manifests in your chosen location…"
            value={v.specificProblem ?? ''} onChange={(e) => s2.set('specificProblem', e.target.value)}
            onBlur={blurSave} onPaste={noPaste} />
        </div>
        <div className="form-group">
          <label htmlFor="s2-root-causes">What are the root causes?</label>
          <ContributorTags syncObj={s2} fieldId="rootCauses" memberNames={grp.values.memberNames || []} />
          <textarea id="s2-root-causes" rows={4} placeholder="Why does this problem exist? What systemic or structural factors drive it?"
            value={v.rootCauses ?? ''} onChange={(e) => s2.set('rootCauses', e.target.value)}
            onBlur={blurSave} onPaste={noPaste} />
        </div>
        <div className="form-group">
          <label htmlFor="s2-who-affected">Who is most affected?</label>
          <ContributorTags syncObj={s2} fieldId="whoAffected" memberNames={grp.values.memberNames || []} />
          <textarea id="s2-who-affected" rows={3} placeholder="Describe the specific population — age, gender, economic status, location…"
            value={v.whoAffected ?? ''} onChange={(e) => s2.set('whoAffected', e.target.value)}
            onBlur={blurSave} onPaste={noPaste} />
        </div>
      </div>

      {/* ── Section 2: Evidence ─────────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="2" title="The Evidence" subtitle="Two hard statistics with sources. These go on your pitch deck." />
        {[1, 2].map((n) => (
          <div key={n} style={{ marginBottom: n === 1 ? '1.25rem' : 0, padding: '1rem', background: 'var(--navy-3)', borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--yellow)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Statistic {n}
            </p>
            <ContributorTags syncObj={s2} fieldId={`stat${n}`} memberNames={grp.values.memberNames || []} />
            <div className="form-group">
              <label htmlFor={`stat${n}`}>The statistic</label>
              <input id={`stat${n}`} type="text" placeholder='e.g. "3.6 billion people lack access to safe sanitation"'
                value={v[`stat${n}`] ?? ''} onChange={(e) => s2.set(`stat${n}`, e.target.value)}
                onBlur={blurSave} onPaste={noPaste} />
            </div>
            <div className="form-group">
              <label htmlFor={`stat${n}Source`}>Source (URL or citation)</label>
              <input id={`stat${n}Source`} type="text" placeholder="WHO, UNICEF, peer-reviewed journal, news outlet…"
                value={v[`stat${n}Source`] ?? ''} onChange={(e) => s2.set(`stat${n}Source`, e.target.value)}
                onBlur={blurSave} onPaste={noPaste} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 3: Intervention ─────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="3" title="Our Intervention" subtitle="What will your NGO actually do with the $500,000?" />
        <div className="form-group">
          <label htmlFor="s2-intervention">Proposed intervention</label>
          <ContributorTags syncObj={s2} fieldId="intervention" memberNames={grp.values.memberNames || []} />
          <textarea id="s2-intervention" rows={5}
            placeholder="Be specific: what programs, infrastructure, services, or campaigns will you run? Who delivers them? How are people reached?"
            value={v.intervention ?? ''} onChange={(e) => s2.set('intervention', e.target.value)}
            onBlur={blurSave} onPaste={noPaste} />
        </div>
      </div>

      {/* ── Section 4: Timeline ─────────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="4" title="Implementation Timeline" subtitle="4 to 6 milestones showing how your intervention rolls out over time." />
        <ContributorTags syncObj={s2} fieldId="timeline" memberNames={grp.values.memberNames || []} />
        <div style={{ marginBottom: '0.75rem' }}>
          <TimelineEditor
            rows={timeline}
            onChange={(rows) => { setTimeline(rows); s2.save(); }}
            onBlur={blurSave}
          />
        </div>
        <TimelinePreview rows={timeline} />
      </div>

      {/* ── Section 5: Budget ───────────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="5" title="Budget Breakdown" subtitle="Itemize your $500,000. Total must equal exactly $500,000 to submit." />
        <ContributorTags syncObj={s2} fieldId="budget" memberNames={grp.values.memberNames || []} />
        <BudgetEditor
          rows={budget}
          onChange={(rows) => { setBudget(rows); }}
          onBlur={blurSave}
        />
      </div>

      {/* ── Submit Panel ───────────────────────────────────────────────── */}
      <div className="submit-panel">
        <h3>Ready to submit Stage 2?</h3>
        <p>Your teacher will review your evidence, intervention, and budget before approving.</p>
        <ul className="validation-list" style={{ columns: 2, columnGap: '2rem' }}>
          {allChecks.map((c) => (
            <li key={c.label} className={c.ok ? 'ok' : 'todo'}>
              <span>{c.ok ? '✓' : '○'}</span> {c.label}
            </li>
          ))}
        </ul>
        {submitErrRef.current && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{submitErrRef.current}</div>
        )}
        <button
          id="submit-stage2-btn"
          className="btn btn-primary btn-lg"
          disabled={!allGood || submittingRef.current}
          onClick={handleSubmit}
        >
          {submittingRef.current ? 'Submitting…' : 'Submit Stage 2 for Approval →'}
        </button>
      </div>
    </div>
  );
}
