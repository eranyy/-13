
import { Team, Player, LeagueEntry, Formation, Transfer } from './types';

export const VALID_FORMATIONS: Formation[] = ['5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-5-2', '3-4-3'];

export const ISRAELI_TEAMS = [
  'מכבי תל אביב', 'מכבי חיפה', 'הפועל באר שבע', 'הפועל חיפה', 'בית"ר ירושלים',
  'מכבי בני ריינה', 'הפועל ירושלים', 'מכבי פתח תקווה', 'מכבי נתניה', 'בני סכנין',
  'הפועל חדרה', 'מ.ס. אשדוד', 'הפועל טבריה', 'הפועל קריית שמונה', 'הפועל תל אביב', 'הפועל פתח תקווה'
];

export const POS_COLORS: Record<string, { bg: string, text: string }> = {
  GK: { bg: '#F59E0B', text: '#000000' }, 
  DEF: { bg: '#3B82F6', text: '#FFFFFF' }, 
  MID: { bg: '#10B981', text: '#FFFFFF' }, 
  FWD: { bg: '#EF4444', text: '#FFFFFF' }  
};

export const HAMSILI_SQUAD: Player[] = [
  { id: 'ha_1', name: "ג'ראפי", position: 'GK', team: 'הפועל חיפה' },
  { id: 'ha_2', name: "מרציאנו", position: 'GK', team: 'הפועל באר שבע' },
  { id: 'ha_3', name: "רביבו", position: 'DEF', team: 'מכבי תל אביב' },
  { id: 'ha_4', name: "צ'יקו", position: 'DEF', team: 'הפועל תל אביב' },
  { id: 'ha_5', name: "שון גולדברג", position: 'DEF', team: 'מכבי חיפה' },
  { id: 'ha_6', name: "בלוריאן", position: 'DEF', team: 'הפועל באר שבע' },
  { id: 'ha_7', name: "חילו", position: 'DEF', team: 'בני סכנין' },
  { id: 'ha_8', name: "רמירז", position: 'DEF', team: 'הפועל חיפה' },
  { id: 'ha_9', name: "גורה", position: 'MID', team: 'מכבי חיפה' },
  { id: 'ha_10', name: "מרדכי", position: 'MID', team: 'הפועל קריית שמונה' },
  { id: 'ha_11', name: "מיכה", position: 'MID', team: 'בית"ר ירושלים' },
  { id: 'ha_12', name: "דון", position: 'MID', team: 'מכבי חיפה' },
  { id: 'ha_13', name: "דן ביטון", position: 'MID', team: 'הפועל באר שבע' },
  { id: 'ha_14', name: "אצילי", position: 'MID', team: 'בית"ר ירושלים' },
  { id: 'ha_15', name: "אנדרדה", position: 'MID', team: 'מכבי תל אביב' },
  { id: 'ha_16', name: "גונסלס", position: 'FWD', team: 'בית"ר ירושלים' },
  { id: 'ha_17', name: "קליי", position: 'FWD', team: 'הפועל פתח תקווה' },
  { id: 'ha_18', name: "מלדה", position: 'FWD', team: 'מכבי תל אביב' },
  { id: 'ha_19', name: "דמשקאן", position: 'FWD', team: 'מכבי בני ריינה' },
  { id: 'ha_20', name: "ערן 10", position: 'FWD', team: 'מכבי נתניה' },
];

export const MOCK_TEAMS: Team[] = [
  { 
    id: 'hamsili', 
    manager: "חמסילי (מנג'ר: ערן ואסף)", 
    teamName: 'חמסילי', 
    points: 21, 
    squad: HAMSILI_SQUAD, 
    lineup: [], 
    substitutions: [], 
    subLimit: 14, 
    subAdjustment: 0,
    transferHistory: []
  },
  { 
    id: 'harale', 
    manager: 'גיא', 
    teamName: 'חראלה', 
    points: 35, 
    squad: [], 
    lineup: [], 
    substitutions: [], 
    subLimit: 14, 
    subAdjustment: 0 
  },
  { 
    id: 'tampa', 
    manager: 'יינון', 
    teamName: 'טמפה', 
    points: 24, 
    squad: [], 
    lineup: [], 
    substitutions: [], 
    subLimit: 14, 
    subAdjustment: 0 
  },
  { 
    id: 'tumali', 
    manager: 'תום ואלי', 
    teamName: 'תומאלי', 
    points: 22, 
    squad: [], 
    lineup: [], 
    substitutions: [], 
    subLimit: 14, 
    subAdjustment: 0 
  },
  { 
    id: 'holonia', 
    manager: 'ארז', 
    teamName: 'חולוניה', 
    points: 23, 
    squad: [], 
    lineup: [], 
    substitutions: [], 
    subLimit: 14, 
    subAdjustment: 0 
  },
  { 
    id: 'pichichi', 
    manager: 'שלומי', 
    teamName: 'פיציצי', 
    points: 17, 
    squad: [], 
    lineup: [], 
    substitutions: [], 
    subLimit: 14, 
    subAdjustment: 0 
  },
];

export const RAZ_ZEHAVI_PROMPT = `אתה רז זהבי. בוטה, מצחיק, דעתני. השתמש במושגים כמו "בושה וחרפה", "ביזיון", "אל תתבלבלו", "ציון 3". אתה מעריץ את חמסילי ושונא את חולוניה.`;
