// src/pages/Reading.jsx
// Split-screen: reading text on left, Spectrum + justification on right.
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import DiplomaExtractorModal from '../components/DiplomaExtractorModal';
import { useReadings } from '../hooks/useReadings';
import { useAuth } from '../auth/AuthContext';

export default function Reading() {
  const { id } = useParams();
  const { readings, loading: readingsLoading } = useReadings();
  const reading = readings.find(r => r.id === id);
  const { user, isTeacher } = useAuth();

  const [positionX,     setPositionX]     = useState(null);
  const [positionY,     setPositionY]     = useState(null);
  const [justification, setJustification] = useState('');
  const [saved,         setSaved]         = useState(false);
  const [publishedHtml, setPublishedHtml] = useState(null); // null = still loading
  const [htmlLoading,   setHtmlLoading]   = useState(true);
  const [selection,     setSelection]     = useState(null);
  const [extractorOpen, setExtractorOpen] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const readingPaneRef = useRef(null);

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

  // Load previous class consensus for initial spectrum position
  useEffect(() => {
    async function loadConsensus() {
      if (!readings || readings.length === 0) return;
      const idx = readings.findIndex(r => r.id === id);
      if (idx > 0) {
        const prevId = readings[idx - 1].id;
        const snap = await getDoc(doc(db, 'settings', 'consensus'));
        if (snap.exists()) {
          const data = snap.data();
          if (data[prevId]) {
            setPositionX(data[prevId].x);
            setPositionY(data[prevId].y);
          }
        }
      }
    }
    loadConsensus();
  }, [id, readings]);

  async function handleSave() {
    if (positionX === null || positionY === null || !user) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    try {
      await setDoc(doc(db, 'plots', `${user.uid}_${reading.id}`), {
        uid: user.uid,
        readingId: reading.id,
        positionX,
        positionY,
        justification,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save plot', err);
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
              className="flex-1 overflow-y-auto px-10 py-8 relative"
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

        {/* ── Right: dual spectrums + justification ── */}
        <div
          className="w-96 shrink-0 flex flex-col overflow-y-auto p-6 gap-6"
          style={{ backgroundColor: 'var(--pg-surface)' }}
        >
          <div>
            <h2 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--pg-text)' }}>
              Where do you stand?
            </h2>
            <p className="text-xs mb-5" style={{ color: 'var(--pg-dim)' }}>
              Drag the markers to place your position on both spectrums.
            </p>

            <div className="flex flex-col">
              <h3 className="text-center font-bold text-xs mb-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Economic Spectrum</h3>
              <Spectrum
                value={positionX ?? 0}
                onChange={setPositionX}
                leftLabel={null}
                rightLabel={null}
                sublabels={[]}
              />

              <div className="flex justify-between items-center my-3 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Collectivism</span>
                <span className="text-[11px]" style={{ color: 'var(--pg-dim)' }}>◆</span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Individualism</span>
              </div>

              <Spectrum
                value={positionY ?? 0}
                onChange={setPositionY}
                leftLabel={null}
                rightLabel={null}
                sublabels={[]}
              />
              <h3 className="text-center font-bold text-xs mt-2 uppercase tracking-wide" style={{ color: 'var(--pg-text)' }}>Political Spectrum</h3>
            </div>

            {(positionX === null || positionY === null) && (
              <p className="text-xs text-center mt-4 font-medium" style={{ color: 'var(--pg-primary)' }}>
                Move both markers to record your position
              </p>
            )}
          </div>

          {/* Justification */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--pg-text)' }}>
              Justify your position
            </label>
            <p className="text-xs mb-3" style={{ color: 'var(--pg-dim)' }}>
              Use at least one piece of evidence from the reading to support your placement.
            </p>
            <textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              onPaste={e => { e.preventDefault(); alert('Pasting is not allowed on this site.'); }}
              placeholder="The text argues that…"
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
          <button
            onClick={handleSave}
            disabled={positionX === null || positionY === null || !justification.trim()}
            className="w-full font-semibold py-3 rounded-xl transition-opacity disabled:opacity-35"
            style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
          >
            {saved ? '✓ Saved!' : 'Save Position'}
          </button>
        </div>
      </div>
    </div>
  );
}
