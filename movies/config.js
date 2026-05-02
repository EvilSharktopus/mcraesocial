// Fill in your Firebase project config here.
// Find it in Firebase Console → Project Settings → Your apps → SDK setup.
const CONFIG = {
  firebase: {
    apiKey:            'YOUR_API_KEY',
    authDomain:        'YOUR_PROJECT.firebaseapp.com',
    projectId:         'YOUR_PROJECT_ID',
    storageBucket:     'YOUR_PROJECT.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId:             'YOUR_APP_ID',
  },
  tmdb: {
    // Free key at https://www.themoviedb.org/settings/api — used for movie posters.
    apiKey: 'YOUR_TMDB_API_KEY',
  },
  deadline: new Date('2026-05-08T00:00:00'), // picks lock at midnight May 8
  adminPassword: 'YOUR_ADMIN_PASSWORD',
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
