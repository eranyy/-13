
import { Team, Substitution, Player, LeagueEntry } from './types';

export const VALID_FORMATIONS = ['5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-5-2', '3-4-3'];

export const ISRAELI_TEAMS = [
  'מכבי תל אביב',
  'מכבי חיפה',
  'הפועל באר שבע',
  'הפועל חיפה',
  'בית"ר ירושלים',
  'מכבי בני ריינה',
  'הפועל ירושלים',
  'מכבי פתח תקווה',
  'מכבי נתניה',
  'בני סכנין',
  'הפועל חדרה',
  'מ.ס. אשדוד',
  'הפועל טבריה',
  'הפועל קריית שמונה'
];

export const LEAGUE_TABLE: LeagueEntry[] = [
  { rank: 1, teamName: 'חראלה', played: 22, wins: 15, draws: 2, losses: 5, gf: 906, ga: 808, gd: 98, points: 33 },
  { rank: 2, teamName: 'טמפה', played: 22, wins: 11, draws: 1, losses: 10, gf: 860, ga: 872, gd: -12, points: 24 },
  { rank: 3, teamName: 'חולוניה', played: 22, wins: 10, draws: 3, losses: 9, gf: 861, ga: 879, gd: -18, points: 23 },
  { rank: 4, teamName: 'תומאלי', played: 22, wins: 9, draws: 4, losses: 9, gf: 840, ga: 850, gd: -10, points: 21 },
  { rank: 5, teamName: 'חמסילי', played: 22, wins: 9, draws: 4, losses: 9, gf: 820, ga: 840, gd: -20, points: 21 },
  { rank: 6, teamName: 'פיציצי', played: 22, wins: 2, draws: 1, losses: 19, gf: 710, ga: 920, gd: -210, points: 7 },
];

// --- HAMSILI ---
export const HAMSILI_SQUAD: Player[] = [
  { id: 'h1', name: 'ג׳ראפי', team: 'הפועל חיפה', position: 'GK' },
  { id: 'h2', name: 'מרציאנו', team: 'הפועל ב"ש', position: 'GK' },
  { id: 'h3', name: 'רביבו', team: 'מכבי ת"א', position: 'DEF' },
  { id: 'h4', name: 'צ\'יקו', team: 'הפועל ת"א', position: 'DEF' },
  { id: 'h5', name: 'גולדברג', team: 'מכבי חיפה', position: 'DEF' },
  { id: 'h6', name: 'בלוריאן', team: 'הפועל ב"ש', position: 'DEF' },
  { id: 'h7', name: 'חילו', team: 'בני סכנין', position: 'DEF' },
  { id: 'h8', name: 'רמירז', team: 'הפועל חיפה', position: 'DEF' },
  { id: 'h9', name: 'גורה', team: 'מכבי חיפה', position: 'MID' },
  { id: 'h10', name: 'מרדכי', team: 'הפועל ק״ש', position: 'MID' },
  { id: 'h11', name: 'מיכה', team: 'בית״ר ירושלים', position: 'MID' },
  { id: 'h12', name: 'דון', team: 'מכבי חיפה', position: 'MID' },
  { id: 'h13', name: 'דן ביטון', team: 'הפועל ב"ש', position: 'MID' },
  { id: 'h14', name: 'אצילי', team: 'בית״ר ירושלים', position: 'MID' },
  { id: 'h15', name: 'אנדרדה', team: 'מכבי ת״א', position: 'MID' },
  { id: 'h16', name: 'גונסלס', team: 'בית״ר ירושלים', position: 'FWD' },
  { id: 'h17', name: 'קליי', team: 'הפועל פ"ת', position: 'FWD' },
  { id: 'h18', name: 'נרדין', team: 'שחקן חופשי', position: 'FWD' },
  { id: 'h19', name: 'דמשקאן', team: 'מכבי בני ריינה', position: 'FWD' },
  { id: 'h20', name: 'דאבו', team: 'מכבי נתניה', position: 'FWD', isFrozen: true },
];

export const HAMSILI_TRANS: Substitution[] = [
  { id: 'ht1', playerIn: 'אנדראדה', playerOut: 'חאג׳י', pos: 'MID', date: '27/08/25' },
  { id: 'ht2', playerIn: 'דאבו', playerOut: 'מחמיד', pos: 'FWD', date: '30/08/25' },
  { id: 'ht3', playerIn: 'זהבי', playerOut: 'גאנם', pos: 'FWD', date: '15/11/25' },
  { id: 'ht4', playerIn: 'פטקוב', playerOut: 'שכר', pos: 'MID', date: '15/09/25' },
  { id: 'ht5', playerIn: 'רמירז', playerOut: 'אוג\'טויה', pos: 'DEF', date: '04/10/25' },
  { id: 'ht6', playerIn: 'מיכה', playerOut: 'פטקוב', pos: 'MID', date: '19/10/25' },
  { id: 'ht7', playerIn: 'ירדן כהן', playerOut: 'מנדי', pos: 'DEF', date: '08/12/25' },
  { id: 'ht8', playerIn: 'דמשקאן', playerOut: 'זהבי', pos: 'FWD', date: '08/01/26' },
  { id: 'ht9', playerIn: 'נרדין', playerOut: 'וייסמן', pos: 'FWD', date: '11/01/26' },
  { id: 'ht10', playerIn: 'גונסלס', playerOut: 'דאפה', pos: 'FWD', date: '17/01/26' },
  { id: 'ht11', playerIn: 'מרציאנו', playerOut: 'משפתי', pos: 'GK', date: '21/01/26' },
  { id: 'ht12', playerIn: 'מרדכי', playerOut: 'טאבי', pos: 'MID', date: '24/01/26' },
  { id: 'ht13', playerIn: 'ג\'ראפי', playerOut: 'ניראון', pos: 'GK', date: '27/01/26' },
  { id: 'ht14', playerIn: 'גונסלס', playerOut: 'דאבו', pos: 'FWD', date: '01/02/26', isFreeze: true },
];

// --- HARALE ---
export const HARALE_SQUAD: Player[] = [
  { id: 'hr1', name: 'אליאסי', team: 'הפועל ב"ש', position: 'GK' },
  { id: 'hr2', name: 'כץ', team: 'הפועל פ"ת', position: 'GK' },
  { id: 'hr3', name: 'קוקו', team: 'הפועל ת"א', position: 'DEF' },
  { id: 'hr4', name: 'סק', team: 'מכבי חיפה', position: 'DEF' },
  { id: 'hr5', name: 'בן חמו', team: 'מכבי ת"א', position: 'DEF' },
  { id: 'hr6', name: 'רז שלמה', team: 'מכבי ת"א', position: 'DEF' },
  { id: 'hr7', name: 'קארבלי', team: 'בית"ר ירושלים', position: 'DEF' },
  { id: 'hr8', name: 'ויטור', team: 'הפועל ב"ש', position: 'DEF' },
  { id: 'hr21', name: 'קוסטה', team: 'הפועל פ"ת', position: 'FWD' },
];

export const HARALE_TRANS: Substitution[] = [
  { id: 'hr_t1', playerIn: 'לויזו', playerOut: 'אדיר לוי', pos: 'MID', date: '10/09/25' },
  { id: 'hr_t2', playerIn: 'קוסטה', playerOut: 'שבירו', pos: 'FWD', date: '10/09/25' },
  { id: 'hr_t3', playerIn: 'אנטמן', playerOut: 'נמצ׳ינסקי', pos: 'GK', date: '13/09/25' },
  { id: 'hr_t4', playerIn: 'רז שלמה', playerOut: 'בן הרוש', pos: 'DEF', date: '22/09/25' },
  { id: 'hr_t5', playerIn: 'בן דוד', playerOut: 'סמבה', pos: 'DEF', date: '27/09/25' },
  { id: 'hr_t6', playerIn: 'צרפתי', playerOut: 'אנטמן', pos: 'GK', date: '26/12/25' },
  { id: 'hr_t7', playerIn: 'קוקו', playerOut: 'הייטור', pos: 'DEF', date: '16/01/26' },
  { id: 'hr_t8', playerIn: 'בן חמו', playerOut: 'פיבן', pos: 'DEF', date: '18/01/26' },
  { id: 'hr_t9', playerIn: 'כץ', playerOut: 'צרפתי', pos: 'GK', date: '31/01/26' },
  { id: 'hr_f1', playerIn: 'קוקו', playerOut: 'פיבן', pos: 'DEF', date: '01/02/26', isFreeze: true },
];

// --- HOLONIA ---
export const HOLONIA_SQUAD: Player[] = [
  { id: 'ho1', name: 'צור', team: 'הפועל ת"א', position: 'GK' },
  { id: 'ho2', name: 'זמיר', team: 'הפועל ירושלים', position: 'GK' },
  { id: 'ho3', name: 'לופז', team: 'הפועל ב"ש', position: 'DEF' },
  { id: 'ho21', name: 'זה טורבו', team: 'מכבי בני ריינה', position: 'FWD' },
];

export const HOLONIA_TRANS: Substitution[] = [
  { id: 'ho_t1', playerIn: 'אידוקו', playerOut: 'זארדל', pos: 'FWD', date: '30/08/25' },
  { id: 'ho_t2', playerIn: 'חתואל', playerOut: 'כנעאני', pos: 'FWD', date: '01/09/25' },
  { id: 'ho_t3', playerIn: 'זה טורבו', playerOut: 'זהבי', pos: 'FWD', date: '12/09/25' },
  { id: 'ho_t4', playerIn: 'גומס', playerOut: 'מלמוד', pos: 'DEF', date: '28/09/25' },
  { id: 'ho_t5', playerIn: 'חוזז', playerOut: 'חתואל', pos: 'MID', date: '01/10/25' },
  { id: 'ho_t6', playerIn: 'אבו רומי', playerOut: 'לוי', pos: 'MID', date: '10/10/25' },
  { id: 'ho_t7', playerIn: 'דוד', playerOut: 'פראיסו', pos: 'FWD', date: '15/10/25' },
  { id: 'ho_t8', playerIn: 'ירדן כהן', playerOut: 'יינון אליהו', pos: 'DEF', date: '01/11/25' },
  { id: 'ho_t9', playerIn: 'ברוניניו', playerOut: 'נאוהל', pos: 'MID', date: '10/11/25' },
  { id: 'ho_t10', playerIn: 'בנסון', playerOut: 'אבו רומי', pos: 'MID', date: '20/11/25' },
  { id: 'ho_f1', playerIn: 'אבו רומי', playerOut: 'ירין לוי', pos: 'MID', date: '01/02/26', isFreeze: true },
];

// --- TAMPA ---
export const TAMPA_SQUAD: Player[] = [
  { id: 'tp1', name: 'ירמקוב', team: 'מכבי חיפה', position: 'GK' },
  { id: 'tp2', name: 'מליקה', team: 'מכבי ת"א', position: 'GK' },
];

export const TAMPA_TRANS: Substitution[] = [
  { id: 'tp_t1', playerIn: 'גבריל', playerOut: 'גרופר', pos: 'DEF', date: '08/09/25' },
  { id: 'tp_t2', playerIn: 'זיקרי', playerOut: 'גריטה', pos: 'FWD', date: '12/09/25' },
  { id: 'tp_t3', playerIn: 'ארבל', playerOut: 'ירדן', pos: 'DEF', date: '15/10/25' },
  { id: 'tp_t4', playerIn: 'מליקה', playerOut: 'גראפי', pos: 'GK', date: '03/12/25' },
  { id: 'tp_t5', playerIn: 'סייף', playerOut: 'דרוויש', pos: 'DEF', date: '10/01/26' },
  { id: 'tp_t6', playerIn: 'פרחי', playerOut: 'סילבה', pos: 'MID', date: '26/01/26' },
  { id: 'tp_t7', playerIn: 'בואטנג', playerOut: 'דאפה', pos: 'FWD', date: '26/01/26' },
  { id: 'tp_t8', playerIn: 'ירין', playerOut: 'פלאקי', pos: 'MID', date: '01/02/26' },
  { id: 'tp_t9', playerIn: 'מנדי', playerOut: 'ארבל', pos: 'DEF', date: '05/02/26' },
  { id: 'tp_t10', playerIn: 'סיפריאן', playerOut: 'לוי', pos: 'MID', date: '10/02/26' },
  { id: 'tp_f1', playerIn: 'אבו פרחי', playerOut: 'סילבה', pos: 'MID', date: '01/02/26', isFreeze: true },
];

// --- PITZITZI ---
export const PITZITZI_SQUAD: Player[] = [
  { id: 'pz1', name: 'גלזר', team: 'שחקן חופשי', position: 'GK' },
];

export const PITZITZI_TRANS: Substitution[] = [
  { id: 'pz_t1', playerIn: 'וארלה', playerOut: 'רוטמן', pos: 'MID', date: '28/08/25' },
  { id: 'pz_t2', playerIn: 'גלזר', playerOut: 'אנטמן', pos: 'GK', date: '31/08/25' },
  { id: 'pz_t3', playerIn: 'לוקה', playerOut: 'מורגן', pos: 'DEF', date: '31/08/25' },
  { id: 'pz_t4', playerIn: 'ביטון', playerOut: 'אדני', pos: 'MID', date: '03/09/25' },
  { id: 'pz_t5', playerIn: 'קוק', playerOut: 'לוקה', pos: 'DEF', date: '03/09/25' },
  { id: 'pz_t6', playerIn: 'אלימלך', playerOut: 'קוק', pos: 'DEF', date: '10/09/25' },
  { id: 'pz_t7', playerIn: 'אווסו', playerOut: 'מרטינז', pos: 'MID', date: '12/09/25' },
  { id: 'pz_t8', playerIn: 'מזל', playerOut: 'מדמון', pos: 'FWD', date: '15/09/25' },
  { id: 'pz_t9', playerIn: 'רותם חטואל', playerOut: 'פדידה', pos: 'MID', date: '08/12/25' },
  { id: 'pz_t10', playerIn: 'איתמר שבירו', playerOut: 'תורג׳מן', pos: 'FWD', date: '08/12/25' },
  { id: 'pz_t11', playerIn: 'אלקוקין', playerOut: 'אווסו', pos: 'MID', date: '15/01/26' },
  { id: 'pz_t12', playerIn: 'קוטגו', playerOut: 'חטואל', pos: 'MID', date: '20/01/26' },
  { id: 'pz_t13', playerIn: 'דאפה', playerOut: 'שבירו', pos: 'FWD', date: '25/01/26' },
  { id: 'pz_t14', playerIn: 'אוחנה', playerOut: 'קוטבו', pos: 'MID', date: '01/02/26' },
];

// --- TOMALI ---
export const TOMALI_SQUAD: Player[] = [
  { id: 'tm1', name: 'סילבה', team: 'בית"ר ירושלים', position: 'GK' },
];

export const TOMALI_TRANS: Substitution[] = [
  { id: 'tm_t1', playerIn: 'בילו', playerOut: 'לוי', pos: 'MID', date: '24/08/25' },
  { id: 'tm_t2', playerIn: 'בוסקילה', playerOut: 'באלשיקוואי', pos: 'MID', date: '03/09/25' },
  { id: 'tm_t3', playerIn: 'עזו', playerOut: 'מיכה', pos: 'MID', date: '10/09/25' },
  { id: 'tm_t4', playerIn: 'גדראני', playerOut: 'סייף', pos: 'DEF', date: '12/09/25' },
  { id: 'tm_t5', playerIn: 'חלאיילי', playerOut: 'בוסקילה', pos: 'MID', date: '18/09/25' },
  { id: 'tm_t6', playerIn: 'אייסה', playerOut: 'באצו', pos: 'DEF', date: '27/09/25' },
  { id: 'tm_t7', playerIn: 'דיבה', playerOut: 'אייסה', pos: 'DEF', date: '10/10/25' },
  { id: 'tm_t8', playerIn: 'אבו ניל', playerOut: 'עמוס', pos: 'GK', date: '09/12/25' },
  { id: 'tm_t9', playerIn: 'בן הרוש', playerOut: 'ג\'אבר', pos: 'DEF', date: '20/12/25' },
  { id: 'tm_t10', playerIn: 'דוד', playerOut: 'עזו', pos: 'FWD', date: '10/01/26' },
  { id: 'tm_t11', playerIn: 'סאהיטי', playerOut: 'חלאיילי', pos: 'MID', date: '20/01/26' },
  { id: 'tm_f1', playerIn: 'בן דוד', playerOut: 'עיסאת', pos: 'DEF', date: '01/02/26', isFreeze: true },
];

export const MOCK_TEAMS: Team[] = [
  {
    id: 't1', manager: 'ערן', teamName: 'חמסילי', points: 820,
    squad: HAMSILI_SQUAD,
    lineup: [HAMSILI_SQUAD[0], HAMSILI_SQUAD[2], HAMSILI_SQUAD[4], HAMSILI_SQUAD[8], HAMSILI_SQUAD[12], HAMSILI_SQUAD[13], HAMSILI_SQUAD[14], HAMSILI_SQUAD[15], HAMSILI_SQUAD[16], HAMSILI_SQUAD[18]], 
    substitutions: HAMSILI_TRANS,
    subLimit: 14,
    subAdjustment: 0
  },
  {
    id: 't2', manager: 'חראלה', teamName: 'חראלה', points: 906,
    squad: HARALE_SQUAD,
    lineup: [], substitutions: HARALE_TRANS,
    subLimit: 14,
    subAdjustment: 0
  },
  {
    id: 't3', manager: 'חולוניה', teamName: 'חולוניה', points: 861,
    squad: HOLONIA_SQUAD,
    lineup: [], substitutions: HOLONIA_TRANS,
    subLimit: 14,
    subAdjustment: 0
  },
  {
    id: 't4', manager: 'תומאלי', teamName: 'תומאלי', points: 840,
    squad: TOMALI_SQUAD,
    lineup: [], substitutions: TOMALI_TRANS,
    subLimit: 14,
    subAdjustment: 0
  },
  {
    id: 't5', manager: 'טמפה', teamName: 'טמפה', points: 860,
    squad: TAMPA_SQUAD,
    lineup: [], substitutions: TAMPA_TRANS,
    subLimit: 14,
    subAdjustment: 0
  },
  {
    id: 't6', manager: 'פיציצי', teamName: 'פיציצי', points: 710,
    squad: PITZITZI_SQUAD,
    lineup: [], substitutions: PITZITZI_TRANS,
    subLimit: 14,
    subAdjustment: 0
  }
];

export const RAZ_ZEHAVI_PROMPT = `אתה רז זהבי. בוטה, מצחיק, דעתני. השתמש במושגים כמו "בושה וחרפה", "ביזיון", "אל תתבלבלו", "ציון 3". אתה מעריץ את חמסילי ושונא את חולוניה.`;
