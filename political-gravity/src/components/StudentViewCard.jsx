// src/components/StudentViewCard.jsx
//
// Lets the teacher run the final project exactly as a student does, to check
// it before a class meets it. It is the real student page under the
// teacher's own account — a practice project, saved in the same collections
// and held to the same security rules — not a mock-up, so what works here
// works for students.
//
// Students belong to a class and get their writing window from it. The
// teacher belongs to none, so the practice project has its own switch.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { COL, SETTINGS_ID, SWING_NUMBERS } from '../data/finalProject';

const btnPrimary = { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' };
const btnGhost   = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };

export default function StudentViewCard() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [settings, setSettings] = useState(null);
  const [note, setNote] = useState(null);   // { ok, text }

  useEffect(() => onSnapshot(doc(db, 'settings', SETTINGS_ID),
    s => setSettings(s.exists() ? s.data() : {}),
    err => { console.error('Could not read final project settings', err); setSettings({}); }), []);

  const open = !!uid && settings?.previewUid === uid;

  async function run(what, fn, done) {
    try { setNote(null); await fn(); if (done) setNote({ ok: true, text: done }); }
    catch (err) {
      console.error(`${what} failed:`, err);
      setNote({ ok: false, text: err.code === 'permission-denied'
        ? `${what} was blocked by Firestore permissions.` : `${what} failed: ${err.message}` });
    }
  }

  const setWindow = (on) => run('Switching your writing window', () =>
    setDoc(doc(db, 'settings', SETTINGS_ID),
      { previewUid: on ? uid : null, openUids: on ? arrayUnion(uid) : arrayRemove(uid) }, { merge: true }));

  const reset = () => {
    if (!confirm('Delete your practice project — setup, all six cards and their signals — so you can start it again from nothing?\n\nNo student work is touched.')) return;
    run('Resetting your practice project', async () => {
      const batch = writeBatch(db);
      batch.delete(doc(db, COL.projects, uid));
      batch.delete(doc(db, COL.reviews, uid));
      for (const n of SWING_NUMBERS) {
        batch.delete(doc(db, COL.swings, `${uid}_${n}`));
        batch.delete(doc(db, COL.signals, `${uid}_${n}`));
        try { localStorage.removeItem(`pg-final-draft:${uid}:${n}`); } catch { /* ignore */ }
      }
      await batch.commit();
    }, 'Practice project cleared.');
  };

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: 'var(--pg-muted)' }}>
        Run the final project exactly as a student does, with a practice project under your own account.
        It appears in the Final Project tab as “You · student view”, so you can also try approving a topic and reading the integrity signals.
        Students never see it.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/teacher/student-view" className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity" style={btnPrimary}>
          Open the final project as a student →
        </Link>
        <button onClick={() => setWindow(!open)} disabled={settings === null}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border disabled:opacity-40"
          style={{
            color: open ? '#22c55e' : 'var(--pg-dim)',
            borderColor: open ? '#22c55e44' : 'var(--pg-border)',
            backgroundColor: open ? '#22c55e11' : 'transparent',
          }}
          title="Students get their writing window from their class. You are in no class, so yours is its own switch.">
          {open ? '● My writing window is open' : '○ My writing window is closed'}
        </button>
        <button onClick={reset} className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-80" style={btnGhost}>
          Reset my practice project
        </button>
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--pg-dim)' }}>
        With your window closed the cards are read-only, as they are for students outside class. Open it to write in them.
      </p>
      {note && <p className="text-xs mt-2" role="status" style={{ color: note.ok ? '#22c55e' : '#ef4444' }}>{note.ok ? '✓' : '⚠'} {note.text}</p>}
    </div>
  );
}
