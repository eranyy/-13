import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { Trophy, ScrollText, Medal, Flame, Crown, Star, ShieldAlert, TrendingUp, Info, X, LayoutTemplate, UserCheck, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';

const ALLOWED_FORMATIONS = ['5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-5-2', '3-4-3'];

const DEFAULT_SEASONS = [
  { season: 12, champ: 'חמסילי', runnerUp: 'חראלה', cup: "פיצ'יצ'י", relegated: 'טמפה' },
  { season: 11, champ: 'חראלה', runnerUp: "פיצ'יצ'י", cup: 'טמפה', relegated: 'טמפה' },
  { season: 10, champ: 'חמסילי', runnerUp: 'חולוניה', cup: 'חראלה', relegated: 'תומאלי' },
  { season: 9, champ: 'טמפה', runnerUp: 'תומאלי', cup: 'חמסילי', relegated: 'חמסילי' },
  { season: 8, champ: 'חמסילי', runnerUp: 'תומאלי', cup: 'חמסילי', relegated: 'טמפה' },
  { season: 7, champ: "פיצ'יצ'י", runnerUp: 'חמסילי', cup: 'חראלה', relegated: 'תומאלי' },
  { season: 6, champ: 'חמסילי', runnerUp: 'חראלה', cup: 'חמסילי', relegated: 'חולוניה' },
  { season: 5, champ: 'תומאלי', runnerUp: 'טמפה', cup: 'חולוניה', relegated: 'וסילי' },
  { season: 4, champ: "פיצ'יצ'י", runnerUp: 'וסילי', cup: 'תומאלי', relegated: 'תומאלי' },
  { season: 3, champ: 'חמסה', runnerUp: 'חולוניה', cup: 'חמסה', relegated: 'טמפה' },
  { season: 2, champ: 'טמפה', runnerUp: 'תומאלי', cup: 'חראלה', relegated: 'חודורוב' },
  { season: 1, champ: 'טמפה', runnerUp: 'חולוניה', cup: 'תומאלי', relegated: 'תומאלי' },
];

const cleanStr = (s?: string | null) => String(s || '').toLowerCase().replace(/['"״׳`\-\s()]/g, '');

const getHistoricalName = (tName: string) => {
    if (!tName) return '';
    const n = cleanStr(tName);
    if (n.includes('חמסילי') || n.includes('חמסה')) return 'חמסילי';
    if (n.includes('חראלה')) return 'חראלה';
    if (n.includes('טמפה')) return 'טמפה';
    if (n.includes('תומאלי')) return 'תומאלי';
    if (n.includes('חולוניה')) return 'חולוניה';
    if (n.includes('פיציצי') || n.includes('פציצי')) return "פיצ'יצ'י";
    return tName;
};

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
  const id = React.useId().replace(/:/g, '');
  const gradId = `grad-alm-${primary.replace('#', '')}-${secondary.replace('#', '')}-${id}`;
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

const AdminLeagueManager: React.FC<any> = ({ isAdmin, inline, initialSubTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'rules' | 'hof' | 'records' | 'power' | 'top_players'>(initialSubTab || 'table');
  const [teams, setTeams] = useState<any[]>([]);
  const [historySeasons, setHistorySeasons] = useState<any[]>(DEFAULT_SEASONS);
  const [topPlayers, setTopPlayers] = useState<any[]>([]); 
  const [allPlayersDB, setAllPlayersDB] = useState<any[]>([]); 

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);
  const [spicyRecords, setSpicyRecords] = useState({ blowoutWins: [] as any[], blowoutLosses: [] as any[], biggestVictims: [] as any[] });
  
  const [selectedTeamProfile, setSelectedTeamProfile] = useState<any | null>(null);

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, "users"), (snapshot) => {
      setTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    
    const unsubHistory = onSnapshot(doc(db, "leagueData", "history"), (docSnap) => {
      if(docSnap.exists() && docSnap.data().seasons) setHistorySeasons(docSnap.data().seasons);
    });

    const unsubRecords = onSnapshot(doc(db, "leagueData", "records"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const bwObj = data.blowoutWins || {};
        const bwArr = Object.keys(bwObj).map(k => ({ team: k, count: bwObj[k] })).sort((a, b) => b.count - a.count);
        const blObj = data.blowoutLosses || {};
        const blArr = Object.keys(blObj).map(k => ({ team: k, count: blObj[k] })).sort((a, b) => b.count - a.count);
        const bvObj = data.biggestVictims || {};
        const bvArr = Object.keys(bvObj).map(k => {
          const parts = k.split('_vs_');
          return { predator: parts[0], prey: parts[1], count: bvObj[k] };
        }).sort((a, b) => b.count - a.count);
        setSpicyRecords({ blowoutWins: bwArr.slice(0, 5), blowoutLosses: blArr.slice(0, 5), biggestVictims: bvArr.slice(0, 5) });
      }
    });

    const unsubTopPlayers = onSnapshot(doc(db, "leagueData", "top_players"), (docSnap) => {
        if (docSnap.exists()) {
            setTopPlayers(docSnap.data().players || []);
        }
    });

    const unsubPlayersDB = onSnapshot(collection(db, "players"), (snapshot) => {
        setAllPlayersDB(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubTeams(); unsubHistory(); unsubRecords(); unsubTopPlayers(); unsubPlayersDB(); };
  }, []);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { 
      setToast({msg, type}); 
      if (type !== 'info') setTimeout(() => setToast(null), 5000); 
  };

  const activeTeams = [...teams].filter(t => {
      if (t.id === 'admin' || t.id === 'system') return false;
      if (!t.teamName) return false;
      const cleanName = t.teamName.trim().toLowerCase();
      if (cleanName === '') return false;
      if (cleanName.includes('admin') || cleanName.includes('אדמין') || cleanName === 'system') return false;
      return true;
  });

  const sortedTable = [...activeTeams].sort((a, b) => {
      const aPts = a.points || 0; const bPts = b.points || 0;
      if (bPts !== aPts) return bPts - aPts;
      return ((b.gf || 0) - (b.ga || 0)) - ((a.gf || 0) - (a.ga || 0));
  });

  const powerRankedTeams = [...activeTeams].map(t => {
      let pScore = 50;
      if (t.played && t.played > 0) {
          const maxPts = t.played * 3;
          const ptsScore = (t.points / maxPts) * 45; 
          
          let formScore = 12.5;
          if (t.recentForm && t.recentForm.length > 0) {
              const last5 = t.recentForm.slice(-5);
              let fPts = 0;
              last5.forEach((res: string) => {
                  if (res === 'W') fPts += 5;
                  if (res === 'D') fPts += 2;
              });
              formScore = (fPts / (last5.length * 5)) * 25; 
          }

          const gdPerGame = ((t.gf || 0) - (t.ga || 0)) / t.played;
          let gdScore = 10 + gdPerGame; 
          gdScore = Math.max(0, Math.min(20, gdScore)); 

          const gfPerGame = (t.gf || 0) / t.played;
          let xScore = (gfPerGame / 50) * 10; 
          xScore = Math.max(0, Math.min(10, xScore)); 

          pScore = Math.round(ptsScore + formScore + gdScore + xScore);
          pScore = Math.max(1, Math.min(99, pScore)); 
      }
      
      const formStr = t.recentForm ? t.recentForm.slice(-5) : [];
      return { ...t, powerScore: pScore, formStr };
  }).sort((a, b) => b.powerScore - a.powerScore);

  const getPowerBarColor = (score: number) => {
    if (score >= 85) return 'from-purple-500 to-pink-500';
    if (score >= 65) return 'from-green-400 to-emerald-600';
    if (score >= 45) return 'from-yellow-400 to-orange-500';
    return 'from-red-500 to-rose-700';
  };

  const playedTeams = sortedTable.filter(t => (t.played || 0) > 0);
  const minGa = playedTeams.length > 0 ? Math.min(...playedTeams.map(t => t.ga || 0)) : -1;

  const shareTableAsImage = async () => {
    const el = document.getElementById('league-table-capture');
    if (!el) return;
    showMessage('מייצר תמונה ברמת ליגת האלופות... 📸', 'info');
    
    try {
      const scrollContainer = el.querySelector('.overflow-x-auto');
      const targetWidth = scrollContainer ? scrollContainer.scrollWidth + 40 : el.offsetWidth;

      const canvas = await html2canvas(el, { 
        backgroundColor: '#0f172a', 
        scale: 2, 
        useCORS: true,
        windowWidth: targetWidth, 
        onclone: (clonedDoc) => {
          const container = clonedDoc.getElementById('league-table-capture');
          if (container) {
            container.style.width = `${targetWidth}px`;
            container.style.maxWidth = 'none';
            container.style.overflow = 'visible';
          }
          
          const tableWrapper = clonedDoc.querySelector('.overflow-x-auto');
          if (tableWrapper) {
            (tableWrapper as HTMLElement).style.width = `${targetWidth}px`;
            (tableWrapper as HTMLElement).style.maxWidth = 'none';
            (tableWrapper as HTMLElement).style.overflow = 'visible';
          }

          const blurs = clonedDoc.querySelectorAll('.backdrop-blur-md, .backdrop-blur-xl, .backdrop-blur-2xl');
          blurs.forEach(b => {
              b.classList.remove('backdrop-blur-md', 'backdrop-blur-xl', 'backdrop-blur-2xl');
              (b as HTMLElement).style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
          });
          const ignores = clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"]');
          ignores.forEach(ig => (ig as HTMLElement).style.display = 'none');
        }
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'Luzon13_Table.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'טבלת פנטזי לוזון 13', text: '🏆 טבלת פנטזי לוזון 13 - תמונת מצב רותחת! 🔥' });
          setToast(null);
        } else {
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showMessage('התמונה הועתקה! פתח ווצאפ והדבק (Ctrl+V) 📋', 'success');
          } catch (err) {
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Luzon13_Table.png'; link.click();
            showMessage('התמונה ירדה למחשב! צרף אותה לווצאפ 📥', 'success');
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showMessage('שגיאה ביצירת התמונה', 'error');
    }
  };

  const allTimeMap: Record<string, {name: string, titles: number, cups: number, doubles: number}> = {};
  historySeasons.forEach(s => {
    const cName = getHistoricalName(s.champ || '');
    const cupName = getHistoricalName(s.cup || '');

    if (cName) {
      if(!allTimeMap[cName]) allTimeMap[cName] = {name: cName, titles:0, cups:0, doubles:0};
      allTimeMap[cName].titles += 1;
    }
    if (cupName) {
      if(!allTimeMap[cupName]) allTimeMap[cupName] = {name: cupName, titles:0, cups:0, doubles:0};
      allTimeMap[cupName].cups += 1;
    }
    if (cName && cupName && cName === cupName) {
      allTimeMap[cName].doubles += 1;
    }
  });
  
  const sortedAllTimeStats = Object.values(allTimeMap).sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    return b.cups - a.cups;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center pt-20 h-full gap-4 opacity-50">
      <div className="w-12 h-12 border-[4px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="font-black text-blue-500 tracking-widest uppercase">Loading Table...</div>
    </div>
  );

  return (
    <div className={`space-y-6 md:space-y-8 font-sans ${inline ? '' : 'p-4 md:p-8'}`} dir="rtl">
      {toast && (
        <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[9999] p-5 text-center font-black rounded-2xl border shadow-2xl animate-in slide-in-from-top-10 backdrop-blur-xl min-w-[320px] max-w-md ${toast.type === 'error' ? 'bg-red-950/95 text-red-400 border-red-500/50 shadow-red-900/50' : toast.type === 'info' ? 'bg-blue-950/95 text-blue-400 border-blue-500/50 shadow-blue-900/50' : 'bg-green-950/95 text-green-400 border-green-500/50 shadow-green-900/50'}`}>
          {toast.msg}
        </div>
      )}
      
      <div className="bg-black/40 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 flex max-w-4xl mx-auto shadow-inner overflow-x-auto custom-scrollbar relative z-30">
        <button onClick={() => setActiveSubTab('table')} className={`flex-1 min-w-[70px] md:min-w-[90px] py-3 px-2 rounded-xl text-[11px] md:text-sm font-black transition-all flex justify-center items-center gap-1 md:gap-1.5 whitespace-nowrap ${activeSubTab === 'table' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg border border-blue-500/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}><Trophy className="w-3 h-3 md:w-4 md:h-4" /> טבלה</button>
        <button onClick={() => setActiveSubTab('top_players')} className={`flex-1 min-w-[80px] md:min-w-[100px] py-3 px-2 rounded-xl text-[11px] md:text-sm font-black transition-all flex justify-center items-center gap-1 md:gap-1.5 whitespace-nowrap ${activeSubTab === 'top_players' ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg border border-emerald-500/50' : 'text-zinc-500 hover:text-emerald-400/70 hover:bg-white/5'}`}><Star className="w-3 h-3 md:w-4 md:h-4" /> מלכים</button>
        <button onClick={() => setActiveSubTab('power')} className={`flex-1 min-w-[80px] md:min-w-[100px] py-3 px-2 rounded-xl text-[11px] md:text-sm font-black transition-all flex justify-center items-center gap-1 md:gap-1.5 whitespace-nowrap ${activeSubTab === 'power' ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg border border-purple-500/50' : 'text-zinc-500 hover:text-purple-400/70 hover:bg-white/5'}`}><TrendingUp className="w-3 h-3 md:w-4 md:h-4" /> עוצמה</button>
        <button onClick={() => setActiveSubTab('rules')} className={`flex-1 min-w-[70px] md:min-w-[90px] py-3 px-2 rounded-xl text-[11px] md:text-sm font-black transition-all flex justify-center items-center gap-1 md:gap-1.5 whitespace-nowrap ${activeSubTab === 'rules' ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}><ScrollText className="w-3 h-3 md:w-4 md:h-4" /> תקנון</button>
        <button onClick={() => setActiveSubTab('hof')} className={`flex-1 min-w-[80px] md:min-w-[100px] py-3 px-2 rounded-xl text-[11px] md:text-sm font-black transition-all flex justify-center items-center gap-1 md:gap-1.5 whitespace-nowrap ${activeSubTab === 'hof' ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 text-black shadow-lg border border-yellow-400' : 'text-zinc-500 hover:text-yellow-500/70 hover:bg-white/5'}`}><Medal className="w-3 h-3 md:w-4 md:h-4" /> תהילה</button>
        <button onClick={() => setActiveSubTab('records')} className={`flex-1 min-w-[90px] md:min-w-[110px] py-3 px-2 rounded-xl text-[11px] md:text-sm font-black transition-all flex justify-center items-center gap-1 md:gap-1.5 whitespace-nowrap ${activeSubTab === 'records' ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg border border-red-500/50' : 'text-zinc-500 hover:text-red-400/70 hover:bg-white/5'}`}><Flame className="w-3 h-3 md:w-4 md:h-4" /> פיקנטריה</button>
      </div>

      {activeSubTab === 'top_players' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 pt-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tight drop-shadow-lg flex items-center justify-center gap-3">
              Fantasy Kings <Star className="w-10 h-10 md:w-12 md:h-12 text-yellow-400 fill-current drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            </h2>
            <p className="text-emerald-400 font-black uppercase tracking-[0.2em] md:tracking-widest text-xs md:text-sm mt-3">השחקנים הלוהטים של העונה</p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 gap-3 px-2">
            {topPlayers.length === 0 ? (
                <div className="text-center bg-slate-900/50 rounded-3xl p-10 border border-slate-800">
                    <p className="text-slate-400 font-bold">הנתונים טרם סונכרנו.<br/>(מנהל המערכת צריך להזין את קובץ הסיכום בהגדרות).</p>
                </div>
            ) : (
                topPlayers.map((player, idx) => {
                  const isTop1 = idx === 0;
                  const isTop2 = idx === 1;
                  const isTop3 = idx === 2;
                  
                  const matchedPlayer = allPlayersDB.find(dbP => cleanStr(dbP.name) === cleanStr(player.name));
                  const displayPosition = matchedPlayer ? matchedPlayer.position : 'N/A';
                  const isGK = ['GK', 'שוער'].includes(displayPosition);

                  const colors = getTeamColors(player.fantasyTeamName, isGK);

                  let bgClass = 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80';
                  let rankColor = 'text-slate-500';
                  
                  // העיצוב החדש והנוצץ למקומות הראשונים
                  if (isTop1) { 
                    bgClass = 'bg-gradient-to-r from-yellow-900/60 to-slate-900 border-yellow-400/60 shadow-[0_0_30px_rgba(250,204,21,0.25)]'; 
                    rankColor = 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'; 
                  }
                  else if (isTop2) { 
                    bgClass = 'bg-gradient-to-r from-zinc-700/60 to-slate-900 border-zinc-300/60 shadow-[0_0_25px_rgba(212,212,216,0.15)] relative overflow-hidden'; 
                    rankColor = 'text-zinc-200 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]'; 
                  }
                  else if (isTop3) { 
                    bgClass = 'bg-gradient-to-r from-amber-900/40 to-slate-900 border-amber-700/50 shadow-[0_0_15px_rgba(180,83,9,0.1)]'; 
                    rankColor = 'text-amber-600 drop-shadow-[0_0_5px_rgba(180,83,9,0.5)]'; 
                  }

                  return (
                    <div key={idx} className={`p-4 md:p-5 rounded-3xl border transition-all duration-300 flex items-center gap-3 md:gap-4 ${bgClass}`}>
                      {isTop2 && <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"></div>}
                      
                      <div className="w-8 md:w-12 text-center shrink-0 relative z-10">
                        <span className={`text-xl md:text-3xl font-black tabular-nums drop-shadow-md ${rankColor}`}>
                          {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${idx + 1}`}
                        </span>
                      </div>

                      <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 relative z-10">
                         <Jersey primary={colors.prim} secondary={colors.sec} textColor={colors.text} text={isGK ? '🧤' : displayPosition !== 'N/A' ? displayPosition : '⚽'} />
                      </div>

                      <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center relative z-10">
                        <h4 className="text-sm sm:text-lg md:text-2xl font-black text-white leading-none whitespace-normal break-words mb-1 md:mb-1.5">{player.name}</h4>
                        
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                           {player.fantasyTeamName && player.fantasyTeamName !== '' ? (
                               <span className="text-[10px] md:text-xs bg-black/40 border border-white/10 px-2 py-1 rounded-lg text-slate-300 font-bold flex items-center gap-1 w-fit">
                                  <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
                                  <span className="truncate">{player.fantasyTeamName}</span>
                               </span>
                           ) : (
                               <span className="text-[10px] md:text-xs bg-black/40 border border-white/10 px-2 py-1 rounded-lg text-slate-500 font-bold italic w-fit">
                                  שחקן חופשי
                               </span>
                           )}
                           <span className="text-[10px] md:text-xs font-bold text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-700 w-fit">
                              {player.team}
                           </span>
                           <span className="text-[10px] md:hidden font-bold text-slate-500 uppercase ml-1">{displayPosition}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-center justify-center bg-slate-950 px-4 md:px-6 py-2 md:py-3 rounded-2xl border border-slate-800 shadow-inner ml-1 relative z-10">
                         <span className={`text-2xl md:text-4xl font-black tabular-nums leading-none ${isTop1 ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]' : isTop2 ? 'text-zinc-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]'}`}>
                           {player.points}
                         </span>
                         <span className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Points</span>
                      </div>

                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'power' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 pt-4">
          <div className="text-center mb-6">
            <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tight drop-shadow-lg flex items-center justify-center gap-3">
              Power Ranking <TrendingUp className="w-10 h-10 text-purple-500" />
            </h2>
            <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-3">האלגוריתם שקובע מי המנג'ר החם של הרגע</p>
          </div>

          <div className="bg-slate-900/60 p-4 md:p-5 rounded-3xl border border-purple-500/20 mb-10 max-w-3xl mx-auto shadow-inner text-right backdrop-blur-sm">
             <h4 className="text-purple-400 font-black text-sm mb-3 flex items-center gap-2">
               <Info className="w-4 h-4" /> איך מחושב הציון? (הנוסחה המדעית)
             </h4>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] md:text-xs">
               <div className="bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                 <span className="text-yellow-400 font-black text-sm block mb-1">45%</span>
                 <span className="text-slate-300 font-bold leading-tight block">אחוזי הצלחה (נקודות ביחס למקסימום)</span>
               </div>
               <div className="bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                 <span className="text-green-400 font-black text-sm block mb-1">25%</span>
                 <span className="text-slate-300 font-bold leading-tight block">מומנטום (כושר ב-5 המשחקים האחרונים)</span>
               </div>
               <div className="bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                 <span className="text-blue-400 font-black text-sm block mb-1">20%</span>
                 <span className="text-slate-300 font-bold leading-tight block">פער שערים כולל (זכות פחות חובה)</span>
               </div>
               <div className="bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                 <span className="text-red-400 font-black text-sm block mb-1">10%</span>
                 <span className="text-slate-300 font-bold leading-tight block">כוח אש התקפי (ממוצע שערי זכות)</span>
               </div>
             </div>
          </div>
          
          <div className="flex flex-col gap-4 max-w-3xl mx-auto px-2">
             {powerRankedTeams.map((t, idx) => {
               const isTop = idx === 0;
               const barColor = getPowerBarColor(t.powerScore);
               
               return (
                 <div key={t.id} className={`p-4 md:p-5 rounded-3xl border relative overflow-hidden flex items-center gap-4 md:gap-6 ${isTop ? 'bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' : 'bg-zinc-900/80 border-white/5 hover:border-white/10'}`}>
                    
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white opacity-[0.02] -rotate-45 transform translate-x-4 -translate-y-4"></div>

                    <div className="flex flex-col items-center justify-center w-6 shrink-0">
                       <span className={`text-xs font-black uppercase tracking-widest ${isTop ? 'text-purple-400' : 'text-zinc-600'}`}>Rank</span>
                       <span className={`text-2xl md:text-3xl font-black ${isTop ? 'text-white' : 'text-zinc-500'}`}>#{idx + 1}</span>
                    </div>

                    <div className={`w-14 h-14 md:w-16 md:h-16 shrink-0 flex flex-col items-center justify-center rounded-2xl border-2 shadow-inner ${isTop ? 'bg-purple-500/20 border-purple-400 text-purple-400' : 'bg-zinc-950 border-zinc-700 text-white'}`}>
                        <span className="text-[10px] md:text-xs font-bold -mb-1 opacity-70">OVR</span>
                        <span className="text-xl md:text-3xl font-black tabular-nums leading-tight">{t.powerScore}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                           <h4 className="text-lg md:text-xl font-black text-white truncate">{t.teamName}</h4>
                           {isTop && <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-md font-black animate-pulse">🔥 HOT</span>}
                        </div>
                        <div className="text-[10px] md:text-xs text-zinc-400 font-bold uppercase tracking-widest mb-3 truncate">{t.manager}</div>
                        
                        <div className="w-full h-1.5 md:h-2 bg-zinc-950 rounded-full overflow-hidden flex shadow-inner">
                            <div style={{width: `${t.powerScore}%`}} className={`h-full bg-gradient-to-l ${barColor}`}></div>
                        </div>
                    </div>

                    <div className="hidden sm:flex flex-col gap-2 shrink-0 text-left pl-2 border-l border-zinc-800">
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-right mb-0.5">כושר נוכחי (5 אחרונים)</div>
                        <div className="flex gap-1 justify-end">
                            {t.formStr.length === 0 ? <span className="text-xs text-zinc-600 font-bold">אין נתונים</span> : 
                             t.formStr.map((char: string, i: number) => (
                                <span key={i} className={`w-5 h-5 rounded-[4px] flex items-center justify-center text-[10px] font-black shadow-sm ${char==='W'?'bg-green-500/20 text-green-400 border border-green-500/30':char==='L'?'bg-red-500/20 text-red-400 border border-red-500/30':'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'}`}>
                                    {char}
                                </span>
                            ))}
                        </div>
                    </div>

                 </div>
               );
             })}
          </div>
        </div>
      )}

      {activeSubTab === 'table' && (
        <div className="space-y-4">
          <div id="league-table-capture" className="bg-zinc-900/60 backdrop-blur-2xl rounded-[32px] md:rounded-[40px] border border-white/5 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 pb-2 relative">
            <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-transparent p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <div>
                 <h3 className="text-3xl font-black text-white italic flex items-center gap-3">League Table<Crown className="w-6 h-6 text-yellow-500 hidden sm:block" /></h3>
                 <p className="text-zinc-400 text-sm font-bold mt-1">הטבלה הרשמית והמעודכנת של לוזון 13</p>
               </div>
               <div className="flex items-center gap-3 w-full sm:w-auto" data-html2canvas-ignore="true">
                 <button onClick={shareTableAsImage} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-500/50 px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 font-black text-sm"><ImageIcon className="w-4 h-4" /><span>שתף תמונה</span></button>
               </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse">
                <thead className="bg-black/40 text-zinc-500 text-[10px] md:text-xs font-black uppercase tracking-widest whitespace-nowrap border-b border-zinc-800">
                  <tr>
                    <th className="p-3 md:p-5 w-10 text-center">#</th>
                    <th className="p-3 md:p-5 text-right min-w-[120px]">מועדון</th>
                    <th className="p-3 md:p-5 text-center">מש'</th>
                    <th className="p-3 md:p-5 text-center bg-blue-500/10 text-blue-400 w-16 md:w-20 rounded-t-xl" title="נקודות">Pts</th>
                    <th className="p-3 md:p-5 text-center" title="הפרש שערים">GD</th>
                    <th className="p-3 md:p-5 text-center text-green-500/70">נ'</th>
                    <th className="p-3 md:p-5 text-center text-yellow-500/70">ת'</th>
                    <th className="p-3 md:p-5 text-center text-red-500/70">ה'</th>
                    <th className="p-3 md:p-5 text-center hidden md:table-cell" title="שערי זכות">זכות</th>
                    <th className="p-3 md:p-5 text-center hidden md:table-cell" title="שערי חובה">חובה</th>
                    <th className="p-3 md:p-5 text-center table-cell" data-html2canvas-ignore="true" title="5 משחקים אחרונים">מומנטום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-sm md:text-base">
                  {sortedTable.map((t, i) => {
                    const gd = (t.gf || 0) - (t.ga || 0); const isTop1 = i === 0; const isTop2 = i === 1; const isTop3 = i === 2; const isRelegation = i >= sortedTable.length - 2; 
                    
                    const rf = t.recentForm || [];
                    const isFire = rf.length >= 3 && rf.slice(-3).every((r: string) => r === 'W');
                    const isClown = rf.length >= 3 && rf.slice(-3).every((r: string) => r === 'L');
                    const isWall = minGa !== -1 && (t.ga || 0) === minGa && (t.played || 0) > 0;

                    const pTeam = powerRankedTeams.find(pt => pt.id === t.id);
                    const powerScore = pTeam ? pTeam.powerScore : 50;

                    let rowClass = 'hover:bg-zinc-800/80 transition-colors group cursor-pointer'; 
                    let rankClass = 'text-zinc-500';
                    
                    // העיצוב החדש והנוצץ למקומות הראשונים גם בטבלה
                    if (isTop1) { 
                      rowClass += ' bg-yellow-500/5 hover:bg-yellow-500/15'; 
                      rankClass = 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]'; 
                    }
                    else if (isTop2) { 
                      rowClass += ' bg-zinc-400/5 hover:bg-zinc-400/15'; 
                      rankClass = 'text-zinc-300 drop-shadow-[0_0_5px_rgba(255,255,255,0.4)]'; 
                    }
                    else if (isTop3) { 
                      rowClass += ' bg-amber-600/5 hover:bg-amber-600/15'; 
                      rankClass = 'text-amber-500 drop-shadow-[0_0_3px_rgba(245,158,11,0.4)]'; 
                    }
                    else if (isRelegation) { rowClass += ' bg-red-950/20 hover:bg-red-950/40'; rankClass = 'text-red-500/50'; }
                    
                    return (
                      <tr key={t.id} className={rowClass} onClick={() => setSelectedTeamProfile({ ...t, powerScore, recentForm: pTeam?.formStr })}>
                        <td className={`p-3 md:p-5 text-center font-black ${rankClass}`}>{isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : i + 1}</td>
                        <td className="p-3 md:p-5 relative">
                          <div className="flex items-center gap-1.5">
                             <div className={`font-black text-base md:text-lg transition-colors ${isTop1 ? 'text-yellow-400' : 'text-white group-hover:text-blue-400'}`}>{t.teamName}</div>
                             {isFire && <span title="On Fire! 3 ניצחונות רצופים" className="text-sm drop-shadow-md animate-pulse">🔥</span>}
                             {isClown && <span title="שק חבטות - 3 הפסדים רצופים" className="text-sm drop-shadow-md">🤡</span>}
                             {isWall && <span title="הגנת ברזל - ספגה הכי מעט בליגה" className="text-sm drop-shadow-md">🛡️</span>}
                          </div>
                          <div className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-wide mt-0.5">{t.manager}</div>
                          <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block text-slate-600 text-[10px] whitespace-nowrap">פרופיל 🔍</div>
                        </td>
                        <td className="p-3 md:p-5 text-center font-bold text-zinc-400">{t.played || 0}</td>
                        <td className={`p-3 md:p-5 text-center font-black text-xl md:text-2xl tabular-nums ${isTop1 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-600/10 text-blue-400'}`}>{t.points || 0}</td>
                        <td className="p-3 md:p-5 text-center" dir="ltr"><div className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono text-xs font-black ${gd > 0 ? 'bg-green-500/10 text-green-400' : gd < 0 ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>{gd > 0 ? `+${gd}` : gd}</div></td>
                        <td className="p-3 md:p-5 text-center font-black text-green-500/80">{t.wins || 0}</td>
                        <td className="p-3 md:p-5 text-center font-black text-yellow-500/80">{t.draws || 0}</td>
                        <td className="p-3 md:p-5 text-center font-black text-red-500/80">{t.losses || 0}</td>
                        <td className="p-3 md:p-5 text-center font-mono text-zinc-300 hidden md:table-cell">{t.gf || 0}</td>
                        <td className="p-3 md:p-5 text-center font-mono text-zinc-500 hidden md:table-cell">{t.ga || 0}</td>
                        <td className="p-3 md:p-5 text-center table-cell" data-html2canvas-ignore="true">
                          <div className="flex gap-1 justify-center">
                             {rf.length === 0 ? <span className="text-[10px] text-zinc-600">אין</span> : rf.slice(-5).map((char: string, k: number) => (
                                 <span key={k} className={`w-3 h-3 md:w-4 md:h-4 rounded-[3px] flex items-center justify-center text-[7px] md:text-[9px] font-black shadow-sm ${char==='W'?'bg-green-500/20 text-green-400':char==='L'?'bg-red-500/20 text-red-400':'bg-yellow-500/20 text-yellow-500'}`}>{char}</span>
                             ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bg-black/60 p-4 border-t border-zinc-800 flex flex-wrap justify-center gap-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 mx-4 mb-4 rounded-xl">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_#eab308]"></span> אלופה</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400"></span> סגנית</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/50"></span> סכנת ירידה</div>
              <div className="flex items-center gap-1"><span className="text-sm">🔥</span> רצף ניצחונות (3+)</div>
              <div className="flex items-center gap-1"><span className="text-sm">🤡</span> רצף הפסדים (3+)</div>
              <div className="flex items-center gap-1"><span className="text-sm">🛡️</span> הגנת ברזל</div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'rules' && (
        <div className="p-4 md:p-10 bg-zinc-900/60 backdrop-blur-xl rounded-[32px] md:rounded-[40px] border border-white/5 animate-in fade-in slide-in-from-bottom-4 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col items-center mb-8 border-b border-zinc-800 pb-6 relative z-10 text-center">
            <ScrollText className="w-12 h-12 text-blue-500 mb-3" />
            <h3 className="text-3xl md:text-4xl font-black text-white italic tracking-tight">תקנון וחוקים</h3>
            <p className="text-zinc-400 font-bold uppercase tracking-widest mt-2 text-xs md:text-sm">החוקה הרשמית של פנטזי LUZON 13</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10">
            <div className="space-y-6">
              <section className="bg-zinc-950/80 rounded-3xl border border-zinc-800 overflow-hidden shadow-lg">
                <div className="bg-zinc-900 px-5 py-4 border-b border-zinc-800 flex items-center gap-3"><Trophy className="w-5 h-5 text-yellow-500" /><h4 className="text-lg font-black text-white">ניקוד במחזור (בטבלה)</h4></div>
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border-r-4 border-green-500"><span className="text-3xl">🔥</span><div><div className="text-white font-black text-base">ניצחון מוחץ <span className="text-green-400 ml-1">(3 נק')</span></div><div className="text-xs text-zinc-400 font-bold mt-0.5">ניצחון ב-20 נקודות הפרש ומעלה.</div></div></div>
                  <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border-r-4 border-blue-500"><span className="text-3xl">⚽</span><div><div className="text-white font-black text-base">ניצחון רגיל <span className="text-blue-400 ml-1">(2 נק')</span></div><div className="text-xs text-zinc-400 font-bold mt-0.5">ניצחון עד 19 נקודות הפרש (כולל).</div></div></div>
                  <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-2xl border-r-4 border-yellow-500"><span className="text-3xl">🤝</span><div><div className="text-white font-black text-base">תיקו <span className="text-yellow-500 ml-1">(1 נק' לכל קבוצה)</span></div><div className="text-xs text-zinc-400 font-bold mt-0.5">שוויון מוחלט בנקודות הפנטזי.</div></div></div>
                </div>
              </section>
              <section className="bg-zinc-950/80 rounded-3xl border border-zinc-800 overflow-hidden shadow-lg p-5">
                 <div className="flex items-center gap-3 mb-4"><LayoutTemplate className="w-5 h-5 text-indigo-400" /><h4 className="text-lg font-black text-white">מערכים מותרים (שיטות משחק)</h4></div>
                 <div className="flex flex-wrap gap-2 mb-6">{ALLOWED_FORMATIONS.map(f => (<span key={f} className="bg-zinc-900 text-indigo-300 font-black px-3 py-1.5 rounded-xl border border-indigo-500/20 shadow-inner text-sm">{f}</span>))}</div>
                 <div className="border-t border-zinc-800 pt-5"><h4 className="text-sm font-black text-white mb-2 flex items-center gap-2"><span>⚖️</span> שובר שוויון בטבלה</h4><p className="text-xs text-zinc-400 leading-relaxed font-bold">במקרה של שוויון בנקודות, המיקום ייקבע על פי <span className="text-white font-black bg-zinc-800 px-1.5 py-0.5 rounded mx-0.5">הפרש השערים</span> (סך נקודות זכות פחות סך נקודות חובה העונה).</p></div>
              </section>
            </div>
            <div className="space-y-4">
              <h4 className="text-xl font-black text-white mb-2 flex items-center gap-2 pl-2"><UserCheck className="w-5 h-5 text-green-400"/> ניקוד שחקנים במחזור</h4>
              <div className="bg-zinc-950/80 rounded-3xl border border-zinc-800 overflow-hidden shadow-lg">
                <div className="bg-zinc-900 px-5 py-3 border-b border-zinc-800 text-zinc-300 font-black text-sm flex items-center justify-between"><span>ניקוד כללי (לכל השחקנים)</span></div>
                <div className="divide-y divide-zinc-800/50 px-5">
                  {[{ label: 'פתח בהרכב', points: '+1', color: 'text-green-400' }, { label: 'שיחק 60 דקות ומעלה', points: '+1', color: 'text-green-400' }, { label: 'שותף לניצחון (אפילו דקה)', points: '+2', color: 'text-green-400' }, { label: 'יצר / סחט פנדל', points: '+2', color: 'text-green-400' }, { label: 'בישול שער עצמי', points: '+2', color: 'text-green-400' }, { label: 'בסגל (ב-16) ולא שותף', points: '0', color: 'text-zinc-500' }, { label: 'לא בסגל (מחוץ ל-16)', points: '-1', color: 'text-red-400' }, { label: 'כרטיס צהוב', points: '-2', color: 'text-red-400' }, { label: 'צהוב שני (אדום)', points: '-2', color: 'text-red-400' }, { label: 'החטיא פנדל', points: '-3', color: 'text-red-400' }, { label: 'שער עצמי', points: '-3', color: 'text-red-400' }, { label: 'כרטיס אדום ישיר', points: '-5', color: 'text-red-400' }].map((rule, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2.5"><span className="text-zinc-400 text-sm font-bold">{rule.label}</span><span className={`font-black text-base tabular-nums ${rule.color}`}>{rule.points}</span></div>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-950/80 rounded-3xl border border-zinc-800 overflow-hidden shadow-lg">
                <div className="bg-blue-900/10 px-5 py-3 border-b border-blue-900/30 text-blue-400 font-black text-sm flex items-center justify-between"><span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> שוערים ושחקני הגנה</span></div>
                <div className="divide-y divide-zinc-800/50 px-5">
                  {[{ label: 'שוער כובש', points: '+10', color: 'text-green-400' }, { label: 'שחקן הגנה כובש', points: '+8', color: 'text-green-400' }, { label: 'שוער מבשל', points: '+6', color: 'text-green-400' }, { label: 'שוער (מעל 60 דק\') ולא ספג', points: '+5', color: 'text-green-400' }, { label: 'שחקן הגנה מבשל', points: '+4', color: 'text-green-400' }, { label: 'הגנה (מעל 60 דק\') ולא ספג', points: '+4', color: 'text-green-400' }, { label: 'שוער שעצר פנדל (החטיאו מולו)', points: '+3', color: 'text-green-400' }, { label: 'הגנה/שוער לא ספגו (מתחת ל-60 דק\')', points: '0', color: 'text-zinc-500' }, { label: 'ספיגת שער (בעת שהייה במגרש)', points: '-1', color: 'text-red-400' }, { label: 'שוער לא משחק (ב-16 או לא)', points: '-1', color: 'text-red-400' }].map((rule, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2.5"><span className="text-zinc-400 text-sm font-bold">{rule.label}</span><span className={`font-black text-base tabular-nums ${rule.color}`}>{rule.points}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'hof' && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
          <div className="text-center space-y-3 pt-6">
            <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-500 to-yellow-700 italic tracking-tighter drop-shadow-xl filter drop-shadow-[0_0_30px_rgba(234,179,8,0.3)]">HALL OF FAME</h2>
            <p className="text-zinc-400 font-black uppercase tracking-[0.4em] text-xs md:text-sm">מורשת אליפויות לוזון</p>
          </div>
          <div className="bg-zinc-900/80 backdrop-blur-2xl rounded-[40px] border border-yellow-500/20 p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] pointer-events-none"></div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-10 text-center relative z-10 flex items-center justify-center gap-3"><Crown className="w-6 h-6 text-yellow-500" /> טבלת המעוטרות בכל הזמנים</h3>
            <div className="flex flex-wrap justify-center items-end gap-4 md:gap-8 relative z-10">
              {sortedAllTimeStats.map((team, idx) => {
                let borderClass = 'border-white/5'; let bgClass = 'bg-zinc-950/80'; let badge = null; let scaleClass = 'scale-100'; let nameClass = 'text-white';
                if (idx === 0) { borderClass = 'border-yellow-400 shadow-[0_10px_40px_rgba(250,204,21,0.2)]'; bgClass = 'bg-gradient-to-b from-yellow-900/40 to-black'; badge = '🥇'; scaleClass = 'scale-110 z-20 md:mx-6 mb-4'; nameClass = 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600'; } 
                else if (idx === 1) { borderClass = 'border-slate-400 shadow-[0_10px_30px_rgba(148,163,184,0.1)]'; bgClass = 'bg-gradient-to-b from-slate-800/50 to-black'; badge = '🥈'; scaleClass = 'scale-105 z-10 md:mx-2 mb-2'; nameClass = 'text-slate-200'; } 
                else if (idx === 2) { borderClass = 'border-amber-700 shadow-[0_10px_30px_rgba(180,83,9,0.1)]'; bgClass = 'bg-gradient-to-b from-amber-950/40 to-black'; badge = '🥉'; scaleClass = 'scale-105 z-10 md:mx-2 mb-2'; nameClass = 'text-amber-500'; }
                return (
                  <div key={idx} className={`${bgClass} border-2 ${borderClass} ${scaleClass} px-6 py-6 rounded-[32px] flex flex-col items-center min-w-[140px] md:min-w-[160px] transition-transform relative group hover:-translate-y-2 duration-300`}>
                    {badge && <div className="absolute -top-6 text-4xl drop-shadow-2xl group-hover:scale-110 transition-transform">{badge}</div>}
                    <span className={`font-black text-xl md:text-2xl mb-4 mt-2 ${nameClass}`}>{team.name}</span>
                    <div className="flex gap-4 w-full justify-center mt-2">
                      <div className="flex flex-col items-center bg-black/40 px-3 py-2 rounded-xl border border-white/5 w-16" title="אליפויות">
                         <span className="text-yellow-500 text-xl mb-1 drop-shadow-md"><Trophy className="w-5 h-5 fill-current"/></span>
                         <span className="text-white font-black text-lg">{team.titles}</span>
                      </div>
                      <div className="flex flex-col items-center bg-black/40 px-3 py-2 rounded-xl border border-white/5 w-16" title="גביעים">
                         <span className="text-slate-400 text-xl mb-1 drop-shadow-md"><Medal className="w-5 h-5"/></span>
                         <span className="text-white font-black text-lg">{team.cups}</span>
                      </div>
                      {team.doubles > 0 && (
                          <div className="flex flex-col items-center bg-purple-900/40 px-3 py-2 rounded-xl border border-purple-500/30 w-16" title="דאבלים">
                             <span className="text-purple-400 text-xl mb-1 drop-shadow-md">🌟</span>
                             <span className="text-white font-black text-lg">{team.doubles}</span>
                          </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'records' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 pt-4">
          <div className="text-center mb-12"><h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tight drop-shadow-lg flex items-center justify-center gap-3">ספרי ההיסטוריה <Flame className="w-10 h-10 text-red-500 fill-current" /></h2><p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-3">שיאים, תבוסות, והיריבויות המדממות של הליגה</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-zinc-900/80 backdrop-blur-xl rounded-[40px] border border-green-500/20 p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute -top-10 -right-10 text-9xl opacity-5 group-hover:opacity-10 transition-opacity rotate-12">🥊</div>
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-4xl mb-6 border border-green-500/20 mx-auto shadow-inner">🥊</div>
              <h4 className="text-center font-black text-xl text-green-400 mb-2 uppercase tracking-widest">מלכי התבוסות</h4>
              <p className="text-center text-[11px] text-zinc-400 mb-8 font-bold">הקבוצות שניצחו ב-20 הפרש ומעלה</p>
              <div className="space-y-3">
                {spicyRecords.blowoutWins.length === 0 ? (<div className="text-center text-zinc-500 text-sm py-4">אין נתונים עדיין</div>) : (spicyRecords.blowoutWins.map((record, i) => (
                    <div key={i} className={`flex justify-between items-center bg-zinc-950/80 p-4 rounded-2xl border transition-colors ${i===0 ? 'border-green-500/50 shadow-lg' : 'border-white/5 hover:border-white/10'}`}>
                      <div className="flex items-center gap-3"><span className={`font-black text-sm w-5 text-center ${i===0 ? 'text-green-500' : 'text-zinc-600'}`}>#{i+1}</span><span className="font-black text-white text-lg">{record.team}</span></div>
                      <div className="flex items-baseline gap-1"><span className="text-green-400 font-black text-2xl leading-none">{record.count}</span><span className="text-[9px] text-zinc-500 font-bold">פעמים</span></div>
                    </div>
                )))}
              </div>
            </div>

            <div className="bg-zinc-900/80 backdrop-blur-xl rounded-[40px] border border-red-500/20 p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300 lg:translate-y-4">
              <div className="absolute -top-10 -right-10 text-9xl opacity-5 group-hover:opacity-10 transition-opacity -rotate-12">🤕</div>
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-4xl mb-6 border border-red-500/20 mx-auto shadow-inner">🤕</div>
              <h4 className="text-center font-black text-xl text-red-400 mb-2 uppercase tracking-widest">שקי החבטות</h4>
              <p className="text-center text-[11px] text-zinc-400 mb-8 font-bold">הקבוצות שהפסידו ב-20 הפרש ומעלה</p>
              <div className="space-y-3">
                {spicyRecords.blowoutLosses.length === 0 ? (<div className="text-center text-zinc-500 text-sm py-4">אין נתונים עדיין</div>) : (spicyRecords.blowoutLosses.map((record, i) => (
                    <div key={i} className={`flex justify-between items-center bg-zinc-950/80 p-4 rounded-2xl border transition-colors ${i===0 ? 'border-red-500/50 shadow-lg' : 'border-white/5 hover:border-white/10'}`}>
                      <div className="flex items-center gap-3"><span className={`font-black text-sm w-5 text-center ${i===0 ? 'text-red-500' : 'text-zinc-600'}`}>#{i+1}</span><span className="font-black text-white text-lg">{record.team}</span></div>
                      <div className="flex items-baseline gap-1"><span className="text-red-400 font-black text-2xl leading-none">{record.count}</span><span className="text-[9px] text-zinc-500 font-bold">פעמים</span></div>
                    </div>
                )))}
              </div>
            </div>

            <div className="bg-zinc-900/80 backdrop-blur-xl rounded-[40px] border border-blue-500/20 p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:-translate-y-2 transition-transform duration-300 lg:translate-y-8">
              <div className="absolute -top-10 -right-10 text-9xl opacity-5 group-hover:opacity-10 transition-opacity">🐺</div>
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-4xl mb-6 border border-blue-500/20 mx-auto shadow-inner">🐺</div>
              <h4 className="text-center font-black text-xl text-blue-400 mb-2 uppercase tracking-widest">הכבשה השחורה</h4>
              <p className="text-center text-[11px] text-zinc-400 mb-8 font-bold">השפלות ב-20 הפרש בקרבות ראש בראש</p>
              <div className="space-y-4">
                {spicyRecords.biggestVictims.length === 0 ? (<div className="text-center text-zinc-500 text-sm py-4">אין נתונים עדיין</div>) : (spicyRecords.biggestVictims.map((record, i) => (
                    <div key={i} className={`flex flex-col bg-zinc-950/80 p-5 rounded-3xl border transition-colors ${i===0 ? 'border-blue-500/50 shadow-lg' : 'border-white/5 hover:border-white/10'}`}>
                      <div className="flex justify-between items-center mb-3"><span className="font-black text-white text-xl">{record.predator}</span><span className="text-blue-400 font-black text-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-xl shadow-inner tracking-widest">X{record.count}</span></div>
                      <div className="text-zinc-500 text-xs font-bold bg-zinc-900 px-3 py-2 rounded-xl inline-block self-start">שחטו את <span className="text-zinc-300 font-black">{record.prey}</span></div>
                    </div>
                )))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === חלון פופ-אפ: תעודת זהות / פרופיל קבוצה === */}
      {selectedTeamProfile && (() => {
        let teamTitles = 0;
        let teamRunnerUps = 0;
        let teamCups = 0;
        let teamDoubles = 0;
        const histName = getHistoricalName(selectedTeamProfile.teamName);
        
        historySeasons.forEach(s => {
            const cName = getHistoricalName(s.champ || '');
            const cupName = getHistoricalName(s.cup || '');
            const rName = getHistoricalName(s.runnerUp || '');

            if (cName === histName) teamTitles++;
            if (rName === histName) teamRunnerUps++;
            if (cupName === histName) teamCups++;
            if (cName === histName && cupName === histName) teamDoubles++;
        });

        const gd = (selectedTeamProfile.gf || 0) - (selectedTeamProfile.ga || 0);

        return (
          <div className="fixed inset-0 z-[5000] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedTeamProfile(null)}>
             <div className="bg-[#0f172a] border border-slate-700 rounded-t-[32px] md:rounded-[32px] w-full max-w-sm h-[85vh] md:h-auto md:max-h-[90vh] shadow-2xl flex flex-col relative overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95" onClick={e => e.stopPropagation()}>
                
                {/* Profile Header */}
                <div className="bg-gradient-to-br from-indigo-900/80 to-blue-900/40 p-8 border-b border-indigo-500/30 text-center relative shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-[50px] pointer-events-none rounded-full"></div>
                  
                  {/* התיקון למובייל - X צף גדול ובולט! */}
                  <button onClick={() => setSelectedTeamProfile(null)} className="absolute top-4 right-4 z-[9999] w-10 h-10 bg-slate-800 flex items-center justify-center rounded-full border border-slate-600 text-slate-300 hover:text-white shadow-2xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  
                  <div className="w-20 h-20 bg-slate-950 border-4 border-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(99,102,241,0.4)] relative z-10 mt-4">
                      <span className="text-3xl">🛡️</span>
                      {/* מדד העוצמה מרחף על הסמל */}
                      <div className="absolute -bottom-2 -right-2 bg-indigo-500 text-white text-xs font-black px-2 py-1 rounded-lg border-2 border-slate-900 shadow-lg flex flex-col items-center leading-none">
                         <span className="text-[8px] uppercase tracking-widest opacity-80">OVR</span>
                         <span>{selectedTeamProfile.powerScore || 50}</span>
                      </div>
                  </div>
                  
                  <h3 className="text-2xl font-black text-white relative z-10 drop-shadow-md">{selectedTeamProfile.teamName}</h3>
                  <p className="text-indigo-300 font-bold text-sm mt-1 uppercase tracking-widest relative z-10">{selectedTeamProfile.manager}</p>
                </div>

                {/* תוכן נגלל - הוספתי פה pb-24 כדי לתת מרווח תחתון ענק במובייל */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-6">
                   {/* Trophy Cabinet */}
                   <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 shadow-inner">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-500" /> ארון תארים היסטורי
                      </h4>
                      <div className="flex justify-center gap-4">
                         <div className="flex flex-col items-center">
                            <span className="text-2xl drop-shadow-md mb-1 opacity-90">🥇</span>
                            <span className="text-white font-black text-lg">{teamTitles}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-bold">אליפויות</span>
                         </div>
                         <div className="w-px bg-slate-800"></div>
                         <div className="flex flex-col items-center">
                            <span className="text-2xl drop-shadow-md mb-1 opacity-90">🥈</span>
                            <span className="text-slate-300 font-black text-lg">{teamRunnerUps}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-bold">סגנויות</span>
                         </div>
                         <div className="w-px bg-slate-800"></div>
                         <div className="flex flex-col items-center">
                            <span className="text-2xl drop-shadow-md mb-1 opacity-90">🏆</span>
                            <span className="text-amber-500 font-black text-lg">{teamCups}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-bold">גביעים</span>
                         </div>
                         {teamDoubles > 0 && (
                             <>
                             <div className="w-px bg-slate-800"></div>
                             <div className="flex flex-col items-center">
                                <span className="text-2xl drop-shadow-md mb-1 opacity-90">🌟</span>
                                <span className="text-purple-400 font-black text-lg">{teamDoubles}</span>
                                <span className="text-[9px] text-slate-500 uppercase font-bold">דאבלים</span>
                             </div>
                             </>
                         )}
                      </div>
                   </div>

                   {/* Current Season Stats */}
                   <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50">
                         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 text-center">נקודות</span>
                         <span className="text-2xl font-black text-blue-400 leading-none">{selectedTeamProfile.points || 0}</span>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50 text-center">
                         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">הפרש שערים</span>
                         <span className={`text-xl font-black leading-none ${gd > 0 ? 'text-green-400' : gd < 0 ? 'text-red-400' : 'text-slate-300'}`} dir="ltr">
                            {gd > 0 ? `+${gd}` : gd}
                         </span>
                      </div>
                      <div className="bg-slate-800/50 rounded-xl p-3 flex flex-col items-center justify-center border border-slate-700/50 text-center">
                         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">מאזן (נ-ת-ה)</span>
                         <span className="text-sm font-black text-slate-200 leading-none mt-1 whitespace-nowrap">
                            <span className="text-green-400">{selectedTeamProfile.wins || 0}</span>-<span className="text-yellow-500">{selectedTeamProfile.draws || 0}</span>-<span className="text-red-400">{selectedTeamProfile.losses || 0}</span>
                         </span>
                      </div>
                   </div>

                   {/* Recent Form */}
                   <div className="mb-8">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">מומנטום נוכחי</h4>
                      <div className="flex gap-1.5 w-full">
                          {(!selectedTeamProfile.recentForm || selectedTeamProfile.recentForm.length === 0) ? (
                             <span className="text-xs text-slate-500 font-bold">אין משחקים העונה.</span>
                          ) : (
                             selectedTeamProfile.recentForm.slice(-8).map((char: string, i: number) => (
                                <div key={i} className={`flex-1 aspect-square rounded-lg flex items-center justify-center text-xs font-black shadow-sm ${char==='W'?'bg-green-500/20 text-green-400 border border-green-500/30':char==='L'?'bg-red-500/20 text-red-400 border border-red-500/30':'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'}`}>
                                    {char}
                                </div>
                             ))
                          )}
                      </div>
                   </div>

                </div>
             </div>
          </div>
        );
      })()}

    </div>
  );
};

export default AdminLeagueManager;