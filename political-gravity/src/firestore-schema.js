/**
 * firestore-schema.js
 *
 * This file documents the Firestore collection structure for Political Gravity.
 * It is NOT executed — it exists as a reference and for IDE intellisense.
 *
 * Collections:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * users/{uid}
 *   uid:          string   — Firebase Auth UID
 *   email:        string
 *   displayName:  string
 *   role:         'student' | 'teacher'
 *   classCode:    string | null  — links student to a class
 *   createdAt:    Timestamp
 *   lastLoginAt:  Timestamp
 *
 * readings/{readingId}
 *   title:        string
 *   unit:         string   — e.g. "Unit 1 — Democracy"
 *   body:         string   — HTML or markdown text content
 *   assignedTo:   string[] — array of classCodes this reading is assigned to
 *   createdAt:    Timestamp
 *   createdBy:    string   — teacher uid
 *
 * plots/{plotId}
 *   readingId:    string   — ref to readings/{readingId}
 *   userId:       string   — ref to users/{uid}
 *   x:            number   — -100 to 100 (left = negative, right = positive)
 *   y:            number   — -100 to 100 (auth = positive, lib = negative)
 *   justification: string
 *   submittedAt:  Timestamp
 *
 * reflections/{reflectionId}
 *   readingId:    string
 *   userId:       string
 *   adjustedX:    number | null  — null if position unchanged
 *   adjustedY:    number | null
 *   reflection:   string
 *   submittedAt:  Timestamp
 *
 * seminar_comments/{commentId}
 *   seminarId:    string   — same as readingId (seminars are per-reading)
 *   userId:       string
 *   text:         string
 *   timestamp:    Timestamp
 *
 * Suggested indexes:
 *   plots:       (readingId ASC, submittedAt DESC)
 *   reflections: (readingId ASC, submittedAt DESC)
 *   seminar_comments: (seminarId ASC, timestamp ASC)
 */
