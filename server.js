require('dotenv').config();
console.log("RUNNING MLB ANALYTICS SERVER");

const express = require('express');
const { calculateRecencyScore } = require('./services/recencyLogic');
const { calculateMatchupScore } = require('./services/matchupLogic');
const { calculateWeatherAdjustment } = require('./services/weatherLogic');
const { PARK_FACTORS } = require('./services/parkFactors');
const { getCachedPlayer, setCachedPlayer, getCachedGameLog, setCachedGameLog, saveMatchupResult } = require('./services/cache');

const PORT = process.env.PORT || 3001;
const DEFAULT_SEASON = process.env.DEFAULT_SEASON || '2025';

const app = express();

// Allow Next.js frontend (local dev + Vercel production/preview)
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /\.vercel\.app$/.test(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

function isNumeric(value) {
  return value !== undefined && value !== '' && !isNaN(Number(value));
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchTextWithTimeout(url, timeoutMs = 15000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.text();
}

// RFC-4180-safe CSV parser — handles quoted fields with commas inside
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']));
  });
}

// In-memory Statcast cache (6h TTL)
let statcastCache = null;
let statcastCacheTs = 0;
const STATCAST_TTL = 6 * 60 * 60 * 1000;

app.get('/', (req, res) => {
  res.send('home route works');
});

app.get('/player-test', (req, res) => {
  res.send('player test route works');
});
//PLAYER ID ROUTE
app.get('/player/:id', async (req, res) => {
  const playerId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting],type=[season],season=${season})`;

    const data = await fetchJsonWithTimeout(url);
    const player = data.people?.[0];

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({
      player: {
        id: player.id,
        fullName: player.fullName,
        team: player.currentTeam?.name,
        position: player.primaryPosition?.name,
        batSide: player.batSide?.description
      },
      hittingStats: player.stats?.[0]?.splits?.[0]?.stat || null
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch player data',
      details: error.message
    });
  }
});
//Game Log Route 
app.get('/player/:id/gamelog', async (req, res) => {
  const playerId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;

    const data = await fetchJsonWithTimeout(url);
    const splits = data.stats?.[0]?.splits || [];

    const last10 = splits.slice(-10);

    const games = splits.map(game => ({
      date: game.date,
      opponent: game.opponent?.name || null,
      hits: Number(game.stat?.hits || 0),
      homeRuns: Number(game.stat?.homeRuns || 0),
      atBats: Number(game.stat?.atBats || 0),
      rbi: Number(game.stat?.rbi || 0),
      runs: Number(game.stat?.runs || 0),
      baseOnBalls: Number(game.stat?.baseOnBalls || 0),
      stolenBases: Number(game.stat?.stolenBases || 0),
    }));

    res.json({ games });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch game logs',
      details: error.message
    });
  }
});
//Game Trends Route
app.get('/player/:id/trends', async (req, res) => {
  const playerId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;

    const data = await fetchJsonWithTimeout(url);
    const splits = data.stats?.[0]?.splits || [];
    const last10 = splits.slice(-10);

    const totals = last10.reduce(
      (acc, game) => {
        const hits = Number(game.stat?.hits || 0);
        const homeRuns = Number(game.stat?.homeRuns || 0);
        const atBats = Number(game.stat?.atBats || 0);

        acc.totalHits += hits;
        acc.totalHomeRuns += homeRuns;
        acc.totalAtBats += atBats;
        acc.hitGames += hits > 0 ? 1 : 0;
        acc.multiHitGames += hits >= 2 ? 1 : 0;
        acc.homeRunGames += homeRuns > 0 ? 1 : 0;

        return acc;
      },
      {
        totalHits: 0,
        totalHomeRuns: 0,
        totalAtBats: 0,
        hitGames: 0,
        multiHitGames: 0,
        homeRunGames: 0
      }
    );

    const gamesCount = last10.length;
    const battingAverage =
      totals.totalAtBats > 0 ? (totals.totalHits / totals.totalAtBats).toFixed(3) : "0.000";

    const avgHitsPerGame =
      gamesCount > 0 ? (totals.totalHits / gamesCount).toFixed(2) : "0.00";

    const avgHomeRunsPerGame =
      gamesCount > 0 ? (totals.totalHomeRuns / gamesCount).toFixed(2) : "0.00";

    res.json({
      playerId,
      season,
      last10: {
        games: gamesCount,
        totalHits: totals.totalHits,
        totalHomeRuns: totals.totalHomeRuns,
        totalAtBats: totals.totalAtBats,
        battingAverage,
        avgHitsPerGame,
        avgHomeRunsPerGame,
        hitGames: totals.hitGames,
        multiHitGames: totals.multiHitGames,
        homeRunGames: totals.homeRunGames
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch trends',
      details: error.message
    });
  }
});
//Player Splits Route 
app.get('/player/:id/splits', async (req, res) => {
  const playerId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting],type=[vsPlayer,statSplits],sitCodes=[vl,vr],season=${season})`;

    const data = await fetchJsonWithTimeout(url);
    const player = data.people?.[0];

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const stats = player.stats || [];
    let splitData = [];

    for (const statGroup of stats) {
      if (statGroup.splits && statGroup.splits.length > 0) {
        splitData = statGroup.splits;
        break;
      }
    }

    const vsLeft = splitData.find(split => split.split?.code === 'vl');
    const vsRight = splitData.find(split => split.split?.code === 'vr');

    const formatSplit = (split) => {
      if (!split) return null;

      return {
        gamesPlayed: Number(split.stat?.gamesPlayed || 0),
        plateAppearances: Number(split.stat?.plateAppearances || 0),
        atBats: Number(split.stat?.atBats || 0),
        hits: Number(split.stat?.hits || 0),
        homeRuns: Number(split.stat?.homeRuns || 0),
        strikeOuts: Number(split.stat?.strikeOuts || 0),
        baseOnBalls: Number(split.stat?.baseOnBalls || 0),
        avg: split.stat?.avg || null,
        obp: split.stat?.obp || null,
        slg: split.stat?.slg || null,
        ops: split.stat?.ops || null
      };
    };

    res.json({
      playerId,
      season,
      player: {
        id: player.id,
        fullName: player.fullName,
        team: player.currentTeam?.name,
        position: player.primaryPosition?.name,
        batSide: player.batSide?.description
      },
      splits: {
        vsLeftHandedPitching: formatSplit(vsLeft),
        vsRightHandedPitching: formatSplit(vsRight)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch splits',
      details: error.message
    });
  }
});
// Pitcher Route
app.get('/pitcher/:id', async (req, res) => {
  const pitcherId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;

    const data = await fetchJsonWithTimeout(url);
    const pitcher = data.people?.[0];

    if (!pitcher) {
      return res.status(404).json({ error: 'Pitcher not found' });
    }

    const pitchingStats = pitcher.stats?.[0]?.splits?.[0]?.stat || null;

    if (!pitchingStats) {
      return res.json({
        pitcherId,
        season,
        pitcher: {
          id: pitcher.id,
          fullName: pitcher.fullName,
          team: pitcher.currentTeam?.name,
          position: pitcher.primaryPosition?.name,
          pitchHand: pitcher.pitchHand?.description
        },
        pitchingStats: null,
        note: 'No pitching stats found for this pitcher in the selected season'
      });
    }

    res.json({
      pitcherId,
      season,
      pitcher: {
        id: pitcher.id,
        fullName: pitcher.fullName,
        team: pitcher.currentTeam?.name,
        position: pitcher.primaryPosition?.name,
        pitchHand: pitcher.pitchHand?.description
      },
      pitchingStats: {
        wins: Number(pitchingStats.wins || 0),
        losses: Number(pitchingStats.losses || 0),
        era: pitchingStats.era || null,
        inningsPitched: pitchingStats.inningsPitched || null,
        hitsAllowed: Number(pitchingStats.hits || 0),
        homeRunsAllowed: Number(pitchingStats.homeRuns || 0),
        strikeOuts: Number(pitchingStats.strikeOuts || 0),
        baseOnBalls: Number(pitchingStats.baseOnBalls || 0),
        whip: pitchingStats.whip || null,
        avgAgainst: pitchingStats.avg || null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch pitcher data',
      details: error.message
    });
  }
});
app.get('/matchup/batter/:batterId/pitcher/:pitcherId', async (req, res) => {
  const batterId = req.params.batterId;
  const pitcherId = req.params.pitcherId;
  const season = req.query.season || DEFAULT_SEASON;
  const stadium = req.query.stadium || 'Neutral Park';
  const lat = req.query.lat;
  const lon = req.query.lon;

  if (!isNumeric(batterId) || !isNumeric(pitcherId)) {
    return res.status(400).json({ error: 'batterId and pitcherId must be numeric' });
  }
  if ((lat !== undefined || lon !== undefined) && (!isNumeric(lat) || !isNumeric(lon))) {
    return res.status(400).json({ error: 'lat and lon must both be numeric' });
  }

  try {
    const batterUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=[hitting],type=[vsPlayer,statSplits],sitCodes=[vl,vr],season=${season})`;
    const pitcherUrl = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;
    const gameLogUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=gameLog&group=hitting&season=${season}`;

    let batterData = await getCachedPlayer(batterId, season, 'hitting_splits');
    if (!batterData) {
      batterData = await fetchJsonWithTimeout(batterUrl);
      setCachedPlayer(batterId, season, 'hitting_splits', batterData);
    }

    let pitcherData = await getCachedPlayer(pitcherId, season, 'pitching');
    if (!pitcherData) {
      pitcherData = await fetchJsonWithTimeout(pitcherUrl);
      setCachedPlayer(pitcherId, season, 'pitching', pitcherData);
    }

    let gameLogData = await getCachedGameLog(batterId, season);
    if (!gameLogData) {
      gameLogData = await fetchJsonWithTimeout(gameLogUrl);
      setCachedGameLog(batterId, season, gameLogData);
    }

    let weatherData = null;

    if (lat && lon) {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
      weatherData = await fetchJsonWithTimeout(weatherUrl);
    }

    const batter = batterData.people?.[0];
    const pitcher = pitcherData.people?.[0];

    if (!batter || !pitcher) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const pitcherHand = pitcher.pitchHand?.description;
    const batterStats = batter.stats || [];

    let splitData = [];

    for (const statGroup of batterStats) {
      if (statGroup.splits?.length > 0) {
        splitData = statGroup.splits;
        break;
      }
    }

    const vsLeft = splitData.find(s => s.split?.code === 'vl');
    const vsRight = splitData.find(s => s.split?.code === 'vr');
    const relevantSplit = pitcherHand === 'Left' ? vsLeft : vsRight;

    const pitcherStats = pitcher.stats?.[0]?.splits?.[0]?.stat || {};
    const gameLogSplits = gameLogData.stats?.[0]?.splits || [];

    const recency = calculateRecencyScore(gameLogSplits);

    let weather = null;
    let weatherImpact = { adjustment: 0, notes: [] };

    if (weatherData) {
      const current = weatherData.current || {};

      weather = {
        temperature: current.temperature_2m ?? null,
        windSpeed: current.wind_speed_10m ?? null,
        windDirection: current.wind_direction_10m ?? null,
        time: current.time ?? null
      };

      weatherImpact = calculateWeatherAdjustment(weather);
    }

    const matchup = calculateMatchupScore({
      relevantSplit,
      pitcherStats,
      pitcherHand,
      stadium,
      parkFactors: PARK_FACTORS,
      recency,
      weatherAdjustment: weatherImpact.adjustment
    });

    const result = {
      batter: batter.fullName,
      pitcher: pitcher.fullName,
      stadium,
      season,
      splitUsed: pitcherHand === 'Left' ? 'vsLeftHandedPitching' : 'vsRightHandedPitching',
      matchupStats: matchup.matchupStats,
      parkFactors: matchup.parkFactorsUsed,
      parkAdjustment: matchup.parkAdjustment,
      weather,
      weatherImpact,
      recency,
      score: matchup.score,
      recommendation: matchup.recommendation
    };

    saveMatchupResult({
      batterId,
      pitcherId,
      batterName: batter.fullName,
      pitcherName: pitcher.fullName,
      season,
      stadium,
      score: matchup.score,
      recommendation: matchup.recommendation,
      fullResult: result,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to calculate matchup',
      details: error.message
    });
  }
});
//Probable Pitcher Route 
app.get('/games/probables', async (req, res) => {
  const date = req.query.date;
  const teamId = req.query.teamId || '';

  if (!date) {
    return res.status(400).json({
      error: 'date is required, ex: ?date=2025-09-28'
    });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format, ex: ?date=2025-09-28' });
  }

  try {
    let url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,venue`;

    if (teamId) {
      url += `&teamId=${teamId}`;
    }

    const data = await fetchJsonWithTimeout(url);

    const games = (data.dates?.[0]?.games || []).map(game => ({
      gamePk: game.gamePk,
      gameDate: game.gameDate,
      venue: game.venue?.name,
      awayTeamId: game.teams?.away?.team?.id || null,
      awayTeam: game.teams?.away?.team?.name,
      awayTeamAbbrev: game.teams?.away?.team?.abbreviation || null,
      awayProbablePitcher: game.teams?.away?.probablePitcher?.fullName || null,
      awayProbablePitcherId: game.teams?.away?.probablePitcher?.id || null,
      awayProbablePitcherHand: game.teams?.away?.probablePitcher?.pitchHand?.code || null,
      homeTeamId: game.teams?.home?.team?.id || null,
      homeTeam: game.teams?.home?.team?.name,
      homeTeamAbbrev: game.teams?.home?.team?.abbreviation || null,
      homeProbablePitcher: game.teams?.home?.probablePitcher?.fullName || null,
      homeProbablePitcherId: game.teams?.home?.probablePitcher?.id || null,
      homeProbablePitcherHand: game.teams?.home?.probablePitcher?.pitchHand?.code || null,
    }));

    res.json({ date, games });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch probable pitchers',
      details: error.message
    });
  }
});
//AutoMatchup Route
app.get('/auto-matchup', async (req, res) => {
  const batterId = req.query.batterId;
  const date = req.query.date;
  const teamId = req.query.teamId;
  const season = req.query.season || DEFAULT_SEASON;
  const lat = req.query.lat;
  const lon = req.query.lon;

  if (!batterId || !date || !teamId) {
    return res.status(400).json({
      error: 'batterId, date, and teamId are required'
    });
  }
  if (!isNumeric(batterId) || !isNumeric(teamId)) {
    return res.status(400).json({ error: 'batterId and teamId must be numeric' });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format, ex: ?date=2025-09-28' });
  }
  if ((lat !== undefined || lon !== undefined) && (!isNumeric(lat) || !isNumeric(lon))) {
    return res.status(400).json({ error: 'lat and lon must both be numeric' });
  }

  try {
    // STEP 1: Get schedule + probable pitcher
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&teamId=${teamId}&hydrate=probablePitcher,venue`;

    const scheduleData = await fetchJsonWithTimeout(scheduleUrl);

    const game = scheduleData.dates?.[0]?.games?.[0];

    if (!game) {
      return res.status(404).json({
        error: 'No game found for that team/date'
      });
    }

    const homeTeamId = String(game.teams?.home?.team?.id);
    const awayTeamId = String(game.teams?.away?.team?.id);
    const inputTeamId = String(teamId);

    let probablePitcher = null;
    let opponentTeam = null;

    if (inputTeamId === homeTeamId) {
      probablePitcher = game.teams?.away?.probablePitcher;
      opponentTeam = game.teams?.away?.team?.name;
    } else {
      probablePitcher = game.teams?.home?.probablePitcher;
      opponentTeam = game.teams?.home?.team?.name;
    }

    if (!probablePitcher?.id) {
      return res.status(404).json({
        error: 'No probable pitcher found'
      });
    }

    const pitcherId = probablePitcher.id;
    const stadium = game.venue?.name || 'Neutral Park';

    // STEP 2: Fetch batter + pitcher + gamelog
    const batterUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=[hitting],type=[vsPlayer,statSplits],sitCodes=[vl,vr],season=${season})`;
    const pitcherUrl = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;
    const gameLogUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=gameLog&group=hitting&season=${season}`;

    let batterData = await getCachedPlayer(batterId, season, 'hitting_splits');
    if (!batterData) {
      batterData = await fetchJsonWithTimeout(batterUrl);
      setCachedPlayer(batterId, season, 'hitting_splits', batterData);
    }

    let pitcherData = await getCachedPlayer(pitcherId, season, 'pitching');
    if (!pitcherData) {
      pitcherData = await fetchJsonWithTimeout(pitcherUrl);
      setCachedPlayer(pitcherId, season, 'pitching', pitcherData);
    }

    let gameLogData = await getCachedGameLog(batterId, season);
    if (!gameLogData) {
      gameLogData = await fetchJsonWithTimeout(gameLogUrl);
      setCachedGameLog(batterId, season, gameLogData);
    }

    // STEP 3: Weather (optional)
    let weatherData = null;

    if (lat && lon) {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
      weatherData = await fetchJsonWithTimeout(weatherUrl);
    }

    const batter = batterData.people?.[0];
    const pitcher = pitcherData.people?.[0];

    if (!batter || !pitcher) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // STEP 4: Split logic
    const pitcherHand = pitcher.pitchHand?.description;
    const batterStats = batter.stats || [];

    let splitData = [];

    for (const statGroup of batterStats) {
      if (statGroup.splits?.length > 0) {
        splitData = statGroup.splits;
        break;
      }
    }

    const vsLeft = splitData.find(s => s.split?.code === 'vl');
    const vsRight = splitData.find(s => s.split?.code === 'vr');
    const relevantSplit = pitcherHand === 'Left' ? vsLeft : vsRight;

    const pitcherStats = pitcher.stats?.[0]?.splits?.[0]?.stat || {};
    const gameLogSplits = gameLogData.stats?.[0]?.splits || [];

    const recency = calculateRecencyScore(gameLogSplits);

    // STEP 5: Weather adjustment
    let weather = null;
    let weatherImpact = { adjustment: 0, notes: [] };

    if (weatherData) {
      const current = weatherData.current || {};

      weather = {
        temperature: current.temperature_2m,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        time: current.time
      };

      weatherImpact = calculateWeatherAdjustment(weather);
    }

    // STEP 6: Final score
    const matchup = calculateMatchupScore({
      relevantSplit,
      pitcherStats,
      pitcherHand,
      stadium,
      parkFactors: PARK_FACTORS,
      recency,
      weatherAdjustment: weatherImpact.adjustment
    });

    const autoResult = {
      date,
      game: {
        venue: stadium,
        opponentTeam
      },
      batter: batter.fullName,
      probablePitcher: pitcher.fullName,
      splitUsed: pitcherHand === 'Left' ? 'vsLeftHandedPitching' : 'vsRightHandedPitching',
      matchupStats: matchup.matchupStats,
      parkFactors: matchup.parkFactorsUsed,
      parkAdjustment: matchup.parkAdjustment,
      weather,
      weatherImpact,
      recency,
      score: matchup.score,
      recommendation: matchup.recommendation
    };

    saveMatchupResult({
      batterId,
      pitcherId,
      batterName: batter.fullName,
      pitcherName: pitcher.fullName,
      season,
      stadium,
      score: matchup.score,
      recommendation: matchup.recommendation,
      fullResult: autoResult,
    });

    res.json(autoResult);

  } catch (error) {
    res.status(500).json({
      error: 'Failed to build auto matchup',
      details: error.message
    });
  }
});
// Career Head-to-Head Matchup Route
app.get('/career-matchup/batter/:batterId/pitcher/:pitcherId', async (req, res) => {
  const { batterId, pitcherId } = req.params;
  const season = req.query.season || DEFAULT_SEASON;

  if (!isNumeric(batterId) || !isNumeric(pitcherId)) {
    return res.status(400).json({ error: 'batterId and pitcherId must be numeric' });
  }

  try {
    const [h2hData, batterData, pitcherData] = await Promise.all([
      fetchJsonWithTimeout(
        `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=[hitting],type=[vsPlayerTotal],opposingPlayerId=${pitcherId})`
      ),
      fetchJsonWithTimeout(
        `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=[hitting],type=[season],season=${season})`
      ),
      fetchJsonWithTimeout(
        `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`
      ),
    ]);

    const h2hPerson     = h2hData.people?.[0];
    const batterPerson  = batterData.people?.[0];
    const pitcherPerson = pitcherData.people?.[0];

    const h2hStat   = h2hPerson?.stats?.find(s => s.type?.displayName === 'vsPlayerTotal')?.splits?.[0]?.stat || null;
    const batterStat  = batterPerson?.stats?.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat || null;
    const pitcherStat = pitcherPerson?.stats?.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat || null;

    // Compute wOBA from career H2H components
    let woba = null;
    if (h2hStat) {
      const ab  = parseInt(h2hStat.atBats)       || 0;
      const pa  = parseInt(h2hStat.plateAppearances) || ab;
      const h   = parseInt(h2hStat.hits)          || 0;
      const dbl = parseInt(h2hStat.doubles)       || 0;
      const tri = parseInt(h2hStat.triples)       || 0;
      const hr  = parseInt(h2hStat.homeRuns)      || 0;
      const bb  = parseInt(h2hStat.baseOnBalls)   || 0;
      const singles = Math.max(0, h - dbl - tri - hr);
      if (pa > 0) {
        woba = Math.round(((bb*0.690 + singles*0.888 + dbl*1.271 + tri*1.616 + hr*2.101) / pa) * 1000) / 1000;
      }
    }

    res.json({
      batter: {
        id:         parseInt(batterId),
        fullName:   batterPerson?.fullName   || h2hPerson?.fullName,
        team:       batterPerson?.currentTeam?.name,
        teamAbbrev: batterPerson?.currentTeam?.abbreviation,
        position:   batterPerson?.primaryPosition?.abbreviation,
        batSide:    batterPerson?.batSide?.code,
        seasonAvg:  batterStat?.avg  || null,
        seasonOps:  batterStat?.ops  || null,
        seasonHr:   parseInt(batterStat?.homeRuns) || null,
        seasonRbi:  parseInt(batterStat?.rbi)      || null,
      },
      pitcher: {
        id:              parseInt(pitcherId),
        fullName:        pitcherPerson?.fullName,
        team:            pitcherPerson?.currentTeam?.name,
        teamAbbrev:      pitcherPerson?.currentTeam?.abbreviation,
        pitchHand:       pitcherPerson?.pitchHand?.code,
        era:             parseFloat(pitcherStat?.era)               || null,
        whip:            parseFloat(pitcherStat?.whip)              || null,
        k9:              parseFloat(pitcherStat?.strikeoutsPer9Inn) || null,
        wins:            parseInt(pitcherStat?.wins)                || null,
        losses:          parseInt(pitcherStat?.losses)              || null,
        inningsPitched:  pitcherStat?.inningsPitched                || null,
        strikeOuts:      parseInt(pitcherStat?.strikeOuts)          || null,
        avgAgainst:      pitcherStat?.avg                           || null,
      },
      careerMatchup: h2hStat ? {
        atBats:           parseInt(h2hStat.atBats)           || 0,
        plateAppearances: parseInt(h2hStat.plateAppearances) || 0,
        hits:             parseInt(h2hStat.hits)             || 0,
        singles:          Math.max(0, (parseInt(h2hStat.hits)||0)-(parseInt(h2hStat.doubles)||0)-(parseInt(h2hStat.triples)||0)-(parseInt(h2hStat.homeRuns)||0)),
        doubles:          parseInt(h2hStat.doubles)          || 0,
        triples:          parseInt(h2hStat.triples)          || 0,
        homeRuns:         parseInt(h2hStat.homeRuns)         || 0,
        rbi:              parseInt(h2hStat.rbi)              || 0,
        baseOnBalls:      parseInt(h2hStat.baseOnBalls)      || 0,
        strikeOuts:       parseInt(h2hStat.strikeOuts)       || 0,
        avg:              parseFloat(h2hStat.avg)            || null,
        obp:              parseFloat(h2hStat.obp)            || null,
        slg:              parseFloat(h2hStat.slg)            || null,
        ops:              parseFloat(h2hStat.ops)            || null,
        woba,
      } : null,
      hasData: !!h2hStat && (parseInt(h2hStat.atBats) || 0) > 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch career matchup', details: error.message });
  }
});

// Statcast Leaderboard Route (merges Baseball Savant expected stats + exit velocity)
// Source 1: expected_statistics → est_woba (xwOBA)
// Source 2: statcast leaderboard → brl_percent (barrel%), ev95percent (hard hit 95+ mph%)
app.get('/statcast/batters', async (req, res) => {
  const now = Date.now();
  if (statcastCache && now - statcastCacheTs < STATCAST_TTL) {
    return res.json(statcastCache);
  }
  try {
    const year = req.query.season || DEFAULT_SEASON;
    const [xwobaText, evText] = await Promise.all([
      fetchTextWithTimeout(
        `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${year}&position=&team=&min=10&csv=true`,
        15000
      ),
      fetchTextWithTimeout(
        `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${year}&position=&team=&min=10&csv=true`,
        15000
      ),
    ]);

    const xwobaRows = parseCSV(xwobaText);
    const evRows    = parseCSV(evText);

    // Build xwOBA map
    const result = {};
    for (const row of xwobaRows) {
      const pid = parseInt(row.player_id);
      if (!pid) continue;
      result[pid] = {
        xwoba:      parseFloat(row.est_woba)   || null,
        barrelPct:  null,
        hardHitPct: null,
        exitVelo:   null,
      };
    }

    // Merge barrel% + hard hit% from EV leaderboard
    for (const row of evRows) {
      const pid = parseInt(row.player_id);
      if (!pid) continue;
      const brl = parseFloat(row.brl_percent)  || null;
      const ev  = parseFloat(row.ev95percent)  || null;
      const avg = parseFloat(row.avg_hit_speed)|| null;
      if (result[pid]) {
        result[pid].barrelPct  = brl;
        result[pid].hardHitPct = ev;
        result[pid].exitVelo   = avg;
      } else {
        result[pid] = { xwoba: null, barrelPct: brl, hardHitPct: ev, exitVelo: avg };
      }
    }

    statcastCache = result;
    statcastCacheTs = now;
    res.json(result);
  } catch (error) {
    if (statcastCache) return res.json(statcastCache); // serve stale on error
    res.status(500).json({ error: 'Failed to fetch Statcast data', details: error.message });
  }
});

// Pitcher Game Log Route
app.get('/pitcher/:id/gamelog', async (req, res) => {
  const pitcherId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=gameLog&group=pitching&season=${season}`;
    const data = await fetchJsonWithTimeout(url);
    const splits = data.stats?.[0]?.splits || [];

    const starts = splits.map(game => ({
      date:           game.date,
      opponent:       game.opponent?.name || null,
      isHome:         game.isHome ?? null,
      inningsPitched: game.stat?.inningsPitched || '0.0',
      strikeOuts:     Number(game.stat?.strikeOuts       || 0),
      baseOnBalls:    Number(game.stat?.baseOnBalls      || 0),
      homeRuns:       Number(game.stat?.homeRuns         || 0),
      earnedRuns:     Number(game.stat?.earnedRuns       || 0),
      hits:           Number(game.stat?.hits             || 0),
      pitchesThrown:  Number(game.stat?.numberOfPitches  || 0),
      isWin:          Number(game.stat?.wins   || 0) > 0,
      isLoss:         Number(game.stat?.losses || 0) > 0,
    }));

    res.json({ starts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pitcher game log', details: error.message });
  }
});

// Pitcher Splits Route (vs LHB / vs RHB)
app.get('/pitcher/:id/splits', async (req, res) => {
  const pitcherId = req.params.id;
  const season = req.query.season || DEFAULT_SEASON;

  try {
    const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[statSplits],sitCodes=[vl,vr],season=${season})`;
    const data = await fetchJsonWithTimeout(url);
    const pitcher = data.people?.[0];
    if (!pitcher) return res.status(404).json({ error: 'Pitcher not found' });

    const stats = pitcher.stats || [];
    let splitData = [];
    for (const statGroup of stats) {
      if (statGroup.splits?.length > 0) { splitData = statGroup.splits; break; }
    }

    const vsLeft  = splitData.find(s => s.split?.code === 'vl');
    const vsRight = splitData.find(s => s.split?.code === 'vr');

    const fmtSplit = (s) => {
      if (!s) return null;
      const bf = Number(s.stat?.battersFaced || 0);
      const k  = Number(s.stat?.strikeOuts   || 0);
      const bb = Number(s.stat?.baseOnBalls  || 0);
      return {
        gamesPlayed:  Number(s.stat?.gamesPlayed || 0),
        battersFaced: bf,
        strikeOuts:   k,
        baseOnBalls:  bb,
        homeRuns:     Number(s.stat?.homeRuns || 0),
        hits:         Number(s.stat?.hits     || 0),
        avg:          s.stat?.avg  || null,
        obp:          s.stat?.obp  || null,
        slg:          s.stat?.slg  || null,
        ops:          s.stat?.ops  || null,
        kPct:         bf > 0 ? k / bf : null,
        bbPct:        bf > 0 ? bb / bf : null,
      };
    };

    res.json({
      pitcherId, season,
      splits: {
        vsLeftHandedBatters:  fmtSplit(vsLeft),
        vsRightHandedBatters: fmtSplit(vsRight),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pitcher splits', details: error.message });
  }
});

// ─── PrizePicks MLB proxy (avoids browser CORS) ──────────────────────────────
app.get('/prizepicks/mlb', async (req, res) => {
  try {
    const response = await fetch('https://api.prizepicks.com/projections?league_id=2', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MLBAnalytics/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://app.prizepicks.com/',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`PrizePicks returned ${response.status}`);
    const data = await response.json();

    // Build player name map from included resources
    const playerMap = {};
    (data.included || []).forEach(item => {
      if (item.type === 'new_player') {
        playerMap[item.id] = item.attributes?.display_name || '';
      }
    });

    const STAT_MAP = {
      'Strikeouts':      'strikeouts',
      'Hits':            'hits',
      'Home Runs':       'hr',
      'Runs':            'runs',
      'RBIs':            'rbi',
      'Stolen Bases':    'sb',
      'Walks':           'walks',
      'Innings Pitched': 'ip',
      'Pitching Outs':   'outs',
      'Hits+Runs+RBIs':  'hrr',
    };

    const lines = {};
    (data.data || []).forEach(proj => {
      const playerId = proj.relationships?.new_player?.data?.id;
      const name = playerMap[playerId];
      if (!name) return;
      const stat = STAT_MAP[proj.attributes?.stat_type];
      if (!stat) return;
      const line = parseFloat(proj.attributes?.line_score);
      if (isNaN(line)) return;
      if (!lines[name]) lines[name] = {};
      lines[name][stat] = line;
    });

    res.json({ lines, updated: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PrizePicks', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});