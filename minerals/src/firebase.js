// src/firebase.js
// Firebase v9 modular SDK — Firestore only (no Auth)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace placeholder values with your Firebase project credentials
// Found in Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "mcrae-assignments-ca.firebaseapp.com",
  projectId: "mcrae-assignments-ca",
  storageBucket: "mcrae-assignments-ca.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
