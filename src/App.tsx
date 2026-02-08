import React, { useState, useEffect, useMemo } from 'react';
import { Team, Player, User, Substitution } from './types.ts';
import { MOCK_TEAMS, VALID_FORMATIONS, LEAGUE_TABLE, ISRAELI_TEAMS } from './constants.ts';
import { generateRazColumn, getScoutingReport } from './geminiService.ts';
import { authService } from './authService.ts';

// חיבור ל-Firebase
import { db } from './firebaseConfig.ts';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

// מפתח לגיבוי מקומי ליתר ביטחון
const FINAL_LUZON_KEY = 'LUZON_DATABASE_V50_STABLE';

const getPosColor = (pos: string) => {
  switch (pos) {
    case 'GK': return 'bg-yellow-400 border-yellow-600 text-black';
    case 'DEF': return 'bg-blue-600 border-blue-800 text-white';
    case 'MID': return 'bg-emerald-600 border-emerald-800 text-white';
    case 'FWD': return 'bg-rose-600 border-rose-900 text-white';
    default: return 'bg-slate-400 border-slate-600 text-black';
  }
};

const Card: React.FC<{ title: string; children: React.ReactNode; className?: string; icon?: string; dark?: boolean; onClick?: (e: React.MouseEvent) => void }> = ({ title, children, className = "", icon, dark = false, onClick }) => (
  <div onClick={onClick} className={`${dark ? 'bg-slate-900/95 border-slate-700 text-white shadow-2xl' : 'bg-white border-gray-100 text-slate-800'} rounded-[40px] p-8 border backdrop-blur-md ${className} transition-all`}>
    <h3 className="text-2xl font-black mb-6 flex items-center gap-3 border-b border-slate-800/10 pb-3">
      {icon && <span className="text-3xl">{icon}</span>} {title}
    </h3>
    {children}
  </div>
);

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [teams, setTeams] = useState<Team[]>(MOCK_TEAMS);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'table' | 'lineup' | 'market'>('dashboard');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [razColumn, setRazColumn] = useState('טוען...');

  // Market States
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editValues, setEditValues] = useState<Substitution & { realTeam?: string } | null>(null);

  // Scouting State
  const [isScoutingLoading, setIsScoutingLoading] = useState(false);
  const [scoutingReport, setScoutingReport] = useState<{ text: string; sources: any[] } | null>(null);
  const [scoutingPlayer, setScoutingPlayer] = useState<Player | null>(null);

  // --- 1. טעינה וסנכרון מול ה-FIREBASE (זמן אמת) ---
  useEffect(() => {
    const docRef = doc(db, "league", "teamsData");
    
    // האזנה לשינויים בענן
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data().teams;
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          setTeams(cloudData);
          console.log("סנכרון ענן הושלם! ☁️");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // גיבוי מקומי בדפדפן
  useEffect(() => {
    localStorage.setItem(FINAL_LUZON_KEY, JSON.stringify(teams));
  }, [teams]);

  // Load Session
  useEffect(() => {
    const session = authService.getSession();
    if (session) {
      setLoggedInUser(session);
      const team = teams.find(t => t.teamName === session.teamName);
      if (team) setSelectedTeamId(team.id);
      else if (teams.length > 0) setSelectedTeamId(teams[0].id);
    }
  }, [teams]);

  // AI Content
  useEffect(() => {
    if (loggedInUser) generateRazColumn().then(setRazColumn);
  }, [loggedInUser]);

  const currentViewingTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams[0];
  }, [teams, selectedTeamId]);

  const isUserOwner = useMemo(() => {
    if (!loggedInUser) return false;
    return loggedInUser.isAdmin || loggedInUser.teamName === currentViewingTeam.teamName;
  }, [loggedInUser, currentViewingTeam]);

  const actualSubsPerformed = currentViewingTeam.substitutions.filter(s => !s.isFreeze).length;
  const subCount = actualSubsPerformed + (currentViewingTeam.subAdjustment || 0);
  const subLimit = currentViewingTeam.subLimit || 14;
  const subProgressPercent = Math.min((subCount / subLimit) * 100, 100);

  const counts = useMemo(() => {
    return {
      DEF: currentViewingTeam.lineup.filter(p => p.position === 'DEF').length,
      MID: currentViewingTeam.lineup.filter(p => p.position === 'MID').length,
      FWD: currentViewingTeam.lineup.filter(p => p.position === 'FWD').length,
      GK: currentViewingTeam.lineup.filter(p => p.position === 'GK').length,
      total: currentViewingTeam.line
