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

// A grade only counts as given once the teacher has actually set a band.
export const isGraded = (grade) => !!(grade?.justification || grade?.reflection);

export const gradeKey = (uid, readingId) => `${uid}_${readingId}`;

const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export const bandName = (code) => GRADE_SCALE.find(g => g.code === code)?.name ?? null;

// A standing across a set of readings: the average of every piece the
// teacher has actually marked. A piece with no band yet is left out rather
// than counted as zero — otherwise an overall mark would sink every time a
// new reading opened and rise again as it was marked. Work that was never
// handed in is marked Poor by the teacher, which is how it comes to count.
// Each justification and each reflection is one piece. Takes the grade
// documents themselves (missing ones are fine), so the teacher's table and
// the student's own view run the same sum.
export function overallOf(gradeDocs) {
  const j = [], r = [];
  let readings = 0;
  for (const g of gradeDocs) {
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
export const overallFor = (grades, uid, readingIds) =>
  overallOf(readingIds.map(id => grades[gradeKey(uid, id)]));

// One reading's mark on the same footing: the average of whichever of its
// two pieces has been marked, or null if neither has.
export const readingMark = (grade) => overallOf([grade]).overall;
// Marked in part: one piece has a band and the other is still to come.
export const partlyMarked = (grade) => isGraded(grade) && !(grade.justification && grade.reflection);
