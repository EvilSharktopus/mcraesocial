// src/pages/Reading.jsx
// Split-screen: reading text on left, Spectrum + justification on right.
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import DiplomaExtractorModal from '../components/DiplomaExtractorModal';
import { useSpeech } from '../hooks/useSpeech';
import { useTheme } from '../context/ThemeContext';
import { useReadings } from '../hooks/useReadings';
import { hasPosition, positionLabel } from '../data/readings';

const needXAxis = (axes) => axes !== 'political';
const needYAxis = (axes) => axes !== 'economic';
import { useAuth } from '../auth/AuthContext';

export default function Reading() {
  const { id } = useParams();
  const { readings, loading: readingsLoading } = useReadings();
  const reading = readings.find(r => r.id === id);
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
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [saved,         setSaved]         = useState(false);
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
  const [spectrumOpen, setSpectrumOpen] = useState(
    () => localStorage.getItem('pg-panel-spectrum') !== 'closed');
  const [writingOpen, setWritingOpen] = useState(
    () => localStorage.getItem('pg-panel-writing') !== 'closed');

  const togglePanel = (which, open, setOpen) => {
    localStorage.setItem(`pg-panel-${which}`, open ? 'closed' : 'open');
    setOpen(!open);
  };

  // Load published content from Firestore
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'readingContent', id), snap => {
      setPublishedHtml(snap.exists() ? snap.data().html : '');
      setHtmlLoading(false);
    });
    return () => unsub();
  }, [id]);

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

  // Reload whatever this student already saved for this reading, so leaving
  // and coming back shows their position and justification rather than a
  // blank form.
  useEffect(() => {
    if (!user || !reading) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'plots', `${user.uid}_${reading.id}`));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          if (typeof d.positionX === 'number') setPositionX(d.positionX);
          if (typeof d.positionY === 'number') setPositionY(d.positionY);
          if (d.justification) setJustification(d.justification);
          if (d.axes) setAxes(d.axes);
          setSavedPlot(d);
          setHadSaved(true);
        } else {
          setHadSaved(false);
        }
      } catch (err) {
        console.error('Could not load your saved position', err);
        if (!cancelled) setHadSaved(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, reading]);

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

  // Restore a reflection already written for this reading.
  useEffect(() => {
    if (!user || !reading || !reflectMode) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'pg_reflections', `${user.uid}_${reading.id}`));
        if (!cancelled && snap.exists() && snap.data().reflection) {
          setReflection(snap.data().reflection);
        }
      } catch (err) {
        console.error('Could not load your reflection', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user, reading, reflectMode]);

  // Load previous class consensus for initial spectrum position
  useEffect(() => {
    async function loadConsensus() {
      if (hadSaved !== false) return;   // only seed a genuinely blank form
      if (!readings || readings.length === 0) return;
      const idx = readings.findIndex(r => r.id === id);
      if (idx > 0) {
        const prevId = readings[idx - 1].id;
        const snap = await getDoc(doc(db, 'settings', 'consensus'));
        if (snap.exists()) {
          const data = snap.data();
          if (data[prevId]) {
            // The seminar consensus is a single value now, so only seed what is
            // actually there — writing undefined would break the "has the
            // student placed themselves yet" checks.
            if (typeof data[prevId].x === 'number') setPositionX(data[prevId].x);
            if (typeof data[prevId].y === 'number') setPositionY(data[prevId].y);
          }
        }
      }
    }
    loadConsensus();
  }, [id, readings, hadSaved]);

  async function handleSave() {
    if (!ready || !user) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    try {
      await setDoc(doc(db, 'plots', `${user.uid}_${reading.id}`), {
        uid: user.uid,
        readingId: reading.id,
        positionX: needX ? positionX : null,
        positionY: needY ? positionY : null,
        axes,
        justification,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save plot', err);
    }
  }

  async function handleSaveReflection() {
    if (!user || !reading || !reflection.trim()) return;
    setReflectionSaved(true);
    setTimeout(() => setReflectionSaved(false), 2500);
    try {
      await setDoc(doc(db, 'pg_reflections', `${user.uid}_${reading.id}`), {
        uid: user.uid,
        readingId: reading.id,
        originalPositionX: savedPlot?.positionX ?? null,
        originalPositionY: savedPlot?.positionY ?? null,
        newPositionX: needX ? positionX : null,
        newPositionY: needY ? positionY : null,
        // Single-axis pair the grading view reads
        originalPosition: savedPlot?.positionX ?? savedPlot?.positionY ?? null,
        newPosition: (needX ? positionX : null) ?? (needY ? positionY : null),
        reflection,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save reflection', err);
    }
  }

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

  // During a live seminar a student should be able to move their point on the
  // strength of the discussion, without having to write the reflection first.
  const movedX = needXAxis(axes) && hasPosition(savedPlot?.positionX) && positionX !== savedPlot.positionX;
  const movedY = needYAxis(axes) && hasPosition(savedPlot?.positionY) && positionY !== savedPlot.positionY;
  const hasMoved = movedX || movedY;

  const needX = axes !== 'political';
  const needY = axes !== 'economic';
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
          onClick={() => {
            setExtractedText(selection.text);
            setExtractorOpen(true);
            setSelection(null);
            window.getSelection().removeAllRanges();
          }}
          className="fixed z-50 px-3 py-1.5 text-sm font-semibold rounded-lg shadow-lg flex items-center gap-1 transition-transform hover:scale-105"
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
            <div className="flex items-baseline justify-between gap-4">
              <button
                onClick={() => togglePanel('spectrum', spectrumOpen, setSpectrumOpen)}
                className="font-display font-bold text-sm hover:opacity-80 transition-opacity"
                style={{ color: 'var(--pg-text)' }}
                title={spectrumOpen ? 'Hide the spectrums' : 'Show the spectrums'}
              >
                {spectrumOpen ? '▾' : '▸'} Where do you stand?
              </button>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[['economic','Economic'],['political','Political'],['both','Both']].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setAxes(key)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                      style={axes === key
                        ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
                        : { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-medium"
                  style={{ color: ready ? 'var(--pg-dim)' : 'var(--pg-primary)' }}>
                  {summary}
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
                    onChange={setPositionX}
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
                    onChange={setPositionY}
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
              onMouseUp={() => {
                setTimeout(() => {
                  const sel = window.getSelection();
                  const text = sel.toString().trim();
                  if (text.length > 5 && readingPaneRef.current?.contains(sel.anchorNode)) {
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    setSelection({
                      text,
                      top: rect.top,
                      left: rect.left + rect.width / 2
                    });
                  } else {
                    setSelection(null);
                  }
                }, 10);
              }}
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
            <textarea
              value={reflectMode ? reflection : justification}
              onChange={e => (reflectMode ? setReflection : setJustification)(e.target.value)}
              onPaste={e => { e.preventDefault(); alert('Pasting is not allowed on this site.'); }}
              placeholder={reflectMode ? 'After the seminar I…' : 'The text argues that…'}
              className="flex-1 resize-none rounded-xl p-4 text-sm focus:outline-none transition-colors min-h-[140px]"
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
          {reflectMode ? (
            <button
              onClick={handleSaveReflection}
              disabled={!ready || (!reflection.trim() && !hasMoved)}
              className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
              title="Your new position shows on the class board as soon as you save"
            >
              {reflectionSaved
                ? '✓ Saved!'
                : reflection.trim() ? 'Save Reflection' : 'Save New Position'}
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!ready || !justification.trim()}
              className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
            >
              {saved ? '✓ Saved!' : hadSaved ? 'Update Position' : 'Save Position'}
            </button>
          )}
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
