import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// הקונפיגורציה האמיתית שלך - המפתחות בפנים!
const firebaseConfig = {
  apiKey: "AIzaSyAYU35Cc-mewf1WAHjHUAcmq1ATntoU9YI",
  authDomain: "fantasy-luzon.firebaseapp.com",
  projectId: "fantasy-luzon",
  storageBucket: "fantasy-luzon.firebasestorage.app",
  messagingSenderId: "759769754748",
  appId: "1:759769754748:web:6e402c85c5bb4f9a3dadf9",
  measurementId: "G-D89L2G5PHL"
};

// אתחול Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// יצירת חיבור ל-Firestore וייצוא שלו לשימוש בשאר האפליקציה
export const db = getFirestore(app);
export default app;
