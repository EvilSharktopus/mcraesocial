// Five-band rubric, each band worth 20%. Shared by the teacher's Grading tab
// and the student dashboard so the two can never disagree about a mark.

export const GRADE_SCALE = [
  { code: 'P',  score: 20,  name: 'Poor' },
  { code: 'L',  score: 40,  name: 'Limited' },
  { code: 'S',  score: 60,  name: 'Satisfactory' },
  { code: 'Pf', score: 80,  name: 'Proficient' },
  { code: 'E',  score: 100, name: 'Excellent' },
];

export const scoreOf = (code) => GRADE_SCALE.find(g => g.code === code)?.score ?? 0;

// Justification and reflection each carry half. Anything ungraded or never
// submitted scores zero, so the total is always out of both halves.
export const totalFor = (grade) =>
  Math.round((scoreOf(grade?.justification) + scoreOf(grade?.reflection)) / 2);

// A grade only counts as given once the teacher has actually set a band.
export const isGraded = (grade) => !!(grade?.justification || grade?.reflection);

export const gradeKey = (uid, readingId) => `${uid}_${readingId}`;

const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

// A student's standing across the readings so far: the average of every
// piece the teacher has actually marked. Unlike totalFor, a piece with no
// band yet is left out rather than counted as zero — otherwise a student's
// overall mark would sink every time a new reading opened and rise again as
// it was marked. Each justification and each reflection is one piece.
export function overallFor(grades, uid, readingIds) {
  const j = [], r = [];
  let readings = 0;
  for (const id of readingIds) {
    const g = grades[gradeKey(uid, id)];
    if (!isGraded(g)) continue;
    readings += 1;
    if (g.justification) j.push(scoreOf(g.justification));
    if (g.reflection)    r.push(scoreOf(g.reflection));
  }
  return {
    overall: mean([...j, ...r]), justification: mean(j), reflection: mean(r),
    pieces: j.length + r.length, readings,
  };
}
