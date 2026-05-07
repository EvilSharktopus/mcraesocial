// Fill in your Firebase project config here.
// Find it in Firebase Console → Project Settings → Your apps → SDK setup.
const CONFIG = {
  firebase: {
    apiKey:            'AIzaSyBLaQWGOpqm-W1GhCKpFht96hKb8epgyno',
    authDomain:        'movies-1999c.firebaseapp.com',
    projectId:         'movies-1999c',
    storageBucket:     'movies-1999c.firebasestorage.app',
    messagingSenderId: '527350112307',
    appId:             '1:527350112307:web:9a0f9be884a356c7680346',
  },
  tmdb: {
    // Free key at https://www.themoviedb.org/settings/api — used for movie posters.
    apiKey: 'YOUR_TMDB_API_KEY',
  },
  apify: {
    // Free token at https://console.apify.com/account/integrations
    token: 'YOUR_APIFY_TOKEN', // ← paste locally for manual sync; do NOT commit
  },
  deadline: new Date('2026-05-07T18:00:00Z'), // picks lock at noon MDT (12:00pm) May 7
  adminPassword: 'Starss22',
};

// Firestore security rules to paste into Firebase Console → Firestore → Rules:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /{document=**} {
//       allow read, write: if true;
//     }
//   }
// }
//
// Storage rules (Firebase Console → Storage → Rules):
//
// rules_version = '2';
// service firebase.storage {
//   match /b/{bucket}/o {
//     match /{allPaths=**} {
//       allow read, write: if true;
//     }
//   }
// }
