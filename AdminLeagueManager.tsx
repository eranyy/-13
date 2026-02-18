
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { MatchReport, PlayerSnapshot } from './types';
import { POS_COLORS } from './constants';
import { 
  collection, 
  onSnapshot, 
  doc, 
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';

interface LeagueRow {
  id: string;
  rank: number;
  name: string;
  p: number;
  pf: number;
  pa: number;
  diff: number;
  pts: number;
}

const INITIAL_DATA: LeagueRow[] = [
  { id: 'harale', rank: 1, name: 'חראלה', p: 22, pf: 955, pa: 839, diff: 116, pts: 35 },
  { id: 'tampa', rank: 2, name: 'טמפה', p: 22, pf: 896, pa: 930, diff: -34, pts: 24 },
  { id: 'holonia', rank: 3, name: 'חולוניה', p: 22, pf: 892, pa: 928, diff: -36, pts: 23 },
  { id: 'tumali', rank: 4, name: 'תומאלי', p: 22, pf: 889, pa: 871, diff: 18, pts: 22 },
  { id: 'hamsili', rank: 5, name: 'חמסילי', p: 22, pf: 1011, pa: 983, diff: 28, pts: 21 },
  { id: 'pichichi', rank: 6, name: 'פיציצי', p: 22, pf: 802, pa: 894, diff: -92, pts: 17 }
];

interface Props {
  isAdmin: boolean;
  onClose: () => void;
}

const MatchReportModal: React.FC<{ report: MatchReport, onClose: () => void }> = ({ report, onClose }) => {
  const [activeSide, setActiveSide] = useState<'home' | 'away'>('home');
  const side = activeSide === 'home' ? report.homeTeam : report.awayTeam;
  const scorers = [...report.homeTeam.lineup, ...report.homeTeam.subsOut, ...report.awayTeam.lineup, ...report.awayTeam.subsOut]
    .filter(p => p.matchGoals > 0)
    .sort((a, b) => b.matchGoals - a.matchGoals);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[11000] p-4 flex items-center justify-center animate-in fade-in zoom-in duration-300">
      <div className="bg-[#0f111a] border border-cyan-500/30 w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-[0_0_50px_rgba(34,211,238,0.2)] flex flex-col overflow-hidden">
        {/* FIFA Scoreboard Header */}
        <div className="p-8 bg-gradient-to-b from-cyan-900/20 to-transparent border-b border-white/10 relative">
          <button onClick={onClose} className="absolute top-6 left-8 text-white/30 hover:text-cyan-400 text-2xl font-black transition-all">✕</button>
          <div className="text-center">
            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.6em] mb-4">MATCHDAY {report.round} REPORT</p>
            <div className="flex items-center justify-center gap-12">
              <div className="flex-1 text-left"><h3 className="text-2xl font-black text-white italic uppercase">{report.homeTeam.name}</h3></div>
              <div className="px-10 py-4 bg-black/60 border border-cyan-500/50 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <span className="text-6xl font-black text-white tabular-nums tracking-tighter">{report.homeTeam.score} - {report.awayTeam.score}</span>
              </div>
              <div className="flex-1 text-right"><h3 className="text-2xl font-black text-white italic uppercase">{report.awayTeam.name}</h3></div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: Scorers */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Top Performers</h4>
                <div className="space-y-4">
                  {scorers.length > 0 ? scorers.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">⚽</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white">{p.name}</span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase">{p.team}</span>
                        </div>
                      </div>
                      <span className="text-cyan-400 font-black italic">x{p.matchGoals}</span>
                    </div>
                  )) : <p className="text-xs text-slate-600 italic">No goals recorded in this match.</p>}
                </div>
              </div>
            </div>

            {/* Right Col: Lineup Visual */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
                <button onClick={() => setActiveSide('home')} className={`flex-1 py-3 rounded-full font-black text-[10px] uppercase transition-all ${activeSide === 'home' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-slate-400'}`}>{report.homeTeam.name}</button>
                <button onClick={() => setActiveSide('away')} className={`flex-1 py-3 rounded-full font-black text-[10px] uppercase transition-all ${activeSide === 'away' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-slate-400'}`}>{report.awayTeam.name}</button>
              </div>

              <div className="h-[500px] relative rounded-[32px] border border-white/10 overflow-hidden" style={{ background: 'linear-gradient(to bottom, #111827, #030712)' }}>
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 40px)' }}></div>
                <div className="p-8 h-full flex flex-col justify-around">
                  {['FWD', 'MID', 'DEF', 'GK'].map(pos => (
                    <div key={pos} className="flex justify-center gap-4">
                      {side.lineup.filter(p => p.position === pos).map(p => (
                        <div key={p.id} className="flex flex-col items-center gap-1 group">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-2xl relative group-hover:border-cyan-500 transition-all">
                            {p.position === 'GK' ? '🧤' : '👕'}
                            {p.matchGoals > 0 && <span className="absolute -top-2 -right-2 bg-green-500 text-black w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black">{p.matchGoals}</span>}
                          </div>
                          <span className="text-[8px] font-black text-white/80 uppercase truncate w-14 text-center">{p.name.split(' ')[0]}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminLeagueManager: React.FC<Props> = ({ isAdmin, onClose }) => {
  const [data, setData] = useState<LeagueRow[]>(INITIAL_DATA);
  const [archive, setArchive] = useState<MatchReport[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'archive'>('table');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MatchReport | null>(null);

  useEffect(() => {
    const unsubTable = onSnapshot(collection(db, "standings_v13_fifa_final"), (snapshot) => {
      if (!snapshot.empty) {
        const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LeagueRow));
        fetched.sort((a, b) => b.pts - a.pts || b.diff - a.diff);
        setData(fetched);
      }
    });

    const unsubArchive = onSnapshot(query(collection(db, "matchday_archive"), orderBy("round", "desc")), (s) => {
      setArchive(s.docs.map(d => d.data() as MatchReport));
    });

    return () => { unsubTable(); unsubArchive(); };
  }, []);

  const handleInputChange = (id: string, field: keyof LeagueRow, value: string) => {
    const numericValue = parseInt(value) || 0;
    setData(prev => prev.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, [field]: numericValue };
        if (field === 'pf' || field === 'pa') updatedRow.diff = updatedRow.pf - updatedRow.pa;
        return updatedRow;
      }
      return row;
    }));
  };

  const saveToFirestore = async () => {
    const batch = writeBatch(db);
    data.forEach(row => batch.set(doc(db, "standings_v13_fifa_final", row.id), row));
    try {
      await batch.commit();
      setIsEditing(false);
      alert("🎮 DATA SYNCED TO THE CLOUD");
    } catch (e) { alert("❌ UPLINK FAILED"); }
  };

  return (
    <div className="p-1 sm:p-2 text-right min-h-[90vh] overflow-hidden relative" dir="rtl" style={{ background: '#0a0a0c', backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.02) 75%, transparent 75%, transparent)', backgroundSize: '40px 40px' }}>
      {selectedReport && <MatchReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />}
      
      <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-white/20 hover:text-cyan-400 transition-all p-1 text-2xl font-black">✕</button>
          <div className="flex flex-col"><h2 className="text-2xl font-black italic tracking-tight text-white uppercase leading-none">LUZON <span className="text-cyan-400">PRO 26</span></h2><p className="text-[7px] text-white/40 font-black uppercase tracking-[0.5em] mt-1">OFFICIAL STANDINGS HUB</p></div>
        </div>
        {isAdmin && activeSubTab === 'table' && (
          <button onClick={() => isEditing ? saveToFirestore() : setIsEditing(true)} className={`px-6 py-2 rounded-none font-black text-[10px] border-2 transition-all uppercase tracking-widest ${isEditing ? 'bg-green-500 text-black border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-transparent text-cyan-400 border-cyan-400/50 hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_15px_rgba(0,255,255,0.5)]'}`}>{isEditing ? 'COMMIT' : 'EDIT'}</button>
        )}
      </div>

      <div className="flex bg-white/5 border-b border-white/10 mb-2">
        <button onClick={() => setActiveSubTab('table')} className={`flex-1 py-4 font-black text-[10px] tracking-widest transition-all ${activeSubTab === 'table' ? 'bg-cyan-400 text-black' : 'text-white/40 hover:text-white'}`}>STANDINGS</button>
        <button onClick={() => setActiveSubTab('archive')} className={`flex-1 py-4 font-black text-[10px] tracking-widest transition-all ${activeSubTab === 'archive' ? 'bg-cyan-400 text-black' : 'text-white/40 hover:text-white'}`}>ARCHIVE</button>
      </div>

      {activeSubTab === 'table' ? (
        <div className="overflow-x-auto scrollbar-hide p-1">
          <table className="w-full text-right border-separate border-spacing-y-1.5">
            <thead><tr className="text-white/30 text-[8px] font-black uppercase tracking-widest"><th className="py-2 px-2 text-center w-6">#</th><th className="py-2 px-2 text-right">CLUB</th><th className="py-2 px-2 text-center w-8">P</th><th className="py-2 px-2 text-center w-8">GF</th><th className="py-2 px-2 text-center w-8">GA</th><th className="py-2 px-2 text-center w-10">GD</th><th className="py-2 px-2 text-center w-14 text-yellow-500 font-black">סה"כ</th></tr></thead>
            <tbody>{data.map((row, idx) => { const neonColor = idx === 0 ? '#4ade80' : idx === 5 ? '#f43f5e' : '#22d3ee'; return (<tr key={row.id} className="group bg-[#1e1e24] hover:bg-[#2a2a32] transition-all cursor-pointer border-r-4" style={{ borderRightColor: neonColor }}><td className="py-3 px-2 text-center font-black text-[10px] text-white/40">{idx + 1}</td><td className="py-3 px-2 text-right"><span className="font-black text-[12px] text-white uppercase italic tracking-tighter">{row.name}</span></td><td className="py-3 px-2 text-center font-black text-[10px] text-white/60 tabular-nums">{isEditing ? <input type="number" value={row.p} onChange={(e) => handleInputChange(row.id, 'p', e.target.value)} className="w-8 bg-black/40 border-none rounded-none text-center text-white"/> : row.p}</td><td className="py-3 px-2 text-center font-black text-[10px] text-white/60 tabular-nums">{isEditing ? <input type="number" value={row.pf} onChange={(e) => handleInputChange(row.id, 'pf', e.target.value)} className="w-8 bg-black/40 border-none rounded-none text-center text-white"/> : row.pf}</td><td className="py-3 px-2 text-center font-black text-[10px] text-white/60 tabular-nums">{isEditing ? <input type="number" value={row.pa} onChange={(e) => handleInputChange(row.id, 'pa', e.target.value)} className="w-8 bg-black/40 border-none rounded-none text-center text-white"/> : row.pa}</td><td className={`py-3 px-2 text-center font-black text-[10px] tabular-nums ${row.diff > 0 ? 'text-green-400' : row.diff < 0 ? 'text-rose-500' : 'text-white/20'}`}>{row.diff > 0 ? `+${row.diff}` : row.diff}</td><td className="py-3 px-2 text-center font-black text-[22px] leading-none" style={{ color: '#fbbf24', textShadow: '0 0 10px rgba(251, 191, 36, 0.4)' }}>{isEditing ? <input type="number" value={row.pts} onChange={(e) => handleInputChange(row.id, 'pts', e.target.value)} className="w-12 bg-black/60 border border-white/10 rounded-none text-center text-[#fbbf24] text-[16px]"/> : row.pts}</td></tr>); })}</tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4 max-h-[65vh] overflow-y-auto scrollbar-hide px-2">
          {archive.length === 0 ? (
            <div className="text-center py-20 opacity-20"><span className="text-4xl block mb-4">📂</span><p className="font-black uppercase text-[10px] tracking-widest">Archive Empty</p></div>
          ) : (
            archive.map((report) => (
              <div key={report.id} onClick={() => setSelectedReport(report)} className="bg-[#1e1e24] group hover:bg-[#2a2a32] p-5 rounded-3xl border border-white/5 hover:border-cyan-500/50 transition-all cursor-pointer shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[8px] font-black text-cyan-500 uppercase tracking-widest">ROUND {report.round}</span>
                  <span className="text-[8px] font-black text-white/20 uppercase">Click for Report</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex-1 text-right font-black text-white uppercase italic text-[12px] truncate">{report.homeTeam.name}</span>
                  <div className="mx-6 px-8 py-3 bg-black/60 border border-cyan-500/20 text-green-400 font-black text-2xl tracking-tighter shadow-[inset_0_0_20px_rgba(0,255,255,0.05)] rounded-xl group-hover:border-cyan-500 transition-all">
                    {report.homeTeam.score} - {report.awayTeam.score}
                  </div>
                  <span className="flex-1 text-left font-black text-white uppercase italic text-[12px] truncate">{report.awayTeam.name}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <div className="mt-4 p-4 flex justify-between items-center text-[7px] font-black text-white/20 uppercase tracking-[0.5em] bg-black/40"><span>ENGINE v2.0.0 // LIVE STATS SNAPSHOT</span><span>VERIFIED BY THE COMMISSION</span></div>
    </div>
  );
};

export default AdminLeagueManager;
