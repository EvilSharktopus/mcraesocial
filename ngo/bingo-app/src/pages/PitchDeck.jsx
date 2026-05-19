// src/pages/PitchDeck.jsx
// Pitch deck brief (7 slides) + PDF download — unlocked when stage2Approved = true
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { generatePdf } from '../utils/pdfGenerator';

const SLIDE_DEFS = [
  {
    num: 1,
    title: 'Hook',
    icon: '🎯',
    hint: 'Open with impact. Make the room care.',
  },
  {
    num: 2,
    title: 'The Problem',
    icon: '⚠️',
    hint: 'Specific problem + root causes + who is affected.',
  },
  {
    num: 3,
    title: 'The Evidence',
    icon: '📊',
    hint: 'Your two statistics, formatted as pull-quotes.',
  },
  {
    num: 4,
    title: 'Our Solution',
    icon: '💡',
    hint: 'Your intervention — what you will actually do.',
  },
  {
    num: 5,
    title: 'Timeline',
    icon: '📅',
    hint: 'Your milestones, presented as a visual roadmap.',
  },
  {
    num: 6,
    title: 'Budget',
    icon: '💰',
    hint: 'Where the $500,000 goes, line by line.',
  },
  {
    num: 7,
    title: 'The Ask',
    icon: '🙌',
    hint: 'Close strong. Restate your NGO name, tagline, and the impact of $500K.',
  },
];

function buildSlides(group, s1, s2) {
  const members = (group.memberNames ?? []).join(', ');
  const timeline = (s2.timeline ?? [])
    .filter((r) => r.month && r.milestone)
    .sort((a, b) => a.month - b.month);
  const budget = (s2.budget ?? []).filter((r) => r.category && r.amount);

  return [
    // Slide 1
    `NGO Name: ${group.ngoName || '—'}\nTagline: ${group.tagline || '—'}\nIssue: ${s1.issue || '—'}`,
    // Slide 2
    `Specific Problem:\n${s2.specificProblem || '—'}\n\nRoot Causes:\n${s2.rootCauses || '—'}\n\nWho Is Affected:\n${s2.whoAffected || '—'}`,
    // Slide 3
    `"${s2.stat1 || '—'}"\nSource: ${s2.stat1Source || '—'}\n\n"${s2.stat2 || '—'}"\nSource: ${s2.stat2Source || '—'}`,
    // Slide 4
    s2.intervention || '—',
    // Slide 5
    timeline.length > 0
      ? timeline.map((r) => `Month ${r.month}: ${r.milestone}`).join('\n')
      : '(No milestones entered)',
    // Slide 6
    budget.length > 0
      ? budget.map((r) => `${r.category}: $${Number(r.amount).toLocaleString()}`).join('\n') +
        `\n\nTotal: $500,000`
      : '(No budget entries)',
    // Slide 7
    `${group.ngoName || '—'}\n"${group.tagline || '—'}"\n\nFunding ask: $500,000\nLocation: ${s1.locationChosen || '—'}\n\nGroup members: ${members}`,
  ];
}

function CopyButton({ text, id }) {
  const [copied, setCopied] = useState(false);
  const t = useRef(null);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button id={id} className="btn btn-sm btn-ghost" onClick={handleCopy} style={{ flexShrink: 0 }}>
      {copied ? '✓ Copied!' : 'Copy'}
    </button>
  );
}

export default function PitchDeck({ groupId }) {
  const [group, setGroup] = useState(null);
  const [s1, setS1]       = useState(null);
  const [s2, setS2]       = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'ngo_groups', groupId),  (s) => s.exists() && setGroup(s.data()));
    const u2 = onSnapshot(doc(db, 'ngo_stage1', groupId),  (s) => s.exists() && setS1(s.data()));
    const u3 = onSnapshot(doc(db, 'ngo_stage2', groupId),  (s) => s.exists() && setS2(s.data()));
    return () => { u1(); u2(); u3(); };
  }, [groupId]);

  if (!group || !s1 || !s2) return <div className="loading-screen"><span className="spinner" /></div>;

  const slides   = buildSlides(group, s1, s2);

  const handlePdf = async () => {
    setPdfLoading(true);
    try {
      await generatePdf({ group, s1, s2 });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div className="phase-badge">Stage 2 Approved ✓</div>
        <h2 style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>Pitch Deck Brief</h2>
        <p>Use this to build your slides in Canva or Google Slides. Copy each slide's content, paste into your deck, and make it look great.</p>
      </div>

      {/* Slide cards */}
      {SLIDE_DEFS.map((def, i) => (
        <div
          key={def.num}
          className="card"
          style={{ marginBottom: '1rem', borderLeft: '3px solid var(--teal)' }}
          id={`pitch-slide-${def.num}`}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{def.icon}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--teal)' }}>
                  Slide {def.num}
                </span>
              </div>
              <h3 style={{ marginTop: '0.2rem' }}>{def.title}</h3>
              <p style={{ fontSize: '0.8rem', marginTop: '0.15rem' }}>{def.hint}</p>
            </div>
            <CopyButton text={slides[i]} id={`copy-slide-${def.num}`} />
          </div>
          <pre style={{
            background: 'var(--navy-3)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius)',
            padding: '1rem',
            fontSize: '0.85rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--text)',
            fontFamily: 'inherit',
            lineHeight: 1.6,
            margin: 0,
          }}>
            {slides[i]}
          </pre>
        </div>
      ))}

      {/* PDF Download */}
      <div className="submit-panel" style={{ marginTop: '2rem' }}>
        <h3>📄 Download Your Info Package</h3>
        <p>
          A formatted one-page PDF with your problem summary, evidence, intervention,
          timeline, and budget chart — ready to share with your teacher.
        </p>
        <button
          id="download-pdf-btn"
          className="btn btn-yellow btn-lg"
          onClick={handlePdf}
          disabled={pdfLoading}
        >
          {pdfLoading ? '⟳ Generating PDF…' : '⬇ Download PDF Info Package'}
        </button>
      </div>
    </div>
  );
}
