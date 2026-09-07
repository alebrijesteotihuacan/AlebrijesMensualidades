import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDpZSUeqyUrphkkd5-uExrfPCW8hOXjAng",
  authDomain: "alebrijesmensualidad.firebaseapp.com",
  projectId: "alebrijesmensualidad",
  storageBucket: "alebrijesmensualidad.firebasestorage.app",
  messagingSenderId: "723479445855",
  appId: "1:723479445855:web:462258fa9615f228c736ea"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
