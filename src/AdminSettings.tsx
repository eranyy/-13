import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebaseConfig'; 
import { analyzeMatchImage, generateAISummary, generateRumors } from './geminiService'; 
import { collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDocs, writeBatch, query, getDoc, addDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { DownloadCloud, Users, RefreshCw, Database, AlertTriangle, UploadCloud, CalendarDays, Camera, Sparkles, Trash2, Undo2, MessageSquare, Megaphone, Star, Key, Eye, Monitor, Smartphone, Clock, Eraser, Calculator, Flame, Trophy, Bell, BellOff } from 'lucide-react'; // 🟢 הוספנו Bell, BellOff
import { parseFantasyExcel } from './utils/FantasyExcelParser'; 

interface AdminSettingsProps { onClose?: () => void; isAdmin?: boolean; inline?: boolean; initialSubTab?: string; }

const cleanStr = (s?: string | null) => String(s || '').toLowerCase().replace(/['"״׳`\-\s()]/g, '');
const TEAM_NAMES: Record<string, string> = { tumali: 'תומאלי', tampa: 'טמפה', pichichi: "פיצ'יצ'י", hamsili: 'חמסילי', harale: 'חראלה', holonia: 'חולוניה' };

const normalizeTeamName = (name: string) => {
    if (!name) return '';
    let n = name.trim().toLowerCase().replace(/["'״׳.]/g, '').replace(/-/g, ' '); 
    if (n.includes('תל אביב')) n = n.replace('תל אביב', 'תא');
    if (n.includes('באר שבע')) n = n.replace('באר שבע', 'בש');
    if (n.includes('קרית שמונה')) n = n.replace('קרית שמונה', 'קש');
    if (n.includes('פתח תקוה') || n.includes('פתח תקווה')) n = n.replace(/פתח תקו[ו]?ה/, 'פת');
    if (n.includes('ריינה')) return 'מכבי בני ריינה';
    if (n.includes('אשדוד')) return 'מס אשדוד';
    if (n.includes('טבריה')) return 'עירוני טבריה';
    if (n.includes('סכנין')) return 'בני סכנין';
    if (n.includes('נתניה') && n.includes('מכבי')) return 'מכבי נתניה';
    if (n.includes('חדרה')) return 'הפועל חדרה';
    return n.replace(/\s+/g, ' ').trim();
};

const getNormalizedTeamId = (nameOrId: string) => {
    const s = cleanStr(nameOrId);
    if (!s) return 'unknown';
    if (s.includes('חרא') || s.includes('וסילי') || s === 'harale') return 'harale';
    if (s.includes('חולו') || s.includes('holonia')) return 'holonia';
    if (s.includes('תומ') || s.includes('tumali')) return 'tumali';
    if (s.includes('טמפ') || s.includes('tampa')) return 'tampa';
    if (s.includes('חמס') || s.includes('hamsili')) return 'hamsili';
    if (s.includes('פיצ') || s.includes('pichichi')) return 'pichichi';
    return s; 
};

const parseCsvRow = (str: string) => {
    if (!str || typeof str !== 'string') return [];
    let result = [], cur = '', inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '"') inQuotes = !inQuotes;
        else if (str[i] === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; } 
        else { cur += str[i]; }
    }
    result.push(cur.trim());
    return result.map(s => s.replace(/^"|"$/g, ''));
};

const getStadium = (homeTeam: string) => {
    if (!homeTeam) return '';
    const n = normalizeTeamName(homeTeam);
    if (n.includes('חיפה')) return 'סמי עופר';
    if (n.includes('בש') || n.includes('באר שבע')) return 'טרנר';
    if (n.includes('תא') || n.includes('תל אביב') || n.includes('בני יהודה')) return 'בלומפילד';
    if (n.includes('ביתר') || n.includes('ירושלים')) return 'טדי';
    if (n.includes('פת') || n.includes('תקוה') || n.includes('תקווה')) return 'שלמה ביטוח';
    if (n.includes('אשדוד')) return 'הי״א';
    if (n.includes('סכנין')) return 'דוחא';
    if (n.includes('נתניה') || n.includes('חדרה')) return 'אצטדיון נתניה';
    if (n.includes('טבריה') || n.includes('ריינה') || n.includes('קש') || n.includes('שמונה')) return 'גרין';
    return '';
};

const formatTimeWithUS = (ilTime: string) => {
    if (!ilTime) return '';
    if (ilTime.includes('🇺🇸')) return ilTime; 
    
    const timeMatch = ilTime.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return ilTime;
    
    const h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2];
    let usH = h - 7;
    if (usH < 0) usH += 24;
    
    const hStr = h.toString().padStart(2, '0');
    const usHStr = usH.toString().padStart(2, '0');
    
    return `${hStr}:${m} | ${usHStr}:${m} 🇺🇸`;
};

const AdminSettings: React.FC<AdminSettingsProps> = ({ onClose = () => {}, isAdmin = false }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'system' | 'deleted-logs' | 'radar'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [deletedTeams, setDeletedTeams] = useState<any[]>([]); 
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [deletedLogs, setDeletedLogs] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]); 
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [isUndoing, setIsUndoing] = useState(false);
  const [isResettingLive, setIsResettingLive] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [isSavingPlayoffs, setIsSavingPlayoffs] = useState(false); 
  const [isSavingCup, setIsSavingCup] = useState(false); 
  
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<any | null>(null); 
  const [newUser, setNewUser] = useState({ teamName: '', manager: '', assistantName: '', email: '', assistantEmail: '', role: 'USER', isApproved: true, assistants: [] as any[] });
  
  const [showEndSeason, setShowEndSeason] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCupAdminModal, setShowCupAdminModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [endSeasonPwd, setEndSeasonPwd] = useState('');
  const [seasonArchiveName, setSeasonArchiveName] = useState('LUZON 13 - 2024');
  const [cupWinner, setCupWinner] = useState(''); 
  
  const [tableDriveUrl, setTableDriveUrl] = useState('');
  const [isSyncingTable, setIsSyncingTable] = useState(false);
  const [squadsDriveUrl, setSquadsDriveUrl] = useState('');
  const [transfersDriveUrl, setTransfersDriveUrl] = useState('');
  
  const [playoffRoundsInput, setPlayoffRoundsInput] = useState<string>(''); 
  const [cupSettings, setCupSettings] = useState<any>({ isOpen: false, stage: 'groups', groupStandings: {} });
  const [tempCupOverrides, setTempCupOverrides] = useState<any>({});
  
  const [topPlayersDriveUrl, setTopPlayersDriveUrl] = useState('');
  const sheetsApiKey = 'AIzaSyARwamUBjcirbqFtWn_RpKkOdiHmeGlis0';
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('gemini_api_key') || 'AIzaSyBM6ArDeYA0oRuOLQPXt4qVIGDSrQALaYQ');

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubDeletedUsers = onSnapshot(collection(db, "deleted_users"), (snapshot) => setDeletedTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFixtures = onSnapshot(doc(db, "leagueData", "fixtures"), (docSnap) => { if(docSnap.exists()) setFixtures(docSnap.data().rounds || []); });
    const unsubLogs = onSnapshot(collection(db, "logs_deleted_players"), (snapshot) => setDeletedLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())));
    
    const unsubLoginLogs = onSnapshot(collection(db, "login_logs"), (snapshot) => {
        setLoginLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });

    const unsubSettings = onSnapshot(doc(db, "leagueData", "settings"), (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            if (data.playoffRounds && Array.isArray(data.playoffRounds)) {
                setPlayoffRoundsInput(data.playoffRounds.join(', '));
            }
        }
    });

    const unsubCup = onSnapshot(doc(db, "leagueData", "cup_settings"), (docSnap) => {
        if(docSnap.exists()) {
            setCupSettings(docSnap.data());
            setTempCupOverrides(docSnap.data().groupStandings || {});
        }
    });
    
    return () => { unsubUsers(); unsubDeletedUsers(); unsubFixtures(); unsubLogs(); unsubLoginLogs(); unsubSettings(); unsubCup(); };
  }, []);

  useEffect(() => {
    if (loginLogs.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const timeLimit = thirtyDaysAgo.getTime();

        const oldLogs = loginLogs.filter(log => new Date(log.timestamp).getTime() < timeLimit);
        
        if (oldLogs.length > 0) {
            const deleteOldLogs = async () => {
                try {
                    const batch = writeBatch(db);
                    oldLogs.slice(0, 400).forEach(log => {
                        batch.delete(doc(db, 'login_logs', log.id));
                    });
                    await batch.commit();
                } catch(e) {
                    console.error("Auto-cleanup failed", e);
                }
            };
            deleteOldLogs();
        }
    }
  }, [loginLogs]);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { setToast({msg, type}); if (type !== 'info') setTimeout(() => setToast(null), 5000); };

  const handleUpdateCupSettings = async (updates: any) => {
      setIsSavingCup(true);
      try {
          await setDoc(doc(db, 'leagueData', 'cup_settings'), updates, { merge: true });
          showMessage('✅ הגדרות הגביע עודכנו!', 'success');
      } catch (e) {
          showMessage('❌ שגיאה בעדכון הגביע', 'error');
      }
      setIsSavingCup(false);
  };

  const handleDrawCupGroups = async () => {
      if (!window.confirm('זהירות: הגרלת בתים תדרוס בתים קיימים ותשבץ מחדש לפי הטבלה הנוכחית של הליגה! להמשיך?')) return;
      setIsSavingCup(true);
      try {
          const activeTeams = users.filter(u => u.id !== 'admin' && u.id !== 'system' && u.teamName);
          const sortedTable = [...activeTeams].sort((a, b) => {
              const aPts = a.points || 0; const bPts = b.points || 0;
              if (bPts !== aPts) return bPts - aPts;
              return ((b.gf || 0) - (b.ga || 0)) - ((a.gf || 0) - (a.ga || 0));
          });
          
          const lannister = [sortedTable[0]?.id, sortedTable[2]?.id, sortedTable[4]?.id].filter(Boolean);
          const stark = [sortedTable[1]?.id, sortedTable[3]?.id, sortedTable[5]?.id].filter(Boolean);

          await setDoc(doc(db, 'leagueData', 'cup_settings'), {
              groups: { lannister, stark },
              groupStandings: { 
                  [sortedTable[0]?.id]: 0, [sortedTable[2]?.id]: 0, [sortedTable[4]?.id]: 0,
                  [sortedTable[1]?.id]: 0, [sortedTable[3]?.id]: 0, [sortedTable[5]?.id]: 0
              }
          }, { merge: true });
          showMessage('✅ הבתים הוגרלו ונשמרו בהצלחה לפי מיקומי הליגה!', 'success');
      } catch(e) {
          showMessage('❌ שגיאה בהגרלת בתים', 'error');
      }
      setIsSavingCup(false);
  };

  const handleSaveCupOverrides = async () => {
      setIsSavingCup(true);
      try {
          await setDoc(doc(db, 'leagueData', 'cup_settings'), { groupStandings: tempCupOverrides }, { merge: true });
          showMessage('✅ תוצאות הגביע המצטברות עודכנו ידנית', 'success');
          setShowCupAdminModal(false);
      } catch(e) { showMessage('❌ שגיאה בעדכון', 'error'); }
      setIsSavingCup(false);
  };

  const handleSavePlayoffRounds = async () => {
    setIsSavingPlayoffs(true);
    try {
        const roundsArray = playoffRoundsInput
            .split(',')
            .map(s => parseInt(s.trim()))
            .filter(n => !isNaN(n)); 

        await setDoc(doc(db, 'leagueData', 'settings'), {
            playoffRounds: roundsArray
        }, { merge: true });

        showMessage(`✅ הוגדרו מחזורי פלייאוף: ${roundsArray.length > 0 ? roundsArray.join(', ') : 'אופס (רשימה ריקה)'}`, 'success');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה בשמירת מחזורי הפלייאוף', 'error');
    } finally {
        setIsSavingPlayoffs(false);
    }
  };

  const triggerUndo = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, 'leagueData', 'settings'));
      const currentRound = settingsSnap.exists() ? settingsSnap.data().currentRound || 1 : 1;
      if (currentRound <= 1) return showMessage('❌ הליגה במחזור 1, אין לאן לחזור אחורה.', 'error');
      setShowUndoConfirm(true);
    } catch (e) {
      showMessage('שגיאה בקריאת נתוני הליגה.', 'error');
    }
  };

  const executeUndoRound = async () => {
    setShowUndoConfirm(false);
    setIsUndoing(true);
    try {
        const settingsSnap = await getDoc(doc(db, 'leagueData', 'settings'));
        const currentRound = settingsSnap.data()?.currentRound || 1;
        const previousRound = currentRound - 1;

        showMessage('מוריד גיבוי מהכספת ומשחזר נתונים... ⏳', 'info');

        const backupSnap = await getDoc(doc(db, 'round_backups', `backup_round_${previousRound}`));
        if (!backupSnap.exists()) {
            setIsUndoing(false);
            return showMessage(`❌ לא נמצא קובץ גיבוי למחזור ${previousRound}.`, 'error');
        }

        const backup = backupSnap.data();
        const batch = writeBatch(db);

        if (backup.teamsSnapshot && Array.isArray(backup.teamsSnapshot)) {
            backup.teamsSnapshot.forEach((team: any) => {
                if (team.id !== 'admin' && team.id !== 'system') {
                    batch.set(doc(db, 'users', team.id), team);
                }
            });
        }

        if (backup.fixturesSnapshot) {
            batch.update(doc(db, 'leagueData', 'fixtures'), { rounds: backup.fixturesSnapshot });
        }

        batch.update(doc(db, 'leagueData', 'settings'), { currentRound: previousRound });

        await batch.commit();

        if (backup.generatedPostIds && backup.generatedPostIds.length > 0) {
            for (const postId of backup.generatedPostIds) {
                try { await deleteDoc(doc(db, 'social_posts', postId)); } catch(e) { console.error('Failed to delete post', postId) }
            }
        }

        showMessage(`✅ שוחזר בהצלחה! הליגה חזרה למחזור ${previousRound}.`, 'success');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה חמורה בשחזור: ' + e.message, 'error');
    } finally {
        setIsUndoing(false);
    }
  };

  const executeResetLiveArena = async () => {
    setShowResetConfirm(false);
    setLoading(true);
    setIsResettingLive(true);
    showMessage('מאפס את נתוני הלייב לכל הקבוצות... 🧹', 'info');
    
    try {
        const batch = writeBatch(db);
        const emptyStats = { started: false, played60: false, notInSquad: false, won: false, goals: 0, assists: 0, cleanSheet: false, conceded: 0, yellow: false, secondYellow: false, red: false, penaltyWon: 0, penaltyMissed: 0, penaltySaved: 0, ownGoals: 0, assistOwnGoal: 0 };
        
        users.forEach(u => {
            if (u.id !== 'admin' && u.id !== 'system') {
                const resetArray = (arr: any[]) => (arr || []).map((p:any) => ({...p, points: 0, stats: emptyStats}));
                batch.update(doc(db, 'users', u.id), {
                    squad: resetArray(u.squad),
                    players: resetArray(u.players),
                    published_lineup: resetArray(u.published_lineup),
                    published_subs_out: resetArray(u.published_subs_out),
                    lineup: resetArray(u.lineup)
                });
            }
        });
        
        await batch.commit();
        showMessage('✅ הזירה אופסה בהצלחה! כל השחקנים חזרו ל-0 נקודות.', 'success');
    } catch (e: any) {
        showMessage('❌ שגיאה באיפוס הזירה: ' + e.message, 'error');
    } finally {
        setLoading(false);
        setIsResettingLive(false);
    }
  };

  const handleRefreshRadar = async () => {
    setLoading(true);
    try {
        const snap = await getDocs(collection(db, "login_logs"));
        setLoginLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        showMessage('✅ הרדאר רוענן בהצלחה!', 'success');
    } catch(e) {
        showMessage('❌ שגיאה ברענון הרדאר', 'error');
    }
    setLoading(false);
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק לצמיתות את כל היסטוריית ההתחברויות?')) return;
    setLoading(true);
    showMessage('מוחק נתונים... 🧹', 'info');
    try {
        const snap = await getDocs(collection(db, "login_logs"));
        const batch = writeBatch(db);
        let count = 0;
        
        snap.docs.forEach(d => {
            batch.delete(d.ref);
            count++;
        });
        
        await batch.commit();
        showMessage(`✅ נמחקו ${count} רשומות בהצלחה! הרדאר נקי.`, 'success');
    } catch (e: any) {
        showMessage('❌ שגיאה במחיקת הרדאר: ' + e.message, 'error');
    }
    setLoading(false);
  };

  const generateManualAISummary = async () => {
    if (!geminiApiKey) return showMessage('❌ חסר מפתח Gemini API!', 'error');
    setIsGeneratingPost(true);
    showMessage('הפרשן שלנו כותב את הטור... ✍️', 'info');
    
    try {
        let matchesToAnalyze = [];
        if (fixtures && fixtures.length > 0) {
            const activeRound = [...fixtures].reverse().find(r => r.matches && r.matches.length > 0);
            if (activeRound) {
                matchesToAnalyze = activeRound.matches;
            }
        }

        const summary = await generateAISummary(matchesToAnalyze, users, geminiApiKey);
        
        await addDoc(collection(db, 'social_posts'), {
            authorName: 'האנליסט AI 🤖',
            handle: '@luzon_analyst',
            teamId: 'system',
            isVerified: true,
            type: 'article',
            content: summary,
            likes: Math.floor(Math.random() * 20) + 10,
            likedBy: [],
            comments: [],
            timestamp: new Date().toISOString()
        });
        showMessage('✅ סיכום המחזור פורסם בהצלחה!', 'success');
    } catch (e: any) {
        console.error(e);
        const errorMsg = e.message.includes('offline') ? 'שגיאת רשת. בדוק חיבור לאינטרנט ונסה שוב.' : e.message;
        showMessage('❌ שגיאה ביצירת סיכום: ' + errorMsg, 'error');
    } finally {
        setIsGeneratingPost(false);
    }
  };

  const generateRumorPost = async () => {
    if (!geminiApiKey) return showMessage('❌ חסר מפתח Gemini API!', 'error');
    setIsGeneratingPost(true);
    showMessage('הכתב שלנו מדליף מהחדרים... 🕵️', 'info');
    try {
        const rumors = await generateRumors(users, geminiApiKey);
        
        await addDoc(collection(db, 'social_posts'), {
            authorName: 'המדליף האלמוני 🤫',
            handle: '@luzon_leaks',
            teamId: 'system',
            isVerified: true,
            type: 'alert',
            content: rumors,
            likes: Math.floor(Math.random() * 15) + 5,
            likedBy: [],
            comments: [],
            timestamp: new Date().toISOString()
        });
        showMessage('✅ השמועות פורסמו בהצלחה!', 'success');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה ביצירת שמועות: ' + e.message, 'error');
    } finally {
        setIsGeneratingPost(false);
    }
  };

  const recalculateTableFromApp = async () => {
    setLoading(true);
    setIsSyncingTable(true);
    showMessage('סורק משחקים ומחשב טבלה, נקודות ומומנטום... 🧮', 'info');

    try {
        const batch = writeBatch(db);
        let updatedCount = 0;
        let matchesProcessed = 0; 

        const tableData: Record<string, any> = {};
        users.forEach(u => {
            if (u.id !== 'admin' && u.id !== 'system') {
                const key = getNormalizedTeamId(u.teamName) || getNormalizedTeamId(u.id);
                tableData[key] = { 
                    docId: u.id, 
                    played: 0, wins: 0, draws: 0, losses: 0, 
                    gf: 0, ga: 0, points: 0, 
                    matchHistory: [] 
                };
            }
        });

        fixtures.forEach((round: any, roundIndex: number) => {
            const matches = round.matches || [];
            
            matches.forEach((match: any) => {
                const homeNameOrId = match.h || match.homeTeam || (typeof match.homeTeam === 'object' ? (match.homeTeam?.name || match.homeTeam?.id) : '');
                const awayNameOrId = match.a || match.awayTeam || (typeof match.awayTeam === 'object' ? (match.awayTeam?.name || match.awayTeam?.id) : '');

                const homeKey = getNormalizedTeamId(homeNameOrId);
                const awayKey = getNormalizedTeamId(awayNameOrId);
                
                const hScoreRaw = match.hs ?? match.homeScore ?? match.homeTeamScore ?? match.scoreHome ?? match.homePoints;
                const aScoreRaw = match.as ?? match.awayScore ?? match.awayTeamScore ?? match.scoreAway ?? match.awayPoints;

                if (hScoreRaw !== undefined && aScoreRaw !== undefined && hScoreRaw !== null && hScoreRaw !== '') {
                    const hScore = Number(hScoreRaw);
                    const aScore = Number(aScoreRaw);

                    if (!isNaN(hScore) && !isNaN(aScore)) {
                        matchesProcessed++; 
                        const diff = Math.abs(hScore - aScore);

                        if (tableData[homeKey]) {
                            tableData[homeKey].played++;
                            tableData[homeKey].gf += hScore;
                            tableData[homeKey].ga += aScore;

                            if (hScore > aScore) {
                                tableData[homeKey].wins++;
                                tableData[homeKey].points += diff >= 20 ? 3 : 2;
                                tableData[homeKey].matchHistory.push({ result: 'W', oppScore: aScore });
                            } else if (hScore === aScore) {
                                tableData[homeKey].draws++;
                                tableData[homeKey].points += 1;
                                tableData[homeKey].matchHistory.push({ result: 'D', oppScore: aScore });
                            } else {
                                tableData[homeKey].losses++;
                                tableData[homeKey].matchHistory.push({ result: 'L', oppScore: aScore });
                            }
                        }

                        if (tableData[awayKey]) {
                            tableData[awayKey].played++;
                            tableData[awayKey].gf += aScore;
                            tableData[awayKey].ga += hScore;

                            if (aScore > hScore) {
                                tableData[awayKey].wins++;
                                tableData[awayKey].points += diff >= 20 ? 3 : 2;
                                tableData[awayKey].matchHistory.push({ result: 'W', oppScore: hScore });
                            } else if (aScore === hScore) {
                                tableData[awayKey].draws++;
                                tableData[awayKey].points += 1;
                                tableData[awayKey].matchHistory.push({ result: 'D', oppScore: hScore });
                            } else {
                                tableData[awayKey].losses++;
                                tableData[awayKey].matchHistory.push({ result: 'L', oppScore: hScore });
                            }
                        }
                    }
                }
            });
        });

        if (matchesProcessed === 0) {
            showMessage('⚠️ לא נמצאו משחקים עם תוצאות עדיין!', 'error');
            setLoading(false);
            setIsSyncingTable(false);
            return; 
        }

        Object.keys(tableData).forEach(teamKey => {
            const t = tableData[teamKey];
            
            const last5 = t.matchHistory.slice(-5);
            const recentForm = last5.map((m: any) => m.result);
            const last3 = t.matchHistory.slice(-3);
            
            const streakFire = last3.length === 3 && last3.every((m: any) => m.result === 'W');
            const streakClown = last3.length === 3 && last3.every((m: any) => m.result === 'L');
            const ironDefense = last3.length === 3 && last3.every((m: any) => m.oppScore === 0);

            batch.update(doc(db, 'users', t.docId), {
                played: t.played,
                wins: t.wins,
                draws: t.draws,
                losses: t.losses,
                gf: t.gf,
                ga: t.ga,
                points: t.points,
                recentForm: recentForm,
                streakFire: streakFire,
                streakClown: streakClown,
                ironDefense: ironDefense
            });
            updatedCount++;
        });

        await batch.commit();
        showMessage(`✅ מדהים! טבלה, נקודות ומומנטום עודכנו בהצלחה ל-${updatedCount} קבוצות! (חושבו ${matchesProcessed} משחקים)`, 'success');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה בחישוב הטבלה: ' + e.message, 'error');
    } finally {
        setLoading(false);
        setIsSyncingTable(false);
    }
  };

  const handleSyncTopPlayersWithAPI = async () => {
    if (!topPlayersDriveUrl.trim() || !sheetsApiKey) {
        return showMessage('❌ חסר קישור לאקסל או מפתח API!', 'error');
    }
    
    setLoading(true);
    showMessage('מתחבר ל-API וסורק מחזורים... 🤖', 'info');

    try {
        const match = topPlayersDriveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) throw new Error('הקישור לא תקין. ודא שהעתקת את הקישור הרגיל של האקסל למעלה.');
        const spreadsheetId = match[1];

        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${sheetsApiKey}`);
        if (!metaRes.ok) {
            const errorData = await metaRes.json().catch(() => ({}));
            const apiError = errorData.error?.message || metaRes.statusText;
            throw new Error(`שגיאת API (${metaRes.status}): ${apiError}. ודא שהמפתח תקין ושהאקסל פתוח לכולם (Anyone with the link).`);
        }
        const metaData = await metaRes.json();

        const roundSheets = metaData.sheets
            .map((s: any) => s.properties.title)
            .filter((title: string) => title.includes('מחזור'));

        if (roundSheets.length === 0) throw new Error('לא נמצאו לשוניות עם המילה "מחזור".');

        showMessage(`מזהה ${roundSheets.length} מחזורים... מנתח נתונים ⚡`, 'info');

        const ranges = roundSheets.map((s: string) => encodeURIComponent(`'${s}'!D:N`)).join('&ranges=');
        const dataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges}&key=${sheetsApiKey}`);
        if (!dataRes.ok) {
            const errorData = await dataRes.json().catch(() => ({}));
            const apiError = errorData.error?.message || dataRes.statusText;
            throw new Error(`שגיאת משיכת נתונים (${dataRes.status}): ${apiError}`);
        }
        const data = await dataRes.json();

        if (!data.valueRanges) throw new Error('לא הצלחתי למשוך נתונים.');

        const playersSnap = await getDocs(collection(db, 'players'));
        const dbPlayers = playersSnap.docs.map(d => d.data());

        const playerPointsMap: Record<string, { points: number, team: string, fantasyTeam: string, rawName: string }> = {};
        const cleanForMatch = (name: string) => name.toLowerCase().replace(/['"״׳`\-\s().]/g, '');

        data.valueRanges.forEach((rangeData: any) => {
            const rows = rangeData.values;
            if (!rows) return;
            
            rows.forEach((row: any[]) => {
                const playerName = row[0]?.trim(); 
                const pointsStr = row[10]?.trim(); 

                if (playerName && playerName !== 'שם שחקן' && pointsStr) {
                    const points = parseInt(pointsStr);
                    if (!isNaN(points)) {
                        let matchedDbPlayer = dbPlayers.find(p => cleanForMatch(p.name) === cleanForMatch(playerName));
                        
                        if (!matchedDbPlayer && playerName.includes('.')) {
                           const parts = playerName.split('.');
                           if (parts.length >= 2) {
                               const initial = parts[0].trim().charAt(0);
                               const lastName = cleanForMatch(parts[1]);
                               matchedDbPlayer = dbPlayers.find(p => {
                                   const dbParts = p.name.split(' ');
                                   if (dbParts.length >= 2) {
                                       const dbInitial = dbParts[0].charAt(0);
                                       const dbLast = cleanForMatch(dbParts[dbParts.length - 1]);
                                       return initial === dbInitial && dbLast === lastName;
                                   }
                                   return false;
                               });
                           }
                        }

                        const finalName = matchedDbPlayer ? matchedDbPlayer.name : playerName;
                        const realTeam = matchedDbPlayer ? matchedDbPlayer.team : 'לא ידוע';
                        const fantasyTeam = matchedDbPlayer ? matchedDbPlayer.fantasyTeam : '';

                        if (!playerPointsMap[finalName]) {
                            playerPointsMap[finalName] = { points: 0, team: realTeam, fantasyTeam: fantasyTeam, rawName: finalName };
                        }
                        playerPointsMap[finalName].points += points;
                    }
                }
            });
        });

        const topPlayers = Object.values(playerPointsMap)
            .sort((a, b) => b.points - a.points)
            .slice(0, 50);

        await setDoc(doc(db, 'leagueData', 'top_players'), {
            players: topPlayers.map(p => ({
                name: p.rawName,
                team: p.team,
                points: p.points,
                fantasyTeamName: p.fantasyTeam
            })),
            lastUpdated: new Date().toISOString()
        });

        showMessage(`✅ הצלחה! האפליקציה פירקה ${roundSheets.length} מחזורים באפס תקלות! 👑`, 'success');
        setTopPlayersDriveUrl('');

    } catch (err: any) {
        console.error(err);
        showMessage('❌ שגיאה: ' + err.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const runAIImageScanner = async (file: File) => {
    setLoading(true);
    showMessage('סורק את הקובץ בעזרת AI... 👁️', 'info');
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const mimeType = file.type;
            const hint = file.name;

            const extractedMatches = await analyzeMatchImage(base64Data, mimeType, hint, geminiApiKey);
            
            if (extractedMatches && Array.isArray(extractedMatches)) {
                extractedMatches.forEach((m: any) => {
                    m.time = formatTimeWithUS(m.time);
                    m.stadium = m.stadium || getStadium(m.homeTeam); 
                });
            }
            
            if (extractedMatches && extractedMatches.length > 0) {
                const realFixturesSnap = await getDoc(doc(db, 'leagueData', 'real_fixtures'));
                let currentMatches = realFixturesSnap.exists() ? realFixturesSnap.data().matches : [];
                
                const newMatches = [...currentMatches];
                extractedMatches.forEach((m: any) => {
                    const exists = newMatches.find(em => 
                        normalizeTeamName(em.homeTeam) === normalizeTeamName(m.homeTeam) && 
                        normalizeTeamName(em.awayTeam) === normalizeTeamName(m.awayTeam)
                    );
                    if (!exists) newMatches.push(m);
                });

                await setDoc(doc(db, 'leagueData', 'real_fixtures'), {
                    matches: newMatches,
                    lastUpdated: new Date().toISOString()
                });
                showMessage(`✅ סריקה הושלמה! נוספו ${newMatches.length - currentMatches.length} משחקים חדשים.`, 'success');
            } else {
                showMessage('❌ לא נמצאו משחקים בקובץ.', 'error');
            }
            setLoading(false);
        };
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה בסריקת קובץ: ' + e.message, 'error');
        setLoading(false);
    }
  };

  const syncTableFromDrive = async () => {
    if (!tableDriveUrl.trim()) return showMessage('❌ חסר קישור CSV!', 'error');
    setIsSyncingTable(true);
    showMessage('מושך נתוני טבלה... 📊', 'info');
    try {
        const res = await fetch(tableDriveUrl);
        if (!res.ok) throw new Error('לא הצלחתי למשוך את הקובץ. ודא שהקישור תקין וציבורי.');
        const csvText = await res.text();
        const lines = csvText.split('\n');
        
        const batch = writeBatch(db);
        let updatedCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const row = parseCsvRow(lines[i]);
            if (row.length < 10) continue; 
            
            const teamName = row[1] || row[42]; 
            if (!teamName) continue;

            const points = parseInt(row[37]) || 0; 
            const gf = parseInt(row[39]) || 0;     
            const ga = parseInt(row[40]) || 0;     

            const normalizedCsvTeam = getNormalizedTeamId(teamName);
            const userDoc = users.find(u => getNormalizedTeamId(u.teamName) === normalizedCsvTeam || getNormalizedTeamId(u.id) === normalizedCsvTeam);

            if (userDoc) {
                updatedCount++;
                let exactPlayed = 0;
                let exactWins = 0;
                let exactDraws = 0;
                let exactLosses = 0;
                const matchHistory: string[] = [];

                fixtures.forEach((round: any) => {
                    const matches = round.matches || [];
                    matches.forEach((match: any) => {
                        const home = getNormalizedTeamId(match.h || match.homeTeam);
                        const away = getNormalizedTeamId(match.a || match.awayTeam);

                        if (home === normalizedCsvTeam || away === normalizedCsvTeam) {
                            const hScore = match.hs !== undefined ? match.hs : match.homeScore;
                            const aScore = match.as !== undefined ? match.as : match.awayScore;

                            if (hScore !== undefined && aScore !== undefined && hScore !== null && hScore !== '') {
                                exactPlayed++;
                                const isHome = home === normalizedCsvTeam;
                                const myScore = Number(isHome ? hScore : aScore);
                                const oppScore = Number(isHome ? aScore : hScore);

                                if (myScore > oppScore) {
                                    exactWins++;
                                    matchHistory.push('W');
                                } else if (myScore < oppScore) {
                                    exactLosses++;
                                    matchHistory.push('L');
                                } else {
                                    exactDraws++;
                                    matchHistory.push('D');
                                }
                            }
                        }
                    });
                });

                const recentForm = matchHistory.slice(-5);

                batch.update(doc(db, 'users', userDoc.id), {
                    points: points,       
                    gf: gf,                
                    ga: ga,                
                    played: exactPlayed,  
                    wins: exactWins,      
                    draws: exactDraws,    
                    losses: exactLosses,  
                    recentForm: recentForm 
                });
            }
        }
        
        await batch.commit();
        showMessage(`✅ הטבלה והמומנטום עודכנו בהצלחה ל-${updatedCount} קבוצות!`, 'success');
        setTableDriveUrl('');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה בסנכרון טבלה: ' + e.message, 'error');
    } finally {
        setIsSyncingTable(false);
    }
  };

  const handleSyncSquadsFromDrive = async () => {
    if (!squadsDriveUrl.trim()) return showMessage('❌ חסר קישור CSV סגלים!', 'error');
    setLoading(true);
    showMessage('מנתח סגלים ומפיץ לקבוצות... 🪄', 'info');

    try {
        const res = await fetch(squadsDriveUrl);
        if (!res.ok) throw new Error('לא הצלחתי למשוך את הקובץ.');
        const csvText = await res.text();
        
        const parsedPlayers = parseFantasyExcel(csvText);
        
        if (parsedPlayers.length === 0) throw new Error('לא נמצאו שחקנים בקובץ. ודא שהפורמט תקין.');

        const batch = writeBatch(db);

        const playersSnap = await getDocs(collection(db, 'players'));
        playersSnap.docs.forEach(d => batch.delete(d.ref));

        const teamSquads: Record<string, any[]> = {};
        
        parsedPlayers.forEach(player => {
            const teamKey = getNormalizedTeamId(player.fantasyTeam);
            if (!teamSquads[teamKey]) teamSquads[teamKey] = [];
            teamSquads[teamKey].push({ ...player, isStarting: false, points: 0 });
            
            const newPlayerRef = doc(collection(db, 'players'));
            batch.set(newPlayerRef, player);
        });

        let updatedTeamsCount = 0;

        users.forEach(user => {
            if (user.id === 'admin' || user.id === 'system') return;
            
            const userKey = getNormalizedTeamId(user.teamName) || getNormalizedTeamId(user.id);
            const squadForThisTeam = teamSquads[userKey] || [];
            
            if (squadForThisTeam.length > 0) updatedTeamsCount++;

            const userRef = doc(db, 'users', user.id);
            batch.update(userRef, {
                squad: squadForThisTeam,
                players: squadForThisTeam,
                lineup: [],
                published_lineup: [],
                published_subs_out: squadForThisTeam
            });
        });

        await batch.commit();
        showMessage(`✅ סונכרנו ${parsedPlayers.length} שחקנים. נכנסו לסגלים של ${updatedTeamsCount} קבוצות!`, 'success');
        setSquadsDriveUrl('');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה בסנכרון: ' + e.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleRestoreTeam = async (team: any) => {
    setLoading(true);
    try {
        await setDoc(doc(db, 'users', team.id), {
            ...team,
            isApproved: true
        });
        await deleteDoc(doc(db, 'deleted_users', team.id));
        showMessage(`✅ הקבוצה ${team.teamName} שוחזרה בהצלחה!`, 'success');
    } catch (e: any) {
        showMessage('❌ שגיאה בשחזור.', 'error');
    } finally {
        setLoading(false);
    }
  };

  const executePermanentDelete = async () => {
    if (!deleteConfirmId) return;
    setLoading(true);
    try {
        await deleteDoc(doc(db, 'deleted_users', deleteConfirmId));
        showMessage('✅ נמחק לצמיתות.', 'success');
    } catch (e: any) {
        showMessage('❌ שגיאה במחיקה.', 'error');
    } finally {
        setLoading(false);
        setDeleteConfirmId(null);
    }
  };

  const handleCreateNewUser = async () => {
    if (!newUser.teamName || !newUser.email) return showMessage('❌ חסרים פרטים!', 'error');
    setLoading(true);
    try {
        const teamId = cleanStr(newUser.teamName);
        await setDoc(doc(db, 'users', teamId), {
            ...newUser,
            name: newUser.manager,
            points: 0, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0,
            recentForm: [], createdAt: new Date().toISOString()
        });
        
        showMessage(`✅ הקבוצה ${newUser.teamName} נוספה בהצלחה!`, 'success');
        setShowAddUser(false);
        setNewUser({ teamName: '', manager: '', assistantName: '', email: '', assistantEmail: '', role: 'USER', isApproved: true, assistants: [] });
    } catch (e: any) {
        showMessage('❌ שגיאה בהוספה.', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    setLoading(true);
    try {
        await updateDoc(doc(db, 'users', editingUser.id), editingUser);
        showMessage('✅ השינויים נשמרו בהצלחה.', 'success');
        setEditingUser(null);
    } catch (e: any) {
        showMessage('❌ שגיאה בשמירה.', 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleSendResetEmail = async (email: string) => {
    try {
        await sendPasswordResetEmail(auth, email);
        showMessage(`✅ אימייל איפוס נשלח ל-${email}!`, 'success');
    } catch (e: any) {
        showMessage('❌ שגיאה בשליחת אימייל.', 'error');
    }
  };

  const handleEndSeason = async () => {
    if (endSeasonPwd !== 'LUZON13') return showMessage('❌ סיסמה שגויה!', 'error');
    setLoading(true);
    showMessage('מסיים עונה... מנקה נתונים... 🏁', 'info');
    try {
        const activeTeams = users.filter(u => u.id !== 'admin' && u.id !== 'system' && u.teamName);
        const sortedTable = [...activeTeams].sort((a, b) => {
            const aPts = a.points || 0; const bPts = b.points || 0;
            if (bPts !== aPts) return bPts - aPts;
            return ((b.gf || 0) - (b.ga || 0)) - ((a.gf || 0) - (a.ga || 0));
        });

        const historySnap = await getDoc(doc(db, 'leagueData', 'history'));
        const seasons = historySnap.exists() ? historySnap.data().seasons : [];
        
        const winner = sortedTable[0];
        const runnerUp = sortedTable[1];
        
        const newSeasonRecord = {
            season: seasons.length + 1,
            name: seasonArchiveName,
            champ: winner?.teamName || 'N/A',
            runnerUp: runnerUp?.teamName || 'N/A',
            cup: cupWinner || 'N/A', // 🟢 שדה זוכת הגביע שהוספנו 🟢
            relegated: sortedTable[sortedTable.length - 1]?.teamName || 'N/A',
            date: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'leagueData', 'history'), {
            seasons: [newSeasonRecord, ...seasons]
        });
        
        const batch = writeBatch(db);
        users.forEach(u => {
            if (u.id !== 'admin' && u.id !== 'system') {
                batch.update(doc(db, 'users', u.id), {
                    points: 0, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0,
                    recentForm: [], squad: [], lineup: [], published_lineup: [], published_subs_out: [], transfers: []
                });
            }
        });
        
        batch.set(doc(db, 'leagueData', 'fixtures'), { rounds: [], lastUpdated: new Date().toISOString() });
        batch.set(doc(db, 'leagueData', 'real_fixtures'), { matches: [], lastUpdated: new Date().toISOString() });
        batch.update(doc(db, 'leagueData', 'settings'), { currentRound: 1 });
        
        await batch.commit();
        showMessage('✅ העונה הסתיימה! הנתונים אופסו והארכיון עודכן.', 'success');
        setShowEndSeason(false);
        setEndSeasonPwd('');
        setCupWinner('');
    } catch (e: any) {
        console.error(e);
        showMessage('❌ שגיאה בסיום עונה.', 'error');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-900 min-h-screen text-white pb-24" dir="rtl">
      
      {toast && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[9999] p-5 text-center font-black rounded-2xl border shadow-2xl animate-in slide-in-from-top-10 backdrop-blur-xl min-w-[320px] max-w-md ${toast.type === 'error' ? 'bg-red-950/95 text-red-400 border-red-500/50 shadow-red-900/50' : toast.type === 'info' ? 'bg-blue-950/95 text-blue-400 border-blue-500/50 shadow-blue-900/50' : 'bg-green-950/95 text-green-400 border-green-500/50 shadow-green-900/50'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-slate-700 pb-4 mb-6 gap-4">
          <h2 className="text-3xl font-black text-blue-400 flex items-center gap-2">Master Control ⚙️</h2>
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 py-2 px-6 rounded-xl font-bold transition-colors">יציאה מהכספת ➔</button>
        </div>

        {isAdmin && (
          <div className="flex bg-slate-800 p-1 rounded-2xl border border-slate-700 max-w-4xl mx-auto shadow-lg overflow-x-auto custom-scrollbar">
            <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 px-4 rounded-xl font-black transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>👥 קבוצות וטבלה</button>
            <button onClick={() => setActiveTab('system')} className={`flex-1 py-3 px-4 rounded-xl font-black transition-all whitespace-nowrap ${activeTab === 'system' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>📋 סגלים ורכש</button>
            <button onClick={() => setActiveTab('deleted-logs')} className={`flex-1 py-3 px-4 rounded-xl font-black transition-all whitespace-nowrap ${activeTab === 'deleted-logs' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>🗑️ ארכיון מחיקות</button>
            <button onClick={() => setActiveTab('radar')} className={`flex-1 py-3 px-4 rounded-xl font-black transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'radar' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                <Eye className="w-4 h-4" /> רדאר כניסות
            </button>
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto">
        
        {/* --- מסך הרדאר --- */}
        {activeTab === 'radar' && (
           <div className="space-y-6 animate-in fade-in zoom-in-95">
              <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-purple-500/30 shadow-xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] pointer-events-none rounded-full"></div>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 relative z-10 border-b border-slate-700 pb-4 gap-4">
                     <div>
                         <h3 className="text-2xl font-black text-purple-400 flex items-center gap-2"><Eye className="w-6 h-6" /> רדאר התחברויות (Live)</h3>
                         <p className="text-sm text-slate-400 mt-1 font-bold">מעקב בזמן אמת אחרי מנג'רים שנכנסו לאפליקציה.</p>
                     </div>
                     <div className="flex items-center gap-3">
                         <button onClick={handleClearAllLogs} disabled={loading || loginLogs.length === 0} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl border border-red-500/30 flex items-center gap-2 transition-all active:scale-95 shadow-inner">
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs font-black">נקה הכל</span>
                         </button>

                         <button onClick={handleRefreshRadar} disabled={loading} className="bg-slate-900/50 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl border border-slate-600 flex items-center gap-2 transition-all active:scale-95 shadow-inner">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
                            <span className="text-xs font-black">רענן</span>
                         </button>
                         <div className="bg-purple-500/20 text-purple-400 px-4 py-2.5 rounded-xl border border-purple-500/30 flex items-center gap-2 font-black text-lg">
                             {loginLogs.length} <span className="text-xs uppercase tracking-widest text-purple-300/70">כניסות אחרונות</span>
                         </div>
                     </div>
                 </div>

                 {loginLogs.length === 0 ? (
                    <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-800">
                        <Eye className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
                        <span className="text-slate-500 font-bold">עדיין אין נתוני התחברות.</span>
                    </div>
                 ) : (
                    <div className="overflow-x-auto custom-scrollbar bg-slate-900/50 rounded-2xl border border-slate-700 shadow-inner relative z-10">
                        <table className="w-full text-right">
                            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-800">
                                <tr>
                                    <th className="p-4 font-black">מנג'ר / משתמש</th>
                                    <th className="p-4 font-black">קבוצה</th>
                                    <th className="p-4 font-black text-center">מכשיר</th>
                                    <th className="p-4 font-black text-left">תאריך ושעה</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {loginLogs.map((log) => {
                                    const dateObj = new Date(log.timestamp);
                                    const isMobile = log.deviceType === 'Mobile';
                                    
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-800/50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-black text-white group-hover:text-purple-300 transition-colors">{log.name}</div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{log.email}</div>
                                            </td>
                                            <td className="p-4 font-bold text-slate-300">{log.teamName || '-'}</td>
                                            <td className="p-4 text-center">
                                                <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border shadow-inner ${isMobile ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-900/20 text-blue-400 border-blue-500/30'}`}>
                                                    {isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
                                                    <span>{log.deviceType}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-left">
                                                <div className="flex items-center justify-end gap-2 text-slate-400 text-xs font-bold">
                                                    <Clock className="w-3.5 h-3.5 opacity-50" />
                                                    <span className="bg-black/40 px-2 py-1 rounded-md border border-white/5">{dateObj.toLocaleDateString('he-IL')}</span>
                                                    <span className="bg-black/40 px-2 py-1 rounded-md border border-white/5 font-mono">{dateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                 )}
              </div>
           </div>
        )}

        {/* --- מסך קבוצות וטבלה --- */}
        {activeTab === 'users' && (
          <div className="space-y-6">

            <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 p-6 md:p-8 rounded-[32px] border border-purple-400/50 shadow-[0_0_30px_rgba(168,85,247,0.15)] animate-in fade-in zoom-in-95 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 blur-[60px] pointer-events-none rounded-full"></div>
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10"><Calculator className="text-purple-400 w-7 h-7" /> חישוב טבלה ומומנטום (אוטומטי)</h3>
              <p className="text-slate-300 text-sm font-bold mb-6 relative z-10">
                סורק את כל המשחקים מהאפליקציה, מחשב שערים, מומנטום, וניקוד: <br/>
                <span className="text-green-400">ניצחון ב-20 הפרש ומעלה = 3 נק'</span> | <span className="text-green-400">ניצחון רגיל = 2 נק'</span> | <span className="text-yellow-400">תיקו = 1 נק'</span> | <span className="text-red-400">הפסד = 0 נק'</span>.<br/>
                בנוסף יעדכן: 🔥 רצף ניצחונות, 🤡 רצף הפסדים, 🛡️ הגנת ברזל.
              </p>
              <button 
                onClick={recalculateTableFromApp} 
                disabled={loading || isSyncingTable} 
                className="w-full md:w-auto px-10 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 relative z-10"
              >
                {(loading || isSyncingTable) ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Flame className="w-5 h-5" />}
                {(loading || isSyncingTable) ? 'מחשב נתונים...' : 'חשב טבלה, מומנטום ופיצ\'רים עכשיו 🧮'}
              </button>
            </div>

            <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-blue-500/30 shadow-xl animate-in fade-in zoom-in-95">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2"><DownloadCloud className="text-blue-500" /> סנכרון טבלת ליגה מאקסל (אופציה ידנית/גיבוי)</h3>
              <div className="flex flex-col md:flex-row gap-3 mt-4">
                <input type="text" value={tableDriveUrl} onChange={(e) => setTableDriveUrl(e.target.value)} placeholder="קישור CSV לטבלת הסיכום" className="flex-1 bg-black/50 border border-slate-600 p-4 rounded-xl text-white outline-none focus:border-blue-500 text-left font-mono text-sm" dir="ltr" />
                <button onClick={syncTableFromDrive} disabled={isSyncingTable || !tableDriveUrl.trim()} className={`md:w-48 font-black py-4 rounded-xl transition-all ${tableDriveUrl.trim() ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}>עדכן טבלה ⚡</button>
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-[32px] border border-slate-700 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h3 className="text-2xl font-black text-white">ניהול נתוני קבוצות ✏️</h3>
                <button onClick={() => setShowAddUser(true)} className="bg-green-600 hover:bg-green-500 text-white font-black py-2 px-6 rounded-xl">+ הוסף קבוצה</button>
              </div>
              <div className="space-y-4">
                {users.map(u => {
                  if (u.id === 'system') return null; 
                  return (
                    <div key={u.id} className={`flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl border gap-4 ${u.id === 'admin' ? 'bg-slate-950 border-blue-500/30' : 'bg-slate-900 border-slate-700'}`}>
                      <div className="flex-1 w-full text-center sm:text-right">
                        <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
                          <span className="font-black text-xl text-white">{u.teamName}</span>
                          <span className={`text-[10px] px-2 py-1 rounded-md font-black ${
                            u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : 
                            u.role === 'ARENA_MANAGER' ? 'bg-orange-500/20 text-orange-400' : 
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.role === 'ADMIN' ? 'אדמין (ערן)' : u.role === 'ARENA_MANAGER' ? 'מנהל זירה' : 'מנג\'ר'}
                          </span>
                          {/* 🟢 חיווי התראות פוש 🟢 */}
                          {u.fcmToken ? (
                            <span title="מאושר להתראות פוש" className="bg-green-500/10 text-green-400 p-1.5 rounded-lg border border-green-500/30">
                              <Bell className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span title="לא אישר התראות" className="bg-red-500/10 text-red-400/50 p-1.5 rounded-lg border border-red-500/20">
                              <BellOff className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400 mt-1 flex gap-2 justify-center sm:justify-start">
                          <span>מנג'ר ראשי: <span className="text-white font-bold">{u.name}</span> | נקודות: <span className="text-yellow-400 font-bold">{u.points || 0}</span></span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingUser(u); }} className="bg-blue-900/50 hover:bg-blue-800 text-blue-300 font-bold py-2 px-6 rounded-xl border border-blue-700 transition-colors">ערוך</button>
                        {u.id !== 'admin' && <button onClick={() => setDeleteConfirmId(u.id)} className="bg-red-900/50 hover:bg-red-800 text-red-300 font-bold py-2 px-4 rounded-xl border border-red-700 transition-colors">מחק</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- ארכיון מחיקות --- */}
        {activeTab === 'deleted-logs' && (
           <div className="space-y-6 animate-in fade-in zoom-in-95">
             <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-red-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-red-500/10 blur-[50px] pointer-events-none rounded-full"></div>
                <h3 className="text-2xl font-black text-red-400 mb-6 flex items-center gap-2 relative z-10"><Trash2 className="w-6 h-6" /> שחקנים שנמחקו (מעקב)</h3>
                
                {deletedLogs.length === 0 ? (
                  <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-700">
                    <span className="text-slate-500 font-bold">אין שחקנים בארכיון.</span>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar relative z-10 pr-2">
                    {deletedLogs.map((log: any) => (
                       <div key={log.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-red-500/30 transition-colors">
                          <div>
                            <div className="text-white font-black text-lg mb-1">{log.playerName} <span className="text-sm text-slate-400 font-normal">({log.playerPos} - {log.playerRealTeam})</span></div>
                            <div className="text-sm font-bold text-slate-300">נמחק מקבוצת <span className="text-red-400">{log.teamName}</span> ע"י <span className="text-blue-400">{log.managerName}</span></div>
                          </div>
                          <div className="text-xs text-slate-500 font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 shrink-0 text-center">
                            {new Date(log.timestamp).toLocaleString('he-IL')}
                          </div>
                       </div>
                    ))}
                  </div>
                )}
             </div>

             <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-slate-700 shadow-xl">
               <h3 className="text-2xl font-black text-white mb-6">קבוצות בארכיון (נמחקו)</h3>
               {deletedTeams.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 bg-slate-900/50 rounded-2xl">אין קבוצות בארכיון.</p>
               ) : (
                  <div className="space-y-4">
                    {deletedTeams.map(t => (
                      <div key={t.id} className="flex flex-col sm:flex-row justify-between items-center p-4 rounded-2xl bg-slate-950 border border-slate-800 gap-4">
                        <div className="text-center sm:text-right">
                           <div className="font-black text-white text-lg">{t.teamName} <span className="text-slate-500 text-sm font-normal">({t.manager})</span></div>
                           <div className="text-xs text-slate-500 mt-1">נמחק ב: {new Date(t.deletedAt).toLocaleDateString('he-IL')}</div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => handleRestoreTeam(t)} className="bg-green-900/30 hover:bg-green-900/60 text-green-400 font-bold py-2 px-4 rounded-xl border border-green-900/50 transition-colors">שחזר קבוצה</button>
                           <button onClick={() => setDeleteConfirmId(t.id)} className="bg-red-900/30 hover:bg-red-900/60 text-red-400 font-bold py-2 px-4 rounded-xl border border-red-900/50 transition-colors">מחק לצמיתות</button>
                        </div>
                      </div>
                    ))}
                  </div>
               )}
             </div>
           </div>
        )}

        {/* --- מסך סגלים ורכש --- */}
        {activeTab === 'system' && (
          <div className="space-y-6 animate-in fade-in zoom-in-95">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-indigo-900/30 p-6 md:p-8 rounded-[32px] border border-indigo-500/30 shadow-xl relative overflow-hidden flex flex-col justify-between">
                   <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/20 blur-[50px] pointer-events-none rounded-full"></div>
                   <div><h3 className="text-2xl font-black text-indigo-400 mb-2 flex items-center gap-2 relative z-10"><MessageSquare className="w-6 h-6" /> פרשן AI</h3></div>
                   <button onClick={generateManualAISummary} disabled={isGeneratingPost} className="w-full px-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all relative z-10">צור סיכום מחזור 📝</button>
                </div>
                <div className="bg-rose-950/30 p-6 md:p-8 rounded-[32px] border border-rose-500/30 shadow-xl relative overflow-hidden flex flex-col justify-between">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/20 blur-[50px] pointer-events-none rounded-full"></div>
                   <div><h3 className="text-2xl font-black text-rose-400 mb-2 flex items-center gap-2 relative z-10"><Megaphone className="w-6 h-6" /> בורסת השמועות</h3></div>
                   <button onClick={generateRumorPost} disabled={isGeneratingPost} className="w-full px-8 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all relative z-10">ייצר שמועה חמה 🌶️</button>
                </div>
            </div>

            {/* 📸 סריקת משחקים ב-AI */}
            <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-fuchsia-500/30 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 blur-[50px] pointer-events-none rounded-full"></div>
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10"><Camera className="text-fuchsia-500" /> סריקת לוח משחקים (AI)</h3>
              <p className="text-slate-400 text-sm font-bold mb-6 relative z-10 leading-relaxed">
                העלה קובץ PDF או צילום מסך של משחקי המחזור, או פשוט העתק תמונה (Ctrl+C) והדבק אותה ישירות לתוך התיבה למטה (Ctrl+V).<br/>
                <span className="text-fuchsia-400">טיפ: שם הקובץ או הטקסט שתקליד בתיבה יעזור ל-AI להבין איזה מחזור זה!</span>
              </p>
              
              <div className="flex flex-col md:flex-row gap-4 relative z-10">
                <button onClick={() => document.getElementById('fixture-image-upload')?.click()} disabled={loading} className="w-full md:w-1/3 px-6 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 h-auto">
                  <Sparkles className="w-5 h-5" /> העלה קובץ (תמונה/PDF)
                </button>

                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="hidden" 
                  id="fixture-image-upload" 
                  onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                          runAIImageScanner(e.target.files[0]);
                      }
                  }} 
                />

                <textarea 
                  className="flex-1 bg-black/30 border-2 border-dashed border-fuchsia-500/30 rounded-xl p-4 text-white placeholder-slate-500 outline-none focus:border-fuchsia-500 focus:bg-black/50 transition-all font-bold resize-none min-h-[60px]"
                  placeholder="לחץ כאן והדבק תמונה (Ctrl+V) 📋 או הקלד רמז למחזור..."
                  onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('pdf') !== -1) {
                              const file = items[i].getAsFile();
                              if (file) {
                                  e.preventDefault();
                                  const textValue = (e.target as HTMLTextAreaElement).value.trim();
                                  const ext = file.type.includes('pdf') ? 'pdf' : 'png';
                                  const hintName = textValue ? `${textValue}.${ext}` : `pasted_file_${Date.now()}.${ext}`;
                                  
                                  const renamedFile = new File([file], hintName, { type: file.type });
                                  runAIImageScanner(renamedFile);
                                  break;
                              }
                          }
                      }
                  }}
                ></textarea>
              </div>
            </div>

            {/* 🟢 אזור הגדרת מחזורי פלייאוף באדמין */}
            <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-blue-500/30 shadow-xl relative overflow-hidden mt-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] pointer-events-none rounded-full"></div>
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10">
                    <CalendarDays className="text-blue-500" /> הגדרת מחזורי פלייאוף (גמישות הרכבים)
                </h3>
                <p className="text-slate-400 text-sm font-bold mb-6 relative z-10">
                    הזן מספרי מחזורים מופרדים בפסיק (לדוגמה: 31, 35, 36). במחזורים אלו, המערכת תאפשר שמירת הרכב חלקי (פחות מ-11), עד 3 שחקנים מקבוצה, ותבטל את חוקי חובת המערכים (מינימום שחקני הגנה וכו').
                </p>
                <div className="flex flex-col md:flex-row gap-3 relative z-10">
                    <input
                        type="text"
                        value={playoffRoundsInput}
                        onChange={(e) => setPlayoffRoundsInput(e.target.value)}
                        placeholder="לדוגמה: 31, 35, 36"
                        className="flex-1 bg-black/50 border border-slate-600 p-4 rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"
                        dir="ltr"
                    />
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={handleSavePlayoffRounds}
                            disabled={isSavingPlayoffs}
                            className={`flex-[2] font-black py-4 px-6 rounded-xl transition-all ${playoffRoundsInput.trim() ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500'}`}
                        >
                            {isSavingPlayoffs ? 'שומר...' : 'שמור 💾'}
                        </button>
                        <button
                            onClick={async () => {
                                if (window.confirm('האם אתה בטוח שברצונך לבטל את כל מחזורי הפלייאוף ולחזור לחוקים רגילים?')) {
                                    setIsSavingPlayoffs(true);
                                    try {
                                        await setDoc(doc(db, 'leagueData', 'settings'), { playoffRounds: [] }, { merge: true });
                                        setPlayoffRoundsInput('');
                                        showMessage('✅ מחזורי הפלייאוף נוקו. הליגה חזרה למצב רגיל.', 'success');
                                    } catch(e) { showMessage('שגיאה בניקוי', 'error'); }
                                    setIsSavingPlayoffs(false);
                                }
                            }}
                            disabled={isSavingPlayoffs}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 px-4 rounded-xl transition-all flex items-center justify-center border border-slate-700"
                            title="נקה מחזורים (חזור לחוקים רגילים)"
                        >
                            <Eraser className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 🏆 ניהול גביע המדינה 🏆 */}
            <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-yellow-500/30 shadow-xl relative overflow-hidden mt-6">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[50px] pointer-events-none rounded-full"></div>
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10">
                    <Trophy className="text-yellow-500" /> מנהלת הגביע
                </h3>
                <p className="text-slate-400 text-sm font-bold mb-6 relative z-10">
                    שליטה מלאה על טורניר הגביע. פתיחת החלון תאפשר למנג'רים להכין הרכבים בלשונית ההרכב תחת חוקי גביע.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10 mb-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                        <span className="font-bold text-white">חלון הרכבי גביע:</span>
                        <button onClick={() => handleUpdateCupSettings({isOpen: !cupSettings.isOpen})} className={`px-4 py-2 rounded-lg font-black transition-all ${cupSettings.isOpen ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-slate-800 border border-slate-600 text-slate-400'}`}>
                            {cupSettings.isOpen ? 'פתוח למנג׳רים' : 'סגור'}
                        </button>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                        <span className="font-bold text-white">שלב בטורניר:</span>
                        <select value={cupSettings.stage || 'groups'} onChange={(e) => handleUpdateCupSettings({stage: e.target.value})} className="bg-slate-800 border border-slate-600 text-white font-bold p-2 rounded-lg outline-none focus:border-yellow-500 transition-colors">
                            <option value="groups">שלב הבתים</option>
                            <option value="semi">חצי גמר</option>
                            <option value="final">גמר</option>
                        </select>
                    </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 relative z-10 mb-4">
                    <span className="font-bold text-white block mb-3">קבוצות פעילות בגביע (רק להן יופיע החלון):</span>
                    <div className="flex flex-wrap gap-3">
                        {users.filter(u => u.id !== 'admin' && u.id !== 'system').map(u => {
                            const isActive = (cupSettings.activeTeams || []).includes(u.id);
                            return (
                                <button 
                                    key={u.id}
                                    onClick={() => {
                                        const currentActive = cupSettings.activeTeams || [];
                                        const newActive = isActive ? currentActive.filter((id: string) => id !== u.id) : [...currentActive, u.id];
                                        handleUpdateCupSettings({ activeTeams: newActive });
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-black border transition-all ${isActive ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                >
                                    {u.teamName}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-4 relative z-10">
                    <button onClick={handleDrawCupGroups} disabled={isSavingCup} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-black font-black py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95">
                        הגרל בתים (לפי טבלה) 🎲
                    </button>
                    <button onClick={() => setShowCupAdminModal(true)} disabled={isSavingCup} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-xl border border-slate-600 transition-all flex items-center justify-center gap-2 active:scale-95">
                        ניהול תוצאות ידני 🛠️
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 p-6 md:p-8 rounded-[32px] border border-emerald-500/30 shadow-xl mt-6">
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2"><Users className="text-emerald-500" /> סנכרון סגלים התחלתי (מאקסל)</h3>
              <div className="flex flex-col md:flex-row gap-3 mt-4">
                <input type="text" value={squadsDriveUrl} onChange={(e) => setSquadsDriveUrl(e.target.value)} placeholder="קישור CSV סגלים" className="flex-1 bg-black/50 border border-slate-600 p-4 rounded-xl text-white outline-none focus:border-emerald-500 text-left font-mono text-sm" dir="ltr" />
                <button onClick={handleSyncSquadsFromDrive} disabled={loading || !squadsDriveUrl.trim()} className={`md:w-48 font-black py-4 rounded-xl transition-all ${squadsDriveUrl.trim() ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-slate-700 text-slate-500'}`}>שחזר סגלים ⚡</button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 md:p-8 rounded-[32px] border border-yellow-500/50 shadow-[0_0_30px_rgba(250,204,21,0.15)] relative overflow-hidden mt-6">
              <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-500/10 blur-[50px] pointer-events-none rounded-full"></div>
              
              <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-2 relative z-10">
                 <Star className="text-yellow-400 fill-current w-6 h-6" /> אלגוריתם API: סנכרון מלכים חכם
              </h3>
              <p className="text-slate-400 text-sm font-bold mb-6 relative z-10">
                המערכת סורקת לבד את **כל** הלשוניות שקוראים להן "מחזור", ומתקנת שגיאות כתיב בשמות השחקנים. אל תשכח לוודא שהאקסל פתוח לכולם בהגדרות השיתוף (Anyone with the link).
              </p>
              
              <div className="space-y-4 relative z-10">
                <div className="flex flex-col md:flex-row gap-3 mt-4">
                  <input type="text" value={topPlayersDriveUrl} onChange={(e) => setTopPlayersDriveUrl(e.target.value)} placeholder="קישור רגיל לאקסל (https://docs.google.com/spreadsheets/d/...)" className="flex-1 bg-black/50 border border-yellow-600/50 p-4 rounded-xl text-white outline-none focus:border-yellow-400 text-left font-mono text-sm" dir="ltr" />
                  <button onClick={handleSyncTopPlayersWithAPI} disabled={loading || !topPlayersDriveUrl.trim()} className={`md:w-48 font-black py-4 rounded-xl transition-all ${topPlayersDriveUrl.trim() ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black shadow-lg hover:scale-105' : 'bg-slate-700 text-slate-500'}`}>
                    {loading ? 'סורק API...' : 'הפעל סריקה 🌟'}
                  </button>
                </div>
              </div>
            </div>

            {/* 🧹 איפוס זירת הלייב 🧹 */}
            <div className="bg-orange-950/30 p-6 md:p-8 rounded-[32px] border border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.1)] relative overflow-hidden mt-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[50px] pointer-events-none rounded-full"></div>
              <h3 className="text-2xl font-black text-orange-400 mb-2 flex items-center gap-2 relative z-10"><Eraser className="w-6 h-6" /> איפוס נתוני לייב בזירה</h3>
              <p className="text-slate-400 text-sm font-bold mb-6 relative z-10">
                כפתור זה מיועד למקרה שבו תרצה לאפס את **כל הנקודות והסטטיסטיקות** של השחקנים במחזור הנוכחי בחזרה ל-0 (ללא סגירת המחזור וללא פגיעה בהרכבים עצמם).
              </p>
              <button 
                 onClick={() => setShowResetConfirm(true)} 
                 disabled={isResettingLive} 
                 className="w-full md:w-auto px-8 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 relative z-10"
              >
                {isResettingLive ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Eraser className="w-5 h-5" />}
                {isResettingLive ? 'מאפס נתונים...' : 'אפס נקודות לייב לכל הקבוצות 🧹'}
              </button>
            </div>

            {/* ⏪ שחזור ליגה למצב חירום ⏪ */}
            <div className="bg-red-950/30 p-6 md:p-8 rounded-[32px] border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] relative overflow-hidden mt-6">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] pointer-events-none rounded-full"></div>
              <h3 className="text-2xl font-black text-red-400 mb-2 flex items-center gap-2 relative z-10"><Undo2 className="w-6 h-6" /> שחזור מחזור (מצב חירום)</h3>
              <p className="text-slate-400 text-sm font-bold mb-6 relative z-10">
                סגרת מחזור בטעות בזירה? הפונקציה הזו תשאב את הגיבוי האחרון של הליגה, תאפס את הטבלאות וההרכבים חזרה אחורה, ותמחק את הפוסטים האוטומטיים שנוצרו.
              </p>
              <button 
                 onClick={triggerUndo} 
                 disabled={isUndoing} 
                 className="w-full md:w-auto px-8 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 relative z-10"
              >
                {isUndoing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Undo2 className="w-5 h-5" />}
                {isUndoing ? 'משחזר נתונים מהכספת...' : 'שחזר את הליגה למחזור הקודם ⏪'}
              </button>
            </div>

            {/* 🏆 כפתור סגירת עונה 🏆 */}
            <div className="bg-red-950/40 p-6 md:p-8 rounded-[32px] border border-red-500/50 shadow-2xl relative overflow-hidden mt-6">
              <div className="absolute top-0 left-0 w-32 h-32 bg-red-500/20 blur-[50px] pointer-events-none rounded-full"></div>
              <h3 className="text-2xl font-black text-red-500 mb-2 flex items-center gap-2 relative z-10"><AlertTriangle className="w-6 h-6" /> סיום עונה (Danger Zone)</h3>
              <p className="text-slate-400 text-sm font-bold mb-6 relative z-10">
                פעולה זו תנעל את העונה הנוכחית, תשמור את האלופה והיורדות בארכיון, ותאפס את כל הקבוצות והסגלים לעונה הבאה.
              </p>
              <button 
                 onClick={() => setShowEndSeason(true)} 
                 className="w-full md:w-auto px-8 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl transition-all shadow-lg relative z-10"
              >
                סגור עונה ואפס נתונים 🏆
              </button>
            </div>

          </div>
        )}
      </div>

      {/* --- חלונות קופצים (Modals) --- */}

      {/* מודל להוספת קבוצה חדשה */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-green-500/50 p-6 sm:p-8 rounded-[40px] w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowAddUser(false)} className="absolute top-6 left-6 text-slate-500 hover:text-white font-black text-xl bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h3 className="text-2xl font-black text-white mb-6 text-center">הוספת קבוצה חדשה ➕</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם הקבוצה</label><input type="text" value={newUser.teamName} onChange={e => setNewUser({...newUser, teamName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-green-500" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם המנג'ר (מופיע באתר)</label><input type="text" value={newUser.manager} onChange={e => setNewUser({...newUser, manager: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-green-500" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">אימייל התחברות (חובה)</label><input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-green-500" dir="ltr" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם עוזר המאמן (אופציונלי)</label><input type="text" value={newUser.assistantName} onChange={e => setNewUser({...newUser, assistantName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-green-500" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">אימייל עוזר מאמן (אופציונלי)</label><input type="email" value={newUser.assistantEmail} onChange={e => setNewUser({...newUser, assistantEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-green-500" dir="ltr" /></div>
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">הרשאה</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none appearance-none focus:border-green-500">
                  <option value="USER">משתמש רגיל</option>
                  <option value="ARENA_MANAGER">מנהל זירה</option>
                  <option value="ADMIN">אדמין (ערן)</option>
                </select>
              </div>
            </div>
            <button onClick={handleCreateNewUser} disabled={loading} className="w-full mt-8 bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-lg">צור קבוצה</button>
          </div>
        </div>
      )}

      {/* מודל לעריכת קבוצה קיימת */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-blue-500/50 p-6 sm:p-8 rounded-[40px] w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setEditingUser(null)} className="absolute top-6 left-6 text-slate-500 hover:text-white font-black text-xl bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h3 className="text-2xl font-black text-white mb-6 text-center">עריכת קבוצה ✏️</h3>
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם הקבוצה</label><input type="text" value={editingUser.teamName} onChange={e => setEditingUser({...editingUser, teamName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" /></div>
              
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם המנג'ר (מופיע באתר)</label><input type="text" value={editingUser.name || editingUser.manager || ''} onChange={e => setEditingUser({...editingUser, manager: e.target.value, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" /></div>
              
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">אימייל התחברות (מנג'ר)</label><input type="email" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" dir="ltr" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שם עוזר המאמן (אופציונלי)</label><input type="text" value={editingUser.assistantName || ''} onChange={e => setEditingUser({...editingUser, assistantName: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" /></div>
              <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">אימייל עוזר מאמן</label><input type="email" value={editingUser.assistantEmail || ''} onChange={e => setEditingUser({...editingUser, assistantEmail: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500" dir="ltr" /></div>
              
              {/* --- שדה ההרשאות --- */}
              <div>
                <label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">הרשאה</label>
                <select value={editingUser.role || 'USER'} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none appearance-none focus:border-blue-500">
                  <option value="USER">משתמש רגיל</option>
                  <option value="ARENA_MANAGER">מנהל זירה</option>
                  <option value="ADMIN">אדמין (ערן)</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
                  <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">נקודות בטבלה</label><input type="number" value={editingUser.points || 0} onChange={e => setEditingUser({...editingUser, points: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500 text-center" /></div>
                  <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">משחקים ששוחקו</label><input type="number" value={editingUser.played || 0} onChange={e => setEditingUser({...editingUser, played: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500 text-center" /></div>
                  <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שערי זכות</label><input type="number" value={editingUser.gf || 0} onChange={e => setEditingUser({...editingUser, gf: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500 text-center" /></div>
                  <div><label className="text-xs text-slate-400 font-bold ml-1 mb-1 block">שערי חובה</label><input type="number" value={editingUser.ga || 0} onChange={e => setEditingUser({...editingUser, ga: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 p-3.5 rounded-xl text-white font-bold outline-none focus:border-blue-500 text-center" /></div>
              </div>

              {/* 📧 כפתורי איפוס סיסמה מפוצלים 📧 */}
              <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                <button onClick={() => handleSendResetEmail(editingUser.email)} className="w-full bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold py-3 rounded-xl border border-slate-600 transition-colors text-sm">איפוס סיסמה למנג'ר 📧</button>
                
                <button 
                  onClick={() => editingUser.assistantEmail ? handleSendResetEmail(editingUser.assistantEmail) : showMessage('קודם שמור את כתובת המייל של העוזר כדי שיהיה אפשר לשלוח לו!', 'error')} 
                  className={`w-full font-bold py-3 rounded-xl border transition-colors text-sm ${editingUser.assistantEmail ? 'bg-slate-800/50 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'}`}
                >
                  איפוס סיסמה לעוזר מאמן 📧
                </button>
              </div>
            </div>
            <button onClick={handleSaveUserEdit} disabled={loading} className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-lg">שמור שינויים</button>
          </div>
        </div>
      )}

      {/* מודל עריכה ידנית לגביע (Admin Override) */}
      {showCupAdminModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-yellow-500/50 p-6 sm:p-8 rounded-[40px] w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowCupAdminModal(false)} className="absolute top-6 left-6 text-slate-500 hover:text-white font-black text-xl bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center transition-colors">✕</button>
            <h3 className="text-2xl font-black text-white mb-6 text-center">עריכת נקודות גביע 🏆</h3>
            
            <div className="space-y-6">
                {cupSettings?.groups?.lannister?.length > 0 || cupSettings?.groups?.stark?.length > 0 ? (
                    <>
                        <div>
                            <h4 className="text-yellow-400 font-black mb-3 border-b border-yellow-500/30 pb-2">בית לאניסטר</h4>
                            <div className="space-y-3">
                                {(cupSettings.groups?.lannister || []).map((tId: string) => (
                                    <div key={tId} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-700">
                                        <span className="text-white font-bold">{TEAM_NAMES[tId] || tId}</span>
                                        <input type="number" value={tempCupOverrides[tId] || 0} onChange={e => setTempCupOverrides({...tempCupOverrides, [tId]: Number(e.target.value)})} className="bg-slate-800 text-white font-black p-2 rounded-lg w-20 text-center border border-slate-600 focus:border-yellow-500 outline-none" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-blue-400 font-black mb-3 border-b border-blue-500/30 pb-2">בית סטארק</h4>
                            <div className="space-y-3">
                                {(cupSettings.groups?.stark || []).map((tId: string) => (
                                    <div key={tId} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-700">
                                        <span className="text-white font-bold">{TEAM_NAMES[tId] || tId}</span>
                                        <input type="number" value={tempCupOverrides[tId] || 0} onChange={e => setTempCupOverrides({...tempCupOverrides, [tId]: Number(e.target.value)})} className="bg-slate-800 text-white font-black p-2 rounded-lg w-20 text-center border border-slate-600 focus:border-blue-500 outline-none" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div>
                        <h4 className="text-white font-black mb-3 border-b border-slate-700 pb-2">כל הקבוצות (טרם הוגרלו בתים)</h4>
                        <div className="space-y-3">
                            {users.filter(u => u.id !== 'admin' && u.id !== 'system').map((u: any) => (
                                <div key={u.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-700">
                                    <span className="text-white font-bold">{u.teamName}</span>
                                    <input type="number" value={tempCupOverrides[u.id] || 0} onChange={e => setTempCupOverrides({...tempCupOverrides, [u.id]: Number(e.target.value)})} className="bg-slate-800 text-white font-black p-2 rounded-lg w-20 text-center border border-slate-600 focus:border-yellow-500 outline-none" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <button onClick={handleSaveCupOverrides} disabled={isSavingCup} className="w-full mt-8 bg-yellow-600 hover:bg-yellow-500 text-black font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-lg">שמור תוצאות מותאמות</button>
          </div>
        </div>
      )}

      {/* מודל לאיפוס זירה */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-orange-500/50 p-8 rounded-[40px] w-full max-w-md shadow-2xl text-center relative">
            <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Eraser className="w-10 h-10 text-orange-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">איפוס נתוני זירה</h3>
            <p className="text-sm text-slate-400 font-bold mb-8 leading-relaxed">
              ⚠️ אזהרה: פעולה זו תאפס ל-0 את כל הנקודות והסטטיסטיקות של כל השחקנים בזירה הנוכחית לכל הקבוצות!<br/><br/>
              ההרכבים לא יימחקו, רק הניקוד שלהם יאופס.<br/>
              האם להמשיך?
            </p>
            <div className="flex gap-3">
              <button onClick={executeResetLiveArena} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl transition-all">אפס הכל</button>
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* מודל לשחזור מחזור */}
      {showUndoConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-[40px] w-full max-w-md shadow-2xl text-center relative">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Undo2 className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">שחזור מחזור (מכונת זמן)</h3>
            <p className="text-sm text-slate-400 font-bold mb-8 leading-relaxed">
              ⚠️ אזהרה חמורה!<br/>
              פעולה זו תדרוס את כל ההרכבים והטבלה, ותשאב את הגיבוי האחרון של הליגה.<br/>
              זה מיועד רק למקרה של סגירת מחזור בטעות.<br/><br/>
              האם אתה בטוח שברצונך לשחזר אחורה?
            </p>
            <div className="flex gap-3">
              <button onClick={executeUndoRound} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all">כן, שחזר!</button>
              <button onClick={() => setShowUndoConfirm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* מודל למחיקת קבוצה לצמיתות */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-[40px] w-full max-w-sm shadow-2xl text-center relative">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">מחיקה לצמיתות</h3>
            <p className="text-sm text-slate-400 font-bold mb-8">
              האם אתה בטוח שברצונך למחוק קבוצה זו? לא יהיה ניתן לשחזר אותה לאחר מכן.
            </p>
            <div className="flex gap-3">
              <button onClick={executePermanentDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all">מחק לצמיתות</button>
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* מודל סיום עונה (סיסמה) */}
      {showEndSeason && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in zoom-in-95">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-[40px] w-full max-w-md shadow-2xl text-center relative">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-4">סיום העונה הנוכחית</h3>
            <p className="text-sm text-slate-400 font-bold mb-6">
              אזהרה: פעולה זו היא בלתי הפיכה! כל הנתונים יאופסו והעונה תעבור לארכיון.
            </p>
            <input 
              type="text" 
              value={seasonArchiveName} 
              onChange={e => setSeasonArchiveName(e.target.value)} 
              placeholder="שם העונה (לדוגמה: עונת 2023/24)" 
              className="w-full bg-black/50 border border-slate-700 p-4 rounded-xl text-white font-bold outline-none focus:border-red-500 mb-4 text-center" 
            />
            <input 
              type="text" 
              value={cupWinner} 
              onChange={e => setCupWinner(e.target.value)} 
              placeholder="שם זוכת הגביע (למשל: תומאלי)" 
              className="w-full bg-black/50 border border-slate-700 p-4 rounded-xl text-white font-bold outline-none focus:border-yellow-500 mb-4 text-center" 
            />
            <input 
              type="password" 
              value={endSeasonPwd} 
              onChange={e => setEndSeasonPwd(e.target.value)} 
              placeholder="הכנס סיסמת אדמין (ערן) לאישור..." 
              className="w-full bg-black/50 border border-slate-700 p-4 rounded-xl text-white font-bold outline-none focus:border-red-500 mb-6 text-center" 
              dir="ltr"
            />
            <div className="flex gap-3">
              <button onClick={handleEndSeason} disabled={loading || !endSeasonPwd} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all">אשר וסגור עונה</button>
              <button onClick={() => { setShowEndSeason(false); setEndSeasonPwd(''); setCupWinner(''); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl transition-all">ביטול</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminSettings;