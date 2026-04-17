import React, { useState } from 'react';
import { collection, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getToken } from 'firebase/messaging';
import { db, auth, messaging } from '../firebaseConfig';
import { authService } from '../authService';

interface LoginScreenProps {
  onLogin: (user: any) => void;
}

// פונקציית הרדאר לזיהוי המכשיר
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return 'Mobile';
  return 'Desktop (PC)';
};

// פונקציה לבקשת אישור התראות פוש ושמירת הטוקן
const requestPushPermission = async (userId: string) => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      console.log("המשתמש אישר קבלת התראות!");
      
      const token = await getToken(messaging, {
        vapidKey: "BELPkm_Y6IgLW-atBkxPKAyXnUbMagpKIuNF7oQkPLu8XdtzYXcUWD6yGIgqdLguY-OAOyZbJKV8Usm5Yi89emQ" 
      });

      if (token) {
        console.log("Token: ", token);
        // שמירת הטוקן במסד הנתונים תחת המשתמש
        await setDoc(doc(db, "users", userId), {
          fcmToken: token 
        }, { merge: true });
      }
    } else {
      console.log("המשתמש סירב לקבל התראות.");
    }
  } catch (error) {
    console.error("שגיאה בהפעלת התראות:", error);
  }
};

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('נא להזין אימייל וסיסמה');
      return;
    }

    setLoading(true);
    setError('');

    // מורידים רווחים מההתחלה ומהסוף (גם באימייל וגם בסיסמה) והופכים לאותיות קטנות
    const inputEmail = email.toLowerCase().trim();
    const inputPassword = password.trim();
    
    console.log(`[Login Attempt] Email: ${inputEmail}`);

    try {
      // 1. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, inputEmail, inputPassword);
      const user = userCredential.user;
      console.log(`[Login Success] Firebase Auth UID: ${user.uid}`);

      // 2. Sync with Firestore to get team data
      const usersSnap = await getDocs(collection(db, 'users'));
      let foundUser: any = null;

      usersSnap.forEach(doc => {
        const data = doc.data();
        
        // בדיקה אם זה המנג'ר הראשי
        if (data.email?.toLowerCase().trim() === inputEmail) {
          foundUser = { id: doc.id, teamId: doc.id, name: data.manager, email: data.email, teamName: data.teamName, role: data.role || 'USER' };
        } 
        // בדיקה אם זה עוזר המאמן
        else if (data.assistantEmail?.toLowerCase().trim() === inputEmail) {
          foundUser = { id: doc.id, teamId: doc.id, name: `עוזר מאמן - ${data.teamName}`, email: data.assistantEmail, teamName: data.teamName, role: 'USER' };
        }
        // בדיקה אם זה אחד מעוזרי המאמן (מערך)
        else if (data.assistants && Array.isArray(data.assistants)) {
          const assistant = data.assistants.find((a: any) => a.email?.toLowerCase().trim() === inputEmail);
          if (assistant) {
            foundUser = { id: doc.id, teamId: doc.id, name: assistant.name, email: assistant.email, teamName: data.teamName, role: 'USER' };
          }
        }
      });

      if (foundUser) {
        
        // --- מערכת מעקב התחברויות (Radar) ---
        try {
            await addDoc(collection(db, 'login_logs'), {
                uid: user.uid,
                email: foundUser.email,
                name: foundUser.name,
                teamName: foundUser.teamName,
                role: foundUser.role,
                deviceType: getDeviceType(),
                timestamp: new Date().toISOString()
            });
        } catch (logError) {
            console.error("Failed to save login tracking log", logError);
        }
        // ------------------------------------

        authService.login(foundUser, rememberMe);
        onLogin(foundUser);
        
        // <<< הפעלת הבקשה לקבלת התראות פוש ושמירת הטוקן >>>
        requestPushPermission(foundUser.id);
        
      } else {
        console.warn(`[Login Warning] User ${inputEmail} authenticated but not found in Firestore 'users' collection.`);
        setError('המשתמש אומת אך לא נמצאה קבוצה תואמת במערכת. פנה למנהל.');
      }
    } catch (err: any) {
      console.error(`[Login Error] Code: ${err.code}, Message: ${err.message}`);
      
      let errorMessage = 'שגיאת התחברות. אנא נסה שוב.';
      
      switch (err.code) {
        case 'auth/user-not-found':
          errorMessage = 'משתמש לא קיים במערכת. ודא שהאימייל נכון.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'סיסמה שגויה. נסה שוב או פנה למנהל לאיפוס.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'כתובת אימייל לא תקינה.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'חשבון זה הושבת. פנה למנהל הליגה.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'יותר מדי ניסיונות כושלים. החשבון נחסם זמנית, נסה שוב מאוחר יותר.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'שגיאת רשת. בדוק את החיבור לאינטרנט.';
          break;
        default:
          errorMessage = `שגיאה: ${err.code || 'מערכת'}. אנא נסה שוב.`;
      }

      setError(errorMessage);

      // תיעוד שגיאה ב-Firestore
      try {
        await addDoc(collection(db, 'login_errors'), {
          email: inputEmail,
          errorCode: err.code || 'unknown',
          errorMessage: err.message,
          timestamp: new Date().toISOString()
        });
      } catch (logErr) {
        console.error("Failed to log error to Firestore:", logErr);
      }
    }
    setLoading(false);
  };

  const handleHelp = (type: string) => {
    if (type === 'new') alert('ברוך הבא לפנטזי לוזון! ⚽\nהמערכת סגורה להרשמה חופשית.\nנא לפנות למנהל הליגה (ערן) כדי לפתוח קבוצה חדשה.');
    if (type === 'forgot') alert('שכחת סיסמה? לא נורא.\nפנה למנהל הליגה (ערן) בווצאפ והוא יאפס לך את הסיסמה בשנייה מתוך פאנל הניהול.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-['Assistant'] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-slate-950 px-4" dir="rtl">
      
      <div className="bg-slate-900/90 backdrop-blur-md p-8 md:p-12 rounded-[40px] border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.15)] w-full max-w-md">
        
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white italic tracking-tighter mb-2">LUZON <span className="text-green-500">13</span></h1>
          <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">ניהול ליגת פנטזי מקצועית</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 ml-1">אימייל (מנג'ר / עוזר מאמן)</label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-green-500 transition-colors"
              placeholder="email@example.com"
              dir="ltr"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 ml-1">סיסמה</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-slate-700 p-4 rounded-2xl text-white outline-none focus:border-green-500 transition-colors"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-5 h-5 accent-green-500" 
              />
              <span className="text-sm text-slate-300 font-bold">זכור אותי מחובר</span>
            </label>
            
            <button type="button" onClick={() => handleHelp('forgot')} className="text-xs text-green-500 hover:text-green-400 font-bold">שכחתי סיסמה</button>
          </div>

          {error && <div className="bg-red-950/50 border border-red-500/50 text-red-400 p-3 rounded-xl text-center text-sm font-bold animate-in fade-in">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 text-black font-black text-xl py-4 rounded-2xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all hover:scale-[1.02]"
          >
            {loading ? 'מתחבר למגרש...' : 'היכנס לזירה ⚡'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-800 pt-6">
          <p className="text-slate-400 text-sm">עדיין לא בליגה?</p>
          <button type="button" onClick={() => handleHelp('new')} className="text-white font-black mt-2 hover:text-green-400 transition-colors">בקש לפתוח קבוצה חדשה ➔</button>
        </div>

      </div>
    </div>
  );
};

export default LoginScreen;