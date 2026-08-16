// src/pages/Teacher.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useReadings } from '../hooks/useReadings';
import { PENDULUM_READINGS, positionLabel } from '../data/pendulumReadings';
import { GRADE_SCALE, gradeKey, scoreOf, totalFor } from '../data/rubric';
import ReadingEditorModal from '../components/ReadingEditorModal';

const NAV_TABS = ['Readings', 'Archive', 'Grading', 'Settings'];

const ERA_ORDER = ['1700s', '1800s', '1900s', '2000s'];

// Group readings by era, eras in curriculum order and anything unrecognised last.
function byEra(list) {
  const groups = new Map(ERA_ORDER.map(e => [e, []]));
  for (const r of list) {
    const era = r.century || 'Other';
    if (!groups.has(era)) groups.set(era, []);
    groups.get(era).push(r);
  }
  return [...groups].filter(([, rs]) => rs.length > 0);
}


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

const saveReadings = (readings) =>
  setDoc(doc(db, 'settings', 'masterReadings'), { readings }, { merge: true });

const setArchived = (readings, id, archived) =>
  saveReadings(readings.map(r => (r.id === id ? { ...r, archived } : r)));

function ReadingsTab() {
  const { user } = useAuth();
  const { readings, loading } = useReadings();
  const [openReadings,  setOpenReadings]  = useState([]);
  const [reflectReadings, setReflectReadings] = useState([]);
  const [publishMeta,   setPublishMeta]   = useState({}); // { [id]: { publishedAt, publishedBy } }
  const [publishing,    setPublishing]    = useState({}); // { [id]: true/false }
  const [publishErr,    setPublishErr]    = useState({}); // { [id]: errorString }

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReading, setEditingReading] = useState(null);
  const [actionErr, setActionErr] = useState(null);
  const [collapsedEras, setCollapsedEras] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('pg-collapsed-eras') || '[]')); }
    catch { return new Set(); }
  });

  function toggleEra(era) {
    const next = new Set(collapsedEras);
    next.has(era) ? next.delete(era) : next.add(era);
    localStorage.setItem('pg-collapsed-eras', JSON.stringify([...next]));
    setCollapsedEras(next);
  }

  // Every write goes through this so a failure is visible instead of silent.
  // Permission errors in particular used to leave the button looking fine.
  async function run(what, fn) {
    try {
      setActionErr(null);
      await fn();
    } catch (err) {
      console.error(`${what} failed:`, err);
      setActionErr(
        err.code === 'permission-denied'
          ? `${what} was blocked by Firestore permissions. The security rules need updating for this collection.`
          : `${what} failed: ${err.message}`
      );
    }
  }

  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (snap.exists()) {
        setOpenReadings(snap.data().openReadings || []);
        setReflectReadings(snap.data().reflectReadings || []);
      }
    });
    // Published metadata lives in settings/publishedReadings
    const unsub2 = onSnapshot(doc(db, 'settings', 'publishedReadings'), snap => {
      if (snap.exists()) setPublishMeta(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Reflection mode: students see the whole class's positions and the writing
  // box becomes a reflection box.
  function toggleReflect(readingId) {
    const current = new Set(reflectReadings);
    current.has(readingId) ? current.delete(readingId) : current.add(readingId);
    return run('Switching reflection mode', () =>
      setDoc(doc(db, 'settings', 'global'), { reflectReadings: Array.from(current) }, { merge: true }));
  }

  function toggleOpen(readingId) {
    const current = new Set(openReadings);
    current.has(readingId) ? current.delete(readingId) : current.add(readingId);
    return run('Opening or closing the time period', () =>
      setDoc(doc(db, 'settings', 'global'), { openReadings: Array.from(current) }, { merge: true }));
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
      newReadings.push({ id: newId, ...data });
    }
    await run('Saving the time period', () =>
      setDoc(doc(db, 'settings', 'masterReadings'), { readings: newReadings }, { merge: true }));
    setEditorOpen(false);
  }

  async function handleDeleteReading(id) {
    if (!confirm('Are you sure you want to delete this time period?')) return;
    const newReadings = readings.filter(r => r.id !== id);
    await run('Deleting the time period', () =>
      setDoc(doc(db, 'settings', 'masterReadings'), { readings: newReadings }, { merge: true }));
  }

  // Replace the live list with the standard 14, keeping any doc URL already set
  // for a matching id and archiving whatever is left over.
  async function applyStandardList() {
    if (!confirm(
      `Set the reading list to the standard ${PENDULUM_READINGS.length} time periods?\n\n` +
      'Time periods you have added that are not on the standard list are moved to ' +
      'the Archive tab, not deleted. Student work is not affected.'
    )) return;

    const existing = new Map(readings.map(r => [r.id, r]));
    const standard = PENDULUM_READINGS.map(std => ({
      ...std,
      url: existing.get(std.id)?.url || std.url,
      archived: false,
    }));
    const standardIds = new Set(standard.map(r => r.id));
    const leftovers = readings
      .filter(r => !standardIds.has(r.id))
      .map(r => ({ ...r, archived: true }));

    await run('Loading the standard list', () => saveReadings([...standard, ...leftovers]));
  }

  if (loading) {
    return <div className="p-10 text-center" style={{ color: 'var(--pg-dim)' }}>Loading readings...</div>;
  }

  const active = readings.filter(r => !r.archived);

  return (
    <>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>Readings</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
            Manage time periods. Edit in Google Docs anytime, then hit <strong>Publish ↑</strong> to push the latest version to students.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={applyStandardList}
            className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity"
            style={btnGhost}
            title="Set the list to the standard time periods, archiving anything else"
          >
            Load standard list
          </button>
          <button
            onClick={() => { setEditingReading(null); setEditorOpen(true); }}
            className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity"
            style={btnPrimary}
          >
            + New Time Period
          </button>
        </div>
      </div>

      {actionErr && (
        <div className="rounded-2xl p-4 mb-4 text-sm flex items-start justify-between gap-4"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid #ef4444', color: 'var(--pg-text)' }}>
          <span>⚠ {actionErr}</span>
          <button onClick={() => setActionErr(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      <ReadingEditorModal 
        isOpen={editorOpen} 
        onClose={() => setEditorOpen(false)} 
        onSave={handleSaveReading} 
        reading={editingReading} 
      />

      {active.length === 0 && (
        <div style={cardStyle} className="p-6 text-center">
          <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>No time periods yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
            Use <strong>Load standard list</strong> above to add the standard {PENDULUM_READINGS.length} time periods.
          </p>
        </div>
      )}

      <div className="space-y-6">
      {byEra(active).map(([era, group]) => {
        const eraOpen = !collapsedEras.has(era);
        return (
        <div key={era}>
        <button
          onClick={() => toggleEra(era)}
          className="font-display font-bold text-sm mb-2 px-1 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--pg-muted)' }}
        >
          {eraOpen ? '▾' : '▸'} {era}
          {!eraOpen && <span className="font-normal ml-2">({group.length})</span>}
        </button>
        {eraOpen && (
        <div style={cardStyle} className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--pg-border)' }}>
              {['#', 'Time Period', 'Published', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pg-dim)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.map((r, i) => {
              const isOpen    = openReadings.includes(r.id);
              const isReflect = reflectReadings.includes(r.id);
              const meta      = publishMeta[r.id];
              const isPublished = !!meta;
              const isPub     = publishing[r.id];
              const err       = publishErr[r.id];
              const docUrl    = r.url;

              return (
                <tr key={r.id} style={{ borderBottom: i < group.length - 1 ? '1px solid var(--pg-border)' : 'none' }}>

                  {/* Position in the overall list */}
                  <td className="px-5 py-4 text-xs" style={{ color: 'var(--pg-dim)' }}>
                    {active.indexOf(r) + 1}
                  </td>

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
                    <button
                      onClick={() => toggleReflect(r.id)}
                      className="block mt-1.5 text-xs font-semibold hover:opacity-80 transition-opacity px-3 py-1.5 rounded-full border"
                      style={{
                        color: isReflect ? 'var(--pg-primary)' : 'var(--pg-dim)',
                        borderColor: isReflect ? 'var(--pg-primary)' : 'var(--pg-border)',
                        backgroundColor: isReflect ? 'var(--pg-surface2)' : 'transparent',
                      }}
                      title="Show the class their classmates' positions and switch the writing box to a reflection"
                    >
                      {isReflect ? '◆ Reflecting' : '◇ Reflect'}
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
                        onClick={() => run('Archiving the time period', () => setArchived(readings, r.id, true))}
                        className="text-xs hover:opacity-80 transition-opacity font-semibold"
                        style={{ color: 'var(--pg-muted)' }}
                        title="Move to the Archive tab — hidden from students, not deleted"
                      >
                        Archive
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
        )}
        </div>
        );
      })}
      </div>
    </>
  );
}

function ArchiveTab() {
  const { readings, loading } = useReadings();
  const archived = readings.filter(r => r.archived);

  if (loading) {
    return <div className="p-10 text-center" style={{ color: 'var(--pg-dim)' }}>Loading readings...</div>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>Archive</h1>
        <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
          Time periods no longer in the reading list. Students never see these. Restore one to
          put it back on the Readings tab — the Google Doc link is kept either way.
        </p>
      </div>

      {archived.length === 0 ? (
        <div style={cardStyle} className="p-6 text-center">
          <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>Nothing archived</p>
          <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
            Archiving a time period on the Readings tab moves it here.
          </p>
        </div>
      ) : (
        <div style={cardStyle} className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--pg-border)' }}>
                {['Time Period', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--pg-dim)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archived.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < archived.length - 1 ? '1px solid var(--pg-border)' : 'none' }}>
                  <td className="px-5 py-4 font-medium" style={{ color: 'var(--pg-text)' }}>
                    <div>{r.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>{r.century}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => setArchived(readings, r.id, false)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                        style={btnGhost}
                      >
                        ↩ Restore
                      </button>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--pg-muted)' }}
                      >
                        Docs ↗
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const DESK_SUBMIT_BASE = 'https://desk.mcraesocial.com/submit';

const GRADING_VIEWS = [
  { key: 'plots',          label: 'View plots' },
  { key: 'justifications', label: 'View justifications' },
  { key: 'reflections',    label: 'View reflections' },
  { key: 'grades',         label: 'View grades' },
];



function GradingTab() {
  const { readings, loading } = useReadings();
  const [plots,       setPlots]       = useState(null);
  const [reflections, setReflections] = useState(null);
  const [users,       setUsers]       = useState({});
  const [grades,      setGrades]      = useState({});
  const [expanded,    setExpanded]    = useState(null);   // reading id
  const [view,        setView]        = useState('plots');

  useEffect(() => {
    const rows = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fail = (name, setter) => (error) => {
      console.error(`Error fetching ${name}:`, error);
      setter([]);
    };
    const unsubPlots = onSnapshot(collection(db, 'plots'),
      s => setPlots(rows(s)), fail('plots', setPlots));
    const unsubReflections = onSnapshot(collection(db, 'pg_reflections'),
      s => setReflections(rows(s)), fail('pg_reflections', setReflections));
    const unsubGrades = onSnapshot(collection(db, 'pg_grades'),
      s => setGrades(Object.fromEntries(s.docs.map(d => [d.id, d.data()]))),
      error => console.error('Error fetching grades:', error));
    const unsubUsers = onSnapshot(collection(db, 'users'),
      s => setUsers(Object.fromEntries(s.docs.map(d => [d.id, d.data()]))),
      error => console.error('Error fetching users:', error));
    return () => { unsubPlots(); unsubReflections(); unsubGrades(); unsubUsers(); };
  }, []);

  const who = (uid) => users[uid]?.displayName || users[uid]?.email || uid;

  // Clicking the band already set clears it, so a misclick is undoable.
  async function setGrade(uid, readingId, field, code) {
    const key = gradeKey(uid, readingId);
    const next = grades[key]?.[field] === code ? null : code;
    try {
      await setDoc(doc(db, 'pg_grades', key),
        { uid, readingId, [field]: next, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.error('Failed to save grade:', err);
      alert(err.code === 'permission-denied'
        ? 'Saving the grade was blocked by Firestore permissions — the pg_grades rule is missing.'
        : `Failed to save grade: ${err.message}`);
    }
  }

  if (loading || plots === null || reflections === null) {
    return <div className="p-10 text-center" style={{ color: 'var(--pg-dim)' }}>Loading submissions…</div>;
  }

  const active = readings.filter(r => !r.archived);

  // Everything a student has submitted for one reading, newest name order.
  function submissionsFor(readingId) {
    const byUid = new Map();
    for (const p of plots.filter(p => p.readingId === readingId && p.uid)) {
      byUid.set(p.uid, { uid: p.uid, plot: p, reflection: null });
    }
    for (const f of reflections.filter(f => f.readingId === readingId && f.uid)) {
      const entry = byUid.get(f.uid) || { uid: f.uid, plot: null, reflection: null };
      entry.reflection = f;
      byUid.set(f.uid, entry);
    }
    return [...byUid.values()].sort((a, b) => who(a.uid).localeCompare(who(b.uid)));
  }

  return (
    <>
      <h1 className="font-display font-bold text-xl mb-1" style={{ color: 'var(--pg-text)' }}>Grading</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--pg-dim)' }}>Review student plots, justifications, and reflections</p>

      {active.length === 0 && (
        <div style={cardStyle} className="p-6 text-center">
          <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>No time periods on the reading list yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map(r => {
          const subs      = submissionsFor(r.id);
          const isOpen    = expanded === r.id;
          const nDone     = subs.filter(s => s.reflection).length;

          return (
            <div key={r.id} className="rounded-2xl p-5" style={cardStyle}>
              <div className="flex items-center justify-between mb-3 gap-4">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="font-semibold text-left hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--pg-text)' }}
                >
                  {isOpen ? '▾' : '▸'} {r.title}
                </button>
                <span className="text-xs shrink-0" style={{ color: 'var(--pg-dim)' }}>
                  {subs.length === 0
                    ? 'No submissions'
                    : `${subs.length} submission${subs.length === 1 ? '' : 's'}` +
                      (nDone ? ` · ${nDone} reflected` : '')}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {GRADING_VIEWS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setExpanded(r.id); setView(key); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                    style={isOpen && view === key
                      ? { ...btnGhost, borderColor: 'var(--pg-primary)', color: 'var(--pg-text)' }
                      : btnGhost}
                  >
                    {label}
                  </button>
                ))}
                {r.deskAssignmentId && (
                  <a
                    href={`${DESK_SUBMIT_BASE}/${r.deskAssignmentId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                    style={btnGhost}
                  >
                    Open in Desk ↗
                  </a>
                )}
              </div>

              {isOpen && (
                <div className="mt-4 space-y-2">
                  {subs.length === 0 ? (
                    <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>
                      Nothing submitted for this time period yet.
                    </p>
                  ) : subs.map(s => (
                    <div key={s.uid} className="rounded-xl p-3 text-sm"
                      style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)' }}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-medium" style={{ color: 'var(--pg-text)' }}>{who(s.uid)}</span>
                        <span className="text-[11px] shrink-0" style={{ color: 'var(--pg-dim)' }}>
                          {view === 'grades'
                            ? `${totalFor(grades[gradeKey(s.uid, r.id)])}%`
                            : fmtTs((view === 'reflections' ? s.reflection : s.plot)?.updatedAt)}
                        </span>
                      </div>
                      <GradingDetail
                        view={view}
                        sub={s}
                        grade={grades[gradeKey(s.uid, r.id)]}
                        onGrade={(field, code) => setGrade(s.uid, r.id, field, code)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function RubricRow({ label, value, onPick }) {
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="text-[11px] w-20 shrink-0" style={{ color: 'var(--pg-dim)' }}>{label}</span>
      {GRADE_SCALE.map(g => {
        const on = value === g.code;
        return (
          <button
            key={g.code}
            onClick={() => onPick(g.code)}
            title={`${g.name} — ${g.score}%`}
            className="text-[11px] font-bold px-2 py-1 rounded-md transition-opacity hover:opacity-80 min-w-[2rem]"
            style={on
              ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
              : { backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
          >
            {g.code}
          </button>
        );
      })}
    </div>
  );
}

function GradingDetail({ view, sub, grade, onGrade }) {
  const dim  = { color: 'var(--pg-dim)' };
  const body = { color: 'var(--pg-muted)', whiteSpace: 'pre-wrap' };

  if (view === 'plots') {
    if (!sub.plot) return <p className="text-xs" style={dim}>No position plotted.</p>;
    const moved = sub.reflection && sub.reflection.newPosition !== sub.reflection.originalPosition;
    const placed = [
      typeof sub.plot.positionX === 'number' && `Economic: ${positionLabel(sub.plot.positionX)}`,
      typeof sub.plot.positionY === 'number' && `Political: ${positionLabel(sub.plot.positionY)}`,
    ].filter(Boolean);
    return (
      <p className="text-xs" style={{ color: 'var(--pg-muted)' }}>
        {placed.length ? placed.join('  ·  ') : 'No position plotted.'}
        {moved && (
          <span style={dim}>
            {'  '}→ moved to {positionLabel(sub.reflection.newPosition)} on reflection
          </span>
        )}
      </p>
    );
  }

  if (view === 'justifications') {
    return (
      <>
        {sub.plot?.justification
          ? <p className="text-xs" style={body}>{sub.plot.justification}</p>
          : <p className="text-xs" style={dim}>No justification written.</p>}
        <RubricRow label="Justification" value={grade?.justification}
          onPick={code => onGrade('justification', code)} />
      </>
    );
  }

  if (view === 'reflections') {
    return (
      <>
        {sub.reflection?.reflection
          ? <p className="text-xs" style={body}>{sub.reflection.reflection}</p>
          : <p className="text-xs" style={dim}>No reflection submitted.</p>}
        <RubricRow label="Reflection" value={grade?.reflection}
          onPick={code => onGrade('reflection', code)} />
      </>
    );
  }

  // grades — the two halves and what they add up to
  const j = grade?.justification;
  const f = grade?.reflection;
  const part = (code, missing) => code
    ? `${code} (${scoreOf(code)})`
    : missing;
  return (
    <p className="text-xs" style={{ color: 'var(--pg-muted)' }}>
      Justification {part(j, sub.plot?.justification ? 'ungraded (0)' : 'not submitted (0)')}
      {'  +  '}
      Reflection {part(f, sub.reflection?.reflection ? 'ungraded (0)' : 'not submitted (0)')}
      {'  =  '}
      <span style={{ color: 'var(--pg-text)', fontWeight: 600 }}>
        {scoreOf(j) + scoreOf(f)} ÷ 2 = {totalFor(grade)}%
      </span>
    </p>
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
        {activeTab === 'Archive'  && <ArchiveTab />}
        {activeTab === 'Grading'  && <GradingTab />}
        {activeTab === 'Settings' && <SettingsTab userEmail={user?.email} />}
      </main>
    </div>
  );
}
