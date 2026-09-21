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
