// src/pages/StudyPackage.jsx
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import NavBar from '../components/NavBar';
import { useReadings } from '../hooks/useReadings';

function MiniSpectrum({ value, color = 'var(--pg-primary)' }) {
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
          backgroundColor: color,
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
          backgroundColor: color,
          borderColor: 'var(--pg-surface)',
        }}
      />
    </div>
  );
}

export default function StudyPackage() {
  const { user } = useAuth();
  const { readings } = useReadings();
  const [activeTab, setActiveTab] = useState('positions'); // 'positions' or 'vault'
  const [plots, setPlots] = useState([]);
  const [flags, setFlags] = useState([]);
  const [activeTags, setActiveTags] = useState([]);   // empty = show everything
  const [loading, setLoading] = useState(true);

  // Fetch student plots and flags
  useEffect(() => {
    if (!user) return;
    
    const qPlots = query(collection(db, 'plots'), where('uid', '==', user.uid));
    const unsubPlots = onSnapshot(qPlots, snap => {
      setPlots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qFlags = query(collection(db, 'diplomaFlags'), where('uid', '==', user.uid));
    const unsubFlags = onSnapshot(qFlags, snap => {
      setFlags(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubPlots(); unsubFlags(); };
  }, [user]);

  // Every tag the student has actually used, most-used first, with counts.
  const tagCounts = flags.reduce((acc, f) => {
    (f.tags || []).forEach(t => { acc[t] = (acc[t] || 0) + 1; });
    return acc;
  }, {});
  const tagList = Object.entries(tagCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // A flag matches if it carries any of the selected tags.
  const visibleFlags = (activeTags.length
    ? flags.filter(f => (f.tags || []).some(t => activeTags.includes(t)))
    : flags
  ).slice().sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const toggleTag = (tag) =>
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  // Combine plots with reading metadata
  const entries = readings.map(r => {
    const plot = plots.find(p => p.readingId === r.id);
    return {
      id: r.id,
      title: r.title,
      positionX: plot?.positionX ?? null,
      positionY: plot?.positionY ?? null,
      reflection: plot?.justification || null,
      updatedAt: plot?.updatedAt || null,
    };
  }).filter(e => e.positionX !== null); // Only show completed ones

  // Averages
  const avgX = entries.length ? Math.round(entries.reduce((s, e) => s + e.positionX, 0) / entries.length) : 0;
  const avgY = entries.length ? Math.round(entries.reduce((s, e) => s + e.positionY, 0) / entries.length) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--pg-bg)' }}>
      <NavBar backTo="/dashboard" backLabel="Readings" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-10">
        <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--pg-text)' }}>
          Study Package
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--pg-dim)' }}>
          Your year-long map of political positions and diploma prep
        </p>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-8 gap-4">
          <div className="flex gap-2 p-1 rounded-xl w-fit no-print" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
            <button
              onClick={() => setActiveTab('positions')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                backgroundColor: activeTab === 'positions' ? 'var(--pg-surface2)' : 'transparent',
                color: activeTab === 'positions' ? 'var(--pg-text)' : 'var(--pg-muted)'
              }}
            >
              My Positions
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              style={{
                backgroundColor: activeTab === 'vault' ? 'var(--pg-surface2)' : 'transparent',
                color: activeTab === 'vault' ? 'var(--pg-text)' : 'var(--pg-muted)'
              }}
            >
              Diploma Vault
              <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}>
                {flags.length}
              </span>
            </button>
          </div>

          {activeTab === 'vault' && flags.length > 0 && (
            <button
              onClick={() => window.print()}
              className="no-print flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
            >
              🖨️ Print Handout
            </button>
          )}
        </div>

        {loading ? (
           <div className="flex justify-center py-10">
             <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--pg-border)', borderTopColor: 'var(--pg-primary)' }} />
           </div>
        ) : activeTab === 'positions' ? (
          <>
            {/* Year summary card */}
            <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--pg-text)' }}>Year overview</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  ['Completed Readings', entries.length],
                  ['Total Readings', readings.length],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                    <p className="font-display font-bold text-lg" style={{ color: 'var(--pg-primary)' }}>{val}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>{label}</p>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs mb-2 text-center font-semibold" style={{ color: 'var(--pg-muted)' }}>Avg Economic</p>
                  <MiniSpectrum value={avgX} color="#3b82f6" />
                  <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--pg-faint)' }}>
                    <span>Collectivism</span><span>Individualism</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs mb-2 text-center font-semibold" style={{ color: 'var(--pg-muted)' }}>Avg Political</p>
                  <MiniSpectrum value={avgY} color="#8b5cf6" />
                  <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--pg-faint)' }}>
                    <span>Collectivism</span><span>Individualism</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Entry list */}
            <div className="space-y-4">
              {entries.length === 0 && (
                <p className="text-sm text-center py-10" style={{ color: 'var(--pg-dim)' }}>
                  You haven't completed any readings yet.
                </p>
              )}
              {entries.map((e) => (
                <div key={e.id} className="rounded-2xl p-5" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--pg-text)' }}>{e.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--pg-faint)' }}>
                        {e.updatedAt ? new Date(e.updatedAt.toDate()).toLocaleDateString() : 'Completed'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <MiniSpectrum value={e.positionX} color="#3b82f6" />
                      <div className="flex justify-between text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--pg-faint)' }}>
                        <span>Col.</span><span>Econ</span><span>Ind.</span>
                      </div>
                    </div>
                    <div>
                      <MiniSpectrum value={e.positionY} color="#8b5cf6" />
                      <div className="flex justify-between text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--pg-faint)' }}>
                        <span>Col.</span><span>Pol.</span><span>Ind.</span>
                      </div>
                    </div>
                  </div>

                  {e.reflection ? (
                    <div className="p-3 rounded-xl mt-4" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--pg-muted)' }}>Your Justification</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--pg-text)' }}>
                        "{e.reflection}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic mt-4" style={{ color: 'var(--pg-faint)' }}>
                      No reflection provided.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* Hidden header that only shows when printing */}
            <div className="vault-print-header" style={{ display: 'none' }}>
              <h2 style={{ margin: 0, fontSize: '16pt', fontWeight: 'bold' }}>Diploma Exam Study Guide</h2>
              <p style={{ margin: '4px 0 0', fontSize: '10pt', color: '#555' }}>Social Studies 30 — Diploma Vault</p>
            </div>

            {flags.length === 0 && (
              <div className="text-center py-12 rounded-2xl" style={{ border: '1px dashed var(--pg-border)' }}>
                <span className="text-3xl mb-3 block">🔖</span>
                <p className="text-sm font-semibold" style={{ color: 'var(--pg-text)' }}>Your Vault is empty</p>
                <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--pg-dim)' }}>
                  Highlight text inside any reading and click "Flag for Diploma" to save case studies here.
                </p>
              </div>
            )}

            {tagList.length > 0 && (
              <div className="no-print rounded-2xl p-4" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-semibold" style={{ color: 'var(--pg-text)' }}>
                    Filter by tag
                    {activeTags.length > 0 && (
                      <span className="font-normal" style={{ color: 'var(--pg-dim)' }}>
                        {'  ·  '}{visibleFlags.length} of {flags.length} shown
                      </span>
                    )}
                  </p>
                  {activeTags.length > 0 && (
                    <button
                      onClick={() => setActiveTags([])}
                      className="text-xs font-semibold hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--pg-primary)' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagList.map(([tag, count]) => {
                    const on = activeTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                        style={on
                          ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
                          : { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                      >
                        {tag} <span style={{ opacity: 0.7 }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {flags.length > 0 && visibleFlags.length === 0 && (
              <div className="text-center py-10 rounded-2xl" style={{ border: '1px dashed var(--pg-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--pg-text)' }}>Nothing tagged that way yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--pg-dim)' }}>
                  Clear the filter to see all {flags.length} of your flagged passages.
                </p>
              </div>
            )}

            {visibleFlags.map((flag) => (
              <div key={flag.id} className="vault-flag-card rounded-2xl p-5" style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}>
                <div className="mb-4 flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-primary)' }}>
                    📚 {flag.readingTitle}
                  </span>
                  {flag.tags?.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      title={activeTags.includes(tag) ? `Stop filtering by ${tag}` : `Show only ${tag}`}
                      className="vault-tag text-[10px] font-semibold px-2 py-1 rounded-md transition-opacity hover:opacity-80"
                      style={activeTags.includes(tag)
                        ? { border: '1px solid var(--pg-primary)', color: 'var(--pg-primary)' }
                        : { border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}>
                      {tag}
                    </button>
                  ))}
                </div>
                
                <div className="vault-quote-block mb-4 pl-4 border-l-2" style={{ borderColor: 'var(--pg-primary)' }}>
                  <p className="text-sm italic leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                    "{flag.quote}"
                  </p>
                </div>

                <div className="vault-commentary-block p-4 rounded-xl" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--pg-muted)' }}>Your Commentary</p>
                  <p className="text-sm" style={{ color: 'var(--pg-text)' }}>
                    {flag.commentary}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
