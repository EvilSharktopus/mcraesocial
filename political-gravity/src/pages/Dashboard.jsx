import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { useAuth } from '../auth/AuthContext';
import { HANDOUT_URL, RUBRIC_URL } from '../data/pendulumReadings';
import { useReadings } from '../hooks/useReadings';
import { isGraded, totalFor } from '../data/rubric';

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

  // Progress is per student: a plot means started, a reflection means done.
  // Anything stored on the reading itself would be shared by the whole class.
  useEffect(() => {
    if (!user) return;
    const readingIds = snap => new Set(snap.docs.map(d => d.data().readingId));
    const sub = (name, setter) => onSnapshot(
      query(collection(db, name), where('uid', '==', user.uid)),
      snap => setter(readingIds(snap)),
      error => {
        console.error(`Error fetching ${name}:`, error);
        setter(new Set());
      },
    );
    const unsubPlots       = sub('plots', setPlotted);
    const unsubReflections = sub('pg_reflections', setReflected);
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

  const isLoading = loading || openLoading || plotted === null || reflected === null || graded === null;
  const hasOpenReadings = Object.keys(groupedReadings).length > 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">
        <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--pg-text)' }}>
          Pendulum of Ideology
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--pg-dim)' }}>
          Social Studies 30 &nbsp;·&nbsp; Yearlong Project
        </p>

        {/* Project Overview Links */}
        <div className="mb-10 rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <div>
            <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>Project Overview</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>Handout and Rubric documents</p>
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
                  const mark    = status === 'graded' ? totalFor(graded[r.id]) : null;
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
    </div>
  );
}
