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
 * Uses a dual-signal edge formula:
 *   combinedEdge = (batter.woba_vs_pitch − leagueAvg) + (pitcher.woba_allowed − leagueAvg)
 * Both signals align when the batter crushes a pitch the pitcher already gets hit hard on.
 *
 * Returns { score, topEdgePitch, topEdgeValue, verdict }
 * score: 0–100 (65+ = Batter Edge, 36–64 = Neutral, 0–35 = Pitcher Edge)
 */
export function calculateMismatchScore(batterPitchStats, pitcherPitchStats) {
  if (!batterPitchStats?.length || !pitcherPitchStats?.length) {
    return { score: 50, topEdgePitch: '', topEdgeValue: 0, verdict: 'Neutral' };
  }

  // Top 4 pitches by usage
  const top4 = [...pitcherPitchStats]
    .sort((a, b) => b.usagePct - a.usagePct)
    .slice(0, 4);

  let weightedEdge = 0;
  let totalWeight   = 0;
  let topEdgePitch  = '';
  let topEdgeValue  = -999;

  for (const pitch of top4) {
    const batterVsPitch = batterPitchStats.find(p => p.type === pitch.type);
    if (!batterVsPitch) continue;

    const leagueAvg = LEAGUE_AVG_WOBA_BY_PITCH[pitch.type] ?? 0.300;
    // Dual signal: how much better the batter hits this pitch + how much the pitcher allows on it
    const batterEdge  = batterVsPitch.woba - leagueAvg; // >0 = batter above avg vs this pitch type
    const pitcherEdge = pitch.woba - leagueAvg;          // >0 = pitcher allows more than avg on this pitch
    const combinedEdge = batterEdge + pitcherEdge;

    weightedEdge += combinedEdge * pitch.usagePct;
    totalWeight  += pitch.usagePct;

    if (Math.abs(combinedEdge) > Math.abs(topEdgeValue)) {
      topEdgeValue = combinedEdge;
      topEdgePitch = pitch.type;
    }
  }

  const normalizedEdge = totalWeight > 0 ? weightedEdge / totalWeight : 0;
  // Dual signal range: each component up to ~±0.150, combined up to ~±0.250
  // Scale: combined edge ≤ −0.200 → score 0, ≥ +0.200 → score 100
  const score = Math.round(((normalizedEdge + 0.200) / 0.400) * 100);
  const clamped = Math.max(0, Math.min(100, score));

  const verdict = clamped >= 65
    ? 'Batter Edge'
    : clamped <= 35
    ? 'Pitcher Edge'
    : 'Neutral';

  return { score: clamped, topEdgePitch, topEdgeValue, verdict };
}

/**
 * Simplified mismatch score using platoon splits and ERA — used when
 * pitch type data is unavailable (early season, API failure, etc.)
 *
 * Returns { score, topEdgePitch: '', topEdgeValue: 0, verdict }
 */
export function calculateSimplifiedMismatchScore(batterSplitAVG, batterSeasonAVG, pitcherERA, h2hAvg, h2hAB) {
  let score = 50;

  // Platoon component: how much better/worse batter hits vs this pitcher's hand
  if (batterSplitAVG != null && batterSeasonAVG != null && batterSeasonAVG > 0) {
    const platoonEdge = (batterSplitAVG - batterSeasonAVG) / batterSeasonAVG;
    score += Math.max(-18, Math.min(18, platoonEdge * 80));
  }

  // Pitcher quality component: ERA-based (league avg ~4.20)
  if (pitcherERA != null) {
    score += Math.max(-15, Math.min(15, (pitcherERA - 4.20) * 4.5));
  }

  // H2H component (reliable sample only)
  if (h2hAvg != null && h2hAB >= 10 && batterSeasonAVG > 0) {
    const h2hEdge = (h2hAvg - batterSeasonAVG) / batterSeasonAVG;
    score += Math.max(-8, Math.min(8, h2hEdge * 28));
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const verdict = clamped >= 65 ? 'Batter Edge' : clamped <= 35 ? 'Pitcher Edge' : 'Neutral';
  return { score: clamped, topEdgePitch: '', topEdgeValue: 0, verdict };
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
  if (verdict === 'Batter Edge') return { text: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400' };
  if (verdict === 'Pitcher Edge') return { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', dot: 'bg-red-400' };
  return { text: 'text-gray-400', bg: 'bg-gray-700/40 border-gray-600/30', dot: 'bg-gray-400' };
}

// Mismatch score → pill color classes
export function scoreStyle(score) {
  if (score >= 65) return { text: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30' };
  if (score <= 35) return { text: 'text-red-300', bg: 'bg-red-500/15 border-red-500/30' };
  return { text: 'text-gray-400', bg: 'bg-gray-700/40 border-gray-600/30' };
}
