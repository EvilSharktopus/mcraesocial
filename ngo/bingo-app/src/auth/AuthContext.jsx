// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

const TEACHER_EMAIL = "amcrae@rvschools.ab.ca";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(undefined); // undefined = loading
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);
      setIsTeacher(u?.email === TEACHER_EMAIL);

      // Ensure ngo_settings/global exists with defaults when teacher logs in
      if (u?.email === TEACHER_EMAIL) {
        await initNgoSettings();
      }
    });
  }, []);

  const signInWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signOutUser = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, isTeacher, signInWithEmail, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function initNgoSettings() {
  const ref = doc(db, 'ngo_settings', 'global');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      currentPhase:    0,
      perStudentAmount: 0,
      phase3Open:       false,
      phase3Locked:     false,
      suggestedAmount:  0,
      teachers:         [TEACHER_EMAIL],
      createdAt:        serverTimestamp(),
    });
  }
}
