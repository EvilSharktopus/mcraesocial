// src/components/FinalEntryView.jsx
// One swing entry, read-only: beside the map, in presentation mode, in the
// print view and on the teacher's side.
import { FIELDS, kindOf, stateLabel, whenLabel, swingWords } from '../data/finalProject';

const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s).trim());

export default function FinalEntryView({ n, swing, large = false }) {
  const kind = kindOf(n);
  const s = swing || {};
  const body = large ? 'text-base' : 'text-sm';
  return (
    <article className="final-entry">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--pg-primary)' }}>
        Swing {n} · {kind === 'lived' ? 'Lived' : 'Predicted'} · {whenLabel(s, n) || 'no date yet'}
      </p>
      <h3 className={`font-display font-bold ${large ? 'text-2xl' : 'text-lg'} mt-0.5`} style={{ color: 'var(--pg-text)' }}>
        {s.name || <span style={{ color: 'var(--pg-dim)' }}>Unnamed</span>}
      </h3>
      <p className="text-xs mt-1" style={{ color: 'var(--pg-muted)' }}>
        {s.ideology || 'No ideology chosen'} · {typeof s.placement === 'number' ? stateLabel(s.placement) : 'Not placed'}
        {' '}· {swingWords(s, n)} words
      </p>
      {FIELDS[kind].map(f => (
        <div key={f.key} className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--pg-dim)' }}>{f.label}</p>
          {String(s[f.key] ?? '').trim()
            ? (f.source && isUrl(s[f.key])
                ? <a href={s[f.key].trim()} target="_blank" rel="noopener noreferrer" className={`${body} break-all underline`} style={{ color: 'var(--pg-primary)' }}>{s[f.key].trim()}</a>
                : <p className={`${body} whitespace-pre-wrap break-words`} style={{ color: 'var(--pg-text)', lineHeight: 1.6 }}>{s[f.key]}</p>)
            : <p className={`${body} italic`} style={{ color: 'var(--pg-dim)' }}>Not written yet</p>}
        </div>
      ))}
    </article>
  );
}
