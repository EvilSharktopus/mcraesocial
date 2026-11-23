// src/data/finalProject.js
//
// The Social 30-1 final project: one topic in one country, six "swings" across
// the student's own lifetime — four lived, two predicted — placed on a single
// less-state / more-state axis. Everything the student page, the map and the
// teacher tab have to agree on lives here.

export const COL = {
  projects: 'pg_final_projects',  // {uid}      setup: birth year + topic
  reviews:  'pg_final_reviews',   // {uid}      teacher's verdict on a custom topic
  swings:   'pg_final_swings',    // {uid}_{n}  one entry each, n = 1..6
  signals:  'pg_final_signals',   // {uid}_{n}  integrity signals, teacher-only read
};
export const SETTINGS_ID = 'finalProject'; // settings/finalProject: topics + writing window

export const END_YEAR = 2040;
export const SWING_NUMBERS = [1, 2, 3, 4, 5, 6];
export const kindOf = (n) => (n <= 4 ? 'lived' : 'predicted');
export const WORD_TARGET = 100;

export const IDEOLOGIES = [
  'Classical liberalism', 'Modern liberalism', 'Conservatism', 'Neoconservatism',
  'Socialism', 'Communism', 'Fascism', 'Other',
];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// The form, field by field. `prose` fields count toward the ~100 words and
// refuse pasting; `source` fields are the one place a paste is allowed (and
// still recorded). Every field here is required unless marked optional.
const SHARED_TAIL = [
  { key: 'principle', label: 'Principle', prose: true, rows: 2,
    hint: 'The principle of that ideology this decision shows.' },
  { key: 'placementReason', label: 'Why there?', prose: true, rows: 3 },
];
export const FIELDS = {
  lived: [
    { key: 'trigger', label: 'Trigger', prose: true, rows: 4,
      hint: 'What pressure built before this, and who felt it?' },
    { key: 'decision', label: 'Decision', prose: true, rows: 3,
      hint: 'What changed, and on what date?' },
    ...SHARED_TAIL,
    { key: 'source', label: 'Source', source: true,
      hint: 'One source for the decision: a URL or citation. You can paste here.' },
  ],
  predicted: [
    { key: 'pressure', label: 'Pressure today', prose: true, rows: 4,
      hint: 'What is building right now?' },
    { key: 'pressureSource', label: 'Source for that pressure', source: true,
      hint: 'One source that shows it: a URL or citation. You can paste here.' },
    { key: 'decision', label: 'Predicted decision', prose: true, rows: 3,
      hint: 'What will change, and roughly when? It should follow from the pattern on your own map, not from what you would like to see.' },
    ...SHARED_TAIL,
    { key: 'proofAgainst', label: 'Proof against', prose: true, rows: 3,
      hint: 'What would have to happen for this prediction to be wrong?' },
  ],
};
// Text inputs outside the list above that also carry integrity signals.
export const SIGNAL_FIELDS = (kind) => ['name', ...FIELDS[kind].map(f => f.key)];

export const blankSwing = () => ({
  name: '', year: null, month: null, ideology: '', placement: null,
  trigger: '', decision: '', principle: '', placementReason: '', source: '',
  pressure: '', pressureSource: '', proofAgainst: '',
});

export const countWords = (s) => (String(s ?? '').trim().match(/\S+/g) || []).length;
export function swingWords(swing, n) {
  return FIELDS[kindOf(n)].filter(f => f.prose)
    .reduce((sum, f) => sum + countWords(swing?.[f.key]), 0);
}

// Why this date is not acceptable, or null when it is.
export function yearProblem(swing, n, birthYear, now = new Date()) {
  const y = swing?.year;
  const thisYear = now.getFullYear();
  if (typeof y !== 'number' || !Number.isInteger(y)) return 'Enter a year.';
  if (kindOf(n) === 'lived') {
    if (y < birthYear) return `That is before you were born (${birthYear}).`;
    if (y > thisYear) return 'A lived swing has already happened — this year is in the future.';
    if (y === thisYear && swing.month && swing.month > now.getMonth() + 1) return 'That month has not happened yet.';
    return null;
  }
  if (y <= thisYear) return `A predicted swing comes after ${thisYear}.`;
  if (y > END_YEAR) return `Predictions stop at ${END_YEAR}.`;
  return null;
}

// What is still missing from an entry, as words a student can act on.
export function missingFrom(swing, n, birthYear) {
  const out = [];
  const s = swing || {};
  if (!String(s.name ?? '').trim()) out.push('Short name');
  if (yearProblem(s, n, birthYear)) out.push('Date');
  for (const f of FIELDS[kindOf(n)]) {
    if (f.key === 'principle' && !s.ideology) out.push('Ideology');
    if (f.key === 'placementReason' && typeof s.placement !== 'number') out.push('Placement');
    if (!String(s[f.key] ?? '').trim()) out.push(f.label);
  }
  return out;
}
export const isComplete = (swing, n, birthYear) => missingFrom(swing, n, birthYear).length === 0;

// -100 (most state, on the left) … +100 (least state, on the right) — the
// same way round as the economic spectrum. Unlike that spectrum, the middle
// here is a real answer.
export function stateLabel(v) {
  if (typeof v !== 'number') return 'Drag to place';
  if (v <= -67) return 'Extensive state';
  if (v <= -34) return 'More state';
  if (v < 0)    return 'Leaning more state';
  if (v === 0)  return 'Balanced';
  if (v < 34)   return 'Leaning less state';
  if (v < 67)   return 'Less state';
  return 'Minimal state';
}

export function whenLabel(swing, n) {
  if (typeof swing?.year !== 'number') return '';
  if (kindOf(n) === 'predicted') return `c. ${swing.year}`;
  return swing.month ? `${MONTHS[swing.month - 1].slice(0, 3)} ${swing.year}` : String(swing.year);
}

// Where a swing sits on the time axis, as a fractional year.
export function timeOf(swing, n) {
  if (typeof swing?.year !== 'number') return null;
  if (kindOf(n) === 'predicted') return swing.year + 0.5;
  return swing.year + (swing.month ? (swing.month - 0.5) / 12 : 0.5);
}

// The handout's three tests, shown on every entry form.
export const SWING_TESTS = [
  ['It has a date', 'A law, a budget, a court ruling, or an election that changed policy.'],
  ['It moved something', 'The state took on more, or gave something up, in a way you can point to.'],
  ['It has a cause', 'Pressure built before it, and you can show that pressure with evidence.'],
];

// The handout's starting list ("The Orbit Map"): a swing to start from and
// three leads each. Only a seed — the live list is whatever the teacher keeps
// in settings/finalProject.topics.
const RL = 'Rejection of liberalism: the state may move mostly one way. Part of your job is to explain why the pull back is weak or missing.';
const T = (topic, country, start, leads, flag = '') => ({ topic, country, start, leads, flag });
export const STARTER_TOPICS = [
  T('Carbon pricing', 'Canada', "British Columbia's carbon tax, 2008", ["Alberta's carbon levy, 2017", 'Federal carbon pricing law, 2018', 'End of the consumer carbon charge, 2025']),
  T('Drug policy', 'Canada', 'Supreme Court ruling on Insite, 2011', ['Cannabis legalized, 2018', "British Columbia's decriminalization pilot, 2023", 'British Columbia ends the pilot, 2026']),
  T('Pipelines and oil', 'Canada', 'Northern Gateway approved, 2014', ['Federal purchase of Trans Mountain, 2018', 'Impact Assessment Act (Bill C-69), 2019', 'Building Canada Act, 2025']),
  T('Immigration', 'Canada', 'Limits on temporary foreign workers, 2014', ['Syrian refugee resettlement, 2015', 'Cap on international student permits, 2024', 'Cut to immigration targets, 2024']),
  T('Gun control', 'Canada', 'Long-gun registry scrapped, 2012', ['Background-check law (Bill C-71), 2019', 'Ban on assault-style firearms, 2020', 'National handgun freeze, 2022']),
  T('Public spending', 'Canada', 'Stimulus budget, 2009', ['Deficit-reduction budget, 2012', 'Deficit-spending budget, 2016', 'Pandemic emergency benefits, 2020']),
  T('Health insurance', 'United States', 'Affordable Care Act, 2010', ['Mandate penalty removed, 2017', 'Subsidies expanded, 2021', 'Medicaid cuts, 2025']),
  T('Bank regulation', 'United States', 'Bank bailout, 2008', ['Dodd-Frank Act, 2010', 'Partial rollback of Dodd-Frank, 2018', 'Silicon Valley Bank rescue, 2023']),
  T('Net neutrality', 'United States', 'Open internet rules, 2015', ['Rules repealed, 2017', 'Rules restored, 2024', 'Court strikes the rules down, 2025']),
  T('Student debt', 'United States', 'Federal takeover of student lending, 2010', ['Payment pause, 2020', 'Loan forgiveness plan, 2022', 'Supreme Court blocks forgiveness, 2023']),
  T('Immigration', 'United States', 'Protection for undocumented youth (DACA), 2012', ['Travel ban, 2017', "New president's first-day reversals, 2021", 'Expanded deportation campaign, 2025']),
  T('Public spending', 'United Kingdom', 'Austerity budget, 2010', ['Furlough scheme, 2020', 'Truss mini-budget, 2022', "Labour's first budget, 2024"]),
  T('Pensions', 'France', 'Retirement age raised to 62, 2010', ['Partial return to 60, 2012', 'Retirement age raised to 64, 2023', 'Reform suspended, 2025']),
  T('Nuclear power', 'Germany', 'Phase-out decision, 2011', ['Reactor lifetimes extended, 2010', 'Last reactors kept running, 2022', 'Final shutdown, 2023']),
  T('Public spending', 'Greece', 'First bailout, 2010', ['Syriza elected, 2015', 'Bailout referendum and third bailout, 2015', 'Exit from the bailout programme, 2018']),
  T('Control of the economy', 'Argentina', 'Pension funds nationalized, 2008', ['YPF oil company nationalized, 2012', 'Currency controls lifted, 2015', "Milei's deregulation decree, 2023"]),
  T('Family planning', 'China', 'One-child policy eased, 2013', ['Two-child policy, 2016', 'Three-child policy, 2021', 'National childcare subsidy, 2025'], RL),
  T('Control of the economy', 'Russia', 'Ban on Western food imports, 2014', ['Retirement age raised, 2018', 'Capital controls, 2022', 'Foreign company assets seized, 2023'], RL),
].map((t, i) => ({ id: `starter-${i + 1}`, ...t }));

// ── Topics ──
export const topicKey = (t) => `${String(t?.topic ?? '').trim()}|${String(t?.country ?? '').trim()}`.toLowerCase();
export const topicText = (t) => [t?.topic, t?.country].map(x => String(x ?? '').trim()).filter(Boolean).join(' — ');

// chosen | pending | approved | rejected | none. A custom topic's approval
// only counts for the exact topic it was given to, so editing the proposal
// sends it back to pending.
export function topicStatus(project, review) {
  if (!project?.topic?.trim()) return 'none';
  if (!project.custom) return 'chosen';
  if (review?.forTopic !== topicKey(project)) return 'pending';
  return review.status === 'approved' ? 'approved' : review.status === 'rejected' ? 'rejected' : 'pending';
}
export const setupDone = (project, review) =>
  Number.isInteger(project?.birthYear) && ['chosen', 'approved'].includes(topicStatus(project, review));

// ── Classes ── a class is the Desk roster's course + stream.
export const classKeyOf = (row) => [row?.course, row?.stream].map(x => String(x ?? '').trim()).filter(Boolean).join(' · ') || 'No class';
