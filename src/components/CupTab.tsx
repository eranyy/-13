import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { Trophy, Swords, CalendarDays, Crown, Star, Flame } from 'lucide-react';

const TEAM_NAMES: Record<string, string> = { 
  tumali: 'תומאלי', 
  tampa: 'טמפה', 
  pichichi: "פיצ'יצ'י", 
  hamsili: 'חמסילי', 
  harale: 'חראלה', 
  holonia: 'חולוניה' 
};

// נתוני בסיס לעונה 13 כדי שהתצוגה תיראה מושלמת מיד גם אם לא הגרלת
const DEFAULT_LANNISTER = ['tumali', 'hamsili', 'tampa'];
const DEFAULT_STARK = ['harale', 'holonia', 'pichichi'];

const DEFAULT_STANDINGS: Record<string, number> = {
    tumali: 151, hamsili: 128, tampa: 107,
    harale: 141, holonia: 127, pichichi: 109
};

const CupTab: React.FC = () => {
  const [cupSettings, setCupSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "leagueData", "cup_settings"), (docSnap) => {
      if (docSnap.exists()) {
        setCupSettings(docSnap.data());
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

  const lannisterTeams = cupSettings?.groups?.lannister || DEFAULT_LANNISTER;
  const starkTeams = cupSettings?.groups?.stark || DEFAULT_STARK;
  const standings = cupSettings?.groupStandings || DEFAULT_STANDINGS;
  const stage = cupSettings?.stage || 'groups'; 
  const activeTeams = cupSettings?.activeTeams || [];

  if (lannisterTeams.length === 0 && starkTeams.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center pt-32 h-full gap-4 opacity-50 text-center" dir="rtl">
            <Trophy className="w-20 h-20 text-yellow-500 opacity-50 mb-4" />
            <h2 className="font-black text-white text-3xl">הגביע טרם הוגרל העונה</h2>
            <p className="text-slate-400 font-bold">הגרלת הבתים תתבצע על ידי מנהל הליגה בהמשך.</p>
        </div>
      );
  }

  const getSortedGroup = (teams: string[]) => {
      return [...teams].sort((a, b) => (standings[b] || 0) - (standings[a] || 0));
  };

  const sortedLannister = getSortedGroup(lannisterTeams);
  const sortedStark = getSortedGroup(starkTeams);

  const semi1_home = sortedLannister[0]; 
  const semi1_away = sortedStark[1];     

  const semi2_home = sortedStark[0];     
  const semi2_away = sortedLannister[1]; 

  let final_team1 = '';
  let final_team2 = '';

  if (stage === 'final') {
      if (activeTeams.includes(semi1_home)) final_team1 = semi1_home;
      else if (activeTeams.includes(semi1_away)) final_team1 = semi1_away;

      if (activeTeams.includes(semi2_home)) final_team2 = semi2_home;
      else if (activeTeams.includes(semi2_away)) final_team2 = semi2_away;
  }

  const renderSemiFinalTeam = (teamId: string, isHome: boolean) => {
      if (!teamId) return null;
      
      const isFinalStage = stage === 'final';
      const isWinner = isFinalStage && activeTeams.includes(teamId);
      const isLoser = isFinalStage && !activeTeams.includes(teamId);

      if (isWinner) {
          return (
              <div className="flex items-center justify-between bg-green-900/20 p-3 rounded-xl border border-green-500/30 transition-all">
                  <span className="font-black text-green-400">{TEAM_NAMES[teamId] || teamId}</span>
                  <span className="text-xs font-black text-green-400 px-2 py-0.5 bg-green-500/10 rounded border border-green-500/20">עלה לגמר</span>
              </div>
          );
      } else if (isLoser) {
          return (
              <div className="flex items-center justify-between bg-slate-800/30 p-3 rounded-xl border border-transparent transition-all grayscale opacity-70">
                  <span className="font-black text-slate-400 line-through decoration-slate-600">{TEAM_NAMES[teamId] || teamId}</span>
                  <span className="text-xs font-bold text-slate-600 px-2 py-0.5 bg-slate-900 rounded">הודח</span>
              </div>
          );
      } else {
          return (
              <div className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700 transition-all">
                  <span className="font-black text-white">{TEAM_NAMES[teamId] || teamId}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded">{isHome ? 'יתרון ביתיות' : 'חוץ'}</span>
              </div>
          );
      }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700" dir="rtl">
      
      {/* 🏆 Header 🏆 */}
      <div className="text-center space-y-4 pt-6">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-yellow-400/20 to-yellow-600/5 rounded-full border border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.2)] mb-2 relative">
          <Trophy className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]" />
          {stage === 'final' && <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-400 rounded-full animate-ping opacity-75"></div>}
        </div>
        <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-amber-600 italic tracking-tighter drop-shadow-2xl pb-2">גביע המדינה</h2>
        <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs md:text-sm flex items-center justify-center gap-2">
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
            פנטזי לוזון
            <Star className="w-3 h-3 text-yellow-500 fill-current" />
        </p>
      </div>

      {/* 📊 שלב הבתים 📊 */}
      <div className="space-y-6">
          <div className="flex items-center justify-center gap-3">
              <div className="h-px bg-gradient-to-r from-transparent to-slate-700 flex-1 max-w-[100px]"></div>
              <h3 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">שלב הבתים <CalendarDays className="w-5 h-5 text-slate-500"/></h3>
              <div className="h-px bg-gradient-to-l from-transparent to-slate-700 flex-1 max-w-[100px]"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              
              {/* בית לאניסטר */}
              <div className={`bg-gradient-to-b from-[#2a0808] to-slate-900 rounded-[32px] border shadow-2xl overflow-hidden relative group transition-all duration-500 ${stage === 'groups' ? 'border-red-500/50 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : 'border-red-900/30'}`}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-yellow-500"></div>
                  <div className="p-6 border-b border-red-950/50 flex justify-between items-center bg-black/20">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-950 flex items-center justify-center border border-red-800 shadow-inner text-xl">🦁</div>
                          <h4 className="text-xl font-black text-red-400 tracking-wide">בית לאניסטר</h4>
                      </div>
                  </div>
                  <div className="p-2">
                      {sortedLannister.map((tId, idx) => (
                          <div key={tId} className={`flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${idx < 2 ? 'bg-slate-800/40 border border-slate-700/50' : 'opacity-60 grayscale bg-transparent'}`}>
                              <div className="flex items-center gap-4">
                                  <span className={`text-lg font-black w-6 text-center ${idx < 2 ? 'text-yellow-500' : 'text-slate-600'}`}>{idx + 1}</span>
                                  <span className="text-lg font-black text-white">{TEAM_NAMES[tId] || tId}</span>
                                  {idx < 2 && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase font-black tracking-widest border border-green-500/20">עולה לחצי</span>}
                              </div>
                              <div className="text-xl font-black text-red-400">{standings[tId] || 0} <span className="text-[10px] text-slate-500">pt</span></div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* בית סטארק */}
              <div className={`bg-gradient-to-b from-[#08122a] to-slate-900 rounded-[32px] border shadow-2xl overflow-hidden relative group transition-all duration-500 ${stage === 'groups' ? 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'border-blue-900/30'}`}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-slate-300"></div>
                  <div className="p-6 border-b border-blue-950/50 flex justify-between items-center bg-black/20">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-950 flex items-center justify-center border border-blue-800 shadow-inner text-xl">🐺</div>
                          <h4 className="text-xl font-black text-blue-400 tracking-wide">בית סטארק</h4>
                      </div>
                  </div>
                  <div className="p-2">
                      {sortedStark.map((tId, idx) => (
                          <div key={tId} className={`flex items-center justify-between p-4 rounded-2xl mb-2 transition-colors ${idx < 2 ? 'bg-slate-800/40 border border-slate-700/50' : 'opacity-60 grayscale bg-transparent'}`}>
                              <div className="flex items-center gap-4">
                                  <span className={`text-lg font-black w-6 text-center ${idx < 2 ? 'text-slate-300' : 'text-slate-600'}`}>{idx + 1}</span>
                                  <span className="text-lg font-black text-white">{TEAM_NAMES[tId] || tId}</span>
                                  {idx < 2 && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase font-black tracking-widest border border-green-500/20">עולה לחצי</span>}
                              </div>
                              <div className="text-xl font-black text-blue-400">{standings[tId] || 0} <span className="text-[10px] text-slate-500">pt</span></div>
                          </div>
                      ))}
                  </div>
              </div>

          </div>
      </div>

      {/* ⚔️ שלב הנוקאאוט (עץ הטורניר) ⚔️ */}
      {(stage === 'semi' || stage === 'final') && (
        <div className="space-y-8 pt-8 animate-in fade-in duration-700">
            <div className="flex items-center justify-center gap-3">
                <div className="h-px bg-gradient-to-r from-transparent to-slate-700 flex-1 max-w-[100px]"></div>
                <h3 className="text-2xl font-black text-white tracking-wide flex items-center gap-2">שלב הנוקאאוט <Swords className="w-5 h-5 text-slate-500"/></h3>
                <div className="h-px bg-gradient-to-l from-transparent to-slate-700 flex-1 max-w-[100px]"></div>
            </div>

            <div className="relative">
                {/* קווי חיבור (רק בדסקטופ) */}
                <div className="hidden md:block absolute top-1/2 left-[20%] right-[20%] h-[2px] bg-slate-800 -translate-y-1/2 z-0 rounded-full"></div>
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 relative z-10">
                    
                    {/* חצי גמר 1 */}
                    <div className="order-1 md:order-1 w-full md:w-[30%] bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700 shadow-xl overflow-hidden relative">
                        <div className="bg-slate-950 py-2 text-center border-b border-slate-800 flex justify-center items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">חצי גמר א'</span>
                            {stage === 'semi' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                        </div>
                        <div className="p-4 space-y-3">
                            {renderSemiFinalTeam(semi1_away, false)}
                            {renderSemiFinalTeam(semi1_home, true)}
                        </div>
                    </div>

                    {/* חצי גמר 2 (הוזז להיות שני במובייל, ושלישי בדסקטופ) */}
                    <div className="order-2 md:order-3 w-full md:w-[30%] bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700 shadow-xl overflow-hidden relative">
                        <div className="bg-slate-950 py-2 text-center border-b border-slate-800 flex justify-center items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">חצי גמר ב'</span>
                            {stage === 'semi' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                        </div>
                        <div className="p-4 space-y-3">
                            {renderSemiFinalTeam(semi2_away, false)}
                            {renderSemiFinalTeam(semi2_home, true)}
                        </div>
                    </div>

                    {/* הגמר הגדול! (הוזז להיות אחרון במובייל, ובאמצע בדסקטופ) */}
                    <div className={`order-3 md:order-2 mt-4 md:mt-0 w-full md:w-[40%] bg-gradient-to-b from-yellow-900/40 to-slate-900 backdrop-blur-xl rounded-[40px] border-2 shadow-2xl overflow-hidden relative transform md:scale-110 z-20 transition-all duration-500 ${stage === 'final' ? 'border-yellow-500/80 shadow-[0_0_50px_rgba(234,179,8,0.2)]' : 'border-slate-700 opacity-60'}`}>
                        <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${stage === 'final' ? 'from-yellow-400 via-amber-300 to-yellow-600' : 'from-slate-600 to-slate-500'}`}></div>
                        <div className="bg-black/40 py-3 text-center border-b border-yellow-900/30 flex flex-col items-center justify-center">
                            <Crown className={`w-6 h-6 mb-1 ${stage === 'final' ? 'text-yellow-500' : 'text-slate-500'}`} />
                            <span className={`text-[12px] font-black uppercase tracking-[0.2em] ${stage === 'final' ? 'text-yellow-400' : 'text-slate-500'}`}>הגמר הגדול</span>
                        </div>
                        
                        <div className="p-6 md:p-8 flex flex-col items-center justify-center gap-6">
                            {stage === 'final' && final_team1 && final_team2 ? (
                                <div className="flex items-center justify-between w-full gap-4">
                                    <div className="flex flex-col items-center gap-2 flex-1">
                                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-yellow-500/50 flex items-center justify-center text-2xl shadow-lg">👑</div>
                                        <span className="font-black text-white text-lg md:text-xl text-center">{TEAM_NAMES[final_team1] || final_team1}</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-center shrink-0">
                                        <span className="text-2xl font-black text-slate-600 italic">VS</span>
                                    </div>

                                    <div className="flex flex-col items-center gap-2 flex-1">
                                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-yellow-500/50 flex items-center justify-center text-2xl shadow-lg">🔥</div>
                                        <span className="font-black text-white text-lg md:text-xl text-center">{TEAM_NAMES[final_team2] || final_team2}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-6">
                                    <span className="text-slate-500 font-black text-xl tracking-widest">ממתין לעולות...</span>
                                </div>
                            )}
                            
                            {stage === 'final' && (
                                <div className="w-full pt-4 border-t border-white/5 flex justify-center">
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                                        <Flame className="w-4 h-4 text-yellow-500" />
                                        <span className="text-xs font-black text-yellow-400">הקרב על התואר!</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
      )}

      {/* מידע על הגביע */}
      <div className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden mt-12">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600"></div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-24 h-24 bg-yellow-500/10 rounded-3xl flex items-center justify-center text-5xl shadow-inner border border-yellow-500/20">🍽️</div>
          <div className="flex-1 text-center md:text-right">
            <h4 className="text-2xl font-black text-white mb-2 italic">חוקי הגביע והגמר</h4>
            <p className="text-slate-400 font-bold leading-relaxed text-sm">
              משלב חצי הגמר והגמר: מותר להשתמש בעד 3 שחקנים מאותה קבוצה. אין חובה להעמיד 11 שחקנים, ואין הגבלת מערך כל עוד יש שוער 1.<br/>
              במקרה של תיקו בניקוד, חוק "יתרון הביתיות" יכריע את ההתמודדות (לפי הדירוג הגבוה יותר בשלב הבתים).
            </p>
          </div>
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 text-center min-w-[140px] shadow-lg">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">הפרס למנצח</div>
            <div className="text-xl font-black text-yellow-400">ארוחה אצל לוזון</div>
            <div className="text-[10px] text-slate-600 font-bold mt-1">+ תהילת עולם</div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CupTab;