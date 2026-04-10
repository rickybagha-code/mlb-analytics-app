// ─── Matchup Analyzer — Core Scoring Logic ───────────────────────────────────

// Pitch type code → human-readable name
export const PITCH_NAMES = {
  FF: 'Four-Seam FB',
  SI: 'Sinker',
  FC: 'Cutter',
  SL: 'Slider',
  CU: 'Curveball',
  CH: 'Changeup',
  FS: 'Splitter',
  ST: 'Sweeper',
  SV: 'Slurve',
  KC: 'Knuckle-Curve',
  KN: 'Knuckleball',
  EP: 'Eephus',
};

// League-average wOBA by pitch type (2024 MLB actuals)
export const LEAGUE_AVG_WOBA_BY_PITCH = {
  'Four-Seam FB': 0.320,
  'Sinker':       0.300,
  'Cutter':       0.310,
  'Slider':       0.280,
  'Curveball':    0.265,
  'Changeup':     0.285,
  'Splitter':     0.270,
  'Sweeper':      0.275,
  'Knuckle-Curve':0.268,
  'Eephus':       0.290,
  'Slurve':       0.275,
  'Knuckleball':  0.290,
};

/**
 * Full pitch-type mismatch score — requires Savant pitch data for both
 * pitcher arsenal and batter vs pitch type.
 *
 * Architecture:
 *   1. MATRIX BASE: For every pitch in the pitcher's arsenal (weighted by usage frequency),
 *      measure how the batter performs vs that specific pitch vs league average.
 *      Missing batter data = neutral (0 edge), not excluded — so unmatched pitches
 *      still dilute the score proportional to how often they're thrown.
 *      Small samples (<30 pitches seen) are confidence-weighted toward neutral.
 *      K% penalty applied: high strikeout rate vs a pitch reduces batter edge.
 *   2. PLATOON LAYER: splitAVG vs seasonAVG differential (±10 pts)
 *   3. H2H LAYER: career history vs this pitcher, sample-weighted (±8 pts)
 *   4. ERA LAYER: overall pitcher quality context (±7 pts)
 *
 * Returns { score, topEdgePitch, topEdgeValue, verdict }
 * score: 0–100 (65+ = Batter Edge, 36–64 = Neutral, 0–35 = Pitcher Edge)
 */
export function calculateMismatchScore(batterPitchStats, pitcherPitchStats, context = {}) {
  if (!pitcherPitchStats?.length) {
    return { score: 50, topEdgePitch: '', topEdgeValue: 0, verdict: 'Neutral' };
  }

  // All pitcher pitches sorted by usage — frequency IS the weighting mechanism
  const arsenal = [...pitcherPitchStats].sort((a, b) => b.usagePct - a.usagePct);

  let weightedSum  = 0;
  let totalUsage   = 0;
  let topEdgePitch = '';
  let topEdgeValue = -999;

  for (const pitch of arsenal) {
    const usageWeight = pitch.usagePct / 100;
    if (usageWeight <= 0) continue;

    const leagueAvg     = LEAGUE_AVG_WOBA_BY_PITCH[pitch.type] ?? 0.300;
    const batterVsPitch = batterPitchStats?.find(p => p.type === pitch.type);

    let finalBatterEdge = 0; // default: neutral when no data — pitch still counts toward denominator

    if (batterVsPitch && (batterVsPitch.pitches ?? 0) >= 3) {
      // Confidence ramp: 3 pitches = 10% signal, 30 pitches = 100% signal
      const sampleConf    = Math.min(1.0, (batterVsPitch.pitches ?? 0) / 30);
      const rawBatterEdge = batterVsPitch.woba - leagueAvg;
      // K% penalty: kPct stored as 0–100; league avg ~22% K rate on pitches
      // A 35% K rate = −0.078 penalty on top of wOBA edge
      const kPenalty      = Math.max(0, ((batterVsPitch.kPct ?? 0) / 100 - 0.22) * 0.60);
      finalBatterEdge     = (rawBatterEdge - kPenalty) * sampleConf;
    }

    // pitcherEdge: positive = pitcher gives up more than avg = batter-friendly
    // negative = pitcher dominates this pitch = batter-hostile
    const pitcherEdge  = pitch.woba - leagueAvg;
    const combinedEdge = finalBatterEdge * 0.60 + pitcherEdge * 0.40;

    weightedSum += combinedEdge * usageWeight;
    totalUsage  += usageWeight; // always counted — preserves true frequency weighting

    // Only set topEdge for pitches where batter has actual data
    if (batterVsPitch && Math.abs(combinedEdge) > Math.abs(topEdgeValue)) {
      topEdgeValue = combinedEdge;
      topEdgePitch = pitch.type;
    }
  }

  const normalizedEdge = totalUsage > 0 ? weightedSum / totalUsage : 0;
  // ±0.175 range — tighter than old ±0.200, reflects realistic per-pitch edge spreads
  let matrixScore = Math.round(((normalizedEdge + 0.175) / 0.350) * 100);
  matrixScore     = Math.max(0, Math.min(100, matrixScore));

  // ─── Layer 1: Platoon ─────────────────────────────────────────────────────
  const { splitAVG, seasonAVG, h2hAvg, h2hAB, pitcherERA, pitcherWHIP } = context;
  let platoonAdj = 0;
  if (splitAVG != null && seasonAVG != null && seasonAVG > 0) {
    platoonAdj = Math.max(-10, Math.min(10, ((splitAVG - seasonAVG) / seasonAVG) * 50));
  }

  // ─── Layer 2: H2H career history ─────────────────────────────────────────
  let h2hAdj = 0;
  if (h2hAvg != null && (h2hAB ?? 0) >= 10 && seasonAVG != null && seasonAVG > 0) {
    // Sample-weight: ramps from 0 at 10 AB → full weight at 50 AB
    const sampleW = Math.min(1.0, ((h2hAB ?? 0) - 10) / 40);
    h2hAdj = Math.max(-8, Math.min(8, ((h2hAvg - seasonAVG) / seasonAVG) * 35 * sampleW));
  }

  // ─── Layer 3: ERA/WHIP context ────────────────────────────────────────────
  let eraAdj = 0;
  if (pitcherERA != null) {
    eraAdj = Math.max(-7, Math.min(7, (pitcherERA - 4.20) * 2.0));
  } else if (pitcherWHIP != null) {
    eraAdj = Math.max(-5, Math.min(5, (pitcherWHIP - 1.25) * 15));
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(matrixScore + platoonAdj + h2hAdj + eraAdj)));

  const verdict = finalScore >= 65 ? 'Batter Edge'
    : finalScore <= 35 ? 'Pitcher Edge'
    : 'Neutral';

  return { score: finalScore, topEdgePitch, topEdgeValue, verdict };
}

/**
 * Simplified mismatch score — fallback when Savant pitch data is unavailable.
 * Uses platoon splits, ERA/WHIP, batter OPS, and H2H only.
 * Capped at 75 and always returns verdict: 'Limited Data' to distinguish
 * from the full matrix score.
 */
export function calculateSimplifiedMismatchScore(batterSplitAVG, batterSeasonAVG, pitcherERA, h2hAvg, h2hAB, batterOPS, pitcherWHIP) {
  let score = 50;

  if (batterSplitAVG != null && batterSeasonAVG != null && batterSeasonAVG > 0) {
    const platoonEdge = (batterSplitAVG - batterSeasonAVG) / batterSeasonAVG;
    score += Math.max(-14, Math.min(14, platoonEdge * 70));
  }

  if (pitcherERA != null) {
    score += Math.max(-12, Math.min(12, (pitcherERA - 4.20) * 3.5));
  } else if (pitcherWHIP != null) {
    score += Math.max(-8, Math.min(8, (1.25 - pitcherWHIP) * 28));
  }

  if (batterOPS != null && batterOPS > 0) {
    score += Math.max(-10, Math.min(14, (batterOPS - 0.710) / 0.100 * 5.3));
  }

  if (h2hAvg != null && h2hAB >= 10 && batterSeasonAVG > 0) {
    const h2hEdge = (h2hAvg - batterSeasonAVG) / batterSeasonAVG;
    score += Math.max(-6, Math.min(6, h2hEdge * 24));
  }

  const clamped = Math.max(0, Math.min(75, Math.round(score)));
  return { score: clamped, topEdgePitch: '', topEdgeValue: 0, verdict: 'Limited Data' };
}

/**
 * Auto-generated pitcher insight paragraph.
 */
export function generatePitcherInsight(pitcherName, top4Pitches, batterName, batterPitchStats) {
  if (!top4Pitches?.length) return null;
  const primary = top4Pitches[0];
  const batterVsPrimary = batterPitchStats?.find(p => p.type === primary.type);
  const lg = LEAGUE_AVG_WOBA_BY_PITCH[primary.type] ?? 0.300;

  let battingResult = 'has limited data against';
  if (batterVsPrimary) {
    battingResult = batterVsPrimary.woba > 0.350
      ? 'has hit well against'
      : batterVsPrimary.woba < 0.280
      ? 'has struggled against'
      : 'is neutral against';
  }

  const pitchVerdict = batterVsPrimary
    ? batterVsPrimary.woba > 0.350
      ? 'favorable for the batter'
      : batterVsPrimary.woba < 0.280
      ? 'favorable for the pitcher'
      : 'a neutral matchup'
    : 'inconclusive without sufficient data';

  return `${pitcherName}'s ${primary.type} (${primary.usagePct.toFixed(0)}% of pitches) is their primary weapon — batters hit .${primary.ba.toFixed(3).slice(1)} with a ${primary.woba.toFixed(3)} wOBA against it (league avg: ${lg.toFixed(3)}). ${batterName} ${battingResult} the ${primary.type}, making this ${pitchVerdict}.`;
}

/**
 * Auto-generated batter insight paragraph.
 */
export function generateBatterInsight(batterName, top4Pitches, batterPitchStats, pitcherName) {
  if (!top4Pitches?.length || !batterPitchStats?.length) return null;

  const results = top4Pitches
    .map(p => {
      const bvp = batterPitchStats.find(s => s.type === p.type);
      if (!bvp) return null;
      const lg = LEAGUE_AVG_WOBA_BY_PITCH[p.type] ?? 0.300;
      const diff = bvp.woba - lg;
      return { type: p.type, woba: bvp.woba, diff };
    })
    .filter(Boolean);

  if (!results.length) return null;

  const avgDiff = results.reduce((s, r) => s + r.diff, 0) / results.length;
  const verdictStr =
    avgDiff > 0.05  ? 'strongly favors the batter' :
    avgDiff > 0.015 ? 'leans toward the batter' :
    avgDiff < -0.05 ? 'strongly favors the pitcher' :
    avgDiff < -0.015? 'leans toward the pitcher' :
    'is a neutral matchup';

  const pitchList = results
    .slice(0, 2)
    .map(r => `${r.type} (${r.woba.toFixed(3)} wOBA)`)
    .join(' and ');

  return `${batterName} vs ${pitcherName}'s primary arsenal: hits ${pitchList}. Overall, this pitch matchup ${verdictStr} based on today's arsenal alignment.`;
}

/**
 * Auto-generated matchup summary paragraph.
 */
export function generateMatchupSummary(pitcherName, pitcherHand, batterName, batterHand, mismatch, h2h, top2Pitches) {
  const handMatchup = pitcherHand === batterHand ? 'same-hand' : 'opposite-hand';
  const pitchList = top2Pitches?.length
    ? top2Pitches.map(p => `${p.type} (${p.usagePct.toFixed(0)}%)`).join(' and ')
    : 'unknown pitch mix';

  let h2hStr;
  if (h2h?.ab >= 5) {
    h2hStr = `In ${h2h.ab} career at-bats, ${batterName} is hitting .${String(h2h.avg.toFixed(3)).slice(1)} against ${pitcherName}. `;
  } else if (h2h?.ab === 0) {
    h2hStr = `This is the first career meeting between the two. `;
  } else {
    h2hStr = `Career sample is too small (${h2h?.ab ?? 0} AB) to be reliable. `;
  }

  const verdictStr =
    mismatch.score >= 75 ? 'strongly favors the batter' :
    mismatch.score >= 65 ? 'leans toward the batter' :
    mismatch.score >= 36 ? 'is a neutral matchup' :
    mismatch.score >= 25 ? 'leans toward the pitcher' :
    'strongly favors the pitcher';

  const edgeStr = mismatch.topEdgePitch
    ? `, pitches ${batterName} has historically hit with a ${mismatch.topEdgeValue > 0 ? 'favorable' : 'unfavorable'} ${Math.abs(mismatch.topEdgeValue).toFixed(3)} wOBA differential`
    : '';

  return `${batterName} (bats ${batterHand}) faces ${pitcherName} (throws ${pitcherHand}) tonight — a ${handMatchup} matchup. ${pitcherName}'s primary weapons are ${pitchList}${edgeStr}. ${h2hStr}Based on pitch type alignment, this matchup ${verdictStr}.`;
}

/**
 * Find the pitch type where the batter has the highest K%.
 */
export function findKVulnerability(batterPitchStats, top4Pitches) {
  if (!batterPitchStats?.length || !top4Pitches?.length) return null;
  let maxK = -1, maxPitch = null;
  for (const p of top4Pitches) {
    const bvp = batterPitchStats.find(s => s.type === p.type);
    if (bvp && bvp.kPct > maxK) { maxK = bvp.kPct; maxPitch = p.type; }
  }
  return maxPitch ? { pitch: maxPitch, kPct: maxK } : null;
}

/**
 * Find the pitch type where the batter has the biggest wOBA advantage.
 */
export function findPrimaryThreat(batterPitchStats, top4Pitches) {
  if (!batterPitchStats?.length || !top4Pitches?.length) return null;
  let maxEdge = -999, maxPitch = null, maxWoba = null;
  for (const p of top4Pitches) {
    const bvp = batterPitchStats.find(s => s.type === p.type);
    if (!bvp) continue;
    const lg = LEAGUE_AVG_WOBA_BY_PITCH[p.type] ?? 0.300;
    const edge = bvp.woba - lg;
    if (edge > maxEdge) { maxEdge = edge; maxPitch = p.type; maxWoba = bvp.woba; }
  }
  return maxPitch ? { pitch: maxPitch, edge: maxEdge, woba: maxWoba } : null;
}

// Verdict label + color
export function verdictStyle(verdict) {
  if (verdict === 'Batter Edge')  return { text: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400' };
  if (verdict === 'Pitcher Edge') return { text: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/30',         dot: 'bg-red-400'     };
  if (verdict === 'Limited Data') return { text: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/30',     dot: 'bg-amber-400'   };
  return { text: 'text-gray-400', bg: 'bg-gray-700/40 border-gray-600/30', dot: 'bg-gray-400' };
}

// Mismatch score → pill color classes
export function scoreStyle(score) {
  if (score >= 65) return { text: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30' };
  if (score <= 35) return { text: 'text-red-300', bg: 'bg-red-500/15 border-red-500/30' };
  return { text: 'text-gray-400', bg: 'bg-gray-700/40 border-gray-600/30' };
}
