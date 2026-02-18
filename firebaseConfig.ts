
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

/**
 * הגדרות Firebase - פנטזי לוזון עונה 13
 * פרויקט: fantasy-luzon
 */
const firebaseConfig = {
  apiKey: "AIzaSyAYU35Cc-mewf1WAHjHUAcmq1ATntoU9YI",
  authDomain: "fantasy-luzon.firebaseapp.com",
  projectId: "fantasy-luzon",
  storageBucket: "fantasy-luzon.firebasestorage.app",
  messagingSenderId: "759769754748",
  appId: "1:759769754748:web:6e402c85c5bb4f9a3dadf9",
  measurementId: "G-D89L2G5PHL"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * אתחול Firestore עם הגדרות עקיפת חסימות (Long Polling)
 * החיבור מתבצע אוטומטית ל-Database שנקרא (default)
 */
// Fixed: Removed 'useFetchStreams' which is not a valid property in FirestoreSettings for modular SDK
// This also fixes the overload mismatch error.
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

export { db };
