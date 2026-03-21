console.log("RUNNING MLB ANALYTICS SERVER");

const express = require('express');
const app = express();
async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} for ${url}`);
  }

  return response.json();
}
const { calculateRecencyScore } = require('./services/recencyLogic');
const { calculateMatchupScore } = require('./services/matchupLogic');
const { calculateWeatherAdjustment } = require('./services/weatherLogic');
const PARK_FACTORS = {
    "Yankee Stadium": { runFactor: 1.05, hrFactor: 1.12 },
    "Coors Field": { runFactor: 1.20, hrFactor: 1.25 },
    "Citizens Bank Park": { runFactor: 1.08, hrFactor: 1.10 },
    "Dodger Stadium": { runFactor: 0.98, hrFactor: 0.95 },
    "Oracle Park": { runFactor: 0.92, hrFactor: 0.85 },
    "Petco Park": { runFactor: 0.94, hrFactor: 0.90 },
    "Tropicana Field": { runFactor: 0.95, hrFactor: 0.92 },
    "Camden Yards": { runFactor: 1.02, hrFactor: 0.96 },
    "Fenway Park": { runFactor: 1.04, hrFactor: 1.01 },
    "Globe Life Field": { runFactor: 0.99, hrFactor: 0.97 }
};

app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    res.send('Server is running 🚀');
});

app.get('/player-test', (req, res) => {
    res.send('player test route works');
});

app.get('/player/:id', async (req, res) => {
    const playerId = req.params.id;
    const season = req.query.season || '2025';

    try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting],type=[season],season=${season})`;

        console.log("Fetching URL:", url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`MLB API returned status ${response.status}`);
        }

        const data = await response.json();
        const player = data.people?.[0];

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        //Player Route LAST 10
        const playerInfo = {
            id: player.id,
            fullName: player.fullName,
            team: player.currentTeam?.name,
            position: player.primaryPosition?.name
        };

        const hittingStats = player.stats?.[0]?.splits?.[0]?.stat || null;

        res.json({
            season,
            player: playerInfo,
            hittingStats
        });
    } catch (error) {
        console.error("FULL ERROR:", error);
        res.status(500).json({
            error: 'Failed to fetch data',
            details: error.message
        });
    }
});

app.get('/player/:id/gamelog', async (req, res) => {
    const playerId = req.params.id;
    const season = req.query.season || '2025';

    try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;

        console.log("Fetching game logs:", url);

        const response = await fetch(url);
        const data = await response.json();

        const splits = data.stats?.[0]?.splits || [];

        const last10 = splits.slice(-10);

        const formatted = last10.map(game => ({
            date: game.date,
            opponent: game.opponent?.name,
            hits: game.stat.hits,
            homeRuns: game.stat.homeRuns,
            atBats: game.stat.atBats
        }));

        res.json({
            games: formatted
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch game logs' });
    }
});
app.get('/player/:id/trends', async (req, res) => {
    const playerId = req.params.id;
    const season = req.query.season || '2025';

    try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;

        console.log("Fetching trends from:", url);

        const response = await fetch(url);
        const data = await response.json();

        const splits = data.stats?.[0]?.splits || [];
        const last10 = splits.slice(-10);

        const totals = last10.reduce(
            (acc, game) => {
                const hits = Number(game.stat.hits || 0);
                const homeRuns = Number(game.stat.homeRuns || 0);
                const atBats = Number(game.stat.atBats || 0);

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
        console.error("Error fetching trends:", error);
        res.status(500).json({ error: "Failed to fetch trends" });
    }
});
app.get('/player/:id/recommendation', async (req, res) => {
    const playerId = req.params.id;
    const season = req.query.season || '2025';

    try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`;

        const response = await fetch(url);
        const data = await response.json();

        const splits = data.stats?.[0]?.splits || [];
        const last10 = splits.slice(-10);

        const totals = last10.reduce(
            (acc, game) => {
                const hits = Number(game.stat.hits || 0);
                const homeRuns = Number(game.stat.homeRuns || 0);

                acc.totalHits += hits;
                acc.totalHomeRuns += homeRuns;
                acc.hitGames += hits > 0 ? 1 : 0;

                return acc;
            },
            {
                totalHits: 0,
                totalHomeRuns: 0,
                hitGames: 0
            }
        );

        const games = last10.length;
        const avgHits = totals.totalHits / games;
        const hrRate = totals.totalHomeRuns / games;
        const hitRate = totals.hitGames / games;

        // 🔥 Simple Recommendation Logic
        let recommendation = [];

        if (avgHits >= 1.2) {
            recommendation.push("🔥 Over 0.5 Hits (Strong)");
        }

        if (hitRate >= 0.7) {
            recommendation.push("✅ Hit in Game (Very Likely)");
        }

        if (hrRate >= 0.3) {
            recommendation.push("💣 HR Prop Value");
        }

        if (recommendation.length === 0) {
            recommendation.push("No strong edge");
        }

        res.json({
            playerId,
            season,
            metrics: {
                avgHits: avgHits.toFixed(2),
                hitRate: hitRate.toFixed(2),
                hrRate: hrRate.toFixed(2)
            },
            recommendation
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate recommendation' });
    }
});
//Player Pitch/Bat SPLITS
app.get('/player/:id/splits', async (req, res) => {
    const playerId = req.params.id;
    const season = req.query.season || '2025';

    try {
        const url = `https://statsapi.mlb.com/api/v1/people/${playerId}?hydrate=stats(group=[hitting],type=[vsPlayer,statSplits],sitCodes=[vl,vr],season=${season})`;

        console.log("Fetching player splits:", url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`MLB API returned status ${response.status}`);
        }

        const data = await response.json();
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
                gamesPlayed: split.stat.gamesPlayed || 0,
                plateAppearances: split.stat.plateAppearances || 0,
                atBats: split.stat.atBats || 0,
                hits: split.stat.hits || 0,
                homeRuns: split.stat.homeRuns || 0,
                strikeOuts: split.stat.strikeOuts || 0,
                baseOnBalls: split.stat.baseOnBalls || 0,
                avg: split.stat.avg || null,
                obp: split.stat.obp || null,
                slg: split.stat.slg || null,
                ops: split.stat.ops || null
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
        console.error("Error fetching splits:", error);
        res.status(500).json({
            error: 'Failed to fetch splits',
            details: error.message
        });
    }
});
// Pitcher Route - Pitcher vs Batter
app.get('/pitcher/:id', async (req, res) => {
    const pitcherId = req.params.id;
    const season = req.query.season || '2025';

    try {
        const url = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;

        console.log("Fetching pitcher data:", url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`MLB API returned status ${response.status}`);
        }

        const data = await response.json();
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
                wins: pitchingStats.wins || 0,
                losses: pitchingStats.losses || 0,
                era: pitchingStats.era || null,
                inningsPitched: pitchingStats.inningsPitched || null,
                hitsAllowed: pitchingStats.hits || 0,
                homeRunsAllowed: pitchingStats.homeRuns || 0,
                strikeOuts: pitchingStats.strikeOuts || 0,
                baseOnBalls: pitchingStats.baseOnBalls || 0,
                whip: pitchingStats.whip || null,
                avgAgainst: pitchingStats.avg || null
            }
        });
    } catch (error) {
        console.error("Error fetching pitcher data:", error);
        res.status(500).json({
            error: 'Failed to fetch pitcher data',
            details: error.message
        });
    }
    // Matchup LOGIC (Advanced)
});
app.get('/matchup/batter/:batterId/pitcher/:pitcherId', async (req, res) => {
  const batterId = req.params.batterId;
  const pitcherId = req.params.pitcherId;
  const season = req.query.season || '2025';
  const stadium = req.query.stadium || 'Neutral Park';
  const lat = req.query.lat;
  const lon = req.query.lon;

  try {
    const batterUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=[hitting],type=[vsPlayer,statSplits],sitCodes=[vl,vr],season=${season})`;
    const pitcherUrl = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;
    const gameLogUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=gameLog&group=hitting&season=${season}`;

    const batterData = await fetchJsonWithTimeout(batterUrl, 8000);
    const pitcherData = await fetchJsonWithTimeout(pitcherUrl, 8000);
    const gameLogData = await fetchJsonWithTimeout(gameLogUrl, 8000);

    let weatherData = null;

    if (lat && lon) {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
      weatherData = await fetchJsonWithTimeout(weatherUrl, 8000);
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
    console.error('Matchup error:', error);
    res.status(500).json({
      error: 'Failed to calculate matchup',
      details: error.message
    });
  }
});
    // Probable Pitcher Route
    app.get('/games/probables', async (req, res) => {
        console.log('HIT /games/probables route');

        const date = req.query.date;
        const teamId = req.query.teamId || '';

        if (!date) {
            return res.status(400).json({
                error: 'date query parameter is required, ex: ?date=2025-09-28'
            });
        }

        try {
            let url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,venue`;

            if (teamId) {
                url += `&teamId=${teamId}`;
            }

            const data = await fetchJsonWithTimeout(url, 8000);

            if (!response.ok) {
                throw new Error(`MLB API returned status ${response.status}`);
            }

            const games = (data.dates?.[0]?.games || []).map(game => ({
                gamePk: game.gamePk,
                gameDate: game.gameDate,
                status: game.status?.detailedState,
                venue: {
                    id: game.venue?.id,
                    name: game.venue?.name
                },
                away: {
                    teamId: game.teams?.away?.team?.id,
                    teamName: game.teams?.away?.team?.name,
                    probablePitcher: game.teams?.away?.probablePitcher
                        ? {
                            id: game.teams.away.probablePitcher.id,
                            fullName: game.teams.away.probablePitcher.fullName
                        }
                        : null
                },
                home: {
                    teamId: game.teams?.home?.team?.id,
                    teamName: game.teams?.home?.team?.name,
                    probablePitcher: game.teams?.home?.probablePitcher
                        ? {
                            id: game.teams.home.probablePitcher.id,
                            fullName: game.teams.home.probablePitcher.fullName
                        }
                        : null
                }
            }));

            res.json({ date, games });
        } catch (error) {
            console.error('Error fetching probable pitchers:', error);
            res.status(500).json({
                error: 'Failed to fetch probable pitchers',
                details: error.message
            });
        }
    });

    // Weather Route
    app.get('/weather', async (req, res) => {
        const latitude = req.query.lat;
        const longitude = req.query.lon;

        if (!latitude || !longitude) {
            return res.status(400).json({
                error: 'lat and lon query parameters are required'
            });
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Open-Meteo API returned status ${response.status}`);
            }

            const data = await response.json();
            const current = data.current || {};

            const weather = {
                temperature: current.temperature_2m ?? null,
                windSpeed: current.wind_speed_10m ?? null,
                windDirection: current.wind_direction_10m ?? null,
                time: current.time ?? null
            };

            const weatherImpact = calculateWeatherAdjustment(weather);

            res.json({
                location: {
                    latitude: Number(latitude),
                    longitude: Number(longitude)
                },
                weather,
                weatherImpact
            });
        } catch (error) {
            console.error('Error fetching weather:', error);
            res.status(500).json({
                error: 'Failed to fetch weather',
                details: error.message
            });
        }
    });

    // Game Context Route
    app.get('/game-context', async (req, res) => {
        const date = req.query.date;
        const teamId = req.query.teamId || '';
        const lat = req.query.lat;
        const lon = req.query.lon;

        if (!date) {
            return res.status(400).json({ error: 'date is required' });
        }

        if (!lat || !lon) {
            return res.status(400).json({ error: 'lat and lon are required' });
        }

        try {
            let scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&hydrate=probablePitcher,venue`;

            if (teamId) {
                scheduleUrl += `&teamId=${teamId}`;
            }

            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;

            const [scheduleRes, weatherRes] = await Promise.all([
                fetch(scheduleUrl),
                fetch(weatherUrl)
            ]);

            if (!scheduleRes.ok) {
                throw new Error(`MLB API returned status ${scheduleRes.status}`);
            }

            if (!weatherRes.ok) {
                throw new Error(`Open-Meteo API returned status ${weatherRes.status}`);
            }

            const scheduleData = await scheduleRes.json();
            const weatherData = await weatherRes.json();

            const games = (scheduleData.dates?.[0]?.games || []).map(game => ({
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

            const current = weatherData.current || {};
            const weather = {
                temperature: current.temperature_2m ?? null,
                windSpeed: current.wind_speed_10m ?? null,
                windDirection: current.wind_direction_10m ?? null,
                time: current.time ?? null
            };

            const weatherImpact = calculateWeatherAdjustment(weather);

            res.json({
                date,
                games,
                weather,
                weatherImpact
            });
        } catch (error) {
            console.error('Error fetching game context:', error);
            res.status(500).json({
                error: 'Failed to fetch game context',
                details: error.message
            });
        }
    });
    //AUTO Match Route
app.get('/auto-matchup', async (req, res) => {
  const batterId = req.query.batterId;
  const date = req.query.date;
  const teamId = req.query.teamId;
  const season = req.query.season || '2025';
  const lat = req.query.lat;
  const lon = req.query.lon;

  if (!batterId || !date || !teamId) {
    return res.status(400).json({
      error: 'batterId, date, and teamId are required'
    });
  }

  try {
    console.log('AUTO MATCHUP START');

    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}&teamId=${teamId}&hydrate=probablePitcher,venue`;
    const batterUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}?hydrate=stats(group=[hitting],type=[vsPlayer,statSplits],sitCodes=[vl,vr],season=${season})`;
    const gameLogUrl = `https://statsapi.mlb.com/api/v1/people/${batterId}/stats?stats=gameLog&group=hitting&season=${season}`;

    console.log('Fetching schedule...');
    const scheduleRes = await fetch(scheduleUrl);
    console.log('Schedule done:', scheduleRes.status);

    console.log('Fetching batter...');
    const batterRes = await fetch(batterUrl);
    console.log('Batter done:', batterRes.status);

    console.log('Fetching gamelog...');
    const gameLogRes = await fetch(gameLogUrl);
    console.log('Gamelog done:', gameLogRes.status);

    let weatherRes = null;
    if (lat && lon) {
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`;
      console.log('Fetching weather...');
      weatherRes = await fetch(weatherUrl);
      console.log('Weather done:', weatherRes.status);
    }

    if (!scheduleRes.ok) {
      throw new Error(`Schedule API returned status ${scheduleRes.status}`);
    }

    if (!batterRes.ok) {
      throw new Error(`Batter API returned status ${batterRes.status}`);
    }

    if (!gameLogRes.ok) {
      throw new Error(`Game log API returned status ${gameLogRes.status}`);
    }

    if (weatherRes && !weatherRes.ok) {
      throw new Error(`Weather API returned status ${weatherRes.status}`);
    }

    const scheduleData = await scheduleRes.json();
    const batterData = await batterRes.json();
    const gameLogData = await gameLogRes.json();
    const weatherData = weatherRes ? await weatherRes.json() : null;

    console.log('JSON parsing done');

    const game = scheduleData.dates?.[0]?.games?.[0];

    if (!game) {
      return res.status(404).json({ error: 'No game found for that team/date' });
    }

    const homeTeamId = String(game.teams?.home?.team?.id || '');
    const awayTeamId = String(game.teams?.away?.team?.id || '');
    const inputTeamId = String(teamId);

    let probablePitcher = null;
    let opponentTeam = null;

    if (inputTeamId === homeTeamId) {
      probablePitcher = game.teams?.away?.probablePitcher || null;
      opponentTeam = game.teams?.away?.team?.name || null;
    } else if (inputTeamId === awayTeamId) {
      probablePitcher = game.teams?.home?.probablePitcher || null;
      opponentTeam = game.teams?.home?.team?.name || null;
    } else {
      return res.status(400).json({ error: 'Provided teamId did not match the returned game' });
    }

    if (!probablePitcher?.id) {
      return res.status(404).json({
        error: 'No probable pitcher found for opponent in this game'
      });
    }

    const pitcherId = probablePitcher.id;
    const stadium = game.venue?.name || 'Neutral Park';

    const pitcherUrl = `https://statsapi.mlb.com/api/v1/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;

    console.log('Fetching pitcher...');
    const pitcherRes = await fetch(pitcherUrl);
    console.log('Pitcher done:', pitcherRes.status);

    if (!pitcherRes.ok) {
      throw new Error(`Pitcher API returned status ${pitcherRes.status}`);
    }

    const pitcherData = await pitcherRes.json();

    const batter = batterData.people?.[0];
    const pitcher = pitcherData.people?.[0];

    if (!batter || !pitcher) {
      return res.status(404).json({ error: 'Batter or pitcher not found' });
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

    console.log('AUTO MATCHUP SUCCESS');

    res.json({
      date,
      season,
      game: {
        gamePk: game.gamePk,
        venue: stadium,
        homeTeam: game.teams?.home?.team?.name || null,
        awayTeam: game.teams?.away?.team?.name || null,
        opponentTeam
      },
      batter: {
        id: batter.id,
        fullName: batter.fullName
      },
      probablePitcher: {
        id: pitcher.id,
        fullName: pitcher.fullName,
        pitchHand: pitcherHand
      },
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
    console.error('Auto-matchup error:', error);
    res.status(500).json({
      error: 'Failed to build auto matchup',
      details: error.message
    });
  }
});
    app.listen(3001, () => {
        console.log('Server running on port 3001');
    });