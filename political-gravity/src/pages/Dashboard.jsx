import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { HANDOUT_URL, RUBRIC_URL } from '../data/pendulumReadings';
import { useReadings } from '../hooks/useReadings';

const STATUS_CONFIG = {
  'submitted':   { label: 'Submitted',    dot: '#34d399' },
  'in-progress': { label: 'In Progress',  dot: '#fbbf24' },
  'not-started': { label: 'Not Started',  dot: 'var(--pg-border2)' },
};

export default function Dashboard() {
  const [openReadings, setOpenReadings] = useState([]);
  const [openLoading, setOpenLoading]   = useState(true);
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

  // Filter only open readings, then group by century
  const groupedReadings = readings
    .filter(r => openReadings.includes(r.id))
    .reduce((acc, reading) => {
      const century = reading.century || 'Other';
      if (!acc[century]) acc[century] = [];
      acc[century].push(reading);
      return acc;
    }, {});

  const isLoading = loading || openLoading;
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
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG['not-started'];
                  const canOpen = r.status !== 'submitted';
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
                      <Link
                        to={`/reading/${r.id}`}
                        className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                        style={{
                          backgroundColor: canOpen ? 'var(--pg-primary)' : 'var(--pg-surface2)',
                          color: canOpen ? 'var(--pg-on-primary)' : 'var(--pg-dim)',
                        }}
                      >
                        {r.status === 'submitted' ? 'Review' : r.status === 'in-progress' ? 'Continue' : 'Open'}
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
