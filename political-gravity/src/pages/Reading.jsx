// src/pages/Reading.jsx
// Split-screen: reading text on left, Spectrum + justification on right.
//
// Nothing a student types is trusted to a single button press:
//   1. every edit is mirrored to localStorage straight away (a draft),
//   2. a debounced autosave pushes it to Firestore a moment later,
//   3. the draft is only cleared once Firestore confirms the write,
//   4. on return, a draft newer than the saved copy is restored.
// The Save button still exists because students expect one; it flushes the
// autosave immediately and, for reflections, marks the piece as submitted.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, doc, getDoc, getDocFromCache, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import SocietyDrift from '../components/SocietyDrift';
import DiplomaExtractorModal from '../components/DiplomaExtractorModal';
import { useSpeech } from '../hooks/useSpeech';
import { useTheme } from '../context/ThemeContext';
import { useReadings } from '../hooks/useReadings';
import { useConsensus } from '../hooks/useConsensus';
import { societyDrift } from '../data/drift';
import { hasPosition, positionLabel } from '../data/readings';

const needXAxis = (axes) => axes !== 'political';
const needYAxis = (axes) => axes !== 'economic';
import { useAuth } from '../auth/AuthContext';

const AUTOSAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS    = 10_000;
const LOAD_TIMEOUT_MS   = 8_000;       // how long to wait for the server before using the cache
const CLOCK_SKEW_MS     = 10 * 60_000; // a draft this much "older" than the save still wins

// Read one document: the server first, and if that is slow or unreachable,
// whatever offline persistence has. Resolves { snap, source } or throws.
async function loadDoc(ref) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'timeout' })), LOAD_TIMEOUT_MS);
  });
  try {
    const snap = await Promise.race([getDoc(ref), timeout]);
    return { snap, source: 'server' };
  } catch (err) {
    try {
      const snap = await getDocFromCache(ref);
      return { snap, source: 'cache' };
    } catch {
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

// Same content, ignoring the fields that are not the student's work?
const sameWork = (a, b, fields) => fields.every(f => (a?.[f] ?? null) === (b?.[f] ?? null));

// What to do with an on-device draft next to the saved copy:
//   apply — the draft is the newer work, put it on screen
//   clear — the draft says nothing the save does not
//   ask   — the draft is older than the save by more than clock error could
//           explain, yet differs: let the student decide
function judgeDraft(draft, saved, fields) {
  if (!draft) return 'clear';
  if (!saved) return 'apply';
  if (sameWork(draft, saved, fields)) return 'clear';
  return draft.at >= millis(saved.updatedAt) - CLOCK_SKEW_MS ? 'apply' : 'ask';
}

// ── Local draft: the on-device copy that survives a crash or a closed tab ──
const draftKey = (uid, readingId) => `pg-draft:${uid}:${readingId}`;
function readDraft(key) {
  try { const raw = key && localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function writeDraft(key, fields) {
  try { if (key) localStorage.setItem(key, JSON.stringify({ ...fields, at: Date.now() })); }
  catch { /* private mode or full — Firestore autosave still runs */ }
}
function clearDraft(key) {
  try { if (key) localStorage.removeItem(key); } catch { /* ignore */ }
}
const millis = (ts) => ts?.toMillis?.() ?? 0;

export default function Reading() {
  const { id } = useParams();
  const { readings, loading: readingsLoading } = useReadings();
  const { consensus, loaded: consensusLoaded } = useConsensus();
  const reading = readings.find(r => r.id === id);
  // Archived periods are not part of the sequence: the drift skips them, and so
  // must the "previous period" the blank form is seeded from, or a student gets
  // seeded off a period nobody discussed.
  const activeReadings = useMemo(() => readings.filter(r => !r.archived), [readings]);
  const { user, isTeacher } = useAuth();

  const [positionX,     setPositionX]     = useState(null);
  const [positionY,     setPositionY]     = useState(null);
  const [justification, setJustification] = useState('');
  // Which spectrum(s) the student is placing themselves on.
  const [axes,          setAxes]          = useState('economic'); // economic | political | both
  // null = we have not looked yet, so the consensus prefill must wait.
  const [hadSaved,      setHadSaved]      = useState(null);
  const [savedPlot,     setSavedPlot]     = useState(null);   // what they submitted first time
  const [reflectMode,   setReflectMode]   = useState(false);  // teacher-controlled
  const [classPlots,    setClassPlots]    = useState([]);     // everyone's positions
  const [reflection,    setReflection]    = useState('');
  const [hadReflection, setHadReflection] = useState(false);  // a pg_reflections doc exists
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false); // …and it is not a draft
  const [justSaved,     setJustSaved]     = useState(false);  // button flash after a click
  // idle | unsaved | saving | saved | error — what the autosave is doing
  const [saveState,     setSaveState]     = useState('idle');
  const [savedAt,       setSavedAt]       = useState(null);
  const [saveError,     setSaveError]     = useState(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  // A draft we would not apply on our own (see judgeDraft) — offered instead.
  const [pendingDraft,  setPendingDraft]  = useState(null);
  // loading | ready | cached | failed — the form stays locked until the saved
  // copy is known, so nothing can be typed over it or lost to it.
  const [loadState,     setLoadState]     = useState('loading');
  const [loadAttempt,   setLoadAttempt]   = useState(0);
  const [publishedHtml, setPublishedHtml] = useState(null); // null = still loading
  const [htmlLoading,   setHtmlLoading]   = useState(true);
  const [selection,     setSelection]     = useState(null);
  const [extractorOpen, setExtractorOpen] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const readingPaneRef = useRef(null);
  const splitRef = useRef(null);

  // Width of the writing panel in px, draggable and remembered per browser.
  const [writingWidth, setWritingWidth] = useState(() => {
    const saved = Number(localStorage.getItem('pg-writing-width'));
    return Number.isFinite(saved) && saved >= 260 ? saved : 416;
  });
  const [dragging, setDragging] = useState(false);

  const speech = useSpeech();
  const { theme } = useTheme();
  // Each theme has its own sky. Choosing the file here rather than in CSS means
  // the browser only ever fetches the one currently on screen.
  const skyFile = theme === 'dark' ? 'spectrum-sky.png' : 'spectrum-sky-light.png';

  // Dragging the divider resizes both panes at once: the reading is flex-1, so
  // setting the writing panel's width is enough.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const next = Math.round(window.innerWidth - x);
      const clamped = Math.max(280, Math.min(next, Math.round(window.innerWidth * 0.7)));
      setWritingWidth(clamped);
    };
    const onEnd = () => {
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  useEffect(() => {
    localStorage.setItem('pg-writing-width', String(writingWidth));
  }, [writingWidth]);

  // Panel collapse state, remembered so a student's layout survives a reload.
  // Panel collapse is for this visit only. It used to be remembered, which
  // meant a stray click on the heading hid the spectrum "permanently" — even
  // a refresh brought back the same collapsed page.
  const [spectrumOpen, setSpectrumOpen] = useState(true);
  const [writingOpen,  setWritingOpen]  = useState(true);
  const togglePanel = (which, open, setOpen) => setOpen(!open);

  // Load published content from Firestore
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'readingContent', id), snap => {
      setPublishedHtml(snap.exists() ? snap.data().html : '');
      setHtmlLoading(false);
    });
    return () => unsub();
  }, [id]);

  // Offer "Flag for Diploma" whenever a selection settles inside the reading.
  // selectionchange covers touch (iPad, touchscreen Chromebook) as well as the
  // mouse; a mouseup handler alone never fired on touch.
  //
  // Two things students hit that this has to survive:
  //  - a drag that ends just outside the text (the header bar, the padding,
  //    the divider). The selection is still mostly in the reading, so clip it
  //    to the pane instead of throwing it away.
  //  - the button vanishing before their tap lands. Pressing anything clears a
  //    selection on some devices, so the button acts on pointerdown and stays
  //    up for a grace period after the selection collapses.
  useEffect(() => {
    if (!publishedHtml) return;
    let settle = null;
    let hide = null;
    const check = () => {
      const pane = readingPaneRef.current;
      const sel = window.getSelection();
      if (!pane || !sel || sel.rangeCount === 0 || sel.isCollapsed) { scheduleHide(); return; }
      const range = sel.getRangeAt(0).cloneRange();
      if (!range.intersectsNode(pane)) { scheduleHide(); return; }
      // Clip to the reading so text from the toolbar or side panel never
      // sneaks into a flagged quote.
      const bounds = document.createRange();
      bounds.selectNodeContents(pane);
      if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) range.setStart(bounds.startContainer, bounds.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0)     range.setEnd(bounds.endContainer, bounds.endOffset);
      // Range.toString() runs paragraphs together; laying the fragment out
      // for a moment gives innerText, which keeps a break between blocks.
      const scratch = document.createElement('div');
      // (opacity, not visibility:hidden — hidden text is left out of innerText)
      scratch.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;opacity:0;pointer-events:none';
      scratch.appendChild(range.cloneContents());
      document.body.appendChild(scratch);
      const text = scratch.innerText.replace(/\s+/g, ' ').trim();
      scratch.remove();
      if (text.length <= 5) { scheduleHide(); return; }
      clearTimeout(hide);
      const rect = range.getBoundingClientRect();
      setSelection({
        text,
        // Keep the button on screen even for a selection at the very top.
        top: Math.max(rect.top, 56),
        left: Math.min(Math.max(rect.left + rect.width / 2, 80), window.innerWidth - 80),
      });
    };
    const scheduleHide = () => {
      clearTimeout(hide);
      hide = setTimeout(() => setSelection(null), 1500);
    };
    const onChange = () => { clearTimeout(settle); settle = setTimeout(check, 200); };
    document.addEventListener('selectionchange', onChange);
    // Scrolling the reading moves the highlighted text; keep the button with it.
    const pane = readingPaneRef.current;
    pane?.addEventListener('scroll', onChange, { passive: true });
    return () => {
      clearTimeout(settle); clearTimeout(hide);
      document.removeEventListener('selectionchange', onChange);
      pane?.removeEventListener('scroll', onChange);
    };
  }, [publishedHtml]);

  // Act on pointerdown, before the press can clear the selection, and stop
  // the default so it never does.
  function openExtractor(e) {
    e?.preventDefault?.();
    if (!selection) return;
    setExtractedText(selection.text);
    setExtractorOpen(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  // Copy protection — block copy/cut/contextmenu/keyboard shortcuts on the reading pane
  useEffect(() => {
    const el = readingPaneRef.current;
    if (!el || !publishedHtml) return;
    const block    = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    const blockKey = e => {
      if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'x', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    el.addEventListener('copy',        block,    { capture: true });
    el.addEventListener('cut',         block,    { capture: true });
    el.addEventListener('contextmenu', block,    { capture: true });
    el.addEventListener('keydown',     blockKey, { capture: true });
    return () => {
      el.removeEventListener('copy',        block,    { capture: true });
      el.removeEventListener('cut',         block,    { capture: true });
      el.removeEventListener('contextmenu', block,    { capture: true });
      el.removeEventListener('keydown',     blockKey, { capture: true });
    };
  }, [publishedHtml]);

  // ── Save engine ───────────────────────────────────────────────────────────
  // Everything the save code needs, kept in a ref so the debounced flush and
  // the pagehide handler always see the current values, never a stale closure.
  const latest = useRef({});
  useEffect(() => {
    latest.current = {
      user, reading, positionX, positionY, axes, justification, reflection,
      reflectMode, hadSaved, hadReflection, savedPlot,
      draftKey: user && reading ? draftKey(user.uid, reading.id) : null,
    };
  });
  const editSeq        = useRef(0);     // bumps on every user edit
  const flushedSeq     = useRef(0);     // the edit a flush last started from
  const autosaveTimer  = useRef(null);
  const flushChain     = useRef(Promise.resolve());
  const flushRef       = useRef(null);  // lets the retry timer call flush without self-reference
  // A restored draft beats the consensus seed. State, not a ref, because the
  // seeding decision below is made during render.
  const [draftApplied, setDraftApplied] = useState(false);
  const [seededFrom,   setSeededFrom]   = useState(null);
  // In reflection mode the reflection loader owns the draft, so the plot
  // loader must not throw it away as stale.
  const reflectModeRef = useRef(false);
  useEffect(() => { reflectModeRef.current = reflectMode; }, [reflectMode]);

  // Write the current form to Firestore. Resolves true when the server has it.
  const flush = useCallback(({ submit = false } = {}) => {
    clearTimeout(autosaveTimer.current);
    const job = async () => {
      const l = latest.current;
      if (!l.user || !l.reading) return false;
      const seq = editSeq.current;
      flushedSeq.current = seq;

      const needX = needXAxis(l.axes), needY = needYAxis(l.axes);
      // Centre is "no position" — never store it as one.
      const px = needX && hasPosition(l.positionX) ? l.positionX : null;
      const py = needY && hasPosition(l.positionY) ? l.positionY : null;

      try {
        if (l.reflectMode) {
          const moved = (needX && hasPosition(l.savedPlot?.positionX) && px !== l.savedPlot.positionX)
                     || (needY && hasPosition(l.savedPlot?.positionY) && py !== l.savedPlot.positionY);
          // Don't create an empty reflection doc just because the page opened.
          if (!l.hadReflection && !submit && !l.reflection.trim() && !moved) { setSaveState('idle'); return false; }
          setSaveState('saving');
          const data = {
            uid: l.user.uid,
            readingId: l.reading.id,
            originalPositionX: l.savedPlot?.positionX ?? null,
            originalPositionY: l.savedPlot?.positionY ?? null,
            newPositionX: px,
            newPositionY: py,
            // Single-axis pair the grading view reads
            originalPosition: l.savedPlot?.positionX ?? l.savedPlot?.positionY ?? null,
            newPosition: px ?? py,
            reflection: l.reflection,
            updatedAt: serverTimestamp(),
          };
          // A draft becomes a submission only when the student says so; an
          // autosave never flips it either way.
          if (submit) data.draft = false;
          else if (!l.hadReflection) data.draft = true;
          await setDoc(doc(db, 'pg_reflections', `${l.user.uid}_${l.reading.id}`), data, { merge: true });
          setHadReflection(true);
          if (submit) setReflectionSubmitted(true);
        } else {
          if (!l.hadSaved && !l.justification.trim() && px === null && py === null) { setSaveState('idle'); return false; }
          setSaveState('saving');
          const data = {
            uid: l.user.uid,
            readingId: l.reading.id,
            positionX: px,
            positionY: py,
            axes: l.axes,
            justification: l.justification,
            updatedAt: serverTimestamp(),
          };
          await setDoc(doc(db, 'plots', `${l.user.uid}_${l.reading.id}`), data, { merge: true });
          setHadSaved(true);
          setSavedPlot(prev => ({ ...(prev || {}), ...data }));
        }
        // Only drop the on-device copy if nothing was typed while we were saving.
        if (editSeq.current === seq) {
          clearDraft(l.draftKey);
          setSaveState('saved');
          setSavedAt(new Date());
          setSaveError(null);
        }
        return true;
      } catch (err) {
        console.error('Autosave failed', err);
        setSaveState('error');
        setSaveError(err.code === 'permission-denied'
          ? 'Firestore refused the save (permissions). Your work is kept on this device.'
          : 'Could not reach the server. Your work is kept on this device and will retry.');
        autosaveTimer.current = setTimeout(() => flushRef.current?.(), RETRY_DELAY_MS);
        return false;
      }
    };
    // Serialise so a click during an autosave cannot race it.
    const run = flushChain.current.then(job, job);
    flushChain.current = run.catch(() => {});
    return run;
  }, []);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const scheduleAutosave = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

  // Every user edit goes through here: mirror to the draft, then autosave.
  const edited = useCallback((patch) => {
    editSeq.current += 1;
    const l = { ...latest.current, ...patch };
    writeDraft(l.draftKey, {
      positionX: l.positionX, positionY: l.positionY, axes: l.axes,
      justification: l.justification, reflection: l.reflection,
    });
    setSaveState('unsaved');
    scheduleAutosave();
  }, [scheduleAutosave]);

  // Leaving the page — tab closed, phone locked, back button — sends whatever
  // is still pending. With offline persistence on, the SDK keeps the write
  // even if the tab is gone before the server answers.
  useEffect(() => {
    const onHide = () => { if (editSeq.current !== flushedSeq.current) flush(); };
    const onVis  = () => { if (document.visibilityState === 'hidden') onHide(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(autosaveTimer.current);
      onHide();
    };
  }, [flush]);

  // Apply an on-device draft on top of whatever Firestore had.
  const applyDraft = useCallback((draft, { reflect }) => {
    if (typeof draft.positionX === 'number') setPositionX(draft.positionX);
    if (typeof draft.positionY === 'number') setPositionY(draft.positionY);
    if (draft.axes) setAxes(draft.axes);
    if (typeof draft.justification === 'string') setJustification(draft.justification);
    if (reflect && typeof draft.reflection === 'string') setReflection(draft.reflection);
    setDraftApplied(true);
    setRestoredDraft(true);
    // Treat it as a fresh edit so the autosave pushes it up and, once
    // confirmed, clears the draft.
    editSeq.current += 1;
    setSaveState('unsaved');
    scheduleAutosave();
  }, [scheduleAutosave]);

  // Reload whatever this student already saved for this reading, so leaving
  // and coming back shows their position and justification rather than a
  // blank form. Keyed on ids, not objects: the readings list is replaced once
  // Firestore answers, and re-running this then would have put the saved text
  // back over anything typed in the meantime.
  const uid = user?.uid;
  const readingId = reading?.id;
  useEffect(() => {
    if (!uid || !readingId) return;
    let cancelled = false;
    const key = draftKey(uid, readingId);
    (async () => {
      setLoadState('loading');
      let d = null;
      let source;
      try {
        const res = await loadDoc(doc(db, 'plots', `${uid}_${readingId}`));
        if (cancelled) return;
        source = res.source;
        if (res.snap.exists()) {
          d = res.snap.data();
          if (typeof d.positionX === 'number') setPositionX(d.positionX);
          if (typeof d.positionY === 'number') setPositionY(d.positionY);
          if (d.justification) setJustification(d.justification);
          if (d.axes) setAxes(d.axes);
          setSavedPlot(d);
        }
      } catch (err) {
        // Neither the server nor the cache. Keep the form locked rather than
        // show an empty one that a keystroke would then save over the real work.
        console.error('Could not load your saved position', err);
        if (!cancelled) setLoadState('failed');
        return;
      }
      if (cancelled) return;
      const draft = readDraft(key);
      const verdict = judgeDraft(draft, d, ['positionX', 'positionY', 'axes', 'justification']);
      if (verdict === 'apply') applyDraft(draft, { reflect: false });
      else if (verdict === 'ask') setPendingDraft({ ...draft, reflect: false });
      else if (draft && !reflectModeRef.current) clearDraft(key);
      setHadSaved(!!d);
      setLoadState(source === 'cache' ? 'cached' : 'ready');
    })();
    return () => { cancelled = true; };
  }, [uid, readingId, applyDraft, loadAttempt]);

  const restorePendingDraft = () => {
    if (!pendingDraft) return;
    applyDraft(pendingDraft, { reflect: pendingDraft.reflect });
    setPendingDraft(null);
  };
  const discardPendingDraft = () => {
    clearDraft(latest.current.draftKey);
    setPendingDraft(null);
  };

  // Reflection mode is a per-reading switch the teacher flips after the seminar.
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'),
      snap => setReflectMode(!!(snap.exists() && (snap.data().reflectReadings || []).includes(id))),
      err => console.error('Could not read reflection mode', err));
    return () => unsub();
  }, [id]);

  // In reflection mode the whole class's positions appear on the spectrum.
  useEffect(() => {
    if (!reflectMode || !id) return;
    const unsub = onSnapshot(
      query(collection(db, 'plots'), where('readingId', '==', id)),
      snap => setClassPlots(snap.docs.map(d => d.data())),
      err => console.error('Could not load class positions', err));
    return () => unsub();
  }, [reflectMode, id]);

  // Restore a reflection already written for this reading — text and, if they
  // moved, the marker where they moved it to (not back at the original).
  useEffect(() => {
    if (!uid || !readingId || !reflectMode) return;
    let cancelled = false;
    const key = draftKey(uid, readingId);
    (async () => {
      let d = null;
      try {
        const res = await loadDoc(doc(db, 'pg_reflections', `${uid}_${readingId}`));
        if (cancelled) return;
        if (res.snap.exists()) {
          d = res.snap.data();
          if (typeof d.reflection === 'string') setReflection(d.reflection);
          if (typeof d.newPositionX === 'number') setPositionX(d.newPositionX);
          if (typeof d.newPositionY === 'number') setPositionY(d.newPositionY);
        }
      } catch (err) {
        console.error('Could not load your reflection', err);
        if (!cancelled) setLoadState('failed');
        return;
      }
      if (cancelled) return;
      setHadReflection(!!d);
      setReflectionSubmitted(!!d && d.draft !== true);
      const draft = readDraft(key);
      // The reflection doc stores the moved marker as newPositionX/Y.
      const saved = d && { ...d, positionX: d.newPositionX ?? null, positionY: d.newPositionY ?? null };
      const verdict = judgeDraft(draft, saved, ['positionX', 'positionY', 'reflection']);
      if (verdict === 'apply') applyDraft(draft, { reflect: true });
      else if (verdict === 'ask') setPendingDraft({ ...draft, reflect: true });
      else if (draft) clearDraft(key);
    })();
    return () => { cancelled = true; };
  }, [uid, readingId, reflectMode, applyDraft, loadAttempt]);

  // The "restored" notice only needs a moment.
  useEffect(() => {
    if (!restoredDraft) return;
    const t = setTimeout(() => setRestoredDraft(false), 8000);
    return () => clearTimeout(t);
  }, [restoredDraft]);

  // Seed a genuinely blank form from the previous period's class consensus.
  // Reads it off the same hook the drift arrow uses, so the two can never
  // disagree about what the document says. Decided during render rather than in
  // an effect so the marker never paints at centre first.
  if (consensusLoaded && hadSaved === false && !draftApplied && seededFrom !== id) {
    setSeededFrom(id);
    const idx = activeReadings.findIndex(r => r.id === id);
    const prev = idx > 0 ? consensus?.[activeReadings[idx - 1].id] : null;
    // The seminar consensus is a single value now, so only seed what is
    // actually there — writing undefined would break the "has the student
    // placed themselves yet" checks.
    if (typeof prev?.x === 'number') setPositionX(prev.x);
    if (typeof prev?.y === 'number') setPositionY(prev.y);
  }

  // The class trend heading into this period. Held back until both the reading
  // list and the consensus have settled — useReadings starts from a hardcoded
  // list and swaps in the teacher's, so an ungated chip can flash a wrong way.
  const drift = useMemo(
    () => (readingsLoading || !consensusLoaded
      ? null
      : societyDrift(consensus, activeReadings, { untilId: id })),
    [consensus, consensusLoaded, activeReadings, readingsLoading, id]);

  // The button: flush now, and only say "Saved" once the server agrees.
  async function handleSaveClick() {
    if (!ready || !user) return;
    const ok = await flush({ submit: reflectMode });
    if (ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    }
  }

  // User-driven changes — the only ones that count as edits.
  const changeX = (v) => { setPositionX(v); edited({ positionX: v }); };
  const changeY = (v) => { setPositionY(v); edited({ positionY: v }); };
  const changeAxes = (key) => { setAxes(key); edited({ axes: key }); };
  const changeText = (v) => {
    if (reflectMode) { setReflection(v);    edited({ reflection: v }); }
    else             { setJustification(v); edited({ justification: v }); }
  };

  const fmtTime = (d) => d?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const saveStatus = (() => {
    switch (saveState) {
      case 'saving':  return { text: 'Saving…', color: 'var(--pg-dim)' };
      case 'unsaved': return { text: 'Unsaved changes', color: 'var(--pg-dim)' };
      case 'error':   return { text: `⚠ ${saveError}`, color: '#ef4444' };
      case 'saved':   return {
        text: reflectMode && hadReflection && !reflectionSubmitted
          ? `Draft saved ${fmtTime(savedAt)} — not submitted yet`
          : `Saved ${fmtTime(savedAt)}`,
        color: 'var(--pg-dim)',
      };
      default:
        if (reflectMode && hadReflection && !reflectionSubmitted) return { text: 'Draft — not submitted yet', color: 'var(--pg-dim)' };
        if (reflectMode && reflectionSubmitted) return { text: 'Submitted ✓', color: '#22c55e' };
        return null;
    }
  })();

  if (readingsLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--pg-bg)' }}>
        <NavBar backTo="/dashboard" backLabel="Dashboard" />
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mt-10" style={{ borderColor: 'var(--pg-border)', borderTopColor: 'var(--pg-primary)' }} />
      </div>
    );
  }

  const classDotsX = classPlots
    .filter(p => p.uid !== user?.uid && typeof p.positionX === 'number')
    .map(p => ({ value: p.positionX, label: 'Classmate' }));
  const classDotsY = classPlots
    .filter(p => p.uid !== user?.uid && typeof p.positionY === 'number')
    .map(p => ({ value: p.positionY, label: 'Classmate' }));

  // During a live seminar a student moving their point is autosaved as soon
  // as they stop dragging, so the class board updates without a click.
  const needX = needXAxis(axes);
  const needY = needYAxis(axes);
  // Nothing is editable until the saved copy is on screen (or known absent).
  const formLocked = loadState === 'loading' || loadState === 'failed';

  // The class trend is hidden until this student has actually committed to a
  // position, so it cannot nudge them. Note hadSaved alone is not enough: a
  // plots doc exists as soon as they type a character of justification, with no
  // position in it. In reflection mode every classmate's dot is already on the
  // spectrum, so there is nothing left to anchor.
  const showDrift = !!drift && (isTeacher || reflectMode
    || hasPosition(savedPlot?.positionX) || hasPosition(savedPlot?.positionY));
  const ready = (!needX || hasPosition(positionX)) && (!needY || hasPosition(positionY));
  const summary = !ready
    ? (needX && needY
        ? 'Move both markers off centre — the middle is not a position'
        : 'Move the marker off centre — the middle is not a position')
    : [needX && `Economic: ${positionLabel(positionX)}`, needY && `Political: ${positionLabel(positionY)}`]
        .filter(Boolean).join('  ·  ');

  if (!reading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--pg-bg)' }}>
        <NavBar backTo="/dashboard" backLabel="Dashboard" />
        <h1 className="text-2xl font-bold mt-10">Reading not found</h1>
        <Link to="/dashboard" className="text-blue-500 hover:underline mt-4">Return to Dashboard</Link>
      </div>
    );
  }

  const isPublished = !htmlLoading && !!publishedHtml;
  const showIframe  = !htmlLoading && !publishedHtml;

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar backTo="/dashboard" backLabel="Dashboard" />

      {selection && !extractorOpen && (
        <button
          onPointerDown={openExtractor}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openExtractor(e); }}
          className="fixed z-50 px-3 py-1.5 text-sm font-semibold rounded-lg shadow-lg flex items-center gap-1 transition-transform hover:scale-105 select-none"
          style={{
            top: selection.top - 40,
            left: selection.left,
            backgroundColor: 'var(--pg-primary)',
            color: 'var(--pg-on-primary)',
            transform: 'translateX(-50%)'
          }}
        >
          🔖 Flag for Diploma
        </button>
      )}

      <DiplomaExtractorModal 
        isOpen={extractorOpen} 
        onClose={() => setExtractorOpen(false)}
        selectedText={extractedText}
        readingId={reading.id}
        readingTitle={reading.title}
      />

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Top: both spectrums, spanning the full width ── */}
        <div
          className="spectrum-sky shrink-0 px-6 py-3"
          style={{ backgroundColor: 'var(--pg-surface)', borderBottom: '1px solid var(--pg-border)' }}
        >
          <div
            aria-hidden="true"
            className="spectrum-sky__art"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/${skyFile})` }}
          />
          <div aria-hidden="true" className="spectrum-sky__scrim" />
          <div className="max-w-3xl mx-auto">
            <div className="flex items-baseline justify-between gap-3">
              {showDrift && <SocietyDrift drift={drift} size="chip" className="self-center" />}
              <button
                onClick={() => togglePanel('spectrum', spectrumOpen, setSpectrumOpen)}
                className="font-display font-bold text-sm hover:opacity-80 transition-opacity shrink-0"
                style={{ color: 'var(--pg-text)' }}
                title={spectrumOpen ? 'Hide the spectrums' : 'Show the spectrums'}
              >
                {spectrumOpen ? '▾' : '▸'} Where is society?
              </button>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex gap-1 shrink-0">
                  {[['economic','Economic'],['political','Political'],['both','Both']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => changeAxes(key)}
                      disabled={formLocked}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={axes === key
                        ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
                        : { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Truncates rather than squashing the axis pills: each Spectrum
                    renders this same readout under its own marker anyway. */}
                <p className="text-xs font-medium min-w-0 truncate" aria-live="polite"
                  title={summary}
                  style={{ color: ready ? 'var(--pg-dim)' : 'var(--pg-primary)' }}>
                  {loadState === 'loading' ? 'Loading your saved work…' : loadState === 'failed' ? 'Could not load your saved work' : summary}
                </p>
              </div>
            </div>

            {spectrumOpen && (
            <div className="flex flex-col mt-2">
              {needX && (
                <>
                  <h3 className="text-center font-bold text-[11px] mb-1.5 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Economic Spectrum</h3>
                  <Spectrum
                    value={positionX ?? 0}
                    onChange={changeX}
                    disabled={formLocked}
                    leftLabel={null} rightLabel={null} sublabels={[]}
                    classDots={reflectMode ? classDotsX : []}
                    secondaryDot={reflectMode && typeof savedPlot?.positionX === 'number'
                      ? { value: savedPlot.positionX, label: 'Where you started' } : null}
                  />
                </>
              )}

              {needX && needY && (
                <div className="flex justify-between items-center my-1 px-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Collectivism</span>
                  <span className="text-[11px]" style={{ color: 'var(--pg-dim)' }}>◆</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Individualism</span>
                </div>
              )}

              {needY && (
                <>
                  <Spectrum
                    value={positionY ?? 0}
                    onChange={changeY}
                    disabled={formLocked}
                    leftLabel={null} rightLabel={null} sublabels={[]}
                    classDots={reflectMode ? classDotsY : []}
                    secondaryDot={reflectMode && typeof savedPlot?.positionY === 'number'
                      ? { value: savedPlot.positionY, label: 'Where you started' } : null}
                  />
                  <h3 className="text-center font-bold text-[11px] mt-1.5 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Political Spectrum</h3>
                </>
              )}
            </div>
            )}

          </div>
        </div>

        {/* ── Below: reading on the left, writing on the right ── */}
        <div className="flex-1 flex overflow-hidden">
        {/* ── Left: Reading pane ── */}
        <div
          className="flex-1 overflow-hidden flex flex-col"
          style={{ borderRight: '1px solid var(--pg-border)' }}
        >
          {/* Reading header bar */}
          <div
            className="shrink-0 flex items-center justify-between px-5 py-2.5 text-sm"
            style={{ borderBottom: '1px solid var(--pg-border)', backgroundColor: 'var(--pg-surface)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--pg-text)' }}>{reading.title}</span>
            <div className="flex items-center gap-3">
              {isPublished && speech.supported && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => speech.speaking
                      ? speech.togglePause()
                      : speech.start(readingPaneRef.current?.innerText || '')}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
                    title={speech.speaking ? (speech.paused ? 'Resume reading aloud' : 'Pause') : 'Read this aloud'}
                  >
                    {speech.speaking ? (speech.paused ? '▶ Resume' : '⏸ Pause') : '🔊 Listen'}
                  </button>
                  {speech.speaking && (
                    <button
                      onClick={speech.stop}
                      className="text-xs font-semibold px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
                      style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                      title="Stop"
                    >
                      ⏹
                    </button>
                  )}
                  <select
                    value={speech.rate}
                    onChange={e => speech.changeRate(Number(e.target.value))}
                    className="text-xs rounded-lg px-1.5 py-1 focus:outline-none"
                    style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                    title="Reading speed"
                  >
                    {[0.75, 1, 1.25, 1.5].map(r => (
                      <option key={r} value={r}>{r}×</option>
                    ))}
                  </select>
                </div>
              )}
              {isTeacher && (
                <a
                  href={reading.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--pg-primary)' }}
                >
                  Edit in Docs ↗
                </a>
              )}
              {isPublished && !isTeacher && (
                <span
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: 'var(--pg-dim)' }}
                  title="Text selection is disabled on this reading"
                >
                  🔒 Read only
                </span>
              )}
              {showIframe && isTeacher && (
                <span className="text-[11px]" style={{ color: '#f59e0b' }}>
                  ⚠ Not published — showing Google Doc preview
                </span>
              )}
            </div>
          </div>

          {/* Loading spinner */}
          {htmlLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div
                className="w-6 h-6 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--pg-border)', borderTopColor: 'var(--pg-primary)' }}
              />
            </div>
          )}

          {isPublished && (
            <div
              ref={readingPaneRef}
              className="reading-content flex-1 overflow-y-auto px-10 py-8 relative"
              style={{
                userSelect: 'text',
                WebkitUserSelect: 'text',
                MozUserSelect: 'text',
                msUserSelect: 'text',
                color: 'var(--pg-text)',
                lineHeight: '1.8',
                fontSize: '15px',
              }}
              dangerouslySetInnerHTML={{ __html: publishedHtml }}
            />
          )}

          {/* Fallback iframe if not yet published */}
          {showIframe && (
            <iframe
              src={reading.url}
              title={reading.title}
              className="flex-1 border-none"
              allow="autoplay"
            />
          )}
        </div>

        {/* ── Drag handle ── */}
        {writingOpen && (
          <div
            ref={splitRef}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize the reading and writing panels"
            onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
            onTouchStart={() => setDragging(true)}
            onDoubleClick={() => setWritingWidth(416)}
            className="shrink-0 relative group"
            style={{ width: '6px', cursor: 'col-resize', backgroundColor: dragging ? 'var(--pg-primary)' : 'var(--pg-border)' }}
            title="Drag to resize · double-click to reset"
          >
            <div
              className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
              style={{
                width: '3px', height: '34px',
                transform: 'translate(-50%, -50%)',
                backgroundColor: dragging ? 'var(--pg-on-primary)' : 'var(--pg-border2)',
              }}
            />
          </div>
        )}

        {/* ── Right: justification, collapsible to a rail ── */}
        {!writingOpen ? (
          <div
            className="w-12 shrink-0 flex items-start justify-center pt-5"
            style={{ backgroundColor: 'var(--pg-surface)', borderLeft: '1px solid var(--pg-border)' }}
          >
            <button
              onClick={() => togglePanel('writing', writingOpen, setWritingOpen)}
              className="text-xs font-semibold hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: 'var(--pg-text)', writingMode: 'vertical-rl' }}
              title="Show the writing panel"
            >
              ◂ {reflectMode ? 'Reflect on your position' : 'Justify your position'}
            </button>
          </div>
        ) : (
        <div
          className="shrink-0 flex flex-col overflow-y-auto p-6 gap-4"
          style={{ width: `${writingWidth}px`, backgroundColor: 'var(--pg-surface)' }}
        >
          {/* Justification */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-sm font-semibold" style={{ color: 'var(--pg-text)' }}>
                {reflectMode ? 'Reflect on your position' : 'Justify your position'}
              </label>
              <button
                onClick={() => togglePanel('writing', writingOpen, setWritingOpen)}
                className="text-xs hover:opacity-100 opacity-60 transition-opacity"
                style={{ color: 'var(--pg-text)' }}
                title="Hide the writing panel and widen the reading"
              >
                ▸
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--pg-dim)' }}>
              {reflectMode
                ? 'The grey dots are the rest of the class. Move your marker if the seminar changed your mind, then explain what changed and why.'
                : 'Use at least one piece of evidence from the reading to support your placement.'}
            </p>
            {loadState === 'failed' && (
              <div className="text-xs mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-3" role="alert"
                style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid #ef4444', color: 'var(--pg-text)' }}>
                <span>⚠ Couldn’t load your saved work — the form is locked so nothing gets written over it. Check the connection and try again.</span>
                <button onClick={() => setLoadAttempt(a => a + 1)} className="shrink-0 font-semibold px-2.5 py-1 rounded-md"
                  style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}>
                  Retry
                </button>
              </div>
            )}
            {loadState === 'cached' && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" role="status"
                style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}>
                Showing the copy saved on this device — the server was slow to answer. Changes will sync when it does.
              </p>
            )}
            {restoredDraft && (
              <p className="text-xs mb-3 px-3 py-2 rounded-lg" role="status"
                style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}>
                ↩ Restored unsaved work from this device.
              </p>
            )}
            {pendingDraft && (
              <div className="text-xs mb-3 px-3 py-2 rounded-lg" role="status"
                style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-primary)', color: 'var(--pg-text)' }}>
                <p className="mb-2">
                  This device has unsaved text from {new Date(pendingDraft.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} that
                  differs from what was saved later. Which do you want?
                </p>
                <div className="flex gap-2">
                  <button onClick={restorePendingDraft} className="font-semibold px-2.5 py-1 rounded-md"
                    style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}>
                    Use the text from this device
                  </button>
                  <button onClick={discardPendingDraft} className="font-semibold px-2.5 py-1 rounded-md"
                    style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}>
                    Keep what’s saved
                  </button>
                </div>
              </div>
            )}
            <textarea
              value={reflectMode ? reflection : justification}
              onChange={e => changeText(e.target.value)}
              onPaste={e => { e.preventDefault(); alert('Pasting is not allowed on this site.'); }}
              disabled={formLocked}
              placeholder={loadState === 'loading' ? 'Loading your saved work…' : reflectMode ? 'After the seminar I…' : 'The text argues that…'}
              className="flex-1 resize-none rounded-xl p-4 text-sm focus:outline-none transition-colors min-h-[140px] disabled:opacity-60"
              style={{
                backgroundColor: 'var(--pg-surface2)',
                border: '1px solid var(--pg-border)',
                color: 'var(--pg-text)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--pg-primary)'}
              onBlur={e  => e.target.style.borderColor = 'var(--pg-border)'}
            />
          </div>

          {/* Long-form response lives in Desk when the teacher has linked one */}
          {reading.deskAssignmentId && (
            <a
              href={`https://desk.mcraesocial.com/submit/${reading.deskAssignmentId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center font-semibold py-2.5 rounded-xl transition-opacity hover:opacity-80 text-sm"
              style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
            >
              ✏️ Write your full response in Desk ↗
            </a>
          )}

          {/* Save */}
          <div>
            {saveStatus && (
              <p className="text-[11px] mb-2 text-center" role="status" aria-live="polite" style={{ color: saveStatus.color }}>
                {saveStatus.text}
              </p>
            )}
            {reflectMode ? (
              <button
                onClick={handleSaveClick}
                disabled={!ready || !reflection.trim()}
                className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
                style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
                title="Your marker moves on the class board as you drag it; this hands the written reflection in"
              >
                {justSaved ? '✓ Submitted!' : reflectionSubmitted ? 'Update Reflection' : 'Submit Reflection'}
              </button>
            ) : (
              <button
                onClick={handleSaveClick}
                disabled={!ready || !justification.trim()}
                className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
                style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
                title="Your work autosaves as you go; this saves it right now"
              >
                {justSaved ? '✓ Saved!' : hadSaved ? 'Update Position' : 'Save Position'}
              </button>
            )}
            <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--pg-faint)' }}>
              Autosaves as you type. A copy is also kept on this device until the server confirms.
            </p>
          </div>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
