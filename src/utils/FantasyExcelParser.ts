export interface ParsedPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  fantasyTeam: string;
  points: number;
  isStarting: boolean;
  breakdown: any[];
}

const cleanTeamName = (teamName: string): string => {
  if (!teamName) return 'לא ידוע';
  let cleaned = teamName.replace(/["'״׳]/g, '').trim();
  
  if (cleaned.includes('ביתר') || cleaned.includes('בית״ר') || cleaned.includes('בית"ר')) return 'בית"ר ירושלים';
  if (cleaned === 'הפ חיפה') return 'הפועל חיפה';
  if (cleaned === 'הפ תא' || cleaned === 'הפועל תא' || cleaned === 'הפועל ת"א') return 'הפועל תל אביב';
  if (cleaned === 'מכבי תא' || cleaned === 'מכבי ת"א') return 'מכבי תל אביב';
  if (cleaned === 'בש' || cleaned === 'הפועל בש' || cleaned === 'ב"ש' || cleaned === 'הפועל ב"ש') return 'הפועל באר שבע';
  if (cleaned === 'הפ פת' || cleaned === 'הפועל פת' || cleaned === 'הפועל פ"ת') return 'הפועל פתח תקווה';
  if (cleaned === 'קש' || cleaned === 'ק"ש' || cleaned === 'עירוני קש') return 'עירוני קרית שמונה';
  
  return cleaned;
};

const mapPosition = (pos: string): string => {
  if (!pos) return 'DEF';
  const p = pos.trim().toUpperCase();
  if (p.includes('שוער') || p === 'GK') return 'GK';
  if (p.includes('הגנה') || p.includes('בלם') || p.includes('מגן') || p === 'DEF') return 'DEF';
  if (p.includes('קישור') || p.includes('קשר') || p === 'MID') return 'MID';
  if (p.includes('התקפה') || p.includes('חלוץ') || p === 'FWD') return 'FWD';
  return 'DEF';
};

/**
 * Parses the simple flat CSV structure:
 * עמדה | שם שחקן | קבוצה במציאות | קבוצת פנטזי
 */
export const parseFantasyExcel = (csvText: string): ParsedPlayer[] => {
  // Split into lines
  const lines = csvText.replace(/\r/g, '').split('\n');
  const players: ParsedPlayer[] = [];

  // Start from index 1 to skip the header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Custom CSV parser to safely handle commas inside quoted strings (like "הפועל פ""ת")
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"') inQuotes = !inQuotes;
      else if (line[j] === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += line[j];
      }
    }
    row.push(cur.trim());
    
    // Clean outer quotes from each cell
    row = row.map(s => s.replace(/^"|"$/g, '').trim());

    // Basic validation: row must have at least 4 columns, and it shouldn't be the header
    if (row.length < 4 || row[0] === 'עמדה' || !row[1]) continue;

    const posStr = row[0];
    const playerName = row[1];
    const realTeam = row[2];
    const fantasyTeamName = row[3];

    // Skip empty slots in the squad
    if (playerName && !playerName.includes('מקום פנוי בסגל') && playerName.length > 1) {
      const playerId = `p_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
      
      players.push({
        id: playerId,
        name: playerName,
        position: mapPosition(posStr),
        team: cleanTeamName(realTeam),
        fantasyTeam: fantasyTeamName,
        points: 0,
        isStarting: false,
        breakdown: []
      });
    }
  }

  console.log(`[FantasyExcelParser] Successfully parsed ${players.length} players from CSV.`);
  return players;
};