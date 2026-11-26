// src/data/catchup.js
//
// "Missing work": the queue a student runs through to catch up. Pure
// functions over the documents the app already keeps, so the dashboard's
// count and the reading page's "next" can never disagree.
import { hasPosition } from './readings.js';

// When the student-led flow (submit, read a classmate's point, reflect) went
// in. A position saved before it has no `submitted` flag because there was
// nothing to submit — it is finished work, already shared with the class.
export const STUDENT_LED_SINCE_MS = Date.UTC(2026, 9, 13, 12, 46);
const millis = (ts) => ts?.toMillis?.() ?? 0;
const placed = (p) => hasPosition(p?.positionX) || hasPosition(p?.positionY);

export const sharedWithClass = (p) => p?.submitted === true
  || (p?.submitted === undefined
      && millis(p?.updatedAt) > 0 && millis(p.updatedAt) < STUDENT_LED_SINCE_MS && placed(p));

// The time periods a student is answerable for: everything on the reading
// list up to and including the furthest one the teacher has open. The list
// runs in the order the course does, so that is "everything the class has
// reached". Archived periods never count.
export function duePeriods(readings, openIds) {
  const active = readings.filter(r => !r.archived);
  let last = -1;
  active.forEach((r, i) => { if (openIds.includes(r.id)) last = i; });
  return active.slice(0, last + 1);
}

const PIECES = [
  { piece: 'justification', label: 'Justification' },
  { piece: 'reflection', label: 'Reflection' },
];
// When a piece was last handed in. Autosaves move updatedAt on every
// keystroke, so a student part-way through redoing something would look
// finished; submittedAt only moves when they press the button. Work from
// before submittedAt was kept falls back to updatedAt.
const handedInAt = (work) => millis(work?.submittedAt) || millis(work?.updatedAt);

// When the teacher last set the band on one piece. Marks made before each
// piece kept its own time fall back to the document's.
const markedAt = (grade, piece) => millis(grade?.[`${piece}At`]) || millis(grade?.updatedAt);

// What is still owed on one time period: a piece that has not been handed
// in, or one the teacher marked Poor that has not been redone since.
//   [{ piece, label, why: 'todo' | 'poor' }]
// A band other than Poor settles a piece, handed in or not — the teacher
// has looked and moved on. A Poor piece leaves the queue once the student
// has reworked it after the mark; it comes back only if it is marked Poor
// again.
export function owedOn({ plot, reflection, grade }) {
  const done = {
    justification: !!plot && (sharedWithClass(plot) || !!reflection),
    reflection: !!reflection && reflection.draft !== true,
  };
  const workedAt = { justification: handedInAt(plot), reflection: handedInAt(reflection) };
  const out = [];
  for (const { piece, label } of PIECES) {
    const band = grade?.[piece];
    if (band === 'P') {
      // A just-saved piece has no server time yet; that is newer than any mark.
      const pending = done[piece] && workedAt[piece] === 0;
      if (!done[piece] || !(pending || workedAt[piece] > markedAt(grade, piece))) out.push({ piece, label, why: done[piece] ? 'poor' : 'todo' });
    } else if (!band && !done[piece]) {
      out.push({ piece, label, why: 'todo' });
    }
  }
  return out;
}
// A Poor piece the student has reworked since it was marked: off their
// queue, and waiting on the teacher to look again.
export function redoneSinceMarked({ plot, reflection, grade }, piece) {
  if (grade?.[piece] !== 'P') return false;
  const work = piece === 'justification' ? plot : reflection;
  if (!work || (piece === 'reflection' && work.draft === true)) return false;
  return handedInAt(work) > markedAt(grade, piece);
}

// The queue: due periods with something owed, in course order.
export function catchUpQueue(readings, openIds, work) {
  return duePeriods(readings, openIds)
    .map(reading => ({
      reading,
      owed: owedOn({ plot: work.plots[reading.id], reflection: work.reflections[reading.id], grade: work.grades[reading.id] }),
    }))
    .filter(x => x.owed.length > 0);
}

export const owedText = (owed) => owed
  .map(o => `${o.label} ${o.why === 'poor' ? '(marked Poor — redo it)' : '(not done)'}`).join(' · ');
