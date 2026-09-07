// Firebase configuration — Firestore only (sin Auth ni Storage).
// Reglas de Firestore recomendadas (pegar en la consola de Firebase):
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /{document=**} {
//         allow read, write: if true;
//       }
//     }
//   }
//
// ⚠️ Solo usar en este proyecto personal. NO exponer en producción.

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getFirestore,
}                          from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDpZSUeqyUrphkkd5-uExrfPCW8hOXjAng',
  authDomain:        'alebrijesmensualidad.firebaseapp.com',
  projectId:         'alebrijesmensualidad',
  storageBucket:     'alebrijesmensualidad.firebasestorage.app',
  messagingSenderId: '723479445855',
  appId:             '1:723479445855:web:462258fa9615f228c736ea',
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const COLLECTIONS = Object.freeze({
  players:   'players',
  payments:  'payments',
  categories: 'categories',
});
