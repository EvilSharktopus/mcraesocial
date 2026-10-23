// src/auth/AuthContext.jsx
//
// Accounts are made in Desk (the Roster tab) and shared through the one
// Firebase project: a student signs in here with the same code and password
// as on Desk. There is no sign-up and no password reset for students; the
// teacher resets a password from Desk. The teacher still signs in with an
// email address.
//
// Role strategy:
//   On every login we upsert users/{uid}. The doc's `role` drives access:
//   'teacher' or 'student'. amcrae@rvschools.ab.ca is seeded as 'teacher';
//   everyone else is a student. The doc carries the account's first name
//   and its code address, never a real email or a surname.

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { normalizeCode, codeToEmail, isCodeEmail, studentDisplayName } from '../utils/studentCode';

const LEGACY_DOMAIN    = 'rvschools.ab.ca';
const DEFAULT_TEACHER  = 'amcrae@rvschools.ab.ca';

const AuthContext = createContext(null);

function isTeacherEmail(email) {
  return String(email ?? '').toLowerCase() === DEFAULT_TEACHER;
}

/**
 * Upserts users/{uid} in Firestore.
 * - On creation: sets role based on email.
 * - On subsequent logins: refreshes the display name (a rename on Desk
 *   lands here) and stamps lastLoginAt; never overwrites role.
 */
async function ensureUserDoc(firebaseUser) {
  try {
    const ref  = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);
    const teacher = isTeacherEmail(firebaseUser.email);
    const displayName = teacher ? (firebaseUser.displayName || '') : studentDisplayName(firebaseUser);

    if (!snap.exists()) {
      const defaultRole = teacher ? 'teacher' : 'student';
      await setDoc(ref, {
        uid:         firebaseUser.uid,
        email:       firebaseUser.email,
        displayName,
        role:        defaultRole,
        classCode:   null,
        createdAt:   serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      return defaultRole;
    }
    // Bookkeeping; nothing waits on it.
    setDoc(ref, { lastLoginAt: serverTimestamp(), displayName }, { merge: true })
      .catch(err => console.warn('[AuthContext] could not stamp lastLoginAt:', err.code));
    return snap.data().role;
  } catch (err) {
    console.warn('[AuthContext] Firestore unavailable, using email fallback:', err.code);
    return isTeacherEmail(firebaseUser.email) ? 'teacher' : 'student';
  }
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(undefined); // undefined = loading
  const [userDoc,   setUserDoc]   = useState(null);
  const [isTeacher, setIsTeacher] = useState(undefined); // undefined = role unknown yet

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // An old email account that Desk has moved to a code: refused here
        // too, without touching Firestore. The account stays enabled for
        // anything else on this project.
        if (!isTeacherEmail(firebaseUser.email) && String(firebaseUser.email || '').toLowerCase().endsWith(`@${LEGACY_DOMAIN}`)) {
          setIsTeacher(false);
          setUserDoc(null);
          return;
        }
        const role = await ensureUserDoc(firebaseUser);
        setIsTeacher(role === 'teacher');
        setUserDoc({ uid: firebaseUser.uid, email: firebaseUser.email, role });
      } else {
        setUser(null);
        setIsTeacher(false);
        setUserDoc(null);
      }
    });
  }, []);

  /** Teacher: email and password. */
  const signIn = (email, password) =>
    signInWithEmailAndPassword(auth, String(email).trim(), password);

  /** Student: code and password. The code is the account's address at a private domain. */
  const signInWithCode = (code, password) => {
    const normalized = normalizeCode(code);
    if (!normalized) {
      const err = new Error('That does not look like a student code. It looks like S30-7K4Q.');
      err.code = 'pg/bad-code';
      throw err;
    }
    return signInWithEmailAndPassword(auth, codeToEmail(normalized), password);
  };

  /** Teacher only; a student's password is reset from Desk's Roster tab. */
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const signOutUser = () => signOut(auth);

  const isLegacyStudent = Boolean(user?.email)
    && !isTeacherEmail(user.email)
    && String(user.email).toLowerCase().endsWith(`@${LEGACY_DOMAIN}`);
  const isCodeAccount = isCodeEmail(user?.email);

  return (
    <AuthContext.Provider
      value={{ user, userDoc, isTeacher, isLegacyStudent, isCodeAccount, signIn, signInWithCode, resetPassword, signOut: signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
