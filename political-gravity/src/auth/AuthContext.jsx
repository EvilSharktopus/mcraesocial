// src/auth/AuthContext.jsx
//
// Role strategy:
//   On every login / sign-up, we upsert a Firestore doc at users/{uid}.
//   The doc's `role` field drives access: 'teacher' or 'student'.
//   On first login, amcrae@rvschools.ab.ca is auto-seeded as 'teacher';
//   all other @rvschools.ab.ca accounts default to 'student'.
//   Any existing teacher can later promote a user to 'teacher' via Firestore.

import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const ALLOWED_DOMAIN   = 'rvschools.ab.ca';
const DEFAULT_TEACHER  = import.meta.env.VITE_TEACHER_EMAIL; // amcrae@rvschools.ab.ca

const AuthContext = createContext(null);

/**
 * Upserts users/{uid} in Firestore.
 * - On creation: sets role based on email.
 * - On subsequent logins: only updates lastLoginAt; does NOT overwrite role
 *   (so manually promoted teachers stay teachers).
 */
async function ensureUserDoc(firebaseUser) {
  try {
    const ref  = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const defaultRole =
        firebaseUser.email === DEFAULT_TEACHER ? 'teacher' : 'student';

      await setDoc(ref, {
        uid:         firebaseUser.uid,
        email:       firebaseUser.email,
        displayName: firebaseUser.displayName || '',
        role:        defaultRole,
        classCode:   null,
        createdAt:   serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });

      return defaultRole;
    } else {
      await setDoc(ref, { lastLoginAt: serverTimestamp() }, { merge: true });
      return snap.data().role;
    }
  } catch (err) {
    // Firestore rules not yet configured — fall back to email-based detection.
    // This is temporary until firestore.rules is updated.
    console.warn('[AuthContext] Firestore unavailable, using email fallback:', err.code);
    return firebaseUser.email === DEFAULT_TEACHER ? 'teacher' : 'student';
  }
}

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(undefined); // undefined = loading
  const [userDoc,   setUserDoc]   = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const role = await ensureUserDoc(firebaseUser);
        setUser(firebaseUser);
        setIsTeacher(role === 'teacher');
        setUserDoc({ uid: firebaseUser.uid, email: firebaseUser.email, role });
      } else {
        setUser(null);
        setIsTeacher(false);
        setUserDoc(null);
      }
    });
  }, []);

  const signIn = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signUp = async (email, password, displayName) => {
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new Error(`Please use your @${ALLOWED_DOMAIN} school email.`);
    }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    return cred;
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const signOutUser = () => signOut(auth);

  return (
    <AuthContext.Provider
      value={{ user, userDoc, isTeacher, signIn, signUp, resetPassword, signOut: signOutUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
