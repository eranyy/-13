"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLiveFixtures = exports.scheduledSync = exports.onFixturesChangeSync = exports.onUserChangeSync = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https"); // הוספנו את זה בשביל ה-CORS
const v2_1 = require("firebase-functions/v2");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
admin.initializeApp();
const db = admin.firestore();
(0, v2_1.setGlobalOptions)({ region: 'us-central1' });
// region --- Copied Types from src/types.ts ---
// All type definitions are included here to ensure data consistency between client and server.
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "USER";
    UserRole["OWNER"] = "OWNER";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["MODERATOR"] = "MODERATOR";
    UserRole["ARENA_MANAGER"] = "ARENA_MANAGER";
})(UserRole || (UserRole = {}));
// endregion
// region --- Logic ported from LiveArena.tsx for server-side calculation ---
/**
 * Applies halftime substitutions to a team's published lineup.
 * @param team The team object.
 * @param currentRound The current round number.
 * @returns The final lineup after substitutions.
 */
const applySubstitutionsToLineup = (team, currentRound) => {
    if (!team)
        return [];
    let currentLineup = [...(team.published_lineup || [])];
    const bench = team.published_subs_out || [];
    const roundSubs = (team.transfers || []).filter((t) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
    const sortedSubs = roundSubs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    sortedSubs.forEach((sub) => {
        const outIndex = currentLineup.findIndex(p => p.name === sub.playerOut);
        const inPlayer = bench.find((p) => p.name === sub.playerIn);
        if (outIndex !== -1 && inPlayer) {
            currentLineup[outIndex] = inPlayer;
        }
    });
    return currentLineup;
};
/**
 * Calculates the total live score for a team in a given round.
 * @param team The team object.
 * @param currentRound The current round number.
 * @returns The total score.
 */
const calculateTeamScore = (team, currentRound) => {
    if (!team)
        return 0;
    let total = 0;
    const currentLineup = applySubstitutionsToLineup(team, currentRound);
    if (currentLineup) {
        total += currentLineup.reduce((sum, p) => sum + (Number(p.points) || 0), 0);
    }
    const roundSubs = (team.transfers || []).filter((t) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED');
    roundSubs.forEach((sub) => {
        const allPossibleOutPlayers = [...(team.published_subs_out || []), ...(team.squad || [])];
        const benchedPlayerOut = allPossibleOutPlayers.find((p) => p.name === sub.playerOut);
        if (benchedPlayerOut) {
            total += (Number(benchedPlayerOut.points) || 0);
        }
    });
    return total;
};
/**
 * Aggregates live events (goals, cards) for a team.
 * @param team The team object.
 * @param currentRound The current round number.
 * @returns An object with counts for goals, yellows, and reds.
 */
const getTeamLiveEvents = (team, currentRound) => {
    if (!team)
        return { goals: 0, yellows: 0, reds: 0 };
    let goals = 0, yellows = 0, reds = 0;
    const playersInPlay = new Set();
    const currentLineup = applySubstitutionsToLineup(team, currentRound);
    currentLineup.forEach((player) => {
        if (player.stats) {
            goals += (player.stats.goals || 0);
            if (player.stats.yellow)
                yellows++;
            if (player.stats.secondYellow)
                yellows++;
            if (player.stats.red)
                reds++;
        }
        playersInPlay.add(player.name);
    });
    const subbedOutPlayers = (team.transfers || [])
        .filter((t) => t.type === 'HALFTIME_SUB' && t.round === currentRound && t.status !== 'CANCELLED')
        .map((sub) => {
        const allPlayers = [...(team.published_subs_out || []), ...(team.squad || [])];
        return allPlayers.find((p) => p.name === sub.playerOut);
    })
        .filter(Boolean);
    subbedOutPlayers.forEach((player) => {
        if (player && player.stats && !playersInPlay.has(player.name)) {
            goals += (player.stats.goals || 0);
            if (player.stats.yellow)
                yellows++;
            if (player.stats.secondYellow)
                yellows++;
            if (player.stats.red)
                reds++;
        }
    });
    return { goals, yellows, reds };
};
const isPosMatch = (pPos, category) => {
    if (!pPos)
        return false;
    const pos = pPos.toUpperCase();
    if (category === 'GK')
        return ['GK', 'שוער'].includes(pos);
    if (category === 'DEF')
        return ['DEF', 'הגנה', 'בלם', 'מגן'].includes(pos);
    if (category === 'MID')
        return ['MID', 'קשר', 'קישור'].includes(pos);
    if (category === 'FWD')
        return ['FWD', 'חלוץ', 'התקפה'].includes(pos);
    return false;
};
const getFormation = (lineup) => {
    if (!lineup || lineup.length !== 11)
        return '';
    const def = lineup.filter(p => isPosMatch(p.position, 'DEF')).length;
    const mid = lineup.filter(p => isPosMatch(p.position, 'MID')).length;
    const fwd = lineup.filter(p => isPosMatch(p.position, 'FWD')).length;
    return `${def}-${mid}-${fwd}`;
};
// endregion
/**
 * The core logic for syncing live arena data.
 * Fetches all necessary data, performs calculations, and writes the result to a single document.
 */
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
    const { currentRound } = settingsSnap.data();
    const allTeams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allRounds = fixturesSnap.data()?.rounds || [];
    const currentFixtures = allRounds.find(r => r.round === currentRound);
    if (!currentFixtures || !currentFixtures.matches) {
        console.log(`No matches found for current round: ${currentRound}. Clearing live data.`);
        await db.doc('liveData/arena').set({ matches: [], teams: {}, currentRound, lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
        return;
    }
    const processedTeams = {};
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
// --- Function Triggers ---
// This function is triggered whenever a user document is updated.
exports.onUserChangeSync = (0, firestore_1.onDocumentWritten)('users/{userId}', async (event) => {
    // We check if 'points' or 'stats' of any player has changed to avoid unnecessary runs.
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (JSON.stringify(beforeData?.squad) !== JSON.stringify(afterData?.squad)) {
        await performSync();
    }
});
// This function is triggered whenever the main fixtures document is updated.
exports.onFixturesChangeSync = (0, firestore_1.onDocumentWritten)('leagueData/fixtures', async (event) => {
    await performSync();
});
// A scheduled function runs periodically as a fallback to ensure data is fresh.
exports.scheduledSync = (0, scheduler_1.onSchedule)('every 2 minutes', async (event) => {
    await performSync();
});
// --- Web Scraping Environment ---
const createScraper = (name, scrapeFunc) => ({
    name,
    scrape: scrapeFunc,
});
const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
};
const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
};
const scrapeIFA = async (roundHint) => {
    console.log(`Attempting to scrape IFA with round hint: ${roundHint}`);
    return [];
};
const scrapeSport5 = async (roundHint) => {
    console.log(`Attempting to scrape Sport5 with round hint: ${roundHint}`);
    try {
        const { data } = await axios_1.default.get('https://www.sport5.co.il/Games.aspx?FolderID=44&lang=HE');
        const $ = cheerio.load(data);
        const matches = [];
        $('.table-games tr').each((i, row) => {
            if (i === 0)
                return;
            try {
                const columns = $(row).find('td');
                if (columns.length > 5) {
                    const roundText = $(columns[0]).text().trim();
                    const homeTeam = $(columns[1]).text().trim();
                    const awayTeam = $(columns[3]).text().trim();
                    const score = $(columns[2]).text().trim();
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
            }
            catch (e) {
                console.warn(`Failed to parse a row from Sport5`, { error: e.message });
            }
        });
        return matches;
    }
    catch (error) {
        console.error("ScrapeSport5 failed:", { error: error.message });
        return [];
    }
};
const scrapeONE = async (roundHint) => {
    console.log(`Attempting to scrape ONE with round hint: ${roundHint}`);
    return [];
};
const scrape365 = async (roundHint) => {
    console.log(`Attempting to scrape 365Scores with round hint: ${roundHint}`);
    try {
        const { data } = await axios_1.default.get('https://webws.365scores.com/web/games/current/?appTypeId=5&langId=2&timezoneName=Asia/Jerusalem&competitions=11');
        const allGames = data.games || [];
        let filteredGames = allGames;
        if (roundHint) {
            filteredGames = allGames.filter((game) => game.roundNum === roundHint);
        }
        return filteredGames.map((game) => {
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
    }
    catch (error) {
        console.error("Scrape365 failed:", { error: error.message });
        return [];
    }
};
// הפונקציה החדשה והמעודכנת עם אישור CORS פתוח!
exports.fetchLiveFixtures = (0, https_1.onCall)({ region: 'us-central1', cors: true }, async (request) => {
    const { roundHint } = request.data;
    const scrapers = [
        createScraper('365Scores', scrape365),
        createScraper('Sport5', scrapeSport5),
        createScraper('IFA', scrapeIFA),
        createScraper('ONE', scrapeONE),
    ];
    for (const scraper of scrapers) {
        try {
            console.log(`Trying scraper: ${scraper.name}`);
            const result = await scraper.scrape(roundHint);
            if (result && result.length > 0) {
                console.log(`Scraper ${scraper.name} succeeded.`);
                return { success: true, source: scraper.name, matches: result };
            }
            else {
                console.log(`Scraper ${scraper.name} returned no data.`);
            }
        }
        catch (error) {
            console.warn(`Scraper ${scraper.name} failed.`, {
                message: error.message,
            });
        }
    }
    console.error('All scrapers failed to fetch fixtures.');
    throw new functions.https.HttpsError('internal', 'All scrapers failed to fetch data.');
});
//# sourceMappingURL=index.js.map