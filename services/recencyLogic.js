function calculateRecencyScore(games) {
  const last10 = games.slice(-10);
  const last5 = games.slice(-5);

  const sumStat = (gameList, statName) =>
    gameList.reduce((sum, game) => sum + Number(game.stat?.[statName] || 0), 0);

  const last10Hits = sumStat(last10, 'hits');
  const last10HR = sumStat(last10, 'homeRuns');
  const last10AtBats = sumStat(last10, 'atBats');

  const last5Hits = sumStat(last5, 'hits');
  const last5HR = sumStat(last5, 'homeRuns');
  const last5AtBats = sumStat(last5, 'atBats');

  const hitGamesLast10 = last10.filter(game => Number(game.stat?.hits || 0) > 0).length;
  const hitGamesLast5 = last5.filter(game => Number(game.stat?.hits || 0) > 0).length;

  const avgHitsLast10 = last10.length ? last10Hits / last10.length : 0;
  const avgHitsLast5 = last5.length ? last5Hits / last5.length : 0;

  const battingAvgLast10 = last10AtBats > 0 ? last10Hits / last10AtBats : 0;
  const battingAvgLast5 = last5AtBats > 0 ? last5Hits / last5AtBats : 0;

  let score = 0;

  if (avgHitsLast10 >= 1.2) score += 4;
  else if (avgHitsLast10 >= 1.0) score += 3;
  else if (avgHitsLast10 >= 0.8) score += 2;

  if (avgHitsLast5 >= 1.4) score += 5;
  else if (avgHitsLast5 >= 1.0) score += 4;
  else if (avgHitsLast5 >= 0.8) score += 2;

  if (battingAvgLast10 >= 0.300) score += 3;
  else if (battingAvgLast10 >= 0.275) score += 2;

  if (battingAvgLast5 >= 0.320) score += 4;
  else if (battingAvgLast5 >= 0.280) score += 2;

  if (last10HR >= 3) score += 3;
  if (last5HR >= 2) score += 3;

  if (hitGamesLast10 >= 7) score += 2;
  if (hitGamesLast5 >= 4) score += 2;

  if (score > 25) score = 25;

  return {
    score,
    summary: {
      last10: {
        games: last10.length,
        hits: last10Hits,
        homeRuns: last10HR,
        atBats: last10AtBats,
        avgHitsPerGame: avgHitsLast10.toFixed(2),
        battingAverage: battingAvgLast10.toFixed(3),
        hitGames: hitGamesLast10
      },
      last5: {
        games: last5.length,
        hits: last5Hits,
        homeRuns: last5HR,
        atBats: last5AtBats,
        avgHitsPerGame: avgHitsLast5.toFixed(2),
        battingAverage: battingAvgLast5.toFixed(3),
        hitGames: hitGamesLast5
      }
    }
  };
}

module.exports = { calculateRecencyScore };