import React, { useState, useEffect, useMemo } from 'react';
import { Team, User, UserRole } from './types';
import { MOCK_TEAMS } from './constants';
import { authService } from './authService';
import { db, messaging } from './firebaseConfig'; // 🟢 הוספנו את messaging
import AdminLeagueManager from './AdminLeagueManager';
import AdminSettings from './AdminSettings';
import FixturesTab from './components/FixturesTab';
import LiveArena from './components/LiveArena';
import LineupManager from './components/LineupManager';
import LoginScreen from './components/LoginScreen';
import SocialFeed from './components/SocialFeed'; 
import CupTab from './components/CupTab';
import { Home, Users, Zap, Trophy, Calendar, Settings, BarChart3, RefreshCcw, Bell } from 'lucide-react'; // 🟢 הוספנו את Bell
import { collection, onSnapshot, doc, setDoc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { getToken } from 'firebase/messaging'; // 🟢 הוספנו את getToken

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'live' | 'lineup' | 'table' | 'fixtures' | 'settings' | 'cup'>('home');
  const [teams, setTeams] = useState<Team[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // 🟢 התיקון: ערך התחלתי שונה ל-27 🟢
  const [currentRound, setCurrentRound] = useState(27);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 🟢 סטייט חדש ששומר את מצב ההתראות של המשתמש
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported');

  const forceHardRefresh = () => {
    setIsRefreshing(true);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = window.location.pathname + '?refresh=' + new Date().getTime();
  };

  const isEran = loggedInUser?.email?.toLowerCase() === 'eranyy@gmail.com' || loggedInUser?.role === UserRole.ADMIN || loggedInUser?.role === UserRole.SUPER_ADMIN;
  const displayName = isEran ? 'ערן' : (loggedInUser?.name || '');

  // 🟢 הלוגיקה החכמה של התראות הפוש 🟢
  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission as any);

      // אם המשתמש כבר אישר התראות בעבר, ניקח לו את הטוקן באופן שקט מאחורי הקלעים
      if (Notification.permission === 'granted' && loggedInUser) {
        const fetchSilentToken = async () => {
          try {
            const token = await getToken(messaging, { vapidKey: "BELPkm_Y6IgLW-atBkxPKAyXnUbMagpKIuNF7oQkPLu8XdtzYXcUWD6yGIgqdLguY-OAOyZbJKV8Usm5Yi89emQ" });
            if (token) {
              await setDoc(doc(db, "users", loggedInUser.id), { fcmToken: token }, { merge: true });
            }
          } catch (e) {
            console.error("Silent token fetch failed", e);
          }
        };
        fetchSilentToken();
      }
    }
  }, [loggedInUser]);

  // 🟢 פונקציה שמופעלת כשהמשתמש לוחץ על כפתור הפעמון החדש 🟢
  const handleRequestPush = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission as any);

      if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: "BELPkm_Y6IgLW-atBkxPKAyXnUbMagpKIuNF7oQkPLu8XdtzYXcUWD6yGIgqdLguY-OAOyZbJKV8Usm5Yi89emQ" });
        if (token && loggedInUser) {
          await setDoc(doc(db, "users", loggedInUser.id), { fcmToken: token }, { merge: true });
          alert('מעולה! ההתראות הופעלו בהצלחה 🔔');
        }
      } else {
        alert('סירבת לקבלת התראות. אם תתחרט, תוכל לשנות זאת בהגדרות הדפדפן (סמל המנעול).');
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!loggedInUser) return;

    const recordPresence = async () => {
      try {
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const presenceDocId = isEran ? 'admin_eran' : loggedInUser.id;

        await setDoc(doc(db, 'presence', presenceDocId), {
          name: displayName,
          lastSeen: serverTimestamp(),
          teamName: loggedInUser.teamName
        }, { merge: true });

        const lastLogTime = sessionStorage.getItem('last_radar_log');
        const now = Date.now();
        if (!lastLogTime || now - Number(lastLogTime) > 30 * 60 * 1000) {
           await addDoc(collection(db, 'login_logs'), {
             name: displayName,
             email: loggedInUser.email || 'N/A',
             teamName: loggedInUser.teamName,
             deviceType: isMobileDevice ? 'Mobile' : 'Desktop',
             timestamp: new Date().toISOString()
           });
           sessionStorage.setItem('last_radar_log', now.toString());
        }
      } catch (e) {
        console.error("Error updating presence/radar:", e);
      }
    };

    recordPresence();
    const interval = setInterval(recordPresence, 30000);
    return () => clearInterval(interval);
  }, [loggedInUser, displayName, isEran]);

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClearDate = localStorage.getItem('last_cache_clear_date');
    if (lastClearDate !== today) {
        localStorage.removeItem('luzon_last_team_id');
        localStorage.setItem('last_cache_clear_date', today);
    }

    const fallbackTimer = setTimeout(() => setIsInitializing(false), 2000);
    try {
      const unsubTeams = onSnapshot(collection(db, "users"), (snapshot) => { 
        const loadedTeams = snapshot.docs.map(d => d.data() as Team);
        setTeams(loadedTeams); 
        
        setLoggedInUser(prev => {
           if (!prev) return prev;
           const dbRecord = loadedTeams.find(t => t.id === prev.id) as any; 
           
           if (dbRecord) {
               const newName = dbRecord.name || dbRecord.manager || prev.name;
               const newTeamName = dbRecord.teamName || prev.teamName;
               if (newName !== prev.name || newTeamName !== prev.teamName) {
                   return { ...prev, name: newName, teamName: newTeamName };
               }
           }
           return prev;
        });
      });

      const unsubSettings = onSnapshot(doc(db, "leagueData", "settings"), (docSnap) => {
        if(docSnap.exists() && docSnap.data().currentRound) setCurrentRound(docSnap.data().currentRound);
        else setDoc(doc(db, "leagueData", "settings"), { currentRound: 27 });
      });

      const init = async () => {
        const user = authService.getSession();
        if (user) setLoggedInUser(user);
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          if (usersSnap.empty) { for (const team of MOCK_TEAMS) await setDoc(doc(db, "users", team.id), team); }
        } catch (err) {
          console.error("Error initializing teams:", err);
        }
        clearTimeout(fallbackTimer);
        setIsInitializing(false);
      };
      init();
      return () => { unsubTeams(); unsubSettings(); clearTimeout(fallbackTimer); };
    } catch (e) { clearTimeout(fallbackTimer); setIsInitializing(false); }
  }, []);

  const handleLogout = () => {
    if(window.confirm('להתנתק מהמערכת?')) {
      authService.logout();
      setLoggedInUser(null);
      sessionStorage.removeItem('last_radar_log');
    }
  };

  const isModerator = isEran || loggedInUser?.role === UserRole.MODERATOR || loggedInUser?.role === 'ARENA_MANAGER';

  const availableTabs = useMemo(() => {
    if (!loggedInUser) return [];
    
    return [
      {id: 'home', icon: <Home className="w-6 h-6" />, label: 'ראשי'},
      {id: 'lineup', icon: <Users className="w-6 h-6" />, label: 'הרכב'},
      {id: 'live', icon: <Zap className="w-6 h-6" />, label: 'זירה'}, 
      {id: 'table', icon: <BarChart3 className="w-6 h-6" />, label: 'טבלה'}, 
      {id: 'fixtures', icon: <Calendar className="w-6 h-6" />, label: 'משחקים'},
      {id: 'cup', icon: <Trophy className="w-6 h-6" />, label: 'גביע'}, 
      ...(isEran ? [{id: 'settings', icon: <Settings className="w-6 h-6" />, label: 'הגדרות'}] : [])
    ];
  }, [loggedInUser, isEran]);

  if (isInitializing) return <div className="h-screen bg-[#0B1120] flex items-center justify-center font-black text-green-500 animate-pulse text-4xl italic">LUZON 13</div>;
  if (!loggedInUser) return <LoginScreen onLogin={setLoggedInUser} />;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col pb-28 font-sans bg-[#0B1120] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-[#020617]" dir="rtl">
      
      <header className="h-[72px] bg-[#0B1120]/70 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-[100] shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-black italic text-3xl tracking-tighter drop-shadow-lg text-white">LUZON <span className="text-green-500">13</span></span>
          <div className="h-4 w-[1px] bg-white/20 hidden sm:block"></div>
          <span className="text-[10px] font-black bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1 rounded-full uppercase tracking-widest hidden sm:flex items-center gap-1 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
            מחזור {currentRound}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-black text-white leading-tight">{loggedInUser.teamName}</div>
            <div className="text-[11px] font-bold text-slate-400">{displayName}</div>
          </div>
          
          {/* 🟢 כפתור אישור התראות שמופיע רק למי שעוד לא אישר 🟢 */}
          {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
            <button
              onClick={handleRequestPush}
              className="bg-green-500/10 hover:bg-green-500/30 text-green-400 p-2 md:px-4 md:py-2 rounded-xl text-sm font-bold transition-all border border-green-500/30 flex items-center gap-2 shadow-sm animate-pulse"
              title="הפעל התראות"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden md:inline">הפעל התראות</span>
            </button>
          )}

          <button 
             onClick={forceHardRefresh} 
             disabled={isRefreshing}
             title="רענן נתונים (אם חסרה קבוצה)"
             className="bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 p-2 rounded-xl transition-all border border-blue-500/30 flex items-center justify-center shadow-sm active:scale-95"
          >
            <RefreshCcw className={`w-4 h-4 sm:w-5 sm:h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={handleLogout} className="bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 p-2 md:px-4 md:py-2 rounded-xl text-sm font-bold transition-all border border-transparent hover:border-red-500/30 flex items-center gap-2 shadow-sm">
            <span className="hidden md:inline">התנתק</span> 🚪
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-x-hidden p-4 md:p-8 relative z-10">
        {activeTab === 'home' && <SocialFeed teams={teams} currentRound={currentRound} loggedInUser={{...loggedInUser, name: displayName}} onNavigate={() => setActiveTab('table')} />}
        {activeTab === 'live' && <LiveArena currentRound={currentRound} teams={teams} isModerator={isModerator} loggedInUser={{...loggedInUser, name: displayName}} />}
        {activeTab === 'lineup' && <LineupManager teams={teams} loggedInUser={{...loggedInUser, name: displayName}} currentRound={currentRound} isAdmin={isEran} />}
        {activeTab === 'fixtures' && <FixturesTab currentRound={currentRound} isAdmin={isEran} />}
        {activeTab === 'table' && <div className="max-w-4xl mx-auto"><AdminLeagueManager isAdmin={isEran} inline={true} initialSubTab="table" /></div>}
        {activeTab === 'settings' && <AdminSettings onClose={() => setActiveTab('home')} isAdmin={isEran} />}
        {activeTab === 'cup' && <CupTab />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 w-full bg-[#0B1120]/90 backdrop-blur-2xl border-t border-white/5 px-2 pb-[env(safe-area-inset-bottom)] z-[100]">
         <div className="max-w-md mx-auto flex items-center justify-between h-[84px] relative">
            {availableTabs.map(tab => {
              const isActive = activeTab === tab.id;
              const isCup = tab.id === 'cup';

              return (
                <button 
                  key={tab.id} 
                  onClick={() => setActiveTab(tab.id as any)} 
                  className="flex flex-col items-center justify-center w-14 h-full transition-all duration-300 outline-none group gap-1.5 pt-1"
                >
                  <div className={`transition-all duration-300 ${isActive ? `-translate-y-1 scale-110 ${isCup ? 'text-yellow-400' : 'text-white'}` : `text-slate-500 group-hover:-translate-y-1 group-active:scale-90 ${isCup ? 'group-hover:text-yellow-400' : 'group-hover:text-slate-300'}`}`}>
                    {tab.icon}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${isActive ? `opacity-100 -translate-y-0.5 ${isCup ? 'text-yellow-400' : 'text-green-400'}` : `opacity-60 text-slate-400 group-hover:opacity-100 ${isCup ? 'group-hover:text-yellow-400' : 'group-hover:text-white'}`}`}>
                    {tab.label}
                  </span>
                  {isActive && <div className={`absolute bottom-1.5 w-1 h-1 rounded-full ${isCup ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'}`}></div>}
                </button>
              );
            })}
         </div>
      </nav>
    </div>
  );
};

export default App;