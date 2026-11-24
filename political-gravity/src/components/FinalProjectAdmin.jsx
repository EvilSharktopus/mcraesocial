// src/components/FinalProjectAdmin.jsx
//
// The teacher's side of the final project: the writing window per class, the
// class list, topic approvals, the topic list, the wording of the guided
// questions, and any one student's map, cards and integrity signals.
//
// A "class" is the Desk roster's course + stream. Students cannot read the
// roster, so the writing window is stored as the list of student uids it is
// open for (settings/finalProject.openUids) — that list is what the security
// rules check on every swing write, and what the student page reads.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoster, nameFor } from '../hooks/useRoster';
import { useAuth } from '../auth/AuthContext';
import FinalMap from './FinalMap';
import FinalEntryView from './FinalEntryView';
import {
  COL, SETTINGS_ID, SWING_NUMBERS, KINDS, TRACKS, TRACK_IDS, DEFAULT_QUESTIONS, STARTER_TOPICS,
  SEE_TEACHER_MESSAGE, MEASURES, kindOf, questionsFor, signalFields, isComplete, orderProblem,
  topicKey, topicText, topicStatus, classKeyOf, trackLabel, normalizeTopic, mapTitle, mapSubtitle,
  measureOf, openUidsFor, withLatestStarters, startersOutOfDate,
} from '../data/finalProject';

const btnPrimary = { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' };
const btnGhost   = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const card       = { backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' };
const inputStyle = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const innerStyle = { ...inputStyle, backgroundColor: 'var(--pg-bg)' };
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
const Flag = ({ text }) => (text ? (
  <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full align-middle whitespace-nowrap"
    style={{ border: '1px solid var(--pg-primary)', color: 'var(--pg-primary)' }}>{text}</span>
) : null);

function useCollection(name) {
  const [rows, setRows] = useState(null);
  useEffect(() => onSnapshot(collection(db, name),
    snap => setRows(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error(`Could not read ${name}`, err); setRows([]); }), [name]);
  return rows;
}

// ── Approve / reject a held topic ───────────────────────────────────────────
function Verdict({ uid, project, review, run }) {
  const [note, setNote] = useState(review?.forTopic === topicKey(project) ? (review?.note ?? '') : '');
  const decide = (status) => run(status === 'approved' ? 'Approving the topic' : 'Rejecting the topic', () =>
    setDoc(doc(db, COL.reviews, uid),
      { uid, status, note: note.trim(), forTopic: topicKey(project), decidedAt: serverTimestamp() }, { merge: true }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="w-full text-xs whitespace-pre-wrap" style={{ color: project.custom && !project.candidates ? '#f59e0b' : 'var(--pg-muted)' }}>
        {project.custom
          ? (project.candidates
              ? `${project.track === 'big' ? 'Governments to trace' : 'Candidate swings'}:\n${project.candidates}`
              : 'Proposed by the student, with no candidates given.')
          : `From your list, marked “see teacher first”.`}
      </p>
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note to the student (optional)"
        className={`${inputClass} flex-1 min-w-[12rem]`} style={inputStyle} />
      <button onClick={() => decide('approved')} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}>Approve</button>
      <button onClick={() => decide('rejected')} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnGhost}>Reject</button>
    </div>
  );
}

// ── One student's project ───────────────────────────────────────────────────
function StudentDetail({ uid, name, project, review, swings, signals, settings, run, onClose }) {
  const [n, setN] = useState(1);
  const status = topicStatus(project, review);
  const birthYear = project?.birthYear;
  const qFor = (k) => questionsFor(settings, project?.track, kindOf(k));
  const sig = signals?.[n]?.fields || {};
  const swing = swings?.[n];
  const order = orderProblem(swings);
  const held = project?.custom || project?.seeTeacher;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${name}'s final project`}
        className="rounded-2xl p-6 w-full max-w-5xl my-4 flex flex-col gap-5" style={card} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-xl" style={{ color: 'var(--pg-text)' }}>{name}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
              {project?.place ? topicText(project) : 'No topic yet'}
              <Flag text={project?.flag} />
              {project?.track ? ` · ${trackLabel(project.track)} track` : ''}
              {measureOf(project) ? ` · measuring ${measureOf(project)}` : ''}
              {project?.custom ? ' · proposed by the student' : ''}
              {birthYear ? ` · born ${birthYear}` : ''}
              {' · '}<span style={{ color: STATUS[status].color }}>{STATUS[status].text}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-lg px-2" style={{ color: 'var(--pg-muted)' }} aria-label="Close">✕</button>
        </div>

        {held && project?.place && <Verdict key={topicKey(project)} uid={uid} project={project} review={review} run={run} />}

        {project?.place && (
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--pg-muted)' }}>
            <input type="checkbox" checked={!!review?.topicUnlocked}
              onChange={e => run('Changing the topic lock', () =>
                setDoc(doc(db, COL.reviews, uid), { uid, topicUnlocked: e.target.checked }, { merge: true }))} />
            Let this student change track or topic even though they have started writing
          </label>
        )}

        {order && (
          <p className="text-xs" style={{ color: '#f59e0b' }}>
            Swing {order.n} ({order.year}) is dated before swing {order.before} ({order.beforeYear}); their map stays locked until the six are in order.
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          {SWING_NUMBERS.map(k => (
            <button key={k} onClick={() => setN(k)} className="text-sm font-semibold px-3.5 py-1.5 rounded-lg" style={n === k ? btnPrimary : btnGhost}>
              {k}{isComplete(swings?.[k], k, birthYear, qFor(k)) ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] items-start">
          {birthYear
            ? <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--pg-border)' }}>
                <FinalMap birthYear={birthYear} swings={swings || {}} title={mapTitle(project)} subtitle={mapSubtitle(project)} measure={measureOf(project)} selected={n} onSelect={setN} />
              </div>
            : <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>No birth year yet, so there is no map to draw.</p>}
          <div className="flex flex-col gap-5 min-w-0">
            <div className="rounded-xl p-4" style={inputStyle}>
              {swing ? <FinalEntryView n={n} swing={swing} questions={qFor(n)} /> : <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Nothing written for swing {n} yet.</p>}
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
                    <th className="text-left font-semibold pb-1">Box</th>
                    <th className="text-right font-semibold pb-1">Typed</th>
                    <th className="text-right font-semibold pb-1">Now</th>
                    <th className="text-right font-semibold pb-1">Pastes</th>
                    <th className="text-right font-semibold pb-1">Bulk</th>
                    <th className="text-right font-semibold pb-1">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {signalFields(qFor(n)).map(([f, label]) => {
                    const s = sig[f] || {};
                    const now = String(swing?.[f] ?? '').length;
                    const isSource = f === 'source';
                    const odd = !isSource && ((s.pasteCount || 0) > 0 || (s.bulkCount || 0) > 0 || now > (s.typed || 0) * 1.5 + 20);
                    return (
                      <tr key={f} style={{ borderTop: '1px solid var(--pg-border)', color: odd ? '#f59e0b' : undefined }}>
                        <td className="py-1.5 pr-2">{label}</td>
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

// ── Topic editor ────────────────────────────────────────────────────────────
const blankTopic = (track) => ({ id: null, track, name: '', place: '', flag: '', seeTeacher: false, start: '', leads: [], predict: '', measures: [] });

function TopicForm({ initial, onSave, onCancel }) {
  const [t, setT] = useState({ ...initial, leadsText: (initial.leads || []).join('\n') });
  const set = (patch) => setT(prev => ({ ...prev, ...patch }));
  const big = t.track === 'big';
  const ok = t.place.trim() && (big || t.name.trim());
  const cls = `${inputClass} w-full`;
  const small = (text) => <span className="block text-xs mb-1" style={{ color: 'var(--pg-dim)' }}>{text}</span>;
  return (
    <div className="rounded-xl p-3 grid gap-3 sm:grid-cols-2" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
      <label className="block">
        {small('Track')}
        <select value={t.track} onChange={e => set({ track: e.target.value })} className={cls} style={innerStyle}>
          {TRACK_IDS.map(id => <option key={id} value={id}>{TRACKS[id].label}</option>)}
        </select>
      </label>
      <label className="block">
        {small(big ? 'Name (optional — the place is the topic on this track)' : 'Name')}
        <input type="text" value={t.name} onChange={e => set({ name: e.target.value })} placeholder={big ? '' : 'e.g. Carbon pricing'} className={cls} style={innerStyle} />
      </label>
      <label className="block">
        {small('Place')}
        <input type="text" value={t.place} onChange={e => set({ place: e.target.value })} placeholder="e.g. Canada" className={cls} style={innerStyle} />
      </label>
      <label className="block">
        {small('Flag (optional short label, shown beside the topic and on the project)')}
        <input type="text" value={t.flag} onChange={e => set({ flag: e.target.value })} placeholder="e.g. Rejection of liberalism" className={cls} style={innerStyle} />
      </label>
      <label className="block sm:col-span-2">
        {small('A swing to start from (optional, shown before they choose)')}
        <input type="text" value={t.start} onChange={e => set({ start: e.target.value })} className={cls} style={innerStyle} />
      </label>
      <label className="block sm:col-span-2">
        {small('Leads — one per line, in date order. Shown only after they choose, under “Where to look next”. With four hints in all (a starting swing and three leads, or four leads), each lived card points at its own.')}
        <textarea rows={4} value={t.leadsText} onChange={e => set({ leadsText: e.target.value })} className={`${cls} resize-y`} style={innerStyle} />
      </label>
      <label className="block sm:col-span-2">
        {small('A hint for the two predicted swings (optional, shown on cards 5 and 6)')}
        <input type="text" value={t.predict || ''} onChange={e => set({ predict: e.target.value })} className={cls} style={innerStyle} />
      </label>
      <div className="sm:col-span-2">
        {small('Measures that fit — the others are greyed out for students. Leave all unticked to offer all four.')}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {MEASURES.map(m => (
            <label key={m} className="flex items-center gap-1.5 text-sm capitalize" style={{ color: 'var(--pg-text)' }}>
              <input type="checkbox" checked={(t.measures || []).includes(m)}
                onChange={e => set({ measures: e.target.checked ? [...(t.measures || []), m] : (t.measures || []).filter(x => x !== m) })} />
              {m}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2" style={{ color: 'var(--pg-text)' }}>
        <input type="checkbox" checked={t.seeTeacher} onChange={e => set({ seeTeacher: e.target.checked })} />
        See teacher first — shows “{SEE_TEACHER_MESSAGE}” and holds the choice for your approval
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={!ok} className="text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-35" style={btnPrimary}
          onClick={() => onSave(normalizeTopic({ ...t, id: t.id ?? `t${Date.now().toString(36)}`, leads: t.leadsText.split('\n') }))}>
          Save topic
        </button>
        <button onClick={onCancel} className="text-sm font-semibold px-4 py-1.5 rounded-lg" style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

// ── Question wording ────────────────────────────────────────────────────────
// Only label and prompt are editable. The set of questions, their order and
// the extra controls (source, ideology, placement) are fixed in code, because
// answers are saved under each question's id.
function QuestionEditor({ settings, run }) {
  const [draft, setDraft] = useState(() => settings?.questions || {});
  const [dirty, setDirty] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const get = (tr, kind, id, field) => draft?.[tr]?.[kind]?.[id]?.[field] ?? '';
  const set = (tr, kind, id, field, value) => {
    setDraft(prev => ({
      ...prev,
      [tr]: { ...(prev?.[tr] || {}), [kind]: { ...(prev?.[tr]?.[kind] || {}), [id]: { ...(prev?.[tr]?.[kind]?.[id] || {}), [field]: value } } },
    }));
    setDirty(true); setSavedNote(false);
  };
  const save = () => {
    // Keep only real rewordings, so a cleared box goes back to the default.
    const out = {};
    for (const tr of TRACK_IDS) for (const kind of KINDS) for (const q of DEFAULT_QUESTIONS[tr][kind]) {
      const label = get(tr, kind, q.id, 'label').trim(), prompt = get(tr, kind, q.id, 'prompt').trim();
      const o = {};
      if (label && label !== q.label) o.label = label;
      if (prompt && prompt !== q.prompt) o.prompt = prompt;
      if (Object.keys(o).length) ((out[tr] ??= {})[kind] ??= {})[q.id] = o;
    }
    return run('Saving the question wording', async () => {
      await setDoc(settingsRef(), { questions: out }, { mergeFields: ['questions'] });
      setDraft(out); setDirty(false); setSavedNote(true);
    });
  };
  const cls = `${inputClass} w-full`;
  return (
    <div className="flex flex-col gap-3 mt-3">
      {TRACK_IDS.map(tr => KINDS.map(kind => (
        <details key={`${tr}-${kind}`} className="rounded-xl px-3 py-2" style={inputStyle}>
          <summary className="cursor-pointer text-sm font-semibold" style={{ color: 'var(--pg-text)' }}>
            {TRACKS[tr].label} track · {kind} swing
            <span className="font-normal" style={{ color: 'var(--pg-dim)' }}> · {DEFAULT_QUESTIONS[tr][kind].length} questions</span>
          </summary>
          <div className="flex flex-col gap-3 mt-3">
            {DEFAULT_QUESTIONS[tr][kind].map((q, i) => (
              <div key={q.id} className="grid gap-2 sm:grid-cols-[2rem_12rem_1fr] items-start">
                <span className="text-sm pt-1.5" style={{ color: 'var(--pg-dim)' }}>{i + 1}.</span>
                <input type="text" value={get(tr, kind, q.id, 'label')} placeholder={q.label}
                  onChange={e => set(tr, kind, q.id, 'label', e.target.value)} className={cls} style={innerStyle} aria-label={`Label for question ${i + 1}`} />
                <div>
                  <textarea rows={2} value={get(tr, kind, q.id, 'prompt')} placeholder={q.prompt}
                    onChange={e => set(tr, kind, q.id, 'prompt', e.target.value)} className={`${cls} resize-y`} style={innerStyle} aria-label={`Prompt for question ${i + 1}`} />
                  {(q.source || q.ideology || q.placement) && (
                    <span className="block text-[11px]" style={{ color: 'var(--pg-dim)' }}>
                      Also shows {q.source ? 'a pastable source box' : q.ideology ? 'the ideology picker' : 'the placement control'}.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
      )))}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!dirty} className="text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-35" style={btnPrimary}>Save wording</button>
        {savedNote && <span className="text-xs" style={{ color: '#22c55e' }}>✓ Saved — students see it straight away</span>}
      </div>
    </div>
  );
}

// ── The tab ─────────────────────────────────────────────────────────────────
export default function FinalProjectAdmin() {
  const roster = useRoster();
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const projectRows = useCollection(COL.projects);
  const reviewRows  = useCollection(COL.reviews);
  const swingRows   = useCollection(COL.swings);
  const signalRows  = useCollection(COL.signals);
  const [classFilter, setClassFilter] = useState(null);
  const [openUid, setOpenUid] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);   // a topic id, or 'new:<track>'

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
  const topics = useMemo(() => (settings?.topics || []).map(normalizeTopic), [settings]);

  const uidsFor = (names) => [...new Set(names.flatMap(c => classes[c] || []))];
  const setWindow = (name, open) => {
    const next = open ? [...new Set([...openClasses, name])] : openClasses.filter(c => c !== name);
    return run(open ? 'Opening the writing window' : 'Closing the writing window', () =>
      setDoc(settingsRef(), { openClasses: next, openUids: openUidsFor(uidsFor(next), settings?.previewUid) }, { merge: true }));
  };

  // A student added to an open class after the window was opened is not in
  // openUids yet. Bring the list back in line whenever this tab can see a gap.
  const rosterLoaded = Object.keys(roster).length > 0;
  useEffect(() => {
    if (!settings || !rosterLoaded || !openClasses.length) return;
    const want = openUidsFor(openClasses.flatMap(c => classes[c] || []), settings.previewUid);
    if (!sameSet(want, settings.openUids || [])) {
      setDoc(settingsRef(), { openUids: want }, { merge: true }).catch(err => console.warn('Window resync failed', err.code));
    }
  }, [settings, rosterLoaded, openClasses, classes]);

  const saveTopics = (next) => run('Saving the topic list', () => setDoc(settingsRef(), { topics: next }, { merge: true }));
  const saveTopic = (t) => {
    saveTopics(topics.some(x => x.id === t.id) ? topics.map(x => (x.id === t.id ? t : x)) : [...topics, t]);
    setEditing(null);
  };

  if (settings === null || projectRows === null) {
    return <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Loading the final project…</p>;
  }

  const qFor = (p, n) => questionsFor(settings, p?.track, kindOf(n));
  // The teacher's own practice project (Settings → Student view) sits in
  // the list like any other, so approvals and the detail view can be tried.
  const nameOf = (uid) => (uid === user?.uid ? 'You · student view' : nameFor(roster, uid, `Student ${uid.slice(0, 5)}`));
  const shownClass = classFilter && classes[classFilter] ? classFilter
    : (classNames.find(c => (classes[c] || []).some(u => projects[u])) ?? classNames[0]);
  const students = (classes[shownClass] || [])
    .map(uid => ({ uid, name: nameOf(uid) }))
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
          Setup and topic choice are always available. The six cards can only be edited while a class's window is open;
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
                  <Flag text={projects[uid].flag} />
                  <span style={{ color: 'var(--pg-dim)' }}> · {trackLabel(projects[uid].track)} track · {nameOf(uid)} · {classOf(uid)}</span>
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
                  <th className="font-semibold pb-2">Track</th>
                  <th className="font-semibold pb-2">Topic</th>
                  <th className="font-semibold pb-2">Status</th>
                  <th className="font-semibold pb-2">Cards</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map(({ uid, name }) => {
                  const p = projects[uid];
                  const status = topicStatus(p, reviews[uid]);
                  const complete = SWING_NUMBERS.filter(n => isComplete(swings[uid]?.[n], n, p?.birthYear, qFor(p, n))).length;
                  const begun = Object.keys(swings[uid] || {}).length;
                  return (
                    <tr key={uid} style={{ borderTop: '1px solid var(--pg-border)' }}>
                      <td className="py-2 pr-3 whitespace-nowrap">{name}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{trackLabel(p?.track) || <span style={{ color: 'var(--pg-dim)' }}>—</span>}</td>
                      <td className="py-2 pr-3">
                        {p?.place ? <>{topicText(p)}<Flag text={p.flag} /></> : <span style={{ color: 'var(--pg-dim)' }}>—</span>}
                        {measureOf(p) && <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>measuring {measureOf(p)}</span>}
                      </td>
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
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Topics</h2>
        <p className="text-sm mt-1 mb-3" style={{ color: 'var(--pg-muted)' }}>
          What students choose from in setup, by track. Editing or removing a topic does not change the choice of a student who already made it,
          except that its leads follow your edits.
        </p>
        {topics.length === 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>No topics yet — students can only propose their own.</p>
            <button onClick={() => saveTopics(STARTER_TOPICS)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}>
              Load the starting list ({STARTER_TOPICS.filter(t => t.track === 'sector').length} sector, {STARTER_TOPICS.filter(t => t.track === 'big').length} big picture)
            </button>
          </div>
        )}
        {startersOutOfDate(topics) && (
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3 px-3 py-2 rounded-xl" style={{ ...inputStyle, borderColor: '#f59e0b' }}>
            <p className="text-sm" style={{ color: 'var(--pg-text)' }}>
              The built-in starting topics have been revised since you loaded them.
            </p>
            <button className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}
              onClick={() => {
                if (confirm('Replace the built-in topics with the latest versions?\n\n' +
                  'Topics you added yourself are kept. Any edits you made to a built-in topic (a flag, reworded leads) are overwritten. ' +
                  'Students who already chose a topic keep it.')) saveTopics(withLatestStarters(topics));
              }}>
              Update starting topics
            </button>
          </div>
        )}
        {TRACK_IDS.map(tr => (
          <div key={tr} className="mb-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-bold" style={{ color: 'var(--pg-text)' }}>{TRACKS[tr].label} track</h3>
              <button onClick={() => setEditing(`new:${tr}`)} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={btnGhost}>+ Add topic</button>
            </div>
            <div className="flex flex-col gap-2">
              {editing === `new:${tr}` && <TopicForm initial={blankTopic(tr)} onSave={saveTopic} onCancel={() => setEditing(null)} />}
              {topics.filter(t => t.track === tr).map(t => (editing === t.id
                ? <TopicForm key={t.id} initial={t} onSave={saveTopic} onCancel={() => setEditing(null)} />
                : (
                  <div key={t.id} className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl text-sm" style={inputStyle}>
                    <span className="min-w-0">
                      {topicText(t)}<Flag text={t.flag} />
                      {t.seeTeacher && <span className="ml-2 text-[11px] font-semibold" style={{ color: '#f59e0b' }}>⚑ see teacher first</span>}
                      {(t.start || t.leads.length > 0 || t.predict) && (
                        <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>
                          {[t.start && `starts from: ${t.start}`, t.leads.length > 0 && `leads: ${t.leads.join(' / ')}`, t.predict && `predictions: ${t.predict}`].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>
                        measures: {t.measures.length ? t.measures.join(', ') : 'all four'}
                      </span>
                    </span>
                    <span className="flex gap-1.5 shrink-0">
                      <button onClick={() => setEditing(t.id)} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={btnGhost}>Edit</button>
                      <button onClick={() => { if (confirm(`Remove "${topicText(t)}" from the list?`)) saveTopics(topics.filter(x => x.id !== t.id)); }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={btnGhost}>Remove</button>
                    </span>
                  </div>
                )))}
              {topics.filter(t => t.track === tr).length === 0 && editing !== `new:${tr}` && (
                <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>Nothing on this track yet.</p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Question wording */}
      <section className="rounded-2xl p-5" style={card}>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Questions</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
          Reword any label or prompt. The grey text is the built-in wording; type over it to change it, clear the box to go back.
          Answers already written stay attached to their question.
        </p>
        <QuestionEditor settings={settings} run={run} />
      </section>

      {openUid && (
        <StudentDetail
          uid={openUid}
          name={nameOf(openUid)}
          project={projects[openUid]} review={reviews[openUid]}
          swings={swings[openUid]} signals={signals[openUid]} settings={settings}
          run={run} onClose={() => setOpenUid(null)}
        />
      )}
    </div>
  );
}
