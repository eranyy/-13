import React, { useState, useEffect } from 'react';
import { ChevronDown, Download, DownloadCloud, AlertTriangle, CheckCircle2, Trophy, Flame, RefreshCw, Undo2, ClipboardList, Globe2, Share2, Image as ImageIcon, Swords, CalendarDays, X, Users, Edit3 } from 'lucide-react';
import { db, functions } from '../firebaseConfig';
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { UserRole } from '../types';
import html2canvas from 'html2canvas';

// --- All interfaces are derived from the liveData/arena document --- 
interface LivePlayer extends Player {
  points: number;
  stats?: any; // Stats are pre-calculated by the server
}

interface LiveTeam {
  id: string;
  teamName: string;
  manager: string;
  liveScore: number;
  liveEvents: { goals: number; yellows: number; reds: number };
  formation: string;
  lineup: LivePlayer[];
}

interface LiveMatch {
  h: string; // home team id
  a: string; // away team id
}

interface LiveArenaData {
  teams: { [teamId: string]: LiveTeam };
  matches: LiveMatch[];
  currentRound: number;
  lastUpdated: any;
}

interface LiveArenaProps {
  isModerator?: boolean;
  loggedInUser?: any;
  // `teams` and `currentRound` are removed as they now come from the live subscription
}

// --- Constants and helper functions that are still needed for the UI ---
const TEAM_NAMES: Record<string, string> = { tumali: 'תומאלי', tampa: 'טמפה', pichichi: "פיצ'יצ'י", hamsili: 'חמסילי', harale: 'חראלה', holonia: 'חולוניה' };
const POS_ORDER: Record<string, number> = { 'GK': 1, 'שוער': 1, 'DEF': 2, 'הגנה': 2, 'בלם': 2, 'מגן': 2, 'MID': 3, 'קשר': 3, 'קישור': 3, 'FWD': 4, 'חלוץ': 4, 'התקפה': 4 };

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

const Jersey = ({ primary, secondary, textColor, text }: { primary: string, secondary: string, textColor: string, text: string }) => {
    const gradId = `grad-arena-${primary.replace('#', '')}-${secondary.replace('#', '')}`;
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_8px_8px_rgba(0,0,0,0.7)]">
        <defs><linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={primary} /><stop offset="100%" stopColor={secondary} /></linearGradient></defs>
        <path d="M 35 10 C 35 25, 65 25, 65 10 L 90 20 L 95 45 L 75 50 L 75 95 C 75 98, 25 98, 25 95 L 25 50 L 5 45 L 10 20 Z" fill={`url(#${gradId})`} stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
        <text x="50" y="62" fontSize="26" fontFamily="system-ui, sans-serif" fontWeight="900" fill={textColor} textAnchor="middle" dominantBaseline="middle" style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.5)' }}>{text}</text>
      </svg>
    );
};

const isPosMatch = (pPos: string, category: string) => {
    if (!pPos) return false;
    if (category === 'GK') return ['GK', 'שוער'].includes(pPos);
    if (category === 'DEF') return ['DEF', 'הגנה', 'בלם', 'מגן'].includes(pPos);
    if (category === 'MID') return ['MID', 'קשר', 'קישור'].includes(pPos);
    if (category === 'FWD') return ['FWD', 'חלוץ', 'התקפה'].includes(pPos);
    return false;
};

// --- Main LiveArena Component ---
const LiveArena: React.FC<LiveArenaProps> = ({ isModerator, loggedInUser }) => {
  
  const [liveData, setLiveData] = useState<LiveArenaData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Simplified state management
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [h2hModal, setH2hModal] = useState<{hId: string, aId: string} | null>(null);
  const [auditModal, setAuditModal] = useState<{hId: string, aId: string} | null>(null);
  const [untouchedModal, setUntouchedModal] = useState<{teamId: string, teamName: string} | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<{teamId: string, player: any} | null>(null);

  const [stats, setStats] = useState({ /* initial stats object */ });
  const [toast, setToast] = useState<{msg: string, type: 'error'|'success'|'info'} | null>(null);
  const [appAlert, setAppAlert] = useState<{title: string, msg: string, type: 'success'|'error'|'info'} | null>(null);

  // --- NEW: Subscribe to the aggregated live data document ---
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'liveData', 'arena'), (doc) => {
        if (doc.exists()) {
            setLiveData(doc.data() as LiveArenaData);
        }
        setLoading(false);
    }, (error) => {
        console.error("Error fetching live arena data:", error);
        setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- All calculation functions (calculateTeamScore, getTeamLiveEvents, etc.) are REMOVED ---
  // --- The component now receives pre-calculated data from `liveData` ---

  const toggleTeam = (teamId: string) => setExpandedTeamId(expandedTeamId === teamId ? null : teamId);

  const getUntouchedCount = (team: LiveTeam) => {
    if (!team || !team.lineup) return 0;
    return team.lineup.filter(p => {
        const hasPlayed = (p.stats && Object.values(p.stats).some(v => v === true || (typeof v === 'number' && v > 0))) || (Number(p.points) !== 0);
        return !hasPlayed && Number(p.points) === 0;
    }).length;
  };

  const savePlayerPoints = async () => {
    if (!editingPlayer || !liveData) return;
    const { teamId, player } = editingPlayer;
    try {
      const teamRef = doc(db, 'users', teamId);
      const finalPoints = calculatePointsFromStats(stats, player.position);

      // Instead of reading and calculating, we find the player and update their stats.
      // The Cloud Function will handle the recalculation for the entire arena.
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) throw new Error('Team not found');
      
      const freshTeam = teamSnap.data();
      const updatePlayerInList = (list: any[]) => (list || []).map((p: any) => 
        (p.id === player.id || p.name === player.name) ? { ...p, points: finalPoints, stats: stats } : p
      );
      
      const updatedSquad = updatePlayerInList(freshTeam.squad);
      const updatedLineup = updatePlayerInList(freshTeam.published_lineup);
      const updatedSubsOut = updatePlayerInList(freshTeam.published_subs_out);

      const editLog = {
          id: `var_${Date.now()}`,
          type: 'VAR_POINTS_UPDATE',
          round: liveData.currentRound,
          playerIn: player.name,
          playerOut: `${finalPoints} נק'`,
          actionBy: loggedInUser?.name || 'מנהל',
          timestamp: new Date().toISOString()
      };

      await updateDoc(teamRef, {
        squad: updatedSquad,
        published_lineup: updatedLineup,
        published_subs_out: updatedSubsOut,
        lineup: updatedLineup, // Keep lineups in sync
        transfers: arrayUnion(editLog)
      });

      setEditingPlayer(null);
      showToast('ניקוד נשמר! הסנכרון יתבצע אוטומטית.', 'success');
    } catch (e) {
      console.error("Error saving points:", e);
      setAppAlert({title:'שגיאה', msg: 'שגיאה בעדכון נקודות', type: 'error'});
    }
  };

  const calculatePointsFromStats = (statsObj: any, pos: string) => {
    let p = 0; if (!statsObj) return 0; if (statsObj.notInSquad) return -1;
    const isGk = ['GK', 'שוער'].includes(pos); const isDef = ['DEF', 'הגנה', 'בלם', 'מגן'].includes(pos);
    if (statsObj.started) p += 1; if (statsObj.played60) p += 1; if (statsObj.won) p += 2;
    if (isGk) p += (statsObj.goals || 0) * 10; else if (isDef) p += (statsObj.goals || 0) * 8; else p += (statsObj.goals || 0) * 5;
    if (isGk) p += (statsObj.assists || 0) * 6; else if (isDef) p += (statsObj.assists || 0) * 4; else p += (statsObj.assists || 0) * 3;
    if (statsObj.cleanSheet && (isGk || isDef)) p += isGk ? 5 : 4;
    if (isGk || isDef) p -= (statsObj.conceded || 0);
    p += (statsObj.penaltyWon || 0) * 2; p -= (statsObj.penaltyMissed || 0) * 3; if (isGk) p += (statsObj.penaltySaved || 0) * 3;
    p -= (statsObj.ownGoals || 0) * 3; p += (statsObj.assistOwnGoal || 0) * 2;
    if (statsObj.yellow) p -= 2; if (statsObj.secondYellow) p -= 2; if (statsObj.red) p -= 5;
    return p;
  };

  const updateStat = (field: string, value: any) => { 
    setStats(prevStats => {
        const newStats = { ...prevStats, [field]: value };
        if (field === 'conceded' && value > 0) newStats.cleanSheet = false;
        if (field === 'cleanSheet' && value === true) newStats.conceded = 0;
        return newStats;
    }); 
  };
  
  useEffect(() => {
    if (editingPlayer) {
      setStats(editingPlayer.player.stats || {
        started: false, played60: false, notInSquad: false, won: false, 
        goals: 0, assists: 0, cleanSheet: false, conceded: 0, 
        yellow: false, secondYellow: false, red: false, 
        penaltyWon: 0, penaltyMissed: 0, penaltySaved: 0, 
        ownGoals: 0, assistOwnGoal: 0 
      });
    } 
  }, [editingPlayer]);

  // Helper function to show toast messages
  const showToast = (msg: string, type: 'error' | 'success' | 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };
  
  // Getters for computed data from `liveData`
  const currentRound = liveData?.currentRound || 0;
  const currentMatches = liveData?.matches || [];
  const teams = liveData?.teams ? Object.values(liveData.teams) : [];

  if (loading) {
    return <div className="flex flex-col items-center justify-center pt-40 h-full gap-6">...loading UI...</div>;
  }

  if (!liveData || currentMatches.length === 0) {
    return <div className="text-center p-12">...No matches UI...</div>;
  }

  // --- RENDER LOGIC ---
  // The JSX remains largely the same, but it now uses `liveData` as the source of truth.
  // For example, instead of `calculateTeamScore(match.h)`, we use `liveData.teams[match.h]?.liveScore`

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 font-sans" dir="rtl">
      {/* ... Toast and Alert UI ... */}

      <div id="arena-capture-area">
        {/* ... Header UI ... */}

        <div className="grid grid-cols-1 gap-6">
          {currentMatches.map((match: LiveMatch, idx: number) => {
            const hTeam = liveData.teams[match.h];
            const aTeam = liveData.teams[match.a];
            if (!hTeam || !aTeam) return null; // Don't render if team data is not yet available

            const isExpanded = expandedTeamId === match.h || expandedTeamId === match.a;
            const expandedTeamObj = isExpanded ? teams.find(t => t.id === expandedTeamId) : null;
            const isEditable = isModerator || (loggedInUser && expandedTeamObj && loggedInUser.teamName === expandedTeamObj.teamName);

            return (
              <div key={idx} className={`...`}>
                <div className="p-0">
                  <div className={`flex ...`}>
                    {/* Home Team */}
                    <button onClick={() => toggleTeam(match.h)} className={`...`}>
                      <span className={`...`}>{TEAM_NAMES[match.h] || match.h}</span>
                      <div onClick={(e) => { e.stopPropagation(); setUntouchedModal({teamId: match.h, teamName: TEAM_NAMES[match.h] || match.h}); }} className="...">
                         <span>בקנה: {getUntouchedCount(hTeam)}</span>
                      </div>
                    </button>

                    {/* Scoreboard */}
                    <div className="...">
                       {/* Icons for goals/cards from hTeam.liveEvents and aTeam.liveEvents */}
                       <div className="flex items-center justify-center gap-3">
                           <span className={`...`}>{hTeam.liveScore}</span>
                           <span>:</span>
                           <span className={`...`}>{aTeam.liveScore}</span>
                       </div>
                    </div>

                    {/* Away Team */}
                    <button onClick={() => toggleTeam(match.a)} className={`...`}>
                       <span className={`...`}>{TEAM_NAMES[match.a] || match.a}</span>
                       <div onClick={(e) => { e.stopPropagation(); setUntouchedModal({teamId: match.a, teamName: TEAM_NAMES[match.a] || match.a}); }} className="...">
                         <span>בקנה: {getUntouchedCount(aTeam)}</span>
                       </div>
                    </button>
                  </div>
                </div>

                {isExpanded && expandedTeamObj && (
                  <div className="...">
                    <div className="...">
                      <span className="...">{expandedTeamObj.formation}</span>
                    </div>
                    {/* Pitch view, iterating through expandedTeamObj.lineup */}
                     <div className="flex flex-col justify-around h-full gap-8 relative z-10 py-4">
                        {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
                           const posPlayers = expandedTeamObj.lineup.filter((p: any) => isPosMatch(p.position, pos));
                           if (posPlayers.length === 0) return <div key={pos} className="min-h-[50px]"></div>;
                            return (
                              <div key={pos} className="flex justify-center flex-wrap gap-2 sm:gap-4 md:gap-8">
                                {posPlayers.map((p: any) => {
                                    const nameParts = p.name.split(' ');
                                    const lastName = nameParts[nameParts.length - 1];
                                    const colors = getTeamColors(expandedTeamObj?.teamName || '', p.position === 'GK');
                                    const isUntouched = !p.stats || Object.values(p.stats).every(v => !v);

                                  return (
                                    <div key={p.id} onClick={() => { if(isEditable) setEditingPlayer({teamId: expandedTeamId!, player: p}); }} className={`...`}>
                                      <div className="w-10 h-10 ...">
                                        <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={['GK', 'שוער'].includes(p.position) ? '🧤' : p.position} />
                                        <div className={`absolute ...`}>
                                          {isUntouched ? '-' : p.points}
                                        </div>
                                      </div>
                                      {/* ... Player name ... */}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                        })}
                      </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* All modals (edit player, H2H, etc.) remain functionally the same, but now draw their initial data from the `liveData` state */}
      {editingPlayer && (
        // The editing player modal JSX
        // The savePlayerPoints function is already updated to work with the new flow.
      )}
    </div>
  );
};

export default LiveArena;
