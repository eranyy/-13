import React, { useState, useEffect, useMemo } from 'react';
import { Team, Player, User, Substitution } from './types';
import { MOCK_TEAMS, VALID_FORMATIONS, LEAGUE_TABLE, ISRAELI_TEAMS } from './constants';
import { generateRazColumn, getScoutingReport } from './geminiService';
import { authService } from './authService';

// --- חיבור ל-FIREBASE ---
import { db } from './firebaseConfig';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// מפתח לגיבוי מקומי
const FINAL_LUZON_KEY = 'LUZON_DATABASE_V50_STABLE';

const getPosColor = (pos: string) => {
  switch (pos) {
    case 'GK': return 'bg-yellow-400 border-yellow-600 text-black';
    case 'DEF': return 'bg-blue-600 border-blue-800 text-white';
    case 'MID': return 'bg-emerald-600 border-emerald-800 text-white';
    case 'FWD': return 'bg-rose-600 border-rose-900 text-white';
    default: return 'bg-slate-400 border-slate-600 text-black';
  }
};

const Card: React.FC<{ title: string; children: React.ReactNode; className?: string; icon?: string; dark?: boolean; onClick?: (e: React.MouseEvent) => void }> = ({ title, children, className = "", icon, dark = false, onClick }) => (
  <div onClick={onClick} className={`${dark ? 'bg-slate-900/95 border-slate-700 text-white shadow-2xl' : 'bg-white border-gray-100 text-slate-800'} rounded-[40px] p-8 border backdrop-blur-md ${className} transition-all`}>
    <h3 className="text-2xl font-black mb-6 flex items-center gap-3 border-b border-slate-800/10 pb-3">
      {icon && <span className="text-3xl">{icon}</span>} {title}
    </h3>
    {children}
  </div>
);

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'lineup' | 'market'>('dashboard');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [razColumn, setRazColumn] = useState('טוען...');

  // Market States
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editValues, setEditValues] = useState<Substitution & { realTeam?: string } | null>(null);

  // Scouting State
  const [isScoutingLoading, setIsScoutingLoading] = useState(false);
  const [scoutingReport, setScoutingReport] = useState<{ text: string; sources: any[] } | null>(null);
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  // --- טעינה וסנכרון מול ה-FIREBASE (זמן אמת) ---
  useEffect(() => {
    const docRef = doc(db, "league", "teamsData");
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data().teams;
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          setTeams(cloudData);
          console.log("נתונים נטענו מהענן ☁️");
        }
      } else {
        console.log("אין נתונים בענן, משתמש בנתוני ברירת מחדל");
      }
    });

    return () => unsubscribe();
  }, []);

  // גיבוי מקומי ליתר ביטחון
  useEffect(() => {
    localStorage.setItem(FINAL_LUZON_KEY, JSON.stringify(teams));
  }, [teams]);

  // Load Session
  useEffect(() => {
    const session = authService.getSession();
    if (session) {
      setLoggedInUser(session);
      const team = teams.find(t => t.teamName === session.teamName);
      if (team) setSelectedTeamId(team.id);
      else setSelectedTeamId(teams[0].id);
    }
  }, [teams.length]); // מופעל רק כשהסגל נטען

  // AI Content
  useEffect(() => {
    if (loggedInUser) generateRazColumn().then(setRazColumn);
  }, [loggedInUser]);

  const currentViewingTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams[0];
  }, [teams, selectedTeamId]);

  const isUserOwner = useMemo(() => {
    if (!loggedInUser) return false;
    return loggedInUser.isAdmin || loggedInUser.teamName === currentViewingTeam.teamName;
  }, [loggedInUser, currentViewingTeam]);

  const actualSubsPerformed = currentViewingTeam.substitutions.filter(s => !s.isFreeze).length;
  const subCount = actualSubsPerformed + (currentViewingTeam.subAdjustment || 0);
  const subLimit = currentViewingTeam.subLimit || 14;
  const subProgressPercent = Math.min((subCount / subLimit) * 100, 100);

  const counts = useMemo(() => {
    return {
      DEF: currentViewingTeam.lineup.filter(p => p.position === 'DEF').length,
      MID: currentViewingTeam.lineup.filter(p => p.position === 'MID').length,
      FWD: currentViewingTeam.lineup.filter(p => p.position === 'FWD').length,
      GK: currentViewingTeam.lineup.filter(p => p.position === 'GK').length,
      total: currentViewingTeam.lineup.length
    };
  }, [currentViewingTeam.lineup]);

  const currentFormationStr = `${counts.DEF}-${counts.MID}-${counts.FWD}`;
  const isFormationValid = counts.total === 11 && counts.GK === 1 && VALID_FORMATIONS.includes(currentFormationStr);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const res = authService.login(email, password, true);
    if (res.success) {
      setLoggedInUser(res.user!);
      const team = teams.find(t => t.teamName === res.user?.teamName);
      if (team) setSelectedTeamId(team.id);
    } else setError(res.message);
  };

  // --- פונקציית שמירה חדשה לענן ---
  const manualSave = async () => {
    try {
      const docRef = doc(db, "league", "teamsData");
      await setDoc(docRef, { teams: teams });
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    } catch (e) {
      console.error("שגיאה בשמירה לענן:", e);
      alert("תקלה בשמירה לשרת! בדוק חיבור אינטרנט.");
    }
  };

  const startAddingSub = () => {
    setEditValues({
      id: `sub_${Date.now()}`,
      playerIn: '',
      playerOut: '',
      pos: 'MID',
      date: new Date().toLocaleDateString('he-IL'),
      isFreeze: false,
      realTeam: ''
    });
    setEditingSubId(null);
    setIsAddingNew(true);
  };

  const handleScouting = async (player: Player) => {
    setScoutingPlayer(player);
    setIsScoutingLoading(true);
    try {
      const report = await getScoutingReport(player.name);
      setScoutingReport(report);
    } catch (err) {
      setScoutingReport({ text: "לא ניתן היה להפיק דו\"ח כרגע.", sources: [] });
    } finally {
      setIsScoutingLoading(false);
    }
  };

  const startEditingSub = (sub: Substitution, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValues({ ...sub, realTeam: (sub as any).realTeam || '' });
    setEditingSubId(sub.id);
    setIsAddingNew(false);
  };

  const saveSub = () => {
    if (!editValues) return;
    if (!editValues.playerIn || !editValues.realTeam) {
      alert('חובה למלא שם שחקן וקבוצה!');
      return;
    }

    const nextTeams = teams.map(t => {
      if (t.id !== selectedTeamId) return t;
      const newSubs = [...t.substitutions];
      const newSquad = [...t.squad];
      const subEntry = { ...editValues };

      if (isAddingNew) {
        newSubs.unshift(subEntry);
        const name = editValues.playerIn.trim();
        if (!newSquad.some(p => p.name.toLowerCase() === name.toLowerCase())) {
          newSquad.push({
            id: `p_${Date.now()}`,
            name: name,
            team: editValues.realTeam || 'ללא קבוצה',
            position: editValues.pos as any,
            isFrozen: editValues.isFreeze
          });
        }
      } else {
        const idx = newSubs.findIndex(s => s.id === editingSubId);
        if (idx !== -1) newSubs[idx] = subEntry;
      }
      return { ...t, substitutions: newSubs, squad: newSquad };
    });

    setTeams(nextTeams);
    setIsAddingNew(false);
    setEditingSubId(null);
    setEditValues(null);
  };

  const deleteSub = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!loggedInUser?.isAdmin) {
      alert('ביזיון! רק הקוממישינר רשאי למחוק.');
      return;
    }

    const sub = currentViewingTeam.substitutions.find(s => s.id === id);
    if (!sub) return;
    if (!window.confirm(`למחוק את ${sub.playerIn}?`)) return;

    const pName = sub.playerIn.trim().toLowerCase();
    const nextTeams = teams.map(t => {
      if (t.id !== selectedTeamId) return t;
      return {
        ...t,
        substitutions: t.substitutions.filter(s => s.id !== id),
        squad: t.squad.filter(p => p.name.toLowerCase() !== pName),
        lineup: t.lineup.filter(p => p.name.toLowerCase() !== pName)
      };
    });

    setTeams(nextTeams);
  };

  const toggleLineup = (player: Player) => {
    if (!isUserOwner) return;
    const isIn = currentViewingTeam.lineup.some(p => p.id === player.id);
    
    setTeams(prev => prev.map(t => {
      if (t.id !== selectedTeamId) return t;
      let newLineup = [...t.lineup];
      if (isIn) {
        newLineup = newLineup.filter(p => p.id !== player.id);
      } else {
        if (player.isFrozen) { alert('השחקן מוקפא!'); return t; }
        if (t.lineup.length >= 11) { alert('המגרש מלא!'); return t; }
        if (player.position === 'GK' && t.lineup.some(p => p.position === 'GK')) { alert('כבר יש שוער!'); return t; }
        newLineup.push(player);
      }
      return { ...t, lineup: newLineup };
    }));
  };

  if (!loggedInUser) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 font-['Heebo']" dir="rtl">
       <Card title="פנטזי לוזון - עונה 13" className="max-w-md w-full" dark>
          <form onSubmit={handleAuth} className="space-y-6">
             {error && <p className="text-red-500 text-center font-bold bg-red-500/10 p-4 rounded-xl">{error}</p>}
             <input type="email" placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-800 rounded-2xl border border-slate-700 focus:border-green-500 outline-none" />
             <input type="password" placeholder="סיסמה" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-slate-800 rounded-2xl border border-slate-700 focus:border-green-500 outline-none" />
             <button type="submit" className="w-full bg-green-500 text-black py-4 rounded-2xl font-black text-xl hover:bg-green-400 transition-all">התחבר</button>
          </form>
       </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-['Assistant']" dir="rtl">
      <nav className="bg-slate-900 border-b border-slate-800 p-6 flex justify-between items-center sticky top-0 z-50">
         <h1 className="text-3xl font-black italic tracking-tighter">LUZON<span className="text-green-500">13</span></h1>
         <div className="flex gap-4">
            {['dashboard', 'lineup', 'market', 'table'].map(tab => (
               <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === tab ? 'bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'text-slate-400 hover:text-white'}`}>
                  {tab === 'dashboard' ? 'דף הבית' : tab === 'lineup' ? 'הרכב' : tab === 'market' ? 'רכש' : 'טבלה'}
               </button>
            ))}
         </div>
         <button onClick={() => { authService.logout(); window.location.reload(); }} className="text-red-500 text-xs font-bold hover:underline">יציאה</button>
      </nav>

      {showSaveSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-12 py-5 rounded-full font-black shadow-2xl animate-bounce border-4 border-white">
          המידע ננעל ונשמר בענן! ☁️✅
        </div>
      )}

      {/* Scouting Modal */}
      {(isScoutingLoading || scoutingReport) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <Card title={`דו"ח סקאוטינג: ${scoutingPlayer?.name}`} icon="🔍" dark className="max-w-2xl w-full max-h-[90vh] overflow-y-auto border-t-8 border-blue-500">
            {isScoutingLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xl font-black text-blue-400 animate-pulse">האנליסט בודק נתונים...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-lg leading-relaxed text-slate-100 whitespace-pre-wrap">{scoutingReport?.text}</p>
                <button onClick={() => { setScoutingReport(null); setScoutingPlayer(null); }} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-black transition-all mt-4 border border-slate-700">סגור</button>
              </div>
            )}
          </Card>
        </div>
      )}

      <main className="max-w-7xl mx-auto mt-10 px-6 pb-20">
        {activeTab === 'market' && (
           <div className="space-y-10 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="מצב חילופים" icon="🔄" dark className="md:col-span-2 border-t-4 border-green-500">
                   <div className="flex justify-between items-end mb-4 text-right">
                      <div>
                         <h4 className="text-4xl font-black text-white leading-tight">בוצעו <span className="text-green-500">{subCount}/{subLimit}</span> חילופים</h4>
                         <p className="text-xs text-blue-400 mt-2">יתרה לעונה: {Math.max(0, subLimit - subCount)}</p>
                      </div>
                      <button onClick={manualSave} className="bg-white text-black px-6 py-4 rounded-3xl font-black text-xs hover:bg-slate-200 transition-all shadow-xl">שמור לענן 💾</button>
                   </div>
                   <div className="w-full bg-slate-800 h-6 rounded-full overflow-hidden border border-slate-700">
                      <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${subProgressPercent}%` }}></div>
                   </div>
                </Card>
              </div>

              <Card title={`רשימת רכש: ${currentViewingTeam.teamName}`} icon="💸" dark className="border-t-8 border-yellow-500">
                <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
                  <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="bg-slate-800 text-white
