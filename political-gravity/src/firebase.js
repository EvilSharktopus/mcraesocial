// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            "AIzaSyB4Yc51IzKEcBzDPqy3B8fA9QSrnhIAzr4",
  authDomain:        "mcrae-assignments-ca.firebaseapp.com",
  projectId:         "mcrae-assignments-ca",
  storageBucket:     "mcrae-assignments-ca.firebasestorage.app",
  messagingSenderId: "770513837101",
  appId:             "1:770513837101:web:6614415cf1e9fcd5afaca4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Offline persistence: writes made while the school wifi drops are queued in
// IndexedDB and sent when the connection returns — even if the tab was closed
// in between. The multi-tab manager lets a student have two tabs open without
// one of them losing persistence. If IndexedDB is unavailable the SDK logs a
// warning and falls back to an in-memory cache; nothing breaks.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
