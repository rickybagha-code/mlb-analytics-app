function calculateMatchupScore({
  relevantSplit,
  pitcherStats,
  pitcherHand,
  stadium,
  parkFactors,
  recency
}) {
  const avg = parseFloat(relevantSplit?.stat?.avg || 0);
  const ops = parseFloat(relevantSplit?.stat?.ops || 0);
  const hr = Number(relevantSplit?.stat?.homeRuns || 0);
  const ab = Number(relevantSplit?.stat?.atBats || 1);

  const hrRate = ab > 0 ? hr / ab : 0;

  const pitcherERA = parseFloat(pitcherStats?.era || 4.00);
  const hrAllowed = Number(pitcherStats?.homeRuns || 0);
  const innings = parseFloat(pitcherStats?.inningsPitched || 1);
  const hitsAllowed = Number(pitcherStats?.hits || 0);

  const hrAllowedRate = innings > 0 ? hrAllowed / innings : 0;
  const hitsAllowedRate = innings > 0 ? hitsAllowed / innings : 0;

  const park = parkFactors[stadium] || { runFactor: 1.0, hrFactor: 1.0 };

  let score = 0;

  if (avg > 0.320) score += 12;
  else if (avg > 0.300) score += 10;
  else if (avg > 0.275) score += 7;
  else if (avg > 0.250) score += 4;

  if (ops > 1.000) score += 12;
  else if (ops > 0.900) score += 10;
  else if (ops > 0.800) score += 7;
  else if (ops > 0.700) score += 4;

  if (hrRate > 0.070) score += 10;
  else if (hrRate > 0.050) score += 7;
  else if (hrRate > 0.035) score += 4;
  else if (hrRate > 0.020) score += 2;

  if (pitcherERA > 4.50) score += 10;
  else if (pitcherERA > 4.00) score += 7;
  else if (pitcherERA > 3.50) score += 4;

  if (hrAllowedRate > 0.15) score += 10;
  else if (hrAllowedRate > 0.10) score += 7;
  else if (hrAllowedRate > 0.07) score += 4;

  if (hitsAllowedRate > 1.0) score += 6;
  else if (hitsAllowedRate > 0.9) score += 4;

  let parkAdjustment = 0;

  if (park.runFactor >= 1.10) parkAdjustment += 5;
  else if (park.runFactor >= 1.05) parkAdjustment += 3;
  else if (park.runFactor <= 0.95) parkAdjustment -= 3;

  if (park.hrFactor >= 1.15) parkAdjustment += 6;
  else if (park.hrFactor >= 1.08) parkAdjustment += 4;
  else if (park.hrFactor <= 0.92) parkAdjustment -= 4;

  score += parkAdjustment;
  score += Number(recency?.score || 0);

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  let recommendation = 'No strong edge';

  if (score >= 75) recommendation = '🔥 STRONG PLAY';
  else if (score >= 60) recommendation = '✅ Good Value';
  else if (score >= 45) recommendation = '⚖️ Lean';

  return {
    score,
    recommendation,
    parkAdjustment,
    parkFactorsUsed: park,
    matchupStats: {
      battingAverage: avg,
      ops,
      hrRate: hrRate.toFixed(3),
      pitcherERA,
      hrAllowedRate: hrAllowedRate.toFixed(3),
      hitsAllowedRate: hitsAllowedRate.toFixed(3),
      pitcherHand
    }
  };
}

module.exports = { calculateMatchupScore };