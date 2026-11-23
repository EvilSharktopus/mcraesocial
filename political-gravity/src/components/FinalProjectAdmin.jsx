// src/components/FinalProjectAdmin.jsx
//
// The teacher's side of the final project: the writing window per class, the
// class list, custom-topic approvals, the topic list, and any one student's
// map, entries and integrity signals.
//
// A "class" is the Desk roster's course + stream. Students cannot read the
// roster, so the writing window is stored as the list of student uids it is
// open for (settings/finalProject.openUids) — that list is what the security
// rules check on every swing write, and what the student page reads.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoster, nameFor } from '../hooks/useRoster';
import FinalMap from './FinalMap';
import FinalEntryView from './FinalEntryView';
import {
  COL, SETTINGS_ID, SWING_NUMBERS, SIGNAL_FIELDS, FIELDS, kindOf, isComplete,
  topicKey, topicText, topicStatus, classKeyOf, STARTER_TOPICS,
} from '../data/finalProject';

const btnPrimary = { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' };
const btnGhost   = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const card       = { backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' };
const inputStyle = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const inputClass = 'rounded-lg px-3 py-1.5 text-sm focus:outline-none';

const STATUS = {
  none:     { text: 'No topic yet',     color: 'var(--pg-dim)' },
  chosen:   { text: 'From the list',    color: 'var(--pg-muted)' },
  pending:  { text: 'Needs approval',   color: '#f59e0b' },
  approved: { text: 'Approved',         color: '#22c55e' },
  rejected: { text: 'Rejected',         color: '#ef4444' },
};

const settingsRef = () => doc(db, 'settings', SETTINGS_ID);
const fmtTime = (ms) => {
  const s = Math.round((ms || 0) / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function useCollection(name) {
  const [rows, setRows] = useState(null);
  useEffect(() => onSnapshot(collection(db, name),
    snap => setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error(`Could not read ${name}`, err); setRows([]); }), [name]);
  return rows;
}

// ── Approve / reject a proposed topic ───────────────────────────────────────
function Verdict({ uid, project, review, run }) {
  const [note, setNote] = useState(review?.forTopic === topicKey(project) ? (review?.note ?? '') : '');
  const decide = (status) => run(status === 'approved' ? 'Approving the topic' : 'Rejecting the topic', () =>
    setDoc(doc(db, COL.reviews, uid),
      { uid, status, note: note.trim(), forTopic: topicKey(project), decidedAt: serverTimestamp() }, { merge: true }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="w-full text-xs whitespace-pre-wrap" style={{ color: project.candidates ? 'var(--pg-muted)' : '#f59e0b' }}>
        {project.candidates ? `Candidate swings:\n${project.candidates}` : 'No candidate swings given.'}
      </p>
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note to the student (optional)"
        className={`${inputClass} flex-1 min-w-[12rem]`} style={inputStyle} />
      <button onClick={() => decide('approved')} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}>Approve</button>
      <button onClick={() => decide('rejected')} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnGhost}>Reject</button>
    </div>
  );
}

// ── One student's project ───────────────────────────────────────────────────
function StudentDetail({ uid, name, project, review, swings, signals, run, onClose }) {
  const [n, setN] = useState(1);
  const status = topicStatus(project, review);
  const birthYear = project?.birthYear;
  const sig = signals?.[n]?.fields || {};
  const swing = swings?.[n];
  const labels = { name: 'Short name', ...Object.fromEntries(FIELDS[kindOf(n)].map(f => [f.key, f.label])) };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${name}'s final project`}
        className="rounded-2xl p-6 w-full max-w-5xl my-4 flex flex-col gap-5" style={card} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>{name}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
              {project?.topic ? topicText(project) : 'No topic yet'}
              {project?.custom ? ' (proposed by the student)' : ''}
              {birthYear ? ` · born ${birthYear}` : ''}
              {' · '}<span style={{ color: STATUS[status].color }}>{STATUS[status].text}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-lg px-2" style={{ color: 'var(--pg-muted)' }} aria-label="Close">✕</button>
        </div>

        {project?.custom && project?.topic && <Verdict key={topicKey(project)} uid={uid} project={project} review={review} run={run} />}

        {project?.topic && (
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--pg-muted)' }}>
            <input type="checkbox" checked={!!review?.topicUnlocked}
              onChange={e => run('Changing the topic lock', () =>
                setDoc(doc(db, COL.reviews, uid), { uid, topicUnlocked: e.target.checked }, { merge: true }))} />
            Let this student change topic even though they have started writing
          </label>
        )}

        <div className="flex gap-2 flex-wrap">
          {SWING_NUMBERS.map(k => (
            <button key={k} onClick={() => setN(k)} className="text-sm font-semibold px-3.5 py-1.5 rounded-lg" style={n === k ? btnPrimary : btnGhost}>
              {k}{isComplete(swings?.[k], k, birthYear) ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
          {birthYear
            ? <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--pg-border)' }}>
                <FinalMap birthYear={birthYear} swings={swings || {}} title={project?.topic ? topicText(project) : null} selected={n} onSelect={setN} />
              </div>
            : <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>No birth year yet, so there is no map to draw.</p>}
          <div className="flex flex-col gap-5 min-w-0">
          <div className="rounded-xl p-4" style={inputStyle}>
            {swing ? <FinalEntryView n={n} swing={swing} /> : <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Nothing written for swing {n} yet.</p>}
          </div>
          <div className="rounded-xl p-4" style={inputStyle}>
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--pg-primary)' }}>Integrity signals · swing {n}</p>
            <p className="text-xs mt-1 mb-3" style={{ color: 'var(--pg-dim)' }}>
              Recorded by the student's browser, so read them as a prompt for a conversation, not as proof.
              "Now" is the length of the text as it stands; far more than was typed means it arrived some other way.
            </p>
            <table className="w-full text-xs" style={{ color: 'var(--pg-text)' }}>
              <thead>
                <tr style={{ color: 'var(--pg-dim)' }}>
                  <th className="text-left font-semibold pb-1">Field</th>
                  <th className="text-right font-semibold pb-1">Typed</th>
                  <th className="text-right font-semibold pb-1">Now</th>
                  <th className="text-right font-semibold pb-1">Pastes</th>
                  <th className="text-right font-semibold pb-1">Bulk</th>
                  <th className="text-right font-semibold pb-1">Active</th>
                </tr>
              </thead>
              <tbody>
                {SIGNAL_FIELDS(kindOf(n)).map(f => {
                  const s = sig[f] || {};
                  const now = String(swing?.[f] ?? '').length;
                  const isSource = FIELDS[kindOf(n)].find(x => x.key === f)?.source;
                  const odd = !isSource && ((s.pasteCount || 0) > 0 || (s.bulkCount || 0) > 0 || now > (s.typed || 0) * 1.5 + 20);
                  return (
                    <tr key={f} style={{ borderTop: '1px solid var(--pg-border)', color: odd ? '#f59e0b' : undefined }}>
                      <td className="py-1.5 pr-2">{labels[f]}</td>
                      <td className="py-1.5 text-right">{s.typed || 0}</td>
                      <td className="py-1.5 text-right">{now}</td>
                      <td className="py-1.5 text-right" title={`${s.pasteBlocked || 0} of these were refused by the form`}>
                        {s.pasteCount ? `${s.pasteCount} (${s.pasteChars || 0} ch)` : '—'}
                      </td>
                      <td className="py-1.5 text-right" title="Text that arrived many characters at once without a paste: dictation, autofill, an extension">
                        {s.bulkCount ? `${s.bulkCount} (${s.bulkChars || 0} ch)` : '—'}
                      </td>
                      <td className="py-1.5 text-right">{fmtTime(s.activeMs)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────
export default function FinalProjectAdmin() {
  const roster = useRoster();
  const [settings, setSettings] = useState(null);
  const projectRows = useCollection(COL.projects);
  const reviewRows  = useCollection(COL.reviews);
  const swingRows   = useCollection(COL.swings);
  const signalRows  = useCollection(COL.signals);
  const [classFilter, setClassFilter] = useState(null);
  const [openUid, setOpenUid] = useState(null);
  const [error, setError] = useState(null);
  const [draftTopic, setDraftTopic] = useState({ topic: '', country: '', flag: '' });

  useEffect(() => onSnapshot(settingsRef(),
    s => setSettings(s.exists() ? s.data() : {}),
    err => { console.error('Could not read final project settings', err); setSettings({}); }), []);

  async function run(what, fn) {
    try { setError(null); await fn(); }
    catch (err) {
      console.error(`${what} failed:`, err);
      setError(err.code === 'permission-denied'
        ? `${what} was blocked by Firestore permissions. The security rules need the final-project blocks added.`
        : `${what} failed: ${err.message}`);
    }
  }

  const projects = useMemo(() => Object.fromEntries((projectRows || []).map(p => [p.id, p])), [projectRows]);
  const reviews  = useMemo(() => Object.fromEntries((reviewRows || []).map(r => [r.id, r])), [reviewRows]);
  const byUid = (rows) => {
    const out = {};
    for (const r of rows || []) if (r.uid && r.n) (out[r.uid] ??= {})[r.n] = r;
    return out;
  };
  const swings  = useMemo(() => byUid(swingRows), [swingRows]);
  const signals = useMemo(() => byUid(signalRows), [signalRows]);

  // Classes come from the roster; a project from an account with no roster
  // row still shows, under "No class".
  const classes = useMemo(() => {
    const out = {};
    for (const [uid, row] of Object.entries(roster)) (out[classKeyOf(row)] ??= []).push(uid);
    for (const uid of Object.keys(projects)) if (!roster[uid]) (out['No class'] ??= []).push(uid);
    return out;
  }, [roster, projects]);
  const classNames = Object.keys(classes).sort();
  const openClasses = useMemo(() => settings?.openClasses || [], [settings]);
  const topics = settings?.topics || [];

  const uidsFor = (names) => [...new Set(names.flatMap(c => classes[c] || []))];
  const setWindow = (name, open) => {
    const next = open ? [...new Set([...openClasses, name])] : openClasses.filter(c => c !== name);
    return run(open ? 'Opening the writing window' : 'Closing the writing window', () =>
      setDoc(settingsRef(), { openClasses: next, openUids: uidsFor(next) }, { merge: true }));
  };

  // A student added to an open class after the window was opened is not in
  // openUids yet. Bring the list back in line whenever this tab can see a gap.
  const rosterLoaded = Object.keys(roster).length > 0;
  useEffect(() => {
    if (!settings || !rosterLoaded || !openClasses.length) return;
    const want = [...new Set(openClasses.flatMap(c => classes[c] || []))];
    if (!sameSet(want, settings.openUids || [])) {
      setDoc(settingsRef(), { openUids: want }, { merge: true }).catch(err => console.warn('Window resync failed', err.code));
    }
  }, [settings, rosterLoaded, openClasses, classes]);

  const saveTopics = (next) => run('Saving the topic list', () => setDoc(settingsRef(), { topics: next }, { merge: true }));
  const addTopic = () => {
    const t = { topic: draftTopic.topic.trim(), country: draftTopic.country.trim(), flag: draftTopic.flag.trim() };
    if (!t.topic || !t.country) return;
    saveTopics([...topics, { id: `t${Date.now().toString(36)}`, ...t }]);
    setDraftTopic({ topic: '', country: '', flag: '' });
  };

  if (settings === null || projectRows === null) {
    return <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Loading the final project…</p>;
  }

  const shownClass = classFilter && classes[classFilter] ? classFilter
    : (classNames.find(c => (classes[c] || []).some(u => projects[u])) ?? classNames[0]);
  const students = (classes[shownClass] || [])
    .map(uid => ({ uid, name: nameFor(roster, uid, projects[uid]?.uid ? `Student ${uid.slice(0, 5)}` : uid) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pending = Object.keys(projects).filter(uid => topicStatus(projects[uid], reviews[uid]) === 'pending');
  const classOf = (uid) => (roster[uid] ? classKeyOf(roster[uid]) : 'No class');

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm px-4 py-2 rounded-xl" role="alert" style={{ ...card, borderColor: '#ef4444', color: 'var(--pg-text)' }}>⚠ {error}</p>}

      {/* Writing window */}
      <section className="rounded-2xl p-5" style={card}>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Writing window</h2>
        <p className="text-sm mt-1 mb-3" style={{ color: 'var(--pg-muted)' }}>
          Setup and topic choice are always available. The six swing entries can only be edited while a class's window is open;
          otherwise students see them read-only. It stays as you leave it — nothing closes on a timer.
        </p>
        {classNames.length === 0 && <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>No classes on the roster yet.</p>}
        <div className="flex flex-col gap-2">
          {classNames.map(name => {
            const open = openClasses.includes(name);
            const started = (classes[name] || []).filter(u => projects[u]).length;
            return (
              <div key={name} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={inputStyle}>
                <span className="text-sm">
                  <strong>{name}</strong>
                  <span style={{ color: 'var(--pg-dim)' }}> · {(classes[name] || []).length} students · {started} started</span>
                </span>
                <button onClick={() => setWindow(name, !open)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={{
                    color: open ? '#22c55e' : 'var(--pg-dim)',
                    borderColor: open ? '#22c55e44' : 'var(--pg-border)',
                    backgroundColor: open ? '#22c55e11' : 'transparent',
                  }}>
                  {open ? '● Window open' : '○ Window closed'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Topics waiting on a decision, across every class */}
      {pending.length > 0 && (
        <section className="rounded-2xl p-5" style={{ ...card, borderColor: '#f59e0b' }}>
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Topics waiting for approval ({pending.length})</h2>
          <div className="flex flex-col gap-3 mt-3">
            {pending.map(uid => (
              <div key={uid} className="px-3 py-2.5 rounded-xl flex flex-col gap-2" style={inputStyle}>
                <p className="text-sm">
                  <strong>{topicText(projects[uid])}</strong>
                  <span style={{ color: 'var(--pg-dim)' }}> · {nameFor(roster, uid, 'Unknown student')} · {classOf(uid)}</span>
                </p>
                <Verdict key={topicKey(projects[uid])} uid={uid} project={projects[uid]} review={reviews[uid]} run={run} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Class list */}
      <section className="rounded-2xl p-5" style={card}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Class list</h2>
          <select value={shownClass ?? ''} onChange={e => setClassFilter(e.target.value)} className={inputClass} style={inputStyle}>
            {classNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {students.length === 0 ? <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Nobody in this class yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: 'var(--pg-text)' }}>
              <thead>
                <tr className="text-left text-xs" style={{ color: 'var(--pg-dim)' }}>
                  <th className="font-semibold pb-2">Student</th>
                  <th className="font-semibold pb-2">Topic</th>
                  <th className="font-semibold pb-2">Status</th>
                  <th className="font-semibold pb-2">Entries</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map(({ uid, name }) => {
                  const p = projects[uid];
                  const status = topicStatus(p, reviews[uid]);
                  const complete = SWING_NUMBERS.filter(n => isComplete(swings[uid]?.[n], n, p?.birthYear)).length;
                  const begun = Object.keys(swings[uid] || {}).length;
                  return (
                    <tr key={uid} style={{ borderTop: '1px solid var(--pg-border)' }}>
                      <td className="py-2 pr-3 whitespace-nowrap">{name}</td>
                      <td className="py-2 pr-3">{p?.topic ? topicText(p) : <span style={{ color: 'var(--pg-dim)' }}>—</span>}</td>
                      <td className="py-2 pr-3 whitespace-nowrap" style={{ color: STATUS[status].color }}>{STATUS[status].text}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <strong>{complete}</strong> / 6 complete
                        {begun > complete && <span style={{ color: 'var(--pg-dim)' }}> · {begun - complete} in progress</span>}
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => setOpenUid(uid)} disabled={!p && !begun}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-35" style={btnGhost}>Open</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Topic list */}
      <section className="rounded-2xl p-5" style={card}>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Topic list</h2>
        <p className="text-sm mt-1 mb-3" style={{ color: 'var(--pg-muted)' }}>
          What students choose from in setup. The flag text is shown to them under the topic; topics loaded from the handout also show their starting swing and leads.
          Removing a topic does not affect students who already chose it.
        </p>
        <div className="flex flex-col gap-2">
          {topics.length === 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>No topics yet — students can only propose their own.</p>
              <button onClick={() => saveTopics(STARTER_TOPICS)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}
                title="The 18 topics from the Orbit Map handout, each with its starting swing and three leads">
                Load the handout's {STARTER_TOPICS.length} topics
              </button>
            </div>
          )}
          {topics.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm" style={inputStyle}>
              <span>
                {topicText(t)}
                {t.start && <span style={{ color: 'var(--pg-dim)' }}> · starts from: {t.start}</span>}
                {t.flag && <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>{t.flag}</span>}
              </span>
              <button onClick={() => { if (confirm(`Remove "${topicText(t)}" from the list?`)) saveTopics(topics.filter(x => x.id !== t.id)); }}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={btnGhost}>Remove</button>
            </div>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] mt-3">
          <input type="text" value={draftTopic.topic} onChange={e => setDraftTopic({ ...draftTopic, topic: e.target.value })} placeholder="Topic" className={inputClass} style={inputStyle} />
          <input type="text" value={draftTopic.country} onChange={e => setDraftTopic({ ...draftTopic, country: e.target.value })} placeholder="Country" className={inputClass} style={inputStyle} />
          <input type="text" value={draftTopic.flag} onChange={e => setDraftTopic({ ...draftTopic, flag: e.target.value })} placeholder="Flag text (optional)" className={inputClass} style={inputStyle} />
          <button onClick={addTopic} disabled={!draftTopic.topic.trim() || !draftTopic.country.trim()}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-35" style={btnPrimary}>Add</button>
        </div>
      </section>

      {openUid && (
        <StudentDetail
          uid={openUid}
          name={nameFor(roster, openUid, 'Student')}
          project={projects[openUid]} review={reviews[openUid]}
          swings={swings[openUid]} signals={signals[openUid]}
          run={run} onClose={() => setOpenUid(null)}
        />
      )}
    </div>
  );
}
