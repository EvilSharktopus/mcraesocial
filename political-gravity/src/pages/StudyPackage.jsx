// src/pages/StudyPackage.jsx
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';

const PLACEHOLDER_ENTRIES = [
  { id: 'r1', title: 'The Origins of Democracy',      position: -30, reflection: 'I came in expecting to land more to the right, but the reading convinced me that collective decision-making has a deeper history than I thought.', date: 'May 8' },
  { id: 'r2', title: 'Economic Systems Compared',     position:   5, reflection: 'The seminar moved me closer to center. Hearing peers defend state intervention made me reconsider some of my assumptions about markets.', date: 'May 15' },
  { id: 'r3', title: 'Nationalism & Its Discontents', position:  40, reflection: null, date: 'May 22' },
];

function MiniSpectrum({ value }) {
  const pct = (value + 100) / 2;
  const fillLeft  = Math.min(50, pct);
  const fillWidth = Math.abs(pct - 50);

  return (
    <div className="relative" style={{ height: '20px' }}>
      {/* Groove */}
      <div className="absolute inset-0 rounded-full" style={{ top: '50%', height: '4px', transform: 'translateY(-50%)', backgroundColor: 'var(--pg-border2)' }}>
        <div style={{
          position: 'absolute',
          left: `${fillLeft}%`,
          width: `${fillWidth}%`,
          height: '100%',
          backgroundColor: 'var(--pg-primary)',
          opacity: 0.5,
          borderRadius: '9999px',
        }} />
      </div>
      {/* Dot */}
      <div className="absolute rounded-full border-2"
        style={{
          left: `${pct}%`,
          top: '50%',
          width: '12px',
          height: '12px',
          transform: 'translateX(-50%) translateY(-50%)',
          backgroundColor: 'var(--pg-primary)',
          borderColor: 'var(--pg-surface)',
        }}
      />
    </div>
  );
}

export default function StudyPackage() {
  const submitted = PLACEHOLDER_ENTRIES.filter(e => e.reflection !== null);
  const avg = Math.round(submitted.reduce((s, e) => s + e.position, 0) / (submitted.length || 1));

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">
        <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--pg-text)' }}>
          Study Package
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--pg-dim)' }}>
          Your year-long map of political positions and reflections — Social Studies 30
        </p>

        {/* Year summary card */}
        <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
          <h2 className="font-semibold mb-4" style={{ color: 'var(--pg-text)' }}>Year overview</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              ['Readings', PLACEHOLDER_ENTRIES.length],
              ['Completed', submitted.length],
              ['Average position', avg > 0 ? `+${avg}` : `${avg}`],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                <p className="font-display font-bold text-lg" style={{ color: 'var(--pg-primary)' }}>{val}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>{label}</p>
              </div>
            ))}
          </div>
          {/* Year-end average mini spectrum */}
          <p className="text-xs mb-2" style={{ color: 'var(--pg-muted)' }}>Average position across all readings:</p>
          <MiniSpectrum value={avg} />
          <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--pg-faint)' }}>
            <span>Collective</span>
            <span>Individual</span>
          </div>
        </div>

        {/* Entry list */}
        <div className="space-y-4">
          {PLACEHOLDER_ENTRIES.map((e) => (
            <div key={e.id} className="rounded-2xl p-5" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>{e.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--pg-faint)' }}>{e.date}</p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: 'var(--pg-surface2)',
                    color: e.position === 0 ? 'var(--pg-dim)' : 'var(--pg-primary)',
                  }}
                >
                  {e.position === 0 ? 'Center' : e.position > 0 ? `+${e.position}` : `${e.position}`}
                </span>
              </div>

              <MiniSpectrum value={e.position} />
              <div className="flex justify-between text-[10px] mt-1 mb-3" style={{ color: 'var(--pg-faint)' }}>
                <span>Collective</span><span>Individual</span>
              </div>

              {e.reflection ? (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                  "{e.reflection}"
                </p>
              ) : (
                <p className="text-xs italic" style={{ color: 'var(--pg-faint)' }}>
                  Reflection pending — complete your seminar first.
                </p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
