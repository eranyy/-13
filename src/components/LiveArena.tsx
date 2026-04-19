import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ChevronDown, Download, DownloadCloud, AlertTriangle, CheckCircle2, Trophy, Flame, RefreshCw, Undo2, ClipboardList, Globe2, Share2, Image as ImageIcon, Swords, CalendarDays, X, Users } from 'lucide-react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, updateDoc, addDoc, collection, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserRole } from '../types';
import html2canvas from 'html2canvas';

interface LiveArenaProps { teams: any[]; currentRound: number; isModerator?: boolean; loggedInUser?: any; }

const TEAM_NAMES: Record<string, string> = { tumali: 'תומאלי', tampa: 'טמפה', pichichi: "פיצ'יצ'י", hamsili: 'חמסילי', harale: 'חראלה', holonia: 'חולוניה' };

const POS_ORDER: Record<string, number> = { 'GK': 1, 'שוער': 1, 'DEF': 2, 'הגנה': 2, 'בלם': 2, 'מגן': 2, 'MID': 3, 'קשר': 3, 'קישור': 3, 'FWD': 4, 'חלוץ': 4, 'התקפה': 4 };
const ALLOWED_FORMATIONS = ['5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-5-2', '3-4-3'];

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

const isPosMatch = (pPos: string, category: string) => {
  if (!pPos) return false;
  if (category === 'GK') return ['GK', 'שוער'].includes(pPos);
  if (category === 'DEF') return ['DEF', 'הגנה', 'בלם', 'מגן'].includes(pPos);
  if (category === 'MID') return ['MID', 'קשר', 'קישור'].includes(pPos);
  if (category === 'FWD') return ['FWD', 'חלוץ', 'התקפה'].includes(pPos);
  return false;
};

const getFormation = (lineup: any[]) => {
    if (!lineup || lineup.length !== 11) return '';
    const def = lineup.filter(p => ['DEF', 'הגנה', 'בלם', 'מגן'].includes(p.position)).length;
    const mid = lineup.filter(p => ['MID', 'קשר', 'קישור'].includes(p.position)).length;
    const fwd = lineup.filter(p => ['FWD', 'חלוץ', 'התקפה'].includes(p.position)).length;
    return `${def}-${mid}-${fwd}`;
};

const cleanStr = (s?: string | null) => String(s || '').toLowerCase().replace(/['"״׳`\-\s]/g, '');

const parseCsvRow = (str: string) => {
    let result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') inQuotes = !inQuotes;
        else if (str[i] === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += str[i];
        }
    }
    result.push(cur.trim());
    return result.map(s => s.replace(/^"|"$/g, ''));
};

const LiveArena: React.FC<LiveArenaProps> = ({ teams, currentRound, isModerator, loggedInUser }) => {
  
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [h2hModal, setH2hModal] = useState<{hId: string, aId: string} | null>(null);
  
  // 🟢 משתנים חדשים עבור דוח ה-VAR 🟢
  const [auditModal, setAuditModal] = useState<{hId: string, aId: string} | null>(null);
  const [auditActiveTab, setAuditActiveTab] = useState<'h' | 'a'>('h');
  const [auditGroupByReal, setAuditGroupByReal] = useState(false);

  const [isProcessingRound, setIsProcessingRound] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<{teamId: string, player: any} | null>(null);
  const [stats, setStats] = useState({ 
    started: false, played60: false, notInSquad: false, won: false, 
    goals: 0, assists: 0, cleanSheet: false, conceded: 0, 
    yellow: false, secondYellow: false, red: false, 
    penaltyWon: 0, penaltyMissed: 0, penaltySaved: 0, 
    ownGoals: 0, assistOwnGoal: 0 
  });
  
  const [driveModalOpen, setDriveModalOpen] = useState(false);
  const [driveUrlInput, setDriveUrlInput] = useState('');
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logTeamId, setLogTeamId] = useState<string>('all'); 
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'error'|'success'|'info'} | null>(null);
  const [appAlert, setAppAlert] = useState<{title: string, msg: string, type: 'success'|'error'|'info'} | null>(null);

  const [readReceipts, setReadReceipts] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('luzon_read_receipts') || '{}'); } catch { return {}; }
  });

  const showToast = (msg: string, type: 'error' | 'success' | 'info') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  const toggleTeam = (teamId: string) => { setExpandedTeamId(expandedTeamId === teamId ? null : teamId); };

  const displayTeams = teams.filter(t => t.teamName && t.teamName.toUpperCase() !== 'ADMIN' && t.id !== 'admin');
  
  useEffect(() => {
    if (!loggedInUser?.id) return;
    const updatePresence = async () => {
      try {
        await setDoc(doc(db, 'presence', loggedInUser.id), {
          name: loggedInUser.name,
          lastSeen: serverTimestamp(),
          teamName: loggedInUser.teamName
        }, { merge: true });
      } catch (e) {
        console.error("Error updating presence:", e);
      }
    };
    updatePresence();
    const interval = setInterval(updatePresence, 30000);
    
    const unsubPresence = onSnapshot(collection(db, 'presence'), (snap) => {
      const now = Date.now();
      const threeMinutesAgo = now - (3 * 60 * 1000);
      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(user => user.lastSeen?.toMillis() > threeMinutesAgo);
        
      const uniqueActiveByName = Array.from(new Map(active.map(u => [u.name, u])).values());
      setOnlineUsers(uniqueActiveByName);
    });
    
    return () => { clearInterval(interval); unsubPresence(); };
  }, [loggedInUser]);

  useEffect(() => {
    const unsubFixtures = onSnapshot(doc(db, 'leagueData', 'fixtures'), snap => {
      if(snap.exists()) setFixtures(snap.data().rounds || []);
      setLoading(false);
    });
    return () => { unsubFixtures(); };
  }, []);

  const getLatestTransferTimestamp = (team: any) => {
      const roundLogs = (team?.transfers || []).filter((t: any) => t.round === currentRound && !['IN', 'OUT', 'FREEZE_IN'].includes(t.type));
      if (roundLogs.length === 0) return 0;
      return Math.max(...roundLogs.map((log:any) => Number(log.id.split('_')[1]) || 0));
  };

  const markAsRead = (teamId: string) => {
      const updated = { ...readReceipts };
      if (teamId !== 'all') {
          const team = teams.find(t => t.id === teamId);
          if (team) {
              updated[teamId] = getLatestTransferTimestamp(team);
              setReadReceipts(updated);
              localStorage.setItem('luzon_read_receipts', JSON.stringify(updated));
          }
      }
  };

  const handleOpenLogModal = () => { setIsLogModalOpen(true); setLogTeamId('all'); };
  const handleSelectLogTab = (tabId: string) => {
      if (logTeamId === tabId) setLogTeamId('all');
      else { setLogTeamId(tabId); if (tabId !== 'all') markAsRead(tabId); }
  };

  const getH2HData = (team1: string, team2: string) => {
    let t1Wins = 0, t2Wins = 0, draws = 0, t1Goals = 0, t2Goals = 0;
    const pastEncounters: any[] = [];
    fixtures.forEach(r => {
      if (!r.isPlayed) return;
      (r.matches || []).forEach((m: any) => {
        if ((m.h === team1 && m.a === team2) || (m.h === team2 && m.a === team1)) {
          const hs = Number(m.hs) || 0, as = Number(m.as) || 0;
          if (m.h === team1) { t1Goals += hs; t2Goals += as; if (hs > as) t1Wins++; else if (as > hs) t2Wins++; else draws++; }
          else { t1Goals += as; t2Goals += hs; if (as > hs) t2Wins++; else if (hs > as) t2Wins++; else draws++; }
          pastEncounters.push({ round: r.round, h: m.h, a: m.a, hs, as });
        }
      });
    });
    return { t1Wins, t2Wins, draws, t1Goals, t2Goals, pastEncounters: pastEncounters.sort((a, b) => b.round - a.round) };
  };

  const applySubstitutionsToLineup = (team: any) => {
    if (!team) return [];
    let currentLineup = [...(team.published_lineup || [])];
    const bench = team.published_subs_out || [];
    const roundSubs = (team.transfers || []).filter((t: any) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
    const sortedSubs = roundSubs.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    sortedSubs.forEach((sub: any) => {
      const outIndex = currentLineup.findIndex(p => p.name === sub.playerOut);
      const inPlayer = bench.find((p: any) => p.name === sub.playerIn);
      if (outIndex !== -1 && inPlayer) { currentLineup[outIndex] = inPlayer; }
    });
    return currentLineup;
  };

  const getTeamLiveEvents = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return { goals: 0, yellows: 0, reds: 0 };
    
    let goals = 0;
    let yellows = 0;
    let reds = 0;

    const currentLineup = applySubstitutionsToLineup(team);
    
    currentLineup.forEach((player: any) => {
        if (player.stats) {
            goals += (player.stats.goals || 0);
            if (player.stats.yellow) yellows += 1;
            if (player.stats.secondYellow) yellows += 1;
            if (player.stats.red) reds += 1;
        }
    });

    const roundSubs = (team.transfers || []).filter((t: any) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
    roundSubs.forEach((sub: any) => {
        const allPossibleOutPlayers = [...(team.published_subs_out || []), ...(team.squad || []), ...(team.players || [])];
        const benchedPlayerOut = allPossibleOutPlayers.find((p: any) => p.name === sub.playerOut);
        
        if (benchedPlayerOut && benchedPlayerOut.stats) {
            goals += (benchedPlayerOut.stats.goals || 0);
            if (benchedPlayerOut.stats.yellow) yellows += 1;
            if (benchedPlayerOut.stats.secondYellow) yellows += 1;
            if (benchedPlayerOut.stats.red) reds += 1;
        }
    });

    return { goals, yellows, reds };
  };

  const getUntouchedCount = (teamId: string) => {
      const team = teams.find(t => t.id === teamId);
      if (!team) return 0;
      const currentLineup = applySubstitutionsToLineup(team);
      let count = 0;
      currentLineup.forEach((p: any) => {
          const hasPlayed = (p.stats && Object.values(p.stats).some(v => v === true || (typeof v === 'number' && v > 0))) || (Number(p.points) !== 0);
          if (!hasPlayed && Number(p.points) === 0) count++;
      });
      return count;
  };

  const shareArenaAsImage = async () => {
    const el = document.getElementById('arena-capture-area');
    if (!el) return;

    showToast('מייצר תמונה ברמת ליגת האלופות... 📸', 'info');

    let shareText = `🏆 תוצאות הלייב בזירת פנטזי לוזון 13 - מחזור ${currentRound}! 🔥\n\n`;
    const currentMatches = fixtures.find(r => r.round === currentRound)?.matches || [];
    
    currentMatches.forEach((match: any) => {
        const hScore = calculateTeamScore(match.h);
        const aScore = calculateTeamScore(match.a);
        const hName = TEAM_NAMES[match.h] || match.h;
        const aName = TEAM_NAMES[match.a] || match.a;
        const hUntouched = getUntouchedCount(match.h);
        const aUntouched = getUntouchedCount(match.a);
        
        shareText += `⚽ ${hName} (${hScore}) - (${aScore}) ${aName}\n`;
        shareText += `⏱️ בקנה: ${hName} (${hUntouched}) | ${aName} (${aUntouched})\n\n`;
    });

    try {
      const canvas = await html2canvas(el, { 
        backgroundColor: '#0f172a', 
        scale: 2, 
        useCORS: true,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('.backdrop-blur-md, .backdrop-blur-xl, .backdrop-blur-2xl').forEach(b => {
              b.classList.remove('backdrop-blur-md', 'backdrop-blur-xl', 'backdrop-blur-2xl');
              (b as HTMLElement).style.backgroundColor = '#0f172a';
          });
          clonedDoc.querySelectorAll('span, p, h2, h3, h4, div').forEach(node => {
              const n = node as HTMLElement;
              n.style.lineHeight = '1.5';
              n.style.paddingBottom = '4px';
          });
          clonedDoc.querySelectorAll('.truncate').forEach(node => {
              const n = node as HTMLElement;
              n.classList.remove('truncate');
              n.style.whiteSpace = 'normal';
              n.style.overflow = 'visible';
          });
          clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"]').forEach(ig => (ig as HTMLElement).style.display = 'none');
        }
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `Arena_Round_${currentRound}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `תוצאות זירה - מחזור ${currentRound}`,
            text: shareText.trim()
          });
          setAppAlert(null);
        } else {
          try {
            const textArea = document.createElement("textarea");
            textArea.value = shareText.trim();
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Arena_Round_${currentRound}.png`;
            link.click();
            
            showToast('התמונה ירדה! הטקסט הועתק, הדבק (Ctrl+V) ב-WhatsApp Web 📋', 'success');
          } catch (err) {
            console.error(err);
            showToast('שגיאה בשיתוף', 'error');
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('שגיאה ביצירת התמונה', 'error');
    }
  };

  const exportArenaToExcel = () => {
    const currentMatches = fixtures.find(r => r.round === currentRound)?.matches || [];
    if (currentMatches.length === 0) return setAppAlert({title: 'שגיאה', msg: 'אין נתונים לייצוא למחזור הנוכחי', type: 'error'});

    let csvContent = `סיכום זירה - מחזור ${currentRound}\n\n`;

    currentMatches.forEach((match: any) => {
      const hName = TEAM_NAMES[match.h] || match.h;
      const aName = TEAM_NAMES[match.a] || match.a;
      const hScore = calculateTeamScore(match.h);
      const aScore = calculateTeamScore(match.a);
      
      const hTeam = teams.find(t => t.id === match.h);
      const aTeam = teams.find(t => t.id === match.a);
      
      const hLineup = applySubstitutionsToLineup(hTeam);
      const aLineup = applySubstitutionsToLineup(aTeam);

      const hFormation = getFormation(hLineup);
      const aFormation = getFormation(aLineup);

      csvContent += `=== ${hName} ===,${hScore},VS,${aScore},=== ${aName} ===\n`;
      csvContent += `מערך: ${hFormation},,,,מערך: ${aFormation}\n`;
      csvContent += `שחקן (עמדה),נקודות,,שחקן (עמדה),נקודות\n`;
      
      for (let i = 0; i < Math.max(hLineup.length, aLineup.length); i++) {
          const hP = hLineup[i] ? `${hLineup[i].name} (${hLineup[i].position})` : '-';
          const hPts = hLineup[i] ? hLineup[i].points || 0 : '-';
          const aP = aLineup[i] ? `${aLineup[i].name} (${aLineup[i].position})` : '-';
          const aPts = aLineup[i] ? aLineup[i].points || 0 : '-';
          csvContent += `${hP},${hPts},,${aP},${aPts}\n`;
      }
      csvContent += `\n------------------------------------------------------------\n\n`;
    });

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Luzon13_Matchday_${currentRound}_Detailed.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processCSVText = async (text: string) => {
    const rows = text.split('\n').map(parseCsvRow);
    let updatedTeams: string[] = [];
    let missingTeams: string[] = [];

    for (const team of teams) {
      if (!team.squad || team.squad.length === 0) continue;
      const teamNameVariations = [
        team.teamName, TEAM_NAMES[team.id], team.id,
        team.id === 'hamsili' ? 'חמסילי' : null, team.id === 'harale' ? 'חראלה' : null,
        team.id === 'tampa' ? 'טמפה' : null, team.id === 'tumali' ? 'תומאלי' : null,
        team.id === 'holonia' ? 'חולוניה' : null, team.id === 'pichichi' ? "פיצ'יצ'י" : null,
      ].filter(Boolean).map(cleanStr);
      
      let teamRowIdx = -1;
      for (let r = 0; r < rows.length; r++) {
        if (rows[r] && rows[r][0]) {
            const col0 = cleanStr(rows[r][0]);
            if (teamNameVariations.some(v => col0 === v || col0.includes(v!))) { teamRowIdx = r; break; }
        }
      }

      if (teamRowIdx !== -1) {
        const startingLineup: any[] = [];
        const bench: any[] = [];
        const foundPlayerIds = new Set();
        const roundSubsToCreate: any[] = []; 
        let teamPointsSum = 0;
        let mode = 'starters';
        const endRowIdx = Math.min(teamRowIdx + 25, rows.length);

        const findMatchOrCreate = (nameStr: string, posHint: string) => {
          if (!nameStr) return null;
          const cleanName = cleanStr(nameStr);
          if (cleanName.length < 2) return null;
          let matchedPlayer = team.squad.find((p: any) => {
             if (foundPlayerIds.has(p.id)) return false;
             const pNameClean = cleanStr(p.name);
             return cleanName === pNameClean || cleanName.includes(pNameClean) || pNameClean.includes(cleanName);
          });
          if (!matchedPlayer) {
              let pos = 'קשר';
              if (posHint.includes('שוער')) pos = 'שוער';
              if (posHint.includes('הגנה') || posHint.includes('בלם')) pos = 'הגנה';
              if (posHint.includes('חלוץ') || posHint.includes('התקפה')) pos = 'חלוץ';
              matchedPlayer = { id: 'ghost_' + Math.random().toString(36).substr(2, 9), name: nameStr.trim(), position: pos, team: posHint.trim() || 'Unknown', points: 0 };
          }
          return matchedPlayer;
        };

        for (let r = teamRowIdx + 1; r < endRowIdx; r++) {
          const row = rows[r];
          if (!row || row.length < 4) continue;
          
          const col1 = cleanStr(row[1]); const col2 = cleanStr(row[2]); 
          if (col1.includes('סיכום') || col2.includes('סיכום')) break;
          if (col1.includes('חילופים') || col2.includes('חילופים') || col2.includes('מוחלף')) { mode = 'subs'; continue; }

          let pts = 0;
          for (let c = row.length - 1; c >= 4; c--) {
              const val = row[c]?.trim();
              if (val !== '' && !isNaN(Number(val))) {
                  pts = Number(val);
                  break; 
              }
          }

          if (mode === 'starters') {
            const playerObj = findMatchOrCreate(row[3], row[2]);
            if (playerObj) {
              const playerWithPoints = { ...playerObj, points: pts };
              teamPointsSum += pts;
              if (startingLineup.length < 11) startingLineup.push(playerWithPoints);
              else bench.push(playerWithPoints);
              foundPlayerIds.add(playerObj.id);
            }
          } else if (mode === 'subs') {
            const playerOutName = row[2]; const playerInName = row[3]; 
            if (!playerOutName || !playerInName || cleanStr(playerOutName).length < 2) continue;
            
            const pInObj = findMatchOrCreate(playerInName, '');
            if (pInObj) {
              const inPlayerWithPoints = { ...pInObj, points: pts }; 
              const outIndex = startingLineup.findIndex(p => {
                 const pClean = cleanStr(p.name); const oClean = cleanStr(playerOutName);
                 return oClean === pClean || oClean.includes(pClean) || pClean.includes(oClean);
              });
              
              let actualOutName = playerOutName;
              if (outIndex !== -1) {
                const actualOutPlayer = startingLineup.splice(outIndex, 1)[0];
                bench.push(actualOutPlayer); actualOutName = actualOutPlayer.name;
              }
              
              startingLineup.push(inPlayerWithPoints);
              foundPlayerIds.add(pInObj.id);
              roundSubsToCreate.push({ id: `sub_${Date.now()}_${Math.random().toString(36).substring(2,9)}`, type: 'HALFTIME_SUB', round: currentRound, playerIn: pInObj.name, playerOut: actualOutName, status: 'ACTIVE', timestamp: new Date().toISOString() });
            }
          }
        }

        team.squad.forEach((p: any) => { if (!foundPlayerIds.has(p.id)) bench.push({ ...p, points: 0 }); });

        if (startingLineup.length > 0) {
          try {
            const existingTransfers = (team.transfers || []).filter((t: any) => !(t.type === 'HALFTIME_SUB' && t.round === currentRound));
            const newTransfers = [...existingTransfers, ...roundSubsToCreate];
            await updateDoc(doc(db, 'users', team.id), { published_lineup: startingLineup, published_subs_out: bench, lineup: startingLineup, transfers: newTransfers });
            updatedTeams.push(`${team.teamName || TEAM_NAMES[team.id]} (${teamPointsSum} נק')`);
          } catch(e) { console.error("Error updating", team.id, e); }
        } else { missingTeams.push(team.teamName || TEAM_NAMES[team.id]); }
      } else { missingTeams.push(team.teamName || TEAM_NAMES[team.id]); }
    }
    
    if (updatedTeams.length > 0) {
      let msg = `✅ ${updatedTeams.length} קבוצות נשאבו במדויק!\n${updatedTeams.join('\n')}`;
      if (missingTeams.length > 0) msg += `\n\n⚠️ ${missingTeams.length} קבוצות חסרות בקובץ:\n${missingTeams.join(', ')}`;
      setAppAlert({title: 'טעינה הושלמה! 🪄', msg: msg, type: 'success'});
    } else { setAppAlert({title: 'שגיאה בסריקה', msg: 'לא הצלחנו למצוא אף קבוצה. ודא שהמבנה נכון.', type: 'error'}); }
  };

  const executeFetchFromDrive = async () => {
    if (!driveUrlInput.trim()) return;
    setDriveModalOpen(false); setIsProcessingRound(true);
    try {
      const response = await fetch(driveUrlInput.trim());
      if (!response.ok) throw new Error('Network response was not ok');
      const csvText = await response.text();
      await processCSVText(csvText);
    } catch (error) { setAppAlert({title: 'שגיאת רשת', msg: 'לא הצלחנו למשוך את הנתונים מגוגל דרייב.', type: 'error'}); }
    setIsProcessingRound(false); setDriveUrlInput('');
  };

  const calculateTeamScore = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return 0;
    
    let total = 0;
    
    const currentLineup = applySubstitutionsToLineup(team);
    if (currentLineup) {
        total += currentLineup.reduce((sum: number, p: any) => sum + (Number(p.points) || 0), 0);
    }
    
    const roundSubs = (team.transfers || []).filter((t: any) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
    
    roundSubs.forEach((sub: any) => {
        const allPossibleOutPlayers = [...(team.published_subs_out || []), ...(team.squad || []), ...(team.players || [])];
        const benchedPlayerOut = allPossibleOutPlayers.find((p: any) => p.name === sub.playerOut);
        
        if (benchedPlayerOut) {
            total += (Number(benchedPlayerOut.points) || 0);
        }
    });
    
    return total;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && editingPlayer) setEditingPlayer(null); };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingPlayer]);

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

  const calculatePointsFromStats = (statsObj: any, pos: string) => {
      let p = 0; if (!statsObj) return 0; if (statsObj.notInSquad) return -1;
      const isGk = ['GK', 'שוער'].includes(pos); const isDef = ['DEF', 'הגנה', 'בלם', 'מגן'].includes(pos);
      
      if (statsObj.started) p += 1; 
      if (statsObj.played60) p += 1; 
      if (statsObj.won) p += 2;
      
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
        
        if (field === 'conceded' && value > 0) {
            newStats.cleanSheet = false;
        }
        
        if (field === 'cleanSheet' && value === true) {
            newStats.conceded = 0;
        }
        
        return newStats;
    }); 
  };

  const resetPlayerStats = () => {
    setStats({ started: false, played60: false, notInSquad: false, won: false, goals: 0, assists: 0, cleanSheet: false, conceded: 0, yellow: false, secondYellow: false, red: false, penaltyWon: 0, penaltyMissed: 0, penaltySaved: 0, ownGoals: 0, assistOwnGoal: 0 });
  };

  const currentMatches = fixtures.find(r => r.round === currentRound)?.matches || [];

  const savePlayerPoints = async () => {
    if (!editingPlayer) return;
    const teamId = editingPlayer.teamId;
    try {
      const teamRef = doc(db, 'users', teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) return;
      const freshTeam = teamSnap.data();
      const finalPoints = calculatePointsFromStats(stats, editingPlayer.player.position);
      
      const updatePlayerInList = (list: any[]) => (list || []).map((p: any) => 
        (p.id === editingPlayer.player.id || p.name === editingPlayer.player.name) 
          ? { ...p, points: finalPoints, stats: stats } 
          : p
      );
      
      const updatedLineup = updatePlayerInList(freshTeam.published_lineup || []);
      const updatedSubsOut = updatePlayerInList(freshTeam.published_subs_out || []);
      const updatedSquad = updatePlayerInList(freshTeam.squad || []);
      
      await updateDoc(teamRef, { 
          published_lineup: updatedLineup, 
          published_subs_out: updatedSubsOut, 
          squad: updatedSquad,
          lineup: updatedLineup,
          players: updatedSquad
      });
      setEditingPlayer(null);
      showToast('ניקוד נשמר בהצלחה!', 'success');
    } catch (e) { setAppAlert({title:'שגיאה', msg: 'שגיאה בעדכון נקודות', type: 'error'}); }
  };

  const generateRazZahaviSummary = (matchesData: any[]) => {
    const titles = [
      "שערורייה! פסטיבל! לוזון ליג בשיא העוצמה!", 
      "קונצרט של כדורגל וניהול כושל! בואו נדבר תכלס!", 
      "צחנה או שירה בתנועה? המחזור שטרף את הקלפים!", 
      "הפטריוטים של הפנטזי: ינון מגל היה בוכה מהמחזור הזה!"
    ];
    let text = `🚨 **${titles[Math.floor(Math.random() * titles.length)]}** 🚨\n\n`;
    text += `כאן רז זהבי, ואני אומר לכם שהמחזור הזה של פנטזי לוזון השאיר לי צפצופים באוזניים! איזה מנג'רים, איזו רמה! בואו נצלול למה שהיה על הדשא:\n\n`;
    
    const tightHomeWins = ["איזה קרב אדיר!", "משחק צמוד עם סכינים בין השיניים!", "המגרש רעד, אבל הבית שמר על הבית.", "ניצחון בשיניים, שלוש נקודות של אופי."];
    const tightAwayWins = ["עקיצה של אלופים!", "גניבה לאור יום!", "אורחת לא מנומסת בעליל שלוקחת את כל הקופה.", "משחק חוץ אכזרי אבל יעיל."];
    
    matchesData.forEach((m) => {
      const diff = Math.abs(m.homeScore - m.awayScore);
      if (m.homeScore > m.awayScore) {
        if (diff >= 20) {
          text += `💥 **${m.hName} - ${m.aName} (${m.homeScore}:${m.awayScore})**\nמעוכה! קונצרט! ${m.hName} עשתה שמות ב${m.aName}, פירקה אותה ב-${diff} הפרש ולקחה 3 נקודות של דורסנות.\n\n`;
        } else {
          const randText = tightHomeWins[Math.floor(Math.random() * tightHomeWins.length)];
          text += `⚔️ **${m.hName} - ${m.aName} (${m.homeScore}:${m.awayScore})**\n${randText} ${m.hName} גירדה פה 2 נקודות סופר חשובות.\n\n`;
        }
      } else if (m.awayScore > m.homeScore) {
        if (diff >= 20) {
          text += `🔥 **${m.aName} - ${m.hName} (${m.awayScore}:${m.homeScore})**\nשוד ושבר בקופות! ${m.aName} באה לזירת החוץ ופשוט דרסה. 3 נקודות קל למנג'ר הגאון.\n\n`;
        } else {
          const randText = tightAwayWins[Math.floor(Math.random() * tightAwayWins.length)];
          text += `🎯 **${m.aName} - ${m.hName} (${m.awayScore}:${m.homeScore})**\n${randText} ${m.aName} לוקחת פה 2 נקודות חוץ יקרות מפז.\n\n`;
        }
      } else {
        text += `🤝 **${m.hName} - ${m.aName} (${m.homeScore}:${m.awayScore})**\nחלוקת נקודות חסרת מעוף. נקודה אחת לכל אחת ויאללה הביתה.\n\n`;
      }
    });
    text += `הטבלה רותחת, הפערים מצטמצמים, והמחזור הבא כבר מעבר לפינה. אל תלכו לשום מקום! 🍿`;
    return text;
  };

  const executeCloseRound = async () => {
    setConfirmCloseModalOpen(false); 
    setIsProcessingRound(true);
    try {
      const backupData = {
        roundToRestore: currentRound,
        timestamp: new Date().toISOString(),
        teamsSnapshot: JSON.parse(JSON.stringify(teams)),
        fixturesSnapshot: JSON.parse(JSON.stringify(fixtures)),
        generatedPostIds: [] as string[]
      };

      const emptyStats = { started: false, played60: false, notInSquad: false, won: false, goals: 0, assists: 0, cleanSheet: false, conceded: 0, yellow: false, secondYellow: false, red: false, penaltyWon: 0, penaltyMissed: 0, penaltySaved: 0, ownGoals: 0, assistOwnGoal: 0 };

      const matchesDataForSummary: any[] = [];
      for (const match of currentMatches) {
        const homeScore = calculateTeamScore(match.h);
        const awayScore = calculateTeamScore(match.a);
        matchesDataForSummary.push({ hName: TEAM_NAMES[match.h] || match.h, aName: TEAM_NAMES[match.a] || match.a, homeScore, awayScore });

        let hPts = 0, aPts = 0, hW = 0, hD = 0, hL = 0, aW = 0, aD = 0, aL = 0;
        if (homeScore > awayScore) { hPts = (homeScore - awayScore >= 20) ? 3 : 2; hW = 1; aL = 1; } 
        else if (awayScore > homeScore) { aPts = (awayScore - homeScore >= 20) ? 3 : 2; aW = 1; hL = 1; } 
        else { hPts = 1; aPts = 1; hD = 1; aD = 1; }

        const hTeam = teams.find(t => t.id === match.h); const aTeam = teams.find(t => t.id === match.a);

        if(hTeam) {
          const resetSquad = (hTeam.squad || []).map((p:any) => ({...p, points: 0, stats: emptyStats}));
          await updateDoc(doc(db, 'users', hTeam.id), { points: (hTeam.points || 0) + hPts, gf: (hTeam.gf || 0) + homeScore, ga: (hTeam.ga || 0) + awayScore, wins: (hTeam.wins || 0) + hW, draws: (hTeam.draws || 0) + hD, losses: (hTeam.losses || 0) + hL, played: (hTeam.played || 0) + 1, published_lineup: [], published_subs_out: resetSquad, lineup: [], squad: resetSquad });
        }
        if(aTeam) {
          const resetSquad = (aTeam.squad || []).map((p:any) => ({...p, points: 0, stats: emptyStats}));
          await updateDoc(doc(db, 'users', aTeam.id), { points: (aTeam.points || 0) + aPts, gf: (aTeam.gf || 0) + awayScore, ga: (aTeam.ga || 0) + homeScore, wins: (aTeam.wins || 0) + aW, draws: (aTeam.draws || 0) + aD, losses: (aTeam.losses || 0) + aL, played: (aTeam.played || 0) + 1, published_lineup: [], published_subs_out: resetSquad, lineup: [], squad: resetSquad });
        }
      }

      const summaryText = generateRazZahaviSummary(matchesDataForSummary);
      const personas = [ { name: 'רז זהבי', handle: '@razzahavi_sport5' }, { name: 'הפטריוטים - פנטזי', handle: '@patriots_luzon' } ];
      const randomPersona = personas[Math.floor(Math.random() * personas.length)];

      const zahaviPostRef = await addDoc(collection(db, 'social_posts'), {
        authorName: randomPersona.name, handle: randomPersona.handle, teamId: 'system', isVerified: true, type: 'article', content: summaryText, likes: Math.floor(Math.random() * 15) + 5, likedBy: [], comments: [], timestamp: new Date().toISOString()
      });
      backupData.generatedPostIds.push(zahaviPostRef.id);

      const activeApiKey = process.env.GEMINI_API_KEY || localStorage.getItem('gemini_api_key');

      if (activeApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: activeApiKey });
          const prompt = `אתה אנליסט כדורגל ופנטזי בכיר וחד. כתוב פוסט סיכום מקצועי ומעמיק למחזור ${currentRound} של ליגת "פנטזי לוזון 13".
          אלו תוצאות המשחקים של המחזור שהסתיים:
          ${matchesDataForSummary.map(m => `${m.hName} ${m.homeScore} - ${m.awayScore} ${m.aName}`).join('\n')}

          הנחיות קריטיות:
          - כתוב פוסט מרתק, מקצועי, עם ניתוח קצר לכל משחק. למה קבוצה אחת ניצחה? (תמציא סיבות מקצועיות ומשעשעות שקשורות לכדורגל, למשל: "הגנה מברזל", "חילופים מבריקים", "קריסה במחצית", "מומנטום מטורף").
          - אל תהיה רובוטי. אל תחזור על תבניות. חשוב שזה ייראה כמו ניתוח אמיתי.
          - השתמש באימוג'ים מתאימים.
          - ללא תגיות מיוחדות כמו # או כוכביות.
          - הפוסט יפורסם ברשת חברתית פנימית של הליגה, תתנהג כמו פרשן שמוביל את השיח.`;

          const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ parts: [{ text: prompt }] }]
          });

          const aiText = response.text;
          if (aiText) {
              const aiPostRef = await addDoc(collection(db, 'social_posts'), {
                authorName: 'האנליסט AI 🤖', handle: '@luzon_analyst', teamId: 'system', isVerified: true, type: 'article', content: aiText, likes: Math.floor(Math.random() * 20) + 10, likedBy: [], comments: [], timestamp: new Date(Date.now() + 2000).toISOString()
              });
              backupData.generatedPostIds.push(aiPostRef.id);
          }
        } catch (aiErr) {
          console.error("AI Summary failed:", aiErr);
        }
      }

      const updatedRounds = fixtures.map(r => {
        if(r.round === currentRound) { 
          return { ...r, isPlayed: true, matches: r.matches.map((m:any) => ({ ...m, hs: calculateTeamScore(m.h), as: calculateTeamScore(m.a) })) } 
        }
        return r;
      });
      await updateDoc(doc(db, 'leagueData', 'fixtures'), { rounds: updatedRounds });
      await updateDoc(doc(db, 'leagueData', 'settings'), { currentRound: currentRound + 1 });
      
      await setDoc(doc(db, 'round_backups', `backup_round_${currentRound}`), backupData);

      setAppAlert({title: 'מחזור נסגר', msg: 'המחזור נסגר בהצלחה! הניקוד, שערי הזכות/חובה והניצחונות עודכנו בטבלה. סיכום מחזור עלה לפיד.\n\nגיבוי של הליגה נשמר במערכת.', type: 'success'});
    } catch (e: any) { setAppAlert({title: 'שגיאה', msg: 'שגיאה בסגירת מחזור: ' + e.message, type: 'error'}); }
    setIsProcessingRound(false);
  };

  const hasAnyUnreadGlobal = teams.some(t => {
      if (t.id === 'admin') return false;
      const latestTs = getLatestTransferTimestamp(t);
      return latestTs > 0 && latestTs !== readReceipts[t.id];
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center pt-40 h-full gap-6">
      <div className="relative w-20 h-20 flex items-center justify-center animate-bounce"><span className="text-6xl drop-shadow-2xl">⚽</span><div className="absolute -bottom-2 w-12 h-2 bg-black/40 rounded-[100%] animate-pulse"></div></div>
      <div className="flex flex-col items-center gap-1"><div className="font-black text-green-500 text-xl tracking-[0.3em] uppercase animate-pulse">Connecting</div><div className="text-slate-500 font-bold text-xs uppercase tracking-widest">To Live Arena...</div></div>
    </div>
  );

  if (currentMatches.length === 0) return (
    <div className="text-center p-12 md:p-20 bg-slate-900/60 backdrop-blur-xl rounded-[40px] border border-white/5 shadow-2xl max-w-2xl mx-auto mt-10">
      <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><span className="text-5xl">🏟️</span></div>
      <h2 className="text-3xl font-black text-white mb-2">אין משחקים</h2>
      <p className="text-slate-400 font-bold">טרם שובצו משחקים למחזור {currentRound}</p>
    </div>
  );

  const currentDisplayPoints = editingPlayer ? calculatePointsFromStats(stats, editingPlayer.player.position) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500 pb-32 font-sans" dir="rtl">
      {toast && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.8)] border flex items-center gap-3 animate-in slide-in-from-top-10 duration-300 backdrop-blur-xl ${toast.type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' : 'bg-green-950/90 border-green-500/50 text-green-200'}`}>
          <span className="text-2xl">{toast.type === 'error' ? '🛑' : '✅'}</span>
          <span className="font-black text-sm tracking-wide">{toast.msg}</span>
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
            
            <button onClick={() => setAppAlert(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all active:scale-95">סגור</button>
          </div>
        </div>
      )}

      <div className="px-2" data-html2canvas-ignore="true">
        <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-3 flex items-center gap-4 overflow-x-auto no-scrollbar">
           <div className="flex flex-col items-center shrink-0 ml-2">
              <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center relative">
                 <Users className="w-5 h-5 text-green-400" />
                 <span className="absolute -top-1 -right-1 bg-green-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">LIVE</span>
              </div>
           </div>
           <div className="flex items-center gap-3">
              {onlineUsers.length === 0 ? (
                <span className="text-xs font-bold text-slate-500 italic px-2">מחכה למנג'רים...</span>
              ) : (
                onlineUsers.map(u => (
                  <div key={u.id} className="flex flex-col items-center gap-1 shrink-0 animate-in fade-in zoom-in duration-300">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-green-500 flex items-center justify-center text-white font-black text-xs shadow-lg">
                        {u.name ? u.name.charAt(0) : '?'}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-300 truncate max-w-[60px]">
                      {u.name ? u.name.split(' ')[0] : 'אורח'}
                    </span>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

      {isLogModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-end md:items-center justify-center px-0 pb-[95px] md:pb-[100px] md:px-4 pt-10 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsLogModalOpen(false)}></div>
          <div className="bg-[#0f172a] border border-slate-800 rounded-t-[32px] md:rounded-[32px] w-full max-w-2xl shadow-2xl flex flex-col relative h-[85vh] md:max-h-[calc(100vh-140px)] animate-in slide-in-from-bottom-10 overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-800/50 flex justify-between items-center bg-[#0f172a] shrink-0 z-20 shadow-sm relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-700/50 rounded-full md:hidden"></div>
              <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-3"><ClipboardList className="w-6 h-6 text-blue-400" />יומן אירועים - מחזור {currentRound}</h3>
              <button onClick={() => setIsLogModalOpen(false)} className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-4 md:p-5 bg-slate-900/50 border-b border-slate-800 flex flex-wrap justify-center gap-2 md:gap-3 shrink-0">
              <button onClick={() => handleSelectLogTab('all')} className={`px-4 py-2 rounded-full text-xs md:text-sm font-black transition-all flex items-center gap-2 border ${logTeamId === 'all' ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/50' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>
                  <Globe2 className="w-4 h-4" /><span>כל הליגה</span>
              </button>
              {teams.filter(t => t.id !== 'admin' && t.teamName?.toUpperCase() !== 'ADMIN').map(t => {
                const latestTs = getLatestTransferTimestamp(t);
                const hasUnread = latestTs > 0 && latestTs !== readReceipts[t.id];
                return (
                  <button key={t.id} onClick={() => handleSelectLogTab(t.id)} className={`px-4 py-2 rounded-full text-xs md:text-sm font-black transition-all flex items-center gap-2 border ${logTeamId === t.id ? 'bg-slate-800 border-slate-500 text-white shadow-md shadow-black/50' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}>
                    <span>{t.teamName || TEAM_NAMES[t.id]}</span>
                    {hasUnread && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0f172a] custom-scrollbar">
              {logTeamId ? (() => {
                let logsToRender: any[] = [];
                if (logTeamId === 'all') {
                    teams.forEach(t => {
                        if (t.id === 'admin') return;
                        logsToRender.push(...(t.transfers || []).filter((tr:any) => tr.round === currentRound).map((tr:any) => ({...tr, teamName: t.teamName, teamId: t.id})));
                    });
                } else {
                    const team = teams.find(t => t.id === logTeamId);
                    logsToRender = (team?.transfers || []).filter((tr:any) => tr.round === currentRound).map((tr:any) => ({...tr, teamName: team.teamName, teamId: team.id}));
                }

                logsToRender = logsToRender.filter((log: any) => !['IN', 'OUT', 'FREEZE_IN'].includes(log.type));

                logsToRender.sort((a,b) => {
                     const timeA = a.timestamp?.includes('T') ? new Date(a.timestamp).getTime() : (a.id ? parseInt(a.id.split('_')[1] || '0') : 0);
                     const timeB = b.timestamp?.includes('T') ? new Date(b.timestamp).getTime() : (b.id ? parseInt(b.id.split('_')[1] || '0') : 0);
                     return timeB - timeA;
                });

                if (logsToRender.length === 0) return (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-900/30 rounded-[32px] border border-white/5 shadow-inner mt-4">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-lg border border-slate-700"><span className="text-3xl opacity-60">📭</span></div>
                    <h4 className="text-xl font-black text-white mb-2 tracking-wide">שקט בגזרה</h4>
                    <p className="text-sm font-bold text-slate-500 max-w-[200px] leading-relaxed">{logTeamId === 'all' ? 'הליגה רדומה.' : 'הקבוצה טרם ביצעה שינויים.'}</p>
                  </div>
                );

                return (
                  <div className="space-y-4 md:space-y-6 pb-10">
                    {logsToRender.map((log: any, index: number) => {
                      const isCancelAction = log.type === 'CANCELLED_SUB'; const isHalftime = log.type === 'HALFTIME_SUB'; const isRegularEdit = log.type === 'REGULAR_EDIT';
                      const isLateEdit = log.type === 'LATE_REGULAR_EDIT';
                      let dotColor = isCancelAction ? 'bg-red-500 ring-red-950/50' : isHalftime && log.status !== 'CANCELLED' ? 'bg-orange-500 ring-orange-950/50' : isRegularEdit ? 'bg-blue-500 ring-blue-950/50' : isLateEdit ? 'bg-purple-500 ring-purple-950/50' : 'bg-slate-600 ring-slate-900';
                      
                      const displayTime = log.timestamp 
                          ? (log.timestamp.includes('T') ? new Date(log.timestamp).toLocaleString('he-IL', { hour12: false }) : log.timestamp) 
                          : 'ללא תאריך';

                      return (
                        <div key={log.id} className="flex gap-3 md:gap-4 relative group">
                          <div className="flex flex-col items-center relative z-10 w-6 shrink-0 pt-2"><div className={`w-3 h-3 rounded-full ring-4 shadow-sm z-20 ${dotColor}`}></div>{index !== logsToRender.length - 1 && <div className="w-[2px] bg-slate-800 flex-1 my-1 rounded-full group-hover:bg-slate-700 transition-colors"></div>}</div>
                          <div className={`flex-1 p-4 md:p-5 rounded-[24px] md:rounded-[32px] border shadow-lg transition-all ${isCancelAction ? 'bg-red-950/10 border-red-900/30' : log.status === 'CANCELLED' ? 'bg-slate-900/50 border-slate-800/50 opacity-60 grayscale' : isRegularEdit ? 'bg-blue-950/10 border-blue-900/30' : isLateEdit ? 'bg-purple-950/20 border-purple-500/40' : 'bg-slate-800/40 border-slate-700/60'}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-2 md:gap-3">
                                <span className="text-xl md:text-2xl drop-shadow-md">{isCancelAction ? '❌' : isHalftime ? '🔄' : isRegularEdit ? '📝' : isLateEdit ? '🚨' : '⚡'}</span>
                                <div className="flex flex-col">
                                    <span className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${isCancelAction ? 'text-red-400' : isHalftime ? 'text-orange-400' : isRegularEdit ? 'text-blue-400' : isLateEdit ? 'text-purple-400' : 'text-green-400'}`}>{isCancelAction ? 'חילוף בוטל' : isHalftime ? 'חילוף מחצית' : isRegularEdit ? 'עדכון הרכב' : isLateEdit ? 'אישור מנהל זירה' : 'פעולה'}</span>
                                    {logTeamId === 'all' && <span className="text-[10px] text-slate-400 font-bold mt-0.5">{log.teamName || TEAM_NAMES[log.teamId]}</span>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-xs text-slate-500 font-mono tracking-widest mb-1.5 bg-black/20 self-start inline-block px-2 py-0.5 rounded-md border border-slate-800">
                                {displayTime}
                            </div>

                            <div className="text-xs md:text-sm font-bold text-white pt-1">
                              {isCancelAction ? <span className="text-slate-400">החילוף של {log.playerOut} ב-{log.playerIn} <span className="text-red-400">בוטל</span>.</span> : isHalftime ? (
                                <div className="flex items-center gap-3 mt-1 bg-black/20 p-2.5 md:p-3 rounded-xl border border-white/5">
                                  <div className="flex flex-col items-end flex-1"><span className="text-[8px] md:text-[9px] text-red-500 uppercase tracking-widest mb-0.5 font-black">יצא</span><span className={`font-black text-red-400 ${log.status === 'CANCELLED' ? 'line-through opacity-70' : ''}`}>{log.playerOut}</span></div>
                                  <span className="text-slate-600 font-black text-xs md:text-sm">➔</span>
                                  <div className="flex flex-col items-start flex-1"><span className="text-[8px] md:text-[9px] text-green-500 uppercase tracking-widest mb-0.5 font-black">נכנס</span><span className={`font-black text-green-400 ${log.status === 'CANCELLED' ? 'line-through opacity-70' : ''}`}>{log.playerIn}</span></div>
                                </div>
                              ) : isRegularEdit || isLateEdit ? (
                                 <div className="flex flex-col gap-2 mt-1">
                                   <span className="text-sm font-bold text-zinc-300">
                                      {isLateEdit ? <><span className="text-purple-400">חילוף חריג</span> - לאחר שריקת פתיחה</> : 'בוצע עדכון הרכב / חילוף רגיל'}
                                   </span>
                                   {(log.playersIn?.length > 0 || log.playersOut?.length > 0) && (
                                     <div className="bg-black/20 p-2.5 md:p-3 rounded-xl border border-white/5 text-[10px] md:text-xs space-y-1.5">
                                       {log.playersOut?.length > 0 && <div className="flex gap-2"><span className="text-red-400 font-black shrink-0">⬇️ ירדו:</span> <span className="text-slate-300 font-medium">{log.playersOut.join(', ')}</span></div>}
                                       {log.playersIn?.length > 0 && <div className="flex gap-2"><span className="text-green-400 font-black shrink-0">⬆️ עלו:</span> <span className="text-slate-300 font-medium">{log.playersIn.join(', ')}</span></div>}
                                     </div>
                                   )}
                                 </div>
                              ) : <span>{log.playerIn || log.playerOut}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })() : null}
            </div>
          </div>
        </div>
      )}

      {/* --- אזור הצילום המרכזי של הזירה --- */}
      <div id="arena-capture-area" className="flex flex-col gap-6 pt-2 pb-6 px-2 -mx-2 rounded-[40px] bg-[#0f172a]">
        
        <div className="bg-slate-900/60 backdrop-blur-2xl rounded-[32px] border border-white/5 shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-transparent to-blue-500/10 opacity-30 pointer-events-none"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-emerald-500 to-blue-500"></div>
          
          <div className="p-5 md:p-8 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 relative z-10">
              
              <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-3 w-full md:w-auto order-3 md:order-1 justify-center md:justify-start" data-html2canvas-ignore="true">
                
                <button onClick={handleOpenLogModal} className="flex-1 md:flex-none p-3 md:p-3.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700/50 transition-all flex items-center justify-center gap-2 group relative active:scale-95">
                  <ClipboardList className="w-5 h-5 group-active:scale-90 transition-transform" />
                  <span className="text-xs md:text-sm font-bold md:hidden">יומן</span>
                  <span className="hidden md:inline font-bold text-sm ml-1">יומן</span>
                  {hasAnyUnreadGlobal && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span></span>}
                  
                  <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 pointer-events-none hidden md:block">
                      יומן אירועי מחזור
                  </span>
                </button>

                <button onClick={shareArenaAsImage} className="flex-1 md:flex-none p-3 md:p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl border border-blue-500/50 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 group relative active:scale-95">
                  <ImageIcon className="w-5 h-5 group-active:scale-90 transition-transform" />
                  <span className="text-xs md:text-sm font-bold md:hidden">שתף</span>
                  <span className="hidden md:inline font-bold text-sm ml-1">שתף</span>
                  
                  <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 pointer-events-none hidden md:block">
                      שיתוף תמונת זירה
                  </span>
                </button>

                {isModerator && (
                  <>
                    <button onClick={() => setDriveModalOpen(true)} className="flex-1 md:flex-none p-3 md:p-3.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-blue-400 rounded-2xl border border-slate-700/50 transition-all flex items-center justify-center gap-2 group relative active:scale-95">
                      <DownloadCloud className={`w-5 h-5 group-active:scale-90 transition-transform ${isProcessingRound ? 'animate-bounce text-blue-400' : ''}`} />
                      
                      <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 pointer-events-none hidden md:block">
                          סנכרון מהאקסל
                      </span>
                    </button>

                    <button onClick={exportArenaToExcel} className="flex-1 md:flex-none p-3 md:p-3.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-green-400 rounded-2xl border border-slate-700/50 transition-all flex items-center justify-center gap-2 group relative active:scale-95">
                      <Download className="w-5 h-5 group-active:scale-90 transition-transform" />
                      
                      <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 pointer-events-none hidden md:block">
                          ייצוא נתונים לאקסל
                      </span>
                    </button>
                  </>
                )}
              </div>

              <div className="text-center w-full md:w-auto order-1 md:order-2 flex flex-col items-center">
                <div className="flex items-center gap-2 md:gap-3 mb-2 bg-red-950/30 px-4 md:px-5 py-1 md:py-1.5 rounded-full border border-red-900/50 shadow-inner">
                  <div className="relative flex h-2.5 w-2.5 md:h-3 md:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 md:h-3 md:w-3 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]"></span></div>
                  <h2 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter drop-shadow-md">LIVE <span className="text-red-500">ARENA</span></h2>
                </div>
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full backdrop-blur-md">
                  <Trophy className="w-3 h-3 text-yellow-500" />
                  <span className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs">Matchday {currentRound}</span>
                </div>
              </div>

              <div className="w-full md:w-auto order-2 md:order-3 flex justify-center md:justify-end" data-html2canvas-ignore="true">
                {isModerator ? (
                  <button onClick={() => setConfirmCloseModalOpen(true)} disabled={isProcessingRound} className="w-full md:w-auto bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white font-black py-3 md:py-3.5 px-6 rounded-2xl border border-red-500/50 transition-all active:scale-95 text-sm shadow-lg flex items-center justify-center gap-2 group relative">
                    {isProcessingRound ? <span className="animate-pulse">מעבד...</span> : <>סגור מחזור <Flame className="w-4 h-4" /></>}
                    
                    <span className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl border border-slate-700 pointer-events-none hidden md:block">
                        סיום מחזור ואיפוס הרכבים
                    </span>
                  </button>
                ) : <div className="hidden md:block w-[180px]"></div>}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {currentMatches.map((match: any, idx: number) => {
            const hScore = calculateTeamScore(match.h);
            const aScore = calculateTeamScore(match.a);
            const isExpanded = expandedTeamId === match.h || expandedTeamId === match.a;
            
            // חישוב אירועי הלייב והשחקנים שנותרו
            const hEvents = getTeamLiveEvents(match.h);
            const aEvents = getTeamLiveEvents(match.a);
            const hUntouched = getUntouchedCount(match.h);
            const aUntouched = getUntouchedCount(match.a);
            
            return (
              <div key={idx} className={`bg-slate-900/60 backdrop-blur-md rounded-[32px] border transition-all duration-300 overflow-hidden flex flex-col ${isExpanded ? 'border-slate-500 shadow-[0_0_30px_rgba(255,255,255,0.05)]' : 'border-slate-800 shadow-xl hover:border-slate-700'}`}>
                
                <div className="p-0">
                  <div className={`flex items-stretch justify-between w-full h-full min-h-[90px] relative transition-colors ${isExpanded ? 'bg-slate-900/80' : 'hover:bg-slate-800/40'}`}>
                    
                    {/* --- קבוצת בית --- */}
                    <button onClick={() => toggleTeam(match.h)} className={`flex-1 flex flex-col justify-center items-center md:items-start px-2 md:px-6 transition-all active:scale-[0.98] ${expandedTeamId === match.h ? 'bg-slate-800 shadow-inner' : ''}`}>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">קבוצת בית</span>
                      <span className={`text-lg md:text-2xl font-black ${hScore > aScore ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : hScore < aScore ? 'text-slate-400' : 'text-white'}`}>{TEAM_NAMES[match.h] || match.h}</span>
                      {/* תצוגת "שחקנים שנותרו" מתחת לשם הקבוצה */}
                      <span className="text-[9px] md:text-[10px] text-slate-400 font-bold mt-1.5 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/50 whitespace-nowrap">
                        בקנה: {hUntouched} שחקנים
                      </span>
                    </button>

                    {/* --- לוח התוצאות ואזור האייקונים (כרטיסים/שערים) --- */}
                    <div className="shrink-0 flex flex-col items-center justify-center bg-slate-950/80 px-4 md:px-8 border-x border-slate-800 relative z-20 shadow-inner py-2">
                      
                      {/* אירועי לייב (מעל התוצאה) */}
                      <div className="flex justify-between w-full px-2 mb-1">
                          {/* אירועי בית */}
                          <div className="flex gap-1.5 items-center">
                              {hEvents.goals > 0 && <span className="flex items-center gap-0.5 text-white text-[10px] font-black"><span className="text-xs">⚽</span>{hEvents.goals}</span>}
                              {hEvents.yellows > 0 && <span className="flex items-center gap-0.5 text-yellow-400 text-[10px] font-black"><div className="w-1.5 h-2.5 bg-yellow-400 rounded-sm"></div>{hEvents.yellows}</span>}
                              {hEvents.reds > 0 && <span className="flex items-center gap-0.5 text-red-500 text-[10px] font-black"><div className="w-1.5 h-2.5 bg-red-500 rounded-sm"></div>{hEvents.reds}</span>}
                          </div>

                          <div className="w-4"></div> {/* מרווח אמצע */}

                          {/* אירועי חוץ */}
                          <div className="flex gap-1.5 items-center">
                              {aEvents.reds > 0 && <span className="flex items-center gap-0.5 text-red-500 text-[10px] font-black">{aEvents.reds}<div className="w-1.5 h-2.5 bg-red-500 rounded-sm"></div></span>}
                              {aEvents.yellows > 0 && <span className="flex items-center gap-0.5 text-yellow-400 text-[10px] font-black">{aEvents.yellows}<div className="w-1.5 h-2.5 bg-yellow-400 rounded-sm"></div></span>}
                              {aEvents.goals > 0 && <span className="flex items-center gap-0.5 text-white text-[10px] font-black">{aEvents.goals}<span className="text-xs">⚽</span></span>}
                          </div>
                      </div>

                      {/* התוצאה עצמה */}
                      <div className="flex items-center justify-center gap-3 md:gap-5 w-full">
                          <span className={`text-3xl md:text-5xl font-black tabular-nums tracking-tighter ${hScore > aScore ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]' : hScore < aScore ? 'text-slate-500' : 'text-white'}`}>{hScore}</span>
                          <span className="text-xl md:text-2xl font-black text-slate-700 pb-1">:</span>
                          <span className={`text-3xl md:text-5xl font-black tabular-nums tracking-tighter ${aScore > hScore ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.4)]' : aScore < hScore ? 'text-slate-500' : 'text-white'}`}>{aScore}</span>
                      </div>

                    </div>

                    {/* --- קבוצת חוץ --- */}
                    <button onClick={() => toggleTeam(match.a)} className={`flex-1 flex flex-col justify-center items-center md:items-end px-2 md:px-6 transition-all active:scale-[0.98] ${expandedTeamId === match.a ? 'bg-slate-800 shadow-inner' : ''}`}>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">קבוצת חוץ</span>
                      <span className={`text-lg md:text-2xl font-black ${aScore > hScore ? 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : aScore < hScore ? 'text-slate-400' : 'text-white'}`}>{TEAM_NAMES[match.a] || match.a}</span>
                      {/* תצוגת "שחקנים שנותרו" מתחת לשם הקבוצה */}
                      <span className="text-[9px] md:text-[10px] text-slate-400 font-bold mt-1.5 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/50 whitespace-nowrap">
                        בקנה: {aUntouched} שחקנים
                      </span>
                    </button>

                  </div>
                </div>

                {isExpanded && (
                  <div className="animate-in slide-in-from-top-4 duration-300 border-t border-slate-800 bg-slate-950/50" data-html2canvas-ignore="true">
                    <div className="p-4 md:p-6">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shadow-inner">🛡️</div>
                          <div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">מבט טקטי</span>
                            <span className="text-base md:text-lg font-black text-white tracking-wide">{expandedTeamId && (TEAM_NAMES[expandedTeamId] || expandedTeamId)}</span>
                          </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl shadow-inner">
                            <span className="text-xs font-black text-slate-300 tracking-widest flex items-center gap-2"><span>מערך</span><span className="text-green-400">{getFormation(applySubstitutionsToLineup(teams.find(t => t.id === expandedTeamId)))}</span></span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-b from-[#13301d] to-[#0a1f11] rounded-[32px] p-4 md:p-6 min-h-[400px] md:min-h-[500px] relative overflow-hidden border-[4px] border-slate-800 shadow-2xl">
                        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 10%, #fff 10%, #fff 20%)' }}></div>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[15%] border-[2px] border-white/30 rounded-b-3xl pointer-events-none"></div>
                        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-1/5 h-[8%] border-[2px] border-transparent border-b-white/30 rounded-b-full pointer-events-none"></div>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/6 h-[6%] border-[2px] border-white/30 rounded-b-lg pointer-events-none"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[18%] border-[2px] border-white/30 rounded-t-[40px] pointer-events-none"></div>
                        <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 w-1/4 h-[10%] border-[2px] border-transparent border-t-white/30 rounded-t-full pointer-events-none"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/4 h-[8%] border-[2px] border-white/30 rounded-t-xl pointer-events-none"></div>
                        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-2 h-2 bg-white/40 rounded-full pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-[2px] border-white/30 rounded-full pointer-events-none"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/80 rounded-full pointer-events-none shadow-[0_0_10px_#fff]"></div>
                        <div className="absolute top-1/2 w-full border-t-[2px] border-white/30 pointer-events-none"></div>

                        <div className="flex flex-col justify-around h-full gap-8 relative z-10 py-4">
                          {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
                            const teamObj = teams.find(t => t.id === expandedTeamId!);
                            const currentLineup = applySubstitutionsToLineup(teamObj);
                            const posPlayers = currentLineup.filter((p: any) => isPosMatch(p.position, pos));
                            
                            if (posPlayers.length === 0) return <div key={pos} className="min-h-[50px]"></div>;

                            return (
                              <div key={pos} className="flex justify-center flex-wrap gap-2 sm:gap-4 md:gap-8">
                                {posPlayers.map((p: any) => {
                                  const nameParts = p.name.split(' ');
                                  const lastName = nameParts[nameParts.length - 1];
                                  const isSubIn = (teamObj?.transfers || []).some((t:any) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED' && t.playerIn === p.name);
                                  const colors = getTeamColors(teamObj?.teamName || '', p.position === 'GK');
                                  
                                  const hasPlayed = (p.stats && Object.values(p.stats).some(v => v === true || (typeof v === 'number' && v > 0))) || (Number(p.points) !== 0);
                                  const isUntouched = !hasPlayed && Number(p.points) === 0;

                                  return (
                                    <div key={p.id} onClick={() => setEditingPlayer({teamId: expandedTeamId!, player: p})} className="flex flex-col items-center gap-0.5 group active:scale-95 transition-transform w-[48px] sm:w-[64px] md:w-[76px] relative cursor-pointer">
                                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 relative transition-all duration-300 group-hover:-translate-y-2 group-hover:scale-110 z-20">
                                        <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={['GK', 'שוער'].includes(p.position) ? '🧤' : p.position} />
                                        
                                        <div className={`absolute -top-2.5 -right-2.5 sm:-top-3 sm:-right-3 min-w-[22px] h-[22px] sm:min-w-[24px] sm:h-[24px] px-1 rounded-full flex items-center justify-center text-[10.5px] sm:text-xs font-black shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-2 z-30 ${
                                          p.points > 0 ? 'bg-green-500 text-black border-slate-900' : 
                                          p.points < 0 ? 'bg-red-500 text-white border-slate-900' : 
                                          isUntouched ? 'bg-slate-800/80 text-slate-500 border-slate-600 border-dashed' : 
                                          'bg-slate-700 text-white border-slate-900'
                                        }`}>
                                          {isUntouched ? '-' : p.points}
                                        </div>
                                        
                                        {isSubIn && (
                                          <div className="absolute -bottom-1 -left-1 z-30 group/sub">
                                            <div className="bg-orange-500 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[10px] shadow-xl border-2 border-slate-900 cursor-help">🔄</div>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-black/90 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-xl opacity-0 invisible group-hover/sub:opacity-100 group-hover/sub:visible transition-all text-center pointer-events-none z-50 border border-orange-500/50 whitespace-nowrap">
                                              שחקן מחליף
                                            </div>
                                          </div>
                                        )}

                                      </div>
                                      <div className="w-6 sm:w-8 h-1 sm:h-1.5 bg-black/40 rounded-[100%] blur-[2px] transition-all duration-300 group-hover:w-4 sm:group-hover:w-6 group-hover:bg-black/20 group-hover:translate-y-1"></div>
                                      <div className="relative z-30 -mt-1 flex justify-center w-full">
                                        <div className="bg-black/80 px-1.5 py-1 rounded-md border border-white/10 min-w-[56px] max-w-[65px] flex items-center justify-center shadow-lg group-hover:bg-black transition-colors">
                                           <span className="text-[10.5px] sm:text-[11px] md:text-xs font-black text-white leading-tight break-words text-center drop-shadow-md">{lastName}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {(() => {
                        const team = teams.find(t => t.id === expandedTeamId!);
                        const subs = (team?.transfers || []).filter((t: any) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');

                        if (subs.length === 0) return null;

                        return (
                          <div className="mt-6 bg-slate-900 rounded-[24px] p-4 md:p-5 border border-slate-800 shadow-inner">
                            <div className="text-xs font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <RefreshCw className="w-4 h-4" /><span>חילופי מחצית ({subs.length}/3)</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {subs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((sub: any, sIdx: number) => {
                                const playerOutObj = (team?.squad || []).find((p: any) => p.name === sub.playerOut);
                                const playerInObj = (team?.squad || []).find((p: any) => p.name === sub.playerIn);

                                return (
                                  <div key={sIdx} className="bg-slate-950 p-2.5 md:p-3 rounded-xl border border-slate-700 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <button onClick={() => playerOutObj && setEditingPlayer({ teamId: expandedTeamId!, player: playerOutObj })} className={`flex flex-col items-start min-w-0 group flex-1 cursor-pointer`}>
                                        <span className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase tracking-wider">יצא</span>
                                        <div className="flex items-center gap-1.5 w-full">
                                          <span className={`text-[10px] md:text-xs font-black text-red-400 truncate group-hover:underline`}>{sub.playerOut}</span>
                                          {playerOutObj && <span className={`px-1 md:px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 border ${playerOutObj.points > 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : playerOutObj.points < 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{playerOutObj.points} pt</span>}
                                        </div>
                                      </button>
                                    </div>
                                    <span className="text-slate-600 shrink-0 text-xs md:text-sm">➔</span>
                                    <button onClick={() => playerInObj && setEditingPlayer({ teamId: expandedTeamId!, player: playerInObj })} className={`flex flex-col items-end min-w-0 group flex-1 cursor-pointer`}>
                                      <span className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase tracking-wider">נכנס</span>
                                      <div className="flex items-center gap-1.5 w-full justify-end">
                                        {playerInObj && <span className={`px-1 md:px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 border ${playerInObj.points > 0 ? 'bg-green-500/10 text-green-400 border-green-500/20' : playerInObj.points < 0 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{playerInObj.points} pt</span>}
                                        <span className={`text-[10px] md:text-xs font-black text-green-400 truncate group-hover:underline`}>{sub.playerIn}</span>
                                      </div>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  </div>
                )}
                
                {/* 🟢 כאן הוספתי את הפיצול של הכפתורים - H2H ודוח הניקוד (VAR) 🟢 */}
                <div className="flex w-full bg-slate-900/30 border-t border-slate-800" data-html2canvas-ignore="true">
                    <button onClick={(e) => { e.stopPropagation(); setH2hModal({hId: match.h, aId: match.a}); }} className="flex-1 py-2 border-l border-slate-800 flex justify-center items-center gap-2 text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors">
                       <Swords className="w-4 h-4" /><span className="text-xs font-black">H2H</span>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setAuditModal({hId: match.h, aId: match.a}); setAuditActiveTab('h'); setAuditGroupByReal(false); }} className="flex-1 py-2 flex justify-center items-center gap-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800/50 transition-colors">
                       <span className="text-base">📊</span><span className="text-xs font-black">דוח ניקוד (VAR)</span>
                    </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {driveModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center px-4 pb-[95px] md:pb-[100px] backdrop-blur-sm animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 border border-blue-500/50 p-8 rounded-[40px] w-full max-w-md flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.15)] relative text-center">
                <button onClick={() => setDriveModalOpen(false)} className="absolute top-6 left-6 text-slate-500 hover:text-white font-black text-xl transition-colors">✕</button>
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DownloadCloud className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">סנכרון נתונים מאקסל</h3>
                <p className="text-sm text-slate-400 font-bold mb-4">
                  הדבק כאן את קישור ה-CSV של הלשונית הנוכחית מאקסל המשחק.
                </p>

                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-6 text-right">
                   <h4 className="text-sm font-black text-blue-400 mb-2">איך מוציאים את הקישור הנכון?</h4>
                   <ol className="text-xs text-slate-300 space-y-2 pr-4 list-decimal marker:text-blue-500 font-medium">
                      <li>באקסל, ודא שאתה נמצא על הלשונית של <b>המחזור הנוכחי</b>.</li>
                      <li>לחץ למעלה על <b>קובץ</b> ➔ <b>שיתוף</b> ➔ <b>פרסום באינטרנט</b>.</li>
                      <li>בחלון שייפתח, בחר בתיבה הראשונה את <b>הלשונית הספציפית</b> (לא "מסמך שלם").</li>
                      <li>בתיבה השנייה בחר בפורמט <b>ערכים מופרדים בפסיקים (.csv)</b>.</li>
                      <li>לחץ "פרסם", העתק את הקישור שנוצר והדבק אותו כאן למטה.</li>
                   </ol>
                </div>

                <input 
                  type="text" 
                  value={driveUrlInput} 
                  onChange={e => setDriveUrlInput(e.target.value)} 
                  placeholder="https://docs.google.com/spreadsheets/..." 
                  className="w-full bg-black/50 border border-slate-600 p-4 rounded-xl text-white outline-none focus:border-blue-500 text-left font-mono text-sm mb-6" 
                  dir="ltr" 
                />
                <button 
                  onClick={executeFetchFromDrive} 
                  disabled={isProcessingRound || !driveUrlInput.trim()} 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all text-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isProcessingRound ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> שואב נתונים...</>
                    ) : (
                      'סנכרן עכשיו ⚡'
                    )}
                </button>
            </div>
        </div>
      )}

      {editingPlayer && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center items-center pt-10 px-0 sm:px-4 pb-[95px] sm:pb-[100px] pointer-events-none">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto animate-in fade-in duration-300" onClick={() => setEditingPlayer(null)}></div>
          
          <div className="relative w-full max-w-lg bg-slate-900 rounded-t-[32px] sm:rounded-[32px] border-t sm:border border-slate-700/50 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-bottom-10 duration-300 max-h-[80vh] sm:max-h-[calc(100vh-140px)]">
            
            <div className="flex-none p-5 pt-8 sm:pt-5 md:p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center relative z-20 shadow-sm">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-800 rounded-full sm:hidden"></div>
              <button onClick={() => setEditingPlayer(null)} className="absolute top-4 left-4 md:top-6 md:left-6 w-9 h-9 md:w-11 md:h-11 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md border border-slate-700 z-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div className="flex items-center gap-4 mt-2 sm:mt-0">
                <div className="w-12 h-12 md:w-14 md:h-14 relative">
                   <Jersey primary={getTeamColors(TEAM_NAMES[editingPlayer.teamId], editingPlayer.player.position === 'GK').prim} secondary={getTeamColors(TEAM_NAMES[editingPlayer.teamId], editingPlayer.player.position === 'GK').sec} textColor={getTeamColors(TEAM_NAMES[editingPlayer.teamId], editingPlayer.player.position === 'GK').text} text={['GK', 'שוער'].includes(editingPlayer.player.position) ? '🧤' : editingPlayer.player.position} />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white leading-tight mb-1">{editingPlayer.player.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{editingPlayer.player.position}</span>
                    <span className="text-slate-700">•</span>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{TEAM_NAMES[editingPlayer.teamId] || editingPlayer.teamId}</span>
                  </div>
                </div>
              </div>
              <div className="text-center bg-slate-900 px-4 md:px-5 py-2 md:py-2.5 rounded-2xl border border-slate-800 shadow-inner ml-10 md:ml-14 relative group">
                <div className="text-2xl md:text-3xl font-black text-green-400 tabular-nums leading-none">{currentDisplayPoints}</div>
                <div className="text-[8px] md:text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Points</div>
                <button onClick={resetPlayerStats} className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700 shadow-md transition-colors">איפוס</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-slate-900 relative z-10">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'started', label: 'פתח בהרכב', icon: '🏃‍♂️', activeClass: 'bg-green-500/10 border-green-500/30 text-green-400' },
                  { id: 'played60', label: 'שיחק 60+ דק', icon: '⏱️', activeClass: 'bg-green-500/10 border-green-500/30 text-green-400' },
                  { id: 'won', label: 'ניצחון', icon: '🏆', activeClass: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
                  { id: 'notInSquad', label: 'לא בסגל', icon: '❌', activeClass: 'bg-red-500/10 border-red-500/30 text-red-400' }
                ].map(item => (
                  <button key={item.id} onClick={() => updateStat(item.id, !stats[item.id as keyof typeof stats])} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all active:scale-95 ${stats[item.id as keyof typeof stats] ? item.activeClass : 'bg-slate-800/30 border-transparent hover:border-slate-700 text-slate-400'}`}>
                    <span className="text-sm font-black">{item.label}</span><span className="text-xl opacity-80">{item.icon}</span>
                  </button>
                ))}
              </div>
              
              {['GK', 'DEF', 'שוער', 'הגנה', 'בלם', 'מגן'].includes(editingPlayer.player.position) && (
                <button onClick={() => updateStat('cleanSheet', !stats.cleanSheet)} className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all active:scale-95 ${stats.cleanSheet ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-slate-800/30 border-transparent text-slate-500 hover:bg-slate-800'}`}>
                  <div className="flex items-center gap-3"><span className="text-2xl">🛡️</span><span className="font-black text-base">רשת נקייה</span></div>
                  {stats.cleanSheet && <span className="text-[10px] font-black bg-blue-500/20 px-3 py-1 rounded-lg tracking-widest uppercase border border-blue-500/30">Active</span>}
                </button>
              )}

              <div className="space-y-3">
                {[
                  { id: 'goals', label: 'שערים', icon: '⚽', color: 'text-white' },
                  { id: 'assists', label: 'בישולים', icon: '👟', color: 'text-blue-400' },
                  { id: 'assistOwnGoal', label: 'בישול שער עצמי', icon: '🎁', color: 'text-purple-400' },
                  { id: 'conceded', label: 'ספיגות', icon: '🥅', color: 'text-red-400' },
                  { id: 'penaltyWon', label: 'סחיטת פנדל', icon: '🎯', color: 'text-green-400' },
                  { id: 'penaltyMissed', label: 'החמצת פנדל', icon: '⚠️', color: 'text-orange-400' },
                  { id: 'penaltySaved', label: 'עצירת פנדל', icon: '🧤', color: 'text-yellow-400' },
                  { id: 'ownGoals', label: 'גול עצמי', icon: '🤦', color: 'text-red-600' }
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between bg-slate-800/40 p-3 rounded-2xl border border-transparent hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-4 pl-2">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-xl shadow-inner border border-slate-800">{item.icon}</div>
                      <span className={`text-sm font-black ${item.color}`}>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3 pr-2">
                      <button onClick={() => updateStat(item.id, Math.max(0, stats[item.id as keyof typeof stats] as number - 1))} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xl font-black text-white transition-colors active:scale-90">-</button>
                      <span className="text-xl font-black text-white w-8 text-center tabular-nums">{stats[item.id as keyof typeof stats]}</span>
                      <button onClick={() => updateStat(item.id, (stats[item.id as keyof typeof stats] as number) + 1)} className="w-10 h-10 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xl font-black text-white transition-colors active:scale-90">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => updateStat('yellow', !stats.yellow)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${stats.yellow ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400' : 'bg-slate-800/30 border-transparent text-slate-500'}`}>
                  <div className="w-4 h-6 bg-yellow-400 rounded-sm shadow-md"></div><span className="font-black text-xs">צהוב</span>
                </button>
                <button onClick={() => updateStat('secondYellow', !stats.secondYellow)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${stats.secondYellow ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-slate-800/30 border-transparent text-slate-500'}`}>
                  <div className="flex -space-x-2 space-x-reverse"><div className="w-4 h-6 bg-yellow-400 rounded-sm shadow-md border border-black/20"></div><div className="w-4 h-6 bg-red-500 rounded-sm shadow-md border border-black/20 z-10 -ml-1"></div></div>
                  <span className="font-black text-xs">צהוב 2</span>
                </button>
                <button onClick={() => updateStat('red', !stats.red)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95 ${stats.red ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-slate-800/30 border-transparent text-slate-500'}`}>
                  <div className="w-4 h-6 bg-red-500 rounded-sm shadow-md"></div><span className="font-black text-xs">אדום ישיר</span>
                </button>
              </div>
            </div>
            
            <div className="flex-none p-4 sm:p-5 bg-slate-950 border-t border-slate-800 shadow-[0_-20px_25px_rgba(0,0,0,0.5)] relative z-20">
              <button onClick={savePlayerPoints} className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 rounded-2xl shadow-[0_5px_20px_rgba(34,197,94,0.4)] transition-all text-lg flex items-center justify-center gap-2 active:scale-95">
                <span>שמור עדכון ניקוד</span><CheckCircle2 className="w-5 h-5" />
              </button>
            </div>

          </div>
        </div>
      )}

      {h2hModal && (() => {
        const h2hData = getH2HData(h2hModal.hId, h2hModal.aId);
        const t1Name = TEAM_NAMES[h2hModal.hId] || h2hModal.hId;
        const t2Name = TEAM_NAMES[h2hModal.aId] || h2hModal.aId;

        return (
          <div className="fixed inset-0 z-[6000] flex items-end md:items-center justify-center px-0 md:px-4 pb-[95px] md:pb-[100px] pt-10 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setH2hModal(null)}>
            <div className="bg-[#0f172a] border border-slate-700 rounded-t-[32px] md:rounded-[32px] w-full max-w-md h-[80vh] md:h-auto md:max-h-[calc(100vh-140px)] shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-900 p-5 sm:p-6 border-b border-slate-800 text-center relative shrink-0">
                <button onClick={() => setH2hModal(null)} className="absolute top-1/2 -translate-y-1/2 right-4 z-[5000] w-10 h-10 bg-slate-800 flex items-center justify-center rounded-full border border-slate-600 text-slate-300 shadow-2xl">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex justify-center items-center gap-4 px-10">
                  <span className="text-lg font-black text-white truncate">{t1Name}</span>
                  <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest border border-red-500/30 shrink-0">VS</span>
                  <span className="text-lg font-black text-white truncate">{t2Name}</span>
                </div>
              </div>

              <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                {h2hData.pastEncounters.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-bold">טרם שוחקו משחקים ביניהן העונה.</div>
                ) : (
                  <>
                    <div className="flex justify-between items-end mb-2 px-1">
                      <div className="text-center"><div className="text-3xl font-black text-green-400">{h2hData.t1Wins}</div><div className="text-[10px] text-slate-500 font-bold mt-1">ניצחונות</div></div>
                      <div className="text-center pb-1"><div className="text-xl font-black text-slate-400">{h2hData.draws}</div><div className="text-[10px] text-slate-600 font-bold mt-1">תיקו</div></div>
                      <div className="text-center"><div className="text-3xl font-black text-blue-400">{h2hData.t2Wins}</div><div className="text-[10px] text-slate-500 font-bold mt-1">ניצחונות</div></div>
                    </div>

                    <div className="space-y-3 pb-8">
                      <h4 className="text-sm font-black text-slate-300 mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-slate-500" /> תוצאות אחרונות</h4>
                      {h2hData.pastEncounters.map((pe: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 text-sm">
                          <span className="text-[10px] font-bold text-slate-400 bg-black/40 px-2 py-1 rounded-md shrink-0">מחזור {pe.round}</span>
                          <div className="flex items-center gap-2 font-black overflow-hidden flex-1 justify-end">
                            <span className="truncate">{TEAM_NAMES[pe.h] || pe.h}</span>
                            <div className="bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 flex gap-1.5 items-center shrink-0">
                              <span className={pe.hs > pe.as ? 'text-green-400' : 'text-slate-400'}>{pe.hs}</span>
                              <span className="text-slate-600 text-[10px]">:</span>
                              <span className={pe.as > pe.hs ? 'text-green-400' : 'text-slate-400'}>{pe.as}</span>
                            </div>
                            <span className="truncate">{TEAM_NAMES[pe.a] || pe.a}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 🟢 המודל החדש של דוח ה-VAR 🟢 */}
      {auditModal && (() => {
          const hTeam = teams.find(t => t.id === auditModal.hId);
          const aTeam = teams.find(t => t.id === auditModal.aId);
          const hName = TEAM_NAMES[auditModal.hId] || auditModal.hId;
          const aName = TEAM_NAMES[auditModal.aId] || auditModal.aId;

          const hLineup = applySubstitutionsToLineup(hTeam).sort((a:any,b:any) => POS_ORDER[a.position] - POS_ORDER[b.position]);
          const aLineup = applySubstitutionsToLineup(aTeam).sort((a:any,b:any) => POS_ORDER[a.position] - POS_ORDER[b.position]);

          const renderBadges = (player: any) => {
              if (!player.stats) return <div className="mt-2 text-[10px] text-slate-500 italic">לא עודכן ניקוד (0)</div>;
              const st = player.stats;
              const badges = [];
              if (st.started) badges.push({ icon: '🏃‍♂️', label: 'פתח בהרכב' });
              if (st.played60) badges.push({ icon: '⏱️', label: '60+ דק\'' });
              if (st.won) badges.push({ icon: '🏆', label: 'ניצחון' });
              if (st.goals > 0) badges.push({ icon: '⚽', label: 'שער', count: st.goals });
              if (st.assists > 0) badges.push({ icon: '👟', label: 'בישול', count: st.assists });
              if (st.cleanSheet && ['GK', 'DEF', 'שוער', 'הגנה', 'בלם', 'מגן'].includes(player.position)) badges.push({ icon: '🛡️', label: 'רשת נקייה' });
              if (st.conceded > 0) badges.push({ icon: '🥅', label: 'ספיגות', count: st.conceded });
              if (st.yellow) badges.push({ icon: '🟨', label: 'צהוב' });
              if (st.secondYellow) badges.push({ icon: '🟨🟥', label: 'צהוב שני' });
              if (st.red) badges.push({ icon: '🟥', label: 'אדום' });
              if (st.penaltyMissed > 0) badges.push({ icon: '⚠️', label: 'החמצת פנדל', count: st.penaltyMissed });
              if (st.penaltySaved > 0) badges.push({ icon: '🧤', label: 'עצירת פנדל', count: st.penaltySaved });
              if (st.penaltyWon > 0) badges.push({ icon: '🎯', label: 'סחט פנדל', count: st.penaltyWon });
              if (st.ownGoals > 0) badges.push({ icon: '🤦', label: 'עצמי', count: st.ownGoals });

              if (badges.length === 0 && (Number(player.points) === 0 || !player.points)) {
                  return <div className="mt-2 text-[10px] text-slate-500 italic">לא שיחק / טרם צבר נקודות</div>;
              }

              return (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                      {badges.map((b, i) => (
                          <div key={i} className="group/badge relative flex items-center justify-center bg-slate-900 text-[11px] px-1.5 py-0.5 rounded border border-slate-700 cursor-help transition-colors hover:border-slate-500">
                              <span>{b.icon}</span>
                              {b.count && b.count > 1 && <span className="ml-1 text-white font-bold">{b.count}</span>}
                              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 invisible group-hover/badge:opacity-100 group-hover/badge:visible whitespace-nowrap z-50 border border-slate-700 pointer-events-none shadow-xl">
                                  {b.label}
                              </div>
                          </div>
                      ))}
                  </div>
              );
          };

          const renderPlayerRow = (p: any, fTeamName?: string) => (
              <div key={p.id} className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 flex flex-col mb-2 hover:bg-slate-800/80 transition-colors">
                  <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                          <span className="text-sm font-black text-white">{p.name}</span>
                          <div className="flex gap-2 items-center text-[10px] text-slate-400 font-bold mt-0.5">
                              <span>{p.position}</span>
                              <span>•</span>
                              <span>{p.team}</span>
                              {fTeamName && <><span>•</span><span className="text-blue-400">{fTeamName}</span></>}
                          </div>
                      </div>
                      <div className="flex flex-col items-center bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
                          <span className={`text-lg font-black leading-none mt-0.5 ${p.points > 0 ? 'text-green-400' : p.points < 0 ? 'text-red-400' : 'text-slate-300'}`}>{p.points || 0}</span>
                          <span className="text-[8px] text-slate-500 uppercase mt-1">PTS</span>
                      </div>
                  </div>
                  {renderBadges(p)}
              </div>
          );

          const allPlayers = [
              ...hLineup.map((p:any) => ({...p, fTeam: hName})),
              ...aLineup.map((p:any) => ({...p, fTeam: aName}))
          ];
          
          const grouped: Record<string, any[]> = {};
          allPlayers.forEach(p => {
              const rt = p.team || 'אחר';
              if (!grouped[rt]) grouped[rt] = [];
              grouped[rt].push(p);
          });
          const groupedKeys = Object.keys(grouped).sort();

          return (
            <div className="fixed inset-0 z-[6000] flex items-end md:items-center justify-center px-0 md:px-4 pb-[95px] md:pb-[100px] pt-10 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setAuditModal(null)}>
               <div className="bg-[#0f172a] border border-slate-700 rounded-t-[32px] md:rounded-[32px] w-full max-w-4xl h-[85vh] md:h-auto md:max-h-[calc(100vh-100px)] shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
                  
                  <div className="bg-slate-900 p-4 sm:p-5 border-b border-slate-800 relative shrink-0">
                     <button onClick={() => setAuditModal(null)} className="absolute top-1/2 -translate-y-1/2 right-4 z-[5000] w-10 h-10 bg-slate-800 flex items-center justify-center rounded-full border border-slate-600 text-slate-300 shadow-2xl transition-colors hover:bg-slate-700">
                        <X className="w-5 h-5" />
                     </button>
                     <h3 className="text-xl font-black text-white text-center pr-10 pl-10 truncate">דוח ניקוד VAR 🔍</h3>
                     
                     <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-xs text-slate-400 bg-black/40 p-2 rounded-xl border border-slate-800">
                         <span className="font-black text-slate-300 mr-1">מקרא תגיות:</span>
                         <span title="פתח בהרכב">🏃‍♂️ הרכב</span>
                         <span title="שיחק 60 דק'">⏱️ 60 דק'</span>
                         <span title="שער">⚽ גול</span>
                         <span title="בישול">👟 בישול</span>
                         <span title="רשת נקייה">🛡️ רשת נקייה</span>
                         <span title="ספיגות">🥅 ספיגות</span>
                         <span title="כרטיסים">🟨/🟥 כרטיס</span>
                     </div>

                     <div className="mt-4 flex justify-center">
                         <button onClick={() => setAuditGroupByReal(!auditGroupByReal)} className={`text-xs font-black px-4 py-2 rounded-full border transition-all ${auditGroupByReal ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}>
                             {auditGroupByReal ? 'מסודר לפי קבוצות פנטזי' : 'קבץ לפי קבוצות במציאות 🔄'}
                         </button>
                     </div>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[#0f172a]">
                     {auditGroupByReal ? (
                         <div className="space-y-6">
                             {groupedKeys.map(rt => (
                                 <div key={rt} className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                                     <h4 className="text-lg font-black text-blue-400 mb-3 border-b border-slate-800 pb-2">{rt}</h4>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                         {grouped[rt].sort((a,b)=>POS_ORDER[a.position]-POS_ORDER[b.position]).map(p => renderPlayerRow(p, p.fTeam))}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <>
                             {/* טאבים במובייל */}
                             <div className="flex sm:hidden mb-4 bg-slate-900 rounded-xl p-1 border border-slate-800">
                                 <button onClick={() => setAuditActiveTab('h')} className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${auditActiveTab === 'h' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>{hName}</button>
                                 <button onClick={() => setAuditActiveTab('a')} className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${auditActiveTab === 'a' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>{aName}</button>
                             </div>
                             
                             {/* גריד שמופיע כולו ב-PC ומסתיר עמודה במובייל */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                 <div className={`${auditActiveTab === 'h' ? 'block' : 'hidden'} sm:block`}>
                                     <div className="bg-slate-900 p-3 rounded-t-2xl border-b-4 border-slate-700 text-center mb-3">
                                         <span className="text-lg font-black text-white">{hName}</span>
                                     </div>
                                     <div className="space-y-2">
                                         {hLineup.map((p:any) => renderPlayerRow(p))}
                                     </div>
                                 </div>
                                 <div className={`${auditActiveTab === 'a' ? 'block' : 'hidden'} sm:block`}>
                                     <div className="bg-slate-900 p-3 rounded-t-2xl border-b-4 border-slate-700 text-center mb-3">
                                         <span className="text-lg font-black text-white">{aName}</span>
                                     </div>
                                     <div className="space-y-2">
                                         {aLineup.map((p:any) => renderPlayerRow(p))}
                                     </div>
                                 </div>
                             </div>
                         </>
                     )}
                  </div>

               </div>
            </div>
          );
      })()}

      {confirmCloseModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center px-4 pb-[95px] md:pb-[100px] backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-[40px] w-full max-w-md flex flex-col shadow-[0_0_50px_rgba(239,68,68,0.15)] relative text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Flame className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2">סגירת מחזור {currentRound}</h3>
            <p className="text-slate-400 font-bold mb-8 leading-relaxed">
              האם אתה בטוח שברצונך לסגור את המחזור? פעולה זו תעדכן את הטבלה, תאפס את ההרכבים ל-0 ותקדם את הליגה למחזור הבא. <br/><span className="text-red-400 font-black mt-2 inline-block">לא ניתן לבטל פעולה זו!</span>
            </p>
            <div className="flex gap-3">
              <button onClick={executeCloseRound} disabled={isProcessingRound} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all text-lg active:scale-95 flex justify-center items-center">
                {isProcessingRound ? 'מעבד...' : 'כן, סגור מחזור! 🔒'}
              </button>
              <button onClick={() => setConfirmCloseModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all text-lg active:scale-95">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveArena;