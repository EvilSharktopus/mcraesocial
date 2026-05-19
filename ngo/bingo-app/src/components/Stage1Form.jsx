// src/components/Stage1Form.jsx
import { useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useStageSync } from '../hooks/useStageSync';
import '../styles/worksite.css';

// ── Constants ─────────────────────────────────────────────────────────────
const ISSUES = [
  "Women's Rights & Gender Equality",
  "Climate Change & Environmental Justice",
  "Children in Armed Conflict",
  "Refugee & Displacement Crises",
  "Arms Trade & Disarmament",
  "Endangered Species & Biodiversity Loss",
  "Child Labour & Sweatshop Economy",
  "Water Pollution & Access to Clean Water",
  "Fair Trade & Economic Inequality",
  "Human Rights & Political Prisoners",
  "Overpopulation & Urbanization",
  "Pandemics, Disease & Global Health",
  "Food Insecurity & World Hunger",
  "LGBTQ+ Rights & Persecution",
  "Indigenous Rights & Land Sovereignty",
  "Racial Justice & Systemic Racism",
  "Digital Divide & Technology Access",
  "Modern Slavery & Human Trafficking",
  "Mental Health & Global Access to Care",
  "Nuclear Proliferation & WMD Risk",
  "Ocean Pollution & Marine Ecosystems",
  "Deforestation & Habitat Destruction",
  "Access to Education in Conflict Zones",
  "Disability Rights & Inclusion",
];

const GEO_SCAFFOLDS = [
  {
    q: "Where does this issue occur most severely?",
    hint: 'Think beyond "everywhere." Identify a specific country, region, or community that is disproportionately affected.',
  },
  {
    q: "What makes certain places especially vulnerable?",
    hint: "Consider political instability, economic poverty, geographic isolation, cultural factors, or historical inequalities.",
  },
];

const EMPTY_PROMPTS = Array.from({ length: 5 }, () => ({ prompt: '', hoping: '' }));

const noPaste = (e) => e.preventDefault();

// ── Sub-components ────────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────

export default function Stage1Form({ groupId }) {
  // Stage 1 fields sync
  const s1 = useStageSync('ngo_stage1', groupId);
  // Group identity fields sync (ngoName, tagline)
  const grp = useStageSync('ngo_groups', groupId);

  // Track if submitting
  const submittingRef = useRef(false);
  const submitErrRef  = useRef('');

  // Re-render trigger for submit state
  const [, setTick] = useState(0);
  const tick = () => setTick((x) => x + 1);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const prompts = (s1.values.aiPrompts ?? EMPTY_PROMPTS);

  const setPrompt = (idx, field, val) => {
    const updated = [...prompts];
    updated[idx] = { ...updated[idx], [field]: val };
    s1.set('aiPrompts', updated);
  };

  const blurSave = () => s1.save();
  const blurSaveGrp = () => grp.save();

  // ── Validation ───────────────────────────────────────────────────────────

  const v = s1.values;
  const g = grp.values;

  const checks = [
    { label: 'NGO name',             ok: !!(g.ngoName?.trim()) },
    { label: 'Tagline',              ok: !!(g.tagline?.trim()) },
    { label: 'Global issue selected',ok: !!(v.issue) },
    { label: 'Why this issue',       ok: !!(v.whyThisIssue?.trim()) },
    { label: 'Global context',       ok: !!(v.globalContext?.trim()) },
    { label: 'Location chosen',      ok: !!(v.locationChosen?.trim()) },
    { label: 'Location justification', ok: !!(v.locationJustification?.trim()) },
    { label: 'Rough solution',       ok: !!(v.roughSolution?.trim()) },
  ];
  const allGood = checks.every((c) => c.ok);

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!allGood || submittingRef.current) return;
    submitErrRef.current = '';
    submittingRef.current = true;
    setTick();
    try {
      // Save any pending edits first
      await s1.save();
      await grp.save();
      // Advance to awaiting approval
      await updateDoc(doc(db, 'ngo_groups', groupId), {
        phase1Stage: 2,
        teacherNote: '',
      });
    } catch (e) {
      submitErrRef.current = 'Submission failed. Please try again.';
      submittingRef.current = false;
      tick();
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (!s1.loaded || !grp.loaded) {
    return <div className="loading-screen"><span className="spinner" /></div>;
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Save bar */}
      <div className="save-bar">
        <div className="save-bar-left">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Stage 1 · Research &amp; Planning
          </span>
          <SaveIndicator showSaved={s1.showSaved || grp.showSaved} saving={s1.saving || grp.saving} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Auto-saves every 30s · no copy-paste
        </span>
      </div>

      {/* ── Section 1: NGO Identity ────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="1" title="Your NGO Identity" subtitle="Give your organization a name and a rallying cry." />
        <div className="form-group">
          <label htmlFor="ngo-name">NGO Name</label>
          <input
            id="ngo-name"
            type="text"
            placeholder="e.g. WaterForward, RootCause Alliance…"
            value={g.ngoName ?? ''}
            onChange={(e) => grp.set('ngoName', e.target.value)}
            onBlur={blurSaveGrp}
            onPaste={noPaste}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ngo-tagline">Tagline</label>
          <input
            id="ngo-tagline"
            type="text"
            placeholder="One punchy sentence that captures your mission"
            value={g.tagline ?? ''}
            onChange={(e) => grp.set('tagline', e.target.value)}
            onBlur={blurSaveGrp}
            onPaste={noPaste}
          />
          <span className="field-hint">Keep it under 12 words. This appears on the funding board.</span>
        </div>
      </div>

      {/* ── Section 2: The Issue ───────────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="2" title="The Issue" subtitle="Choose the global problem your NGO will tackle." />
        <div className="form-group">
          <label htmlFor="issue-select">Global Issue</label>
          <select
            id="issue-select"
            className="issue-select"
            value={v.issue ?? ''}
            onChange={(e) => { s1.set('issue', e.target.value); s1.save(); }}
          >
            <option value="">— Select an issue —</option>
            {ISSUES.map((iss, i) => (
              <option key={i} value={iss}>{String(i + 1).padStart(2, '0')}. {iss}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Section 3: Why This Matters ───────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader num="3" title="Why This Matters" subtitle="In your own words — no AI, no copy-paste." />
        <div className="form-group">
          <label htmlFor="why-issue">Why did your group choose this issue?</label>
          <textarea
            id="why-issue"
            rows={4}
            placeholder="What drew you to this issue personally? What do you already know or feel about it?"
            value={v.whyThisIssue ?? ''}
            onChange={(e) => s1.set('whyThisIssue', e.target.value)}
            onBlur={blurSave}
            onPaste={noPaste}
          />
        </div>
        <div className="form-group">
          <label htmlFor="global-context">Why does this issue matter globally?</label>
          <textarea
            id="global-context"
            rows={4}
            placeholder="Explain the global scale of this problem. Who is affected? What are the consequences if nothing changes?"
            value={v.globalContext ?? ''}
            onChange={(e) => s1.set('globalContext', e.target.value)}
            onBlur={blurSave}
            onPaste={noPaste}
          />
        </div>
      </div>

      {/* ── Section 4: Geography Research ─────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader
          num="4"
          title="Geography Research"
          subtitle="Use the scaffold questions below to guide your AI research, then pick your location."
        />

        {/* Read-only scaffold questions */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            Research scaffolds — use these to guide your AI prompts below ↓
          </p>
          {GEO_SCAFFOLDS.map((s, i) => (
            <div className="scaffold-card" key={i}>
              <div className="scaffold-q">{i + 1}. {s.q}</div>
              <div className="scaffold-hint">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* 5 AI prompt pairs */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            AI Research Prompts — type your prompts in here, then use them in an AI tool
          </p>
          {prompts.map((p, i) => (
            <div className="ai-prompt-pair" key={i}>
              <div className="ai-prompt-label">
                <span>✦</span> Prompt {i + 1}
              </div>
              <div className="form-group">
                <label htmlFor={`prompt-${i}`}>My prompt to the AI</label>
                <textarea
                  id={`prompt-${i}`}
                  rows={2}
                  placeholder='e.g. "What are the most severely affected communities for water pollution in Southeast Asia?"'
                  value={p.prompt}
                  onChange={(e) => setPrompt(i, 'prompt', e.target.value)}
                  onBlur={blurSave}
                  onPaste={noPaste}
                />
              </div>
              <div className="form-group">
                <label htmlFor={`hoping-${i}`}>What I want to learn from this</label>
                <textarea
                  id={`hoping-${i}`}
                  rows={2}
                  placeholder="Describe what you hope to find out before you run the prompt"
                  value={p.hoping}
                  onChange={(e) => setPrompt(i, 'hoping', e.target.value)}
                  onBlur={blurSave}
                  onPaste={noPaste}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Location fields */}
        <div className="form-group">
          <label htmlFor="location-chosen">Location Chosen</label>
          <input
            id="location-chosen"
            type="text"
            placeholder="Specific community, city, or region (after your research)"
            value={v.locationChosen ?? ''}
            onChange={(e) => s1.set('locationChosen', e.target.value)}
            onBlur={blurSave}
            onPaste={noPaste}
          />
          <span className="field-hint">Be specific — not just a country, but a region or community within it.</span>
        </div>
        <div className="form-group">
          <label htmlFor="location-just">Why did you choose this location?</label>
          <textarea
            id="location-just"
            rows={3}
            placeholder="Use evidence from your research. Why is this location more affected than others?"
            value={v.locationJustification ?? ''}
            onChange={(e) => s1.set('locationJustification', e.target.value)}
            onBlur={blurSave}
            onPaste={noPaste}
          />
        </div>
      </div>

      {/* ── Section 5: Rough Solution ──────────────────────────────────── */}
      <div className="card worksite-section">
        <SectionHeader
          num="5"
          title="Rough Solution Brainstorm"
          subtitle="No pressure — this is early thinking. What could your NGO actually do to help?"
        />
        <div className="form-group">
          <label htmlFor="rough-solution">Your rough solution idea</label>
          <textarea
            id="rough-solution"
            rows={5}
            placeholder="Describe your initial intervention idea. What would you do, who would benefit, and roughly how? You'll refine this in Stage 2."
            value={v.roughSolution ?? ''}
            onChange={(e) => s1.set('roughSolution', e.target.value)}
            onBlur={blurSave}
            onPaste={noPaste}
          />
        </div>
      </div>

      {/* ── Submit Panel ───────────────────────────────────────────────── */}
      <div className="submit-panel">
        <h3>Ready to submit Stage 1?</h3>
        <p>Your teacher will review and either approve or send it back with feedback.</p>

        {/* Checklist */}
        <ul className="validation-list">
          {checks.map((c) => (
            <li key={c.label} className={c.ok ? 'ok' : 'todo'}>
              <span>{c.ok ? '✓' : '○'}</span> {c.label}
            </li>
          ))}
        </ul>

        {submitErrRef.current && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            {submitErrRef.current}
          </div>
        )}

        <button
          id="submit-stage1-btn"
          className="btn btn-primary btn-lg"
          disabled={!allGood || submittingRef.current}
          onClick={handleSubmit}
        >
          {submittingRef.current ? 'Submitting…' : 'Submit Stage 1 for Approval →'}
        </button>
      </div>
    </div>
  );
}
