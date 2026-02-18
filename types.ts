
export interface User {
  id: string;
  email: string;
  passwordHash: string; 
  teamName: string;
  isAdmin: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface PointsAction {
  action: string;
  pts: number;
}

export interface PlayerStats {
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCard: boolean;
  cleanSheet: boolean;
  totalPoints: number;
}

export interface Player {
  id: string;
  name: string;
  team: string; 
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  isFrozen?: boolean;
  isRedCarded?: boolean;
  pointsAtSub?: number;
  subMinute?: number;
  liveStats?: PlayerStats;
  events?: string[]; 
  points?: number; 
  breakdown?: PointsAction[];
}

export interface PlayerSnapshot extends Player {
  matchGoals: number;
  matchAssists: number;
}

export interface MatchReport {
  id: string;
  round: number;
  timestamp: any;
  homeTeam: {
    id: string;
    name: string;
    score: number;
    lineup: PlayerSnapshot[];
    subsOut: PlayerSnapshot[];
  };
  awayTeam: {
    id: string;
    name: string;
    score: number;
    lineup: PlayerSnapshot[];
    subsOut: PlayerSnapshot[];
  };
}

export interface Transfer {
  id: string; 
  targetPlayerId?: string; 
  date: string;
  out: string;
  in: string;
  pos: string;
}

export interface LockedLineup {
  teamId: string;
  teamName: string;
  players: Player[];
  lockedAt: string;
  round: number;
  formation: Formation;
}

export interface Substitution {
  id: string;
  playerOutId: string;
  playerInId: string;
  minute: number;
  round: number;
}

export interface LeagueEntry {
  rank: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface H2HMatch {
  h: string; 
  a: string; 
  hs: number; 
  as: number; 
  min?: number; 
  round?: number; 
}

export interface Team {
  id: string;
  manager: string;
  teamName: string;
  points: number;
  squad: Player[];
  lineup: Player[];
  substitutions: Substitution[];
  subLimit: number;
  subAdjustment: number;
  frozenPlayers?: string[];
  transferHistory?: Transfer[];
  published_lineup?: Player[];
  published_subs_out?: Player[];
}

export type Formation = '5-3-2' | '5-4-1' | '4-5-1' | '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3';
