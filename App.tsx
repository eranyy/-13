import React, { useState, useEffect, useMemo } from 'react';
import { Team, Player, User, LockedLineup, Formation, Substitution, Transfer, PointsAction, MatchReport, PlayerSnapshot } from './types';
import { MOCK_TEAMS, VALID_FORMATIONS, ISRAELI_TEAMS, POS_COLORS } from './constants';
import { generateRazColumn } from './geminiService';
import { authService } from './authService';
import { db } from './firebaseConfig';
import AdminLeagueManager from './AdminLeagueManager';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  getDoc,
  arrayRemove,
  addDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  arrayUnion,
  writeBatch,
  increment
} from 'firebase/firestore';

const CURRENT_ROUND = 23;
const POS_ORDER: Record<string, number> = { 'GK': 1, 'DEF': 2, 'MID': 3, 'FWD': 4 };

// --- 1. CORE STATE REPLACEMENT: HARDCODED MATCHDAY 23 DATA ---
const MATCHDAY_23_DATA = [
  { 
    id: 'm1', 
    homeId: 'tumali', homeName: 'תומאלי', homeScore: 74, 
    awayId: 'holonia', awayName: 'חולוניה', awayScore: 51,
    status: 'live' 
  },
  { 
    id: 'm2', 
    homeId: 'pichichi', homeName: 'פיציצי', homeScore: 71, 
    awayId: 'tampa', awayName: 'טמפה', awayScore: 42,
    status: 'live' 
  },
  { 
    id: 'm3', 
    homeId: 'hamsili', homeName: 'חמסילי', homeScore: 55, 
    awayId: 'harale', awayName: 'חראלה', awayScore: 49,
    status: 'live' 
  }
];

const EVENT_DICT: Record<string, { icon: string, label: string }> = {
  goal: { icon: '⚽', label: 'שער זכות' },
  assist: { icon: '🅰️', label: 'בישול' },
  clean_sheet: { icon: '🛡️', label: 'רשת נקייה' },
  yellow_card: { icon: '🟨', label: 'כרטיס צהוב' },
  red_card: { icon: '🟥', label: 'כרטיס אדום' },
  own_goal: { icon: '🤦‍♂️', label: 'שער עצמי' },
  sub_in: { icon: '🔄', label: 'נכנס כמחליף' },
  sub_out: { icon: '🔻', label: 'הוחלף (נקודות מחצית 1)' }
};

export const calculatePlayerStats = (pos: string, stats: any) => {
  let total = 0;
  let breakdown: PointsAction[] = [];
  let events: string[] = [];

  if (stats.minutes === '60+') { 
    total += 2; 
    breakdown.push({ action: "פתח/שיחק 60+", pts: 2 }); 
  }
  else if (stats.minutes === '<60') { 
    total += 1; 
    breakdown.push({ action: "שיחק פחות מ-60", pts: 1 }); 
  }
  else if (stats.minutes === '0_in_squad') { 
    breakdown.push({ action: "בסגל ולא שותף", pts: 0 }); 
  }
  else if (stats.minutes === 'not_in_squad') { 
    total -= 1; 
    breakdown.push({ action: "לא בסגל", pts: -1 }); 
  }

  if (stats.goals > 0) {
    let ptsPerGoal = (pos === 'GK') ? 10 : (pos === 'DEF') ? 8 : 5;
    total += (stats.goals * ptsPerGoal);
    breakdown.push({ action: `שערים (${stats.goals})`, pts: stats.goals * ptsPerGoal });
    for(let i=0; i<stats.goals; i++) events.push('goal');
  }

  if (stats.assists > 0) {
    let ptsPerAssist = (pos === 'GK') ? 6 : (pos === 'DEF') ? 4 : 3;
    total += (stats.assists * ptsPerAssist);
    breakdown.push({ action: `בישולים (${stats.assists})`, pts: stats.assists * ptsPerAssist });
    for(let i=0; i<stats.assists; i++) events.push('assist');
  }

  if (stats.cleanSheet && stats.minutes === '60+' && (pos === 'DEF' || pos === 'GK')) {
    let pts = (pos === 'GK') ? 5 : 4;
    total += pts;
    breakdown.push({ action: "רשת נקייה", pts: pts });
    events.push('clean_sheet');
  }

  if (stats.goalsConceded > 0 && (pos === 'DEF' || pos === 'GK')) {
    total -= stats.goalsConceded;
    breakdown.push({ action: `ספיגות (${stats.goalsConceded})`, pts: -stats.goalsConceded });
  }

  if (stats.yellowCard) { total -= 2; breakdown.push({ action: "כרטיס צהוב", pts: -2 }); events.push('yellow_card'); }
  if (stats.redCard) { total -= 5; breakdown.push({ action: "כרטיס אדום", pts: -5 }); events.push('red_card'); }

  if (stats.ownGoals > 0) {
    total -= (stats.ownGoals * 3);
    breakdown.push({ action: `שער עצמי (${stats.ownGoals})`, pts: -(stats.ownGoals * 3) });
    for(let i=0; i<stats.ownGoals; i++) events.push('own_goal');
  }

  return { total, breakdown, events };
};

const PlayerMatchStatus: React.FC<{ status: 'not_started' | 'live' | 'finished' }> = ({ status }) => {
  if (status === 'live') return (
    <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
      <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
      <span className="text-[8px] font-black text-green-500 uppercase">LIVE</span>
    </div>
  );
  if (status === 'finished') return (
    <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-0.5 rounded-full border border-white/10">
      <span className="text-[10px]">🏁</span>
      <span className="text-[8px] font-black text-slate-400 uppercase">סיום</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-full border border-white/5">
      <span className="text-[10px] grayscale opacity-50">⏳</span>
      <span className="text-[8px] font-black text-slate-600 uppercase">טרם</span>
    </div>
  );
};

const PlayerInfoIcon: React.FC<{ name: string }> = ({ name }) => (
  <button onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/search?q=שחקן+${name}+ליגת+העל`, '_blank'); }}
    className="inline-flex items-center justify-center w-4 h-4 text-[8px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/30 rounded-full hover:bg-blue-400 hover:text-white transition-all shadow-sm" title="מידע על השחקן">i</button>
);

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  // Default to 'live' to show the injected data immediately
  const [activeTab, setActiveTab] = useState<'dashboard' | 'live' | 'lineup' | 'table' | 'rules' | 'feed'>('live');
  const [lineupSubTab, setLineupSubTab] = useState<'squad' | 'history'>('squad');
  const [teams, setTeams] = useState<Team[]>([]);
  const [lockedLineups, setLockedLineups] = useState<LockedLineup[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('hamsili');
  const [isInitializing, setIsInitializing] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [razColumn, setRazColumn] = useState('רז זהבי: הליגה הזאת צריכה ועדת חקירה!');
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Transfer | null>(null);
  const [playerToEdit, setPlayerToEdit] = useState<Transfer | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerTeam, setEditPlayerTeam] = useState('');
  const [expandedMatchup, setExpandedMatchup] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [playerStatsModal, setPlayerStatsModal] = useState<{player: Player, teamId: string} | null>(null);
  const [rawStats, setRawStats] = useState({ minutes: 'טרם שיחק', goals: 0, assists: 0, goalsConceded: 0, ownGoals: 0, cleanSheet: false, yellowCard: false, redCard: false });
  const [isLiveSubCheckbox, setIsLiveSubCheckbox] = useState(false);
  const [matchdayFeed, setMatchdayFeed] = useState<any[]>([]);
  const [selectedSwapOut, setSelectedSwapOut] = useState<string>('');
  const [selectedSwapIn, setSelectedSwapIn] = useState<string>('');
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualTransfer, setManualTransfer] = useState<Partial<Transfer & { realTeamIn: string }>>({ date: new Date().toLocaleDateString('he-IL'), out: '', in: '', pos: 'MID', realTeamIn: '' });
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [isConfirmingHistoryDelete, setIsConfirmingHistoryDelete] = useState(false);
  const [historyDeleteSuccess, setHistoryDeleteSuccess] = useState<string | null>(null);
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, "users"), (snapshot) => {
      setTeams(snapshot.docs.map(d => d.data() as Team));
    });
    const unsubLocked = onSnapshot(query(collection(db, "lockedLineups"), where("round", "==", CURRENT_ROUND)), (s) => {
      setLockedLineups(s.docs.map(d => d.data() as LockedLineup));
    });
    const unsubFeed = onSnapshot(query(collection(db, "matchday_live_feed"), orderBy("timestamp", "desc")), (s) => {
      setMatchdayFeed(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const init = async () => {
      const user = authService.getSession();
      setLoggedInUser(user);
      if (user) setSelectedTeamId(user.email === 'eranyy@gmail.com' || user.isAdmin ? 'hamsili' : user.id);
      const usersSnap = await getDocs(collection(db, "users"));
      if (usersSnap.empty) { for (const team of MOCK_TEAMS) await setDoc(doc(db, "users", team.id), team); }
      setIsInitializing(false);
    };
    init();
    return () => { unsubTeams(); unsubLocked(); unsubFeed(); };
  }, []);

  const currentTeam = useMemo(() => {
    const raw = teams.find(t => t.id === selectedTeamId) || MOCK_TEAMS.find(t => t.id === selectedTeamId) || MOCK_TEAMS[0];
    return { ...raw, lineup: raw.lineup || [], squad: raw.squad || [], transferHistory: raw.transferHistory || [], frozenPlayers: raw.frozenPlayers || [], published_lineup: (raw as any).published_lineup || [], published_subs_out: (raw as any).published_subs_out || [] };
  }, [teams, selectedTeamId]);

  const cleanTeamList = useMemo(() => teams.filter(t => t.manager && t.manager.trim() !== ""), [teams]);
  const benchPlayers = useMemo(() => { const pitchIds = currentTeam.lineup.map(p => p.id); return currentTeam.squad.filter(p => !pitchIds.includes(p.id)); }, [currentTeam]);
  const currentFormation = useMemo(() => { const def = currentTeam.lineup.filter(p => p.position === 'DEF').length; const mid = currentTeam.lineup.filter(p => p.position === 'MID').length; const fwd = currentTeam.lineup.filter(p => p.position === 'FWD').length; return `${def}-${mid}-${fwd}`; }, [currentTeam.lineup]);
  const isEran = useMemo(() => loggedInUser?.email === 'eranyy@gmail.com', [loggedInUser]);
  const canEdit = useMemo(() => { if (!loggedInUser) return false; return loggedInUser.email === 'eranyy@gmail.com' || loggedInUser.isAdmin || loggedInUser.id === currentTeam.id; }, [loggedInUser, currentTeam]);

  const validateAddition = (player: Player, lineup: Player[]) => {
    const futureLineup = [...lineup, player];
    const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    futureLineup.forEach(p => counts[p.position]++);
    if (futureLineup.filter(p => p.team === player.team).length > 2) return { valid: false, msg: `מקסימום 2 שחקנים מאותה קבוצה (${player.team})!` };
    if (counts.GK > 1) return { valid: false, msg: "מקסימום שוער 1 בהרכב!" };
    if (counts.DEF > 5) return { valid: false, msg: "מקסימום 5 שחקני הגנה!" };
    if (counts.MID > 5) return { valid: false, msg: "מקסימום 5 שחקני קישור!" };
    if (counts.FWD > 3) return { valid: false, msg: "מקסימום 3 חלוצים!" };
    if (futureLineup.length === 11) {
      const formation = `${counts.DEF}-${counts.MID}-${counts.FWD}`;
      if (!VALID_FORMATIONS.includes(formation as any)) return { valid: false, msg: `מערך ${formation} לא חוקי!` };
    }
    return { valid: true };
  };

  // --- 1. SECURE FUNCTIONS START ---
  const handleUpdatePlayerScore = async (player: Player) => {
    // Stub to prevent crash, can be connected to editing logic
    console.log("Updating score for", player.name);
  };

  const togglePlayer = async (player: Player) => {
    if (!canEdit) return;
    const isAlreadyIn = currentTeam.lineup.some(p => p.id === player.id);
    let newLineup: Player[];
    if (isAlreadyIn) {
      newLineup = currentTeam.lineup.filter(p => p.id !== player.id);
    } else {
      if (currentTeam.lineup.length >= 11) return alert("ההרכב מלא (11 שחקנים)!");
      const validation = validateAddition(player, currentTeam.lineup);
      if (!validation.valid) return alert(validation.msg);
      newLineup = [...currentTeam.lineup, player];
    }
    const teamRef = doc(db, "users", currentTeam.id);
    try {
      await updateDoc(teamRef, { lineup: newLineup });
    } catch (e: any) {
      alert("שגיאה בעדכון הרכב: " + e.message);
    }
  };

  const handleRemoveFromLineup = async (player: Player) => {
    if (!canEdit) return;
    const newLineup = currentTeam.lineup.filter(p => p.id !== player.id);
    const teamRef = doc(db, "users", currentTeam.id);
    try {
      await updateDoc(teamRef, { lineup: newLineup });
    } catch (e: any) {
      alert("שגיאה בהסרת שחקן: " + e.message);
    }
  };

  const handleSwap = async () => {
    if (!canEdit) return;
    if (!selectedSwapOut || !selectedSwapIn) return;
    const playerOut = currentTeam.lineup.find(p => p.id === selectedSwapOut);
    const playerIn = currentTeam.squad.find(p => p.id === selectedSwapIn);
    if (!playerOut || !playerIn) return;

    const lineupWithoutOut = currentTeam.lineup.filter(p => p.id !== selectedSwapOut);
    const validation = validateAddition(playerIn, lineupWithoutOut);
    if (!validation.valid) return alert(validation.msg);

    const newLineup = [...lineupWithoutOut, playerIn];
    const teamRef = doc(db, "users", currentTeam.id);
    
    try {
      const updateData: any = { lineup: newLineup };
      if (currentTeam.published_lineup && currentTeam.published_lineup.some((p: Player) => p.id === selectedSwapOut)) {
        updateData.published_lineup = currentTeam.published_lineup.map((p: Player) => 
          p.id === selectedSwapOut ? playerIn : p
        );
      }
      await updateDoc(teamRef, updateData);
      await addDoc(collection(db, 'matchday_live_feed'), {
        teamName: currentTeam.teamName,
        actionDetails: `🔄 חילוף: ${playerIn.name} נכנס במקום ${playerOut.name}`,
        timestamp: serverTimestamp(),
        isHalfTimeSub: isLiveSubCheckbox
      });
      setSelectedSwapOut('');
      setSelectedSwapIn('');
      alert("✅ החילוף בוצע ושודר!");
    } catch (e: any) {
      alert("שגיאה בביצוע חילוף: " + e.message);
    }
  };
  // --- SECURE FUNCTIONS END ---

  const handleQuickStat = async (teamId: string, player: Player, field: 'goals' | 'assists', delta: number) => {
    if (!isEran) return;
    const teamRef = doc(db, 'users', teamId);
    const snap = await getDoc(teamRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const updater = (list: any[]) => list.map(p => {
      if (p.id === player.id) {
        const events = p.events || [];
        const newEvents = delta > 0 ? [...events, field === 'goals' ? 'goal' : 'assist'] : events.slice(0, -1);
        const { total, breakdown } = calculatePlayerStats(p.position, {
          minutes: p.pointsAtSub ? '<60' : '60+', 
          goals: newEvents.filter(e => e === 'goal').length,
          assists: newEvents.filter(e => e === 'assist').length,
          cleanSheet: newEvents.includes('clean_sheet'),
          yellowCard: newEvents.includes('yellow_card'),
          redCard: newEvents.includes('red_card'),
          goalsConceded: 0, ownGoals: 0
        });
        return { ...p, events: newEvents, points: total, breakdown };
      }
      return p;
    });
    await updateDoc(teamRef, { published_lineup: updater(data.published_lineup || []), published_subs_out: updater(data.published_subs_out || []) });
  };

  const handleCloseRound = async () => {
    if (!isEran) return;
    if (!isConfirmingArchive) { setIsConfirmingArchive(true); return; }
    try {
      const batch = writeBatch(db);
      
      // --- 2. LOGIC FIX: USE HARDCODED MATCHES FOR SCORING ---
      for (const m of MATCHDAY_23_DATA) {
        // Logic: Win 20+ = 3pts, Win <20 = 2pts, Draw = 1pt
        const diff = m.homeScore - m.awayScore;
        let hPts = 0;
        let aPts = 0;

        if (diff >= 20) { hPts = 3; aPts = 0; }
        else if (diff > 0) { hPts = 2; aPts = 0; }
        else if (diff === 0) { hPts = 1; aPts = 1; }
        else if (diff <= -20) { hPts = 0; aPts = 3; }
        else { hPts = 0; aPts = 2; }

        // Update Standings (assuming table exists)
        const updateStanding = (id: string, pts: number, pf: number, pa: number) => {
            const ref = doc(db, "standings_v13_fifa_final", id);
            batch.update(ref, {
                p: increment(1),
                pts: increment(pts),
                pf: increment(pf),
                pa: increment(pa),
                diff: increment(pf - pa),
                wins: increment(pts >= 2 ? 1 : 0),
                draws: increment(pts === 1 ? 1 : 0),
                losses: increment(pts === 0 ? 1 : 0)
            });
        };
        updateStanding(m.homeId, hPts, m.homeScore, m.awayScore);
        updateStanding(m.awayId, aPts, m.awayScore, m.homeScore);

        // Archive Report (Simplified for hardcoded data)
        // We fetch current lineups just for record, but scores are forced
        const hTeam = teams.find(t => t.id === m.homeId) || MOCK_TEAMS.find(t => t.id === m.homeId);
        const aTeam = teams.find(t => t.id === m.awayId) || MOCK_TEAMS.find(t => t.id === m.awayId);

        const report: MatchReport = {
          id: `report_${Date.now()}_${m.id}`,
          round: CURRENT_ROUND,
          timestamp: serverTimestamp(),
          homeTeam: { 
            id: m.homeId, name: m.homeName, score: m.homeScore,
            lineup: hTeam?.published_lineup as any || [], subsOut: []
          },
          awayTeam: { 
            id: m.awayId, name: m.awayName, score: m.awayScore,
             lineup: aTeam?.published_lineup as any || [], subsOut: []
          }
        };
        batch.set(doc(collection(db, "matchday_archive")), report);
      }
      
      await batch.commit();
      setHistoryDeleteSuccess('המחזור נסגר ודו"חות המשחק נשמרו בארכיון!');
      setTimeout(() => setHistoryDeleteSuccess(null), 4000);
      setIsConfirmingArchive(false);
    } catch (e: any) { alert("שגיאה בסגירת מחזור: " + e.message); }
  };

  const calculateTotalPoints = (team: any) => {
    const lineup = team?.published_lineup || team?.lineup || [];
    const subsOut = team?.published_subs_out || [];
    return lineup.reduce((acc: number, p: any) => acc + (p.points || 0), 0) + subsOut.reduce((acc: number, p: any) => acc + (p.points || 0), 0);
  };

  const handleBroadcastToArena = async () => {
    if (!currentTeam.lineup.length) return alert("ההרכב ריק!");
    try {
      await updateDoc(doc(db, 'users', currentTeam.id), { published_lineup: currentTeam.lineup });
      await addDoc(collection(db, 'matchday_live_feed'), { teamName: currentTeam.teamName, actionDetails: "🔄 הרכב כללי עודכן", timestamp: serverTimestamp(), isHalfTimeSub: isLiveSubCheckbox });
      alert("✅ ההרכב שודר!");
    } catch (e: any) { alert(e.message); }
  };

  const handleClearHistory = async () => {
    if (!isEran) return;
    if (!isConfirmingHistoryDelete) { setIsConfirmingHistoryDelete(true); return; }
    try {
      const feedSnap = await getDocs(collection(db, "matchday_live_feed"));
      const batch = writeBatch(db);
      feedSnap.docs.forEach(d => batch.delete(d.ref));
      setMatchdayFeed([]);
      await batch.commit();
      setHistoryDeleteSuccess('ההיסטוריה נמחקה בהצלחה');
      setTimeout(() => setHistoryDeleteSuccess(null), 3000);
      setIsConfirmingHistoryDelete(false);
    } catch (e) { setIsConfirmingHistoryDelete(false); }
  };

  const handleManualAdd = async () => {
    if (!isEran || !manualTransfer.in || !manualTransfer.out || !manualTransfer.realTeamIn) return;
    try {
      const teamRef = doc(db, "users", currentTeam.id);
      const newP: Player = { id: `p_${Date.now()}`, name: manualTransfer.in!, team: manualTransfer.realTeamIn!, position: (manualTransfer.pos as any) || 'MID', points: 0, breakdown: [] };
      await updateDoc(teamRef, { squad: currentTeam.squad.filter(p => p.name !== manualTransfer.out).concat(newP), lineup: currentTeam.lineup.filter(p => p.name !== manualTransfer.out), published_lineup: currentTeam.published_lineup.filter(p => p.name !== manualTransfer.out), transferHistory: arrayUnion({ id: `tr_${Date.now()}`, date: new Date().toLocaleDateString('he-IL'), out: manualTransfer.out!, in: manualTransfer.in!, pos: manualTransfer.pos || 'MID' }) });
      setShowAddManual(false);
    } catch (e: any) { alert(e.message); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authService.login(authEmail, authPass, true);
    if (res.success && res.user) { setLoggedInUser(res.user); setSelectedTeamId(res.user.email === 'eranyy@gmail.com' || res.user.isAdmin ? 'hamsili' : res.user.id); }
    else { setValidationError(res.message); setTimeout(() => setValidationError(null), 3000); }
  };

  if (isInitializing) return <div className="h-screen bg-slate-950 flex items-center justify-center font-black text-green-500 animate-pulse text-4xl italic">LUZON 13</div>;
  if (!loggedInUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md bg-slate-900 rounded-[48px] border border-white/10 shadow-2xl overflow-hidden">
        <div className="bg-slate-800 p-10 text-center border-b-4 border-green-500"><h1 className="text-4xl font-black italic text-white mb-2">פנטזי <span className="text-green-500">לוזון</span></h1></div>
        <form onSubmit={handleLogin} className="p-10 space-y-6">
          <input type="email" placeholder="אימייל" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full h-16 bg-slate-950 border border-white/10 rounded-2xl px-6 font-black text-white focus:border-green-500 outline-none" />
          <input type="password" placeholder="סיסמה" value={authPass} onChange={e => setAuthPass(e.target.value)} className="w-full h-16 bg-slate-950 border border-white/10 rounded-2xl px-6 font-black text-white focus:border-green-500 outline-none" />
          <button type="submit" className="w-full h-16 bg-green-500 text-black font-black text-xl rounded-2xl shadow-xl active:scale-95 transition-all">התחבר</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-slate-100 flex flex-col pb-24 font-['Assistant']" style={{ background: 'linear-gradient(135deg, #0b0f19 0%, #1a233a 100%)' }} dir="rtl">
      {showLeagueModal && <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[10002] p-2"><div className="bg-slate-900 border border-white/20 w-[98%] max-w-[98%] max-h-[92vh] rounded-[32px] shadow-2xl overflow-y-auto scrollbar-hide animate-in zoom-in duration-300"><AdminLeagueManager isAdmin={isEran} onClose={() => setShowLeagueModal(false)} /></div></div>}
      {playerStatsModal && <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[10001] p-4"><div className="bg-slate-900 border border-white/20 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300"><div className="bg-slate-800 p-8 border-b border-white/10 flex justify-between items-center"><div className="text-right"><h3 className="text-2xl font-black text-white italic">{playerStatsModal.player.name}</h3><span className="text-xs font-bold text-slate-400 uppercase">{playerStatsModal.player.position} | {playerStatsModal.player.team}</span></div><button onClick={() => setPlayerStatsModal(null)} className="text-slate-500 text-2xl font-black">✕</button></div><div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-hide"><div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">דקות משחק</label><select value={rawStats.minutes} onChange={e => setRawStats({...rawStats, minutes: e.target.value})} className="w-full bg-slate-950 p-4 rounded-2xl border border-white/10 text-white font-bold outline-none"><option value="טרם שיחק">טרם שיחק</option><option value="not_in_squad">לא בסגל (-1)</option><option value="0_in_squad">בסגל ולא שותף (0)</option><option value="<60">פחות מ-60 דק' (1)</option><option value="60+">מעל 60 דק' (2)</option></select></div><div className="grid grid-cols-2 gap-4">{[{ label: 'שערים', key: 'goals' }, { label: 'בישולים', key: 'assists' }, { label: 'ספיגות (שוער/הגנה)', key: 'goalsConceded' }, { label: 'שערים עצמיים', key: 'ownGoals' }].map(stat => (<div key={stat.key} className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</label><div className="flex items-center gap-2"><button onClick={() => setRawStats({...rawStats, [stat.key]: Math.max(0, (rawStats as any)[stat.key] - 1)})} className="w-10 h-10 bg-slate-800 rounded-lg font-black">-</button><span className="flex-1 text-center font-black text-xl">{(rawStats as any)[stat.key]}</span><button onClick={() => setRawStats({...rawStats, [stat.key]: (rawStats as any)[stat.key] + 1})} className="w-10 h-10 bg-slate-800 rounded-lg font-black">+</button></div></div>))}</div><div className="grid grid-cols-1 gap-3 pt-4 border-t border-white/5">{[{ label: 'רשת נקייה (שוער/הגנה 60+)', key: 'cleanSheet' }, { label: 'כרטיס צהוב (-2)', key: 'yellowCard' }, { label: 'כרטיס אדום (-5)', key: 'redCard' }].map(check => (<label key={check.key} className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5 cursor-pointer hover:bg-slate-900 transition-all"><span className="font-bold text-sm">{check.label}</span><input type="checkbox" checked={(rawStats as any)[check.key]} onChange={e => setRawStats({...rawStats, [check.key]: e.target.checked})} className="w-6 h-6 accent-green-500"/></label>))}</div></div><div className="p-8 border-t border-white/10"><button onClick={() => { const { total, breakdown, events } = calculatePlayerStats(playerStatsModal.player.position, rawStats); const teamRef = doc(db, 'users', playerStatsModal.teamId); getDoc(teamRef).then(snap => { if (snap.exists()) { const d = snap.data(); const update = (list: any[]) => list.map(p => p.id === playerStatsModal.player.id ? { ...p, points: total, breakdown, events } : p); updateDoc(teamRef, { published_lineup: update(d.published_lineup || []), published_subs_out: update(d.published_subs_out || []) }); } }); setPlayerStatsModal(null); }} className="w-full bg-green-500 text-black font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><span>💾</span> חשב ושמור נתונים</button></div></div></div>}
      <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-[100] shadow-2xl">
        <div className="flex flex-col text-right"><span className="font-black italic text-xl tracking-tighter">LUZON <span className="text-green-500">13</span></span><span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{isEran ? `COMMISSIONER: ${loggedInUser.teamName}` : `MANAGER: ${loggedInUser.teamName}`}</span></div>
        <div className="flex items-center gap-3"><button onClick={() => setShowLeagueModal(true)} className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-[10px] font-black tracking-widest hover:bg-amber-500 hover:text-black transition-all">🏆 טבלה</button><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Round {CURRENT_ROUND}</span></div>
      </header>
      {historyDeleteSuccess && <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-black font-black py-3 px-8 rounded-full shadow-[0_0_30px_rgba(34,197,94,0.4)] z-[200] animate-in slide-in-from-top duration-300">✅ {historyDeleteSuccess}</div>}
      <main className="flex-1 p-4 overflow-x-hidden">
        {activeTab === 'live' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="text-center flex flex-col items-center gap-4">
              <h2 className="text-3xl font-black italic text-white tracking-widest">🏆 מחזור {CURRENT_ROUND} - LIVE</h2>
              <div className="flex flex-wrap justify-center gap-2">
                {isEran && (
                  <>
                    <button onClick={() => setIsEditMode(!isEditMode)} className={`px-6 py-2 rounded-full font-black text-xs transition-all border-2 ${isEditMode ? 'bg-amber-500 text-black border-amber-600' : 'bg-slate-900 text-slate-500 border-white/10'}`}>{isEditMode ? '🔓 עריכה פעילה' : '🔒 עריכת נתונים'}</button>
                    {isConfirmingArchive ? (
                      <button onClick={handleCloseRound} className="bg-red-600 text-white font-black px-6 py-2 rounded-full text-xs shadow-xl animate-pulse">בטוח? לחץ לארכוב ⚠️</button>
                    ) : (
                      <button onClick={() => setIsConfirmingArchive(true)} className="bg-blue-600/20 text-blue-400 border border-blue-600/40 px-6 py-2 rounded-full font-black text-xs">סגור מחזור וארכב 🏁</button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {/* --- 2. HARDCODED RENDER OF MATCHDAY 23 DATA --- */}
              {MATCHDAY_23_DATA.map(match => {
                // Fetch team object only to show roster if needed, but scores are hardcoded
                const hTeam = teams.find(t => t.id === match.homeId);
                const aTeam = teams.find(t => t.id === match.awayId);
                const isExpanded = expandedMatchup === match.id;
                
                return (
                  <div key={match.id} className="group overflow-hidden">
                    <div onClick={() => setExpandedMatchup(isExpanded ? null : match.id)} className={`relative overflow-hidden cursor-pointer bg-white/[0.03] border border-white/10 p-8 rounded-[32px] transition-all ${isExpanded ? 'border-green-500/40 bg-green-500/[0.02]' : 'hover:bg-white/5'}`}>
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex-1 text-center"><span className="text-xl font-black text-white">{match.homeName}</span></div>
                        <div className="px-8 flex flex-col items-center gap-1"><span className="text-[10px] font-black text-green-500 italic">VS</span><span className="text-4xl font-black text-white">{match.homeScore} - {match.awayScore}</span></div>
                        <div className="flex-1 text-center"><span className="text-xl font-black text-white">{match.awayName}</span></div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-500">
                        {[hTeam, aTeam].map((team, tIdx) => (
                          <div key={tIdx} className="bg-slate-900/40 rounded-[24px] border border-white/5 p-6 space-y-3">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">הרכב {team?.teamName || (tIdx === 0 ? match.homeName : match.awayName)}</h4>
                            {(team?.published_lineup || []).sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position]).map((p, idx) => (
                              <div key={p.id} className={`flex items-center justify-between group/p p-2 rounded-xl transition-all ${isEditMode ? 'hover:bg-white/5' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <div style={{ backgroundColor: POS_COLORS[p.position]?.bg, color: POS_COLORS[p.position]?.text }} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px]">{p.position}</div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1"><span className="text-xs font-black text-slate-200">{p.name}</span>{p.events?.map((ev, i) => <span key={i} className="text-xs">{EVENT_DICT[ev]?.icon}</span>)}</div>
                                    <PlayerMatchStatus status={idx % 3 === 0 ? 'live' : 'not_started'} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isEditMode && (
                                    <div className="flex gap-1">
                                      <button onClick={() => handleQuickStat(team!.id, p, 'goals', 1)} className="w-6 h-6 bg-green-500/20 text-green-500 rounded border border-green-500/30 text-[10px] font-black">⚽+</button>
                                      <button onClick={() => handleQuickStat(team!.id, p, 'assists', 1)} className="w-6 h-6 bg-blue-500/20 text-blue-500 rounded border border-blue-600/30 text-[10px] font-black">🅰️+</button>
                                    </div>
                                  )}
                                  <div onClick={(e) => { if(isEditMode) { e.stopPropagation(); setRawStats({ minutes: '60+', goals: (p.events || []).filter(e => e === 'goal').length, assists: (p.events || []).filter(e => e === 'assist').length, goalsConceded: 0, ownGoals: 0, cleanSheet: p.events?.includes('clean_sheet') || false, yellowCard: p.events?.includes('yellow_card') || false, redCard: p.events?.includes('red_card') || false }); setPlayerStatsModal({ player: p, teamId: team!.id }); } else { setExpandedPlayer(expandedPlayer === p.name ? null : p.name); } }} className="text-xs font-black px-2 py-1 rounded-lg text-amber-400 cursor-pointer hover:bg-white/5">[{p.points || 0} נק']</div>
                                </div>
                                {expandedPlayer === p.name && (
                                  <div className="w-full mt-2 bg-slate-800/50 p-2 rounded-lg text-[10px] space-y-1 animate-in slide-in-from-top-2">
                                    <p className="font-bold text-slate-400">פירוט ניקוד:</p>
                                    {(p.breakdown || []).map((b, i) => (
                                      <div key={i} className="flex justify-between text-slate-300">
                                        <span>{b.action}</span>
                                        <span className={b.pts > 0 ? 'text-green-400' : 'text-red-400'}>{b.pts > 0 ? '+' : ''}{b.pts}</span>
                                      </div>
                                    ))}
                                    {(p.breakdown || []).length === 0 && <p className="text-slate-500 italic">אין נתונים</p>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'lineup' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900/50 p-4 rounded-[32px] border border-white/5 flex items-center gap-3"><select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} className="w-full h-12 bg-slate-950 border border-white/10 rounded-2xl px-4 font-black text-white appearance-none outline-none">{cleanTeamList.map(t => <option key={t.id} value={t.id}>{t.teamName} ({t.manager})</option>)}</select></div>
            <div className="flex items-center justify-center gap-4 bg-slate-900/80 p-2 rounded-[28px] border border-white/10 shadow-xl"><button onClick={() => setLineupSubTab('squad')} className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all ${lineupSubTab === 'squad' ? 'bg-green-500 text-black' : 'text-slate-500'}`}>הסגל שלי</button><button onClick={() => setLineupSubTab('history')} className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all ${lineupSubTab === 'history' ? 'bg-green-500 text-black' : 'text-slate-500'}`}>היסטוריה</button></div>
            {lineupSubTab === 'squad' ? (
              <><div className="relative group"><div className="absolute top-4 left-1/2 -translate-x-1/2 z-[50] bg-slate-950/80 px-8 py-3 rounded-full border border-white/20 shadow-2xl"><span className="font-black text-green-500 text-xs italic uppercase tracking-[0.2em]">מערך: {currentFormation}</span></div><div className="h-[80vh] relative rounded-[48px] border-[12px] border-slate-900 overflow-hidden flex flex-col" style={{ background: 'linear-gradient(to bottom, #166534, #14532d)' }}><div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #ffffff 0, #ffffff 2px, transparent 2px, transparent 100px)', backgroundSize: '100% 100px' }}></div><div className="relative h-full w-full flex flex-col z-10 py-4"><div className="flex justify-center items-center gap-4 w-full h-[25%] px-4">{currentTeam.lineup.filter(p => p.position === 'FWD').map(p => <PitchPlayerCard key={p.id} player={p} currentTeam={currentTeam} onRemove={handleRemoveFromLineup} onToggle={togglePlayer} />)}</div><div className="flex justify-center items-center gap-4 w-full h-[25%] px-4">{currentTeam.lineup.filter(p => p.position === 'MID').map(p => <PitchPlayerCard key={p.id} player={p} currentTeam={currentTeam} onRemove={handleRemoveFromLineup} onToggle={togglePlayer} />)}</div><div className="flex justify-center items-center gap-4 w-full h-[25%] px-4">{currentTeam.lineup.filter(p => p.position === 'DEF').map(p => <PitchPlayerCard key={p.id} player={p} currentTeam={currentTeam} onRemove={handleRemoveFromLineup} onToggle={togglePlayer} />)}</div><div className="flex justify-center items-center gap-4 w-full h-[25%] px-4">{currentTeam.lineup.filter(p => p.position === 'GK').map(p => <PitchPlayerCard key={p.id} player={p} currentTeam={currentTeam} onRemove={handleRemoveFromLineup} onToggle={togglePlayer} />)}</div></div></div><div className="mt-4 space-y-4"><div className="bg-slate-900/90 p-6 rounded-[32px] border border-white/10 shadow-2xl space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="flex flex-col gap-1"><label className="text-[10px] font-black text-red-400 mr-2 uppercase">🔴 שחקן יוצא</label><select value={selectedSwapOut} onChange={e => setSelectedSwapOut(e.target.value)} className="bg-slate-950 p-4 rounded-xl border border-white/10 text-white font-bold text-xs outline-none"> <option value="">בחר שחקן להוצאה...</option> {[...currentTeam.lineup].sort((a,b)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map(p=><option key={p.id} value={p.id}>{p.name} ({p.position})</option>)} </select></div><div className="flex flex-col gap-1"><label className="text-[10px] font-black text-green-400 mr-2 uppercase">🟢 שחקן נכנס</label><select value={selectedSwapIn} onChange={e => setSelectedSwapIn(e.target.value)} className="bg-slate-950 p-4 rounded-xl border border-white/10 text-white font-bold text-xs outline-none"> <option value="">בחר שחקן להכנסה...</option> {[...benchPlayers].sort((a,b)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map(p=><option key={p.id} value={p.id}>{p.name} ({p.position})</option>)} </select></div></div><button onClick={handleSwap} className={`w-full py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 flex items-center justify-center gap-2 ${selectedSwapOut && selectedSwapIn ? 'bg-green-500 text-black' : 'bg-slate-800 text-slate-500 opacity-50'}`}><span>🔄</span> בצע ושדר חילוף</button></div><div className="flex flex-col sm:flex-row gap-4 items-center justify-center"><button onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(`ההרכב שלי למחזור ${CURRENT_ROUND}:\n` + currentTeam.lineup.sort((a,b)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map(p=>`${p.position}: ${p.name}`).join('\n')))} className="flex-1 w-full bg-green-500 text-black font-black py-4 px-8 rounded-[24px] shadow-2xl active:scale-95">🟢 שתף לווצאפ</button><button onClick={handleBroadcastToArena} className="bg-amber-400 text-black font-black py-4 px-8 rounded-[24px] shadow-2xl active:scale-95">שדר הרכב לזירה 📡</button></div></div></div><div className="bg-slate-900/95 p-10 rounded-[64px] border border-white/10 shadow-2xl mt-10"><h3 className="text-3xl font-black text-white italic mb-10 text-right">ניהול סגל</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[50vh] overflow-y-auto pr-4 scrollbar-hide">{currentTeam.squad.map(p => { const isOn = currentTeam.lineup.some(lp => lp.id === p.id); return (<div key={p.id} onClick={() => togglePlayer(p)} className={`group flex items-center justify-between p-6 rounded-[36px] border-2 transition-all cursor-pointer ${isOn ? 'bg-green-500/10 border-green-500/50' : 'bg-slate-950/40 border-white/5'}`}><div className="flex items-center gap-6"><div style={{ backgroundColor: POS_COLORS[p.position]?.bg, color: POS_COLORS[p.position]?.text }} className="w-16 h-16 rounded-[24px] flex items-center justify-center font-black">{p.position}</div><div className="flex flex-col text-right"><div className="flex items-center gap-2"><span className="font-black text-xl text-white">{p.name}</span><PlayerInfoIcon name={p.name} /></div><span className="text-[10px] text-slate-500 font-bold uppercase">{p.team}</span></div></div><div className={`w-14 h-14 rounded-[24px] flex items-center justify-center ${isOn ? 'bg-red-500/20 text-red-500' : 'bg-green-500 text-black'}`}>{isOn ? <span className="text-2xl font-black">✕</span> : <span className="text-3xl font-black">+</span>}</div></div>); })}</div></div></>
            ) : (
              <div className="bg-slate-900/95 p-10 rounded-[64px] border border-white/10 shadow-2xl space-y-10"><div className="bg-gradient-to-r from-green-500/20 to-transparent p-10 rounded-[48px] border border-green-500/20 flex flex-col sm:flex-row items-center justify-between gap-6"><div className="text-right"><h4 className="text-[12px] font-black text-slate-500 mb-3 uppercase tracking-widest italic">חילופים שבוצעו העונה</h4><div className="text-6xl font-black text-green-500 tabular-nums leading-none">{(currentTeam.transferHistory || []).length} <span className="text-slate-700 text-3xl">/</span> 14</div></div><div className="flex flex-wrap justify-center gap-4">{isEran && <button onClick={() => setShowAddManual(true)} className="bg-green-500 hover:bg-green-400 text-black font-black px-8 py-4 rounded-[20px] shadow-xl text-sm active:scale-95">+ הוסף חילוף ידני</button>}</div></div>{showAddManual && (<div className="bg-slate-800 p-8 rounded-[40px] border border-white/10 space-y-6 animate-in slide-in-from-top duration-300 shadow-2xl"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><select value={manualTransfer.out} onChange={e => setManualTransfer(prev => ({...prev, out: e.target.value}))} className="bg-slate-950 p-5 rounded-2xl border border-white/10 text-white font-black text-sm outline-none"><option value="">בחר שחקן יוצא...</option>{currentTeam.squad.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select><input placeholder="שם שחקן נכנס" value={manualTransfer.in} onChange={e => setManualTransfer(prev => ({...prev, in: e.target.value}))} className="bg-slate-950 p-5 rounded-2xl border border-white/10 text-white font-black text-sm outline-none" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><select value={manualTransfer.realTeamIn} onChange={e => setManualTransfer(prev => ({...prev, realTeamIn: e.target.value}))} className="bg-slate-950 p-5 rounded-2xl border border-white/10 text-white font-black text-sm outline-none"><option value="">בחר קבוצה...</option>{ISRAELI_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}</select><select value={manualTransfer.pos} onChange={e => setManualTransfer(prev => ({...prev, pos: e.target.value as any}))} className="bg-slate-950 p-5 rounded-2xl border border-white/10 text-white font-black text-sm outline-none"><option value="GK">GK</option><option value="DEF">DEF</option><option value="MID">MID</option><option value="FWD">FWD</option></select></div><div className="flex gap-4"><button onClick={handleManualAdd} className="flex-1 bg-green-500 text-black font-black py-5 rounded-2xl shadow-xl active:scale-95">🔄 שמור חילוף אטומי</button><button onClick={() => setShowAddManual(false)} className="px-8 bg-slate-700 text-white font-black py-5 rounded-2xl active:scale-95">ביטול</button></div></div>)}<div className="overflow-x-auto scrollbar-hide"><table className="w-full text-right border-collapse min-w-[500px]"><thead><tr className="text-slate-600 text-[10px] font-black uppercase border-b border-white/5 tracking-[0.2em] italic"><th className="p-6 text-center">תאריך</th><th className="p-6">שחקן יוצא</th><th className="p-6">שחקן נכנס</th>{isEran && <th className="p-6 text-center">ניהול</th>}</tr></thead><tbody className="divide-y divide-white/5">{(currentTeam.transferHistory || []).length === 0 ? (<tr><td colSpan={isEran ? 4 : 3} className="p-12 text-center text-slate-500 font-bold italic">אין העברות מתועדות במערכת.</td></tr>) : ((currentTeam.transferHistory || []).slice().reverse().map((t, i) => (<tr key={t.id || i} className="hover:bg-white/5 transition-all group"><td className="p-6 font-bold text-center text-xs text-slate-400 tabular-nums">{t.date}</td><td className="p-6 font-black text-red-500/80 italic tracking-tighter">{t.out}</td><td className="p-6 font-black text-green-500 italic tracking-tighter">{t.in} <PlayerInfoIcon name={t.in} /></td>{isEran && (<td className="p-6 text-center"><div className="flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); setPlayerToEdit(t); setEditPlayerName(t.in); setEditPlayerTeam(currentTeam.squad.find(x => x.name === t.in)?.team || ISRAELI_TEAMS[0]); }} className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-500 border border-blue-600/30 flex items-center justify-center hover:bg-blue-600 transition-all">✏️</button><button onClick={(e) => { e.stopPropagation(); setPlayerToDelete(t); }} className="w-10 h-10 rounded-xl bg-red-600/20 text-red-600 border border-red-600/30 flex items-center justify-center hover:bg-red-600 transition-all">🗑️</button></div></td>)}</tr>)))}</tbody></table></div></div>
            )}
          </div>
        )}
        {activeTab === 'dashboard' && (<div className="max-w-xl mx-auto space-y-6"><div className="bg-gradient-to-br from-red-600 via-red-800 to-black p-12 rounded-[64px] shadow-2xl text-white relative overflow-hidden group text-right"><h3 className="text-[10px] font-black opacity-60 uppercase mb-6 tracking-widest">RAZ ZEHAVI LIVE</h3><p className="text-3xl font-black italic leading-[1.2] drop-shadow-2xl">"{razColumn}"</p><button onClick={() => generateRazColumn().then(setRazColumn)} className="mt-12 px-10 py-4 bg-white/10 rounded-[24px] font-black text-[12px] border border-white/20 hover:bg-white/20 transition-all shadow-2xl">רענן שידור 🔄</button></div></div>)}
        {activeTab === 'feed' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4"><div className="text-right"><h2 className="text-3xl font-black italic text-white tracking-widest">יומן מחזור {CURRENT_ROUND}</h2><p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-1">תיעוד פעולות בזמן אמת</p></div>{isEran && (<div className="flex items-center gap-2">{isConfirmingHistoryDelete ? (<div className="flex items-center gap-2 animate-in zoom-in duration-200"><button onClick={handleClearHistory} className="bg-red-600 text-white font-black px-6 py-3 rounded-xl transition-all text-xs active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.4)]">לחץ שוב לאישור סופי ⚠️</button><button onClick={() => setIsConfirmingHistoryDelete(false)} className="bg-slate-800 text-slate-400 font-bold px-4 py-3 rounded-xl text-xs hover:text-white transition-all border border-white/10">ביטול</button></div>) : (<button onClick={handleClearHistory} className="border-2 border-red-500/50 text-red-500 font-black px-6 py-3 rounded-xl transition-all text-xs hover:bg-red-500/10 active:scale-95">מחק את כל היסטוריית החילופים</button>)}</div>)}</div>
            <div className="space-y-4 relative before:absolute before:right-[26px] before:top-4 before:bottom-4 before:w-[1px] before:bg-white/10">{matchdayFeed.length === 0 ? (<div className="text-center py-20 bg-white/[0.02] rounded-[32px] border border-white/5"><span className="text-4xl block mb-4">🗒️</span><p className="text-slate-500 font-black">אין חילופים מתועדים</p></div>) : (matchdayFeed.map((log) => { const dateStr = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '--:--'; return (<div key={log.id} className="relative pr-16 group"><div className={`absolute right-6 top-1.5 w-1.5 h-1.5 rounded-full z-10 transition-all duration-500 ring-4 ${log.isHalfTimeSub ? 'bg-amber-500 ring-amber-500/20' : 'bg-green-500 ring-green-500/20'}`}></div><div className={`bg-white/[0.03] backdrop-blur-xl border border-white/10 p-5 rounded-[24px] transition-all hover:bg-white/[0.05] hover:border-white/20 ${log.isHalfTimeSub ? 'border-amber-500/20' : ''}`}><div className="flex justify-between items-start mb-2"><span className="text-lg font-black text-amber-400 italic tracking-tighter">{log.teamName}</span><span className="text-[10px] font-bold text-slate-500 tabular-nums uppercase tracking-widest">{dateStr}</span></div><p className="text-slate-200 text-sm font-bold leading-relaxed">{log.actionDetails}</p>{log.isHalfTimeSub && (<div className="mt-3 inline-flex items-center gap-2 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30"><span className="text-[10px]">⚠️</span><span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.1em]">חילוף מחצית</span></div>)}</div></div>); }))}</div>
          </div>
        )}
      </main>
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[94%] max-w-lg h-24 bg-slate-900/90 backdrop-blur-3xl border border-white/10 rounded-[56px] flex items-center justify-around px-2 z-[200] shadow-2xl">
         {[{id: 'dashboard', icon: '🏠', label: 'ראשי'}, {id: 'lineup', icon: '🏃', label: 'הרכב'}, {id: 'live', icon: '⚡', label: 'זירה'}, {id: 'feed', icon: '🗞️', label: 'יומן'}, {id: 'rules', icon: '📜', label: 'תקנון'}].map(tab => (
           <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex flex-col items-center justify-center flex-1 gap-1 h-16 rounded-[40px] transition-all duration-500 ${activeTab === tab.id ? 'text-green-400 bg-white/5 scale-105' : 'text-slate-600'}`}><span className="text-2xl">{tab.icon}</span><span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span></button>
         ))}
      </nav>
    </div>
  );
};

const PitchPlayerCard: React.FC<{ player: Player, currentTeam: any, onRemove: (p: Player) => void, onToggle: (p: Player) => void }> = ({ player, currentTeam, onRemove, onToggle }) => {
  return (
    <div className="flex flex-col items-center gap-1 group animate-in zoom-in duration-500 relative min-w-[70px] sm:min-w-[100px]"><div onClick={() => onToggle(player)} className="relative transition-all cursor-pointer hover:scale-110 active:scale-95 z-20" style={{ filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.6))' }}><span className="text-5xl sm:text-6xl no-select leading-none block transform translate-y-1">{player.position === 'GK' ? '🧤' : '👕'}</span><button type="button" onClick={(e) => { e.stopPropagation(); onRemove(player); }} className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 text-white rounded-full font-black flex items-center justify-center shadow-2xl border border-white/40 transition-transform hover:scale-125 z-40 text-[10px]">✕</button></div><div className="bg-slate-950 px-2 py-1 rounded-[8px] border border-white/20 min-w-[85px] max-w-[110px] text-center shadow-2xl flex flex-col items-center gap-0.5"><div className="flex items-center justify-center gap-1 w-full"><span className="text-[10px] font-black text-white truncate">{player.name}</span><PlayerInfoIcon name={player.name} /></div><div style={{ backgroundColor: POS_COLORS[player.position]?.bg, color: POS_COLORS[player.position]?.text, padding: '1px 6px', borderRadius: '4px', fontWeight: '900', fontSize: '0.6rem', marginTop: '2px' }}>{player.position}</div><span className="text-[7px] text-slate-500 font-bold uppercase">{player.team}</span></div></div>
  );
};

export default App;