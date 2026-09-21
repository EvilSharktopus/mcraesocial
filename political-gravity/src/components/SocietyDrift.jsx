// src/components/SocietyDrift.jsx
//
// The arrow that answers "which way is society moving?" — see data/drift.js for
// how the direction and level are worked out.
//
// Side is carried by the arrow's DIRECTION and the caption's words, never by hue.
// Red/blue would be actively misleading in an Alberta classroom, where red is the
// Liberal party (centre-left) — the inverse of the American convention students
// meet online. One colour, ramped for intensity only.
import { driftCaption, driftHeadline } from '../data/drift';

// Arrow geometry per level: longer shaft and heavier stroke as the trend firms up.
const SHAFT = { 1: 26, 2: 34, 3: 44, 4: 54 };
const WEIGHT = { 1: 2, 2: 2.5, 3: 3.25, 4: 4 };

function Arrow({ direction, level, height, scale = 1 }) {
  const shaft = SHAFT[level] * scale;
  const w = WEIGHT[level] * scale;
  const head = (6 + level) * scale;
  const width = shaft + head;
  const h = height * scale;
  const midY = h / 2;
  // Drawn pointing right, then mirrored — so both directions are identical shapes.
  return (
    <svg
      width={width}
      height={h}
      viewBox={`0 0 ${width} ${h}`}
      className="pg-drift__arrow"
      style={direction === 'left' ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <line x1="1" y1={midY} x2={shaft} y2={midY}
        stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
      <polyline points={`${shaft - head * 0.7},${midY - head} ${shaft + head},${midY} ${shaft - head * 0.7},${midY + head}`}
        fill="none" stroke="currentColor" strokeWidth={w}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SocietyDrift({ drift, size = 'chip', className = '' }) {
  if (!drift) return null;

  const caption = driftCaption(drift);
  const headline = driftHeadline(drift);
  const label = `${headline}. ${caption}.`;
  const root = `pg-drift pg-drift--l${drift.level} no-print ${className}`;

  // The arrow leads on the side it points to, so "← Society" and "Society →"
  // both read outward rather than doubling back over the word.
  const lead = drift.direction === 'left';

  if (size === 'board') {
    const arrow = <Arrow direction={drift.direction} level={drift.level} height={40} scale={2.4} />;
    return (
      <div className={`${root} pg-drift--board flex flex-col items-center gap-1`} role="img" aria-label={label}>
        <div className="flex items-center gap-4">
          {lead && arrow}
          <span className="font-display font-bold tracking-[0.18em] uppercase pg-drift__word">Society</span>
          {!lead && arrow}
        </div>
        <p className="pg-drift__caption m-0">{caption}</p>
      </div>
    );
  }

  const arrow = <Arrow direction={drift.direction} level={drift.level} height={14} />;
  return (
    <span
      className={`${root} pg-drift--chip inline-flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5`}
      role="img"
      aria-label={label}
      title={label}
    >
      {lead && arrow}
      <span className="font-semibold pg-drift__word">Society</span>
      {!lead && arrow}
    </span>
  );
}
