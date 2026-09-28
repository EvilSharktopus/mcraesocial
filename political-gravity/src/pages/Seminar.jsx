// src/pages/Seminar.jsx
// Live seminar board: every student's position on a shared spectrum, updating
// as they move during discussion. Projection mode strips the page back to just
// the spectrums at a size that reads from the back of a classroom.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import NavBar from '../components/NavBar';
import Spectrum from '../components/Spectrum';
import SocietyDrift from '../components/SocietyDrift';
import { useReadings } from '../hooks/useReadings';
import { useConsensusLive } from '../hooks/useConsensus';
import { hasPosition, positionLabel } from '../data/readings';
import { societyDrift } from '../data/drift';

// Where the class landed is a median, not a mean: one student parked at -100
// drags a mean of twelve by eight points, and the question is where the middle
// of the room sat.
function median(values) {
  if (values.length === 0) return null;
  const xs = [...values].sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

// One dot per student, stacked upward where positions collide. Everything is
// measured from the groove rather than from a percentage of the box, so tall
// stacks cannot drift up over the heading.
function SeminarSpectrum({ students, showNames, big }) {
  const placed = students.filter(s => typeof s.to === 'number');

  const dot     = big ? 22 : 14;
  // A tier has to clear the dot plus the name chip above it, or a chip lands on
  // the dot of the tier above.
  const step    = showNames ? (big ? 54 : 40) : (big ? 34 : 24);
  const nameSz  = big ? 15 : 9;
  const grooveH = big ? 10 : 6;
  const padBot  = big ? 34 : 26;
  const base    = padBot + grooveH / 2;          // the groove's centre line
  // Name chips are far wider than dots, so overlapping students stack. Bucketing
  // by value cannot see across a bucket edge, so place greedily instead: take
  // the lowest tier whose last occupant is far enough to the left.
  const minGap = showNames ? (big ? 7 : 5.5) : 1.8;   // percent of the track
  const lastAtTier = [];
  const stacked = placed
    .slice()
    .sort((a, b) => a.to - b.to)
    .map(s => {
      const pct = (Math.max(-100, Math.min(100, s.to)) + 100) / 2;
      let tier = 0;
      while (lastAtTier[tier] !== undefined && pct - lastAtTier[tier] < minGap) tier++;
      lastAtTier[tier] = pct;
      return { ...s, tier };
    });

  const maxTier = stacked.reduce((m, s) => Math.max(m, s.tier), 0);
  const maxRise = 18 + maxTier * step;
  const padTop  = base + maxRise + dot + (showNames ? 30 : 10);

  return (
    <div className="relative select-none" style={{ paddingTop: `${padTop}px`, paddingBottom: `${padBot}px` }}>
      {stacked.map(s => {
        const pct  = (Math.max(-100, Math.min(100, s.to)) + 100) / 2;
        const rise = 18 + s.tier * step;
        const movedRight = typeof s.from === 'number' && s.to > s.from;
        return (
          <div
            key={s.uid}
            className="absolute flex flex-col items-center"
            style={{ left: `${pct}%`, bottom: `${base + rise}px`, transform: 'translateX(-50%)' }}
          >
            <div
              className="rounded-full border-2 shadow"
              style={{
                width: `${dot}px`, height: `${dot}px`,
                backgroundColor: s.moved ? '#60a5fa' : 'var(--pg-primary)',
                borderColor: 'var(--pg-bg)',
              }}
              title={`${s.name}: ${positionLabel(s.to)}`}
            />
            <div style={{
              width: '1px', height: `${rise - 2}px`,
              backgroundColor: 'var(--pg-border)',
              position: 'absolute', top: `${dot}px`,
            }} />
            {showNames && (
              <div
                className="absolute font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  bottom: 'calc(100% + 4px)',
                  fontSize: `${nameSz}px`,
                  backgroundColor: 'var(--pg-surface2)',
                  color: 'var(--pg-muted)',
                  border: '1px solid var(--pg-border)',
                }}
              >
                {s.name.split(' ')[0]}
              </div>
            )}
            {s.moved && (
              <div
                className="absolute"
                style={{
                  top: `${dot / 2 - (big ? 10 : 7)}px`,
                  [movedRight ? 'right' : 'left']: `${dot + 1}px`,
                  fontSize: `${big ? 17 : 11}px`,
                  color: '#60a5fa',
                }}
                title={`Moved from ${positionLabel(s.from)}`}
              >
                {movedRight ? '→' : '←'}
              </div>
            )}
          </div>
        );
      })}

      {/* Where each mover started, faint, just under the groove */}
      {stacked.filter(s => s.moved).map(s => {
        const pct  = (Math.max(-100, Math.min(100, s.from)) + 100) / 2;
        const size = Math.round(dot * 0.6);
        return (
          <div
            key={`${s.uid}-from`}
            className="absolute rounded-full"
            style={{
              left: `${pct}%`, bottom: `${padBot - size - 3}px`,
              width: `${size}px`, height: `${size}px`,
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--pg-dim)', opacity: 0.4,
            }}
            title={`${s.name} started at ${positionLabel(s.from)}`}
          />
        );
      })}

      <div className="relative rounded-full" style={{ height: `${grooveH}px`, backgroundColor: 'var(--pg-border2)' }}>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: '2px', height: big ? '26px' : '16px', backgroundColor: 'var(--pg-border2)' }}
        />
      </div>
    </div>
  );
}

function AxisEnds({ projecting }) {
  const style = { color: 'var(--pg-muted)', fontSize: projecting ? '1.05rem' : '0.7rem' };
  return (
    <div className="flex justify-between items-center px-1" style={{ marginTop: projecting ? '0.5rem' : '0.25rem' }}>
      <span className="font-bold uppercase tracking-wider" style={style}>Left</span>
      <span className="font-bold uppercase tracking-wider" style={style}>Right</span>
    </div>
  );
}

export default function Seminar() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { readings, loading: readingsLoading } = useReadings();
  const reading = readings.find(r => r.id === id);
  const { consensus, loaded: consensusLoaded } = useConsensusLive();

  const [plots,       setPlots]       = useState([]);
  const [reflections, setReflections] = useState([]);
  const [users,       setUsers]       = useState({});

  // ?project=1 comes from the Project button on the Readings tab, so the board
  // opens ready for the screen instead of needing a click on the projector.
  const [projecting, setProjecting] = useState(params.get('project') === '1');
  const [showNames,  setShowNames]  = useState(false);
  // Which spectrum the board is showing. 'combined' keeps the original
  // behaviour — one dot per student, whichever axis they used.
  const [axis,       setAxis]       = useState('combined');

  const [consensusX, setConsensusX] = useState(0);
  const [saved,      setSaved]      = useState(false);
  const [saveErr,    setSaveErr]    = useState(null);
  // The slider is seeded once per reading and then left alone. Spectrum fires
  // onChange on every mousemove and exposes no drag state, so anything that
  // re-syncs from snapshot data can land in the middle of a teacher's drag.
  const [seededFor,  setSeededFor]  = useState(null);
  const [touchedFor, setTouchedFor] = useState(null);
  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  useEffect(() => {
    if (!id) return;
    const rows = snap => snap.docs.map(d => d.data());
    const fail = (what, setter) => err => { console.error(`Could not load ${what}:`, err); setter([]); };
    const unsubPlots = onSnapshot(
      query(collection(db, 'plots'), where('readingId', '==', id)),
      s => setPlots(rows(s)), fail('positions', setPlots));
    const unsubRefl = onSnapshot(
      query(collection(db, 'pg_reflections'), where('readingId', '==', id)),
      s => setReflections(rows(s)), fail('moves', setReflections));
    const unsubUsers = onSnapshot(collection(db, 'users'),
      s => setUsers(Object.fromEntries(s.docs.map(d => [d.id, d.data()]))),
      err => console.error('Could not load names:', err));
    return () => { unsubPlots(); unsubRefl(); unsubUsers(); };
  }, [id]);

  // Everyone who placed anything, with BOTH axes kept so the board can be
  // filtered without re-reading Firestore. A student who chose "Both" has a
  // value on each; most have one.
  const placed = useMemo(() => {
    const moves = new Map(reflections.filter(r => r.uid).map(r => [r.uid, r]));
    // Where they started and where they ended up on one axis. `to` falls back
    // to `from` when they never moved.
    const onAxis = (start, afterSeminar) => {
      const from = hasPosition(start) ? start : null;
      const to = hasPosition(afterSeminar) ? afterSeminar : from;
      return { from, to };
    };
    return plots.filter(p => p.uid).map(p => {
      const m = moves.get(p.uid);
      return {
        uid: p.uid,
        name: users[p.uid]?.displayName || users[p.uid]?.email || 'Student',
        econ: onAxis(p.positionX, m?.newPositionX),
        pol:  onAxis(p.positionY, m?.newPositionY),
      };
    });
  }, [plots, reflections, users]);

  // Shape one axis into the dots SeminarSpectrum draws, dropping anyone who
  // did not place themselves on it.
  const dotsFor = (list, which) => list
    .map(s => {
      const a = which === 'econ' ? s.econ : s.pol;
      return {
        uid: s.uid,
        name: s.name,
        from: a.from,
        to: a.to,
        moved: a.from !== null && a.to !== null && a.to !== a.from,
      };
    })
    .filter(s => s.to !== null);

  // Students who placed themselves on both spectrums — the ones whose
  // political read is invisible on the combined board.
  const bothStudents = useMemo(
    () => placed.filter(s => s.econ.to !== null && s.pol.to !== null),
    [placed]);

  const econDots = useMemo(() => dotsFor(placed, 'econ'), [placed]);
  const polDots  = useMemo(() => dotsFor(placed, 'pol'),  [placed]);
  const anyoneCount = useMemo(
    () => placed.filter(s => s.econ.to !== null || s.pol.to !== null).length,
    [placed]);

  // The original combined view: whichever axis they actually used.
  const combinedDots = useMemo(() => placed
    .map(s => {
      const a = s.econ.to !== null ? s.econ : s.pol;
      return {
        uid: s.uid, name: s.name, from: a.from, to: a.to,
        moved: a.from !== null && a.to !== null && a.to !== a.from,
      };
    })
    .filter(s => s.to !== null), [placed]);

  // What the single board is currently drawing ('both' draws two, below).
  const students = axis === 'economic' ? econDots
    : axis === 'political' ? polDots
    : combinedDots;
  const movedCount = students.filter(s => s.moved).length;

  const axisCaption =
    axis === 'economic'  ? `${econDots.length} of ${anyoneCount} placed on the economic spectrum`
    : axis === 'political' ? `${polDots.length} of ${anyoneCount} placed on the political spectrum`
    : axis === 'both'      ? `${bothStudents.length} of ${anyoneCount} placed on both spectrums`
    : `${combinedDots.length} ${combinedDots.length === 1 ? 'position' : 'positions'}`;

  // Everyone who has actually placed themselves, by the same rule the rest of
  // the app uses, so this and the "N positions" count can never disagree.
  const liveCentre = useMemo(
    () => median((axis === 'both' ? econDots : students).map(s => s.to).filter(hasPosition)),
    [students, econDots, axis]);

  const savedX = consensus?.[id]?.x;
  const isRecorded = hasPosition(savedX);

  // Seed the slider once per reading: what was recorded for this period if
  // anything, otherwise where the room currently sits. Adjusting state during
  // render rather than in an effect, so the slider never paints at 0 first and
  // nothing re-syncs underneath a drag in progress.
  // Both flags are keyed by reading id, so moving to another period starts the
  // whole dance over without anything to reset.
  if (id && consensusLoaded && seededFor !== id && touchedFor !== id) {
    const seed = isRecorded ? savedX : liveCentre;
    if (Number.isFinite(seed)) {
      setSeededFor(id);
      setConsensusX(seed);
    }
  }

  const setConsensusFromDrag = (v) => { setTouchedFor(id); setConsensusX(v); };

  // The trend heading into tonight's discussion — and through it once this
  // period has been recorded, so the arrow visibly answers the Save.
  const drift = useMemo(
    () => (readingsLoading || !consensusLoaded
      ? null
      : societyDrift(consensus, readings, { untilId: id, inclusive: isRecorded })),
    [consensus, readings, id, isRecorded, readingsLoading, consensusLoaded]);

  async function saveConsensus() {
    if (!hasPosition(consensusX)) return;
    try {
      setSaveErr(null);
      await setDoc(doc(db, 'settings', 'consensus'),
        { [id]: { x: consensusX } }, { merge: true });
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save consensus', err);
      setSaveErr(err.code === 'permission-denied'
        ? 'Blocked by Firestore permissions — only the teacher can save a consensus.'
        : err.message);
    }
  }

  const title = reading?.title ?? id;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      {!projecting && (
        <NavBar
          backTo="/teacher"
          backLabel="Teacher"
          extra={
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse"
              style={{ backgroundColor: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44' }}
            >
              ● LIVE
            </span>
          }
        />
      )}

      <main className={`flex-1 w-full mx-auto flex flex-col ${projecting ? 'max-w-none px-10 py-8 gap-8 justify-center' : 'max-w-4xl px-5 py-8 gap-8'}`}>

        {/* ── Header + controls ── */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1
              className="font-display font-bold"
              style={{ color: 'var(--pg-text)', fontSize: projecting ? '2.5rem' : '1.5rem' }}
            >
              {title}
            </h1>
            <p style={{ color: 'var(--pg-dim)', fontSize: projecting ? '1.125rem' : '0.75rem' }}>
              {axisCaption}
              {axis !== 'both' && movedCount > 0 && ` · ${movedCount} moved during the seminar`}
            </p>
          </div>

          {drift && <SocietyDrift drift={drift} size={projecting ? 'board' : 'chip'} />}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {[['combined', 'Combined'], ['economic', 'Economic'], ['political', 'Political'], ['both', 'Both']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setAxis(key)}
                  aria-pressed={axis === key}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={axis === key
                    ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
                    : { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                  title={key === 'combined'
                    ? 'One dot per student, whichever spectrum they used'
                    : key === 'both'
                      ? 'Only the students who placed themselves on both spectrums'
                      : `Only the students who placed themselves on the ${key} spectrum`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNames(v => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={showNames
                ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
                : { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
              title="Names are hidden by default so the board shows the spread, not who thinks what"
            >
              {showNames ? 'Names on' : 'Names off'}
            </button>
            <button
              onClick={() => setProjecting(v => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
            >
              {projecting ? 'Exit projection' : 'Projection mode'}
            </button>
          </div>
        </div>

        {/* ── The board ── */}
        <div
          className="rounded-2xl"
          style={{
            backgroundColor: 'var(--pg-surface)',
            border: '1px solid var(--pg-border)',
            padding: projecting ? '2rem' : '1.5rem',
          }}
        >
          {axis === 'both' ? (
            bothStudents.length === 0 ? (
              <p className="text-center py-10" style={{ color: 'var(--pg-dim)' }}>
                Nobody placed themselves on both spectrums for this reading.
              </p>
            ) : (
              <>
                {/* Two boards for the same people, so a student who read the
                    period as economically right but politically left is
                    visible as exactly that. */}
                {[['econ', 'Economic spectrum'], ['pol', 'Political spectrum']].map(([which, heading], i) => (
                  <div key={which} style={{ marginTop: i === 0 ? 0 : (projecting ? '2rem' : '1.25rem') }}>
                    <h2 className="text-center font-bold uppercase tracking-wide"
                      style={{ color: 'var(--pg-text)', fontSize: projecting ? '1.05rem' : '0.7rem' }}>
                      {heading}
                    </h2>
                    <SeminarSpectrum students={dotsFor(bothStudents, which)} showNames={showNames} big={projecting} />
                    <AxisEnds projecting={projecting} />
                  </div>
                ))}
              </>
            )
          ) : students.length === 0 ? (
            <p className="text-center py-10" style={{ color: 'var(--pg-dim)' }}>
              {axis === 'combined'
                ? 'Nobody has placed themselves on this reading yet. Positions appear here as they arrive.'
                : `Nobody placed themselves on the ${axis} spectrum for this reading.`}
            </p>
          ) : (
            <>
              <SeminarSpectrum students={students} showNames={showNames} big={projecting} />
              <AxisEnds projecting={projecting} />

              {movedCount > 0 && (
                <p className="text-center mt-4" style={{ color: 'var(--pg-dim)', fontSize: projecting ? '0.95rem' : '0.7rem' }}>
                  <span style={{ color: '#60a5fa' }}>●</span> moved during the seminar · faint dot marks where they started
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Class consensus — a teacher control, not for the projector ── */}
        {!projecting && (
          <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
            <div className="flex items-center justify-between mb-4 gap-4">
              <div>
                <h2 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--pg-text)' }}>Class Consensus</h2>
                <p className="text-xs" style={{ color: 'var(--pg-dim)' }}>
                  {isRecorded
                    ? `Recorded: ${positionLabel(savedX)}. Drag and save again to change it.`
                    : liveCentre !== null
                      ? 'Not recorded yet — prefilled with the class median. Drag to adjust, then save.'
                      : 'Not recorded yet. Drag to record where the class landed.'}
                  {' '}This sets the starting point for the next reading, and feeds the Society arrow.
                </p>
                {isRecorded && consensusX !== savedX && (
                  <p className="text-[11px] mt-1" style={{ color: 'var(--pg-primary)' }}>
                    Unsaved change — recorded value is still {positionLabel(savedX)}.
                  </p>
                )}
              </div>
              <button
                onClick={saveConsensus}
                disabled={!hasPosition(consensusX)}
                title={hasPosition(consensusX) ? undefined : 'The middle is not a position — drag the marker off centre'}
                className="font-semibold px-6 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 shrink-0 disabled:opacity-40"
                style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
              >
                {saved ? '✓ Saved' : isRecorded ? 'Update Consensus' : 'Save Consensus'}
              </button>
            </div>

            {saveErr && (
              <p className="text-xs mb-3" style={{ color: '#ef4444' }}>⚠ {saveErr}</p>
            )}

            <Spectrum value={consensusX} onChange={setConsensusFromDrag} leftLabel={null} rightLabel={null} sublabels={[]} showValue />

            <div className="flex justify-between items-center mt-1 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Left</span>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--pg-muted)' }}>Right</span>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
