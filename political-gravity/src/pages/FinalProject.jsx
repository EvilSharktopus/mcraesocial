// src/pages/FinalProject.jsx
//
// The Social 30-1 final project, student side: setup (birth year + topic),
// six swing entries, then the generated map.
//
// Saving follows the reading page's rule that nothing typed is trusted to one
// button: each edit is mirrored to this device, autosaved a moment later, and
// the on-device copy is only dropped once Firestore confirms.
//
// A project is on one of two tracks (sector or big picture). They differ only
// in the topic list and the guided questions; both make the same six cards.
//
// The six cards are written in class. The teacher opens a writing window;
// outside it the security rules refuse swing writes, so the forms here go
// read-only rather than pretending to save.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, doc, getDocs, getDocsFromCache, increment, onSnapshot, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import FinalMap from '../components/FinalMap';
import { exportMapPng } from '../utils/exportMapPng';
import FinalEntryView from '../components/FinalEntryView';
import {
  COL, SETTINGS_ID, END_YEAR, SWING_NUMBERS, IDEOLOGIES, SWING_TESTS, TRACKS, TRACK_IDS,
  LATER_SWING_HINT, SEE_TEACHER_MESSAGE, HARDEST_NOTE, IDEOLOGY_NOTE, MEASURES, MEASURE_HELP, measureOf,
  kindOf, questionsFor, swingKeys, pickSwing, swingWords, yearProblem, orderProblem, missingFrom,
  isComplete, stateLabel, topicText, topicStatus, setupDone, trackLabel, normalizeTopic,
  mapTitle, mapSubtitle,
} from '../data/finalProject';

const AUTOSAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS    = 10_000;
const LOAD_TIMEOUT_MS   = 8_000;       // how long to wait for the server before using the cache
const CLOCK_SKEW_MS     = 10 * 60_000; // a draft this much "older" than the save still wins
const IDLE_CAP_MS       = 30_000;  // a pause longer than this is not "active time"
const BULK_INSERT       = 25;      // characters arriving in one input event

const draftKey = (uid, n) => `pg-final-draft:${uid}:${n}`;
const readDraft = (key) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; } };
const writeDraft = (key, fields) => { try { localStorage.setItem(key, JSON.stringify({ fields, at: Date.now() })); } catch { /* autosave still runs */ } };
const clearDraft = (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };
const millis = (ts) => ts?.toMillis?.() ?? 0;

const same = (a, b, keys) => keys.every(k => (a?.[k] ?? null) === (b?.[k] ?? null));

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

// ── One card ────────────────────────────────────────────────────────────────
// `initial` is what this page last had on screen for the card; `server` is the
// last copy Firestore is known to hold. They differ while a save is still in
// flight — which is exactly when the on-device draft must not be thrown away.
function SwingEditor({ n, uid, birthYear, initial, server, previous, questions, measure, order, showHint, leads, readOnly, onChange, onSaved }) {
  const kind = kindOf(n);
  const key = draftKey(uid, n);
  const keys = swingKeys(questions);

  // Same judgement the reading page makes about an on-device draft:
  //   it matches what the server has      → nothing to restore, drop it
  //   it is the newer work                → put it on screen and save it
  //   it is older than the save by more
  //   than clock error explains, yet
  //   differs                             → let the student decide
  const [start] = useState(() => {
    const local = pickSwing(initial, questions);
    const confirmed = pickSwing(server, questions);
    const draft = readDraft(key);
    const drafted = draft?.fields ? pickSwing(draft.fields, questions) : null;
    if (drafted && !same(drafted, confirmed, keys)) {
      if (draft.at >= millis(server?.updatedAt) - CLOCK_SKEW_MS) {
        return { fields: drafted, dirty: true, restored: !same(drafted, local, keys), offer: null };
      }
      return { fields: local, dirty: !same(local, confirmed, keys), restored: false, offer: { fields: drafted, at: draft.at } };
    }
    if (draft) clearDraft(key);
    return { fields: local, dirty: !same(local, confirmed, keys), restored: false, offer: null };
  });
  const [s, setS] = useState(start.fields);
  const [saveState, setSaveState] = useState(start.dirty ? 'unsaved' : 'idle');
  const [offer, setOffer] = useState(start.offer);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pasteNote, setPasteNote] = useState(false);

  const latest   = useRef(s);
  const dirty    = useRef(start.dirty);
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
      if (roRef.current) return false;
      if (!dirty.current) return true;
      const snapshot = latest.current;
      dirty.current = false;
      setSaveState('saving');
      try {
        await setDoc(doc(db, COL.swings, `${uid}_${n}`),
          { uid, n, kind, ...snapshot, updatedAt: serverTimestamp() }, { merge: true });
        onSaved(n, snapshot);
        // Only drop the on-device copy if nothing was typed while we were saving.
        if (!dirty.current) { clearDraft(key); setSaveState('saved'); setSaveError(null); }
        return true;
      } catch (err) {
        console.error('Swing autosave failed', err);
        dirty.current = true;
        setSaveState('error');
        setSaveError(err.code === 'permission-denied'
          ? 'The writing window is closed, so this was not saved to the server. Your words are kept on this device and will save when the window reopens.'
          : 'Could not reach the server. Your work is kept on this device and will retry.');
        timer.current = setTimeout(() => flushRef.current?.(), RETRY_DELAY_MS);
        return false;
      }
    };
    const run = chain.current.then(job, job);
    chain.current = run.catch(() => {});
    return run;
  }, [uid, n, kind, key, track, onSaved]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current?.(), AUTOSAVE_DELAY_MS);
  }, []);

  // A restored draft, or the window reopening, sends whatever is waiting.
  useEffect(() => { if (!readOnly && dirty.current) schedule(); }, [readOnly, schedule]);

  // Leaving — another card, a closed laptop — sends what is pending.
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

  // The button: students expect one. It sends the card now and only says
  // "Saved" once the server agrees.
  async function saveNow() {
    const ok = await flush();
    if (ok) { setJustSaved(true); setTimeout(() => setJustSaved(false), 2500); }
  }
  const takeOffer = () => { edit(offer.fields); setOffer(null); };
  const dropOffer = () => { if (!dirty.current) clearDraft(key); setOffer(null); };

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

  const words = swingWords(s, questions);
  const hasYear = typeof s.year === 'number';
  const yearIssue = hasYear ? yearProblem(s, n, birthYear) : null;
  const orderIssue = order && (order.n === n || order.before === n) ? order : null;
  const missing = missingFrom(s, n, birthYear, questions);
  const placed = typeof s.placement === 'number';
  const boxClass = 'w-full rounded-xl px-3 py-2 text-sm focus:outline-none disabled:opacity-60';
  const fieldLabel = (t) => <span className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>{t}</span>;
  const fieldHint = (t) => <span className="block text-xs mb-1.5" style={{ color: 'var(--pg-dim)' }}>{t}</span>;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-5" style={card}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
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
          <p className="text-sm font-semibold" style={{ color: 'var(--pg-muted)' }}>{words} words</p>
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
      {offer && (
        <div className="text-xs px-3 py-2 rounded-lg" role="status" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
          <p className="mb-2">
            This device has unsaved text from {new Date(offer.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} that
            differs from what was saved later. Which do you want?
          </p>
          <div className="flex gap-2">
            <button onClick={takeOffer} disabled={readOnly} className="font-semibold px-2.5 py-1 rounded-md disabled:opacity-40" style={btnPrimary}>Use the text from this device</button>
            <button onClick={dropOffer} className="font-semibold px-2.5 py-1 rounded-md" style={btnGhost}>Keep what’s saved</button>
          </div>
        </div>
      )}
      {pasteNote && (
        <p className="text-xs px-3 py-2 rounded-lg flex justify-between gap-3" role="status" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
          <span>Pasting is off in the answer boxes — type it in your own words. The source box accepts a paste.</span>
          <button onClick={() => setPasteNote(false)} aria-label="Dismiss" style={{ color: 'var(--pg-muted)' }}>✕</button>
        </p>
      )}
      {showHint && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>💡 {LATER_SWING_HINT}</p>
      )}
      {leads?.length > 0 && (
        <details className="text-xs px-3 py-2 rounded-lg" style={inputStyle}>
          <summary className="cursor-pointer font-semibold" style={{ color: 'var(--pg-text)' }}>Where to look next</summary>
          <p className="mt-1.5" style={{ color: 'var(--pg-muted)' }}>{leads.join(' · ')}</p>
          <p className="mt-1" style={{ color: 'var(--pg-dim)' }}>Suggestions, not required swings.</p>
        </details>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          {fieldLabel('Short name')}
          {fieldHint('A few words. This is the label on your map.')}
          <input type="text" maxLength={60} {...text('name')} className={boxClass} style={inputStyle} />
        </label>
        <label className="block">
          {fieldLabel(kind === 'lived' ? 'Year' : 'Approximate year')}
          {fieldHint(kind === 'lived' ? `${birthYear} to now` : `After ${new Date().getFullYear()}, by ${END_YEAR}`)}
          <input type="number" inputMode="numeric" disabled={readOnly}
            value={s.year ?? ''} onChange={e => edit({ year: e.target.value === '' ? null : Math.trunc(Number(e.target.value)) })}
            className={`${boxClass} w-32`} style={inputStyle} />
        </label>
      </div>
      {/* A year is all that is asked for, and a doubtful one never holds the
          card up: these are notes, the card saves either way. */}
      {(yearIssue || orderIssue || !hasYear) && (
        <p className="text-xs -mt-3" style={{ color: yearIssue || orderIssue ? '#f59e0b' : 'var(--pg-dim)' }}>
          {yearIssue
            ?? (orderIssue
              ? `Swing ${orderIssue.n} (${orderIssue.year}) is dated before swing ${orderIssue.before} (${orderIssue.beforeYear}). Swings are numbered in date order — check both years.`
              : 'Just the year — no exact date needed. Not sure yet? Leave it and keep working; everything else still saves.')}
        </p>
      )}

      {questions.map((q, i) => (
        <div key={q.id} className="flex flex-col gap-2">
          <label className="block">
            <span className="block text-sm mb-1.5" style={{ color: 'var(--pg-text)' }}>
              <strong>{i + 1}. {q.label}:</strong> {q.prompt}
            </span>
            <textarea {...text(q.id)} rows={2} className={`${boxClass} resize-y`} style={inputStyle} />
          </label>
          {q.source && (
            <label className="block">
              <span className="block text-xs mb-1" style={{ color: 'var(--pg-dim)' }}>Source — a URL or citation. You can paste here.</span>
              <input type="text" {...text('source', { allowPaste: true })} placeholder="https://… or a citation" className={boxClass} style={inputStyle} />
            </label>
          )}
          {/* Questions 2 and 3 are where students stall, so the nudge sits
              right under the pair. */}
          {i === 2 && <p className="text-xs" style={{ color: 'var(--pg-muted)' }}>💡 {HARDEST_NOTE}</p>}
          {q.ideology && (
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,16rem)_1fr] items-end">
              <label className="block">
                <span className="block text-xs mb-1" style={{ color: 'var(--pg-dim)' }}>Ideology</span>
                <select disabled={readOnly} value={s.ideology ?? ''} onChange={e => edit({ ideology: e.target.value })} className={boxClass} style={inputStyle}>
                  <option value="">Choose…</option>
                  {IDEOLOGIES.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
              <p className="text-xs pb-1.5" style={{ color: 'var(--pg-dim)' }}>{IDEOLOGY_NOTE}</p>
            </div>
          )}
          {q.placement && (
            <div className="rounded-xl px-4 pt-3 pb-2" style={inputStyle}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--pg-text)' }}>
                Placing on: <span style={{ color: 'var(--pg-primary)' }}>{measure || 'no measure chosen yet — pick one in Setup'}</span>
              </p>
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
          )}
        </div>
      ))}

      <p className="text-xs" style={{ color: missing.length ? 'var(--pg-muted)' : '#22c55e' }}>
        {missing.length ? `Still needed: ${missing.join(', ')}.` : '✓ This card is complete.'}
      </p>

      {!readOnly && (
        <div>
          <button onClick={saveNow} className="w-full font-semibold py-3 rounded-xl" style={btnPrimary}
            title="Your work autosaves as you go; this saves it right now">
            {justSaved ? '✓ Saved!' : 'Save card'}
          </button>
          <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--pg-faint)' }}>
            Autosaves as you type. A copy is also kept on this device until the server confirms.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Setup: birth year, track, topic ─────────────────────────────────────────
function Setup({ uid, project, review, topics, topicLocked, hasPlacements, onDone }) {
  const thisYear = new Date().getFullYear();
  const [birthYear, setBirthYear] = useState(project?.birthYear ?? '');
  const [trackId, setTrackId] = useState(TRACKS[project?.track] ? project.track : '');
  const [mode, setMode] = useState(project?.place ? (project.custom ? 'custom' : project.topicId ?? '') : '');
  const [name, setName] = useState(project?.custom ? project.name ?? '' : '');
  const [place, setPlace] = useState(project?.custom ? project.place ?? '' : '');
  const [candidates, setCandidates] = useState(project?.candidates ?? '');
  // The measure: one of the four offered, or the student's own words.
  const savedMeasure = measureOf(project);
  const [measureMode, setMeasureMode] = useState(!savedMeasure ? '' : MEASURES.includes(savedMeasure) ? savedMeasure : 'own');
  const [ownMeasure, setOwnMeasure] = useState(MEASURES.includes(savedMeasure) ? '' : savedMeasure);
  const measure = measureMode === 'own' ? ownMeasure.trim().toLowerCase() : measureMode;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const status = topicStatus(project, review);
  const by = Number(birthYear);
  const yearOk = Number.isInteger(by) && by >= thisYear - 80 && by <= thisYear - 10;
  const big = trackId === 'big';
  const shown = topics.filter(t => t.track === trackId);
  const pickTrack = (id) => { if (id !== trackId) { setTrackId(id); setMode(''); } };

  let chosen = null;
  if (mode === 'custom') {
    const ok = place.trim() && candidates.trim() && (big || name.trim());
    if (ok) chosen = { track: trackId, name: big ? '' : name.trim(), place: place.trim(), custom: true, topicId: null, flag: '', seeTeacher: false, candidates: candidates.trim() };
  } else {
    const t = shown.find(x => x.id === mode);
    if (t) chosen = { track: t.track, name: t.name || '', place: t.place, custom: false, topicId: t.id, flag: t.flag || '', seeTeacher: !!t.seeTeacher, candidates: '' };
  }
  const canSave = yearOk && measure && (topicLocked || chosen);
  const measureChanging = !!savedMeasure && measure !== savedMeasure;

  async function save() {
    // The placements were made against the old measure; nothing moves them.
    if (measureChanging && hasPlacements && !confirm(
      `Change your measure from “${savedMeasure}” to “${measure}”?\n\n` +
      'Your placements were made on the old measure and will not move on their own. Go back through all six swings and check each one still sits where it should.')) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      // A locked topic is left out of the write entirely: the rules refuse
      // any change to it once a swing exists. The measure is never locked.
      const data = { uid, birthYear: by, measure, updatedAt: serverTimestamp(), ...(topicLocked ? {} : chosen) };
      // Pin the Setup tab now, not when the server answers: the page shows
      // the saved setup at once, and a student who has already moved on to a
      // card by the time the reply lands must not be pulled back here.
      onDone?.();
      await setDoc(doc(db, COL.projects, uid), data, { merge: true });
      setSaved(true);
    } catch (err) {
      console.error('Setup save failed', err);
      setError(err.code === 'permission-denied'
        ? 'That change was refused. A topic cannot change once a swing is written — ask your teacher to unlock it.'
        : 'Could not save. Check the connection and try again.');
    } finally { setBusy(false); }
  }

  const live = topics.find(t => t.id === project?.topicId);
  const leads = !project?.custom && live?.leads?.length ? live.leads : [];
  const boxClass = 'w-full rounded-xl px-3 py-2 text-sm focus:outline-none disabled:opacity-60';
  const choice = (active) => ({ ...inputStyle, borderColor: active ? 'var(--pg-primary)' : 'var(--pg-border)' });
  const inner = { ...inputStyle, backgroundColor: 'var(--pg-bg)' };
  const heading = (t) => <span className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>{t}</span>;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-5" style={card}>
      <div>
        <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Setup</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
          You will map six swings across your own lifetime: four you have lived through and two you expect by about {END_YEAR}.
        </p>
      </div>

      <label className="block max-w-[12rem]">
        {heading('Your birth year')}
        <input type="number" inputMode="numeric" value={birthYear} onChange={e => setBirthYear(e.target.value)}
          className={boxClass} style={inputStyle} placeholder="e.g. 2008" />
        {birthYear !== '' && !yearOk && <span className="block text-xs mt-1" style={{ color: '#ef4444' }}>Enter the year you were born.</span>}
      </label>

      {topicLocked ? (
        <div>
          {heading('Track and topic')}
          <p className="text-sm px-3 py-2 rounded-xl" style={inputStyle}>
            <strong>{topicText(project)}</strong> · {trackLabel(project.track)} track
            <span className="block text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
              🔒 Locked because you have started writing swings. Your teacher can unlock it.
            </span>
          </p>
        </div>
      ) : (
        <>
          <div>
            {heading('Track')}
            <div className="grid gap-2 sm:grid-cols-2">
              {TRACK_IDS.map(id => (
                <label key={id} className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer" style={choice(trackId === id)}>
                  <input type="radio" name="track" className="mt-1" checked={trackId === id} onChange={() => pickTrack(id)} />
                  <span>
                    <strong>{TRACKS[id].label}</strong>
                    <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>{TRACKS[id].blurb}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--pg-dim)' }}>Both tracks make the same thing: four lived swings, two predicted, and a map.</p>
          </div>

          {trackId && (
            <div>
              {heading(big ? 'Whose direction will you trace?' : 'Topic')}
              <div className="flex flex-col gap-2">
                {shown.length === 0 && <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>No topics posted for this track yet — you can propose your own.</p>}
                {shown.map(t => (
                  <label key={t.id} className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer" style={choice(mode === t.id)}>
                    <input type="radio" name="topic" className="mt-1" checked={mode === t.id} onChange={() => setMode(t.id)} />
                    <span>
                      {topicText(t)}
                      {t.flag && (
                        <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full align-middle"
                          style={{ border: '1px solid var(--pg-primary)', color: 'var(--pg-primary)' }}>{t.flag}</span>
                      )}
                      {t.start && <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>A swing to start from: {t.start}</span>}
                      {t.seeTeacher && <span className="block text-xs font-semibold mt-0.5" style={{ color: '#f59e0b' }}>⚑ {SEE_TEACHER_MESSAGE}</span>}
                    </span>
                  </label>
                ))}
                <label className="flex items-start gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer" style={choice(mode === 'custom')}>
                  <input type="radio" name="topic" className="mt-1" checked={mode === 'custom'} onChange={() => setMode('custom')} />
                  <span className="flex-1">
                    Propose my own
                    <span className="block text-xs" style={{ color: 'var(--pg-dim)' }}>
                      Needs your teacher's approval before you can start writing.{big ? '' : ' A narrow choice works better than a broad one.'}
                    </span>
                    {mode === 'custom' && (
                      <span className="grid gap-2 sm:grid-cols-2 mt-2">
                        {!big && (
                          <input type="text" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Topic, e.g. carbon pricing"
                            className={boxClass} style={inner} />
                        )}
                        <input type="text" maxLength={60} value={place} onChange={e => setPlace(e.target.value)}
                          placeholder={big ? 'Place, e.g. Ontario or Japan' : 'Country, e.g. Canada'}
                          className={`${boxClass} ${big ? 'sm:col-span-2' : ''}`} style={inner} />
                        <textarea rows={4} maxLength={600} value={candidates} onChange={e => setCandidates(e.target.value)}
                          placeholder={big
                            ? 'The governments you would trace, in order, with rough years.'
                            : 'Four candidate swings with rough years, one per line.\nIf you cannot find four, the topic will not carry the project.'}
                          className={`${boxClass} sm:col-span-2 resize-y`} style={inner} />
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {(topicLocked || mode) && (
        <div>
          {heading('What are you measuring?')}
          <p className="text-xs mb-2" style={{ color: 'var(--pg-muted)' }}>{MEASURE_HELP}</p>
          <div className="flex flex-wrap gap-2">
            {MEASURES.map(m => (
              <label key={m} className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer capitalize" style={choice(measureMode === m)}>
                <input type="radio" name="measure" checked={measureMode === m} onChange={() => setMeasureMode(m)} />
                {m}
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl cursor-pointer" style={choice(measureMode === 'own')}>
              <input type="radio" name="measure" checked={measureMode === 'own'} onChange={() => setMeasureMode('own')} />
              In my own words
              {measureMode === 'own' && (
                <input type="text" maxLength={30} value={ownMeasure} onChange={e => setOwnMeasure(e.target.value)} placeholder="e.g. ownership"
                  className="rounded-lg px-2 py-1 text-sm focus:outline-none w-40" style={inner} />
              )}
            </label>
          </div>
          <p className="text-xs mt-1.5" style={{ color: 'var(--pg-dim)' }}>
            One measure for all six swings. It labels your map: “More state ({measure || '…'})” and “Less state ({measure || '…'})”.
          </p>
          {measureChanging && hasPlacements && (
            <p className="text-xs mt-1.5" role="status" style={{ color: '#f59e0b' }}>
              ⚠ You have already placed swings on “{savedMeasure}”. If you change the measure, go back through all six and check each placement.
            </p>
          )}
        </div>
      )}

      {status === 'pending' && (
        <p className="text-sm px-3 py-2 rounded-xl" role="status" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
          ⏳ <strong>{topicText(project)}</strong> is waiting for your teacher's approval.
          {project?.seeTeacher && !project?.custom ? ` ${SEE_TEACHER_MESSAGE}.` : ''} The cards unlock once it is approved.
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

      {leads.length > 0 && (
        <div className="text-sm px-3 py-2.5 rounded-xl" style={inputStyle}>
          <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>Where to look next</p>
          <ul className="list-disc ml-5 mt-1" style={{ color: 'var(--pg-muted)' }}>
            {leads.map((l, i) => <li key={`${l}-${i}`}>{l}</li>)}
          </ul>
          <p className="text-xs mt-1.5" style={{ color: 'var(--pg-dim)' }}>Suggestions, not required swings. Replace any that do not hold up with one you find yourself.</p>
        </div>
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

// ── Presentation mode: the map large, cards opening beside it ───────────────
function Presentation({ birthYear, swings, project, qFor, onClose }) {
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { if (sel) setSel(null); else onClose(); }
      else if (/^[1-6]$/.test(e.key)) setSel(Number(e.key));
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setSel(v => Math.min(6, (v ?? 0) + 1));
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setSel(v => Math.max(1, (v ?? 2) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col no-print" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <div className="flex items-center justify-between px-5 py-2 shrink-0" style={{ borderBottom: '1px solid var(--pg-border)' }}>
        <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>Click a point, or press 1–6 · arrows to step · Esc to close</p>
        <button onClick={onClose} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={btnGhost}>✕ Exit presentation</button>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex items-center justify-center p-4">
          <div className="w-full" style={{ maxWidth: 'min(100%, calc((100vh - 5rem) * 0.76))' }}>
            <FinalMap birthYear={birthYear} swings={swings} title={mapTitle(project)} subtitle={mapSubtitle(project)} measure={measureOf(project)} selected={sel} onSelect={setSel} />
          </div>
        </div>
        {sel && (
          <aside className="w-[min(42vw,36rem)] shrink-0 overflow-y-auto p-6" style={{ backgroundColor: 'var(--pg-surface)', borderLeft: '1px solid var(--pg-border)' }}>
            <button onClick={() => setSel(null)} className="float-right text-lg px-2" style={{ color: 'var(--pg-muted)' }} aria-label="Close card">✕</button>
            <FinalEntryView n={sel} swing={swings[sel]} questions={qFor(sel)} large />
          </aside>
        )}
      </div>
    </div>
  );
}

// ── The map tab ─────────────────────────────────────────────────────────────
function MapView({ birthYear, swings, project, qFor }) {
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
          <FinalMap birthYear={birthYear} swings={swings} title={mapTitle(project)} subtitle={mapSubtitle(project)} measure={measureOf(project)} selected={sel} onSelect={setSel} svgRef={svgRef} />
        </div>
        <div className="rounded-2xl p-5" style={card}>
          {sel
            ? <FinalEntryView n={sel} swing={swings[sel]} questions={qFor(sel)} />
            : <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Click a numbered point to read that card.</p>}
        </div>
      </div>
      {presenting && <Presentation birthYear={birthYear} swings={swings} project={project} qFor={qFor} onClose={closePresentation} />}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
// `preview` is the teacher's student view: the same page, run under the
// teacher's own account as a practice project (see Settings).
export default function FinalProject({ preview = false }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [settings, setSettings] = useState(null);
  const [project,  setProject]  = useState(undefined); // undefined = loading, null = none yet
  const [review,   setReview]   = useState(null);
  const [swings,   setSwings]   = useState(null);      // { n: fields }, null = loading
  const [server,   setServer]   = useState({});        // the copies Firestore is known to hold
  const [fromCache, setFromCache] = useState(false);
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

  // The six cards are read once; after that this page's own state is the
  // truth, so a late snapshot can never put old text back over new typing.
  // Read with a query on the student's own uid — the rules allow that even
  // when no card exists yet, where a direct get of a missing doc is refused.
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // Server first; if it is slow or unreachable, whatever offline
    // persistence holds, with a note saying so.
    const q = query(collection(db, COL.swings), where('uid', '==', uid));
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS); });
    Promise.race([getDocs(q), timeout])
      .then(snap => ({ snap, source: 'server' }),
        err => getDocsFromCache(q).then(snap => {
          // An empty cache says nothing about what the server holds.
          if (snap.empty) throw err;
          return { snap, source: 'cache' };
        }))
      .then(({ snap, source }) => {
        if (cancelled) return;
        const out = {};
        snap.docs.forEach(d => { const x = d.data(); if (SWING_NUMBERS.includes(x.n)) out[x.n] = x; });
        setSwings(out); setServer(out); setFromCache(source === 'cache');
      })
      .catch(err => {
        console.error('Could not load swings', err);
        if (!cancelled) setLoadErr(true);
      })
      .finally(() => clearTimeout(timer));
    return () => { cancelled = true; };
  }, [uid, attempt]);

  const onSwingChange = useCallback((n, fields) => {
    setSwings(prev => ({ ...prev, [n]: { ...(prev?.[n] || {}), ...fields } }));
  }, []);

  const onSwingSaved = useCallback((n, fields) => {
    setServer(prev => ({ ...prev, [n]: { ...fields, updatedAt: { toMillis: () => Date.now() } } }));
  }, []);

  const topics = useMemo(() => (settings?.topics || []).map(normalizeTopic), [settings]);
  const track = project?.track;
  // The question sets for this project's track, in the teacher's wording.
  const questions = useMemo(() => ({
    lived: questionsFor(settings, track, 'lived'),
    predicted: questionsFor(settings, track, 'predicted'),
  }), [settings, track]);
  const qFor = useCallback((n) => questions[kindOf(n)], [questions]);

  const windowOpen = !!uid && (settings?.openUids || []).includes(uid);
  const ready = setupDone(project, review);
  const birthYear = project?.birthYear;
  const done = SWING_NUMBERS.filter(n => isComplete(swings?.[n], n, birthYear, qFor(n)));
  const order = orderProblem(swings);
  const mapReady = ready && done.length === 6 && !order;
  const topicLocked = !!project?.place && Object.keys(swings || {}).length > 0 && !review?.topicUnlocked;
  const loading = project === undefined || settings === null || (swings === null && !loadErr);
  const liveTopic = topics.find(t => t.id === project?.topicId);
  const leads = !project?.custom && liveTopic?.leads?.length ? liveTopic.leads : [];

  // Land on the first thing that still needs doing.
  const current = tab ?? (!ready ? 'setup' : mapReady ? 'map' : (SWING_NUMBERS.find(n => !done.includes(n)) ?? 1));
  const title = mapTitle(project);
  // Why the map is still locked; null once it is not.
  const mapLockReason = mapReady ? null
    : !ready ? 'Finish setup first'
    : done.length < 6 ? `Unlocks when all six cards are complete (${done.length} of 6 so far)`
    : `Swing ${order.n} (${order.year}) is dated before swing ${order.before} (${order.beforeYear}) — put the six in date order to unlock the map`;

  const tabBtn = (id, text, { locked = false, tick = false, why } = {}) => (
    <button key={id} onClick={() => !locked && setTab(id)} disabled={locked}
      className="text-sm font-semibold px-3.5 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40 whitespace-nowrap"
      style={current === id ? btnPrimary : btnGhost}
      title={locked ? (why ?? 'Finish setup first') : undefined}>
      {text}{tick ? ' ✓' : ''}{locked ? ' 🔒' : ''}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar backTo={preview ? '/teacher' : '/dashboard'} backLabel={preview ? 'Teacher' : 'Dashboard'} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 py-6 flex flex-col gap-5 no-print">
        {preview && (
          <p className="text-sm px-4 py-2.5 rounded-xl" role="status" style={{ ...inputStyle, borderColor: 'var(--pg-primary)' }}>
            👀 <strong>Student view.</strong> This is your own practice project, exactly as a student gets it. Students never see it.
            Its writing window and a reset are on the Settings tab.
          </p>
        )}
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--pg-text)' }}>The Orbit Map <span className="text-base font-semibold" style={{ color: 'var(--pg-muted)' }}>· final project</span></h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pg-muted)' }}>
            {title
              ? <>
                  Your topic: <strong style={{ color: 'var(--pg-text)' }}>{title}</strong> · {trackLabel(track)} track
                  {measureOf(project) && <> · measuring <strong style={{ color: 'var(--pg-text)' }}>{measureOf(project)}</strong></>}
                  {project?.flag && (
                    <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full align-middle"
                      style={{ border: '1px solid var(--pg-primary)', color: 'var(--pg-primary)' }}>{project.flag}</span>
                  )}
                </>
              : 'Six swings across your own lifetime: four lived, two predicted.'}
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--pg-border)', borderTopColor: 'var(--pg-primary)' }} />
          </div>
        ) : loadErr ? (
          <div className="rounded-2xl p-5 text-sm flex items-center justify-between gap-3" role="alert" style={{ ...card, borderColor: '#ef4444', color: 'var(--pg-text)' }}>
            <span>⚠ Couldn’t load your saved cards, so the forms are held back rather than shown empty. Check the connection and try again.</span>
            <button onClick={() => { setLoadErr(false); setAttempt(a => a + 1); }} className="shrink-0 font-semibold px-3 py-1.5 rounded-lg" style={btnPrimary}>Retry</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabBtn('setup', 'Setup', { tick: ready })}
              {SWING_NUMBERS.map(n => tabBtn(n, `${n}${n > 4 ? ' · predicted' : ''}`, { locked: !ready, tick: done.includes(n) }))}
              {tabBtn('map', 'Map', { locked: !mapReady, why: mapLockReason })}
            </div>

            {current === 'setup' && (
              /* Saving pins this tab, so an approval (and the teacher's note)
                 arrives in front of the student instead of the page jumping
                 to the first card the moment the topic clears. */
              <Setup uid={uid} project={project} review={review} topics={topics} topicLocked={topicLocked}
                hasPlacements={Object.values(swings || {}).some(x => typeof x?.placement === 'number')} onDone={() => setTab('setup')} />
            )}

            {SWING_NUMBERS.includes(current) && ready && (
              <>
                <div className="rounded-xl px-4 py-2.5 text-sm" role="status"
                  style={{ ...inputStyle, borderColor: windowOpen ? '#22c55e66' : 'var(--pg-border)' }}>
                  {windowOpen
                    ? <>● <strong>The writing window is open.</strong> Your answers save as you type.</>
                    : <>○ <strong>The writing window is closed.</strong> Cards are written in class — you can read yours here, and edit them when your teacher opens the window.</>}
                  <span className="block text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
                    Recorded and shown to your teacher: characters typed, time spent in each box, and every paste or paste attempt.
                    Pasting is switched off in the answer boxes; the source box accepts it.
                  </span>
                </div>
                {fromCache && (
                  <p className="text-xs px-3 py-2 rounded-lg" role="status" style={inputStyle}>
                    Showing the copy saved on this device — the server was slow to answer. Changes will sync when it does.
                  </p>
                )}
                <SwingEditor
                  key={`${current}-${track}`}
                  n={current} uid={uid} birthYear={birthYear}
                  initial={swings[current]} server={server[current]} previous={current > 1 ? swings[current - 1] : null}
                  questions={qFor(current)} measure={measureOf(project)} order={order} leads={leads}
                  showHint={current > 1 && done.includes(1)}
                  readOnly={!windowOpen} onChange={onSwingChange} onSaved={onSwingSaved}
                />
                <div className="flex justify-between items-center gap-3">
                  <button onClick={() => setTab(current === 1 ? 'setup' : current - 1)} className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnGhost}>
                    ← {current === 1 ? 'Setup' : `Swing ${current - 1}`}
                  </button>
                  {current < 6
                    ? <button onClick={() => setTab(current + 1)} className="text-sm font-semibold px-4 py-2 rounded-xl" style={btnGhost}>Swing {current + 1} →</button>
                    : <>
                        {!mapReady && <span className="text-xs text-right" style={{ color: 'var(--pg-dim)' }}>{mapLockReason}.</span>}
                        <button onClick={() => setTab('map')} disabled={!mapReady} className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-35" style={btnPrimary}>Open the map →</button>
                      </>}
                </div>
              </>
            )}

            {current === 'map' && mapReady && <MapView birthYear={birthYear} swings={swings} project={project} qFor={qFor} />}
            {current === 'map' && !mapReady && (
              <p className="text-sm" style={{ color: 'var(--pg-muted)' }}>
                {mapLockReason}. <button onClick={() => setTab(order && done.length === 6 ? order.n : null)} className="underline" style={{ color: 'var(--pg-primary)' }}>Take me there</button>.
              </p>
            )}
          </>
        )}
      </main>

      {/* Print view: the map in fixed light colours, then all six cards. */}
      {mapReady && (
        <div className="final-print-only">
          <FinalMap birthYear={birthYear} swings={swings} title={title} subtitle={mapSubtitle(project)} measure={measureOf(project)} print />
          {SWING_NUMBERS.map(n => <div key={n} className="final-print-entry"><FinalEntryView n={n} swing={swings[n]} questions={qFor(n)} /></div>)}
        </div>
      )}
    </div>
  );
}
