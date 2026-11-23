import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { useAuth } from '../auth/AuthContext';
import { HANDOUT_URL, RUBRIC_URL } from '../data/readings';
import { FINAL_HANDOUT_URL } from '../data/finalProject';
import { useReadings } from '../hooks/useReadings';
import { isGraded, overallOf, readingMark, partlyMarked, bandName, scoreOf } from '../data/rubric';

const STATUS_CONFIG = {
  'graded':      { label: 'Graded',       dot: '#60a5fa' },
  'submitted':   { label: 'Submitted',    dot: '#34d399' },
  'in-progress': { label: 'In Progress',  dot: '#fbbf24' },
  'not-started': { label: 'Not Started',  dot: 'var(--pg-border2)' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [openReadings, setOpenReadings] = useState([]);
  const [openLoading, setOpenLoading]   = useState(true);
  // Reading ids this student has plotted / reflected on. null = not loaded yet.
  const [plotted,   setPlotted]   = useState(null);
  const [reflected, setReflected] = useState(null);
  // readingId -> the teacher's rubric marks for this student
  const [graded,    setGraded]    = useState(null);
  const { readings, loading } = useReadings();
  const [showGrades, setShowGrades] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      setOpenReadings(docSnap.exists() ? (docSnap.data().openReadings || []) : []);
      setOpenLoading(false);
    }, (error) => {
      console.error('Error fetching open readings:', error);
      setOpenLoading(false);
    });
    return () => unsub();
  }, []);

  // Progress is per student: a plot means started, a submitted reflection
  // means done. Autosaved reflection drafts (draft: true) are still "in
  // progress" — the student has not handed them in yet.
  useEffect(() => {
    if (!user) return;
    const readingIds = (snap, keep = () => true) =>
      new Set(snap.docs.filter(d => keep(d.data())).map(d => d.data().readingId));
    const sub = (name, setter, keep) => onSnapshot(
      query(collection(db, name), where('uid', '==', user.uid)),
      snap => setter(readingIds(snap, keep)),
      error => {
        console.error(`Error fetching ${name}:`, error);
        setter(new Set());
      },
    );
    const unsubPlots       = sub('plots', setPlotted);
    const unsubReflections = sub('pg_reflections', setReflected, d => d.draft !== true);
    // Marks stream in live, so a grade appears without the student reloading.
    const unsubGrades = onSnapshot(
      query(collection(db, 'pg_grades'), where('uid', '==', user.uid)),
      snap => setGraded(Object.fromEntries(
        snap.docs.map(d => [d.data().readingId, d.data()]))),
      error => {
        console.error('Error fetching grades:', error);
        setGraded({});
      },
    );
    return () => { unsubPlots(); unsubReflections(); unsubGrades(); };
  }, [user]);

  function statusFor(readingId) {
    if (isGraded(graded?.[readingId]))  return 'graded';
    if (reflected?.has(readingId))      return 'submitted';
    if (plotted?.has(readingId))        return 'in-progress';
    return 'not-started';
  }

  // Filter only open readings, then group by century
  const groupedReadings = readings
    .filter(r => !r.archived && openReadings.includes(r.id))
    .reduce((acc, reading) => {
      const century = reading.century || 'Other';
      if (!acc[century]) acc[century] = [];
      acc[century].push(reading);
      return acc;
    }, {});

  // The student's standing: every marked piece on the reading list, whether
  // or not that time period is still open. Same sum as the teacher's table.
  const listed  = readings.filter(r => !r.archived);
  const marked  = graded ? listed.filter(r => isGraded(graded[r.id])) : [];
  const overall = overallOf(marked.map(r => graded[r.id]));

  const isLoading = loading || openLoading || plotted === null || reflected === null || graded === null;
  const hasOpenReadings = Object.keys(groupedReadings).length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--pg-text)' }}>
              Political Gravity
            </h1>
            <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>
              Social Studies 30 &nbsp;·&nbsp; Yearlong Project
            </p>
          </div>
          {/* The final project launches from here, with its handout beneath. */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            <Link
              to="/final-project"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
            >
              Final Project →
            </Link>
            <a href={FINAL_HANDOUT_URL} target="_blank" rel="noreferrer"
              className="text-xs underline hover:opacity-80 transition-opacity"
              style={{ color: 'var(--pg-muted)' }}>
              Open Handout
            </a>
          </div>
        </div>

        {/* Overall grade — opens the breakdown by time period */}
        {graded !== null && (
          <button
            onClick={() => setShowGrades(true)}
            disabled={overall.overall === null}
            className="w-full text-left mb-4 rounded-2xl p-5 flex items-center justify-between gap-4 transition-opacity hover:opacity-90 disabled:hover:opacity-100"
            style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)', cursor: overall.overall === null ? 'default' : 'pointer' }}
          >
            <div>
              <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>Overall grade</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>
                {overall.overall === null
                  ? 'Nothing has been marked yet'
                  : `Across ${overall.pieces} marked piece${overall.pieces === 1 ? '' : 's'} in ${overall.readings} time period${overall.readings === 1 ? '' : 's'} · tap for the breakdown`}
              </p>
            </div>
            {overall.overall !== null && (
              <div className="font-display font-bold text-3xl leading-none shrink-0" style={{ color: 'var(--pg-text)' }}>
                {overall.overall}%
              </div>
            )}
          </button>
        )}

        {/* Project Overview Links */}
        <div className="mb-10 rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <div>
            <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>Project Overview</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>How the project works, and how it&rsquo;s marked</p>
          </div>
          <div className="flex gap-2">
            <a href={HANDOUT_URL} target="_blank" rel="noreferrer"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-text)', border: '1px solid var(--pg-border)' }}>
              Handout
            </a>
            <a href={RUBRIC_URL} target="_blank" rel="noreferrer"
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}>
              Rubric
            </a>
          </div>
        </div>

        {/* Grouped Readings */}
        {isLoading ? (
          <p className="text-sm" style={{ color: 'var(--pg-dim)' }}>Loading readings…</p>
        ) : !hasOpenReadings ? (
          <div className="rounded-2xl p-6 text-center"
            style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
            <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>No readings are open right now</p>
            <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
              Your teacher hasn’t opened any time periods yet. Check back later.
            </p>
          </div>
        ) : (
        <div className="space-y-8">
          {Object.entries(groupedReadings).map(([century, readings]) => (
            <section key={century}>
              <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--pg-text)' }}>
                {century}
              </h2>
              <div className="space-y-3">
                {readings.map((r) => {
                  const status  = statusFor(r.id);
                  const cfg     = STATUS_CONFIG[status];
                  const canOpen = status !== 'submitted' && status !== 'graded';
                  const mark    = status === 'graded' ? readingMark(graded[r.id]) : null;
                  const partly  = status === 'graded' && partlyMarked(graded[r.id]);
                  return (
                    <div
                      key={r.id}
                      className="rounded-2xl p-5 flex items-center justify-between gap-4 transition-colors"
                      style={{
                        backgroundColor: 'var(--pg-surface)',
                        border: '1px solid var(--pg-border)',
                      }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--pg-text)' }}>{r.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                          <span className="text-xs" style={{ color: 'var(--pg-muted)' }}>{cfg.label}</span>
                        </div>
                      </div>
                      {mark !== null && (
                        <div className="ml-auto mr-1 text-right shrink-0">
                          <div className="font-display font-bold text-2xl leading-none" style={{ color: 'var(--pg-text)' }}>
                            {mark}%
                          </div>
                          {partly && <div className="text-[10px] mt-1" style={{ color: 'var(--pg-dim)' }}>so far</div>}
                        </div>
                      )}
                      <Link
                        to={`/reading/${r.id}`}
                        className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                        style={{
                          backgroundColor: canOpen ? 'var(--pg-primary)' : 'var(--pg-surface2)',
                          color: canOpen ? 'var(--pg-on-primary)' : 'var(--pg-dim)',
                        }}
                      >
                        {status === 'graded' || status === 'submitted'
                          ? 'Review'
                          : status === 'in-progress' ? 'Continue' : 'Open'}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        )}

        {/* Study package link */}
        <div className="mt-10 rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <div>
            <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>Study Package</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>Your full-year map of positions and reflections</p>
          </div>
          <Link
            to="/study-package"
            className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-muted)', border: '1px solid var(--pg-border)' }}
          >
            View →
          </Link>
        </div>
      </main>

      {/* Grade breakdown */}
      {showGrades && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={() => setShowGrades(false)}>
          <div role="dialog" aria-modal="true" aria-label="Your grades"
            className="flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)', width: 'min(94vw, 640px)', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--pg-border)' }}>
              <div>
                <h2 className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>Your grades</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--pg-muted)' }}>
                  Overall <strong style={{ color: 'var(--pg-text)' }}>{overall.overall}%</strong>
                  {overall.justification !== null && <> · justifications {overall.justification}%</>}
                  {overall.reflection !== null && <> · reflections {overall.reflection}%</>}
                </p>
              </div>
              <button onClick={() => setShowGrades(false)} className="shrink-0 text-lg leading-none px-2 py-1 rounded-lg hover:opacity-70"
                style={{ color: 'var(--pg-muted)' }} aria-label="Close">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {marked.map(r => {
                const g = graded[r.id];
                const piece = (label, code) => (
                  <div className="flex justify-between gap-3 text-sm">
                    <span style={{ color: 'var(--pg-muted)' }}>{label}</span>
                    {code
                      ? <span style={{ color: 'var(--pg-text)' }}>{bandName(code)} · {scoreOf(code)}%</span>
                      : <span style={{ color: 'var(--pg-dim)' }}>Not marked yet</span>}
                  </div>
                );
                return (
                  <div key={r.id} className="py-3" style={{ borderBottom: '1px solid var(--pg-border)' }}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="font-semibold" style={{ color: 'var(--pg-text)' }}>{r.title}</span>
                      <span className="font-display font-bold text-lg" style={{ color: 'var(--pg-text)' }}>
                        {readingMark(g)}%{partlyMarked(g) && <span className="text-[11px] font-normal ml-1" style={{ color: 'var(--pg-dim)' }}>so far</span>}
                      </span>
                    </div>
                    {piece('Justification', g.justification)}
                    {piece('Reflection', g.reflection)}
                  </div>
                );
              })}
            </div>
            <p className="px-6 py-3 text-[11px]" style={{ color: 'var(--pg-dim)', borderTop: '1px solid var(--pg-border)' }}>
              Your overall grade is the average of every piece marked so far. Each justification and each reflection counts once;
              anything not marked yet is left out until it is.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
