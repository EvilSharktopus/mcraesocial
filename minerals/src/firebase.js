// src/firebase.js
// Firebase v9 modular SDK — Firestore only (no Auth)
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace placeholder values with your Firebase project credentials
// Found in Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: "AIzaSyB4Yc51IzKEcBzDPqy3B8fA9QSrnhIAzr4",
  authDomain: "mcrae-assignments-ca.firebaseapp.com",
  projectId: "mcrae-assignments-ca",
  storageBucket: "mcrae-assignments-ca.firebasestorage.app",
  messagingSenderId: "770513837101",
  appId: "1:770513837101:web:6614415cf1e9fcd5afaca4"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
