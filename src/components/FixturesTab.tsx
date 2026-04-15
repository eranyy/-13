import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CalendarDays, Flame, CheckCircle2, Clock, ChevronRight, ChevronLeft, MapPin, Tv } from 'lucide-react';

const TEAM_NAMES: Record<string, string> = { tumali: 'תומאלי', tampa: 'טמפה', pichichi: "פיצ'יצ'י", hamsili: 'חמסילי', harale: 'חראלה', holonia: 'חולוניה' };

// הוספנו את isAdmin ל-props כדי לדעת אם להציג את עורך ההיסטוריה
interface FixturesTabProps {
  currentRound: number;
  isAdmin?: boolean; 
}

const FixturesTab: React.FC<FixturesTabProps> = ({ currentRound, isAdmin }) => {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // סטייט עבור עריכת תוצאות עבר (מכונת הזמן)
  const [editModal, setEditModal] = useState<{ roundId: number, matchIdx: number, hId: string, aId: string, hs: number, as: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // המערכת תזכור באיזה מחזור אנחנו צופים עכשיו (ברירת מחדל: המחזור הנוכחי של הליגה)
  const [viewedRound, setViewedRound] = useState<number>(currentRound || 24);

  useEffect(() => {
    // מסנכרן את המחזור הנצפה אם המחזור הכללי של הליגה משתנה
    if (currentRound) setViewedRound(currentRound);
  }, [currentRound]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'leagueData', 'fixtures'), doc => {
      if(doc.exists()) setRounds(doc.data().rounds || []);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // הפונקציה ששומרת את השינוי ההיסטורי
  const handleSavePastMatch = async () => {
    if (!editModal) return;
    setIsSaving(true);
    try {
      const updatedRounds = rounds.map(r => {
        if (r.round === editModal.roundId) {
          const newMatches = [...r.matches];
          newMatches[editModal.matchIdx] = {
            ...newMatches[editModal.matchIdx],
            hs: editModal.hs,
            as: editModal.as
          };
          return { ...r, matches: newMatches };
        }
        return r;
      });

      await updateDoc(doc(db, 'leagueData', 'fixtures'), { rounds: updatedRounds });
      setEditModal(null);
    } catch (error) {
      console.error("Error saving past match:", error);
      alert('שגיאה בשמירת משחק ההשלמה.');
    }
    setIsSaving(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center pt-32 h-full gap-4 opacity-50">
      <div className="w-10 h-10 border-[3px] border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      <div className="font-black text-blue-500 tracking-widest uppercase text-sm">Loading Calendar...</div>
    </div>
  );

  if (rounds.length === 0) return (
    <div className="text-center p-12 bg-zinc-900/60 backdrop-blur-xl rounded-[40px] border border-white/5 max-w-lg mx-auto mt-10">
      <span className="text-5xl mb-4 block opacity-50">📅</span>
      <h2 className="text-2xl font-black text-white mb-2">לוח המשחקים ריק</h2>
      <p className="text-zinc-500 font-bold text-sm">אין נתונים בארכיון. גש להגדרות ולחץ על "טען ארכיון".</p>
    </div>
  );

  // שולף את הנתונים רק של המחזור הספציפי שאנחנו צופים בו כרגע
  const currentViewedData = rounds.find(r => r.round === viewedRound);
  const isCurrentLive = viewedRound === currentRound;

  return (
    <div className="max-w-4xl mx-auto pb-32 font-sans animate-in fade-in slide-in-from-bottom-4 duration-500" dir="rtl">
      
      {/* Header Premium Style */}
      <div className="bg-zinc-900/60 backdrop-blur-xl p-6 md:p-8 rounded-[40px] border border-white/5 shadow-2xl mb-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <CalendarDays className="w-8 h-8 text-blue-500" />
          <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter drop-shadow-md">
            Match <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Calendar</span>
          </h2>
        </div>
        <p className="text-xs text-zinc-400 font-bold uppercase tracking-[0.2em] mb-8 relative z-10">ארכיון ולוח משחקים מלא</p>
        
        {/* Round Navigator - נווט המחזורים החדש */}
        <div className="flex items-center justify-between w-full max-w-sm bg-zinc-950/80 p-2 rounded-[24px] border border-zinc-800 shadow-inner relative z-10">
          
          {/* כפתור למחזור קודם (חץ ימינה בגלל שזה RTL) */}
          <button 
            onClick={() => setViewedRound(prev => Math.max(1, prev - 1))}
            disabled={viewedRound <= 1}
            className="w-12 h-12 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-[16px] transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center justify-center">
             <div className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-0.5">מחזור</div>
             <div className="text-3xl font-black text-white tabular-nums leading-none">{viewedRound}</div>
          </div>

          {/* כפתור למחזור הבא (חץ שמאלה בגלל שזה RTL) */}
          <button 
            onClick={() => setViewedRound(prev => Math.min(36, prev + 1))}
            disabled={viewedRound >= 36}
            className="w-12 h-12 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-[16px] transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>

        {/* חיווי סטטוס המחזור הנצפה */}
        <div className="mt-6 flex justify-center relative z-10">
           {isCurrentLive && <span className="bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.2)]"><Flame className="w-4 h-4 text-green-500 animate-pulse"/> משוחק כעת</span>}
           {currentViewedData?.isPlayed && !isCurrentLive && <span className="bg-zinc-800/80 border border-zinc-700 text-zinc-400 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> הושלם</span>}
           {!currentViewedData?.isPlayed && !isCurrentLive && <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"><Clock className="w-4 h-4"/> טרם שוחק</span>}
        </div>
      </div>

      {/* Fixtures List */}
      {!currentViewedData || currentViewedData.matches.length === 0 ? (
         <div className="text-center py-16 bg-zinc-900/30 rounded-[32px] border border-dashed border-zinc-800">
           <span className="text-4xl block mb-4 opacity-40">🏟️</span>
           <h3 className="text-xl font-black text-zinc-500">אין משחקים במחזור זה</h3>
         </div>
      ) : (
        <div className="space-y-6">
          {currentViewedData.matches.map((m: any, idx: number) => {
            const hName = TEAM_NAMES[m.h] || m.h;
            const aName = TEAM_NAMES[m.a] || m.a;
            
            let hTextClass = "text-white";
            let aTextClass = "text-white";
            
            if (currentViewedData.isPlayed) {
              if (m.hs > m.as) {
                hTextClass = "text-white"; aTextClass = "text-zinc-500";
              } else if (m.as > m.hs) {
                hTextClass = "text-zinc-500"; aTextClass = "text-white";
              } else {
                hTextClass = "text-zinc-300"; aTextClass = "text-zinc-300";
              }
            }

            return (
              <div key={idx} className={`flex flex-col rounded-[24px] overflow-hidden transition-colors border shadow-lg relative group ${currentViewedData.isPlayed ? 'bg-zinc-950/80 border-zinc-800/80' : isCurrentLive ? 'bg-zinc-900 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]' : 'bg-zinc-900/40 border-zinc-800'}`}>
                
                {/* כפתור עריכת מכונת הזמן (לאדמינים בלבד) */}
                {isAdmin && currentViewedData.isPlayed && (
                  <button 
                    onClick={() => setEditModal({ roundId: currentViewedData.round, matchIdx: idx, hId: m.h, aId: m.a, hs: m.hs ?? 0, as: m.as ?? 0 })}
                    className="absolute top-3 right-3 w-8 h-8 bg-blue-500/10 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-20 shadow-md"
                    title="ערוך תוצאת עבר (ויזואלי בלבד)"
                  >
                    ✏️
                  </button>
                )}

                {/* Main Match Row */}
                <div className="flex items-center justify-between p-5 md:p-6">
                  {/* Home Team */}
                  <div className="flex-1 text-right flex flex-col justify-center">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 md:hidden">בית</span>
                    <span className={`font-black text-lg md:text-2xl truncate ${hTextClass}`}>{hName}</span>
                  </div>
                  
                  {/* Score / VS Area */}
                  <div className="px-4 md:px-8 shrink-0 flex justify-center">
                    {currentViewedData.isPlayed || (isCurrentLive && m.hs !== undefined) ? (
                      <div className="bg-black px-4 md:px-6 py-2 md:py-3 rounded-[16px] border border-zinc-800 shadow-inner flex items-center gap-3 md:gap-4 relative">
                        <span className={`font-black text-2xl md:text-3xl tabular-nums tracking-tighter ${m.hs > m.as ? 'text-green-400' : 'text-zinc-300'}`}>{m.hs ?? 0}</span>
                        <span className="text-zinc-600 font-black text-xl md:text-2xl pb-1">:</span>
                        <span className={`font-black text-2xl md:text-3xl tabular-nums tracking-tighter ${m.as > m.hs ? 'text-green-400' : 'text-zinc-300'}`}>{m.as ?? 0}</span>
                      </div>
                    ) : (
                      <div className="bg-zinc-950 border border-zinc-800 px-5 py-3 rounded-2xl shadow-inner">
                        <span className="text-zinc-500 font-black text-sm md:text-base tracking-widest">VS</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Away Team */}
                  <div className="flex-1 text-left flex flex-col justify-center">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 md:hidden">חוץ</span>
                    <span className={`font-black text-lg md:text-2xl truncate ${aTextClass}`}>{aName}</span>
                  </div>
                </div>

                {/* Match Details Bar (TV, Time, Stadium) */}
                <div className="bg-black/40 border-t border-zinc-800/50 p-3 md:p-4 flex flex-wrap items-center justify-center gap-4 md:gap-10 text-[11px] md:text-xs font-bold text-zinc-400">
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{m.stadium || 'אצטדיון טרם נקבע'}</span>
                  </div>
                  
                  <div className="hidden md:block w-1 h-1 bg-zinc-700 rounded-full"></div>
                  
                  <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span dir="ltr" className="text-blue-100">{m.time || 'TBD'}</span>
                  </div>

                  <div className="hidden md:block w-1 h-1 bg-zinc-700 rounded-full"></div>

                  <div className="flex items-center gap-2">
                    <Tv className={`w-3.5 h-3.5 ${m.tvChannel ? 'text-red-400' : 'text-zinc-500'}`} />
                    <span className={m.tvChannel ? 'text-zinc-200' : ''}>{m.tvChannel || 'שידור טרם נקבע'}</span>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* חלון מודאל "מכונת הזמן" */}
      {editModal && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border border-blue-500/50 p-8 rounded-[40px] w-full max-w-sm flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.15)] relative">
            <button onClick={() => setEditModal(null)} className="absolute top-6 left-6 text-slate-500 hover:text-white font-black text-xl">✕</button>
            <h3 className="text-2xl font-black text-white text-center mb-2 flex items-center justify-center gap-2"><span>⏱️</span> עריכת משחק עבר</h3>
            <p className="text-[10px] text-blue-400 font-bold text-center mb-8 bg-blue-900/20 py-2 px-3 rounded-lg border border-blue-500/30">
              העדכון פה ישנה את הלוח ויזואלית בלבד.<br/>את הניקוד לטבלה הכללית אל תשכח למשוך מההגדרות!
            </p>

            <div className="flex items-center justify-center gap-4 mb-8 bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
              <div className="flex flex-col items-center gap-3">
                <div className="text-slate-400 text-xs font-black uppercase tracking-widest text-center">{TEAM_NAMES[editModal.hId] || editModal.hId}</div>
                <input 
                  type="number" 
                  value={editModal.hs} 
                  onChange={e => setEditModal({...editModal, hs: Number(e.target.value)})} 
                  className="w-16 h-20 bg-slate-900 rounded-2xl text-center text-4xl font-black text-white border border-blue-500/30 focus:border-blue-500 outline-none transition-colors" 
                />
              </div>
              <span className="text-4xl text-slate-700 font-black mt-6">:</span>
              <div className="flex flex-col items-center gap-3">
                <div className="text-slate-400 text-xs font-black uppercase tracking-widest text-center">{TEAM_NAMES[editModal.aId] || editModal.aId}</div>
                <input 
                  type="number" 
                  value={editModal.as} 
                  onChange={e => setEditModal({...editModal, as: Number(e.target.value)})} 
                  className="w-16 h-20 bg-slate-900 rounded-2xl text-center text-4xl font-black text-white border border-blue-500/30 focus:border-blue-500 outline-none transition-colors" 
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleSavePastMatch} disabled={isSaving} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all text-lg active:scale-95 flex items-center justify-center gap-2">
                {isSaving ? 'מעדכן היסטוריה...' : 'שמור תוצאת עבר'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FixturesTab;