// The printable Diploma Vault. Rendered in place of the Study Package while
// the print dialog is open, in one of three shapes the student picks:
//   package  — exactly the on-screen list, in on-screen order
//   term     — one section per tag; a passage with three tags appears three times
//   chrono   — one section per time period, in curriculum order
import { dedupeTags, tagKey } from '../data/tags';
import { PRINT_MODES, buildSections, fmtDate } from '../data/vaultPrint';

export default function VaultPrintView({ mode, flags, readingIndex, studentName, filtered, onBack }) {
  const sections = buildSections(mode, flags, readingIndex);
  const modeLabel = PRINT_MODES.find(m => m.key === mode)?.label ?? '';
  const showReading = mode !== 'chrono';

  return (
    <div className="vault-print">
      <button
        onClick={onBack}
        className="no-print mb-6 text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-80 transition-opacity"
        style={{ backgroundColor: 'var(--pg-surface2)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
      >
        ← Back to the Vault
      </button>

      <header className="vault-print-header" style={{ display: 'block' }}>
        <h1 className="font-display font-bold" style={{ fontSize: '20pt', margin: 0, color: 'var(--pg-text)' }}>
          Diploma Vault{studentName ? ` — ${studentName}` : ''}
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '10pt', color: 'var(--pg-dim)' }}>
          Social Studies 30 · Political Gravity · {modeLabel} · {flags.length} passage{flags.length === 1 ? '' : 's'}
          {filtered ? ' (filtered)' : ''} · printed {fmtDate(new Date())}
        </p>
      </header>

      {sections.map((s, i) => (
        <section key={s.heading ?? i} className="vault-print-section">
          {s.heading && (
            <h2 className="font-display font-bold" style={{ fontSize: '14pt', color: 'var(--pg-text)' }}>
              {s.heading}
              <span style={{ fontWeight: 400, fontSize: '10pt', color: 'var(--pg-dim)', marginLeft: '0.6em' }}>
                {s.count} passage{s.count === 1 ? '' : 's'}
              </span>
            </h2>
          )}
          {s.flags.map(f => (
            <article key={`${s.heading}-${f.id}`} className="vault-flag-card vault-print-passage"
              style={{ border: '1px solid var(--pg-border)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
              <p className="vault-print-meta" style={{ margin: '0 0 0.4rem', fontSize: '9pt', color: 'var(--pg-dim)' }}>
                {showReading && <strong style={{ color: 'var(--pg-text)' }}>{f.readingTitle}</strong>}
                {showReading && dedupeTags(f.tags || []).length > 0 && ' · '}
                {dedupeTags(f.tags || []).map(t => (
                  <span key={tagKey(t)} className="vault-tag" style={{ marginRight: 4 }}>{t}</span>
                ))}
              </p>
              <blockquote className="vault-quote-block" style={{ margin: '0 0 0.5rem', paddingLeft: '0.75rem', borderLeft: '3px solid var(--pg-primary)', fontStyle: 'italic', color: 'var(--pg-muted)' }}>
                “{f.quote}”
              </blockquote>
              {f.commentary && (
                <p className="vault-commentary-block" style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--pg-text)' }}>
                  {f.commentary}
                </p>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
