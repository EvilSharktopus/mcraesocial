// src/pages/Teacher.jsx
import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';

const NAV_TABS = ['Readings', 'Classes', 'Grading', 'Settings'];

import { PENDULUM_READINGS } from '../data/pendulumReadings';

// Add placeholder submissions and seminar fields for the teacher view
const TEACHER_READINGS = PENDULUM_READINGS.map(r => ({
  ...r,
  submissions: 0,
  seminar: false
}));

const PLACEHOLDER_CLASSES = [
  { code: 'SS30-A', name: 'Social Studies 30-1 — Block A', students: 24 },
  { code: 'SS30-B', name: 'Social Studies 30-1 — Block B', students: 21 },
];

// ── Shared table/card styles ────────────────────────────────────────────────

const cardStyle = {
  backgroundColor: 'var(--pg-surface)',
  border: '1px solid var(--pg-border)',
  borderRadius: '16px',
};

const btnPrimary = {
  backgroundColor: 'var(--pg-primary)',
  color: 'var(--pg-on-primary)',
};

const btnGhost = {
  backgroundColor: 'var(--pg-surface2)',
  border: '1px solid var(--pg-border)',
  color: 'var(--pg-muted)',
};

// ── Tab panels ──────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function ReadingsTab() {
  const [openReadings, setOpenReadings] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setOpenReadings(docSnap.data().openReadings || []);
      }
    });
    return () => unsub();
  }, []);

  async function toggleOpen(readingId) {
    const current = new Set(openReadings);
    if (current.has(readingId)) {
      current.delete(readingId);
    } else {
      current.add(readingId);
    }
    await setDoc(doc(db, 'settings', 'global'), { openReadings: Array.from(current) }, { merge: true });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>Readings</h1>
        <button className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity" style={btnPrimary}>
          + New Reading
        </button>
      </div>
      <div style={cardStyle} className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--pg-border)' }}>
              {['Title', 'Submissions', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pg-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEACHER_READINGS.map((r, i) => {
              const isOpen = openReadings.includes(r.id);
              return (
                <tr key={r.id} style={{ borderBottom: i < TEACHER_READINGS.length - 1 ? '1px solid var(--pg-border)' : 'none' }}>
                  <td className="px-5 py-4 font-medium" style={{ color: 'var(--pg-text)' }}>{r.title}</td>
                  <td className="px-5 py-4" style={{ color: 'var(--pg-muted)' }}>{r.submissions} students</td>
                  <td className="px-5 py-4">
                    <button 
                      onClick={() => toggleOpen(r.id)}
                      className="text-xs font-semibold hover:opacity-80 transition-opacity px-3 py-1.5 rounded-full border"
                      style={{ 
                        color: isOpen ? '#22c55e' : 'var(--pg-dim)',
                        borderColor: isOpen ? '#22c55e44' : 'var(--pg-border)',
                        backgroundColor: isOpen ? '#22c55e11' : 'transparent'
                      }}
                    >
                      {isOpen ? '● Open' : '○ Closed'}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Link to={`/seminar/${r.id}`} className="text-xs font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--pg-primary)' }}>
                        Launch seminar
                      </Link>
                      <span style={{ color: 'var(--pg-faint)' }}>|</span>
                      <button className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'var(--pg-muted)' }}>View submissions</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ClassesTab() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>Classes</h1>
        <button className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity" style={btnPrimary}>
          + New Class
        </button>
      </div>
      <div className="space-y-3">
        {PLACEHOLDER_CLASSES.map(c => (
          <div key={c.code} className="rounded-2xl p-5 flex items-center justify-between gap-4" style={cardStyle}>
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--pg-dim)' }}>
                Code: <code style={{ color: 'var(--pg-primary)' }}>{c.code}</code>
              </p>
              <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>{c.name}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>{c.students} students</p>
            </div>
            <div className="flex gap-2">
              {['View roster', 'Assign reading'].map(label => (
                <button key={label} className="text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity" style={btnGhost}>{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function GradingTab() {
  return (
    <>
      <h1 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--pg-text)' }}>Grading</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--pg-dim)' }}>Review student plots, justifications, and reflections</p>
      <div className="space-y-3">
        {TEACHER_READINGS.map(r => (
          <div key={r.id} className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>{r.title}</p>
              <span className="text-xs" style={{ color: 'var(--pg-dim)' }}>{r.submissions} submissions</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['View plots', 'View justifications', 'View reflections'].map(label => (
                <button key={label} className="text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity" style={btnGhost}>{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SettingsTab({ userEmail }) {
  return (
    <>
      <h1 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--pg-text)' }}>Settings</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--pg-dim)' }}>Application and role management</p>

      <div className="space-y-4">
        {/* Role promotion */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <h2 className="font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>🔑 Co-Teacher Access</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--pg-muted)' }}>
            Promote a colleague by entering their <code style={{ color: 'var(--pg-primary)' }}>@rvschools.ab.ca</code> email.
            Their role is checked on every login.
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              placeholder="colleague@rvschools.ab.ca"
              className="flex-1 rounded-xl px-4 py-2 text-sm focus:outline-none"
              style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
            />
            <button className="text-sm font-semibold px-4 py-2 rounded-xl opacity-40 cursor-not-allowed" style={btnPrimary} disabled>
              Promote (coming soon)
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--pg-text)' }}>Account</h2>
          {[
            ['Email', userEmail],
            ['Role', 'Teacher'],
            ['Firebase project', 'mcrae-assignments-ca'],
          ].map(([k, v], i, arr) => (
            <div key={k} className="flex justify-between py-2.5 text-sm" style={i < arr.length - 1 ? { borderBottom: '1px solid var(--pg-border)' } : {}}>
              <span style={{ color: 'var(--pg-muted)' }}>{k}</span>
              <span style={{ color: k === 'Role' ? 'var(--pg-primary)' : 'var(--pg-text)', fontFamily: k === 'Firebase project' ? 'monospace' : undefined, fontSize: k === 'Firebase project' ? '11px' : undefined }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Teacher dashboard ───────────────────────────────────────────────────────

export default function Teacher() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Readings');

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar />

      {/* Tab nav */}
      <nav style={{ borderBottom: '1px solid var(--pg-border)', backgroundColor: 'var(--pg-surface)' }}>
        <div className="max-w-6xl mx-auto px-6 flex gap-2">
          {NAV_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="py-3 px-1 text-sm font-semibold border-b-2 transition-colors"
              style={{
                borderBottomColor: activeTab === tab ? 'var(--pg-primary)' : 'transparent',
                color: activeTab === tab ? 'var(--pg-text)' : 'var(--pg-dim)',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {activeTab === 'Readings' && <ReadingsTab />}
        {activeTab === 'Classes'  && <ClassesTab />}
        {activeTab === 'Grading'  && <GradingTab />}
        {activeTab === 'Settings' && <SettingsTab userEmail={user?.email} />}
      </main>
    </div>
  );
}
