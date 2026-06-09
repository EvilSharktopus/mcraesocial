// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

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
export const db   = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
