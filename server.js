require('dotenv').config();
console.log("RUNNING MLB ANALYTICS SERVER");

const express = require('express');
const { calculateRecencyScore } = require('./services/recencyLogic');
const { calculateMatchupScore } = require('./services/matchupLogic');
const { calculateWeatherAdjustment } = require('./services/weatherLogic');
const { PARK_FACTORS } = require('./services/parkFactors');

const PORT = process.env.PORT || 3001;
const DEFAULT_SEASON = process.env.DEFAULT_SEASON || '2025';

const app = express();

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

    const games = last10.map(game => ({
      date: game.date,
      opponent: game.opponent?.name || null,
      hits: Number(game.stat?.hits || 0),
      homeRuns: Number(game.stat?.homeRuns || 0),
      atBats: Number(game.stat?.atBats || 0)
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

    const batterData = await fetchJsonWithTimeout(batterUrl);
    const pitcherData = await fetchJsonWithTimeout(pitcherUrl);
    const gameLogData = await fetchJsonWithTimeout(gameLogUrl);

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

    res.json({
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
    });
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
      awayTeam: game.teams?.away?.team?.name,
      awayProbablePitcher: game.teams?.away?.probablePitcher?.fullName || null,
      awayProbablePitcherId: game.teams?.away?.probablePitcher?.id || null,
      homeTeam: game.teams?.home?.team?.name,
      homeProbablePitcher: game.teams?.home?.probablePitcher?.fullName || null,
      homeProbablePitcherId: game.teams?.home?.probablePitcher?.id || null
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

    const batterData = await fetchJsonWithTimeout(batterUrl);
    const pitcherData = await fetchJsonWithTimeout(pitcherUrl);
    const gameLogData = await fetchJsonWithTimeout(gameLogUrl);

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

    res.json({
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
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to build auto matchup',
      details: error.message
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});