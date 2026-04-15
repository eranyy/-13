export enum UserRole {
  USER = 'USER',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
  MODERATOR = 'MODERATOR',
  ARENA_MANAGER = 'ARENA_MANAGER'
}

export interface Player {
  id: string;
  name: string;
  team: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  points: number;
  breakdown: PointsAction[];
  events?: string[];
  pointsAtSub?: boolean;
  isStarting?: boolean;
  positionOnPitch?: string | null;
}

export interface PointsAction {
  action: string;
  pts: number;
}

export interface Team {
  id: string;
  name?: string;
  teamName: string;
  manager: string;
  email: string;
  assistantEmail?: string;
  assistantPassword?: string;
  allowedEmails?: string[];
  password?: string;
  role: UserRole;
  points: number;
  squad: Player[];
  players?: Player[];
  lineup: Player[];
  published_lineup?: Player[];
  published_subs_out?: Player[];
  transferHistory?: any[];
  transfers?: any[];
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  teamName: string;
  manager: string;
  name?: string;
  passwordHash?: string;
  allowedEmails?: string[];
  teamId?: string;
}

export interface LockedLineup {
  round: number;
  teamId: string;
  lineup: Player[];
}

export interface MatchReport {
  id: string;
  round: number;
  timestamp: any;
  homeTeam: { id: string; name: string; score: number; lineup: Player[]; subsOut: Player[] };
  awayTeam: { id: string; name: string; score: number; lineup: Player[]; subsOut: Player[] };
}

export interface H2HMatch {
  id: string;
  homeId: string;
  homeName: string;
  homeScore: number;
  awayId: string;
  awayName: string;
  awayScore: number;
  status: 'not_started' | 'live' | 'finished';
}
