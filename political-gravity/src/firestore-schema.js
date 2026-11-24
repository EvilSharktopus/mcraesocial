/**
 * firestore-schema.js
 *
 * Documents the Firestore collections Political Gravity actually uses.
 * It is NOT executed — it exists as a reference so nobody guesses field names.
 *
 * The security rules live only in the Firebase console (see ../DEPLOY.md).
 * Every student-work document is keyed `${uid}_${readingId}` so a student can
 * only ever have one of each per reading and re-saving overwrites in place.
 *
 * Collections:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * users/{uid}
 *   uid:          string   — Firebase Auth UID
 *   email:        string
 *   displayName:  string
 *   role:         'student' | 'teacher'
 *   classCode:    string | null
 *   createdAt:    Timestamp
 *   lastLoginAt:  Timestamp
 *
 * plots/{uid}_{readingId}                         — position + justification
 *   uid:           string
 *   readingId:     string   — matches settings/masterReadings.readings[].id
 *   positionX:     number | null   — economic axis, -100..100; null = not placed
 *   positionY:     number | null   — political axis; centre (0) is never stored
 *   axes:          'economic' | 'political' | 'both'
 *   justification: string
 *   submitted:     boolean   — true once the student pressed Submit Position
 *                              (final: locks their justification, shows them
 *                              the class dots, and makes this dot — with its
 *                              justification, anonymously — readable by
 *                              classmates). Absent while still working, and on
 *                              docs from before the student-led flow.
 *   submittedAt:   Timestamp — set when submitted flips true
 *   updatedAt:     Timestamp
 *   Autosaved as the student works; any doc here shows as "In Progress".
 *
 * pg_reflections/{uid}_{readingId}               — post-seminar move + reflection
 *   uid, readingId
 *   originalPositionX/Y: number | null  — copied from the plot when written
 *   newPositionX/Y:      number | null  — where they moved to
 *   originalPosition, newPosition: number | null — single-axis pair the
 *                                        grading and seminar views read
 *   reflection:    string
 *   respondingTo:  { uid, axis: 'economic'|'political', position: number,
 *                    label: string } | null
 *                  — the classmate's point the reflection reacts to. Shown to
 *                    the student anonymously; the uid is kept for grading.
 *   draft:         boolean  — true while only autosaved; false (or absent, for
 *                             older docs) once the student pressed Submit.
 *                             Only non-drafts count as "Submitted".
 *   updatedAt:     Timestamp
 *
 * pg_grades/{uid}_{readingId}                    — teacher-only writes
 *   uid, readingId
 *   justification: 'P' | 'L' | 'S' | 'Pf' | 'E' | null   (see data/rubric.js)
 *   reflection:    same
 *   updatedAt:     Timestamp
 *
 * ── Final project (Social 30-1, "The Orbit Map") — see data/finalProject.js ──
 *
 * Two tracks, 'sector' and 'big' (big picture). They share everything below;
 * only the topic list and the guided questions differ.
 *
 * settings/finalProject                          — teacher writes, all read
 *   topics:       [{ id, track, name, place, flag?, seeTeacher?, start?,
 *                    leads?: string[], predict?: string, measures?: string[] }]
 *                 — measures: which of spending / regulation / enforcement /
 *                   restriction suit the topic; the rest are greyed out in
 *                   setup. Empty or absent = all four.
 *   questions:    { [track]: { lived|predicted: { [questionId]:
 *                    { label?, prompt? } } } }
 *                 — the teacher's rewording only. The questions themselves,
 *                   their ids and their defaults are DEFAULT_QUESTIONS.
 *   openClasses:  string[]  — classes (roster course · stream) whose writing
 *                             window is open
 *   previewUid:   string | null — the teacher's own uid while the writing
 *                             window of their practice project (Settings →
 *                             Student view) is open; kept in openUids too
 *   openUids:     string[]  — the students those classes contain. This is
 *                             what the rules check on every swing write, and
 *                             what the student page reads: students cannot
 *                             read the roster to learn their own class.
 *
 * pg_final_projects/{uid}                        — setup; always writable by owner
 *   uid, birthYear: number
 *   track:        'sector' | 'big'
 *   name, place:  string   — name is '' on the big-picture track
 *   custom:       boolean  — proposed by the student
 *   seeTeacher:   boolean  — copied from the topic; held like a custom one
 *   topicId, flag: from the topic list; null / '' on a custom topic
 *   measure:      string   — what "more state" is more of: spending,
 *                            regulation, enforcement, restriction, or the
 *                            student's own words. One for all six swings;
 *                            labels the map axis. Never frozen.
 *   candidates:   string   — custom only: candidate swings, or governments
 *   updatedAt:    Timestamp
 *   track/name/place/custom/topicId/flag/seeTeacher freeze once any swing
 *   exists (rules), unless the teacher sets topicUnlocked on the review.
 *
 * pg_final_reviews/{uid}                         — teacher-only writes
 *   uid
 *   status:       'approved' | 'rejected'
 *   note:         string
 *   forTopic:     string   — topicKey() of the choice the verdict is for;
 *                            changing the choice sends it back to pending
 *   topicUnlocked: boolean
 *   decidedAt:    Timestamp
 *
 * pg_final_swings/{uid}_{n}                      — n = 1..6; 1-4 lived, 5-6 predicted
 *   uid, n, kind: 'lived' | 'predicted'
 *   name:         string
 *   year:         number | null — a year only, never a date
 *   placement:    number | null — -100 (most state, left) .. +100 (least
 *                                 state, right); 0 is a real answer here
 *   ideology:     string        — the picker beside the ideology question
 *   source:       string        — the pastable box beside the evidence question
 *   [questionId]: string        — one answer per guided question, stored flat
 *                                 under the question's id
 *   updatedAt:    Timestamp     — must be the server clock (rules)
 *   Writable by the student only while their writing window is open (rules).
 *
 * pg_final_signals/{uid}_{n}                     — student writes, only teacher reads
 *   uid, n
 *   fields: { [name | source | questionId]: { typed, activeMs, pasteCount,
 *             pasteChars, pasteBlocked, bulkCount, bulkChars } }
 *   Counters only ever arrive as increments. Client-reported: a prompt for
 *   a conversation, not a record.
 *
 * diplomaFlags/{randomUUID}                      — the student's Diploma Vault
 *   uid, readingId, readingTitle
 *   quote:        string   — the highlighted passage
 *   commentary:   string
 *   tags:         string[]
 *   createdAt:    Timestamp
 *   Never touched by a teacher Reset — these are study notes, not an assignment.
 *
 * readingContent/{readingId}
 *   html:         string   — the published Google Doc, fetched by /api/fetch-reading
 *   publishedAt:  Timestamp
 *   publishedBy:  string
 *   sourceUrl:    string
 *
 * settings/masterReadings
 *   readings: [{ id, title, century, url, archived?, deskAssignmentId? }]
 * settings/global
 *   openReadings:    string[]  — ids students can open
 *   reflectReadings: string[]  — ids currently in reflection mode
 * settings/consensus
 *   { [readingId]: { x: number } } — where the class landed on that period.
 *   Seeds the next reading's starting point, and feeds the Society drift arrow
 *   (data/drift.js). x is never 0: dead centre means "not recorded", matching
 *   hasPosition() everywhere else, so a teacher pressing Save without dragging
 *   cannot enter a meaningless value.
 * settings/publishedReadings
 *   { [readingId]: { publishedAt: ISO string, publishedBy } }
 *
 * Browser-side only (localStorage):
 *   pg-draft:{uid}:{readingId} — the on-device copy of unsaved edits, cleared
 *   once Firestore confirms the write. See pages/Reading.jsx.
 */
