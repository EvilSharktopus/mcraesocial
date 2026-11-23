// src/components/FinalMap.jsx
//
// The final project's generated map: a plain SVG timeline from the student's
// birth year to 2040, placement on the vertical axis. Deliberately undecorated
// — the creative version is made by hand, outside the app.
//
// Colours are resolved from the theme's CSS variables into literal values
// rather than left as var(--…), so the same markup survives being serialised
// into a PNG, where no stylesheet comes along.
import { useThemeColors } from '../hooks/useThemeColors';
import { END_YEAR, SWING_NUMBERS, kindOf, timeOf, whenLabel } from '../data/finalProject';

// Portrait: time runs down the page, placement runs left to right — the same
// way round as the economic spectrum the class has used all year, with more
// state on the left and less on the right.
const W = 760, H = 1000;
const M = { left: 78, right: 34, top: 112, bottom: 44 };
const PW = W - M.left - M.right, PH = H - M.top - M.bottom;
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

// Print never follows the theme: ink on white, whatever the screen shows.
const PRINT = {
  bg: '#ffffff', surface: '#ffffff', surface2: '#f3f4f6', text: '#111111', muted: '#444444',
  dim: '#666666', border: '#bbbbbb', border2: '#999999', primary: '#111111', 'on-primary': '#ffffff',
};

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// ── Label placement ──
// Each point's two-line label (name, date) goes in whichever of a handful of
// spots around it collides least with the other points, the labels already
// placed, and the line itself. Text is not measured — a per-character
// estimate is close enough to keep labels off each other, and it behaves the
// same on screen and in the exported PNG.
const LABEL_H = 32;
const textW = (str, px) => str.length * px * 0.56;
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
function placeLabels(points, avoid = []) {
  const placed = [...avoid];
  const dots = points.map(p => ({ x0: p.x - 23, x1: p.x + 23, y0: p.y - 23, y1: p.y + 23 }));
  // The line, as beads along each segment, so a box can be tested against it.
  const beads = [];
  points.slice(1).forEach((p, i) => {
    const a = points[i];
    const steps = Math.max(2, Math.round(Math.hypot(p.x - a.x, p.y - a.y) / 10));
    for (let k = 0; k <= steps; k++) {
      const x = a.x + ((p.x - a.x) * k) / steps, y = a.y + ((p.y - a.y) * k) / steps;
      beads.push({ x0: x - 3, x1: x + 3, y0: y - 3, y1: y + 3 });
    }
  });
  return points.map((p) => {
    const w = Math.max(textW(p.name, 13), textW(p.when, 12)) + 6;
    const spots = [
      ['start', p.x + 28, p.y - LABEL_H / 2], ['end', p.x - 28, p.y - LABEL_H / 2],
      ['middle', p.x, p.y - 24 - LABEL_H], ['middle', p.x, p.y + 24],
      ['start', p.x + 16, p.y - 20 - LABEL_H], ['end', p.x - 16, p.y - 20 - LABEL_H],
      ['start', p.x + 16, p.y + 20], ['end', p.x - 16, p.y + 20],
    ];
    let best = null;
    spots.forEach(([anchor, x, top], order) => {
      const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
      const box = { x0, x1: x0 + w, y0: top, y1: top + LABEL_H };
      const off = Math.max(0, M.left + 2 - box.x0) + Math.max(0, box.x1 - (M.left + PW - 2))
                + Math.max(0, M.top + 2 - box.y0) + Math.max(0, box.y1 - (M.top + PH - 2));
      const cost = off * 400
        + [...placed, ...dots].reduce((sum, b) => sum + overlap(box, b), 0) * 4
        + beads.reduce((sum, b) => sum + overlap(box, b), 0) * 3
        + order; // earlier spots win ties
      if (!best || cost < best.cost) best = { cost, anchor, x, top, box };
    });
    placed.push(best.box);
    return best;
  });
}

export default function FinalMap({ birthYear, swings, selected = null, onSelect, title, subtitle, svgRef, print = false }) {
  const themed = useThemeColors();
  const c = print ? PRINT : themed;
  const now = new Date();
  const today = now.getFullYear() + now.getMonth() / 12;
  const t0 = birthYear, t1 = END_YEAR + 1;
  const sy = (t) => M.top + ((t - t0) / (t1 - t0)) * PH;
  const sx = (p) => M.left + ((p + 100) / 200) * PW;

  const points = SWING_NUMBERS
    .map(n => ({ n, s: swings?.[n] }))
    .filter(({ s }) => typeof s?.placement === 'number' && timeOf(s) !== null)
    .map(({ n, s }) => ({
      n, s, x: sx(s.placement), y: sy(Math.min(Math.max(timeOf(s), t0), t1)),
      name: clip(s.name || `Swing ${n}`, 30), when: whenLabel(s, n),
    }));
  const todayOnMap = today > t0 && today < t1;
  const labels = placeLabels(points, todayOnMap
    ? [{ x0: M.left, x1: M.left + PW, y0: sy(today) - 2, y1: sy(today) + 2 }] : []);

  const ticks = [];
  for (let y = Math.ceil((t0 + 1) / 5) * 5; y <= END_YEAR; y += 5) if (y - t0 >= 2) ticks.push(y);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Timeline map${title ? ` for ${title}` : ''}`}
      style={{ width: '100%', height: 'auto', display: 'block', fontFamily: FONT }}
    >
      <rect x="0" y="0" width={W} height={H} fill={c.surface} />
      {title && (
        <text x={M.left} y="30" fontSize="18" fontWeight="700" fill={c.text} fontFamily={FONT}>{clip(title, 60)}</text>
      )}
      {subtitle && (
        <text x={M.left} y="48" fontSize="12" fill={c.muted} fontFamily={FONT}>{clip(subtitle, 90)}</text>
      )}

      {/* Plot frame and the balanced midline */}
      <rect x={M.left} y={M.top} width={PW} height={PH} fill={c.bg} stroke={c.border} />
      <line x1={sx(0)} x2={sx(0)} y1={M.top} y2={M.top + PH} stroke={c.border2} strokeDasharray="2 5" />

      {/* Placement axis, across the top */}
      <text x={M.left} y={M.top - 34} textAnchor="start" fontSize="14" fontWeight="700" fill={c.text} fontFamily={FONT}>◀ More state</text>
      <text x={M.left + PW} y={M.top - 34} textAnchor="end" fontSize="14" fontWeight="700" fill={c.text} fontFamily={FONT}>Less state ▶</text>
      <text x={sx(0)} y={M.top - 34} textAnchor="middle" fontSize="11" fill={c.dim} fontFamily={FONT}>balanced</text>

      {/* Time axis, down the side: five-year ticks, the birth year, and today */}
      {ticks.map(y => (
        <g key={y}>
          <line x1={M.left - 6} x2={M.left + PW} y1={sy(y)} y2={sy(y)} stroke={c.border} strokeWidth="1" />
          <text x={M.left - 12} y={sy(y) + 4} textAnchor="end" fontSize="12" fill={c.muted} fontFamily={FONT}>{y}</text>
        </g>
      ))}
      <g>
        <line x1={M.left - 10} x2={M.left + PW} y1={sy(t0)} y2={sy(t0)} stroke={c.text} strokeWidth="2" />
        <text x={M.left} y={M.top - 10} textAnchor="start" fontSize="12" fontWeight="700" fill={c.text} fontFamily={FONT}>Born {birthYear}</text>
      </g>
      {todayOnMap && (
        <g>
          <line x1={M.left - 10} x2={M.left + PW} y1={sy(today)} y2={sy(today)} stroke={c.primary} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={M.left - 12} y={sy(today) + 4} textAnchor="end" fontSize="12" fontWeight="700" fill={c.primary} fontFamily={FONT}>Today</text>
        </g>
      )}
      <text x={M.left + PW} y={H - 16} textAnchor="end" fontSize="11" fill={c.dim} fontFamily={FONT}>
        solid = lived · dashed = predicted
      </text>

      {/* The line: solid through the lived swings, dashed on into the predictions */}
      {points.slice(1).map((p, i) => {
        const a = points[i];
        return (
          <line key={p.n} x1={a.x} y1={a.y} x2={p.x} y2={p.y}
            stroke={c.text} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={kindOf(p.n) === 'predicted' ? '7 7' : undefined} />
        );
      })}

      {points.map((p, i) => {
        const predicted = kindOf(p.n) === 'predicted';
        const { anchor, x: lx, top } = labels[i];
        const ly = top + 12;
        const isSel = selected === p.n;
        return (
          <g key={p.n}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`Swing ${p.n}: ${p.s.name || 'unnamed'}, ${whenLabel(p.s, p.n)}`}
            onClick={onSelect ? () => onSelect(p.n) : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.n); } } : undefined}
            style={{ cursor: onSelect ? 'pointer' : 'default', outline: 'none' }}
          >
            {isSel && <circle cx={p.x} cy={p.y} r="21" fill="none" stroke={c.primary} strokeWidth="3" />}
            <circle cx={p.x} cy={p.y} r="15"
              fill={predicted ? c.surface : c.primary}
              stroke={c.primary} strokeWidth="2.5"
              strokeDasharray={predicted ? '4 3' : undefined} />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="14" fontWeight="700"
              fill={predicted ? c.primary : c['on-primary']} fontFamily={FONT}>{p.n}</text>
            <text x={lx} y={ly} textAnchor={anchor} fontSize="13" fontWeight="700" fill={c.text} fontFamily={FONT}
              stroke={c.bg} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
              {p.name}
            </text>
            <text x={lx} y={ly + 15} textAnchor={anchor} fontSize="12" fill={c.muted} fontFamily={FONT}
              stroke={c.bg} strokeWidth="4" paintOrder="stroke" strokeLinejoin="round">
              {p.when}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
