
import React, { useState, useEffect, useMemo } from 'react';
import { Team, Player, User, Substitution } from './types';
import { MOCK_TEAMS, VALID_FORMATIONS, LEAGUE_TABLE, ISRAELI_TEAMS } from './constants';
import { generateRazColumn, getScoutingReport } from './geminiService';
import { authService } from './authService';

// Final, stable key for the database
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
  
  // Initialize state from Storage or Constants
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const saved = localStorage.getItem(FINAL_LUZON_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { console.error("Persistence load error", e); }
    return MOCK_TEAMS;
  });
  
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

  // RELIABLE PERSISTENCE: Save to localStorage on every change to 'teams'
  useEffect(() => {
    localStorage.setItem(FINAL_LUZON_KEY, JSON.stringify(teams));
    console.log("DB Saved Automatically", teams);
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
  }, []);

  // AI Content
  useEffect(() => {
    if (loggedInUser) generateRazColumn().then(setRazColumn);
  }, [loggedInUser]);

  const currentViewingTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams[0];
  }, [teams, selectedTeamId]);

  // Reactive ownership check
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

  const manualSave = () => {
    localStorage.setItem(FINAL_LUZON_KEY, JSON.stringify(teams));
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
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

  // Fixed: Added handleScouting function to fetch AI report for a player
  const handleScouting = async (player: Player) => {
    setScoutingPlayer(player);
    setIsScoutingLoading(true);
    try {
      const report = await getScoutingReport(player.name);
      setScoutingReport(report);
    } catch (err) {
      console.error("Scouting error:", err);
      setScoutingReport({ text: "לא ניתן היה להפיק דו\"ח עבור שחקן זה כרגע.", sources: [] });
    } finally {
      setIsScoutingLoading(false);
    }
  };

  // Fixed: Added startEditingSub function to handle editing existing market entries
  const startEditingSub = (sub: Substitution, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValues({
      ...sub,
      realTeam: (sub as any).realTeam || ''
    });
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
      const subEntry = { ...editValues, realTeam: editValues.realTeam };

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
        const oldName = idx !== -1 ? newSubs[idx].playerIn : '';
        if (idx !== -1) newSubs[idx] = subEntry;
        
        const squadIdx = newSquad.findIndex(p => p.name.toLowerCase() === oldName.toLowerCase());
        if (squadIdx !== -1) {
          newSquad[squadIdx] = {
            ...newSquad[squadIdx],
            name: editValues.playerIn.trim(),
            team: editValues.realTeam || 'ללא קבוצה',
            position: editValues.pos as any,
            isFrozen: editValues.isFreeze
          };
        }
      }
      return { ...t, substitutions: newSubs, squad: newSquad };
    });

    setTeams(nextTeams);
    setIsAddingNew(false);
    setEditingSubId(null);
    setEditValues(null);
  };

  // ROBUST DELETE BUTTON HANDLER
  const deleteSub = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!loggedInUser?.isAdmin) {
      alert('ביזיון! רק הקוממישינר רשאי למחוק שחקנים.');
      return;
    }

    const sub = currentViewingTeam.substitutions.find(s => s.id === id);
    if (!sub) return;

    if (!window.confirm(`האם למחוק את "${sub.playerIn}"? הפעולה תסיר אותו מהסגל וההרכב.`)) return;

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
          המידע ננעל ונשמר בשרת! ✅
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
                      <button onClick={manualSave} className="bg-slate-800 border border-slate-700 px-6 py-4 rounded-3xl font-black text-xs hover:bg-slate-700 transition-all">שמור נתונים 💾</button>
                   </div>
                   <div className="w-full bg-slate-800 h-6 rounded-full overflow-hidden border border-slate-700">
                      <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${subProgressPercent}%` }}></div>
                   </div>
                </Card>
              </div>

              <Card title={`רשימת רכש: ${currentViewingTeam.teamName}`} icon="💸" dark className="border-t-8 border-yellow-500">
                <div className="flex justify-between items-center mb-10 gap-4 flex-wrap">
                  <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="bg-slate-800 text-white font-black px-8 py-5 rounded-3xl border border-slate-700 outline-none focus:border-yellow-500 transition-all text-xl shadow-lg">
                    {teams.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}
                  </select>

                  {isUserOwner && (
                    <button onClick={startAddingSub} className="bg-green-500 text-black w-20 h-20 rounded-3xl font-black text-5xl shadow-2xl hover:bg-green-400 transition-all flex items-center justify-center transform active:scale-95">+</button>
                  )}
                </div>

                <div className="space-y-6">
                   {(isAddingNew || editingSubId) && editValues && (
                      <div className="p-8 md:p-12 rounded-[50px] border-4 border-dashed border-green-500 bg-slate-900 shadow-2xl animate-fade-in mb-12">
                         <div className="flex justify-between items-center mb-10">
                            <h4 className="text-3xl font-black text-white">{isAddingNew ? 'החתמה חדשה' : 'עריכת פרטים'}</h4>
                            <div className="flex gap-4">
                               <button onClick={saveSub} className="px-14 py-6 bg-green-500 text-black font-black rounded-3xl hover:bg-green-400 shadow-2xl active:scale-95 transition-all text-2xl">אשר רכש ✅</button>
                               <button onClick={() => { setIsAddingNew(false); setEditingSubId(null); setEditValues(null); }} className="px-10 py-6 bg-slate-800 text-white font-bold rounded-3xl border border-slate-700 hover:bg-slate-700 transition-all">ביטול</button>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                               <div className="space-y-2">
                                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">שחקן יוצא (OUT)</label>
                                  <input className="w-full bg-slate-800 p-6 rounded-3xl text-white border border-slate-700 focus:border-green-500 outline-none text-xl font-bold" value={editValues.playerOut} onChange={e => setEditValues({...editValues, playerOut: e.target.value})} />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-xs font-black text-green-500 uppercase tracking-widest mr-2">שחקן נכנס (IN)</label>
                                  <input className="w-full bg-slate-800 p-6 rounded-3xl text-white border border-green-500/30 focus:border-green-500 outline-none text-3xl font-black" value={editValues.playerIn} onChange={e => setEditValues({...editValues, playerIn: e.target.value})} />
                               </div>
                               <div className="grid grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                     <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">עמדה</label>
                                     <select className="w-full bg-slate-800 p-6 rounded-3xl text-white border border-slate-700 outline-none font-black" value={editValues.pos} onChange={e => setEditValues({...editValues, pos: e.target.value})}>
                                        <option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="FWD">FWD</option>
                                     </select>
                                  </div>
                                  <div className="space-y-2">
                                     <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">תאריך</label>
                                     <input className="w-full bg-slate-800 p-6 rounded-3xl text-white border border-slate-700 outline-none font-bold" value={editValues.date} onChange={e => setEditValues({...editValues, date: e.target.value})} />
                                  </div>
                               </div>
                            </div>
                            
                            <div className="space-y-4">
                               <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-2">קבוצה (מציאות)</label>
                               <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto bg-slate-800/30 p-4 rounded-[40px] border border-slate-700">
                                  {ISRAELI_TEAMS.map(team => (
                                     <button key={team} onClick={() => setEditValues({...editValues, realTeam: team})} className={`p-5 rounded-2xl font-black text-sm text-center border transition-all ${editValues.realTeam === team ? 'bg-green-500 text-black border-green-400 shadow-xl' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}>
                                        {team}
                                     </button>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>
                   )}

                   {currentViewingTeam.substitutions.map(sub => (
                       <div key={sub.id} className="p-8 rounded-[40px] border border-slate-700/50 bg-slate-800/40 shadow-2xl flex justify-between items-center group relative transition-all hover:border-slate-500">
                          {/* DELETE BUTTON - EXPLICIT & ACCESSIBLE */}
                          {loggedInUser?.isAdmin && (
                            <button 
                              onClick={(e) => deleteSub(sub.id, e)}
                              className="absolute top-4 left-4 w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center hover:bg-red-500 shadow-2xl border-2 border-red-400 z-[100] active:scale-90"
                              title="מחק חילוף"
                            >
                              🗑️
                            </button>
                          )}
                          
                          <div className="text-right flex-1">
                             <div className="flex items-center gap-12">
                                <div className="flex flex-col flex-1"><span className="text-[10px] text-slate-600 font-black mb-1 uppercase tracking-widest text-right">OUT</span><span className="font-bold text-2xl text-slate-500 text-right">{sub.playerOut || '---'}</span></div>
                                <span className="text-6xl text-slate-800">⬅️</span>
                                <div className="flex flex-col flex-1">
                                  <span className="text-[10px] text-green-500 font-black mb-1 uppercase tracking-widest text-right">IN</span>
                                  <span className="font-black text-4xl text-white text-right">
                                    {sub.playerIn} 
                                    <span className="text-lg text-blue-400 mr-5 font-bold italic">
                                      ({(sub as any).realTeam || '?'})
                                    </span>
                                  </span>
                                </div>
                             </div>
                             <div className="flex gap-8 mt-8 border-t border-slate-700/30 pt-6 text-xs font-black">
                                <span className={`${getPosColor(sub.pos)} px-5 py-2 rounded-xl shadow-lg`}>{sub.pos}</span>
                                <span className="text-slate-500 bg-slate-900/50 px-5 py-2 rounded-xl border border-slate-800">{sub.date}</span>
                             </div>
                          </div>

                          {isUserOwner && (
                            <button onClick={(e) => startEditingSub(sub, e)} className="mr-6 w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center hover:bg-slate-700 border border-slate-700 transition-opacity opacity-0 group-hover:opacity-100">✏️</button>
                          )}
                       </div>
                   ))}
                </div>
              </Card>
           </div>
        )}

        {activeTab === 'lineup' && (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 animate-fade-in">
              <div className="lg:col-span-3">
                 <Card title={`הרכב רשמי: ${currentViewingTeam.teamName}`} dark className="border-t-8 border-green-600 shadow-2xl overflow-hidden">
                    <div className="flex justify-between mb-8 gap-4 flex-wrap items-center">
                       <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="bg-slate-800 text-white font-black px-6 py-4 rounded-2xl border border-slate-700 flex-1 outline-none text-xl shadow-lg">
                         {teams.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}
                       </select>
                       <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 text-center flex-1">
                          <p className={`text-4xl font-black ${isFormationValid ? 'text-green-400' : 'text-rose-500'}`}>{currentFormationStr}</p>
                          <p className="text-[9px] text-slate-600 mt-1 uppercase font-black">{counts.total}/11 שחקנים</p>
                       </div>
                       <button onClick={manualSave} className="px-12 py-5 bg-white text-black rounded-[32px] font-black text-lg hover:bg-slate-200 shadow-2xl active:scale-95 transition-all border-b-8 border-slate-400">שמור שינויים 💾</button>
                    </div>
                    <div className="w-full h-[850px] relative rounded-[60px] border-[14px] border-slate-800 bg-[#143d22] shadow-2xl overflow-hidden">
                       <div className="absolute top-1/2 w-full h-1.5 bg-white/20 -translate-y-1/2"></div>
                       <div className="absolute inset-0 p-12 flex flex-col justify-around text-center z-10">
                          {['FWD', 'MID', 'DEF', 'GK'].map(pos => (
                            <div key={pos} className="flex justify-around items-center min-h-[160px]">
                               {currentViewingTeam.lineup.filter(p => p.position === pos).map(p => (
                                 <div key={p.id} className="flex flex-col items-center gap-2 group relative">
                                    <button onClick={(e) => { e.stopPropagation(); handleScouting(p); }} className="absolute -top-4 -right-4 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xl z-20 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">i</button>
                                    <div onClick={() => toggleLineup(p)} className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black border-4 cursor-pointer transition-all hover:scale-110 shadow-2xl ${getPosColor(p.position)}`}>{p.name.charAt(0)}</div>
                                    <div className="bg-black/90 px-4 py-2 rounded-full text-[11px] font-black border border-white/20 shadow-xl"><p className="text-white whitespace-nowrap">{p.name}</p></div>
                                 </div>
                               ))}
                            </div>
                          ))}
                       </div>
                    </div>
                 </Card>
              </div>
              <div className="space-y-8">
                 <Card title="סגל השחקנים" icon="⚽" dark className="h-[950px] flex flex-col border-t-4 border-slate-700">
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                       {currentViewingTeam.squad.map(p => {
                         const inLineup = currentViewingTeam.lineup.some(l => l.id === p.id);
                         return (
                           <div key={p.id} className={`p-4 rounded-2xl border flex justify-between items-center transition-all group ${inLineup ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                              <div className="text-right flex-1">
                                 <div className="flex items-center gap-2">
                                    <p className={`font-black text-md ${inLineup ? 'text-green-400' : 'text-white'}`}>{p.name} {p.isFrozen && '❄️'}</p>
                                    <button onClick={() => handleScouting(p)} className="text-[10px] w-5 h-5 bg-blue-600/50 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors font-black">i</button>
                                 </div>
                                 <div className="flex gap-2 mt-1"><span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${getPosColor(p.position)}`}>{p.position}</span><span className="text-[9px] text-slate-500 font-bold">{p.team}</span></div>
                              </div>
                              {isUserOwner && !p.isFrozen && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); toggleLineup(p); }} 
                                  className={`w-10 h-10 rounded-xl font-black text-xl transition-all shadow-md active:scale-90 ${inLineup ? 'bg-red-500 text-white' : 'bg-green-500 text-black'}`}
                                >
                                  {inLineup ? '-' : '+'}
                                </button>
                              )}
                           </div>
                         );
                       })}
                    </div>
                 </Card>
              </div>
           </div>
        )}

        {activeTab === 'dashboard' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-fade-in">
              <Card title="דסק רז זהבי" icon="🎙️" dark className="lg:col-span-2 border-r-8 border-red-600">
                 <p className="text-3xl italic font-serif text-slate-100 leading-relaxed whitespace-pre-wrap">"{razColumn}"</p>
              </Card>
              <Card title="טופ הליגה" icon="🏆" dark>
                 {LEAGUE_TABLE.slice(0, 3).map((t, i) => (
                   <div key={t.teamName} className="flex justify-between mb-4 p-5 bg-slate-800/50 rounded-3xl border border-slate-700">
                      <span className="font-bold">{i+1}. {t.teamName}</span>
                      <span className="text-green-500 font-black">{t.points}</span>
                   </div>
                 ))}
              </Card>
           </div>
        )}

        {activeTab === 'table' && (
           <Card title="טבלת הליגה" icon="📊" dark className="border-t-8 border-blue-600">
              <div className="overflow-x-auto"><table className="w-full text-right"><thead><tr className="text-slate-500 text-xs font-black border-b border-slate-800 text-center"><th className="py-6 px-4">דירוג</th><th className="py-6 px-4">קבוצה</th><th className="py-6 px-4 text-green-500">נקודות</th></tr></thead><tbody>{LEAGUE_TABLE.map(t => (<tr key={t.teamName} className="border-b border-slate-800/50 text-center hover:bg-slate-800/20 transition-colors"><td className="py-8 px-4 font-black text-slate-500 text-xl">{t.rank}</td><td className="py-8 px-4 font-black text-2xl">{t.teamName}</td><td className="py-8 px-4 font-black text-4xl text-green-500">{t.points}</td></tr>))}</tbody></table></div>
           </Card>
        )}
      </main>
    </div>
  );
};

export default App;
