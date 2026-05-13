// src/components/IntegrityTextbox.jsx
// Reusable textarea with full academic integrity monitoring.
//
// Props:
//   value          — controlled string value
//   onChange       — (newValue: string) => void
//   placeholder    — string
//   studentName    — string (Firestore key)
//   phaseKey       — string e.g. "phase2", "phase3" (used as Firestore flag path)
//   fieldKey       — string e.g. "source_1", "defence" (sub-field within phase)
//   rows           — number (default 4)
//   disabled       — bool
//   className      — extra Tailwind classes for the textarea
//
// What it does (all silent to students):
//   1. Blocks paste (preventDefault + brief inline message)
//   2. Blocks drop events
//   3. Detects programmatic injection — value changes without a trusted keyboard event
//   4. Logs keystroke timestamps (epoch ms) to Firestore, NOT actual keys
//   5. Velocity flag — >50 words in any 3-second window → velocityFlag: true in Firestore
//   6. Students never see flag state

import { useState, useRef, useCallback, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// How long (ms) the "no pasting" message stays visible
const PASTE_MSG_DURATION = 2000;
// Velocity check: words per window
const VELOCITY_WORD_LIMIT = 50;
const VELOCITY_WINDOW_MS = 3000;
// Debounce for writing keystroke batches to Firestore
const KEYSTROKE_FLUSH_MS = 4000;

function getFlagDocPath(studentName, phaseKey) {
  return ['sessions', 'minerals', 'students', studentName].join('/');
}

export default function IntegrityTextbox({
  value,
  onChange,
  placeholder = '',
  studentName,
  phaseKey,
  fieldKey,
  rows = 4,
  disabled = false,
  className = '',
}) {
  const [showPasteMsg, setShowPasteMsg] = useState(false);
  const pasteMsgTimer = useRef(null);

  // Track whether we've received a trusted keyboard event since last value change
  const trustedKeyPending = useRef(false);

  // Buffer of keystroke timestamps not yet flushed to Firestore
  const keystrokeBuffer = useRef([]);
  const flushTimer = useRef(null);

  // Rolling word-count window for velocity check
  // Each entry: { timestamp: ms, wordCount: number }
  const wordCountWindow = useRef([]);

  // Flag state — tracked locally to avoid re-flagging already-flagged sessions
  const flaggedInjection = useRef(false);
  const flaggedVelocity = useRef(false);

  // ─── Firestore helpers ────────────────────────────────────────────────────

  const writeFlag = useCallback(async (flagData) => {
    if (!studentName || !phaseKey) return;
    try {
      const ref = doc(db, 'sessions', 'minerals', 'students', studentName);
      await setDoc(
        ref,
        { [phaseKey]: { flags: { [fieldKey]: flagData } } },
        { merge: true }
      );
    } catch (e) {
      // Silent — never surface to student
      console.warn('Flag write failed:', e);
    }
  }, [studentName, phaseKey, fieldKey]);

  const flushKeystrokes = useCallback(async () => {
    if (!studentName || !phaseKey || keystrokeBuffer.current.length === 0) return;
    const batch = [...keystrokeBuffer.current];
    keystrokeBuffer.current = [];
    try {
      const ref = doc(db, 'sessions', 'minerals', 'students', studentName);
      await setDoc(
        ref,
        { [phaseKey]: { keystrokes: { [fieldKey]: arrayUnion(...batch) } } },
        { merge: true }
      );
    } catch (e) {
      console.warn('Keystroke flush failed:', e);
    }
  }, [studentName, phaseKey, fieldKey]);

  // Schedule a debounced flush of keystroke timestamps
  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      flushKeystrokes();
    }, KEYSTROKE_FLUSH_MS);
  }, [flushKeystrokes]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushKeystrokes();
    };
  }, [flushKeystrokes]);

  // ─── Velocity check ───────────────────────────────────────────────────────

  const checkVelocity = useCallback((text) => {
    if (flaggedVelocity.current) return; // already flagged this field

    const now = Date.now();
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    wordCountWindow.current.push({ timestamp: now, wordCount });

    // Prune entries older than the window
    wordCountWindow.current = wordCountWindow.current.filter(
      (e) => now - e.timestamp <= VELOCITY_WINDOW_MS
    );

    // Sum words typed within the window
    const windowWords = wordCountWindow.current.reduce(
      (sum, e) => sum + e.wordCount,
      0
    );

    // Compare against the previous window baseline
    // We flag if the total word count *grew* by >50 words in 3 seconds.
    // Simpler approach: flag if current word total is VELOCITY_WORD_LIMIT more
    // than what it was VELOCITY_WINDOW_MS ago.
    const oldest = wordCountWindow.current[0];
    if (oldest && wordCount - oldest.wordCount > VELOCITY_WORD_LIMIT) {
      flaggedVelocity.current = true;
      writeFlag({ velocityFlag: true });
    }
  }, [writeFlag]);

  // ─── Event handlers ───────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e) => {
    // Record that a real trusted keystroke is about to happen
    trustedKeyPending.current = true;

    // Log timestamp (not the key itself)
    const ts = Date.now();
    keystrokeBuffer.current.push(ts);
    scheduleFlush();
  }, [scheduleFlush]);

  const handleChange = useCallback((e) => {
    const newValue = e.target.value;

    // Injection detection: if the value changed without a trusted key event,
    // it was likely set programmatically (script injection, autofill exploit, etc.)
    if (!trustedKeyPending.current && !flaggedInjection.current) {
      flaggedInjection.current = true;
      writeFlag({ injectionFlag: true });
    }
    trustedKeyPending.current = false;

    onChange(newValue);
    checkVelocity(newValue);
  }, [onChange, checkVelocity, writeFlag]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Show brief inline message
    if (pasteMsgTimer.current) clearTimeout(pasteMsgTimer.current);
    setShowPasteMsg(true);
    pasteMsgTimer.current = setTimeout(() => setShowPasteMsg(false), PASTE_MSG_DURATION);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Silently discard — no message needed for drop
  }, []);

  // Prevent context-menu paste on mobile (long-press)
  const handleCut = useCallback((e) => {
    // Allow cutting (it's a keyboard-driven action)
  }, []);

  // Reset trusted flag if user focuses away and back (conservative)
  const handleFocus = useCallback(() => {
    trustedKeyPending.current = false;
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onCut={handleCut}
        onFocus={handleFocus}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="true"
        className={[
          'w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3',
          'text-white placeholder-white/30 text-sm leading-relaxed',
          'focus:outline-none focus:ring-2 focus:ring-amber-500/60 focus:border-amber-500/40',
          'resize-none transition-colors duration-200',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      />
      {showPasteMsg && (
        <p className="absolute bottom-2 right-3 text-xs text-amber-400 animate-pulse pointer-events-none select-none">
          Typing only — no pasting
        </p>
      )}
    </div>
  );
}
