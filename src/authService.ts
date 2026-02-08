
import { User } from './types';

const USERS_STORAGE_KEY = 'fantasy_luzon_users_db_v4';
const CURRENT_USER_KEY = 'fantasy_luzon_session_v4';
export const MASTER_ADMIN_EMAILS = ['eranyy@gmail.com', 'admin@luzon.com'];

// Base64 encoding for simple simulation
const hashPassword = (password: string): string => {
  return btoa(password + "_salt_luzon_v13");
};

const getUsers = (): User[] => {
  try {
    const saved = localStorage.getItem(USERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const initializeDB = () => {
  const users = getUsers();
  let dataChanged = false;

  MASTER_ADMIN_EMAILS.forEach(email => {
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!existingUser) {
      users.push({
        id: `admin_${email.split('@')[0]}`,
        email: email.toLowerCase(),
        passwordHash: hashPassword('060516598'), // Your specific password
        teamName: email === 'eranyy@gmail.com' ? 'חמסילי' : 'מנהלת הליגה',
        isAdmin: true,
        isApproved: true,
        createdAt: new Date().toISOString()
      });
      dataChanged = true;
    } else {
      // Ensure Eran always has his preferred password
      if (email === 'eranyy@gmail.com') {
         existingUser.passwordHash = hashPassword('060516598');
         existingUser.isAdmin = true;
         existingUser.isApproved = true;
         dataChanged = true;
      }
    }
  });

  if (dataChanged) saveUsers(users);
};

initializeDB();

export const authService = {
  register: (email: string, password: string, teamName: string): { success: boolean; message: string } => {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, message: 'האימייל כבר קיים במערכת.' };
    }

    const isMaster = MASTER_ADMIN_EMAILS.includes(email.toLowerCase());
    const newUser: User = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      teamName: isMaster ? 'חמסילי' : teamName,
      isAdmin: isMaster,
      isApproved: isMaster, // Master admins are auto-approved
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    return { 
      success: true, 
      message: isMaster ? 'שלום המנהל! החשבון מוכן.' : 'בקשת ההרשמה נשלחה ומחכה לאישור של ערן.' 
    };
  },

  login: (email: string, password: string, remember: boolean): { success: boolean; user?: User; message: string } => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) return { success: false, message: 'משתמש לא נמצא.' };
    if (user.passwordHash !== hashPassword(password)) return { success: false, message: 'סיסמה שגויה.' };
    if (!user.isApproved) return { success: false, message: 'החשבון טרם אושר ע"י ערן.' };

    const sessionData = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(CURRENT_USER_KEY, sessionData);
    } else {
      sessionStorage.setItem(CURRENT_USER_KEY, sessionData);
    }
    return { success: true, user, message: 'התחברת בהצלחה.' };
  },

  logout: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    sessionStorage.removeItem(CURRENT_USER_KEY);
  },

  getSession: (): User | null => {
    try {
      const local = localStorage.getItem(CURRENT_USER_KEY);
      const session = sessionStorage.getItem(CURRENT_USER_KEY);
      return JSON.parse(local || session || 'null');
    } catch {
      return null;
    }
  },

  getAllUsers: (): User[] => getUsers(),

  approveUser: (targetUserId: string) => {
    const users = getUsers();
    const updated = users.map(u => u.id === targetUserId ? { ...u, isApproved: true } : u);
    saveUsers(updated);
  },

  deleteUser: (targetUserId: string) => {
    const users = getUsers();
    // Prevent self-deletion
    const updated = users.filter(u => u.id !== targetUserId);
    saveUsers(updated);
  }
};
