// src/data/drift.js
//
// "Where has society been?" — derived from the Class Consensus the teacher records
// after each seminar (settings/consensus → { [readingId]: { x } }).
//
// This is a record, not a forecast: it reports which SIDE the class put each period
// on, so a single period recorded at +40 already reads as "previously, on the right".
// Runs of periods on the same side, and periods far from centre, both raise the
// intensity of the arrow.
//
// Pure — no React, no Firestore — so the rules below can be tested directly.
//
// Curriculum order is the ARRAY order of settings/masterReadings, which the teacher
// can edit. Never sort by id: ids like '1945-1970' and '1955-1970' overlap, so
// sorting them would silently rewrite history.

import { positionLabel } from './readings';

// Magnitude steps are the POSITION_BANDS boundaries, so the glow and the words can
// never disagree: at 34 the caption starts saying "Moderate", at 67 "Extreme".
export const MODERATE = 34;
export const EXTREME  = 67;

const clamp = (v) => Math.max(-100, Math.min(100, v));

// A consensus counts as recorded only once it is off centre — the same rule the
// rest of the app applies to a student's marker (hasPosition in ./readings).
// Written out here rather than reusing hasPosition because that helper accepts NaN,
// which would poison the mean of a hand-edited document.
export const recorded = (x) => Number.isFinite(x) && x !== 0;

export const sideOf = (x) => (recorded(x) ? Math.sign(x) : 0);

/**
 * @param consensus  { [readingId]: { x } } — settings/consensus, or null
 * @param readings   the reading list in curriculum order (archived still included)
 * @param untilId    the reading being looked at
 * @param inclusive  count untilId itself (the teacher has just recorded it)
 * @returns null when there is nothing to show, else the drift
 */
export function societyDrift(consensus, readings, { untilId, inclusive = false } = {}) {
  if (!consensus || !Array.isArray(readings)) return null;

  const active = readings.filter(r => r && !r.archived);
  const idx = active.findIndex(r => r.id === untilId);
  // An unknown id — an archived period opened by URL, or a list still loading —
  // has no place in the sequence, so there is no honest answer to give.
  if (idx === -1) return null;

  const history = active
    .slice(0, inclusive ? idx + 1 : idx)
    .map(r => ({ id: r.id, title: r.title, x: clamp(consensus?.[r.id]?.x) }))
    // A period the teacher never recorded is a gap, not a change of direction:
    // drop it and let the run either side of it join up.
    .filter(e => recorded(consensus?.[e.id]?.x));

  if (history.length === 0) return null;

  const side = sideOf(history[history.length - 1].x);
  const run = [];
  let prior = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (sideOf(history[i].x) !== side) { prior = history[i]; break; }
    run.unshift(history[i]);
  }

  const mean = run.reduce((sum, e) => sum + e.x, 0) / run.length;
  const mag = Math.abs(mean);
  const magScore    = mag >= EXTREME ? 2 : mag >= MODERATE ? 1 : 0;
  const streakScore = run.length >= 4 ? 2 : run.length >= 2 ? 1 : 0;

  return {
    direction: side > 0 ? 'right' : 'left',
    value: Math.round(mean),   // run mean; drives `level`, not the caption
    streak: run.length,
    level: Math.min(4, 1 + magScore + streakScore),
    run,
    last: run[run.length - 1],  // the most recently recorded period
    prior,
  };
}

// This reports where the class has already put things, so everything below is
// past tense and leads with the period it is actually talking about. Every band
// name comes from positionLabel, so the arrow speaks the same vocabulary as the
// spectrum readout and the teacher's grading view.
const sideWord = (x) => (sideOf(x) > 0 ? 'right' : 'left');

// The tail that qualifies a single period: either the run it belongs to, or —
// when it stands alone after a period on the other side — that fact, so one
// data point is never dressed up as a trend.
function driftDetail(drift) {
  const { streak, prior } = drift;
  if (streak >= 2) return `${streak} periods running`;
  if (prior) return `the period before was on the ${sideWord(prior.x)}`;
  return '';
}

export function driftCaption(drift) {
  if (!drift) return '';
  const { last } = drift;
  const detail = driftDetail(drift);
  return [last.title, positionLabel(last.x), detail].filter(Boolean).join(' · ');
}

export const driftHeadline = (drift) =>
  drift ? `Previously, society was on the ${drift.direction}` : '';

// Spoken form for aria-label: the caption's "·" separators read badly aloud.
export function driftLabel(drift) {
  if (!drift) return '';
  const detail = driftDetail(drift);
  return `${driftHeadline(drift)}. Last recorded period ${drift.last.title}, `
    + `${positionLabel(drift.last.x)}${detail ? `, ${detail}` : ''}.`;
}
