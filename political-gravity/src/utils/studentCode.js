// src/utils/studentCode.js
//
// Student codes. A student signs in with a code like S30-7K4Q and a
// password; under the hood the account's Firebase "email" is the code at a
// private domain, s30-7k4q@code.desk, which is never a real mailbox. Every
// document id and rule that compared emails keeps working unchanged, and
// nothing that leaves the building carries a real address.
//
// The alphabet leaves out 0, O, 1 and I, which are confusable on paper.
// Copied from Desk (mcrae-submit/src/utils/studentCode.js); keep them in step.

const CODE_DOMAIN = 'code.desk';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^S(9|10|20|30)-[A-HJ-NP-Z2-9]{4}$/;
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function coursePrefix(course) {
  const m = /(\d+)/.exec(String(course ?? ''));
  const n = m ? m[1] : '';
  return ['9', '10', '20', '30'].includes(n) ? `S${n}` : 'S30';
}

function pick(alphabet, n, rand = Math.random) {
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(rand() * alphabet.length) % alphabet.length];
  return out;
}

function generateCode(course, rand = Math.random) {
  return `${coursePrefix(course)}-${pick(CODE_ALPHABET, 4, rand)}`;
}

/** Temporary password: two short groups, lower case, no confusable letters. */
function tempPassword(rand = Math.random) {
  return `${pick(PASSWORD_ALPHABET, 4, rand)}-${pick(PASSWORD_ALPHABET, 4, rand)}`;
}

/** "s30 7k4q", "S307K4Q", " s30-7k4q " -> "S30-7K4Q"; null if not a code. */
function normalizeCode(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^S(9|10|20|30)([A-Z0-9]{4})$/.exec(raw);
  if (!m) return null;
  const code = `S${m[1]}-${m[2]}`;
  return CODE_RE.test(code) ? code : null;
}

function codeToEmail(code) {
  const c = normalizeCode(code);
  return c ? `${c.toLowerCase()}@${CODE_DOMAIN}` : null;
}

function isCodeEmail(email) {
  return String(email ?? '').toLowerCase().endsWith(`@${CODE_DOMAIN}`);
}

function emailToCode(email) {
  if (!isCodeEmail(email)) return null;
  return normalizeCode(String(email).split('@')[0]);
}

/**
 * The given names from a full name: everything before the surname, so
 * "Mary Jane Smith" -> "Mary Jane" and "Nathan Broos" -> "Nathan". A single
 * word is taken as the given name. This is what a student or classmate sees.
 */
function firstNameOf(fullName, fallback = 'Student') {
  const words = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  const given = words.length >= 2 ? words.slice(0, -1) : words;
  return given.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * What a student is called on their own screen and on anything a classmate
 * can see: the first name on the account. A code account's displayName is
 * already a first name; a legacy email account's might be a full name, so
 * it is cut down here too.
 */
export function studentDisplayName(user) {
  // A code account's displayName is already the given names, kept whole.
  if (isCodeEmail(user?.email) && String(user?.displayName ?? '').trim()) return String(user.displayName).trim();
  return firstNameOf(user?.displayName || emailToCode(user?.email) || String(user?.email ?? '').split('@')[0], 'Student');
}

export {
  CODE_DOMAIN, CODE_ALPHABET, CODE_RE,
  coursePrefix, generateCode, tempPassword, normalizeCode, codeToEmail, isCodeEmail, emailToCode, firstNameOf,
};
