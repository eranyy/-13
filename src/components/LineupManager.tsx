import React, { useState, useEffect } from 'react';
import { ChevronDown, History, Settings2, LayoutGrid, List, MessageCircle, RefreshCw, Eraser, Search, Share2, Send, ArrowRightLeft, Snowflake, Plus, Trash2, Undo2, AlertTriangle, CheckCircle2, Siren, Trophy, Lock } from 'lucide-react';
import { Team, Player, User } from '../types';
import { db } from '../firebaseConfig';
import { collection, doc, updateDoc, arrayUnion, onSnapshot, addDoc } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";

interface LineupManagerProps { teams: Team[]; loggedInUser: User | null; currentRound: number; isAdmin: boolean; }

const POS_COLORS: Record<string, { bg: string, border: string, text: string }> = { 
  'GK': { bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', border: 'border-yellow-300', text: 'text-yellow-950' }, 
  'DEF': { bg: 'bg-gradient-to-br from-blue-500 to-blue-700', border: 'border-blue-300', text: 'text-white' }, 
  'MID': { bg: 'bg-gradient-to-br from-emerald-400 to-emerald-600', border: 'border-emerald-200', text: 'text-emerald-950' }, 
  'FWD': { bg: 'bg-gradient-to-br from-red-500 to-red-700', border: 'border-red-300', text: 'text-white' } 
};

const POS_ORDER: Record<string, number> = { 'GK': 1, 'שוער': 1, 'DEF': 2, 'הגנה': 2, 'בלם': 2, 'מגן': 2, 'MID': 3, 'קשר': 3, 'קישור': 3, 'FWD': 4, 'חלוץ': 4, 'התקפה': 4 };
const POS_ARRAY = ['GK', 'DEF', 'MID', 'FWD'];
const ALLOWED_FORMATIONS = ['5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-5-2', '3-4-3'];
const REAL_TEAMS_ISRAEL = ['מכבי תל אביב', 'מכבי חיפה', 'הפועל באר שבע', 'הפועל תל אביב', 'בית"ר ירושלים', 'מכבי נתניה', 'הפועל ירושלים', 'הפועל חיפה', 'בני סכנין', 'מ.ס אשדוד', 'הפועל חדרה', 'מכבי פתח תקווה', 'מכבי בני ריינה', 'הפועל פתח תקווה', 'עירוני קרית שמונה', 'עירוני טבריה'];

const getTeamColors = (teamName: string, isGK: boolean) => {
  if (isGK) return { prim: '#bef264', sec: '#4d7c0f', text: '#14532d' }; 
  const name = teamName || '';
  if (name.includes('טמפה')) return { prim: '#ef4444', sec: '#991b1b', text: '#ffffff' }; 
  if (name.includes('תומאלי') || name.includes('פיצ\'יצ\'י') || name.includes('פציצי')) return { prim: '#facc15', sec: '#1d4ed8', text: '#ffffff' }; 
  if (name.includes('חמסילי')) return { prim: '#18181b', sec: '#16a34a', text: '#facc15' }; 
  if (name.includes('חולוניה')) return { prim: '#a855f7', sec: '#4c1d95', text: '#ffffff' }; 
  if (name.includes('חראלה')) return { prim: '#78350f', sec: '#b91c1c', text: '#ffffff' }; 
  return { prim: '#3b82f6', sec: '#1e3a8a', text: '#ffffff' }; 
};

const isTeamMatch = (t1: string, t2: string) => {
    if (!t1 || !t2) return false;
    const normalize = (s: string) => s.replace(/['"״׳.-]/g, '').replace(/\s+/g, '').toLowerCase();
    const c1 = normalize(t1);
    const c2 = normalize(t2);

    if (c1 === c2) return true;

    const isMaccabiTA = (c: string) => c.includes('מכבי') && (c.includes('תא') || c.includes('תלאביב'));
    if (isMaccabiTA(c1) && isMaccabiTA(c2)) return true;

    const isHapoelTA = (c: string) => c.includes('הפועל') && (c.includes('תא') || c.includes('תלאביב'));
    if (isHapoelTA(c1) && isHapoelTA(c2)) return true;

    const isMaccabiHaifa = (c: string) => c.includes('מכבי') && c.includes('חיפה');
    if (isMaccabiHaifa(c1) && isMaccabiHaifa(c2)) return true;

    const isHapoelHaifa = (c: string) => c.includes('הפועל') && c.includes('חיפה');
    if (isHapoelHaifa(c1) && isHapoelHaifa(c2)) return true;
    
    const isHapoelJlm = (c: string) => c.includes('הפועל') && c.includes('ירושלים');
    if (isHapoelJlm(c1) && isHapoelJlm(c2)) return true;
    
    const isBeitarJlm = (c: string) => c.includes('ביתר') && c.includes('ירושלים');
    if (isBeitarJlm(c1) && isBeitarJlm(c2)) return true;

    const isMaccabiPT = (c: string) => c.includes('מכבי') && (c.includes('פת') || c.includes('תקוה') || c.includes('תקווה'));
    if (isMaccabiPT(c1) && isMaccabiPT(c2)) return true;

    const isHapoelPT = (c: string) => c.includes('הפועל') && (c.includes('פת') || c.includes('תקוה') || c.includes('תקווה'));
    if (isHapoelPT(c1) && isHapoelPT(c2)) return true;

    const isBS = (c: string) => c.includes('בש') || c.includes('בארשבע');
    if (isBS(c1) && isBS(c2)) return true;

    const isKS = (c: string) => c.includes('קש') || c.includes('שמונה');
    if (isKS(c1) && isKS(c2)) return true;

    if (c1.includes('ריינה') && c2.includes('ריינה')) return true;
    if (c1.includes('אשדוד') && c2.includes('אשדוד')) return true;
    if (c1.includes('טבריה') && c2.includes('טבריה')) return true;
    if (c1.includes('סכנין') && c2.includes('סכנין')) return true;
    if (c1.includes('נתניה') && c2.includes('נתניה')) return true;
    if (c1.includes('חדרה') && c2.includes('חדרה')) return true;

    return false;
};

const Jersey = ({ primary, secondary, textColor, text }: { primary: string, secondary: string, textColor: string, text: string }) => {
  const gradId = `grad-${primary.replace('#', '')}-${secondary.replace('#', '')}`;
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_10px_10px_rgba(0,0,0,0.6)]">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primary} />
          <stop offset="100%" stopColor={secondary} />
        </linearGradient>
      </defs>
      <path d="M 35 10 C 35 25, 65 25, 65 10 L 90 20 L 95 45 L 75 50 L 75 95 C 75 98, 25 98, 25 95 L 25 50 L 5 45 L 10 20 Z" fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
      <text x="50" y="62" fontSize="26" fontFamily="system-ui, sans-serif" fontWeight="900" fill={textColor} textAnchor="middle" dominantBaseline="middle" style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.5)' }}>{text}</text>
    </svg>
  );
};

const GhostJersey = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full opacity-40 group-hover:opacity-100 transition-opacity drop-shadow-md">
    <path d="M 35 10 C 35 25, 65 25, 65 10 L 90 20 L 95 45 L 75 50 L 75 95 C 75 98, 25 98, 25 95 L 25 50 L 5 45 L 10 20 Z" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.6)" strokeWidth="4" strokeDasharray="6 6" />
    <text x="50" y="62" fontSize="46" fontFamily="sans-serif" fontWeight="300" fill="rgba(255,255,255,0.8)" textAnchor="middle" dominantBaseline="middle">+</text>
  </svg>
);

const normalizePos = (pos: string) => {
  if (!pos) return 'DEF';
  const p = pos.trim().toUpperCase();
  if (p === 'שוער' || p === 'GK') return 'GK';
  if (p === 'הגנה' || p === 'DEF' || p === 'בלם' || p === 'מגן') return 'DEF';
  if (p === 'קישור' || p === 'MID' || p === 'קשר') return 'MID';
  if (p === 'חלוץ' || p === 'FWD' || p === 'התקפה') return 'FWD';
  return 'DEF'; 
};

const cleanStr = (s?: string | null) => String(s || '').toLowerCase().replace(/['"״׳`\s]/g, '');

const createCancelLog = (currentRound: number, playerInName: string, playerOutName: string) => ({
    id: `cancel_${Date.now()}`,
    type: 'CANCELLED_SUB',
    round: currentRound,
    playerIn: playerInName,
    playerOut: playerOutName,
    timestamp: new Date().toLocaleString('he-IL', { hour12: false })
});

const LineupManager: React.FC<LineupManagerProps> = ({ teams, loggedInUser, currentRound, isAdmin }) => {
  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    return localStorage.getItem('luzon_last_team_id') || '';
  });
  
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [activeTab, setActiveTab] = useState<'pitch' | 'transfers'>('pitch');
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('pitch');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [activeZone, setActiveZone] = useState<'GK' | 'DEF' | 'MID' | 'FWD' | null>(null);

  const [isCupModeActive, setIsCupModeActive] = useState<boolean>(false);

  const [lineup, setLineup] = useState<Player[]>([]);
  const [bench, setBench] = useState<Player[]>([]);
  const [transfersLog, setTransfersLog] = useState<any[]>([]);
  const [subOutId, setSubOutId] = useState<string>('');
  const [subInId, setSubInId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferType, setTransferType] = useState<'IN' | 'OUT'>('IN');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPos, setNewPlayerPos] = useState<'GK' | 'DEF' | 'MID' | 'FWD'>('DEF');
  const [newPlayerTeam, setNewPlayerTeam] = useState(REAL_TEAMS_ISRAEL[0]);
  const [isFreezeTransfer, setIsFreezeTransfer] = useState(false);
  const [playerOutId, setPlayerOutId] = useState('');

  const [editingLog, setEditingLog] = useState<any>(null);
  const [showAdminSquadEditor, setShowAdminSquadEditor] = useState(false);
  const [adminSquad, setAdminSquad] = useState<Player[]>([]);
  
  const [realFixtures, setRealFixtures] = useState<any[]>([]);

  const [toast, setToast] = useState<{msg: string, type: 'error'|'success'|'info'} | null>(null);
  const [appAlert, setAppAlert] = useState<{title: string, msg: string, type: 'success'|'error'|'info', whatsappText?: string} | null>(null);
  
  const [adminOverrideData, setAdminOverrideData] = useState<{playersIn: any[], playersOut: any[]} | null>(null);

  const [playoffRounds, setPlayoffRounds] = useState<number[]>([]);
  const [globalLock, setGlobalLock] = useState<boolean>(false);
  const [cupSettings, setCupSettings] = useState<{isOpen: boolean, stage: string, activeTeams: string[]}>({ isOpen: false, stage: 'groups', activeTeams: [] });

  const showToast = (msg: string, type: 'error' | 'success' | 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const displayTeams = teams.filter(t => t.teamName && t.teamName.toUpperCase() !== 'ADMIN' && t.id !== 'admin');
  
  const isMyTeam = isAdmin || (() => {
    if (!myTeam || !loggedInUser) return false;
    const uId = cleanStr(loggedInUser.id);
    const uTeamId = cleanStr(loggedInUser.teamId);
    const uName = cleanStr(loggedInUser.name);
    const uTeamName = cleanStr(loggedInUser.teamName);

    const tId = cleanStr(myTeam.id);
    const tName = cleanStr(myTeam.teamName);
    const tManager = cleanStr(myTeam.manager);

    return (
      (tId && (tId === uId || tId === uTeamId)) || 
      (tName && (tName === uTeamName || tName === uId)) || 
      (tManager && (tManager === uName)) ||
      (tName.includes('חראלה') && uTeamName.includes('חראלה')) 
    );
  })();

  const currentRole = String(loggedInUser?.role || '');
  const isManagerOrAdmin = currentRole === 'ADMIN' || currentRole === 'ARENA_MANAGER' || currentRole === 'MODERATOR' || currentRole === 'SUPER_ADMIN' || isAdmin;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'leagueData', 'real_fixtures'), doc => {
      if(doc.exists()) {
         setRealFixtures(doc.data().matches || []);
      }
    });

    const unsubSettings = onSnapshot(doc(db, 'leagueData', 'settings'), doc => {
        if(doc.exists()) {
            const data = doc.data();
            if (data.playoffRounds) setPlayoffRounds(data.playoffRounds);
            if (data.globalLock !== undefined) setGlobalLock(data.globalLock);
        }
    });

    const unsubCup = onSnapshot(doc(db, 'leagueData', 'cup_settings'), docSnap => {
        if(docSnap.exists()) {
            setCupSettings({ 
                isOpen: docSnap.data().isOpen || false, 
                stage: docSnap.data().stage || 'groups',
                activeTeams: docSnap.data().activeTeams || []
            });
        }
    });

    return () => { unsub(); unsubSettings(); unsubCup(); };
  }, []);

  const isPlayoffRound = playoffRounds.includes(currentRound);

  const handleSetTeam = (id: string) => {
    setActiveTeamId(id);
    localStorage.setItem('luzon_last_team_id', id);
  };

  useEffect(() => {
    if (displayTeams.length === 0) return;
    if (activeTeamId && displayTeams.find(t => t.id === activeTeamId)) return;
    
    let targetTeamId = displayTeams[0].id; 
    
    if (loggedInUser) {
      const uId = cleanStr(loggedInUser.id);
      const uTeamId = cleanStr(loggedInUser.teamId);
      const uName = cleanStr(loggedInUser.name);
      const uTeamName = cleanStr(loggedInUser.teamName);

      const userTeam = displayTeams.find(t => {
        const tId = cleanStr(t.id);
        const tName = cleanStr(t.teamName);
        const tManager = cleanStr(t.manager);

        return (
          (tId && (tId === uId || tId === uTeamId)) || 
          (tName && (tName === uTeamName || tName === uId)) || 
          (tManager && (tManager === uName)) ||
          (tName.includes('חראלה') && uTeamName.includes('חראלה'))
        );
      });

      if (userTeam) targetTeamId = userTeam.id;
    }
    handleSetTeam(targetTeamId);
  }, [teams, loggedInUser, activeTeamId]);

  useEffect(() => {
    if (activeTeamId) {
      const team = displayTeams.find(t => t.id === activeTeamId);
      if (team) {
        setMyTeam(team);
        
        const sourceSquad = team.squad || team.players || [];
        const safeSquad: Player[] = Array.from(new Map(
          sourceSquad.filter((p: any) => p && p.id).map((p: any) => [p.id, { ...p, position: normalizePos(p.position) }])
        ).values());

        let startingPlayers: Player[] = [];
        let benchPlayers: Player[] = [];

        if (isCupModeActive) {
            startingPlayers = (team.cup_lineup || []).map((p:any) => ({...p, isStarting: true}));
            benchPlayers = (team.cup_bench || []).map((p:any) => ({...p, isStarting: false}));
            
            if (startingPlayers.length === 0 && benchPlayers.length === 0) {
                startingPlayers = safeSquad.filter(p => p.isStarting === true);
                benchPlayers = safeSquad.filter(p => !p.isStarting);
            }
        } else {
            startingPlayers = safeSquad.filter(p => p.isStarting === true);
            benchPlayers = safeSquad.filter(p => !p.isStarting);
        }

        if (startingPlayers.length > 11) {
          const excess = startingPlayers.splice(11);
          benchPlayers.push(...excess.map(p => ({ ...p, isStarting: false })));
        }

        if (startingPlayers.length === 0 && benchPlayers.length === 0 && safeSquad.length > 0) {
          setLineup([]); setBench(safeSquad.sort((a, b) => (POS_ORDER[a.position] || 99) - (POS_ORDER[b.position] || 99)));
        } else {
          const allAssignedIds = new Set([...startingPlayers.map(p=>p.id), ...benchPlayers.map(p=>p.id)]);
          safeSquad.forEach(p => { if (!allAssignedIds.has(p.id)) benchPlayers.push({...p, isStarting: false}); });
          
          setLineup(startingPlayers); setBench(benchPlayers.sort((a, b) => (POS_ORDER[a.position] || 99) - (POS_ORDER[b.position] || 99)));
        }
        
        setTransfersLog(team.transfers || []);
      }
    }
  }, [activeTeamId, teams, isCupModeActive]);

  const usedTransfers = transfersLog.filter(t => t.type === 'IN').length;
  const freezeCount = transfersLog.filter(t => t.type === 'FREEZE_IN').length;
  const transferPercent = Math.min((usedTransfers / 14) * 100, 100);

  const activeLineup = lineup.filter(p => p && p.id && POS_ARRAY.includes(p.position));
  const activeBench = bench.filter(p => p && p.id);

  const defs = activeLineup.filter(p => p.position === 'DEF').length;
  const mids = activeLineup.filter(p => p.position === 'MID').length;
  const fwds = activeLineup.filter(p => p.position === 'FWD').length;
  const gks = activeLineup.filter(p => p.position === 'GK').length;
  const currentFormationStr = `${defs}-${mids}-${fwds}`;
  
  let isFormationValid = false;
  
  if (isCupModeActive) {
      if (cupSettings.stage === 'groups') {
          const allowedParsed = ALLOWED_FORMATIONS.map(f => {
              const parts = f.split('-'); return { d: parseInt(parts[0]), m: parseInt(parts[1]), f: parseInt(parts[2]) };
          });
          const isValidPath = allowedParsed.some(form => defs <= form.d && mids <= form.m && fwds <= form.f);
          isFormationValid = gks <= 1 && activeLineup.length > 0 && activeLineup.length <= 11 && isValidPath;
      } else {
          isFormationValid = gks <= 1 && activeLineup.length > 0 && activeLineup.length <= 11;
      }
  } else if (isPlayoffRound) {
      isFormationValid = gks <= 1 && activeLineup.length > 0 && activeLineup.length <= 11;
  } else {
      isFormationValid = activeLineup.length === 11 && ALLOWED_FORMATIONS.includes(currentFormationStr) && gks === 1;
  }

  // 🟢 פונקציית בדיקת המשחקים החדשה: ללא תלות בתוצאות, רק שעה ותאריך מוחלטים מהסוף להתחלה 🟢
  const checkIsMatchStarted = (playerRealTeam: string) => {
    if (globalLock && !isManagerOrAdmin) {
        return true;
    }

    if (!playerRealTeam) return false;
    
    const getTeamName = (teamData: any) => {
        if (!teamData) return '';
        if (typeof teamData === 'string') return teamData;
        return teamData.name || teamData.id || '';
    };

    const match = [...realFixtures].reverse().find(m => {
        const hName = m.h || getTeamName(m.homeTeam);
        const aName = m.a || getTeamName(m.awayTeam);
        return isTeamMatch(hName, playerRealTeam) || isTeamMatch(aName, playerRealTeam);
    });

    if (!match) return false;

    const hScoreRaw = match.hs ?? match.homeScore ?? match.homeTeamScore ?? match.scoreHome ?? match.score;
    const aScoreRaw = match.as ?? match.awayScore ?? match.awayTeamScore ?? match.scoreAway;
    
    const isValidScore = (val: any) => {
        if (val === undefined || val === null) return false;
        const s = String(val).trim();
        if (s === '' || s === '-' || s === 'טרם נקבע' || s === 'TBD' || s === '0') return false;
        if (!isNaN(Number(s)) && Number(s) > 0) return true;
        return false;
    };

    if (isValidScore(hScoreRaw) || isValidScore(aScoreRaw)) return true;

    const dateStr = match.date; 
    const timeStr = match.time || match.matchTime;

    if (!timeStr || typeof timeStr !== 'string' || !dateStr || typeof dateStr !== 'string') return false;

    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return false;

    const dateMatch = dateStr.match(/(\d{1,2})[\/\.-](\d{1,2})/);
    if (!dateMatch) return false;

    const matchHours = parseInt(timeMatch[1], 10);
    const matchMinutes = parseInt(timeMatch[2], 10);
    const matchDay = parseInt(dateMatch[1], 10);
    const matchMonth = parseInt(dateMatch[2], 10);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    });

    const parts = formatter.formatToParts(new Date());
    const currentYear = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const currentMonth = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const currentDay = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    let currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    if (currentHour === 24) currentHour = 0;
    const currentMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

    let matchYear = currentYear;
    if (matchMonth === 1 && currentMonth === 12) matchYear = currentYear + 1;
    else if (matchMonth === 12 && currentMonth === 1) matchYear = currentYear - 1;

    const currentAbsolute = Date.UTC(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute);
    const matchAbsolute = Date.UTC(matchYear, matchMonth - 1, matchDay, matchHours, matchMinutes);

    const diffMins = (currentAbsolute - matchAbsolute) / 60000;

    if (diffMins >= 5) {
        return true;
    }

    return false;
  };

  const checkIsHalftimeSub = (playerName: string) => {
    if (isCupModeActive) return false; 
    return transfersLog.some(t => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED' && t.playerIn === playerName);
  };

  const handleWhatsAppShare = () => {
    if (!myTeam) return;
    let text = `*${isCupModeActive ? 'הרכב גביע 🏆' : 'הרכב ליגה ⚽'} - ${myTeam.teamName}*\n*מערך: ${currentFormationStr}*\n\n`;
    
    POS_ARRAY.forEach(pos => {
      const posPlayers = lineup.filter(p => p.position === pos).map(p => {
        const isSub = checkIsHalftimeSub(p.name);
        return p.name + (isSub ? ' 🔄' : '');
      }).join(', ');
      if (posPlayers) text += `${posPlayers}\n`;
    });
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text.trim())}`, '_blank');
  };

  const openPlayerInfo = (e: React.MouseEvent, player: Player) => {
    e.stopPropagation();
    window.open(`https://www.google.com/search?q=${encodeURIComponent(player.name + ' ' + player.team + ' כדורגל')}`, '_blank');
  };

  const handleCancelSub = async (subId: string) => {
    if (!isMyTeam || !myTeam || isCupModeActive) return; 
    const subToCancel = transfersLog.find(t => t.id === subId);
    if (!subToCancel) return;

    const playerOutName = subToCancel.playerOut;
    const playerInName = subToCancel.playerIn;

    const allPlayers = [...lineup, ...bench];
    const pOut = allPlayers.find(p => p.name === playerOutName);
    const pIn = allPlayers.find(p => p.name === playerInName);

    if (pOut && pIn) {
        let currentLineup = [...lineup].filter(p => p.id !== pIn.id && p.id !== pOut.id);
        let currentBench = [...bench].filter(p => p.id !== pIn.id && p.id !== pOut.id);

        const pOutRestored = { ...pOut, isStarting: true };
        const pInRestored = { ...pIn, isStarting: false };

        currentLineup.push(pOutRestored);
        currentBench.push(pInRestored);
        currentBench.sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position]);

        setLineup(currentLineup);
        setBench(currentBench);

        const updatedSquad = (myTeam.squad || []).map(p => {
            if (p.id === pOut.id) return { ...p, isStarting: true };
            if (p.id === pIn.id) return { ...p, isStarting: false };
            return p;
        });

        const updatedTransfers = transfersLog.map(t => t.id === subId ? { ...t, status: 'CANCELLED' } : t);
        const cancelLog = createCancelLog(currentRound, playerInName, playerOutName);
        updatedTransfers.push(cancelLog);

        try {
            await updateDoc(doc(db, 'users', myTeam.id), {
                published_lineup: currentLineup,
                published_subs_out: currentBench,
                lineup: currentLineup,
                squad: updatedSquad,
                players: updatedSquad,
                transfers: updatedTransfers
            });
            setTransfersLog(updatedTransfers);
            showToast('החילוף בוטל בהצלחה והשחקן חזר למגרש!', 'success');
        } catch (e) { showToast('שגיאה בביטול החילוף', 'error'); }
    } else {
        showToast('שגיאה: לא הצלחנו למצוא את השחקנים בסגל.', 'error');
    }
  };

  const togglePlayerPosition = (player: Player, from: 'lineup' | 'bench') => {
    if (!isMyTeam) return showToast('מצב צפייה בלבד. אינך יכול לערוך.', 'error');
    const currentActiveLineup = lineup.filter(p => p && p.id && POS_ARRAY.includes(p.position));
    const currentActiveBench = bench.filter(p => p && p.id);

    if (checkIsMatchStarted(player.team)) {
        if (!isManagerOrAdmin) {
            if (globalLock) {
                return showToast(`❌ המחזור נעול! לא ניתן לבצע שינויים הקשורים ל-${player.name}.`, 'error');
            } else {
                return showToast(`❌ המשחק של ${player.team} כבר התחיל או ישוחק בקרוב מאוד! לא ניתן לעדכן.`, 'error');
            }
        } else {
            showToast(`⚠️ אזהרת מנהל: המשחק של ${player.team} החל או המחזור נעול. אישור סופי של החילוף יידרש בשמירה.`, 'info');
        }
    }

    if (from === 'bench') {
      if (currentActiveLineup.length >= 11) return showToast(`❌ ההרכב מלא (11/11). קודם הורד שחקן לספסל כדי לפנות מקום!`, 'error');
      
      const sameTeamCountInLineup = currentActiveLineup.filter(p => isTeamMatch(p.team, player.team)).length;
      
      let maxAllowedFromTeam = 2;
      if (isCupModeActive) {
          if (cupSettings.stage === 'semi' || cupSettings.stage === 'final') maxAllowedFromTeam = 3;
      } else if (isPlayoffRound) {
          maxAllowedFromTeam = 3;
      }
      
      if (sameTeamCountInLineup >= maxAllowedFromTeam) {
        return showToast(`❌ חוק לוזון: אסור יותר מ-${maxAllowedFromTeam} שחקנים מאותה קבוצה (${player.team}) בהרכב!`, 'error');
      }

      const newDefs = currentActiveLineup.filter(p => p.position === 'DEF').length + (player.position === 'DEF' ? 1 : 0);
      const newMids = currentActiveLineup.filter(p => p.position === 'MID').length + (player.position === 'MID' ? 1 : 0);
      const newFwds = currentActiveLineup.filter(p => p.position === 'FWD').length + (player.position === 'FWD' ? 1 : 0);
      const newGks = currentActiveLineup.filter(p => p.position === 'GK').length + (player.position === 'GK' ? 1 : 0);

      if (newGks > 1) return showToast('❌ חוק לוזון: מקסימום שוער 1 בהרכב הפותח!', 'error');

      let requireFormationCheck = true;
      if (isCupModeActive && (cupSettings.stage === 'semi' || cupSettings.stage === 'final')) requireFormationCheck = false;
      if (!isCupModeActive && isPlayoffRound) requireFormationCheck = false;

      if (requireFormationCheck) {
          const allowedParsed = ALLOWED_FORMATIONS.map(f => {
            const parts = f.split('-');
            return { d: parseInt(parts[0]), m: parseInt(parts[1]), f: parseInt(parts[2]) };
          });
          const isValidPath = allowedParsed.some(form => newDefs <= form.d && newMids <= form.m && newFwds <= form.f);

          if (!isValidPath) {
             return showToast(`❌ פעולה חסומה: הכנסת השחקן תגרום לחריגה ממערך חוקי!`, 'error');
          }
      }

      setLineup([...currentActiveLineup, { ...player, isStarting: true }]); 
      setBench(currentActiveBench.filter(p => p.id !== player.id).sort((a, b) => (POS_ORDER[a.position] || 99) - (POS_ORDER[b.position] || 99)));
    } else {
      setLineup(currentActiveLineup.filter(p => p.id !== player.id)); 
      setBench([...currentActiveBench, { ...player, isStarting: false }].sort((a, b) => (POS_ORDER[a.position] || 99) - (POS_ORDER[b.position] || 99)));
    }
  };

  const handleHalftimeSub = async () => {
    if (!isMyTeam || !myTeam || isCupModeActive) return showToast('חילופי מחצית זמינים רק למשחקי ליגה!', 'error');
    if (!subOutId || !subInId) return showToast('בחר שחקן יוצא ונכנס', 'error');
    
    const activeSubs = transfersLog.filter(t => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
    if (activeSubs.length >= 3) return showToast('❌ ביצעת 3 חילופי מחצית במחזור זה!', 'error');

    const playerOut = lineup.find(p => p.id === subOutId);
    const playerIn = bench.find(p => p.id === subInId);
    
    if (playerOut && playerIn) {
      const isDuplicate = activeSubs.some((t:any) => t.playerIn === playerIn.name && t.playerOut === playerOut.name);
      if (isDuplicate) return showToast(`❌ החילוף הזה כבר בוצע!`, 'error');

      const pInUpdated = { ...playerIn, isStarting: true };
      const pOutUpdated = { ...playerOut, isStarting: false };

      const newLineup = [...lineup.filter(p => p.id !== subOutId), pInUpdated];
      
      const testFormation = `${newLineup.filter(p => p.position === 'DEF').length}-${newLineup.filter(p => p.position === 'MID').length}-${newLineup.filter(p => p.position === 'FWD').length}`;
      if (newLineup.filter(p => p.position === 'GK').length !== 1) return showToast('חייב להישאר שוער אחד!', 'error');
      
      if (!isPlayoffRound && !ALLOWED_FORMATIONS.includes(testFormation)) return showToast(`מערך ${testFormation} לא חוקי.`, 'error');
      
      const teamCounts: Record<string, number> = {}; let teamViolation = false;
      const maxAllowedFromTeam = isPlayoffRound ? 3 : 2;

      newLineup.forEach(p => { 
        let foundKey = Object.keys(teamCounts).find(k => isTeamMatch(k, p.team));
        if (!foundKey) foundKey = p.team;
        teamCounts[foundKey] = (teamCounts[foundKey] || 0) + 1; 
        if (teamCounts[foundKey] > maxAllowedFromTeam) teamViolation = true; 
      });

      if (teamViolation) return showToast(`❌ חוק לוזון: מקסימום ${maxAllowedFromTeam} שחקנים מאותה קבוצה (${playerIn.team}) בהרכב!`, 'error');

      const newBench = [...bench.filter(p => p.id !== subInId), pOutUpdated].sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position]);
      
      setLineup(newLineup); 
      setBench(newBench);
      
      const subLog = { 
          id: `sub_${Date.now()}`, 
          type: 'HALFTIME_SUB', 
          round: currentRound, 
          playerIn: playerIn.name, 
          playerOut: playerOut.name, 
          status: 'ACTIVE',
          timestamp: new Date().toLocaleString('he-IL', { hour12: false }) 
      };

      const updatedSquad = (myTeam.squad || []).map(p => {
          if (p.id === subOutId) return { ...p, isStarting: false };
          if (p.id === subInId) return { ...p, isStarting: true };
          return p;
      });
      
      try {
          await updateDoc(doc(db, 'users', myTeam.id), { 
              transfers: arrayUnion(subLog), 
              published_lineup: newLineup, 
              published_subs_out: newBench,
              lineup: newLineup,
              squad: updatedSquad,
              players: updatedSquad
          });
          setTransfersLog([...transfersLog, subLog]); 
          showToast(`✅ חילוף בוצע: ${playerIn.name} נכנס והזירה עודכנה!`, 'success'); 
          setSubOutId(''); 
          setSubInId('');
      } catch (e) { showToast('שגיאה בביצוע החילוף', 'error'); }
    }
  };

  const handleSaveLineup = async () => {
    if (!isMyTeam || !myTeam || !isFormationValid) return;
    
    if (!isCupModeActive && !isPlayoffRound && activeLineup.length !== 11) return;
    
    const previousLineup = isCupModeActive ? (myTeam.cup_lineup || []) : (myTeam.published_lineup || []);
    
    const oldLineupNames = new Set(previousLineup.map((p: any) => p.name));
    const newLineupNames = new Set(activeLineup.map(p => p.name));

    const playersIn = activeLineup.filter(p => !oldLineupNames.has(p.name));
    const playersOut = previousLineup.filter((p: any) => !newLineupNames.has(p.name));

    const changedPlayers = [...playersIn, ...playersOut];
    let lockedPlayerFound = null;

    for (const p of changedPlayers) {
        if (checkIsMatchStarted(p.team)) {
            lockedPlayerFound = p;
            break;
        }
    }

    if (lockedPlayerFound) {
        if (!isManagerOrAdmin) {
            const playersInNamesStr = playersIn.map((p:any) => p.name).join(', ') || 'אין';
            const playersOutNamesStr = playersOut.map((p:any) => p.name).join(', ') || 'אין';
            
            const waText = globalLock 
                ? `*בקשת אישור חילוף במחזור נעול* 🚨\n\nהיי מנהל זירה, המחזור נעול כעת.\nאשמח לאישור חריג להרכב שלי:\n\n⬇️ יורד מהדשא: ${playersOutNamesStr}\n⬆️ עולה להרכב: ${playersInNamesStr}`
                : `*בקשת חילוף חריג ממנהל זירה* 🚨\n\nהמשחק של ${lockedPlayerFound.team} כבר התחיל.\nאשמח לאישור ידני להרכב שלי:\n\n⬇️ יורד מהדשא: ${playersOutNamesStr}\n⬆️ עולה להרכב: ${playersInNamesStr}`;

            setAppAlert({
                title: globalLock ? 'המחזור נעול' : 'שגיאה: המשחק התחיל',
                msg: globalLock ? 'המחזור ננעל על ידי ההנהלה. לא ניתן לבצע שינויים בשלב זה. בקש אישור חריג במידת הצורך.' : `המשחק של ${lockedPlayerFound.team} כבר החל!\nלא ניתן לעדכן את ${lockedPlayerFound.name}. אם יש סיבה חריגה (כמו דחיית משחק), שלח הודעה למנהל הזירה:`,
                type: 'error',
                whatsappText: waText
            });
            return; 
        } else {
            setAdminOverrideData({playersIn, playersOut});
            return;
        }
    }

    await executeSaveLineup(false, playersIn, playersOut);
  };

  const executeSaveLineup = async (isOverride: boolean, playersIn: any[], playersOut: any[]) => {
    setIsSaving(true);
    try {
      const updatedSquad = [...activeLineup.map(p => ({ ...p, isStarting: true })), ...activeBench.map(p => ({ ...p, isStarting: false }))];

      const playersInNames = playersIn.map((p:any) => p.name);
      const playersOutNames = playersOut.map((p:any) => p.name);

      const newTransfers = [...transfersLog];

      const updateData: any = {};
      
      if (isCupModeActive) {
          updateData.cup_lineup = activeLineup;
          updateData.cup_bench = activeBench;
      } else {
          updateData.squad = updatedSquad;
          updateData.players = updatedSquad;
          updateData.published_lineup = activeLineup;
          updateData.published_subs_out = activeBench;
          updateData.lineup = activeLineup;
          updateData.lastLineupUpdate = new Date().toISOString();
          
          if (playersInNames.length > 0 || playersOutNames.length > 0) {
              const editLog = {
                  id: `edit_${Date.now()}`,
                  type: isOverride ? 'LATE_REGULAR_EDIT' : 'REGULAR_EDIT',
                  round: currentRound,
                  playersIn: playersInNames,
                  playersOut: playersOutNames,
                  timestamp: new Date().toLocaleString('he-IL', { hour12: false })
              };
              newTransfers.push(editLog);
              updateData.transfers = arrayUnion(editLog);
              setTransfersLog(newTransfers);
          }
      }

      await updateDoc(doc(db, 'users', myTeam!.id), updateData);
      
      showToast(`✅ הרכב ${isCupModeActive ? 'הגביע' : 'הליגה'} נשמר בהצלחה!`, 'success');
      
    } catch (e) { showToast('שגיאה בשמירה', 'error'); }
    setIsSaving(false);
    setAdminOverrideData(null);
  };

  const handleClearPitch = () => {
    if (!isMyTeam) return;
    const allPlayers = [...lineup, ...bench];
    setLineup([]); setBench(allPlayers.sort((a, b) => (POS_ORDER[a.position] || 99) - (POS_ORDER[b.position] || 99)));
    showToast('המגרש נוקה.', 'success');
  };

  const executeTransfer = async () => {
    if (!isMyTeam || !myTeam) return;

    if (transferType === 'OUT') {
       const playerToSell = (myTeam.squad || []).find((p: any) => p.id === playerOutId);
       if (playerToSell && checkIsMatchStarted(playerToSell.team) && !isManagerOrAdmin) {
           return showToast(`❌ המשחק של ${playerToSell.team} כבר החל (או המחזור נעול)! לא ניתן למכור.`, 'error');
       }
    }
    
    if (transferType === 'IN') {
       if (newPlayerTeam && checkIsMatchStarted(newPlayerTeam) && !isManagerOrAdmin) {
           return showToast(`❌ המשחק של ${newPlayerTeam} כבר החל (או המחזור נעול)! לא ניתן לרכוש.`, 'error');
       }
    }

    const timestamp = new Date().toLocaleString('he-IL', { hour12: false });
    let updatedSquad = myTeam.squad || [];
    let logEntry: any = null; 
    let updatedLineup = [...lineup]; 
    let updatedBench = [...bench];
    let soldPlayerForLog: any = null;
    let boughtPlayerName = '';

    if (transferType === 'IN') {
      if (!newPlayerName.trim()) return showToast('נא להזין שם שחקן.', 'error');
      if (!isFreezeTransfer && usedTransfers >= 14) {
        if(!window.confirm('⚠️ ניצלת את כל 14 החילופים! האם להמשיך בכל זאת?')) return;
      }
      boughtPlayerName = newPlayerName;
      const newPlayer: Player = { 
        id: `p_${Math.random().toString(36).substr(2,9)}_${Date.now()}`, 
        name: newPlayerName, 
        position: newPlayerPos, 
        team: newPlayerTeam, 
        points: 0, 
        breakdown: [],
        isStarting: false 
      };
      updatedSquad = [...updatedSquad, newPlayer];
      updatedBench = [...bench, newPlayer].sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position]);
      setBench(updatedBench);
      logEntry = { id: `tr_${Date.now()}`, type: isFreezeTransfer ? 'FREEZE_IN' : 'IN', player: newPlayerName, team: newPlayerTeam, position: newPlayerPos, timestamp };
    } else {
      if (!playerOutId) return showToast('נא לבחר שחקן למכירה.', 'error');
      const playerToSell = updatedSquad.find(p => p.id === playerOutId);
      if (!playerToSell) return showToast('השחקן לא נמצא בסגל!', 'error');
      
      soldPlayerForLog = playerToSell;
      updatedSquad = updatedSquad.filter(p => p.id !== playerOutId);
      updatedLineup = lineup.filter(p => p.id !== playerOutId);
      updatedBench = bench.filter(p => p.id !== playerOutId).sort((a, b) => POS_ORDER[a.position] - POS_ORDER[b.position]);
      setLineup(updatedLineup); setBench(updatedBench);
      logEntry = { id: `tr_${Date.now()}`, type: 'OUT', player: playerToSell.name, team: playerToSell.team, position: playerToSell.position, timestamp };
    }

    try {
      const updateData: any = { 
        squad: updatedSquad, 
        players: updatedSquad, 
        transfers: arrayUnion(logEntry),
        published_lineup: updatedLineup,
        lineup: updatedLineup,
        published_subs_out: updatedBench 
      };
      
      await updateDoc(doc(db, 'users', myTeam.id), updateData);
      setTransfersLog([logEntry, ...transfersLog]);
      showToast(`✅ פעולת הרכש בוצעה! השחקן ממתין בחדר ההלבשה.`, 'success');
      
      if (transferType === 'OUT' && soldPlayerForLog) {
          await addDoc(collection(db, 'logs_deleted_players'), {
              teamName: myTeam.teamName,
              teamId: myTeam.id,
              managerName: loggedInUser?.name || myTeam.manager || 'לא ידוע',
              playerName: soldPlayerForLog.name,
              playerPos: soldPlayerForLog.position,
              playerRealTeam: soldPlayerForLog.team,
              timestamp: new Date().toISOString()
          });
      }

      const activeApiKey = process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

      if (activeApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: activeApiKey });
          
          let aiPrompt = "";
          if (transferType === 'IN') {
             aiPrompt = `אתה פרשן כדורגל ופנטזי עוקצני ומשעשע. קבוצת הפנטזי "${myTeam.teamName}" הרגע החתימה את השחקן "${boughtPlayerName}" שמשחק ב"${newPlayerTeam}". 
             כתוב ציוץ (עד 3 משפטים) שמדווח על הרכש הזה לפיד של הליגה שלנו ("פנטזי לוזון 13"). תהיה מצחיק, תעקוץ או תחמיא למנג'ר על המהלך. בלי כוכביות או סולמיות (האשטגים). הוסף אימוג'י.`;
          } else {
             aiPrompt = `אתה פרשן כדורגל ופנטזי עוקצני ומשעשע. קבוצת הפנטזי "${myTeam.teamName}" הרגע חתכה וזרקה מהסגל שלה את השחקן "${soldPlayerForLog.name}". 
             כתוב ציוץ (עד 3 משפטים) שמדווח על המכירה הזו לפיד של הליגה שלנו ("פנטזי לוזון 13"). תהיה מצחיק, תגיד שזה צעד מתבקש או צעד מטופש. בלי כוכביות או סולמיות (האשטגים). הוסף אימוג'י.`;
          }

          const response = await ai.models.generateContent({
              model: "gemini-1.5-flash-latest",
              contents: aiPrompt
          });

          if (response.text) {
             await addDoc(collection(db, 'social_posts'), {
                 authorName: 'האנליסט AI 🤖',
                 handle: '@luzon_analyst',
                 teamId: 'system',
                 isVerified: true,
                 type: 'alert',
                 content: response.text,
                 likes: Math.floor(Math.random() * 5) + 1,
                 likedBy: [],
                 comments: [],
                 timestamp: new Date().toISOString()
             });
          }
        } catch (aiErr) {
          console.error("AI Post Generation Failed:", aiErr);
        }
      }

      setShowTransferModal(false); setNewPlayerName(''); setIsFreezeTransfer(false); setPlayerOutId('');
    } catch (e) { showToast('שגיאה בביצוע הפעולה.', 'error'); }
  };

  const handleDeleteLog = async (logId: string) => {
    const updatedLogs = transfersLog.filter(t => t.id !== logId);
    try {
      await updateDoc(doc(db, 'users', myTeam!.id), { transfers: updatedLogs });
      setTransfersLog(updatedLogs); showToast('✅ הרישום נמחק מההיסטוריה.', 'success');
    } catch(e) { showToast('שגיאה במחיקה', 'error'); }
  };

  const saveLogEdit = async () => {
    if(!editingLog) return;
    const updatedLogs = transfersLog.map(t => t.id === editingLog.id ? editingLog : t);
    try {
      await updateDoc(doc(db, 'users', myTeam!.id), { transfers: updatedLogs });
      setTransfersLog(updatedLogs); setEditingLog(null); showToast('✅ הרישום עודכן.', 'success');
    } catch(e) { showToast('שגיאה בעדכון', 'error'); }
  };

  const handleSaveAdminSquad = async () => {
    if (!myTeam) return;
    setIsSaving(true);
    try {
      const validIds = new Set(adminSquad.map(x => x.id));
      
      const deletedPlayers = (myTeam.squad || []).filter((p: any) => !validIds.has(p.id));

      const updatedLineup = (myTeam.published_lineup || []).filter((x:any) => validIds.has(x.id)).map((x:any) => adminSquad.find(a => a.id === x.id)!);
      const updatedSubs = (myTeam.published_subs_out || []).filter((x:any) => validIds.has(x.id)).map((x:any) => adminSquad.find(a => a.id === x.id)!);
      
      const existingIds = new Set([...updatedLineup.map((x:any) => x.id), ...updatedSubs.map((x:any) => x.id)]);
      const newlyAddedToAdmin = adminSquad.filter(x => !existingIds.has(x.id));
      newlyAddedToAdmin.forEach(p => p.isStarting = false);
      const finalSubs = [...updatedSubs, ...newlyAddedToAdmin];

      await updateDoc(doc(db, 'users', myTeam.id), { 
          squad: adminSquad, 
          players: adminSquad, 
          published_lineup: updatedLineup, 
          published_subs_out: finalSubs 
      });

      for (const dp of deletedPlayers) {
          await addDoc(collection(db, 'logs_deleted_players'), {
              teamName: myTeam.teamName,
              teamId: myTeam.id,
              managerName: `${loggedInUser?.name || 'אדמין'} (דרך ניהול סגל)`,
              playerName: dp.name,
              playerPos: dp.position,
              playerRealTeam: dp.team,
              timestamp: new Date().toISOString()
          });
      }

      showToast('✅ הסגל עודכן (אדמין)', 'success'); setShowAdminSquadEditor(false);
    } catch(e) { showToast('שגיאה בעדכון הסגל', 'error'); }
    setIsSaving(false);
  };

  if (!myTeam) return <div className="flex justify-center items-center pt-32 h-full"><div className="w-10 h-10 border-[3px] border-green-500/20 border-t-green-500 rounded-full animate-spin"></div></div>;

  const renderListRow = (player: Player, isBench: boolean) => {
    const isSub = checkIsHalftimeSub(player.name);
    const colors = getTeamColors(myTeam?.teamName || '', player.position === 'GK');
    
    return (
      <div key={player.id} onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }} className="flex items-center justify-between bg-slate-800/40 hover:bg-slate-800 p-3 rounded-2xl border border-slate-700/50 cursor-pointer transition-all active:scale-[0.98] group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 relative">
            <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={player.position === 'GK' ? '🧤' : player.position} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-white text-sm md:text-base group-hover:text-green-400 transition-colors flex items-center gap-2">
              {player.name} {isSub && <span className="bg-orange-500 text-black text-[8px] px-1.5 py-0.5 rounded-full uppercase font-black">חילוף</span>}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{player.team}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isMyTeam && (
            <button
              onClick={(e) => { e.stopPropagation(); togglePlayerPosition(player, isBench ? 'bench' : 'lineup'); }}
              className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-black border transition-all active:scale-95 flex items-center gap-1 ${isBench ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-600'}`}
            >
              {isBench ? '⬆️ להרכב' : '⬇️ לספסל'}
            </button>
          )}
          <div className="font-black text-green-400 text-lg md:text-xl w-8 text-center">{player.points || 0}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 font-sans animate-in fade-in pb-32" dir="rtl">
      
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.8)] border flex items-center gap-3 animate-in slide-in-from-top-10 duration-300 backdrop-blur-xl ${toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' : 'bg-green-950/90 border-green-500/50 text-green-200'}`}>
          <span className="text-2xl">{toast.type === 'error' ? '🛑' : toast.type === 'info' ? '⚠️' : '✅'}</span>
          <span className="font-black text-sm tracking-wide">{toast.msg}</span>
        </div>
      )}

      {/* 🟢 באנר נעילה גלובלית 🟢 */}
      {globalLock && (
          <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 p-4 rounded-[24px] shadow-2xl border border-white/20 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-4">
                  <Lock className="w-8 h-8 text-white" />
                  <div>
                      <h3 className="text-white font-black text-lg md:text-xl tracking-wide">המחזור נעול לעדכונים!</h3>
                      <p className="text-white/80 text-xs md:text-sm font-bold">לא ניתן לבצע חילופים או שינויים בהרכב בשלב זה.</p>
                  </div>
              </div>
          </div>
      )}

      {/* 🟢 באנר פלייאוף צעקני 🟢 */}
      {isPlayoffRound && !isCupModeActive && !globalLock && (
          <div className="bg-gradient-to-r from-purple-600 via-rose-500 to-orange-500 p-4 rounded-[24px] shadow-2xl border border-white/20 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-4">
                  <Siren className="w-8 h-8 text-white" />
                  <div>
                      <h3 className="text-white font-black text-lg md:text-xl tracking-wide">מחזור פלייאוף פעיל! (מקוצר)</h3>
                      <p className="text-white/80 text-xs md:text-sm font-bold">חוקי הרכב שוחררו: מותר לעלות הרכב חסר (פחות מ-11), ללא חובת מערך מוגדר, ועד 3 שחקנים מאותה קבוצה!</p>
                  </div>
              </div>
          </div>
      )}

      {/* 🟢 באנר חלון גביע 🟢 */}
      {cupSettings.isOpen && cupSettings.activeTeams?.includes(myTeam.id) && (
          <div className="bg-gradient-to-r from-yellow-600 via-amber-500 to-orange-500 p-1 md:p-1.5 rounded-[24px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 relative z-50 mt-2 mb-6">
              <div className="flex items-center gap-3 px-4 py-2">
                  <Trophy className="w-8 h-8 text-white drop-shadow-md" />
                  <div>
                      <h3 className="text-white font-black text-sm md:text-base leading-tight tracking-wide">הגביע פתוח להרכבים!</h3>
                      <p className="text-white/90 text-[10px] md:text-xs font-bold">בחר לאיזה מפעל אתה שומר את ההרכב כעת:</p>
                  </div>
              </div>
              <div className="flex bg-black/30 p-1 rounded-2xl w-full md:w-auto">
                  <button 
                      onClick={() => setIsCupModeActive(false)} 
                      className={`flex-1 md:w-32 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all ${!isCupModeActive ? 'bg-white text-black shadow-lg' : 'text-white/70 hover:text-white'}`}
                  >
                      ⚽ הרכב ליגה
                  </button>
                  <button 
                      onClick={() => setIsCupModeActive(true)} 
                      className={`flex-1 md:w-32 py-2.5 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-1.5 ${isCupModeActive ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'text-white/70 hover:text-white'}`}
                  >
                      <Trophy className="w-3.5 h-3.5" /> הרכב גביע
                  </button>
              </div>
          </div>
      )}

      {/* 🟢 חלונות התראות ואישור חריג 🟢 */}
      {appAlert && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center px-4 pb-[95px] md:pb-[100px] bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-8 rounded-[32px] w-full max-w-md shadow-2xl flex flex-col items-center text-center">
            {appAlert.type === 'success' && <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6"><CheckCircle2 className="w-10 h-10 text-green-500" /></div>}
            {appAlert.type === 'error' && <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6"><AlertTriangle className="w-10 h-10 text-red-500" /></div>}
            {appAlert.type === 'info' && <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6"><span className="text-4xl">ℹ️</span></div>}
            <h3 className="text-2xl font-black text-white mb-2">{appAlert.title}</h3>
            <p className="text-slate-400 font-bold mb-8 whitespace-pre-wrap leading-relaxed">{appAlert.msg}</p>
            
            {appAlert.whatsappText && (
              <button 
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(appAlert.whatsappText!)}`, '_blank')}
                className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] font-black py-4 rounded-xl border border-[#25D366]/30 mb-3 flex justify-center items-center gap-2 transition-all active:scale-95"
              >
                <Share2 className="w-5 h-5" /> שלח בקשה בווצאפ
              </button>
            )}
            
            <button onClick={() => setAppAlert(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all active:scale-95">סגור</button>
          </div>
        </div>
      )}

      {adminOverrideData && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center px-4 pb-[95px] md:pb-[100px] bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/50 p-8 rounded-[32px] w-full max-w-md shadow-2xl flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-10 h-10 text-purple-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">אישור חילוף חריג</h3>
            <p className="text-slate-400 font-bold mb-6 whitespace-pre-wrap leading-relaxed">
              שים לב! המשחק של חלק מהשחקנים בחילוף זה כבר התחיל או שהמחזור נעול כעת.<br/>
              בתור מנהל זירה/אדמין, האם תרצה לאשר את החילוף בכל זאת?
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => executeSaveLineup(true, adminOverrideData.playersIn, adminOverrideData.playersOut)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl transition-all active:scale-95"
              >
                אשר ועדכן
              </button>
              <button
                onClick={() => setAdminOverrideData(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all active:scale-95"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900/60 backdrop-blur-xl p-4 md:p-6 rounded-[32px] border border-white/5 shadow-2xl relative z-40 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-auto flex justify-between items-center">
          <button onClick={() => setShowTeamDropdown(!showTeamDropdown)} className="flex items-center gap-2 group outline-none">
            <h2 className="text-2xl md:text-3xl font-black text-white italic tracking-tight group-hover:text-green-400 transition-colors drop-shadow-md">
              {myTeam.teamName}
            </h2>
            <ChevronDown className={`w-6 h-6 text-slate-500 group-hover:text-green-400 transition-transform duration-300 ${showTeamDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showTeamDropdown && (
            <div className="absolute top-full right-0 mt-3 w-56 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="max-h-64 overflow-y-auto py-2 custom-scrollbar">
                {displayTeams.map(t => (
                  <button key={t.id} onClick={() => {handleSetTeam(t.id); setShowTeamDropdown(false);}} className={`w-full text-right px-5 py-3.5 text-sm font-black transition-colors ${activeTeamId === t.id ? 'bg-green-500/10 text-green-400 border-l-4 border-green-500' : 'text-slate-300 hover:bg-slate-800/80'}`}>
                    {t.teamName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex md:hidden items-center gap-2">
            {activeTab === 'pitch' && isMyTeam && (
              <button onClick={handleClearPitch} title="נקה מגרש (הורד את כולם לספסל)" className="bg-slate-800 p-2.5 rounded-xl text-slate-400 hover:text-white transition-colors">
                <Eraser className="w-4 h-4" />
              </button>
            )}
            {isAdmin && (
              <button onClick={() => { setAdminSquad(myTeam?.squad || []); setShowAdminSquadEditor(true); }} title="ניהול סגל אדמין" className="bg-indigo-500/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30">
                <Settings2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {activeTab === 'pitch' && isMyTeam && (
            <button onClick={handleClearPitch} title="נקה מגרש (הורד את כולם לספסל)" className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-all flex items-center gap-2 active:scale-95 font-bold text-xs shadow-md">
              <Eraser className="w-4 h-4" /> נקה מגרש
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { setAdminSquad(myTeam?.squad || []); setShowAdminSquadEditor(true); }} title="ניהול סגל אדמין" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl transition-all flex items-center gap-2 active:scale-95 font-black text-xs shadow-[0_0_20px_rgba(79,70,229,0.4)]">
              <Settings2 className="w-4 h-4" /> ניהול סגל אדמין
            </button>
          )}
        </div>
      </div>

      <div className="bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 flex w-full lg:max-w-lg lg:mx-auto shadow-inner relative z-30">
        <button 
          onClick={() => { setActiveTab('pitch'); setViewMode('pitch'); }} 
          className={`flex-1 py-3.5 rounded-xl text-[13px] md:text-sm font-black transition-all flex justify-center items-center gap-2 relative z-10 ${activeTab === 'pitch' && viewMode === 'pitch' ? 'bg-slate-800 text-white shadow-lg border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <LayoutGrid className="w-4 h-4 md:w-5 md:h-5" /> מגרש
        </button>
        <button 
          onClick={() => { setActiveTab('pitch'); setViewMode('list'); }} 
          className={`flex-1 py-3.5 rounded-xl text-[13px] md:text-sm font-black transition-all flex justify-center items-center gap-2 relative z-10 ${activeTab === 'pitch' && viewMode === 'list' ? 'bg-slate-800 text-white shadow-lg border border-white/5' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <List className="w-4 h-4 md:w-5 md:h-5" /> חדר הלבשה
        </button>
        <button 
          onClick={() => setActiveTab('transfers')} 
          className={`flex-1 py-3.5 rounded-xl text-[13px] md:text-sm font-black transition-all flex justify-center items-center gap-2 relative z-10 ${activeTab === 'transfers' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg border border-blue-500/50' : 'text-slate-500 hover:text-slate-300'}`}
        >
           <History className="w-4 h-4 md:w-5 md:h-5" /> ניהול רכש
        </button>
      </div>

      {!isMyTeam && (
        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-center flex justify-center items-center gap-2 backdrop-blur-sm">
          <span className="text-xl">👀</span>
          <span className="text-red-400 text-xs font-black tracking-wide">מצב צפייה. אינך מנהל קבוצה זו.</span>
        </div>
      )}

      {activeTab === 'pitch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className={`flex-col gap-6 order-2 lg:order-1 ${viewMode === 'list' ? 'hidden lg:flex lg:col-span-4' : 'flex lg:col-span-4'}`}>
            
            {/* פאנל חילופי מחצית - לא מופיע בגביע */}
            {!isCupModeActive && (
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-[32px] border border-orange-500/20 p-5 shadow-[0_0_30px_rgba(249,115,22,0.05)]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-white flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-orange-500" /> חילופי מחצית
                    </h3>
                    <span className="text-[10px] font-black bg-orange-500/10 text-orange-400 px-3 py-1.5 rounded-lg border border-orange-500/30">
                      {transfersLog.filter(t => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED').length} / 3
                    </span>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="relative">
                      <select value={subOutId} onChange={e => setSubOutId(e.target.value)} disabled={!isMyTeam || globalLock} className="w-full bg-slate-950/80 text-slate-300 text-sm font-bold p-3.5 rounded-2xl border border-red-500/30 focus:border-red-500 outline-none appearance-none pr-10">
                        <option value="">בחר שחקן יוצא (מההרכב)</option>
                        {lineup.sort((a,b)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
                      </select>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-lg">⬇️</span>
                    </div>
                    
                    <div className="relative">
                      <select value={subInId} onChange={e => setSubInId(e.target.value)} disabled={!isMyTeam || globalLock} className="w-full bg-slate-950/80 text-slate-300 text-sm font-bold p-3.5 rounded-2xl border border-green-500/30 focus:border-green-500 outline-none appearance-none pr-10">
                        <option value="">בחר שחקן נכנס (מהספסל)</option>
                        {bench.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
                      </select>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-lg">⬆️</span>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleHalftimeSub} disabled={!isMyTeam || !subOutId || !subInId || globalLock} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-30 disabled:grayscale text-black font-black py-3.5 rounded-2xl text-sm transition-all shadow-lg active:scale-95">
                        בצע חילוף ⚡
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const activeSubs = transfersLog.filter(t => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
                    if (activeSubs.length === 0) return null;
                    
                    return (
                        <div className="pt-4 border-t border-slate-800">
                            <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-widest">חילופים פעילים</h4>
                            <div className="space-y-2">
                                {activeSubs.map(sub => (
                                    <div key={sub.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                        <div className="flex items-center gap-2 text-xs font-black">
                                            <span className="text-red-400 line-through decoration-red-900/50">{sub.playerOut}</span>
                                            <span className="text-slate-600">➔</span>
                                            <span className="text-green-400">{sub.playerIn}</span>
                                        </div>
                                        {isMyTeam && (
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => {
                                                        const text = `*חילוף מחצית בזמן אמת!* 🔄\n*קבוצה:* ${myTeam.teamName}\n*מחזור:* ${currentRound}\n\n⬇️ יצא: ${sub.playerOut}\n⬆️ נכנס: ${sub.playerIn}`;
                                                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                    }}
                                                    className="p-1.5 bg-[#25D366]/10 text-[#25D366] rounded-lg hover:bg-[#25D366] hover:text-white transition-colors border border-[#25D366]/20 flex items-center justify-center"
                                                    title="שתף חילוף לווצאפ"
                                                >
                                                    <Share2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => handleCancelSub(sub.id)}
                                                    className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors border border-red-500/20"
                                                    title="בטל חילוף"
                                                >
                                                    <Undo2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                  })()}
                </div>
            )}

            {viewMode === 'pitch' && (
              <div className="hidden lg:flex flex-col bg-slate-900/60 backdrop-blur-xl rounded-[32px] border border-white/5 p-5 shadow-2xl flex-1 min-h-[300px]">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                  <h3 className="font-black text-white text-lg flex items-center gap-2">🪑 ספסל</h3>
                  <span className="text-slate-500 font-mono text-xs font-bold">{bench.length} שחקנים</span>
                </div>
                
                {bench.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                    <span className="text-4xl mb-3">💨</span>
                    <span className="text-sm font-black">הספסל ריק לחלוטין</span>
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {bench.map(player => {
                    const colors = getTeamColors(myTeam?.teamName || '', player.position === 'GK');
                    return (
                      <div key={player.id} onClick={() => setSelectedPlayer(player)} className="flex items-center justify-between bg-slate-800/40 hover:bg-slate-800 p-3 rounded-2xl border border-transparent hover:border-slate-700 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 shrink-0 relative">
                             <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={player.position === 'GK' ? '🧤' : player.position} />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-200 group-hover:text-white transition-colors">{player.name}</div>
                            <div className="text-[10px] text-slate-500 font-bold">{player.team}</div>
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 group-hover:bg-green-500/20 group-hover:text-green-400 transition-colors">
                          <ChevronDown className="w-4 h-4 -rotate-90" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={`${viewMode === 'list' ? 'lg:col-span-8 w-full' : 'lg:col-span-8'} order-1 lg:order-2`}>
            {viewMode === 'list' ? (
              
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-[32px] md:rounded-[40px] border border-white/5 p-4 md:p-8 shadow-2xl h-full animate-in fade-in">
                <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                  <h3 className="text-xl md:text-3xl font-black text-white italic flex items-center gap-3">
                    <span className="text-3xl hidden sm:block">📋</span> חדר הלבשה
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">מערך {currentFormationStr}</span>
                    <div className={`text-xs md:text-sm font-black px-4 py-2 rounded-full border ${activeLineup.length === 11 ? (isFormationValid ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20') : isFormationValid ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {lineup.length} / 11
                    </div>
                  </div>
                </div>
                 
                <div className="mb-10">
                  <h4 className="text-lg md:text-xl font-black text-green-400 mb-4 flex items-center gap-2 border-b border-green-500/20 pb-2">
                    <span className="text-2xl">🏃‍♂️</span> הרכב פותח
                  </h4>
                  {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
                     const playersInPos = lineup.filter(p => p.position === pos);
                     if (playersInPos.length === 0) return null;
                     
                     return (
                       <div key={pos} className="mb-4">
                         <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 pl-2">
                           {pos === 'GK' ? 'שוער' : pos === 'DEF' ? 'הגנה' : pos === 'MID' ? 'קישור' : 'התקפה'}
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {playersInPos.map(player => renderListRow(player, false))}
                         </div>
                       </div>
                     );
                  })}
                </div>

                <div>
                  <h4 className="text-lg md:text-xl font-black text-slate-400 mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-2">
                    <span className="text-2xl">🪑</span> ספסל מחליפים
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {bench.sort((a,b)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map(player => renderListRow(player, true))}
                  </div>
                </div>
              </div>

            ) : (
              <div className={`relative w-full h-[600px] sm:h-[650px] md:h-[800px] rounded-[40px] overflow-hidden shadow-2xl border-[8px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] animate-in fade-in flex flex-col shrink-0 ${isCupModeActive ? 'border-amber-900 from-yellow-800 via-amber-900 to-[#1e1005]' : 'border-[#0B1120] from-emerald-800 via-green-900 to-green-950'}`}>
                <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #ffffff 40px, #ffffff 80px)' }}></div>
                
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[15%] border-[2px] border-white/30 rounded-b-3xl pointer-events-none"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/6 h-[6%] border-[2px] border-white/30 rounded-b-lg pointer-events-none"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[18%] border-[2px] border-white/30 rounded-t-[40px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/4 h-[8%] border-[2px] border-white/30 rounded-t-xl pointer-events-none"></div>
                <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-2 h-2 bg-white/40 rounded-full pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-[2px] border-white/30 rounded-full pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full pointer-events-none"></div>
                <div className="absolute top-1/2 w-full border-t-[2px] border-white/30 pointer-events-none"></div>

                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50 pointer-events-none">
                  <div className={`bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border flex items-center gap-2 shadow-lg ${isCupModeActive ? 'border-yellow-500/30' : 'border-white/10'}`}>
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">מערך</span>
                    <span className={`text-sm font-black ${isFormationValid ? 'text-white' : 'text-red-400'}`}>{currentFormationStr}</span>
                  </div>
                  <div className={`bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border shadow-lg text-sm font-black tracking-wider ${isCupModeActive ? 'border-yellow-500/30' : 'border-white/10'} ${activeLineup.length === 11 ? (isFormationValid ? 'text-green-400' : 'text-red-400') : isFormationValid ? 'text-orange-400' : 'text-red-400'}`}>
                    {activeLineup.length}/11
                  </div>
                </div>

                <div className="absolute inset-0 pt-16 pb-6 flex flex-col justify-around z-20">
                  {['GK', 'DEF', 'MID', 'FWD'].map((pos, rowIndex) => {
                    const posPlayers = lineup.filter(p => p.position === pos);
                    const maxPos = pos === 'GK' ? 1 : pos === 'DEF' ? 5 : pos === 'MID' ? 5 : 3;
                    
                    const allowFreeForm = isCupModeActive ? (cupSettings.stage === 'semi' || cupSettings.stage === 'final') : isPlayoffRound;
                    const effectiveMax = allowFreeForm && pos !== 'GK' ? 10 : maxPos;
                    const showGhost = isMyTeam && posPlayers.length < effectiveMax && activeLineup.length < 11;
                    
                    const rowZIndex = pos === 'GK' ? 'z-10' : pos === 'DEF' ? 'z-20' : pos === 'MID' ? 'z-30' : 'z-40';
                    
                    return (
                      <div 
                        key={pos} 
                        onClick={() => { 
                          if (isMyTeam && (!globalLock || isManagerOrAdmin)) setActiveZone(pos as any); 
                        }}
                        className={`flex-1 flex flex-col justify-center items-center w-full relative group ${isMyTeam && (!globalLock || isManagerOrAdmin) ? 'cursor-pointer' : ''} ${rowZIndex}`}
                      >
                        <div className="absolute inset-x-2 inset-y-1 bg-white/0 group-hover:bg-white/5 rounded-2xl transition-colors border border-transparent group-hover:border-white/10 border-dashed flex items-center justify-center pointer-events-none"></div>

                        <div className="flex justify-center items-start gap-0.5 sm:gap-4 md:gap-8 w-full z-10 px-1">
                          
                          {posPlayers.map(player => {
                            const nameParts = player.name.trim().split(/\s+/);
                            const lastName = nameParts[nameParts.length - 1];
                            const isSub = checkIsHalftimeSub(player.name);
                            const colors = getTeamColors(myTeam?.teamName || '', player.position === 'GK');
                            
                            return (
                              <div key={player.id} onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }} className="relative flex flex-col items-center justify-start cursor-pointer group/player active:scale-90 transition-transform duration-300 hover:-translate-y-1.5 w-[46px] sm:w-[70px]">
                                
                                <div className={`absolute -top-3 sm:-top-4 z-30 px-1.5 py-0.5 rounded text-[8px] sm:text-[11px] font-black shadow-xl border border-white/20 transition-transform duration-300 ${Number(player.points) > 0 ? 'bg-gradient-to-t from-green-500 to-green-400 text-black' : 'bg-slate-800 text-white'}`}>
                                  {player.points || 0} pt
                                </div>

                                <div className="relative w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 z-20 transition-transform duration-300 group-hover/player:scale-110 group-hover/player:z-50">
                                  <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={player.position === 'GK' ? '🧤' : player.position} />
                                  
                                  {isSub && (
                                    <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-orange-400 to-red-500 w-4 h-4 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] shadow-xl border border-slate-900 z-40 animate-pulse">
                                      🔄
                                    </div>
                                  )}
                                </div>

                                <div className="mt-1 sm:mt-1.5 bg-black/70 backdrop-blur-md px-0.5 sm:px-2 py-0.5 rounded-lg border border-white/10 shadow-lg w-full max-w-[52px] sm:max-w-[76px] z-20 group-hover/player:bg-black/90 transition-colors group-hover/player:z-50">
                                  <span className="text-[8px] sm:text-xs font-black text-white truncate block text-center drop-shadow-md leading-tight">
                                    {lastName}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {showGhost && (
                             <div 
                               onClick={(e) => { e.stopPropagation(); if (!globalLock || isManagerOrAdmin) setActiveZone(pos as any); }}
                               className="relative flex flex-col items-center justify-start cursor-pointer opacity-60 hover:opacity-100 transition-opacity w-[46px] sm:w-[60px]"
                             >
                               <div className="w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16">
                                 <GhostJersey />
                               </div>
                               <div className="mt-1 text-[8px] sm:text-[10px] font-bold text-white/60 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 shadow-md">
                                 הוסף
                               </div>
                             </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (() => {
        const filteredTransfersLog = transfersLog.filter(log => ['IN', 'OUT', 'FREEZE_IN'].includes(log.type));
        return (
          <div className="flex flex-col gap-6 md:gap-8 animate-in slide-in-from-right duration-300">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
               <div className="col-span-2 lg:col-span-2">
                 <button 
                   onClick={() => isMyTeam && (!globalLock || isManagerOrAdmin) ? setShowTransferModal(true) : null}
                   className={`w-full h-full min-h-[120px] rounded-[32px] border-2 flex flex-col items-center justify-center gap-2 transition-all shadow-xl ${isMyTeam && (!globalLock || isManagerOrAdmin) ? 'bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white border-blue-400/50 active:scale-[0.98]' : 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'}`}
                 >
                   <ArrowRightLeft className="w-8 h-8 md:w-10 md:h-10 mb-1" />
                   <span className="text-xl md:text-2xl font-black">{isMyTeam && (!globalLock || isManagerOrAdmin) ? 'בצע רכש / מכירה' : globalLock && !isManagerOrAdmin ? 'השוק נעול' : 'מצב צפייה בלבד'}</span>
                 </button>
               </div>

               <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-[32px] border border-white/5 flex flex-col justify-center relative overflow-hidden">
                 <div className="text-sm font-bold text-slate-400 mb-1">חילופים נוצלו</div>
                 <div className="text-4xl md:text-5xl font-black text-white flex items-baseline gap-1">
                   {usedTransfers} <span className="text-xl text-slate-500">/ 14</span>
                 </div>
                 <div className="w-full h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
                   <div 
                     className={`h-full rounded-full transition-all duration-1000 ${usedTransfers >= 14 ? 'bg-red-500' : usedTransfers >= 10 ? 'bg-orange-500' : 'bg-green-500'}`}
                     style={{ width: `${transferPercent}%` }}
                   ></div>
                 </div>
                 {usedTransfers >= 14 && <div className="absolute top-4 left-4 text-xs font-black bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">מכסה מלאה</div>}
               </div>

               <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-[32px] border border-white/5 flex flex-col justify-center relative overflow-hidden">
                 <div className="text-sm font-bold text-slate-400 mb-1">הקפאות סגל</div>
                 <div className="text-4xl md:text-5xl font-black text-white flex items-baseline gap-1">
                   {freezeCount} <span className="text-xl text-slate-500">/ 1</span>
                 </div>
                 <Snowflake className={`absolute top-6 left-6 w-12 h-12 opacity-10 ${freezeCount > 0 ? 'text-blue-500 opacity-30' : 'text-slate-500'}`} />
                 <div className="w-full h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
                   <div className={`h-full rounded-full transition-all duration-1000 ${freezeCount > 0 ? 'bg-blue-500 w-full' : 'w-0'}`}></div>
                 </div>
               </div>
             </div>

             <div className="bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-white/5 p-6 md:p-10 shadow-2xl min-h-[400px]">
               <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
                 <h3 className="text-2xl font-black text-white flex items-center gap-3">
                   <History className="w-6 h-6 text-blue-500" />
                   יומן העברות
                 </h3>
                 <span className="text-sm font-black bg-slate-800 px-4 py-1.5 rounded-xl text-slate-400">
                   {filteredTransfersLog.length} פעולות רכש
                 </span>
               </div>

               {filteredTransfersLog.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 opacity-40">
                   <span className="text-6xl mb-4">📭</span>
                   <span className="text-xl font-bold">היומן ריק. טרם בוצעו העברות העונה.</span>
                 </div>
               ) : (
                 <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                   {filteredTransfersLog.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => {
                     
                     const iconObj = {
                       'IN': { icon: '⬇️', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', label: 'נכנס' },
                       'OUT': { icon: '⬆️', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'יצא' },
                       'FREEZE_IN': { icon: '❄️', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'הקפאה' }
                     }[log.type as string] || { icon: '•', color: 'text-slate-400', bg: 'bg-slate-800', border: 'border-slate-700', label: 'אחר' };

                     return (
                       <div key={log.id} className={`bg-slate-950/50 p-4 md:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-600 transition-colors group border-slate-800/50`}>
                         <div className="flex items-center gap-4 md:gap-5">
                           <div className={`w-14 h-14 shrink-0 rounded-2xl flex flex-col items-center justify-center border shadow-lg ${iconObj.bg} ${iconObj.border} ${iconObj.color}`}>
                             <span className="text-xl mb-0.5">{iconObj.icon}</span>
                             <span className="text-[9px] font-black uppercase tracking-wider">{iconObj.label}</span>
                           </div>
                           <div className="flex flex-col justify-center">
                             <div className="text-xs text-slate-500 font-mono tracking-widest mb-1.5">{log.timestamp}</div>
                             
                             <div className="flex flex-wrap items-center gap-2 text-base md:text-lg font-black text-white">
                               <span>{log.player}</span>
                               {log.position && <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] text-slate-300">{log.position}</span>}
                               {log.team && <span className="text-slate-500 text-sm font-bold ml-1">- {log.team}</span>}
                             </div>
                           </div>
                         </div>
                         {isMyTeam && (
                           <div className="flex gap-2 justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setEditingLog(log)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-700 flex items-center gap-2">
                               <Settings2 className="w-3.5 h-3.5" /> ערוך
                             </button>
                             <button onClick={() => handleDeleteLog(log.id)} className="bg-red-900/30 hover:bg-red-900/60 text-red-400 text-xs font-bold py-2.5 px-4 rounded-xl border border-red-900/50 flex items-center gap-2">
                               <Trash2 className="w-3.5 h-3.5" /> מחק
                             </button>
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
          </div>
        );
      })()}

      <div className="fixed bottom-[110px] lg:bottom-[120px] left-0 right-0 px-4 flex justify-center z-[300] pointer-events-none">
        <div className="bg-black/80 backdrop-blur-2xl p-2.5 rounded-[32px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center gap-3 w-full max-w-[380px] pointer-events-auto transition-all animate-in slide-in-from-bottom-10">
           <button 
             onClick={handleSaveLineup} 
             disabled={isSaving || (!isPlayoffRound && !isCupModeActive && activeLineup.length !== 11) || (globalLock && !isManagerOrAdmin)} 
             className={`flex-1 py-4 rounded-[24px] font-black text-lg transition-all shadow-inner flex flex-col items-center justify-center ${globalLock && !isManagerOrAdmin ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : isFormationValid && (isPlayoffRound || isCupModeActive || activeLineup.length === 11) ? (isCupModeActive ? 'bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:brightness-110 active:scale-95 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'bg-gradient-to-r from-green-500 to-emerald-600 text-black hover:brightness-110 active:scale-95') : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
           >
             {globalLock && !isManagerOrAdmin ? (
               <span className="text-sm">המחזור נעול 🔒</span>
             ) : isSaving ? (
               <span className="animate-pulse">שומר...</span>
             ) : !isFormationValid && activeLineup.length === 11 ? (
               <>
                 <span className="text-sm text-red-400 leading-tight">מערך לא חוקי</span>
                 <span className="text-[10px] text-slate-500">({currentFormationStr} אינו מאושר)</span>
               </>
             ) : !isFormationValid || (!isPlayoffRound && !isCupModeActive && activeLineup.length !== 11) ? (
               <span className="text-sm">השלם הרכב (11 שחקנים)</span>
             ) : (
               <>{isCupModeActive ? 'שמור הרכב גביע 🏆' : 'שמור הרכב ועדכן זירה 💾'}</>
             )}
           </button>
           <button 
             onClick={handleWhatsAppShare} 
             disabled={lineup.length === 0} 
             className="w-[60px] h-[60px] rounded-[24px] bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white flex items-center justify-center shadow-lg hover:shadow-[0_0_20px_rgba(37,211,102,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
             title="שתף הרכב לווצאפ"
           >
             <Share2 className="w-6 h-6" />
           </button>
        </div>
      </div>

      {activeZone && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setActiveZone(null)}></div>
          <div className="relative w-full max-w-md bg-slate-900 rounded-t-[40px] sm:rounded-[40px] border border-slate-800 p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-200 flex flex-col max-h-[80vh]">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-6 sm:hidden"></div>
            <h3 className="text-2xl font-black text-white mb-6 text-center flex items-center justify-center gap-2">
              בחר <span className={POS_COLORS[activeZone]?.text}>{activeZone === 'GK' ? 'שוער' : activeZone === 'DEF' ? 'שחקן הגנה' : activeZone === 'MID' ? 'קשר' : 'חלוץ'}</span>
            </h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {bench.filter(p => p.position === activeZone).length === 0 ? (
                <div className="text-center text-slate-500 py-10 font-bold bg-slate-800/30 rounded-2xl border border-dashed border-slate-700/50">אין שחקנים פנויים בעמדה זו בספסל.</div>
              ) : (
                bench.filter(p => p.position === activeZone).map(player => {
                  const colors = getTeamColors(myTeam?.teamName || '', player.position === 'GK');
                  return (
                    <div key={player.id} className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 shrink-0">
                          <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={player.position === 'GK' ? '🧤' : player.position} />
                        </div>
                        <div>
                          <div className="font-black text-white text-sm">{player.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold">{player.team}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => { togglePlayerPosition(player, 'bench'); setActiveZone(null); }}
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-xl text-sm font-black transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <Plus className="w-4 h-4" /> הוסף
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <button onClick={() => setActiveZone(null)} className="mt-6 w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-lg rounded-2xl transition-colors active:scale-95">סגור</button>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedPlayer(null)}></div>
          <div className="relative w-full max-w-sm bg-[#0f172a] rounded-t-[40px] sm:rounded-[40px] border border-slate-700/60 p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 overflow-hidden">
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 opacity-20 blur-[50px] pointer-events-none ${POS_COLORS[selectedPlayer.position]?.bg.split(' ')[0]}`}></div>
            <div className="w-12 h-1.5 bg-slate-700/50 rounded-full mx-auto mb-6 sm:hidden relative z-10"></div>
            
            <div className="flex justify-between items-center mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 relative">
                   <Jersey 
                     primary={getTeamColors(myTeam?.teamName || '', selectedPlayer.position === 'GK').prim} 
                     secondary={getTeamColors(myTeam?.teamName || '', selectedPlayer.position === 'GK').sec} 
                     textColor={getTeamColors(myTeam?.teamName || '', selectedPlayer.position === 'GK').text} 
                     text={selectedPlayer.position === 'GK' ? '🧤' : selectedPlayer.position} 
                   />
                </div>
                <div className="flex flex-col justify-center">
                  <h3 className="text-2xl font-black text-white tracking-tight leading-none mb-1.5">{selectedPlayer.name}</h3>
                  <span className="text-slate-300 text-xs font-bold px-2 py-0.5 bg-slate-800/80 rounded border border-slate-700/50 self-start">{selectedPlayer.team}</span>
                </div>
              </div>
              <div className="flex flex-col items-center bg-slate-800/60 px-4 py-2.5 rounded-2xl border border-slate-700/50 shadow-inner">
                <span className="text-2xl font-black text-green-400 leading-none mb-0.5">{selectedPlayer.points || 0}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Points</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3 relative z-10">
              {isMyTeam && (
                <button 
                  onClick={() => { togglePlayerPosition(selectedPlayer, lineup.find(p => p.id === selectedPlayer.id) ? 'lineup' : 'bench'); setSelectedPlayer(null); }}
                  className={`flex flex-col items-center justify-center py-4 rounded-2xl border transition-all active:scale-95 shadow-lg ${lineup.find(p => p.id === selectedPlayer.id) ? 'bg-gradient-to-br from-red-500/10 to-red-900/30 border-red-500/30 text-red-400 hover:border-red-400/50' : 'bg-gradient-to-br from-green-500/10 to-emerald-900/30 border-green-500/30 text-green-400 hover:border-green-400/50'}`}
                >
                  <span className="text-2xl mb-1 drop-shadow-md">{lineup.find(p => p.id === selectedPlayer.id) ? '⬇️' : '⬆️'}</span>
                  <span className="font-black text-sm tracking-wide">{lineup.find(p => p.id === selectedPlayer.id) ? 'הורד לספסל' : 'העלה להרכב'}</span>
                </button>
              )}
              <button 
                onClick={(e) => openPlayerInfo(e, selectedPlayer)}
                className={`flex flex-col items-center justify-center py-4 rounded-2xl border bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all active:scale-95 shadow-lg ${!isMyTeam ? 'col-span-2' : ''}`}
              >
                <Search className="w-6 h-6 mb-2 opacity-80" />
                <span className="font-black text-sm tracking-wide">חיפוש ברשת</span>
              </button>
            </div>

            <button onClick={() => setSelectedPlayer(null)} className="w-full py-4 bg-transparent hover:bg-slate-800/80 text-slate-400 hover:text-white font-black text-base rounded-2xl transition-colors active:scale-95 relative z-10 border border-transparent hover:border-slate-700/50">
              סגור
            </button>
          </div>
        </div>
      )}

      {showTransferModal && isMyTeam && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/30 p-6 md:p-8 rounded-[32px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-3xl font-black text-white italic">שוק ההעברות 💱</h3>
              <button onClick={() => setShowTransferModal(false)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors font-black">✕</button>
            </div>
            <div className="flex bg-slate-950 p-1.5 rounded-2xl mb-8">
              <button onClick={() => setTransferType('IN')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all shadow-sm ${transferType === 'IN' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-black' : 'text-slate-500 hover:text-slate-300'}`}>רכש (IN)</button>
              <button onClick={() => setTransferType('OUT')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all shadow-sm ${transferType === 'OUT' ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>מכירה (OUT)</button>
            </div>
            {transferType === 'IN' ? (
              <div className="space-y-4">
                <input type="text" placeholder="הקלד שם שחקן..." value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none focus:border-blue-500 focus:bg-slate-800/80 transition-colors" />
                <div className="flex gap-3">
                  <select value={newPlayerPos} onChange={e => setNewPlayerPos(e.target.value as 'GK' | 'DEF' | 'MID' | 'FWD')} className="flex-1 bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none appearance-none text-center">
                    {POS_ARRAY.map(pos => <option key={pos} value={pos} className="bg-slate-900">{pos}</option>)}
                  </select>
                  <select value={newPlayerTeam} onChange={e => setNewPlayerTeam(e.target.value)} className="flex-[2] bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none appearance-none">
                    {REAL_TEAMS_ISRAEL.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                  </select>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-2xl flex items-center justify-between mt-4 cursor-pointer hover:bg-blue-900/30 transition-colors" onClick={() => setIsFreezeTransfer(!isFreezeTransfer)}>
                  <div>
                    <span className="text-sm font-black text-blue-300 block">החתמה כשחקן הקפאה? ❄️</span>
                    <span className="text-[10px] text-blue-400/70 font-bold">שחקן זה לא יספר במכסת החילופים</span>
                  </div>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isFreezeTransfer ? 'bg-blue-500 text-black' : 'bg-slate-800 border border-slate-600'}`}>
                    {isFreezeTransfer && '✓'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <select value={playerOutId} onChange={e => setPlayerOutId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-white font-bold outline-none appearance-none pr-12">
                    <option value="" className="text-slate-500">בחר שחקן למכירה...</option>
                    {(myTeam.squad || []).sort((a: any, b: any)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map((p: any) => (
                      <option key={p.id} value={p.id} className="bg-slate-900">
                        {p.name} ({p.team}) - {p.position}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">🗑️</span>
                </div>
                <p className="text-xs text-red-400 font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-center">⚠️ שחקן שימכר ימחק לצמיתות מהסגל שלך!</p>
              </div>
            )}
            <button onClick={executeTransfer} className={`w-full mt-8 py-5 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 ${transferType === 'IN' ? 'bg-white text-black hover:bg-slate-200' : 'bg-red-600 text-white hover:bg-red-500'}`}>
              <span>אשר פעולת {transferType === 'IN' ? 'רכש' : 'מכירה'}</span>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {showAdminSquadEditor && isAdmin && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[9999] flex items-start justify-center p-2 sm:p-4 pt-10 sm:pt-20 overflow-y-auto">
          <div className="bg-slate-900 border border-indigo-500/30 p-4 sm:p-8 rounded-[32px] w-full max-w-3xl shadow-[0_0_50px_rgba(79,70,229,0.2)] relative my-auto animate-in zoom-in-95">
            <button onClick={() => setShowAdminSquadEditor(false)} className="absolute top-6 left-6 text-slate-500 hover:text-white font-black text-xl bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h3 className="text-2xl sm:text-3xl font-black text-indigo-400 mb-2 flex items-center gap-3"><Settings2 className="w-8 h-8"/> ניהול סגל (אדמין)</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-8 font-bold border-b border-slate-800 pb-4">כאן אתה יכול למחוק שחקנים מהמערכת כליל או לתקן שמות/עמדות מבלי שזה יירשם בהיסטוריית הרכש.</p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {adminSquad.map((p, idx) => (
                <div key={p.id} className="flex flex-col sm:flex-row gap-2 items-center bg-slate-950 p-3 rounded-2xl border border-slate-800 group hover:border-indigo-500/30 transition-colors">
                  <div className="flex w-full gap-2">
                    <button onClick={() => setAdminSquad(adminSquad.filter(x => x.id !== p.id))} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white w-12 rounded-xl flex items-center justify-center transition-colors shadow-inner" title="מחק שחקן מהסגל"><Trash2 className="w-5 h-5"/></button>
                    <input type="text" value={p.name} onChange={e => { const sq = [...adminSquad]; sq[idx].name = e.target.value; setAdminSquad(sq); }} className="flex-1 bg-slate-900 p-3 rounded-xl text-white font-bold outline-none focus:border-indigo-500 border border-slate-700 transition-colors" placeholder="שם שחקן" />
                  </div>
                  <div className="flex w-full gap-2">
                    <select value={p.position} onChange={e => { const sq = [...adminSquad]; sq[idx].position = e.target.value as 'GK' | 'DEF' | 'MID' | 'FWD'; setAdminSquad(sq); }} className="bg-slate-900 p-3 rounded-xl text-white font-bold outline-none border border-slate-700 w-24 text-center appearance-none">
                      {POS_ARRAY.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                    <input type="text" value={p.team} onChange={e => { const sq = [...adminSquad]; sq[idx].team = e.target.value; setAdminSquad(sq); }} className="flex-1 bg-slate-900 p-3 rounded-xl text-white font-bold outline-none focus:border-indigo-500 border border-slate-700 transition-colors" placeholder="קבוצה" />
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => {
                  const newPlayer: Player = { 
                    id: `p_admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, 
                    name: '', 
                    position: 'DEF', 
                    team: '', 
                    points: 0, 
                    breakdown: [], 
                    isStarting: false 
                  };
                  setAdminSquad([...adminSquad, newPlayer]);
                }} 
                className="w-full mt-4 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 py-3 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> הוסף שחקן ידנית
              </button>
            </div>
            
            <div className="mt-8 flex gap-3">
               <button onClick={handleSaveAdminSquad} disabled={isSaving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95 text-lg">
                 {isSaving ? 'שומר שינויים...' : 'שמור סגל מעודכן 💾'}
               </button>
               <button onClick={() => setShowAdminSquadEditor(false)} className="px-6 sm:px-10 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {editingLog && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[1050] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 sm:p-8 rounded-[32px] w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-black text-white mb-6">עריכת רישום רכש ✏️</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם השחקן</label><input type="text" value={editingLog.player} onChange={e => setEditingLog({...editingLog, player: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">קבוצה</label><input type="text" value={editingLog.team || ''} onChange={e => setEditingLog({...editingLog, team: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" /></div>
              <div className="flex gap-3">
                <div className="flex-1"><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">עמדה</label><select value={editingLog.position || 'DEF'} onChange={e => setEditingLog({...editingLog, position: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none appearance-none">{POS_ARRAY.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <div className="flex-[2]"><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">סוג פעולה</label><select value={editingLog.type} onChange={e => setEditingLog({...editingLog, type: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none appearance-none">
                  <option value="IN">רכש (IN)</option>
                  <option value="FREEZE_IN">הקפאה (FREEZE)</option>
                  <option value="OUT">מכירה (OUT)</option>
                  <option value="HALFTIME_SUB">חילוף מחצית</option>
                </select></div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={saveLogEdit} className="flex-1 bg-white hover:bg-slate-200 py-3.5 rounded-xl font-black text-black transition-colors">שמור</button>
              <button onClick={() => setEditingLog(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 py-3.5 rounded-xl font-black text-white transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LineupManager;