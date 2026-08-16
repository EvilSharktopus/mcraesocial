// src/components/Spectrum.jsx
//
// Draggable horizontal political spectrum.
// value:       -100 (far left) … 0 (center) … +100 (far right)
// onChange:    (newValue: number) => void
// leftLabel / rightLabel: labels at the ends
// sublabels:   optional array of tick label objects { value, label }
// disabled:    boolean
// showValue:   show numeric readout (default true)

import { useRef, useState, useCallback } from 'react';
import { positionLabel } from '../data/pendulumReadings';

const SNAP_THRESHOLD = 6; // snap to center if within this many units

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export default function Spectrum({
  value = 0,
  onChange,
  leftLabel  = 'Left',
  rightLabel = 'Right',
  sublabels  = [],
  disabled   = false,
  showValue  = true,
  secondaryDot = null, // { value, label } — faint "original" dot
  classDots  = [],     // [{ value, label }] — everyone else's positions
}) {
  const trackRef   = useRef(null);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'dragging' | 'settling'
  const [atEnd, setAtEnd] = useState(false);  // triggers end-bump animation

  // Convert -100..100 → 0..100 percentage
  const pct = (clamp(value, -100, 100) + 100) / 2;
  const secondaryPct = secondaryDot != null
    ? (clamp(secondaryDot.value, -100, 100) + 100) / 2
    : null;

  const getValueFromPointer = useCallback((clientX) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const x = clamp(clientX - rect.left, 0, rect.width);
    let raw = Math.round((x / rect.width) * 200 - 100);
    // Snap to center
    if (Math.abs(raw) <= SNAP_THRESHOLD) raw = 0;
    return clamp(raw, -100, 100);
  }, []);

  const startDrag = useCallback((clientX) => {
    if (disabled) return;
    setPhase('dragging');

    const newVal = getValueFromPointer(clientX);
    onChange?.(newVal);

    const onMove = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const v = getValueFromPointer(cx);
      onChange?.(v);
      if (v === 100 || v === -100) {
        setAtEnd(true);
        setTimeout(() => setAtEnd(false), 300);
      }
    };

    const onEnd = () => {
      setPhase('settling');
      // After spring settles, return to idle
      setTimeout(() => setPhase('idle'), 700);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend',  onEnd);
  }, [disabled, getValueFromPointer, onChange]);

  // Fill from center to marker
  const fillLeft  = Math.min(50, pct);
  const fillWidth = Math.abs(pct - 50);

  // Readable label — the same band names the teacher sees when marking
  const readout = positionLabel(value) ?? 'Center';

  return (
    <div className="select-none w-full">
      {/* End labels */}
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-xs font-medium text-pg-muted">{leftLabel}</span>
          <span className="text-xs text-pg-dim">◆</span>
          <span className="text-xs font-medium text-pg-muted">{rightLabel}</span>
        </div>
      )}

      {/* Track hit area — tall for easy grab */}
      <div
        ref={trackRef}
        className="relative py-6"
        style={{ cursor: disabled ? 'default' : phase === 'dragging' ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX); }}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      >
        {/* Groove */}
        <div
          className="absolute left-0 right-0 rounded-full"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            height: '6px',
            backgroundColor: 'var(--pg-border2)',
          }}
        >
          {/* Primary fill */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left:  `${fillLeft}%`,
              width: `${fillWidth}%`,
              height: '100%',
              backgroundColor: 'var(--pg-primary)',
              opacity: 0.65,
              borderRadius: '9999px',
              transition: phase === 'dragging' ? 'none' : 'left 0.35s ease, width 0.35s ease',
            }}
          />
        </div>

        {/* Center tick */}
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translateX(-50%) translateY(-50%)',
            width: '2px',
            height: '14px',
            backgroundColor: 'var(--pg-border2)',
          }}
        />

        {/* Sublabel ticks */}
        {sublabels.map((s) => {
          const sp = (s.value + 100) / 2;
          return (
            <div key={s.value} className="absolute" style={{ left: `${sp}%`, top: '50%' }}>
              <div
                className="rounded-full"
                style={{
                  width: '1px',
                  height: '8px',
                  backgroundColor: 'var(--pg-faint)',
                  transform: 'translateX(-50%) translateY(-50%)',
                }}
              />
            </div>
          );
        })}

        {/* The rest of the class */}
        {classDots.map((d, i) => (
          <div
            key={`${d.value}-${i}`}
            className="absolute rounded-full"
            style={{
              left:   `${(clamp(d.value, -100, 100) + 100) / 2}%`,
              top:    '50%',
              width:  '10px',
              height: '10px',
              transform: 'translateX(-50%) translateY(-50%)',
              backgroundColor: 'var(--pg-muted)',
              opacity: 0.55,
            }}
            title={d.label ?? 'Classmate'}
          />
        ))}

        {/* Secondary (original) dot */}
        {secondaryPct != null && (
          <div
            className="absolute rounded-full border"
            style={{
              left:   `${secondaryPct}%`,
              top:    '50%',
              width:  '14px',
              height: '14px',
              transform: 'translateX(-50%) translateY(-50%)',
              backgroundColor: 'var(--pg-dim)',
              borderColor: 'var(--pg-bg)',
              opacity: 0.4,
            }}
            title={secondaryDot?.label ?? 'Original position'}
          />
        )}

        {/* Draggable marker */}
        <div
          className={[
            'spectrum-marker',
            phase === 'dragging' ? 'spectrum-marker--dragging' : '',
            phase === 'settling' ? 'spectrum-marker--settling' : '',
            phase === 'idle'     ? 'spectrum-marker--idle'     : '',
            atEnd               ? 'animate-end-bump'          : '',
          ].join(' ')}
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Sublabel text */}
      {sublabels.length > 0 && (
        <div className="relative h-5">
          {sublabels.map((s) => {
            const sp = (s.value + 100) / 2;
            return (
              <span
                key={s.value}
                className="absolute text-[10px] text-pg-faint -translate-x-1/2"
                style={{ left: `${sp}%` }}
              >
                {s.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Value readout */}
      {showValue && (
        <div className="text-center mt-3">
          <span
            className="inline-block text-xs font-medium px-3 py-1 rounded-full border"
            style={{
              backgroundColor: 'var(--pg-surface)',
              borderColor: 'var(--pg-border)',
              color: value === 0 ? 'var(--pg-dim)' : 'var(--pg-primary)',
              fontFamily: 'Inter, sans-serif',
              transition: 'color 0.2s ease',
            }}
          >
            {readout}
          </span>
        </div>
      )}
    </div>
  );
}
