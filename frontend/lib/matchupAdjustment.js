// ─── Matchup EdgeScore Adjustment ────────────────────────────────────────────
// Applies a ±15% multiplicative adjustment to existing EdgeScores based on
// pitch type matchup analysis, platoon edge, and career H2H.
// PURELY ADDITIVE — never replaces or refactors existing calculation.
// On ANY data fetch failure, returns original score unchanged.

/**
 * @param {number} existingScore   — current EdgeScore (0–100)
 * @param {number} mismatchScore   — 0–100 (50 = neutral, 65+ = batter edge)
 * @param {number} primaryPitchWobaEdge — batter wOBA vs primary pitch minus league avg
 * @param {number|null} h2hAvg    — career batting avg vs this pitcher (null = no data)
 * @param {number} h2hAB          — career AB vs this pitcher
 * @param {string} propType       — 'hits'|'hr'|'runs'|'rbi'|'strikeouts'|'sb'
 * @returns {{ multiplier, adjustedPoints, direction, mismatchScore, applied }}
 */
export function calculateEdgeScoreAdjustment(
  existingScore,
  mismatchScore,
  primaryPitchWobaEdge,
  h2hAvg,
  h2hAB,
  propType
) {
  // SB is independent of pitch matchup — never adjust
  if (propType === 'sb') {
    return { multiplier: 1, adjustedPoints: 0, direction: 'neutral', mismatchScore, applied: false };
  }

  // Normalize mismatch score: 50 = neutral → 0, range -1 to +1
  const mismatchNorm = (mismatchScore - 50) / 50;

  // Pitch wOBA edge contribution (primary signal)
  const pitchEdgeNorm = Math.max(-1, Math.min(1, primaryPitchWobaEdge / 0.150));

  // H2H contribution (only if reliable sample — 10+ AB)
  let h2hNorm = 0;
  if (h2hAvg !== null && h2hAB >= 10) {
    h2hNorm = Math.max(-1, Math.min(1, (h2hAvg - 0.260) / 0.100));
  }

  // Prop-specific weights
  const weights = {
    hits:       { mismatch: 0.08, pitch: 0.07, h2h: 0.05 },
    hr:         { mismatch: 0.06, pitch: 0.09, h2h: 0.05 },
    runs:       { mismatch: 0.07, pitch: 0.06, h2h: 0.04 },
    rbi:        { mismatch: 0.07, pitch: 0.06, h2h: 0.05 },
    strikeouts: { mismatch: 0.09, pitch: 0.08, h2h: 0.03 },
    sb:         { mismatch: 0,    pitch: 0,    h2h: 0    },
  };

  const w = weights[propType] ?? weights.hits;
  const rawAdj = mismatchNorm * w.mismatch + pitchEdgeNorm * w.pitch + h2hNorm * w.h2h;

  // Maximum ±15% adjustment, strictly clamped
  const multiplier = Math.max(0.85, Math.min(1.15, 1 + rawAdj));
  const adjustedScore = Math.max(0, Math.min(100, Math.round(existingScore * multiplier)));
  const adjustedPoints = adjustedScore - existingScore;

  return {
    multiplier,
    adjustedPoints,
    direction: adjustedPoints > 2 ? 'up' : adjustedPoints < -2 ? 'down' : 'neutral',
    mismatchScore,
    applied: true,
  };
}

/**
 * Safe wrapper — always returns original score on any failure.
 */
export async function getMatchupAdjustedScore(existingScore, batterId, pitcherId, propType) {
  if (!pitcherId) return existingScore;
  try {
    const res = await fetch(
      `/api/matchup/adjustment/${batterId}/${pitcherId}?prop=${propType}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return existingScore;
    const data = await res.json();
    if (!data.applied) return existingScore;
    return Math.max(0, Math.min(100, Math.round(existingScore * data.multiplier)));
  } catch (error) {
    console.error('Matchup adjustment failed silently:', error);
    return existingScore;
  }
}
