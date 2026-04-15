import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { Trophy, Swords, CalendarDays, Shield, Crown, Star, Info } from 'lucide-react';

const TEAM_NAMES: Record<string, string> = { 
  tumali: 'תומאלי', 
  tampa: 'טמפה', 
  pichichi: "פיצ'יצ'י", 
  hamsili: 'חמסילי', 
  harale: 'חראלה', 
  holonia: 'חולוניה' 
};

const CupTab: React.FC = () => {
  const [cupData, setCupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "leagueData", "cup"), (docSnap) => {
      if (docSnap.exists()) {
        setCupData(docSnap.data());
      } else {
        // Default mock data if not exists
        setCupData({
          rounds: [
            {
              name: "רבע גמר",
              matches: [
                { h: 'hamsili', a: 'harale', hScore: 0, aScore: 0, isPlayed: false, date: '15/04', time: '21:00' },
                { h: 'tampa', a: 'tumali', hScore: 0, aScore: 0, isPlayed: false, date: '15/04', time: '21:00' },
                { h: 'pichichi', a: 'holonia', hScore: 0, aScore: 0, isPlayed: false, date: '16/04', time: '21:00' },
                { h: 'admin', a: 'system', hScore: 0, aScore: 0, isPlayed: false, date: '16/04', time: '21:00' },
              ]
            },
            {
              name: "חצי גמר",
              matches: [
                { h: 'TBD', a: 'TBD', hScore: 0, aScore: 0, isPlayed: false, date: '22/04', time: '21:00' },
                { h: 'TBD', a: 'TBD', hScore: 0, aScore: 0, isPlayed: false, date: '22/04', time: '21:00' },
              ]
            },
            {
              name: "גמר",
              matches: [
                { h: 'TBD', a: 'TBD', hScore: 0, aScore: 0, isPlayed: false, date: '29/04', time: '21:00' },
              ]
            }
          ]
        });
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center pt-20 h-full gap-4 opacity-50">
        <div className="w-12 h-12 border-[4px] border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
        <div className="font-black text-yellow-500 tracking-widest uppercase">Loading Cup...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
      <div className="text-center space-y-4 pt-6">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/10 rounded-full border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.2)] mb-2">
          <Trophy className="w-10 h-10 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
        </div>
        <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter drop-shadow-xl">גביע לוזון 13</h2>
        <p className="text-yellow-500 font-black uppercase tracking-[0.3em] text-xs md:text-sm">הטורניר היוקרתי של העונה</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        {/* Connection lines (Desktop only) */}
        <div className="hidden lg:block absolute top-1/2 left-1/3 w-1/6 h-px bg-slate-800 -translate-y-1/2 z-0"></div>
        <div className="hidden lg:block absolute top-1/2 left-2/3 w-1/6 h-px bg-slate-800 -translate-y-1/2 z-0"></div>

        {cupData.rounds.map((round: any, rIdx: number) => (
          <div key={rIdx} className="space-y-6 relative z-10">
            <div className="flex items-center justify-center gap-3 bg-slate-900/80 backdrop-blur-md py-3 px-6 rounded-2xl border border-slate-800 shadow-lg">
              <Star className={`w-4 h-4 ${rIdx === 2 ? 'text-yellow-400 fill-current' : 'text-slate-500'}`} />
              <h3 className="text-lg font-black text-white tracking-wide">{round.name}</h3>
              <Star className={`w-4 h-4 ${rIdx === 2 ? 'text-yellow-400 fill-current' : 'text-slate-500'}`} />
            </div>

            <div className={`flex flex-col gap-4 ${rIdx === 1 ? 'lg:pt-24' : rIdx === 2 ? 'lg:pt-48' : ''}`}>
              {round.matches.map((match: any, mIdx: number) => (
                <div key={mIdx} className={`bg-slate-900/40 backdrop-blur-sm rounded-3xl border transition-all duration-300 overflow-hidden group ${match.isPlayed ? 'border-slate-700' : 'border-slate-800 hover:border-slate-700 shadow-xl'}`}>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3 h-3" />
                        <span>{match.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        <span>{match.time}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shadow-inner">🛡️</div>
                          <span className={`text-sm font-black truncate ${match.hScore > match.aScore ? 'text-green-400' : 'text-white'}`}>
                            {TEAM_NAMES[match.h] || match.h}
                          </span>
                        </div>
                        <span className={`text-lg font-black tabular-nums w-8 text-center ${match.hScore > match.aScore ? 'text-green-400' : 'text-slate-500'}`}>
                          {match.isPlayed ? match.hScore : '-'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shadow-inner">🛡️</div>
                          <span className={`text-sm font-black truncate ${match.aScore > match.hScore ? 'text-green-400' : 'text-white'}`}>
                            {TEAM_NAMES[match.a] || match.a}
                          </span>
                        </div>
                        <span className={`text-lg font-black tabular-nums w-8 text-center ${match.aScore > match.hScore ? 'text-green-400' : 'text-slate-500'}`}>
                          {match.isPlayed ? match.aScore : '-'}
                        </span>
                      </div>
                    </div>

                    {!match.isPlayed && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex justify-center">
                        <button className="text-[10px] font-black text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 uppercase tracking-widest">
                          <Swords className="w-3 h-3" />
                          <span>פרטי משחק</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600"></div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-24 h-24 bg-yellow-500/10 rounded-3xl flex items-center justify-center text-5xl shadow-inner border border-yellow-500/20">🏆</div>
          <div className="flex-1 text-center md:text-right">
            <h4 className="text-2xl font-black text-white mb-2 italic">הדרך אל הגביע</h4>
            <p className="text-slate-400 font-bold leading-relaxed">
              טורניר הגביע משוחק בשיטת נוקאאוט (המפסיד יוצא). 
              במקרה של שוויון בסיום הזמן החוקי, הקבוצה שסיימה במיקום גבוה יותר בטבלה באותו מחזור תעפיל לשלב הבא.
            </p>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 text-center min-w-[140px]">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">פרס למנצח</div>
            <div className="text-xl font-black text-yellow-400">ארוחה אצל לוזון</div>
            <div className="text-[10px] text-slate-600 font-bold mt-1">+ תהילת עולם</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CupTab;
