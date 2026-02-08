import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // השורה הזו מייבאת את השירות

const firebaseConfig = {
  apiKey: "AIzaSyAYU35Cc-mewf1WAHjHUAcmq1ATntoU9YI",
  authDomain: "fantasy-luzon.firebaseapp.com",
  projectId: "fantasy-luzon",
  storageBucket: "fantasy-luzon.firebasestorage.app",
  messagingSenderId: "759769754748",
  appId: "1:759769754748:web:6e402c85c5bb4f9a3dadf9",
  measurementId: "G-D89L2G5PHL"
};

const app = initializeApp(firebaseConfig);

// השורה הזו היא המנוע של הטבלה! בלי זה Firestore לא זמין
export const db = getFirestore(app); 
export default app;
