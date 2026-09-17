// src/pages/StudyPackage.jsx
import { useState, useEffect } from 'react';
import { collection, deleteDoc, doc, query, where, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import NavBar from '../components/NavBar';
import TagPicker from '../components/TagPicker';
import { useReadings } from '../hooks/useReadings';
import { positionLabel } from '../data/readings';
import { dedupeTags, knownTags, tagCounts, tagKey } from '../data/tags';

const isNum = (v) => typeof v === 'number';
const average = (values) => values.length
  ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
  : null;

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
  const [reflections, setReflections] = useState([]);
  const [flags, setFlags] = useState([]);
  const [activeTags, setActiveTags] = useState([]);   // empty = show everything
  const [loading, setLoading] = useState(true);

  // Fetch student plots, reflections and flags
  useEffect(() => {
    if (!user) return;
    const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fail = what => err => console.error(`Could not load ${what}:`, err);

    const qPlots = query(collection(db, 'plots'), where('uid', '==', user.uid));
    const unsubPlots = onSnapshot(qPlots, snap => setPlots(rows(snap)), fail('positions'));

    const qRefl = query(collection(db, 'pg_reflections'), where('uid', '==', user.uid));
    const unsubRefl = onSnapshot(qRefl, snap => setReflections(rows(snap)), fail('reflections'));

    const qFlags = query(collection(db, 'diplomaFlags'), where('uid', '==', user.uid));
    const unsubFlags = onSnapshot(qFlags, snap => {
      setFlags(rows(snap));
      setLoading(false);
    }, err => { fail('vault')(err); setLoading(false); });

    return () => { unsubPlots(); unsubRefl(); unsubFlags(); };
  }, [user]);

  // Editing a flag in place: which one, and its working copy.
  const [editingId,  setEditingId]  = useState(null);
  const [editTags,   setEditTags]   = useState([]);
  const [editText,   setEditText]   = useState('');
  const [editBusy,   setEditBusy]   = useState(false);
  const [editErr,    setEditErr]    = useState(null);

  // Every tag the student has actually used, most-used first, with counts.
  // Spellings that differ only by case or spacing are one tag here.
  const tagList = tagCounts(flags);            // [[key, { label, count }], …]
  const suggestions = knownTags(flags);

  // A flag matches if it carries any of the selected tags. activeTags holds keys.
  const visibleFlags = (activeTags.length
    ? flags.filter(f => (f.tags || []).some(t => activeTags.includes(tagKey(t))))
    : flags
  ).slice().sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const toggleTag = (tag) => {
    const k = tagKey(tag);
    setActiveTags(prev => prev.includes(k) ? prev.filter(t => t !== k) : [...prev, k]);
  };

  function startEdit(flag) {
    setEditingId(flag.id);
    setEditTags(flag.tags || []);
    setEditText(flag.commentary || '');
    setEditErr(null);
  }
  function cancelEdit() { setEditingId(null); setEditErr(null); }

  async function saveEdit(flag) {
    setEditBusy(true);
    setEditErr(null);
    try {
      await setDoc(doc(db, 'diplomaFlags', flag.id),
        { commentary: editText.trim(), tags: dedupeTags(editTags), updatedAt: serverTimestamp() },
        { merge: true });
      setEditingId(null);
    } catch (err) {
      console.error('Could not update flag:', err);
      setEditErr(err.code === 'permission-denied'
        ? 'Firestore refused the change (permissions). Nothing was lost.'
        : 'Could not reach the server. Nothing was lost — try again.');
    } finally {
      setEditBusy(false);
    }
  }

  async function removeFlag(flag) {
    if (!confirm('Remove this passage from your Vault? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'diplomaFlags', flag.id));
      if (editingId === flag.id) setEditingId(null);
    } catch (err) {
      console.error('Could not delete flag:', err);
      alert(err.code === 'permission-denied'
        ? 'Firestore refused the delete (permissions).'
        : 'Could not reach the server — try again.');
    }
  }

  // Combine plots with reading metadata. A student may have placed themselves
  // on one spectrum or both, so an entry counts if either axis was set.
  const entries = readings.filter(r => !r.archived).map(r => {
    const plot = plots.find(p => p.readingId === r.id);
    const refl = reflections.find(f => f.readingId === r.id);
    return {
      id: r.id,
      title: r.title,
      positionX: isNum(plot?.positionX) ? plot.positionX : null,
      positionY: isNum(plot?.positionY) ? plot.positionY : null,
      justification: plot?.justification || null,
      reflection: refl?.reflection || null,
      reflectionDraft: refl?.draft === true,
      movedToX: isNum(refl?.newPositionX) && refl.newPositionX !== plot?.positionX ? refl.newPositionX : null,
      movedToY: isNum(refl?.newPositionY) && refl.newPositionY !== plot?.positionY ? refl.newPositionY : null,
      updatedAt: plot?.updatedAt || null,
    };
  }).filter(e => e.positionX !== null || e.positionY !== null);

  // Averages over the readings that actually used each spectrum
  const avgX = average(entries.map(e => e.positionX).filter(isNum));
  const avgY = average(entries.map(e => e.positionY).filter(isNum));
  const totalReadings = readings.filter(r => !r.archived).length;

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
                  ['Total Readings', totalReadings],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                    <p className="font-display font-bold text-lg" style={{ color: 'var(--pg-primary)' }}>{val}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--pg-dim)' }}>{label}</p>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-8">
                {[
                  ['Avg Economic',  avgX, '#3b82f6'],
                  ['Avg Political', avgY, '#8b5cf6'],
                ].map(([label, avg, color]) => (
                  <div key={label}>
                    <p className="text-xs mb-2 text-center font-semibold" style={{ color: 'var(--pg-muted)' }}>{label}</p>
                    {avg === null ? (
                      <p className="text-[11px] text-center py-1" style={{ color: 'var(--pg-faint)' }}>Not used yet</p>
                    ) : (
                      <>
                        <MiniSpectrum value={avg} color={color} />
                        <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--pg-faint)' }}>
                          <span>Collectivism</span><span>Individualism</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
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
                    {e.positionX !== null && (
                      <div>
                        <MiniSpectrum value={e.positionX} color="#3b82f6" />
                        <div className="flex justify-between text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--pg-faint)' }}>
                          <span>Col.</span><span>Econ · {positionLabel(e.positionX)}</span><span>Ind.</span>
                        </div>
                      </div>
                    )}
                    {e.positionY !== null && (
                      <div>
                        <MiniSpectrum value={e.positionY} color="#8b5cf6" />
                        <div className="flex justify-between text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'var(--pg-faint)' }}>
                          <span>Col.</span><span>Pol. · {positionLabel(e.positionY)}</span><span>Ind.</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {e.justification ? (
                    <div className="p-3 rounded-xl mt-4" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--pg-muted)' }}>Your Justification</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--pg-text)', whiteSpace: 'pre-wrap' }}>
                        "{e.justification}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic mt-4" style={{ color: 'var(--pg-faint)' }}>
                      No justification written.
                    </p>
                  )}

                  {e.reflection && (
                    <div className="p-3 rounded-xl mt-3" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--pg-muted)' }}>
                        After the seminar{e.reflectionDraft ? ' · draft' : ''}
                      </p>
                      {(e.movedToX !== null || e.movedToY !== null) && (
                        <p className="text-[11px] mb-1" style={{ color: 'var(--pg-dim)' }}>
                          Moved to {[
                            e.movedToX !== null && `${positionLabel(e.movedToX)} (economic)`,
                            e.movedToY !== null && `${positionLabel(e.movedToY)} (political)`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--pg-text)', whiteSpace: 'pre-wrap' }}>
                        "{e.reflection}"
                      </p>
                    </div>
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
                  {tagList.map(([key, { label, count }]) => {
                    const on = activeTags.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleTag(label)}
                        aria-pressed={on}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                        style={on
                          ? { backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }
                          : { backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}
                      >
                        {label} <span style={{ opacity: 0.7 }}>{count}</span>
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

            {visibleFlags.map((flag) => {
              const isEditing = editingId === flag.id;
              return (
              <div key={flag.id} className="vault-flag-card rounded-2xl p-5" style={{ backgroundColor: 'var(--pg-surface)', border: `1px solid ${isEditing ? 'var(--pg-primary)' : 'var(--pg-border)'}` }}>
                <div className="mb-4 flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md" style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-primary)' }}>
                    📚 {flag.readingTitle}
                  </span>
                  {!isEditing && dedupeTags(flag.tags || []).map(tag => (
                    <button
                      key={tagKey(tag)}
                      onClick={() => toggleTag(tag)}
                      title={activeTags.includes(tagKey(tag)) ? `Stop filtering by ${tag}` : `Show only ${tag}`}
                      className="vault-tag text-[10px] font-semibold px-2 py-1 rounded-md transition-opacity hover:opacity-80"
                      style={activeTags.includes(tagKey(tag))
                        ? { border: '1px solid var(--pg-primary)', color: 'var(--pg-primary)' }
                        : { border: '1px solid var(--pg-border)', color: 'var(--pg-muted)' }}>
                      {tag}
                    </button>
                  ))}
                  {!isEditing && (
                    <span className="no-print ml-auto flex gap-3">
                      <button onClick={() => startEdit(flag)} className="text-[11px] font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--pg-muted)' }}>Edit</button>
                      <button onClick={() => removeFlag(flag)} className="text-[11px] font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--pg-error)' }}>Remove</button>
                    </span>
                  )}
                </div>

                <div className="vault-quote-block mb-4 pl-4 border-l-2" style={{ borderColor: 'var(--pg-primary)' }}>
                  <p className="text-sm italic leading-relaxed" style={{ color: 'var(--pg-muted)' }}>
                    "{flag.quote}"
                  </p>
                </div>

                {isEditing ? (
                  <div className="no-print">
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--pg-muted)' }}>Tags</p>
                    <TagPicker value={editTags} onChange={setEditTags} suggestions={suggestions} />
                    <p className="text-[10px] font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--pg-muted)' }}>Your Commentary</p>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="w-full resize-none rounded-xl p-3 text-sm focus:outline-none min-h-[90px]"
                      style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
                    />
                    {editErr && <p className="text-xs mt-2" role="alert" style={{ color: '#ef4444' }}>⚠ {editErr}</p>}
                    <div className="flex justify-end gap-3 mt-3">
                      <button onClick={cancelEdit} disabled={editBusy} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: 'var(--pg-text)' }}>Cancel</button>
                      <button
                        onClick={() => saveEdit(flag)}
                        disabled={editBusy || (!editText.trim() && editTags.length === 0)}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
                      >
                        {editBusy ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="vault-commentary-block p-4 rounded-xl" style={{ backgroundColor: 'var(--pg-surface2)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--pg-muted)' }}>Your Commentary</p>
                    <p className="text-sm" style={{ color: 'var(--pg-text)', whiteSpace: 'pre-wrap' }}>
                      {flag.commentary || <span style={{ color: 'var(--pg-faint)' }}>No commentary yet — Edit to add one.</span>}
                    </p>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
