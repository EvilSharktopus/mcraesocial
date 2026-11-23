// src/pages/FinalProject.jsx
//
// The Social 30-1 final project, student side: setup (birth year + topic),
// six swing entries, then the generated map.
//
// Saving follows the reading page's rule that nothing typed is trusted to one
// button: each edit is mirrored to this device, autosaved a moment later, and
// the on-device copy is only dropped once Firestore confirms.
//
// The six entries are written in class. The teacher opens a writing window;
// outside it the security rules refuse swing writes, so the forms here go
// read-only rather than pretending to save.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, doc, getDocs, increment, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import FinalMap from '../components/FinalMap';
import { exportMapPng } from '../utils/exportMapPng';
import FinalEntryView from '../components/FinalEntryView';
import {
  COL, SETTINGS_ID, END_YEAR, SWING_NUMBERS, IDEOLOGIES, MONTHS, FIELDS, WORD_TARGET,
  SWING_TESTS, kindOf, blankSwing, swingWords, yearProblem, missingFrom, isComplete, stateLabel,
  topicText, topicStatus, setupDone,
} from '../data/finalProject';

const AUTOSAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS    = 10_000;
const IDLE_CAP_MS       = 30_000;  // a pause longer than this is not "active time"
const BULK_INSERT       = 25;      // characters arriving in one input event

const draftKey = (uid, n) => `pg-final-draft:${uid}:${n}`;
const readDraft = (key) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } };
const writeDraft = (key, fields) => { try { localStorage.setItem(key, JSON.stringify({ fields, at: Date.now() })); } catch { /* autosave still runs */ } };
const clearDraft = (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };
const millis = (ts) => ts?.toMillis?.() ?? 0;

const SWING_KEYS = Object.keys(blankSwing());
const pick = (d) => Object.fromEntries(SWING_KEYS.map(k => [k, d?.[k] ?? blankSwing()[k]]));
const same = (a, b) => SWING_KEYS.every(k => (a?.[k] ?? null) === (b?.[k] ?? null));

const inputStyle = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const btnPrimary = { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' };
const btnGhost   = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const card       = { backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' };

// Integrity signals for one entry, counted per field and handed to the save
// engine in batches. Kept outside React: it is bookkeeping, not state.
//   typed       characters that arrived a keystroke at a time
//   bulk*       characters that arrived many at once without a paste event
//               (dictation, autofill, an extension)
//   paste*      pastes and drops, including the ones the form refused
//   activeMs    time in the box, ignoring pauses longer than IDLE_CAP_MS
function makeTracker() {
  let pending = {};
  const last = {};     // field -> time of last activity
  const pasted = {};   // field -> a permitted paste is about to land
  const bump = (field, counter, by) => {
    const f = (pending[field] ??= {});
    f[counter] = (f[counter] ?? 0) + by;
  };
  const active = (field) => {
    const now = Date.now();
    if (last[field]) bump(field, 'activeMs', Math.min(now - last[field], IDLE_CAP_MS));
    last[field] = now;
  };
  return {
    focus: (field) => { last[field] = Date.now(); },
    blur: (field) => { active(field); last[field] = null; },
    input: (field, grew) => {
      active(field);
      if (pasted[field]) pasted[field] = false;
      else if (grew >= BULK_INSERT) { bump(field, 'bulkCount', 1); bump(field, 'bulkChars', grew); }
      else if (grew > 0) bump(field, 'typed', grew);
    },
    paste: (field, chars, allowed) => {
      bump(field, 'pasteCount', 1); bump(field, 'pasteChars', chars);
      if (allowed) pasted[field] = true; else bump(field, 'pasteBlocked', 1);
    },
    take: () => { const out = pending; pending = {}; return out; },
  };
}

// ── One swing entry ─────────────────────────────────────────────────────────
function SwingEditor({ n, uid, birthYear, initial, previous, readOnly, onChange }) {
  const kind = kindOf(n);
  const key = draftKey(uid, n);

  // A draft on this device that is newer than the saved copy is the student's
  // latest work (a closed tab, a dropped connection) — start from it.
  const [start] = useState(() => {
    const saved = pick(initial);
    const draft = readDraft(key);
    if (draft?.fields && !same(draft.fields, saved) && draft.at >= millis(initial?.updatedAt)) {
      return { fields: pick(draft.fields), restored: true };
    }
    if (draft) clearDraft(key);
    return { fields: saved, restored: false };
  });
  const [s, setS] = useState(start.fields);
  const [saveState, setSaveState] = useState(start.restored ? 'unsaved' : 'idle');
  const [saveError, setSaveError] = useState(null);
  const [pasteNote, setPasteNote] = useState(false);

  const latest   = useRef(s);
  const dirty    = useRef(start.restored);
  const timer    = useRef(null);
  const chain    = useRef(Promise.resolve());
  const roRef    = useRef(readOnly);
  const [track] = useState(makeTracker);
  useEffect(() => { roRef.current = readOnly; }, [readOnly]);
  const flushRef = useRef(null);   // lets the retry timer reach flush without self-reference

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const job = async () => {
      // Integrity signals go up on their own: they are always writable, and a
      // refused paste is worth recording even when no text changed.
      const pending = track.take();
      if (Object.keys(pending).length) {
        const fields = Object.fromEntries(Object.entries(pending).map(([f, c]) =>
          [f, Object.fromEntries(Object.entries(c).map(([k, v]) => [k, increment(v)]))]));
        setDoc(doc(db, COL.signals, `${uid}_${n}`), { uid, n, fields, updatedAt: serverTimestamp() }, { merge: true })
          .catch(err => console.warn('Signals not saved', err.code));
      }
      if (!dirty.current || roRef.current) return;
      const snapshot = latest.current;
      dirty.current = false;
      setSaveState('saving');
      try {
        await setDoc(doc(db, COL.swings, `${uid}_${n}`),
          { uid, n, kind, ...snapshot, updatedAt: serverTimestamp() }, { merge: true });
        if (!dirty.current) { clearDraft(key); setSaveState('saved'); setSaveError(null); }
      } catch (err) {
        console.error('Swing autosave failed', err);
        dirty.current = true;
        setSaveState('error');
        setSaveError(err.code === 'permission-denied'
          ? 'The writing window is closed, so this was not saved to the server. Your words are kept on this device and will save when the window reopens.'
          : 'Could not reach the server. Your work is kept on this device and will retry.');
        timer.current = setTimeout(() => flushRef.current?.(), RETRY_DELAY_MS);
      }
    };
    const run = chain.current.then(job, job);
    chain.current = run.catch(() => {});
    return run;
  }, [uid, n, kind, key, track]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current?.(), AUTOSAVE_DELAY_MS);
  }, []);

  // A restored draft, or the window reopening, sends whatever is waiting.
  useEffect(() => { if (!readOnly && dirty.current) schedule(); }, [readOnly, schedule]);

  // Leaving — another tab of the form, a closed laptop — sends what is pending.
  useEffect(() => {
    const onHide = () => flushRef.current?.();
    const onVis = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(timer.current);
      onHide();
    };
  }, []);

  const edit = (patch) => {
    if (readOnly) return;
    const next = { ...latest.current, ...patch };
    latest.current = next;
    dirty.current = true;
    setS(next);
    writeDraft(key, next);
    setSaveState('unsaved');
    onChange(n, next);
    schedule();
  };

  // Handlers for a text box: counts typing, time and pastes for the teacher.
  const text = (field, { allowPaste = false } = {}) => ({
    value: s[field] ?? '',
    disabled: readOnly,
    onFocus: () => track.focus(field),
    onBlur: () => { track.blur(field); schedule(); },
    onChange: (e) => {
      const v = e.target.value;
      const grew = v.length - String(latest.current[field] ?? '').length;
      track.input(field, grew);
      edit({ [field]: v });
    },
    onPaste: (e) => {
      track.paste(field, (e.clipboardData?.getData('text') ?? '').length, allowPaste);
      if (allowPaste) return;
      e.preventDefault();
      setPasteNote(true);
      schedule();
    },
    onDrop: (e) => {
      track.paste(field, (e.dataTransfer?.getData('text') ?? '').length, allowPaste);
      if (allowPaste) return;
      e.preventDefault();
      setPasteNote(true);
      schedule();
    },
  });

  const words = swingWords(s, n);
  const yearIssue = s.year !== null ? yearProblem(s, n, birthYear) : null;
  const outOfOrder = typeof s.year === 'number' && typeof previous?.year === 'number' && s.year < previous.year;
  const missing = missingFrom(s, n, birthYear);
  const placed = typeof s.placement === 'number';
  const label = (t) => <span className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>{t}</span>;
  const hint = (t) => t && <span className="block text-xs mb-1.5" style={{ color: 'var(--pg-dim)' }}>{t}</span>;
  const boxClass = 'w-full rounded-xl px-3 py-2 text-sm focus:outline-none disabled:opacity-60';

  const fields = FIELDS[kind];
  const renderField = (f) => (
    <label key={f.key} className="block">
      {label(f.key === 'placementReason' && n > 1 ? `Why more or less state than swing ${n - 1}?` : f.label)}
      {hint(f.hint)}
      {f.source
        ? <input type="text" {...text(f.key, { allowPaste: true })} placeholder="https://… or a citation" className={boxClass} style={inputStyle} />
        : <textarea {...text(f.key)} rows={f.rows} className={`${boxClass} resize-y`} style={inputStyle} />}
    </label>
  );
  const before = fields.filter(f => !['principle', 'placementReason'].includes(f.key) && !(kind === 'lived' && f.key === 'source') && f.key !== 'proofAgainst');
  const after  = fields.filter(f => (kind === 'lived' && f.key === 'source') || f.key === 'proofAgainst');

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-5" style={card}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--pg-primary)' }}>
            Evidence card {n} of 6 · {kind === 'lived' ? 'Lived swing' : `Predicted swing — by about ${END_YEAR}`}
          </p>
          <details className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
            <summary className="cursor-pointer">A swing is a decision that moved the state toward or away from intervention. It must pass three tests.</summary>
            <ol className="list-decimal ml-5 mt-1.5 flex flex-col gap-0.5">
              {SWING_TESTS.map(([t, d]) => <li key={t}><strong style={{ color: 'var(--pg-muted)' }}>{t}.</strong> {d}</li>)}
            </ol>
            <p className="mt-1.5">A speech, a promise, a protest or a poll is not a swing — those are evidence of the pressure behind one.</p>
          </details>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold" style={{ color: words >= WORD_TARGET * 0.8 ? 'var(--pg-text)' : 'var(--pg-muted)' }}>
            {words} / about {WORD_TARGET} words
          </p>
          <p className="text-[11px]" role="status" aria-live="polite"
            style={{ color: saveState === 'error' ? '#ef4444' : 'var(--pg-dim)' }}>
            {readOnly ? 'Read-only' : saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes'
              : saveState === 'saved' ? 'Saved' : saveState === 'error' ? '⚠ Not saved' : 'Autosaves as you type'}
          </p>
        </div>
      </div>

      {saveState === 'error' && saveError && (
        <p className="text-xs px-3 py-2 rounded-lg" role="alert" style={{ ...inputStyle, borderColor: '#ef4444' }}>⚠ {saveError}</p>
      )}
      {start.restored && saveState !== 'saved' && (
        <p className="text-xs px-3 py-2 rounded-lg" role="status" style={inputStyle}>↩ Restored unsaved work from this device.</p>
      )}
      {pasteNote && (
        <p className="text-xs px-3 py-2 rounded-lg flex justify-between gap-3" role="status" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
          <span>Pasting is off in the writing boxes — type it in your own words. Source boxes accept a paste.</span>
          <button onClick={() => setPasteNote(false)} aria-label="Dismiss" style={{ color: 'var(--pg-muted)' }}>✕</button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          {label('Short name')}
          {hint('A few words. This is the label on your map.')}
          <input type="text" maxLength={60} {...text('name')} className={boxClass} style={inputStyle} />
        </label>
        <label className="block">
          {label(kind === 'lived' ? 'Year' : 'Approximate year')}
          {hint(kind === 'lived' ? `${birthYear} to now` : `After ${new Date().getFullYear()}, by ${END_YEAR}`)}
          <input type="number" inputMode="numeric" disabled={readOnly}
            value={s.year ?? ''} onChange={e => edit({ year: e.target.value === '' ? null : Math.trunc(Number(e.target.value)) })}
            className={`${boxClass} w-28`} style={inputStyle} />
        </label>
        {kind === 'lived' && (
          <label className="block">
            {label('Month')}
            {hint('Optional')}
            <select disabled={readOnly} value={s.month ?? ''} onChange={e => edit({ month: e.target.value === '' ? null : Number(e.target.value) })}
              className={boxClass} style={inputStyle}>
              <option value="">—</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        )}
      </div>
      {yearIssue && <p className="text-xs -mt-3" style={{ color: '#ef4444' }}>{yearIssue}</p>}
      {!yearIssue && outOfOrder && (
        <p className="text-xs -mt-3" style={{ color: 'var(--pg-muted)' }}>
          This is earlier than swing {n - 1} ({previous.year}). Swings are numbered in date order — check both dates.
        </p>
      )}

      {before.map(renderField)}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <label className="block">
          {label('Ideology')}
          {hint('Which ideology does this decision reflect?')}
          <select disabled={readOnly} value={s.ideology ?? ''} onChange={e => edit({ ideology: e.target.value })} className={boxClass} style={inputStyle}>
            <option value="">Choose…</option>
            {IDEOLOGIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        {renderField(fields.find(f => f.key === 'principle'))}
      </div>

      <div>
        {label('Placement')}
        {hint('How far does the state intervene after this swing?')}
        <div className="rounded-xl px-4 pt-3 pb-2" style={inputStyle}>
          <Spectrum
            value={s.placement ?? 0}
            onChange={(v) => edit({ placement: v })}
            disabled={readOnly}
            leftLabel="More state" rightLabel="Less state" sublabels={[]}
            formatValue={(v) => (placed ? stateLabel(v) : 'Drag to place')}
            secondaryDot={typeof previous?.placement === 'number' ? { value: previous.placement, label: `Swing ${n - 1}` } : null}
          />
          {typeof previous?.placement === 'number' && (
            <p className="text-[11px] text-center mt-1" style={{ color: 'var(--pg-dim)' }}>The faint dot is swing {n - 1}.</p>
          )}
        </div>
      </div>
      {renderField(fields.find(f => f.key === 'placementReason'))}

      {after.map(renderField)}

      <p className="text-xs" style={{ color: missing.length ? 'var(--pg-muted)' : '#22c55e' }}>
        {missing.length ? `Still needed: ${missing.join(', ')}.` : '✓ This entry is complete.'}
      </p>
    </div>
  );
}

// ── Setup: birth year + topic ───────────────────────────────────────────────
function Setup({ uid, project, review, topics, topicLocked, onDone }) {
  const thisYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useState(project?.birthYear ?? '');
  const [mode, setMode] = useState(project?.topic ? (project.custom ? 'custom' : project.topicId ?? '') : '');
  const [topic, setTopic] = useState(project?.custom ? project.topic : '');
  const [country, setCountry] = useState(project?.custom ? project.country : '');
  const [candidates, setCandidates] = useState(project?.candidates ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const status = topicStatus(project, review);
  const by = Number(birthYear);
  const yearOk = Number.isInteger(by) && by >= thisYear - 80 && by <= thisYear - 10;
  const chosen = mode === 'custom'
    ? (topic.trim() && country.trim() && candidates.trim()
        ? { topic: topic.trim(), country: country.trim(), custom: true, topicId: null, flag: null, candidates: candidates.trim() } : null)
    : (() => { const t = topics.find(x => x.id === mode); return t ? { topic: t.topic, country: t.country, custom: false, topicId: t.id, flag: t.flag || null } : null; })();
  const canSave = yearOk && (topicLocked || chosen);

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    try {
      // A locked topic is left out of the write entirely: the rules refuse
      // any change to it once a swing exists.
      const data = { uid, birthYear: by, updatedAt: serverTimestamp(), ...(topicLocked ? {} : chosen) };
      await setDoc(doc(db, COL.projects, uid), data, { merge: true });
      setSaved(true);
      onDone?.();
    } catch (err) {
      console.error('Setup save failed', err);
      setError(err.code === 'permission-denied'
        ? 'That change was refused. A topic cannot change once a swing is written — ask your teacher to unlock it.'
        : 'Could not save. Check the connection and try again.');
    } finally { setBusy(false); }
  }

  const boxClass = 'w-full rounded-xl px-3 py-2 text-sm focus:outline-none disabled:opacity-60';
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-5" style={card}>
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Setup</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
          Pick one part of society in one country. You will map six swings across your own lifetime:
          four you have lived through and two you expect by about {END_YEAR}.
        </p>
      </div>

      <label className="block max-w-[12rem]">
        <span className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>Your birth year</span>
        <input type="number" inputMode="numeric" value={birthYear} onChange={e => setBirthYear(e.target.value)}
          className={boxClass} style={inputStyle} placeholder="e.g. 2008" />
        {birthYear !== '' && !yearOk && <span className="block text-xs mt-1" style={{ color: '#ef4444' }}>Enter the year you were born.</span>}
      </label>

      <div>
        <span className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>Topic</span>
        {topicLocked ? (
          <p className="text-sm px-3 py-2 rounded-xl" style={inputStyle}>
            <strong>{topicText(project)}</strong>
            <span className="block text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
              🔒 Locked because you have started writing swings. Your teacher can unlock it.
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {topics.length === 0 && <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>Your teacher has not posted a topic list yet — you can propose your own.</p>}
            {topics.map(t => (
              <label key={t.id} className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer"
                style={{ ...inputStyle, borderColor: mode === t.id ? 'var(--pg-primary)' : 'var(--pg-border)' }}>
                <input type="radio" name="topic" className="mt-1" checked={mode === t.id} onChange={() => setMode(t.id)} />
                <span>
                  {topicText(t)}
                  {t.start && <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>A swing to start from: {t.start}</span>}
                  {mode === t.id && t.leads?.length > 0 && (
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>
                      Leads to look into (places to start reading, not finished swings): {t.leads.join(' · ')}
                    </span>
                  )}
                  {t.flag && <span className="block text-xs mt-0.5" style={{ color: 'var(--pg-primary)' }}>{t.flag}</span>}
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer"
              style={{ ...inputStyle, borderColor: mode === 'custom' ? 'var(--pg-primary)' : 'var(--pg-border)' }}>
              <input type="radio" name="topic" className="mt-1" checked={mode === 'custom'} onChange={() => setMode('custom')} />
              <span className="flex-1">
                Propose my own
                <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>
                  Needs your teacher's approval before you can start writing. A narrow choice works better than a broad one.
                </span>
                {mode === 'custom' && (
                  <span className="grid gap-2 sm:grid-cols-2 mt-2">
                    <input type="text" maxLength={80} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic, e.g. carbon pricing"
                      className={boxClass} style={{ ...inputStyle, backgroundColor: 'var(--pg-bg)' }} />
                    <input type="text" maxLength={60} value={country} onChange={e => setCountry(e.target.value)} placeholder="Country, e.g. Canada"
                      className={boxClass} style={{ ...inputStyle, backgroundColor: 'var(--pg-bg)' }} />
                    <textarea rows={4} maxLength={600} value={candidates} onChange={e => setCandidates(e.target.value)}
                      placeholder={'Four candidate swings with dates, one per line.\nIf you cannot find four, the topic will not carry the project.'}
                      className={`${boxClass} sm:col-span-2 resize-y`} style={{ ...inputStyle, backgroundColor: 'var(--pg-bg)' }} />
                  </span>
                )}
              </span>
            </label>
          </div>
        )}
      </div>

      {status === 'pending' && (
        <p className="text-sm px-3 py-2 rounded-xl" role="status" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
          ⏳ <strong>{topicText(project)}</strong> is waiting for your teacher's approval. The swing entries unlock once it is approved.
        </p>
      )}
      {status === 'rejected' && (
        <p className="text-sm px-3 py-2 rounded-xl" role="status" style={{ ...inputStyle, borderColor: '#ef4444' }}>
          ✕ <strong>{topicText(project)}</strong> was not approved.{review?.note ? ` Teacher's note: ${review.note}` : ''} Choose or propose another topic.
        </p>
      )}
      {status === 'approved' && (
        <p className="text-sm px-3 py-2 rounded-xl" role="status" style={{ ...inputStyle, borderColor: '#22c55e' }}>
          ✓ <strong>{topicText(project)}</strong> is approved.{review?.note ? ` Teacher's note: ${review.note}` : ''}
        </p>
      )}

      {error && <p className="text-xs" role="alert" style={{ color: '#ef4444' }}>⚠ {error}</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={!canSave || busy} className="font-semibold px-5 py-2.5 rounded-xl disabled:opacity-35" style={btnPrimary}>
          {busy ? 'Saving…' : 'Save setup'}
        </button>
        {saved && <span className="text-xs" style={{ color: '#22c55e' }}>✓ Saved</span>}
      </div>
    </div>
  );
}

// ── Presentation mode: the map large, entries opening beside it ─────────────
function Presentation({ birthYear, swings, title, onClose }) {
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { if (sel) setSel(null); else onClose(); }
      else if (/^[1-6]$/.test(e.key)) setSel(Number(e.key));
      else if (e.key === 'ArrowRight') setSel(v => Math.min(6, (v ?? 0) + 1));
      else if (e.key === 'ArrowLeft') setSel(v => Math.max(1, (v ?? 2) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col no-print" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <div className="flex items-center justify-between px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--pg-border)' }}>
        <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>Click a point, or press 1–6 · ← → to step · Esc to close</p>
        <button onClick={onClose} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={btnGhost}>✕ Exit presentation</button>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex items-center justify-center p-4">
          <div className="w-full" style={{ maxWidth: 'min(100%, calc((100vh - 5rem) * 0.76))' }}>
            <FinalMap birthYear={birthYear} swings={swings} title={title} selected={sel} onSelect={setSel} />
          </div>
        </div>
        {sel && (
          <aside className="w-[min(38vw,32rem)] shrink-0 overflow-y-auto p-6" style={{ backgroundColor: 'var(--pg-surface)', borderLeft: '1px solid var(--pg-border)' }}>
            <button onClick={() => setSel(null)} className="float-right text-lg px-2" style={{ color: 'var(--pg-muted)' }} aria-label="Close entry">✕</button>
            <FinalEntryView n={sel} swing={swings[sel]} large />
          </aside>
        )}
      </div>
    </div>
  );
}

// ── The map tab ─────────────────────────────────────────────────────────────
function MapView({ birthYear, swings, title }) {
  const [sel, setSel] = useState(null);
  const [presenting, setPresenting] = useState(false);
  const [exportErr, setExportErr] = useState(null);
  const svgRef = useRef(null);
  const closePresentation = useCallback(() => setPresenting(false), []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPresenting(true)} className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnPrimary}>▶ Presentation mode</button>
        <button onClick={() => exportMapPng(svgRef.current, 'final-project-map.png').then(() => setExportErr(null), e => setExportErr(e.message))}
          className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnGhost}>⬇ Download PNG</button>
        <button onClick={() => window.print()} className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnGhost}>🖨 Print</button>
        {exportErr && <span className="text-xs self-center" style={{ color: '#ef4444' }}>⚠ {exportErr}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] items-start">
        <div className="rounded-2xl overflow-hidden" style={card}>
          <FinalMap birthYear={birthYear} swings={swings} title={title} selected={sel} onSelect={setSel} svgRef={svgRef} />
        </div>
        <div className="rounded-2xl p-5" style={card}>
          {sel
            ? <FinalEntryView n={sel} swing={swings[sel]} />
            : <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Click a numbered point to read that entry.</p>}
        </div>
      </div>
      {presenting && <Presentation birthYear={birthYear} swings={swings} title={title} onClose={closePresentation} />}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function FinalProject() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [settings, setSettings] = useState(null);
  const [project,  setProject]  = useState(undefined); // undefined = loading, null = none yet
  const [review,   setReview]   = useState(null);
  const [swings,   setSwings]   = useState(null);      // { n: fields }, null = loading
  const [loadErr,  setLoadErr]  = useState(false);
  const [attempt,  setAttempt]  = useState(0);
  const [tab,      setTab]      = useState(null);      // 'setup' | 1..6 | 'map'

  useEffect(() => {
    if (!uid) return;
    const warn = (what) => (err) => console.error(`Could not read ${what}`, err);
    const u1 = onSnapshot(doc(db, 'settings', SETTINGS_ID), s => setSettings(s.exists() ? s.data() : {}), warn('settings'));
    const u2 = onSnapshot(doc(db, COL.projects, uid), s => setProject(s.exists() ? s.data() : null), warn('project'));
    const u3 = onSnapshot(doc(db, COL.reviews, uid), s => setReview(s.exists() ? s.data() : null), warn('review'));
    return () => { u1(); u2(); u3(); };
  }, [uid]);

  // The six entries are read once; after that this page's own state is the
  // truth, so a late snapshot can never put old text back over new typing.
  // Read with a query on the student's own uid — the rules allow that even
  // when no entry exists yet, where a direct get of a missing doc is refused.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDocs(query(collection(db, COL.swings), where('uid', '==', uid))).then(snap => {
      if (cancelled) return;
      const out = {};
      snap.docs.forEach(d => { const x = d.data(); if (SWING_NUMBERS.includes(x.n)) out[x.n] = x; });
      setSwings(out);
    }).catch(err => {
      console.error('Could not load swings', err);
      if (!cancelled) setLoadErr(true);
    });
    return () => { cancelled = true; };
  }, [uid, attempt]);

  const onSwingChange = useCallback((n, fields) => {
    setSwings(prev => ({ ...prev, [n]: { ...(prev?.[n] || {}), ...fields } }));
  }, []);

  const topics = useMemo(() => settings?.topics || [], [settings]);
  const windowOpen = !!uid && (settings?.openUids || []).includes(uid);
  const ready = setupDone(project, review);
  const birthYear = project?.birthYear;
  const done = SWING_NUMBERS.filter(n => isComplete(swings?.[n], n, birthYear));
  const allDone = done.length === 6;
  const topicLocked = !!project?.topic && Object.keys(swings || {}).length > 0 && !review?.topicUnlocked;
  const loading = project === undefined || settings === null || (swings === null && !loadErr);

  // Land on the first thing that still needs doing.
  const current = tab ?? (!ready ? 'setup' : allDone ? 'map' : (SWING_NUMBERS.find(n => !done.includes(n)) ?? 'map'));
  const title = project?.topic ? topicText(project) : null;

  const tabBtn = (id, text, { locked = false, tick = false } = {}) => (
    <button key={id} onClick={() => !locked && setTab(id)} disabled={locked}
      className="text-sm font-semibold px-3.5 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40 whitespace-nowrap"
      style={current === id ? btnPrimary : btnGhost}
      title={locked ? (id === 'map' ? 'Unlocks when all six entries are complete' : 'Finish setup first') : undefined}>
      {text}{tick ? ' ✓' : ''}{locked ? ' 🔒' : ''}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar backTo="/dashboard" backLabel="Dashboard" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 py-6 flex flex-col gap-5 no-print">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--pg-text)' }}>The Orbit Map <span className="text-base font-semibold" style={{ color: 'var(--pg-muted)' }}>· final project</span></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
            {title ? <>Your topic: <strong style={{ color: 'var(--pg-text)' }}>{title}</strong></> : 'Six swings across your lifetime, in one part of one country’s society.'}
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--pg-border)', borderTopColor: 'var(--pg-primary)' }} />
          </div>
        ) : loadErr ? (
          <div className="rounded-2xl p-5 text-sm flex items-center justify-between gap-3" role="alert" style={{ ...card, borderColor: '#ef4444', color: 'var(--pg-text)' }}>
            <span>⚠ Couldn’t load your saved entries, so the forms are held back rather than shown empty. Check the connection and try again.</span>
            <button onClick={() => { setLoadErr(false); setAttempt(a => a + 1); }} className="shrink-0 font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}>Retry</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabBtn('setup', 'Setup', { tick: ready })}
              {SWING_NUMBERS.map(n => tabBtn(n, `${n}${n > 4 ? ' · predicted' : ''}`, { locked: !ready, tick: done.includes(n) }))}
              {tabBtn('map', 'Map', { locked: !ready || !allDone })}
            </div>

            {current === 'setup' && (
              /* Saving pins this tab, so an approval (and the teacher's note)
                 arrives in front of the student instead of the page jumping
                 to the first card the moment the topic clears. */
              <Setup uid={uid} project={project} review={review} topics={topics} topicLocked={topicLocked} onDone={() => setTab('setup')} />
            )}

            {SWING_NUMBERS.includes(current) && ready && (
              <>
                <div className="rounded-xl px-4 py-2.5 text-sm" role="status"
                  style={{ ...inputStyle, borderColor: windowOpen ? '#22c55e66' : 'var(--pg-border)' }}>
                  {windowOpen
                    ? <>● <strong>The writing window is open.</strong> Your entries save as you type.</>
                    : <>○ <strong>The writing window is closed.</strong> Entries are written in class — you can read yours here, and edit them when your teacher opens the window.</>}
                  <span className="block text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
                    Recorded and shown to your teacher: characters typed, time spent in each box, and every paste or paste attempt.
                    Pasting is switched off in the writing boxes; source boxes accept it.
                  </span>
                </div>
                <SwingEditor
                  key={current}
                  n={current} uid={uid} birthYear={birthYear}
                  initial={swings[current]} previous={current > 1 ? swings[current - 1] : null}
                  readOnly={!windowOpen} onChange={onSwingChange}
                />
                <div className="flex justify-between">
                  <button onClick={() => setTab(current === 1 ? 'setup' : current - 1)} className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnGhost}>
                    ← {current === 1 ? 'Setup' : `Swing ${current - 1}`}
                  </button>
                  {current < 6
                    ? <button onClick={() => setTab(current + 1)} className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnGhost}>Swing {current + 1} →</button>
                    : <button onClick={() => setTab('map')} disabled={!allDone} className="text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-35" style={btnPrimary}
                        title={allDone ? undefined : 'Unlocks when all six entries are complete'}>Open the map →</button>}
                </div>
              </>
            )}

            {current === 'map' && ready && allDone && <MapView birthYear={birthYear} swings={swings} title={title} />}
            {current === 'map' && !(ready && allDone) && (
              <p className="text-sm" style={{ color: 'var(--pg-muted)' }}>
                The map unlocks when all six entries are complete ({done.length} of 6 so far). <button onClick={() => setTab(null)} className="underline" style={{ color: 'var(--pg-primary)' }}>Go to the next one</button>.
              </p>
            )}
          </>
        )}
      </main>

      {/* Print view: the map in fixed light colours, then all six entries. */}
      {ready && allDone && (
        <div className="final-print-only">
          <h1 style={{ fontSize: '16pt', fontWeight: 700, margin: '0 0 0.5rem' }}>{title}</h1>
          <FinalMap birthYear={birthYear} swings={swings} print />
          {SWING_NUMBERS.map(n => <div key={n} className="final-print-entry"><FinalEntryView n={n} swing={swings[n]} /></div>)}
        </div>
      )}
    </div>
  );
}
