// src/components/FinalEntryView.jsx
// One card, read-only: beside the map, in presentation mode, in the print
// view and on the teacher's side. The answers appear under their question
// labels, in the order the student answered them.
import { kindOf, stateLabel, whenLabel, swingWords } from '../data/finalProject';

const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s).trim());

export default function FinalEntryView({ n, swing, questions, large = false }) {
  const kind = kindOf(n);
  const s = swing || {};
  const body = large ? 'text-base' : 'text-sm';
  const extra = large ? 'text-sm' : 'text-xs';
  const none = <p className={`${body} italic`} style={{ color: 'var(--pg-dim)' }}>Not answered yet</p>;
  return (
    <article className="final-entry">
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--pg-primary)' }}>
        Swing {n} · {kind === 'lived' ? 'Lived' : 'Predicted'} · {whenLabel(s, n) || 'no year yet'}
      </p>
      <h3 className={`font-display font-bold ${large ? 'text-2xl' : 'text-lg'} mt-0.5`} style={{ color: 'var(--pg-text)' }}>
        {s.name || <span style={{ color: 'var(--pg-dim)' }}>Unnamed</span>}
      </h3>
      <p className="text-xs mt-1" style={{ color: 'var(--pg-muted)' }}>{swingWords(s, questions)} words</p>
      {questions.map(q => (
        <div key={q.id} className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--pg-dim)' }}>{q.label}</p>
          {String(s[q.id] ?? '').trim()
            ? <p className={`${body} whitespace-pre-wrap break-words`} style={{ color: 'var(--pg-text)', lineHeight: 1.6 }}>{s[q.id]}</p>
            : none}
          {q.source && String(s.source ?? '').trim() && (
            <p className={`${extra} mt-1 break-all`} style={{ color: 'var(--pg-muted)' }}>
              Source: {isUrl(s.source)
                ? <a href={s.source.trim()} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--pg-primary)' }}>{s.source.trim()}</a>
                : s.source}
            </p>
          )}
          {q.ideology && (
            <p className={`${extra} mt-1 font-semibold`} style={{ color: 'var(--pg-primary)' }}>Ideology: {s.ideology || 'not chosen'}</p>
          )}
          {q.placement && (
            <p className={`${extra} mt-1 font-semibold`} style={{ color: 'var(--pg-primary)' }}>
              Placed at: {typeof s.placement === 'number' ? stateLabel(s.placement) : 'not placed'}
            </p>
          )}
        </div>
      ))}
    </article>
  );
}
