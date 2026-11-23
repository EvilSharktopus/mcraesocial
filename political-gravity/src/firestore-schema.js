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
 * settings/finalProject                          — teacher writes, all read
 *   topics:       [{ id, topic, country, flag?, start?, leads?: string[] }]
 *   openClasses:  string[]  — classes (roster course · stream) whose writing
 *                             window is open
 *   openUids:     string[]  — the students those classes contain. This is
 *                             what the rules check on every swing write, and
 *                             what the student page reads: students cannot
 *                             read the roster to learn their own class.
 *
 * pg_final_projects/{uid}                        — setup; always writable by owner
 *   uid, birthYear: number
 *   topic, country: string
 *   custom:       boolean  — proposed by the student (needs approval)
 *   topicId, flag: from the topic list, null on a custom topic
 *   candidates:   string   — custom topics only: four candidate swings
 *   updatedAt:    Timestamp
 *   The topic fields freeze once any swing exists (rules), unless the
 *   teacher sets topicUnlocked on the review.
 *
 * pg_final_reviews/{uid}                         — teacher-only writes
 *   uid
 *   status:       'approved' | 'rejected'
 *   note:         string
 *   forTopic:     string   — topicKey() of the proposal the verdict is for;
 *                            editing the proposal sends it back to pending
 *   topicUnlocked: boolean
 *   decidedAt:    Timestamp
 *
 * pg_final_swings/{uid}_{n}                      — n = 1..6; 1-4 lived, 5-6 predicted
 *   uid, n, kind: 'lived' | 'predicted'
 *   name, year, month (lived, optional), ideology, principle
 *   placement:    number | null — -100 (most state, left) .. +100 (least
 *                                 state, right); 0 is a real answer here
 *   placementReason
 *   lived:        trigger, decision, source
 *   predicted:    pressure, pressureSource, decision, proofAgainst
 *   updatedAt:    Timestamp
 *   Writable by the student only while their writing window is open (rules).
 *
 * pg_final_signals/{uid}_{n}                     — student writes, only teacher reads
 *   uid, n
 *   fields: { [field]: { typed, activeMs, pasteCount, pasteChars,
 *                        pasteBlocked, bulkCount, bulkChars } }
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
