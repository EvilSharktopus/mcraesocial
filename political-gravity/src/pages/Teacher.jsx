// src/pages/Teacher.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useReadings } from '../hooks/useReadings';
import ReadingEditorModal from '../components/ReadingEditorModal';

const NAV_TABS = ['Readings', 'Classes', 'Grading', 'Settings'];

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

// Helper: format a Firestore Timestamp or JS Date as "Jun 2 · 9:41 am"
function fmtTs(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ReadingsTab() {
  const { user } = useAuth();
  const { readings, loading } = useReadings();
  const [openReadings,  setOpenReadings]  = useState([]);
  const [publishMeta,   setPublishMeta]   = useState({}); // { [id]: { publishedAt, publishedBy } }
  const [publishing,    setPublishing]    = useState({}); // { [id]: true/false }
  const [publishErr,    setPublishErr]    = useState({}); // { [id]: errorString }

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReading, setEditingReading] = useState(null);

  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (snap.exists()) setOpenReadings(snap.data().openReadings || []);
    });
    // Published metadata lives in settings/publishedReadings
    const unsub2 = onSnapshot(doc(db, 'settings', 'publishedReadings'), snap => {
      if (snap.exists()) setPublishMeta(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  async function toggleOpen(readingId) {
    const current = new Set(openReadings);
    current.has(readingId) ? current.delete(readingId) : current.add(readingId);
    await setDoc(doc(db, 'settings', 'global'), { openReadings: Array.from(current) }, { merge: true });
  }

  async function publishReading(r) {
    const url = r.url;
    setPublishing(p => ({ ...p, [r.id]: true }));
    setPublishErr(e => ({ ...e, [r.id]: null }));
    try {
      const res = await fetch('/api/fetch-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');

      // Save the fetched HTML content to Firestore
      await setDoc(doc(db, 'readingContent', r.id), {
        html: data.html,
        publishedAt: serverTimestamp(),
        publishedBy: user?.email || 'teacher',
        sourceUrl: url,
      });
      // Save metadata for the table display
      await setDoc(doc(db, 'settings', 'publishedReadings'),
        { [r.id]: { publishedAt: new Date().toISOString(), publishedBy: user?.email || 'teacher' } },
        { merge: true }
      );
    } catch (err) {
      setPublishErr(e => ({ ...e, [r.id]: err.message }));
    } finally {
      setPublishing(p => ({ ...p, [r.id]: false }));
    }
  }

  async function handleSaveReading(data) {
    let newReadings = [...readings];
    if (editingReading) {
      const idx = newReadings.findIndex(r => r.id === editingReading.id);
      if (idx !== -1) {
        newReadings[idx] = { ...newReadings[idx], ...data };
      }
    } else {
      const newId = 'r' + (readings.length > 0 ? Math.max(...readings.map(r => parseInt(r.id.replace('r','')) || 0)) + 1 : 1);
      newReadings.push({ id: newId, status: 'not-started', ...data });
    }
    await setDoc(doc(db, 'settings', 'masterReadings'), { readings: newReadings }, { merge: true });
    setEditorOpen(false);
  }

  async function handleDeleteReading(id) {
    if (!confirm('Are you sure you want to delete this time period?')) return;
    const newReadings = readings.filter(r => r.id !== id);
    await setDoc(doc(db, 'settings', 'masterReadings'), { readings: newReadings }, { merge: true });
  }

  if (loading) {
    return <div className="p-10 text-center" style={{ color: 'var(--pg-dim)' }}>Loading readings...</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>Readings</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
            Manage time periods. Edit in Google Docs anytime, then hit <strong>Publish ↑</strong> to push the latest version to students.
          </p>
        </div>
        <button
          onClick={() => { setEditingReading(null); setEditorOpen(true); }}
          className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity"
          style={btnPrimary}
        >
          + New Time Period
        </button>
      </div>

      <ReadingEditorModal 
        isOpen={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        onSave={handleSaveReading} 
        reading={editingReading} 
      />

      <div style={cardStyle} className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--pg-border)' }}>
              {['Time Period', 'Published', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pg-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {readings.map((r, i) => {
              const isOpen    = openReadings.includes(r.id);
              const meta      = publishMeta[r.id];
              const isPublished = !!meta;
              const isPub     = publishing[r.id];
              const err       = publishErr[r.id];
              const docUrl    = r.url;

              return (
                <tr key={r.id} style={{ borderBottom: i < readings.length - 1 ? '1px solid var(--pg-border)' : 'none' }}>

                  {/* Title */}
                  <td className="px-5 py-4 font-medium" style={{ color: 'var(--pg-text)' }}>
                    <div>{r.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>{r.century}</div>
                  </td>

                  {/* Published status */}
                  <td className="px-5 py-4">
                    {isPublished ? (
                      <div>
                        <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>✓ Published</span>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--pg-dim)' }}>
                          {fmtTs(meta.publishedAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--pg-dim)' }}>Not published</span>
                    )}
                    {err && (
                      <div className="text-[11px] mt-1" style={{ color: '#ef4444' }} title={err}>
                        ⚠ {err.length > 40 ? err.slice(0, 40) + '…' : err}
                      </div>
                    )}
                  </td>

                  {/* Open/Closed toggle */}
                  <td className="px-5 py-4">
                    <button
                      onClick={() => toggleOpen(r.id)}
                      className="text-xs font-semibold hover:opacity-80 transition-opacity px-3 py-1.5 rounded-full border"
                      style={{
                        color: isOpen ? '#22c55e' : 'var(--pg-dim)',
                        borderColor: isOpen ? '#22c55e44' : 'var(--pg-border)',
                        backgroundColor: isOpen ? '#22c55e11' : 'transparent',
                      }}
                    >
                      {isOpen ? '● Open' : '○ Closed'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Publish button */}
                      <button
                        onClick={() => publishReading(r)}
                        disabled={isPub}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
                        title={isPublished ? 'Re-publish latest version from Google Docs' : 'Fetch content from Google Docs and publish to students'}
                      >
                        {isPub ? '⏳ Publishing…' : isPublished ? '↑ Re-publish' : '↑ Publish'}
                      </button>

                      <span style={{ color: 'var(--pg-faint)' }}>|</span>

                      <button
                        onClick={() => { setEditingReading(r); setEditorOpen(true); }}
                        className="text-xs hover:opacity-80 transition-opacity font-semibold"
                        style={{ color: 'var(--pg-text)' }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteReading(r.id)}
                        className="text-xs hover:opacity-80 transition-opacity font-semibold"
                        style={{ color: 'var(--pg-error)' }}
                      >
                        Delete
                      </button>

                      <span style={{ color: 'var(--pg-faint)' }}>|</span>

                      {/* View Google Doc */}
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--pg-muted)' }}
                      >
                        Docs ↗
                      </a>

                      <span style={{ color: 'var(--pg-faint)' }}>|</span>

                      <Link
                        to={`/seminar/${r.id}`}
                        className="text-xs hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--pg-muted)' }}
                      >
                        Seminar
                      </Link>
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
  const { readings, loading } = useReadings();

  if (loading) {
    return <div className="p-10 text-center" style={{ color: 'var(--pg-dim)' }}>Loading readings...</div>;
  }

  return (
    <>
      <h1 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--pg-text)' }}>Grading</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--pg-dim)' }}>Review student plots, justifications, and reflections</p>
      <div className="space-y-3">
        {readings.map(r => (
          <div key={r.id} className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>{r.title}</p>
              <span className="text-xs" style={{ color: 'var(--pg-dim)' }}>-- submissions</span>
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
