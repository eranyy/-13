
export interface User {
  id: string;
  email: string;
  passwordHash: string; 
  teamName: string;
  isAdmin: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  team: string; 
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  isFrozen?: boolean;
}

export interface Substitution {
  id: string;
  playerIn: string;
  playerOut: string;
  pos: string;
  date: string;
  isFreeze?: boolean;
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

export interface HistoricalMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string;
}

export interface Team {
  id: string;
  manager: string;
  teamName: string;
  points: number;
  squad: Player[];
  lineup: Player[];
  substitutions: Substitution[];
  subLimit: number; // Maximum substitutions allowed
  subAdjustment: number; // Manual override for substitution count
}

export type Formation = '5-3-2' | '5-4-1' | '4-5-1' | '4-4-2' | '4-3-3' | '3-5-2' | '3-4-3';
