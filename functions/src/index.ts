import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import axios from 'axios';
import * as cheerio from 'cheerio';

admin.initializeApp();
const db = admin.firestore();

// שינינו פה את אזור השרת כדי שיתאים לאפליקציה
setGlobalOptions({ region: 'us-west1' });

// region --- Copied Types from src/types.ts ---
enum UserRole {
    USER = 'USER',
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    SUPER_ADMIN = 'SUPER_ADMIN',
    MODERATOR = 'MODERATOR',
    ARENA_MANAGER = 'ARENA_MANAGER'
}

interface Player {
    id: string;
    name: string;
    team: string;
    position: 'GK' | 'DEF' | 'MID' | 'FWD';
    points: number;
    stats?: {
        started?: boolean; played60?: boolean; notInSquad?: boolean; won?: boolean;
        goals?: number; assists?: number; cleanSheet?: boolean; conceded?: number;
        yellow?: boolean; secondYellow?: boolean; red?: boolean;
        penaltyWon?: number; penaltyMissed?: number; penaltySaved?: number;
        ownGoals?: number; assistOwnGoal?: number;
    };
    breakdown?: any[];
    events?: string[];
    pointsAtSub?: boolean;
    isStarting?: boolean;
    positionOnPitch?: string | null;
}

interface Team {
    id: string;
    teamName: string;
    manager: string;
    email: string;
    role: UserRole;
    points: number;
    squad: Player[];
    lineup: Player[];
    published_lineup?: Player[];
    published_subs_out?: Player[];
    transfers?: any[];
    name?: string;
    players?: Player[];
    gf?: number;
    ga?: number;
    wins?: number;
    draws?: number;
    losses?: number;
    played?: number;
}

interface Match {
    h: string; // home team id
    a: string; // away team id
    hs?: number;
    as?: number;
}

interface Round {
    round: number;
    matches: Match[];
    isPlayed: boolean;
}
// endregion

// region --- Logic ported from LiveArena.tsx for server-side calculation ---
const applySubstitutionsToLineup = (team: Team, currentRound: number): Player[] => {
    if (!team) return [];
    let currentLineup = [...(team.published_lineup || [])];
    const bench = team.published_subs_out || [];

    const roundSubs = (team.transfers || []).filter((t: any) =>
        t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED'
    );

    const sortedSubs = roundSubs.sort((a: any, b: any) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedSubs.forEach((sub: any) => {
        const outIndex = currentLineup.findIndex(p => p.name === sub.playerOut);
        const inPlayer = bench.find((p: any) => p.name === sub.playerIn);
        if (outIndex !== -1 && inPlayer) {
            currentLineup[outIndex] = inPlayer;
        }
    });

    return currentLineup;
};

const calculateTeamScore = (team: Team, currentRound: number): number => {
    if (!team) return 0;
    let total = 0;

    const currentLineup = applySubstitutionsToLineup(team, currentRound);
    if (currentLineup) {
        total += currentLineup.reduce((sum: number, p: Player) => sum + (Number(p.points) || 0), 0);
    }

    const roundSubs = (team.transfers || []).filter((t: any) =>
        t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED'
    );

    roundSubs.forEach((sub: any) => {
        const allPossibleOutPlayers = [...(team.published_subs_out || []), ...(team.squad || [])];
        const benchedPlayerOut = allPossibleOutPlayers.find((p: any) => p.name === sub.playerOut);

        if (benchedPlayerOut) {
            total += (Number(benchedPlayerOut.points) || 0);
        }
    });

    return total;
};

const getTeamLiveEvents = (team: Team, currentRound: number): { goals: number, yellows: number, reds: number } => {
    if (!team) return { goals: 0, yellows: 0, reds: 0 };
    
    let goals = 0, yellows = 0, reds = 0;
    const playersInPlay = new Set<string>();
    
    const currentLineup = applySubstitutionsToLineup(team, currentRound);
    
    currentLineup.forEach((player: Player) => {
        if (player.stats) {
            goals += (player.stats.goals || 0);
            if (player.stats.yellow) yellows++;
            if (player.stats.secondYellow) yellows++;
            if (player.stats.red) reds++;
        }
        playersInPlay.add(player.name);
    });

    const subbedOutPlayers = (team.transfers || [])
        .filter((t: any) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED')
        .map((sub: any) => {
             const allPlayers = [...(team.published_subs_out || []), ...(team.squad || [])];
             return allPlayers.find((p: any) => p.name === sub.playerOut);
        })
        .filter(Boolean);

    subbedOutPlayers.forEach((player: Player | undefined) => {
        if (player && player.stats && !playersInPlay.has(player.name)) {
            goals += (player.stats.goals || 0);
            if (player.stats.yellow) yellows++;
            if (player.stats.secondYellow) yellows++;
            if (player.stats.red) reds++;
        }
    });

    return { goals, yellows, reds };
};

const isPosMatch = (pPos: string, category: string): boolean => {
    if (!pPos) return false;
    const pos = pPos.toUpperCase();
    if (category === 'GK') return ['GK', 'שוער'].includes(pos);
    if (category === 'DEF') return ['DEF', 'הגנה', 'בלם', 'מגן'].includes(pos);
    if (category === 'MID') return ['MID', 'קשר', 'קישור'].includes(pos);
    if (category === 'FWD') return ['FWD', 'חלוץ', 'התקפה'].includes(pos);
    return false;
};

const getFormation = (lineup: Player[]): string => {
    if (!lineup || lineup.length !== 11) return '';
    const def = lineup.filter(p => isPosMatch(p.position, 'DEF')).length;
    const mid = lineup.filter(p => isPosMatch(p.position, 'MID')).length;
    const fwd = lineup.filter(p => isPosMatch(p.position, 'FWD')).length;
    return `${def}-${mid}-${fwd}`;
};
// endregion

const performSync = async () => {
    console.log('Starting Live Arena sync...');

    const [settingsSnap, fixturesSnap, teamsSnap] = await Promise.all([
        db.doc('leagueData/settings').get(),
        db.doc('leagueData/fixtures').get(),
        db.collection('users').where('role', 'in', ['USER', 'OWNER']).get()
    ]);

    if (!settingsSnap.exists || !fixturesSnap.exists) {
        console.error('Settings or Fixtures do not exist. Aborting sync.');
        return;
    }

    const { currentRound } = settingsSnap.data() as { currentRound: number };
    const allTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[];
    const allRounds = (fixturesSnap.data() as { rounds: Round[] })?.rounds || [];
    const currentFixtures = allRounds.find(r => r.round === currentRound);

    if (!currentFixtures || !currentFixtures.matches) {
        console.log(`No matches found for current round: ${currentRound}. Clearing live data.`);
        await db.doc('liveData/arena').set({ matches: [], teams: {}, currentRound, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
        return;
    }

    const processedTeams: { [teamId: string]: any } = {};
    for (const team of allTeams) {
        const lineup = applySubstitutionsToLineup(team, currentRound);
        processedTeams[team.id] = {
            id: team.id,
            teamName: team.teamName,
            manager: team.manager,
            liveScore: calculateTeamScore(team, currentRound),
            liveEvents: getTeamLiveEvents(team, currentRound),
            formation: getFormation(lineup),
            lineup: lineup,
        };
    }
    
    const liveArenaData = {
        teams: processedTeams,
        matches: currentFixtures.matches,
        currentRound: currentRound,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.doc('liveData/arena').set(liveArenaData);
    console.log(`Live Arena sync completed successfully for round ${currentRound}.`);
};

export const onUserChangeSync = onDocumentWritten('users/{userId}', async (event) => {
    const beforeData = event.data?.before.data() as Team;
    const afterData = event.data?.after.data() as Team;
    if (JSON.stringify(beforeData?.squad) !== JSON.stringify(afterData?.squad)) {
        await performSync();
    }
});

export const onFixturesChangeSync = onDocumentWritten('leagueData/fixtures', async (event) => {
    await performSync();
});

export const scheduledSync = onSchedule('every 2 minutes', async (event) => {
    await performSync();
});

// --- Web Scraping Environment ---
const SCRAPER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
};

const createScraper = (name: string, scrapeFunc: (roundHint?: number) => Promise<any[]>) => ({
    name,
    scrape: scrapeFunc,
});

const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};

const scrapeIFA = async (roundHint?: number): Promise<any[]> => {
    return [];
};

const scrapeSport5 = async (roundHint?: number): Promise<any[]> => {
    console.log(`Attempting to scrape Sport5 with round hint: ${roundHint}`);
    try {
        const { data } = await axios.get('https://www.sport5.co.il/Games.aspx?FolderID=44&lang=HE', { headers: SCRAPER_HEADERS });
        const $ = cheerio.load(data);
        const matches: any[] = [];

        $('.table-games tr').each((i, row) => {
            if (i === 0) return; 
            try {
                const columns = $(row).find('td');
                if (columns.length > 5) {
                    const roundText = $(columns[0]).text().trim();
                    const homeTeam = $(columns[1]).text().trim();
                    const score = $(columns[2]).text().trim();
                    const awayTeam = $(columns[3]).text().trim();
                    const date = $(columns[4]).text().trim(); 
                    const time = $(columns[5]).text().trim(); 
                    const stadium = $(columns[6]).text().trim();
                    const status = "Scheduled"; 

                    const round = parseInt(roundText, 10);
                    
                    if (roundHint && round !== roundHint) {
                        return;
                    }

                    let hs = '';
                    let as = '';
                    if (score.includes('-')) {
                        [hs, as] = score.split('-').map(s => s.trim());
                    }

                    matches.push({
                        round,
                        homeTeam,
                        awayTeam,
                        date,
                        time,
                        stadium,
                        hs: hs || "",
                        as: as || "",
                        status: status,
                    });
                }
            } catch(e: any) {
                console.warn(`Failed to parse a row from Sport5`, { error: e.message });
            }
        });
        return matches;
    } catch (error: any) {
        console.error("ScrapeSport5 failed:", { error: error.message, status: error.response?.status });
        return [];
    }
};

const scrapeONE = async (roundHint?: number): Promise<any[]> => {
    return [];
};

const scrape365 = async (roundHint?: number): Promise<any[]> => {
    console.log(`Attempting to scrape 365Scores with round hint: ${roundHint}`);
    try {
        const { data } = await axios.get('https://webws.365scores.com/web/games/current/?appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&competitions=11', { headers: SCRAPER_HEADERS });
        const allGames = data.games || [];

        let filteredGames = allGames;
        if (roundHint) {
            filteredGames = allGames.filter((game: any) => game.roundNum === roundHint);
        }

        return filteredGames.map((game: any) => {
            const startTime = new Date(game.startTime);
            return {
                round: game.roundNum,
                homeTeam: game.competitors[0]?.name || '',
                awayTeam: game.competitors[1]?.name || '',
                date: formatDate(startTime),
                time: formatTime(startTime),
                stadium: game.venue?.name || '',
                hs: game.competitors[0]?.score >= 0 ? game.competitors[0].score : '',
                as: game.competitors[1]?.score >= 0 ? game.competitors[1].score : '',
                status: game.statusText || '',
            };
        });
    } catch (error: any) {
        console.error("Scrape365 failed:", { error: error.message, status: error.response?.status });
        return [];
    }
};

// שינינו גם פה ל-us-west1!
export const fetchLiveFixtures = onCall(
    { region: 'us-west1', cors: true }, 
    async (request) => {
        const roundHintRaw = request.data?.roundHint;
        const roundHint = roundHintRaw ? Number(roundHintRaw) : undefined;

        console.log(`Requested sync for round: ${roundHint}`);

        const scrapers = [
            createScraper('365Scores', scrape365),
            createScraper('Sport5', scrapeSport5),
            createScraper('IFA', scrapeIFA),
            createScraper('ONE', scrapeONE),
        ];

        let finalMatches: any[] = [];
        let successfulScraper = '';

        for (const scraper of scrapers) {
            try {
                console.log(`Trying scraper: ${scraper.name}`);
                const result = await scraper.scrape(roundHint);

                if (result && result.length > 0) {
                    console.log(`Scraper ${scraper.name} succeeded with ${result.length} matches.`);
                    finalMatches = result;
                    successfulScraper = scraper.name;
                    break;
                } else {
                    console.log(`Scraper ${scraper.name} returned no data.`);
                }
            } catch (error: any) {
                console.warn(`Scraper ${scraper.name} failed.`, { message: error.message });
            }
        }

        if (finalMatches.length === 0) {
            console.error('All scrapers failed to fetch fixtures or returned empty arrays.');
            throw new functions.https.HttpsError('internal', 'All scrapers failed to fetch data.');
        }

        return { success: true, source: successfulScraper, matches: finalMatches };
    }
);