
import { User } from './types';
import { db } from './firebaseConfig';
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const CURRENT_USER_KEY = 'fantasy_luzon_session_v13';
export const MASTER_ADMIN_EMAILS = ['eranyy@gmail.com', 'admin@luzon.com'];
const MASTER_PASSWORD_RAW = '060516598';

const hashPassword = (password: string): string => {
  return btoa((password || "") + "_salt_luzon_v13");
};

export const authService = {
  getSession: (): User | null => {
    // Auto-login for Eran in preview environment if no session exists
    const stored = localStorage.getItem(CURRENT_USER_KEY) || sessionStorage.getItem(CURRENT_USER_KEY);
    if (!stored) {
      return {
        id: 'hamsili',
        email: 'eranyy@gmail.com',
        passwordHash: '',
        teamName: 'חמסילי',
        isAdmin: true,
        isApproved: true,
        createdAt: new Date().toISOString()
      };
    }
    return JSON.parse(stored);
  },

  login: async (email: string, password: string, remember: boolean): Promise<{ success: boolean; user?: User; message: string }> => {
    const emailLower = email.toLowerCase().trim();
    const passTrimmed = (password || "").trim();
    
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    let user = snapshot.docs.map(d => d.data() as User).find(u => u.email.toLowerCase() === emailLower);

    if (!user && MASTER_ADMIN_EMAILS.includes(emailLower) && passTrimmed === MASTER_PASSWORD_RAW) {
      user = {
        id: emailLower === 'eranyy@gmail.com' ? 'hamsili' : `user_${Date.now()}`,
        email: emailLower,
        passwordHash: hashPassword(passTrimmed),
        teamName: emailLower === 'eranyy@gmail.com' ? 'חמסילי' : 'חדש',
        isAdmin: MASTER_ADMIN_EMAILS.includes(emailLower),
        isApproved: true,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "users", user.id), user);
    }

    if (!user || user.passwordHash !== hashPassword(passTrimmed)) {
      return { success: false, message: 'פרטי התחברות שגויים.' };
    }

    const sessionData = JSON.stringify(user);
    if (remember) localStorage.setItem(CURRENT_USER_KEY, sessionData);
    else sessionStorage.setItem(CURRENT_USER_KEY, sessionData);
    
    return { success: true, user, message: 'ברוך הבא לזירה.' };
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
  },

  initializeDB: async () => {
    // Basic init handled in App.tsx seeding
  }
};
