// src/components/AccountMerge.jsx
//
// Moves one account's work onto another. It exists for the students who had
// an email account before the switch to codes: their earlier positions,
// reflections, marks and vault flags sit under the old account's id, their
// newer work under the code account's, and nothing joins the two.
//
// A reading is moved as a unit. If the destination account already has
// anything for a reading — a position, a reflection or a mark — everything
// the old account has for that reading is left where it is, so a mark can
// never end up attached to work it was not given for. Those readings are
// listed for the teacher to settle by hand.
//
// Before anything moves, the work involved is downloaded as a file.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useRoster, nameFor } from '../hooks/useRoster';
import { useReadings } from '../hooks/useReadings';
import { dateStamp, downloadJson } from '../utils/download';

// Keyed {uid}_{readingId}: the id changes with the owner, so these are
// re-created under the new id and the old document removed, in one batch.
const KEYED = [
  { name: 'plots',          label: 'positions and justifications' },
  { name: 'pg_reflections', label: 'reflections' },
  { name: 'pg_grades',      label: 'marks' },
];
// Random ids: only the owner field changes.
const FLAGS = 'diplomaFlags';

const inputStyle = { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' };
const btnPrimary = { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' };
const inputClass = 'rounded-lg px-3 py-1.5 text-sm focus:outline-none w-full';

const rowsOf = (snap) => snap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() }));
const ownedBy = (name, uid) => getDocs(query(collection(db, name), where('uid', '==', uid))).then(rowsOf);

export default function AccountMerge() {
  const roster = useRoster();
  const { readings } = useReadings();
  const [strays, setStrays] = useState(null);   // [{ uid, label, count }] — work with no roster row
  const [users,  setUsers]  = useState({});
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');
  const [plan,   setPlan]   = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [note,   setNote]   = useState(null);   // { ok, text }
  const [scan,   setScan]   = useState(0);

  const titleOf = (id) => readings.find(r => r.id === id)?.title ?? id;
  const fail = (what, err) => setNote({ ok: false, text: err.code === 'permission-denied'
    ? `${what} was blocked by Firestore permissions — the rules need the account-merge lines added.`
    : `${what} failed: ${err.message}` });

  // Accounts that hold work but are not on the roster: the likely sources.
  useEffect(() => {
    let cancelled = false;
    Promise.all([...KEYED.map(c => c.name), FLAGS, 'users'].map(n => getDocs(collection(db, n)))).then(snaps => {
      if (cancelled) return;
      const userDocs = Object.fromEntries(snaps.at(-1).docs.map(d => [d.id, d.data()]));
      const counts = {};
      snaps.slice(0, -1).forEach(s => s.docs.forEach(d => { const u = d.data().uid; if (u) counts[u] = (counts[u] || 0) + 1; }));
      setUsers(userDocs);
      setStrays(Object.entries(counts).map(([uid, count]) => ({ uid, count })));
    }).catch(err => { console.error('Account scan failed', err); if (!cancelled) setStrays([]); });
    return () => { cancelled = true; };
  }, [scan]);

  const offRoster = useMemo(() => (strays || [])
    .filter(s => !roster[s.uid] && users[s.uid]?.role !== 'teacher')
    .map(s => ({ ...s, label: users[s.uid]?.email || users[s.uid]?.displayName || 'no profile' }))
    .sort((a, b) => b.count - a.count), [strays, roster, users]);
  const rosterList = useMemo(() => Object.keys(roster)
    .map(uid => ({ uid, name: nameFor(roster, uid, uid) }))
    .sort((a, b) => a.name.localeCompare(b.name)), [roster]);

  const fromUid = from.trim();
  const ready = fromUid && to && fromUid !== to;

  // `after` is the outcome of a merge just made: the plan is rebuilt to show
  // what is left, and that message has to survive the rebuild.
  async function preview(after = null) {
    setBusy(true); setNote(after); setPlan(null);
    try {
      const [src, dst, flags] = await Promise.all([
        Promise.all(KEYED.map(c => ownedBy(c.name, fromUid))),
        Promise.all(KEYED.map(c => ownedBy(c.name, to))),
        ownedBy(FLAGS, fromUid),
      ]);
      // Readings the destination already has something for stay put, whole.
      const taken = new Set(dst.flat().map(r => r.data.readingId).filter(Boolean));
      const groups = KEYED.map((c, i) => {
        const usable = src[i].filter(r => r.data.readingId);
        return {
          ...c,
          move: usable.filter(r => !taken.has(r.data.readingId)),
          kept: usable.filter(r => taken.has(r.data.readingId)),
          odd:  src[i].filter(r => !r.data.readingId),
        };
      });
      const clash = [...new Set(groups.flatMap(g => g.kept.map(r => r.data.readingId)))];
      setPlan({ from: fromUid, to, groups, flags, clash, backup: { src, dst, flags } });
    } catch (err) { console.error('Preview failed', err); fail('Looking up the two accounts', err); }
    finally { setBusy(false); }
  }

  async function merge() {
    const total = plan.groups.reduce((n, g) => n + g.move.length, 0) + plan.flags.length;
    if (!confirm(
      `Move ${total} item${total === 1 ? '' : 's'} from the old account to ${nameFor(roster, plan.to, plan.to)}?\n\n` +
      'A file of everything involved downloads first. The old account keeps nothing that is moved.')) return;
    setBusy(true); setNote(null);
    try {
      const plain = (rows) => rows.map(r => ({ id: r.id, ...r.data }));
      downloadJson(`political-gravity-merge-${plan.from.slice(0, 6)}-${dateStamp()}.json`, {
        mergedAt: new Date().toISOString(), from: plan.from, to: plan.to,
        fromAccount: Object.fromEntries(KEYED.map((c, i) => [c.name, plain(plan.backup.src[i])])),
        toAccountBefore: Object.fromEntries(KEYED.map((c, i) => [c.name, plain(plan.backup.dst[i])])),
        [FLAGS]: plain(plan.flags),
      });

      // Each move is a create and a delete in the same batch, so a document
      // can never be lost between the two or left behind in both places.
      const ops = [
        ...plan.groups.flatMap(g => g.move.map(r => (batch) => {
          batch.set(doc(db, g.name, `${plan.to}_${r.data.readingId}`), { ...r.data, uid: plan.to, movedFrom: plan.from });
          batch.delete(r.ref);
        })),
        ...plan.flags.map(r => (batch) => batch.update(r.ref, { uid: plan.to, movedFrom: plan.from })),
      ];
      for (let i = 0; i < ops.length; i += 200) {
        const batch = writeBatch(db);
        ops.slice(i, i + 200).forEach(op => op(batch));
        await batch.commit();
      }
      setScan(n => n + 1);
      await preview({ ok: true, text: `Moved ${total} item${total === 1 ? '' : 's'}.` +
        (plan.clash.length ? ` ${plan.clash.length} reading${plan.clash.length === 1 ? ' was' : 's were'} left on the old account — see below.` : '') });
    } catch (err) { console.error('Merge failed', err); fail('The merge', err); setBusy(false); }
  }

  const nothing = plan && plan.groups.every(g => !g.move.length) && !plan.flags.length;

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: 'var(--pg-dim)' }}>
        For a student whose earlier work sits under an old email account. Moves that account's positions, reflections,
        marks and vault flags onto their code account, so one student is one row again.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs mb-1" style={{ color: 'var(--pg-dim)' }}>From — the old account</span>
          <select value={offRoster.some(s => s.uid === fromUid) ? fromUid : ''} onChange={e => { setFrom(e.target.value); setPlan(null); }}
            className={inputClass} style={inputStyle}>
            <option value="">{strays === null ? 'Looking for accounts…' : `Accounts with work but no roster row (${offRoster.length})`}</option>
            {offRoster.map(s => <option key={s.uid} value={s.uid}>{s.label} · {s.count} items · {s.uid.slice(0, 8)}…</option>)}
          </select>
          <input type="text" value={from} onChange={e => { setFrom(e.target.value); setPlan(null); }} placeholder="…or paste the account id"
            className={`${inputClass} mt-1.5 font-mono`} style={inputStyle} spellCheck={false} />
        </label>
        <label className="block">
          <span className="block text-xs mb-1" style={{ color: 'var(--pg-dim)' }}>To — the student's code account</span>
          <select value={to} onChange={e => { setTo(e.target.value); setPlan(null); }} className={inputClass} style={inputStyle}>
            <option value="">Choose a student…</option>
            {rosterList.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap mt-3">
        <button onClick={() => preview()} disabled={!ready || busy}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80 disabled:opacity-35" style={inputStyle}>
          {busy && !plan ? '⏳ Checking…' : 'Check what would move'}
        </button>
        {note && <span className="text-xs" role="status" style={{ color: note.ok ? '#22c55e' : '#ef4444' }}>{note.text}</span>}
      </div>

      {plan && (
        <div className="mt-4 rounded-xl p-4 text-sm" style={inputStyle}>
          <p className="font-semibold mb-2" style={{ color: 'var(--pg-text)' }}>
            {users[plan.from]?.email || plan.from} → {nameFor(roster, plan.to, plan.to)}
          </p>
          <ul className="flex flex-col gap-1" style={{ color: 'var(--pg-muted)' }}>
            {plan.groups.map(g => (
              <li key={g.name}>
                <strong style={{ color: 'var(--pg-text)' }}>{g.move.length}</strong> {g.label} to move
                {g.kept.length > 0 && <span style={{ color: '#f59e0b' }}> · {g.kept.length} staying</span>}
                {g.odd.length > 0 && <span style={{ color: '#f59e0b' }}> · {g.odd.length} with no reading on them, left alone</span>}
              </li>
            ))}
            <li><strong style={{ color: 'var(--pg-text)' }}>{plan.flags.length}</strong> vault flags to move</li>
          </ul>
          {plan.clash.length > 0 && (
            <p className="text-xs mt-3" style={{ color: '#f59e0b' }}>
              Staying on the old account, because the code account already has work or a mark for the same reading:{' '}
              {plan.clash.map(titleOf).join(', ')}. Nothing is overwritten. Settle those by hand in Grading.
            </p>
          )}
          {nothing
            ? <p className="text-xs mt-3" style={{ color: 'var(--pg-dim)' }}>Nothing to move.</p>
            : (
              <button onClick={merge} disabled={busy} className="mt-3 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-35" style={btnPrimary}>
                {busy ? '⏳ Moving…' : 'Download a copy, then move'}
              </button>
            )}
        </div>
      )}
    </div>
  );
}
