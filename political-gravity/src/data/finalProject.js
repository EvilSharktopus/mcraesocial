// src/data/finalProject.js
//
// The Social 30-1 final project ("The Orbit Map"): six swings across the
// student's own lifetime — four lived, two predicted — placed on a single
// more-state / less-state axis. Everything the student page, the map and the
// teacher tab have to agree on lives here.
//
// There are two tracks. Both produce the same six swings and the same map;
// only the topic list and the question set differ.

export const COL = {
  projects: 'pg_final_projects',  // {uid}      setup: birth year, track, topic
  reviews:  'pg_final_reviews',   // {uid}      teacher's verdict on a held topic
  swings:   'pg_final_swings',    // {uid}_{n}  one card each, n = 1..6
  signals:  'pg_final_signals',   // {uid}_{n}  integrity signals, teacher-only read
};
export const SETTINGS_ID = 'finalProject'; // settings/finalProject: topics, questions, writing window

export const END_YEAR = 2040;
export const SWING_NUMBERS = [1, 2, 3, 4, 5, 6];
export const kindOf = (n) => (n <= 4 ? 'lived' : 'predicted');
export const KINDS = ['lived', 'predicted'];

export const TRACKS = {
  sector: {
    label: 'Sector',
    blurb: 'One part of society in one country — for example, carbon pricing in Canada.',
  },
  big: {
    label: 'Big picture',
    blurb: 'The overall direction of a government — for example, the United States across Obama, Trump, Biden, Trump.',
  },
};
export const TRACK_IDS = Object.keys(TRACKS);
export const trackLabel = (t) => TRACKS[t]?.label ?? '';

export const IDEOLOGIES = [
  'Classical liberalism', 'Modern liberalism', 'Conservatism', 'Neoconservatism',
  'Socialism', 'Communism', 'Fascism', 'Other',
];

// ── The guided questions ────────────────────────────────────────────────────
// One answer box per question, a sentence or two each. Three questions carry
// an extra control beside their box:
//   source    — a separate box for the citation, the one place a paste is allowed
//   ideology  — the ideology picker
//   placement — the more-state / less-state drag
//
// The wording here is only the default. The teacher rewords any label or
// prompt from the Final Project tab, which stores the change in
// settings/finalProject.questions[track][kind][id]. The `id` is what an
// answer is saved under, so it must never change: rewording a question keeps
// every answer already written to it.
const PROOF = { id: 'proofAgainst', label: 'Proof against', prompt: 'What would have to happen for this prediction to be wrong?' };
export const DEFAULT_QUESTIONS = {
  sector: {
    lived: [
      { id: 'problem',   label: 'The problem',   prompt: 'What was going wrong?' },
      { id: 'who',       label: 'Who said so',   prompt: 'Which group called it a problem, and what did they stand to gain or lose?' },
      { id: 'evidence',  label: 'Their evidence', prompt: 'What proof did they point to? Cite one source.', source: true },
      { id: 'decision',  label: 'The decision',  prompt: 'What was done about it, and roughly when?' },
      { id: 'pusher',    label: 'Who pushed it', prompt: 'Which party, leader or movement made it happen?' },
      { id: 'reasoning', label: 'Their reasoning', prompt: 'Why did they say this was the right fix, and which ideology does that reasoning belong to?', ideology: true },
      { id: 'placementWhy', label: 'Placement',  prompt: 'Did the state end up doing more or less than before, and by how much?', placement: true },
    ],
    predicted: [
      { id: 'problem',   label: 'The problem',   prompt: 'What is going wrong, or starting to?' },
      { id: 'who',       label: 'Who says so',   prompt: 'Which group is already calling it a problem?' },
      { id: 'evidence',  label: 'Their evidence', prompt: 'What proof are they pointing to today? Cite one source.', source: true },
      { id: 'decision',  label: 'The decision',  prompt: 'What do you predict will be done, and roughly when?' },
      { id: 'pusher',    label: 'Who will push it', prompt: 'Which party, leader or movement is positioned to make it happen?' },
      { id: 'reasoning', label: 'Their reasoning', prompt: 'What will their argument be, and which ideology does it belong to?', ideology: true },
      { id: 'placementWhy', label: 'Placement',  prompt: 'Will the state end up doing more or less, and by how much?', placement: true },
      PROOF,
    ],
  },
  big: {
    lived: [
      { id: 'mood',      label: 'The mood',      prompt: 'What were people unhappy about under the government before?' },
      { id: 'unhappy',   label: 'Who was unhappy', prompt: 'Which groups turned against it, and what did they stand to gain or lose?' },
      { id: 'evidence',  label: 'Their evidence', prompt: 'What proof did they point to? Cite one source.', source: true },
      { id: 'turn',      label: 'The turn',      prompt: 'Who took power, when, and how decisively?' },
      { id: 'promise',   label: 'The promise',   prompt: 'What did they say they would do differently about the role of the state?' },
      { id: 'signature', label: 'The signature decision', prompt: 'Which one law, budget or order best shows the new direction?' },
      { id: 'ideologyWhy', label: 'The ideology', prompt: 'Which ideology does that decision belong to, and which principle shows it?', ideology: true },
      { id: 'placementWhy', label: 'Placement',  prompt: 'Is the state doing more or less overall? Say what you are measuring.', placement: true },
    ],
    predicted: [
      { id: 'mood',      label: 'The mood',      prompt: 'What are people becoming unhappy about now?' },
      { id: 'unhappy',   label: 'Who is unhappy', prompt: 'Which groups are turning, and why?' },
      { id: 'evidence',  label: 'Their evidence', prompt: 'What proof are they pointing to today? Cite one source.', source: true },
      { id: 'turn',      label: 'The turn',      prompt: 'Who do you predict takes power, and roughly when?' },
      { id: 'promise',   label: 'The promise',   prompt: 'What will they promise to do differently?' },
      { id: 'signature', label: 'The signature decision', prompt: 'Which decision would show the new direction?' },
      { id: 'ideologyWhy', label: 'The ideology', prompt: 'Which ideology will it belong to?', ideology: true },
      { id: 'placementWhy', label: 'Placement',  prompt: 'Will the state do more or less, and by how much?', placement: true },
      PROOF,
    ],
  },
};

// The question set a card uses: the defaults, with the teacher's rewording
// laid over the top. A blank override falls back to the default wording.
export function questionsFor(settings, track, kind) {
  const base = DEFAULT_QUESTIONS[track]?.[kind] ?? DEFAULT_QUESTIONS.sector[kind];
  const over = settings?.questions?.[track]?.[kind] ?? {};
  return base.map(q => ({
    ...q,
    label: String(over[q.id]?.label ?? '').trim() || q.label,
    prompt: String(over[q.id]?.prompt ?? '').trim() || q.prompt,
  }));
}

export const LATER_SWING_HINT = 'The problem behind one swing is often the solution from the swing before.';

// What a card stores besides its answers. Answers are saved flat, under
// their question id, next to these.
const BASE_KEYS = ['name', 'year', 'placement', 'ideology', 'source'];
const BLANK = { name: '', year: null, placement: null, ideology: '', source: '' };
export const swingKeys = (questions) => [...BASE_KEYS, ...questions.map(q => q.id)];
export const pickSwing = (d, questions) =>
  Object.fromEntries(swingKeys(questions).map(k => [k, d?.[k] ?? (k in BLANK ? BLANK[k] : '')]));
// Every input that carries integrity signals, with a label for the teacher.
export const signalFields = (questions) => [
  ['name', 'Short name'],
  ...questions.flatMap(q => (q.source ? [[q.id, q.label], ['source', 'Source']] : [[q.id, q.label]])),
];

export const countWords = (s) => (String(s ?? '').trim().match(/\S+/g) || []).length;
export const swingWords = (swing, questions) =>
  questions.reduce((sum, q) => sum + countWords(swing?.[q.id]), 0);

// ── Years ── a swing needs a year, never an exact date.
// Why this year is not usable, or null when it is. A warning, not a gate:
// nothing here ever stops a card from saving.
export function yearProblem(swing, n, birthYear, now = new Date()) {
  const y = swing?.year;
  const thisYear = now.getFullYear();
  if (typeof y !== 'number' || !Number.isInteger(y)) return 'No year yet.';
  if (kindOf(n) === 'lived') {
    if (y < birthYear) return `That is before you were born (${birthYear}).`;
    if (y > thisYear) return 'A lived swing has already happened — this year is in the future.';
    return null;
  }
  if (y <= thisYear) return `A predicted swing comes after ${thisYear}.`;
  if (y > END_YEAR) return `Predictions stop at ${END_YEAR}.`;
  return null;
}
// The first pair of swings that is out of date order, or null. Two swings in
// the same year are in order.
export function orderProblem(swings) {
  let last = null;
  for (const n of SWING_NUMBERS) {
    const y = swings?.[n]?.year;
    if (typeof y !== 'number') continue;
    if (last && y < last.year) return { n, year: y, before: last.n, beforeYear: last.year };
    last = { n, year: y };
  }
  return null;
}

// What is still missing from a card, as words a student can act on.
export function missingFrom(swing, n, birthYear, questions) {
  const out = [];
  const s = swing || {};
  if (!String(s.name ?? '').trim()) out.push('Short name');
  if (yearProblem(s, n, birthYear)) out.push('Year');
  for (const q of questions) {
    if (!String(s[q.id] ?? '').trim()) out.push(q.label);
    if (q.source && !String(s.source ?? '').trim()) out.push('Source');
    if (q.ideology && !s.ideology) out.push('Ideology choice');
    if (q.placement && typeof s.placement !== 'number') out.push('Placement marker');
  }
  return out;
}
export const isComplete = (swing, n, birthYear, questions) =>
  missingFrom(swing, n, birthYear, questions).length === 0;

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

export const whenLabel = (swing, n) =>
  (typeof swing?.year !== 'number' ? '' : kindOf(n) === 'predicted' ? `c. ${swing.year}` : String(swing.year));
// Where a swing sits on the time axis: the middle of its year.
export const timeOf = (swing) => (typeof swing?.year === 'number' ? swing.year + 0.5 : null);

// The three tests for a swing, shown on every card.
export const SWING_TESTS = [
  ['It has a date', 'A law, a budget, a court ruling, or an election that changed policy.'],
  ['It moved something', 'The state took on more, or gave something up, in a way you can point to.'],
  ['It has a cause', 'Pressure built before it, and you can show that pressure with evidence.'],
];

// ── Topics ──────────────────────────────────────────────────────────────────
// { id, track, name, place, flag?, seeTeacher?, start?, leads? }
//   name       what is being traced; blank on the big-picture track, where
//              the place is the topic
//   flag       a short label shown beside the topic and on the project
//   seeTeacher holds the choice for approval, like a custom topic
//   start      a swing to start from, shown before choosing
//   leads      hints shown only after choosing, under "Where to look next"
// This list is only the seed — the live one is settings/finalProject.topics.
const RL = 'Rejection of liberalism';
const S = (name, place, start, leads, flag = '') => ({ track: 'sector', name, place, start, leads, flag, seeTeacher: false });
const B = (place, leads, seeTeacher = false) => ({ track: 'big', name: '', place, start: '', leads, flag: '', seeTeacher });
export const STARTER_TOPICS = [
  S('Carbon pricing', 'Canada', 'BC carbon tax', ["Alberta's carbon levy", 'Federal carbon pricing law', 'End of the consumer carbon charge']),
  S('Drug policy', 'Canada', 'Supreme Court ruling on Insite', ['Cannabis legalized', 'BC decriminalization pilot', 'BC ends the pilot']),
  S('Pipelines and oil', 'Canada', 'Northern Gateway approved', ['Federal purchase of Trans Mountain', 'Impact Assessment Act (Bill C-69)', 'Building Canada Act']),
  S('Immigration', 'Canada', 'Limits on temporary foreign workers', ['Syrian refugee resettlement', 'Cap on international student permits', 'Cut to immigration targets']),
  S('Gun control', 'Canada', 'Long-gun registry scrapped', ['Background-check law (Bill C-71)', 'Ban on assault-style firearms', 'National handgun freeze']),
  S('Public spending', 'Canada', 'Stimulus budget', ['Deficit-reduction budget', 'Deficit-spending budget', 'Pandemic emergency benefits']),
  S('Health insurance', 'United States', 'Affordable Care Act', ['Mandate penalty removed', 'Subsidies expanded', 'Medicaid cuts']),
  S('Bank regulation', 'United States', 'Bank bailout', ['Dodd-Frank Act', 'Partial rollback of Dodd-Frank', 'Silicon Valley Bank rescue']),
  S('Net neutrality', 'United States', 'Open internet rules', ['Rules repealed', 'Rules restored', 'Court strikes the rules down']),
  S('Student debt', 'United States', 'Federal takeover of student lending', ['Payment pause', 'Loan forgiveness plan', 'Supreme Court blocks forgiveness']),
  S('Immigration', 'United States', 'DACA', ['Travel ban', "New president's first-day reversals", 'Expanded deportation campaign']),
  S('Public spending', 'United Kingdom', 'Austerity budget', ['Furlough scheme', 'Truss mini-budget', "Labour's first budget"]),
  S('Pensions', 'France', 'Retirement age raised to 62', ['Partial return to 60', 'Retirement age raised to 64', 'Reform suspended']),
  S('Nuclear power', 'Germany', 'Phase-out decision', ['Reactor lifetimes extended', 'Last reactors kept running', 'Final shutdown']),
  S('Public spending', 'Greece', 'First bailout', ['Syriza elected', 'Bailout referendum and third bailout', 'Exit from the bailout programme']),
  S('Control of the economy', 'Argentina', 'Pension funds nationalized', ['YPF oil company nationalized', 'Currency controls lifted', "Milei's deregulation decree"]),
  S('Family planning', 'China', 'One-child policy eased', ['Two-child policy', 'Three-child policy', 'National childcare subsidy'], RL),
  S('Control of the economy', 'Russia', 'Ban on Western food imports', ['Retirement age raised', 'Capital controls', 'Foreign company assets seized'], RL),
  B('United States', ['Obama', 'Trump', 'Biden', 'Trump']),
  B('Argentina', ['Fernández de Kirchner', 'Macri', 'Fernández', 'Milei']),
  B('Brazil', ['Rousseff', 'Temer', 'Bolsonaro', 'Lula']),
  B('South Korea', ['Lee Myung-bak', 'Park', 'Moon', 'Yoon', 'Lee Jae-myung']),
  B('Italy', ['Berlusconi', 'Monti', 'Renzi', 'Conte', 'Draghi', 'Meloni']),
  B('Canada', ['Harper', 'Trudeau', 'Carney'], true),
  B('Alberta', ['Stelmach', 'Redford', 'Notley', 'Kenney', 'Smith']),
].map((t, i) => ({ id: `starter-${i + 1}`, ...t }));

// A topic as stored, tidied into the shape above. Tolerates a list saved
// before tracks existed (topic/country, no track).
export const normalizeTopic = (t) => ({
  id: t.id,
  track: TRACKS[t.track] ? t.track : 'sector',
  name: String(t.name ?? t.topic ?? '').trim(),
  place: String(t.place ?? t.country ?? '').trim(),
  flag: String(t.flag ?? '').trim(),
  seeTeacher: !!t.seeTeacher,
  start: String(t.start ?? '').trim(),
  leads: (Array.isArray(t.leads) ? t.leads : []).map(x => String(x).trim()).filter(Boolean),
});

export const SEE_TEACHER_MESSAGE = 'Talk to Mr. McRae before choosing this';

const clean = (x) => String(x ?? '').trim();
export const topicText = (t) => [t?.name, t?.place].map(clean).filter(Boolean).join(' — ');
// The identity of a choice: what a teacher's verdict is tied to.
export const topicKey = (t) => [t?.track, t?.name, t?.place].map(clean).join('|').toLowerCase();

// A topic waits for the teacher when the student proposed it, or when it is
// marked "see teacher first".
export const needsApproval = (project) => !!(project?.custom || project?.seeTeacher);

// none | chosen | pending | approved | rejected. A verdict only counts for
// the exact choice it was given to, so changing the choice sends it back to
// pending.
export function topicStatus(project, review) {
  if (!clean(project?.place) || !TRACKS[project?.track]) return 'none';
  if (!needsApproval(project)) return 'chosen';
  if (review?.forTopic !== topicKey(project)) return 'pending';
  return review.status === 'approved' ? 'approved' : review.status === 'rejected' ? 'rejected' : 'pending';
}
export const setupDone = (project, review) =>
  Number.isInteger(project?.birthYear) && ['chosen', 'approved'].includes(topicStatus(project, review));

// The map's title lines: the topic, then its track and any flag.
export const mapTitle = (project) => (clean(project?.place) ? topicText(project) : null);
export const mapSubtitle = (project) =>
  [trackLabel(project?.track) && `${trackLabel(project.track)} track`, clean(project?.flag)].filter(Boolean).join(' · ');

// ── Classes ── a class is the Desk roster's course + stream.
export const classKeyOf = (row) => [row?.course, row?.stream].map(clean).filter(Boolean).join(' · ') || 'No class';
