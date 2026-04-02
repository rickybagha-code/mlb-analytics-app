'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MLB_API  = 'https://statsapi.mlb.com/api/v1';

// ─── Season gate — switch to 2026 only once the regular season is underway ───
// Change OPENING_DAY to the actual first game date when known.
const OPENING_DAY = new Date('2026-03-24');
const SEASON      = new Date() >= OPENING_DAY ? '2026' : '2025';

// ─── Opponent K rate per 9-inning game (2024 MLB actuals) — mirrors player page ─
const TEAM_K_RATES = {
  NYY:8.8, BOS:8.5, BAL:8.7, TBR:9.1, TOR:8.9,
  CLE:8.6, DET:8.4, CWS:8.8, KCR:8.3, MIN:8.5,
  HOU:8.2, LAA:9.0, OAK:9.2, SEA:8.7, TEX:8.9,
  ATL:8.1, MIA:9.0, NYM:8.6, PHI:8.3, WSN:9.1,
  CHC:8.9, CIN:9.2, MIL:8.6, PIT:8.8, STL:7.9,
  ARI:8.5, COL:9.1, LAD:8.0, SDP:8.4, SFG:8.7,
};
const LG_K_RATE = 8.6;

// ─── Park HR factors (Baseball Reference 2024/2025 avg) ──────────────────────
const PARK_HR = {
  NYY:1.18, BOS:0.97, BAL:1.07, TBR:0.92, TOR:0.99,
  CLE:0.90, DET:0.98, CWS:0.96, KCR:1.03, MIN:1.06,
  HOU:0.92, LAA:1.08, OAK:0.95, SEA:0.91, TEX:1.10,
  ATL:1.02, MIA:0.89, NYM:0.99, PHI:1.14, WSN:1.05,
  CHC:1.09, CIN:1.17, MIL:0.98, PIT:0.94, STL:1.00,
  ARI:1.12, COL:1.38, LAD:0.95, SDP:0.89, SFG:0.82,
};
// Normalize MLB API abbreviations to match PARK_HR keys
const ABBREV_MAP = { TB:'TBR', KC:'KCR', SD:'SDP', SF:'SFG', WSH:'WSN', MIA:'MIA' };
function normDashAbbrev(abbr) { return ABBREV_MAP[abbr] || abbr || ''; }

// ─── Venue coordinates (mirrors player page) ──────────────────────────────
const VENUE_COORDS = {
  NYY:{ lat:40.829, lon:-73.926 }, BOS:{ lat:42.347, lon:-71.097 }, BAL:{ lat:39.284, lon:-76.622 },
  TBR:{ lat:27.768, lon:-82.654 }, TOR:{ lat:43.641, lon:-79.389 }, CLE:{ lat:41.496, lon:-81.685 },
  DET:{ lat:42.339, lon:-83.049 }, CWS:{ lat:41.830, lon:-87.634 }, KCR:{ lat:39.051, lon:-94.480 },
  MIN:{ lat:44.982, lon:-93.278 }, HOU:{ lat:29.757, lon:-95.355 }, LAA:{ lat:33.800, lon:-117.883 },
  OAK:{ lat:37.752, lon:-122.201 }, SEA:{ lat:47.591, lon:-122.333 }, TEX:{ lat:32.748, lon:-97.083 },
  ATL:{ lat:33.891, lon:-84.468 }, MIA:{ lat:25.778, lon:-80.220 }, NYM:{ lat:40.758, lon:-73.846 },
  PHI:{ lat:39.906, lon:-75.167 }, WSN:{ lat:38.873, lon:-77.008 }, CHC:{ lat:41.948, lon:-87.656 },
  CIN:{ lat:39.097, lon:-84.507 }, MIL:{ lat:43.028, lon:-87.971 }, PIT:{ lat:40.447, lon:-80.006 },
  STL:{ lat:38.623, lon:-90.193 }, ARI:{ lat:33.446, lon:-112.067 }, COL:{ lat:39.756, lon:-104.994 },
  LAD:{ lat:34.074, lon:-118.240 }, SDP:{ lat:32.707, lon:-117.157 }, SFG:{ lat:37.779, lon:-122.389 },
};

function calcWeatherAdj(weather) {
  if (!weather) return { adjustment: 0 };
  const temp      = Number(weather.temp ?? 21);
  const windSpeed = Number(weather.windSpeed ?? 0);
  const windDir   = Number(weather.windDir ?? 0);
  let adj = 0;
  if (temp >= 29)      adj += 4;
  else if (temp >= 24) adj += 2;
  else if (temp <= 13) adj -= 3;
  if (windSpeed >= 10) {
    if      (windDir >= 225 && windDir <= 315) adj += 4;
    else if (windDir >= 45  && windDir <= 135) adj -= 4;
    else                                       adj += 1;
  }
  return { adjustment: adj };
}

// ─── LocalStorage Cache ───────────────────────────────────────────────────────
function getCached(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}
function setCached(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ─── Projection Model v2 ──────────────────────────────────────────────────────
// Uses wOBA proxy, K% penalty, sample-size confidence, recency boost.
// Scores are absolute (not relative): ~53 = league avg, ~80+ = elite before recency.
function computeProjectionScore(player, category) {
  const ab   = player.atBats        || 0;
  const pa   = player.plateAppearances || (ab + (player.baseOnBalls || 0));
  const avg  = player.avg           || 0;
  const obp  = player.obp           || 0;
  const slg  = player.slg           || 0;
  const hr   = player.homeRuns      || 0;
  const rbi  = player.rbi           || 0;
  const r    = player.runs          || 0;
  const gp   = Math.max(player.gamesPlayed || 1, 1);
  const bb   = player.baseOnBalls   || 0;
  const k    = player.strikeOuts    || 0;
  const hits = player.hits          || 0;
  const dbl  = player.doubles       || 0;
  const tri  = player.triples       || 0;

  // Statcast fields (null when not yet loaded)
  const xwoba      = player.xwoba      ?? null;
  const barrelPct  = player.barrelPct  ?? null;
  const hardHitPct = player.hardHitPct ?? null;

  const hrRate  = ab > 0 ? hr / ab : 0;
  const iso     = Math.max(0, slg - avg);
  const kPct    = pa > 0 ? k  / pa : 0.22;
  const bbPct   = pa > 0 ? bb / pa : 0.08;
  const singles = Math.max(0, hits - dbl - tri - hr);

  // wOBA proxy — best single predictor for contact/power props
  // Linear weights: BB=0.69, 1B=0.888, 2B=1.271, 3B=1.616, HR=2.101
  const wOBA = pa > 0
    ? (bb*0.690 + singles*0.888 + dbl*1.271 + tri*1.616 + hr*2.101) / pa
    : (avg * 0.88 + obp * 0.12); // fallback if no PA

  // Blend with xwOBA (Statcast expected, luck-adjusted) when available
  // xwOBA is 65% weight as it removes luck on balls in play
  const effectiveWOBA = xwoba != null ? wOBA * 0.35 + xwoba * 0.65 : wOBA;

  // Sample confidence: steeper curve — 0.3 at 30 AB → 1.0 at 380+ AB
  const pa_safe    = Math.max(1, pa);
  const confidence = Math.min(1.0, Math.max(0.4, (ab - 30) / 350 + 0.4));

  // Pitcher difficulty — positive = batter-friendly (high ERA), negative = tough ace
  const era = player.matchup?.pitcher?.era;
  const pitcherMod = era != null ? Math.max(-10, Math.min(10, (era - 4.50) * 2.5)) : 0;

  // ── Weather adjustment (applied to all categories) ─────────────────────────
  const wx = calcWeatherAdj(player.weather);
  const weatherBonus = wx.adjustment; // ±0–8 score points

  // ── Platoon splits vs opposing pitcher hand ────────────────────────────────
  const splitAVG = player.splitAVG ?? null;
  const splitSLG = player.splitSLG ?? null;
  const splitOBP = player.splitOBP ?? null;

  // Recency boost — reduced weight; weather + platoon carry more signal.
  // HR uses l10HRrate directly in the base formula (hit streaks don't predict HRs).
  let recencyBoost = 0;
  const { streak, l10Avg } = player;
  if (category !== 'hr') {
    if (streak != null) {
      if      (streak >= 8) recencyBoost += 8;
      else if (streak >= 5) recencyBoost += 5;
      else if (streak >= 3) recencyBoost += 3;
      else if (streak === 0) recencyBoost -= 4;
    }
    if (l10Avg != null && avg > 0) {
      const l10Contribution = Math.max(-6, Math.min(6, ((l10Avg - avg) / avg) * 18));
      // Don't penalize a currently-hot player with cold early-window games
      recencyBoost += (streak >= 3 && l10Contribution < 0) ? 0 : l10Contribution;
    }
  }

  let base = 50;

  if (category === 'hitting') {
    // Contact-adjusted wOBA: reduce HR weight (2.101→1.3) since HRs don't add extra hits
    const hitWOBA = pa > 0
      ? (bb*0.690 + singles*0.888 + dbl*1.271 + tri*1.616 + hr*1.300) / pa
      : (avg * 0.88 + obp * 0.12);
    const effectiveHitWOBA = xwoba != null ? hitWOBA * 0.35 + xwoba * 0.65 : hitWOBA;
    const wComp      = (effectiveHitWOBA - 0.302) * 250;
    const kPenalty   = Math.max(0, (kPct - 0.20) * 50);
    const bbBonus    = Math.max(0, (bbPct - 0.08) * 25);
    const hardBonus  = hardHitPct != null ? Math.max(0, Math.min(8, (hardHitPct - 40) / 18 * 8)) : 0;
    const splitBonus = splitAVG != null && avg > 0
      ? Math.max(-10, Math.min(12, (splitAVG - avg) / avg * 40)) : 0;
    // H2H history vs today's pitcher — sample-weighted, 15 AB minimum
    const h2hAB  = player.h2hAB  ?? 0;
    const h2hAVG = player.h2hAVG ?? null;
    const h2hHitShift = h2hAVG != null && avg > 0 && h2hAB >= 15
      ? Math.max(-8, Math.min(10, (h2hAVG / avg - 1.0) * 20 * Math.min(1.0, (h2hAB - 15) / 45)))
      : 0;
    // Weather scaled to 35% for hits — wind affects HR carry, not singles/doubles
    base = 53 + wComp - kPenalty + bbBonus + hardBonus + pitcherMod + splitBonus + weatherBonus * 0.35 + h2hHitShift;

  } else if (category === 'hr') {
    const seasonHRpa = hr / pa_safe;
    const l10HRrate  = player.l10HRrate ?? null;
    const LG_HRPA    = 0.034;
    const talentHRpa = barrelPct != null
      ? Math.max(LG_HRPA * 0.6, Math.min(0.085, barrelPct * (LG_HRPA / 8.2)))
      : LG_HRPA;
    const sampleWeight        = Math.min(1.0, pa_safe / 200);
    const effectiveSeasonHRpa = sampleWeight * seasonHRpa + (1 - sampleWeight) * talentHRpa;
    const hrSampleWeight = Math.min(1.0, (player.pa26Raw ?? pa_safe) / 400);
    const l10Weight      = 0.35 * hrSampleWeight;
    const seasonHRWeight = 0.55 + (0.35 - l10Weight);
    const effectiveHR = l10HRrate != null
      ? l10HRrate * l10Weight + effectiveSeasonHRpa * seasonHRWeight + LG_HRPA * 0.10
      : effectiveSeasonHRpa;
    const avgPAs = Math.max(3.0, Math.min(5.0, gp > 0 ? pa_safe / gp : 4.0));
    const lambda = Math.max(0, effectiveHR * avgPAs);
    const pHR    = 1 - Math.exp(-lambda);
    const barrelShift    = barrelPct != null ? Math.max(-0.03, Math.min(0.05, (barrelPct - 8.2) / 200)) : 0;
    const evoShift       = (player.exitVelo ?? null) != null ? Math.max(-0.02, Math.min(0.03, (player.exitVelo - 88.5) / 300)) : 0;
    const parkShift      = (player.parkHR ?? null) != null ? Math.max(-0.06, Math.min(0.07, (player.parkHR - 1.0) * 0.35)) : 0;
    const pitcherHRShift = Math.max(-0.03, Math.min(0.03, pitcherMod * 0.003));
    // Platoon shift on pHR (SLG-based)
    const platoonShift = splitSLG != null && slg > 0
      ? Math.max(-0.04, Math.min(0.05, (splitSLG / slg - 1.0) * 0.15)) : 0;
    // pHR ceiling aligned with player card (0.30); weather added as direct score pts below
    const adjustedPHR = Math.min(0.30, Math.max(0.005,
      pHR + barrelShift + evoShift + parkShift + pitcherHRShift + platoonShift
    ));
    // Center at league avg (0.127) → 50; scale 175 matches player card; weather added after
    base = 50 + (adjustedPHR - 0.127) * 175 + weatherBonus;

  } else if (category === 'runs') {
    const rComp         = Math.max(-15, Math.min(25, (r / gp - 0.45) * 55));
    const obpComp       = Math.max(0,   Math.min(15, (obp - 0.317) / 0.100 * 12));
    const hardBonus     = hardHitPct != null ? Math.max(0, Math.min(5, (hardHitPct - 40) / 18 * 5)) : 0;
    const splitOBPbonus = splitOBP != null && obp > 0
      ? Math.max(-8, Math.min(10, (splitOBP - obp) / obp * 30)) : 0;
    base = 40 + rComp + obpComp + hardBonus + pitcherMod + splitOBPbonus + weatherBonus;

  } else if (category === 'rbi') {
    const rbiComp       = Math.max(-15, Math.min(35, (rbi / gp - 0.45) * 70));
    const slgComp       = Math.max(0,   Math.min(15, (slg - 0.400) / 0.200 * 15));
    const hrComp        = Math.max(0,   Math.min(10, (hrRate / 0.06) * 10));
    const xwobaBonus    = xwoba != null ? Math.max(0, Math.min(8, (xwoba - 0.315) / 0.100 * 8)) : 0;
    const splitSLGbonus = splitSLG != null && slg > 0
      ? Math.max(-8, Math.min(10, (splitSLG - slg) / slg * 30)) : 0;
    base = 38 + rbiComp + slgComp + hrComp + xwobaBonus + pitcherMod + splitSLGbonus + weatherBonus;

  } else if (category === 'sb') {
    const sbRate = player.stolenBases != null && gp > 0 ? player.stolenBases / gp : 0;
    const sbComp = Math.min(55, sbRate * 220);
    base = 15 + sbComp + pitcherMod * 0.3;
  }

  // Shrink score toward 50 for thin sample sizes.
  // HR is exempt: pHR already has three internal shrinkage layers (sampleWeight, hrSampleWeight,
  // 10% LG anchor) — a fourth confidence pull double-penalises early-season elite power hitters.
  const effectiveConf = category === 'hr' ? 1.0 : confidence;
  const adjusted = 50 + (base - 50) * effectiveConf;
  const recencyCap  = ab < 30 ? 4 : ab < 100 ? 7 : 12;
  const safeRecency = Math.max(-recencyCap, Math.min(recencyCap, recencyBoost));
  return Math.round(Math.max(5, Math.min(99, adjusted + safeRecency)));
}

// ─── Season stat blending (2026 + 2025) ──────────────────────────────────────
// Blends current-season and prior-season stats proportionally to sample size.
// w = min(1, pa_2026/200) — 0% 2026 at season start, 100% at ~200 PA (mid-May).
// Uses effective denominators (weighted avg of both years) so counting stats
// produce correct per-game/per-PA rates and the confidence calc sees a realistic AB.
function blendBatterStats(st26, st25) {
  if (!st25 && !st26) return null;
  const extract = st => ({
    avg: parseFloat(st.avg)||0, obp: parseFloat(st.obp)||0, slg: parseFloat(st.slg)||0,
    babip: parseFloat(st.babip)||0,
    gamesPlayed: Math.max(1, parseInt(st.gamesPlayed)||1),
    plateAppearances: parseInt(st.plateAppearances)||0,
    atBats: parseInt(st.atBats)||0,
    homeRuns: parseInt(st.homeRuns)||0, rbi: parseInt(st.rbi)||0,
    runs: parseInt(st.runs)||0, stolenBases: parseInt(st.stolenBases)||0,
    baseOnBalls: parseInt(st.baseOnBalls)||0, strikeOuts: parseInt(st.strikeOuts)||0,
    hits: parseInt(st.hits)||0, doubles: parseInt(st.doubles)||0,
    triples: parseInt(st.triples)||0,
  });
  if (!st25) return extract(st26);
  if (!st26 || (parseInt(st26.plateAppearances)||0) === 0) return extract(st25);

  const pa26 = Math.max(1, parseInt(st26.plateAppearances)||0);
  const gp26 = Math.max(1, parseInt(st26.gamesPlayed)||1);
  const ab26 = Math.max(1, parseInt(st26.atBats)||Math.round(pa26*0.86));
  const pa25 = Math.max(1, parseInt(st25.plateAppearances)||1);
  const gp25 = Math.max(1, parseInt(st25.gamesPlayed)||1);
  const ab25 = Math.max(1, parseInt(st25.atBats)||Math.round(pa25*0.86));

  const w = Math.min(1.0, pa26 / 200);
  const b = (v26, v25) => w * v26 + (1 - w) * v25;

  // Effective denominators — weighted avg of both years' sample sizes.
  // Eliminates rounding errors when gp26 is tiny and keeps confidence near 1.0.
  const eff_gp = Math.max(1, Math.round(b(gp26, gp25)));
  const eff_pa = Math.max(1, Math.round(b(pa26, pa25)));
  const eff_ab = Math.max(1, Math.round(b(ab26, ab25)));

  // HR uses a slower blend weight (pa/400) — HR rate is the most volatile stat early in the
  // season, so we trust 2025 production longer than other counting stats.
  const w_hr = Math.min(1.0, pa26 / 400);
  const bHR  = (v26, v25) => w_hr * v26 + (1 - w_hr) * v25;

  // Blend per-game rates
  const hr_pg  = bHR((parseInt(st26.homeRuns)||0)/gp26,  (parseInt(st25.homeRuns)||0)/gp25);
  const rbi_pg = b((parseInt(st26.rbi)||0)/gp26,         (parseInt(st25.rbi)||0)/gp25);
  const r_pg   = b((parseInt(st26.runs)||0)/gp26,        (parseInt(st25.runs)||0)/gp25);
  const sb_pg  = b((parseInt(st26.stolenBases)||0)/gp26, (parseInt(st25.stolenBases)||0)/gp25);
  // Blend per-PA rates
  const bb_ppa = b((parseInt(st26.baseOnBalls)||0)/pa26, (parseInt(st25.baseOnBalls)||0)/pa25);
  const k_ppa  = b((parseInt(st26.strikeOuts)||0)/pa26,  (parseInt(st25.strikeOuts)||0)/pa25);
  // Blend per-AB rates
  const h_pab  = b((parseInt(st26.hits)||0)/ab26,    (parseInt(st25.hits)||0)/ab25);
  const d_pab  = b((parseInt(st26.doubles)||0)/ab26, (parseInt(st25.doubles)||0)/ab25);
  const t_pab  = b((parseInt(st26.triples)||0)/ab26, (parseInt(st25.triples)||0)/ab25);

  return {
    avg: b(parseFloat(st26.avg)||0, parseFloat(st25.avg)||0),
    obp: b(parseFloat(st26.obp)||0, parseFloat(st25.obp)||0),
    slg: b(parseFloat(st26.slg)||0, parseFloat(st25.slg)||0),
    babip: b(parseFloat(st26.babip)||0, parseFloat(st25.babip)||0),
    gamesPlayed:      eff_gp,
    plateAppearances: eff_pa,
    atBats:           eff_ab,
    homeRuns:    Math.round(hr_pg  * eff_gp),
    rbi:         Math.round(rbi_pg * eff_gp),
    runs:        Math.round(r_pg   * eff_gp),
    stolenBases: Math.round(sb_pg  * eff_gp),
    baseOnBalls: Math.round(bb_ppa * eff_pa),
    strikeOuts:  Math.round(k_ppa  * eff_pa),
    hits:        Math.round(h_pab  * eff_ab),
    doubles:     Math.round(d_pab  * eff_ab),
    triples:     Math.round(t_pab  * eff_ab),
    _pa26: pa26,
  };
}

// ─── Poisson CDF ─────────────────────────────────────────────────────────────
function poissonCDF(k, lambda) {
  if (lambda <= 0) return 1;
  let sum = 0, term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) { sum += term; term *= lambda / (i + 1); }
  return Math.min(1, sum);
}

// ─── Park K factors (strikeout rate vs league avg per park) ──────────────────
// Includes both MLB API abbreviations (TB, KC, WSH, SD, SF) and BR codes (TBR etc.)
const PARK_K = {
  NYY:0.99, BOS:0.97, BAL:0.98, TBR:1.02, TB:1.02, TOR:1.00,
  CLE:1.01, DET:1.03, CWS:1.00, CHW:1.00, KCR:0.99, KC:0.99, MIN:1.01,
  HOU:1.00, LAA:1.01, OAK:1.04, SEA:1.04, TEX:0.97,
  ATL:0.99, MIA:1.06, NYM:1.03, PHI:0.98, WSN:0.99, WSH:0.99,
  CHC:0.98, CIN:0.96, MIL:1.01, PIT:1.02, STL:1.00,
  ARI:0.97, AZ:0.97, COL:0.94, LAD:1.03, SDP:1.05, SD:1.05, SFG:1.04, SF:1.04,
};

// ─── K Projection (pure fn mirroring player-page useKProjection hook) ────────
// starts: [{strikeOuts, inningsPitched, date}, ...] — last N regular starts
// pitcherSavant: { whiffPct, kPct } from Baseball Savant (optional)
// homeAbbrev: home team abbreviation for park K factor (optional)
function computeKProjection(starts, k9, oppTeamAbbrev, pitcherSavant, homeAbbrev) {
  if (!starts?.length) return null;
  const last5   = starts.slice(-5);
  const l5Ks    = last5.map(s => s.strikeOuts);
  const l5K     = l5Ks.reduce((a, b) => a + b, 0) / l5Ks.length;
  const l5IP    = last5.map(s => parseFloat(s.inningsPitched) || 0);
  const avgL5IP = Math.max(1, l5IP.reduce((a, b) => a + b, 0) / l5IP.length);
  const seasonK = k9 != null ? k9 / 9 * avgL5IP : null;
  const leagueK = 5.5;
  const raw = l5K * 0.60 + (seasonK ?? leagueK) * 0.30 + leagueK * 0.10;

  // ── Savant SwStr% (whiff rate) signal — strongest K predictor ──
  // whiff_percent = swinging strikes / swings, LG avg ~24%
  // Each 1% above avg ≈ +0.14 Ks/start; capped at ±1.2/+1.5
  const LG_WHIFF = 24.0;
  const whiffShift = pitcherSavant?.whiffPct != null
    ? Math.max(-1.2, Math.min(1.5, (pitcherSavant.whiffPct - LG_WHIFF) * 0.14))
    : 0;
  // K% secondary signal — smaller weight to avoid double-counting with SwStr%
  const LG_K_PCT = 22.0;
  const kPctShift = pitcherSavant?.kPct != null
    ? Math.max(-0.5, Math.min(0.8, (pitcherSavant.kPct - LG_K_PCT) * 0.04))
    : 0;

  const oppKRate    = TEAM_K_RATES[oppTeamAbbrev] || LG_K_RATE;
  const oppKFactor  = oppKRate / LG_K_RATE;
  const parkKFactor = homeAbbrev ? (PARK_K[homeAbbrev] ?? 1.0) : 1.0;
  const last = starts[starts.length - 1];
  const daysRest = last?.date
    ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000)
    : null;
  const restFactor = daysRest != null ? (daysRest < 4 ? 0.95 : daysRest >= 6 ? 1.02 : 1.0) : 1.0;
  return Math.round((raw + whiffShift + kPctShift) * restFactor * oppKFactor * parkKFactor * 10) / 10;
}

// ─── Score from K projection (same formula as pitcherScoreFromKProj on player page)
function pitcherKScore(projected, ppKLine) {
  if (projected == null) return null;
  const line  = ppKLine ?? 5.5;
  const floor = Math.floor(line);
  const pOver = 1 - poissonCDF(floor, projected);
  return Math.round(Math.max(5, Math.min(99, pOver * 100)));
}

// ─── Pitcher Score — fallback when no start history available ─────────────────
// ppKLine: actual PrizePicks K line for this pitcher (fallback 5.5).
// Uses 5.0 IP avg (aligns with player-page model; *100 scale for consistency).
function scorePitcher(stats, ppKLine) {
  const era   = stats.era  ?? 4.50;
  const whip  = stats.whip ?? 1.30;
  const k9    = stats.k9   ?? 8.0;
  const line  = ppKLine ?? 5.5;
  const floor = Math.floor(line);
  // Use 5.0 IP (conservative avg; matches scale of player-page K projection model)
  const projKs = Math.max(0, k9 / 9 * 5.0);
  const pOver  = 1 - poissonCDF(floor, projKs);
  // Small quality modifiers — do not dominate pOver
  const eraAdj  = Math.max(-0.05, Math.min(0.05, (4.50 - era)  * 0.018));
  const whipAdj = Math.max(-0.03, Math.min(0.03, (1.30 - whip) * 0.07));
  const adjusted = Math.min(0.95, Math.max(0.03, pOver + eraAdj + whipAdj));
  return Math.round(Math.max(5, Math.min(99, adjusted * 100)));
}

// ─── PP name matching (exact → case-insensitive → last+first-initial) ────────
function findPPLines(name, linesMap) {
  if (!name || !linesMap) return null;
  // Tier 1: exact
  if (linesMap[name]) return linesMap[name];
  const lower = name.toLowerCase();
  // Tier 2: case-insensitive exact
  const k1 = Object.keys(linesMap).find(k => k.toLowerCase() === lower);
  if (k1) return linesMap[k1];
  // Tier 3: last name + first name prefix match
  // Handles "M. Fried" vs "Max Fried", "Yoshi Yamamoto" vs "Yoshinobu Yamamoto"
  const parts = name.split(' ');
  if (parts.length >= 2) {
    const lastName  = parts[parts.length - 1].toLowerCase();
    const firstName = parts[0].toLowerCase();
    const k2 = Object.keys(linesMap).find(k => {
      const kl = k.toLowerCase();
      if (!kl.includes(lastName)) return false;
      if (kl.includes(firstName) || kl.includes(firstName[0] + '.')) return true;
      const ppFirst = kl.split(' ')[0];
      return firstName.startsWith(ppFirst) || ppFirst.startsWith(firstName);
    });
    if (k2) return linesMap[k2];
  }
  return null;
}

// ─── Streak ───────────────────────────────────────────────────────────────────
function computeStreak(games) {
  let s = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if ((Number(games[i].hits) || 0) > 0) s++;
    else break;
  }
  return s;
}

// ─── Manual Research Helpers ──────────────────────────────────────────────────
function computeWindowStats(games, win) {
  if (!games?.length) return null;
  const slice = win === 'season' ? games : games.slice(-Number(win));
  if (!slice.length) return null;
  const t = slice.reduce((a, g) => ({
    h:   a.h   + (Number(g.hits)        || 0),
    hr:  a.hr  + (Number(g.homeRuns)    || 0),
    rbi: a.rbi + (Number(g.rbi)         || 0),
    r:   a.r   + (Number(g.runs)        || 0),
    ab:  a.ab  + (Number(g.atBats)      || 0),
    bb:  a.bb  + (Number(g.baseOnBalls) || 0),
  }), { h:0, hr:0, rbi:0, r:0, ab:0, bb:0 });
  const g = slice.length;
  return {
    games: g,
    avg:        t.ab > 0 ? t.h / t.ab : 0,
    hPerGame:   t.h  / g,
    hrPerGame:  t.hr / g,
    rbiPerGame: t.rbi / g,
    rPerGame:   t.r  / g,
    obpProxy:   (t.ab + t.bb) > 0 ? (t.h + t.bb) / (t.ab + t.bb) : 0,
    totalH: t.h, totalHR: t.hr, totalRBI: t.rbi, totalR: t.r,
  };
}

function calcManualScore(stats, category) {
  if (!stats?.games) return 50;
  if (category === 'hitting') return Math.round(Math.max(10, Math.min(99, Math.min(55, stats.avg * 190) + Math.min(25, stats.hPerGame * 18) + Math.min(15, stats.obpProxy * 30))));
  if (category === 'hr')      return Math.round(Math.max(5,  Math.min(99, Math.min(80, stats.hrPerGame * 420) + Math.min(20, stats.totalHR * 3))));
  if (category === 'runs')    return Math.round(Math.max(10, Math.min(99, Math.min(60, stats.rPerGame * 60) + Math.min(30, stats.obpProxy * 55))));
  if (category === 'rbi')     return Math.round(Math.max(10, Math.min(99, Math.min(60, stats.rbiPerGame * 65) + Math.min(30, stats.obpProxy * 40))));
  return 50;
}

function getPropLabel(stats, category) {
  if (!stats) return null;
  if (category === 'hitting') { if (stats.hPerGame >= 1.2) return 'Over 1.5 H'; if (stats.hPerGame >= 0.65) return 'Over 0.5 H'; }
  if (category === 'hr'  && stats.hrPerGame >= 0.25)  return 'Over 0.5 HR';
  if (category === 'runs') { if (stats.rPerGame >= 1.0) return 'Over 0.5 R'; if (stats.rPerGame >= 0.5) return 'Over 0.5 R'; }
  if (category === 'rbi')  { if (stats.rbiPerGame >= 1.0) return 'Over 0.5 RBI'; }
  return null;
}

// ─── Color & Formatting ───────────────────────────────────────────────────────
function statCls(value, good, ok) {
  if (value >= good) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (value >= ok)   return { text: 'text-yellow-400',  bg: 'bg-yellow-500/10  border-yellow-500/30' };
  return               { text: 'text-red-400',          bg: 'bg-red-500/10     border-red-500/30'    };
}
function eraCls(era)  { return statCls(6 - (era  ?? 4.5),  2,    1   ); } // lower ERA = better
function whipCls(w)   { return statCls(2 - (w    ?? 1.3),  0.7,  0.3 ); } // lower WHIP = better
function getScoreColor(s) { if (s>=75) return 'text-emerald-400'; if (s>=60) return 'text-yellow-400'; if (s>=45) return 'text-orange-400'; return 'text-red-400'; }
function getScoreBg(s)    { if (s>=75) return 'border-emerald-500/30 bg-emerald-500/5'; if (s>=60) return 'border-yellow-500/30 bg-yellow-500/5'; if (s>=45) return 'border-orange-500/30 bg-orange-500/5'; return 'border-red-500/30 bg-red-500/5'; }
function ringColor(s)     { if (s>=75) return '#34d399'; if (s>=60) return '#facc15'; if (s>=45) return '#fb923c'; return '#f87171'; }
function getRecIcon(s)    { if (s>=75) return { icon:'✅', label:'Strong Value', color:'text-emerald-300' }; if (s>=60) return { icon:'👍', label:'Good Value', color:'text-yellow-300' }; if (s>=45) return { icon:'⚠️', label:'Marginal', color:'text-orange-300' }; return { icon:'❌', label:'Avoid', color:'text-red-300' }; }
function fmt(v, d=3) { if (v==null) return '—'; const n=parseFloat(v); return isNaN(n)?'—':n.toFixed(d); }

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center group">
            <ProprStatsLogo variant="light" size={30} wordmarkClass="group-hover:text-blue-400 transition-colors" />
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-blue-400 border-b-2 border-blue-500 pb-0.5">Dashboard</span>
            <Link href="/" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Player Headshot ──────────────────────────────────────────────────────────
function PlayerHeadshot({ playerId, name, size=48 }) {
  const [failed, setFailed] = useState(false);
  const initials = name ? name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '??';
  if (failed) return (
    <div style={{width:size,height:size,minWidth:size}} className="rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs flex-shrink-0">
      {initials}
    </div>
  );
  return (
    <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`}
      alt={name} width={size} height={size}
      style={{width:size,height:size,minWidth:size}}
      className="rounded-full object-cover border border-gray-700 bg-gray-800 flex-shrink-0"
      onError={()=>setFailed(true)} />
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size=44 }) {
  const r=16, circ=2*Math.PI*r, dash=(score/100)*circ;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#1f2937" strokeWidth="3.5"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke={ringColor(score)} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" transform="rotate(-90 22 22)"/>
      </svg>
      <span className={`absolute text-xs font-black tabular-nums ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ─── Stat Badge ───────────────────────────────────────────────────────────────
function StatBadge({ label, value, cls }) {
  return (
    <div className={`rounded-lg border px-1.5 py-1.5 text-center ${cls.bg}`}>
      <div className={`text-xs font-black tabular-nums leading-none ${cls.text}`}>{value}</div>
      <div className="text-gray-600 mt-0.5 leading-none" style={{fontSize:'10px'}}>{label}</div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3.5 animate-pulse">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-11 h-11 rounded-full bg-gray-800 flex-shrink-0"/>
        <div className="flex-1 space-y-1.5"><div className="h-3.5 bg-gray-800 rounded w-3/4"/><div className="h-3 bg-gray-800 rounded w-1/2"/></div>
        <div className="w-11 h-11 rounded-full bg-gray-800 flex-shrink-0"/>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {[0,1,2,3].map(i=><div key={i} className="h-9 bg-gray-800 rounded-lg"/>)}
      </div>
    </div>
  );
}

// ─── Score tooltip text by category ─────────────────────────────────────────
const SCORE_TOOLTIP = {
  hitting:  'EdgeScore — likelihood of recording a hit today',
  hr:       'EdgeScore — likelihood of hitting a home run today',
  runs:     'EdgeScore — likelihood of scoring a run today',
  rbi:      'EdgeScore — likelihood of recording an RBI today',
  sb:       'EdgeScore — likelihood of stealing a base today',
  pitching: 'EdgeScore — projected strikeout edge vs book line',
};

// ─── Auto Board Player Card ───────────────────────────────────────────────────
function AutoPlayerCard({ player, category, rank }) {
  const score      = player.scores?.[category] ?? 50;
  const isPitcher  = category === 'pitching';
  const m          = player.matchup;
  const lastName   = m?.pitcher?.name?.split(' ').slice(-1)[0] ?? 'TBD';
  const hand       = m?.pitcher?.hand ? m.pitcher.hand + 'HP ' : '';
  const matchupTxt = m
    ? isPitcher
      ? `${m.isHome ? 'vs' : '@'} ${m.oppAbbrev}`
      : `${m.isHome ? 'vs' : '@'} ${m.oppAbbrev} · ${hand}${lastName}`
    : null;

  const avgC    = statCls(player.avg    ?? 0, 0.280, 0.250);
  const slgC    = statCls(player.slg    ?? 0, 0.450, 0.380);
  const obpC    = statCls(player.obp    ?? 0, 0.360, 0.320);
  const hrNumC  = statCls(player.homeRuns ?? 0, 20, 10);
  const k9C     = statCls(player.k9     ?? 0, 9.0, 7.0);
  const streakC = player.streak != null
    ? statCls(player.streak, 5, 3)
    : { text:'text-gray-600', bg:'bg-gray-800/50 border-gray-800' };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3.5 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-xs font-black text-gray-700 w-4 text-center flex-shrink-0">#{rank}</span>
        <PlayerHeadshot playerId={player.playerId} name={player.fullName} size={44} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{player.fullName}</p>
          <p className="text-xs text-gray-500">{player.position} · {player.teamAbbrev || player.teamName}</p>
          {matchupTxt && <p className="text-xs text-blue-400 mt-0.5 truncate">{matchupTxt}</p>}
        </div>
        <div className="relative group flex-shrink-0 text-center">
          <ScoreRing score={score} size={44} />
          {isPitcher && <p className="text-xs text-gray-600 mt-0.5 whitespace-nowrap">K Score</p>}
          <div className="absolute bottom-full right-0 mb-2 w-52 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-300 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
            {SCORE_TOOLTIP[category] ?? 'ProprStats Model Score'}
          </div>
        </div>
      </div>

      {isPitcher ? (
        <div className="grid grid-cols-3 gap-1">
          <StatBadge label="ERA"  value={fmt(player.era,  2)} cls={eraCls(player.era)}  />
          <StatBadge label="WHIP" value={fmt(player.whip, 2)} cls={whipCls(player.whip)} />
          <StatBadge label="K/9"  value={fmt(player.k9,   1)} cls={k9C}                  />
        </div>
      ) : category === 'sb' ? (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="SB"   value={player.stolenBases ?? '—'} cls={statCls(player.stolenBases??0,20,10)} />
          <StatBadge label="SB/G" value={player.gamesPlayed>0?fmt((player.stolenBases||0)/player.gamesPlayed,2):'—'} cls={statCls((player.stolenBases||0)/Math.max(player.gamesPlayed||1,1),0.25,0.10)} />
          <StatBadge label="AVG"  value={fmt(player.avg,3)} cls={avgC} />
          <StatBadge label="Streak" value={player.streakLoading?'…':(player.streak??'—')} cls={streakC} />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="AVG" value={fmt(player.avg, 3)} cls={avgC} />
          <StatBadge label="SLG" value={fmt(player.slg, 3)} cls={slgC} />
          {category === 'hr'
            ? <StatBadge label="HR"  value={player.homeRuns ?? '—'} cls={hrNumC} />
            : category === 'rbi'
              ? <StatBadge label="RBI" value={player.rbi ?? '—'} cls={statCls(player.rbi??0,60,40)} />
              : <StatBadge label="OBP" value={fmt(player.obp, 3)} cls={obpC} />
          }
          <StatBadge
            label="Streak"
            value={player.streakLoading ? '…' : (player.streak ?? '—')}
            cls={streakC}
          />
        </div>
      )}
    </div>
  );
}

// ─── Manual Research Card ─────────────────────────────────────────────────────
function ManualPlayerCard({ player, category, win, todayGames, onRemove }) {
  const stats      = useMemo(() => computeWindowStats(player.gamelog, win),  [player.gamelog, win]);
  const projection = useMemo(() => calcManualScore(stats, category),          [stats, category]);
  const propLabel  = useMemo(() => getPropLabel(stats, category),             [stats, category]);

  const g = todayGames?.find(x => x.homeTeamId === player.teamId || x.awayTeamId === player.teamId);
  let matchupTxt = null;
  if (g) {
    const isHome    = g.homeTeamId === player.teamId;
    const opp       = isHome ? (g.awayTeamAbbrev ?? g.awayTeam ?? '') : (g.homeTeamAbbrev ?? g.homeTeam ?? '');
    const pitcher   = isHome ? g.awayProbablePitcher : g.homeProbablePitcher;
    const lastName  = pitcher?.split(' ').slice(-1)[0] ?? 'TBD';
    matchupTxt = `${isHome ? 'vs' : '@'} ${opp} · ${lastName}`;
  }

  const winLabel = win === 'season' ? 'Season' : `L${win}`;

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gray-900 p-4 relative hover:border-blue-500/40 transition-colors">
      <div className="absolute top-2 left-2 text-xs font-bold text-blue-500/60 bg-blue-500/10 px-1.5 py-0.5 rounded">pinned</div>
      <button onClick={() => onRemove(player.playerId)} className="absolute top-2 right-2 text-gray-700 hover:text-red-400 transition-colors text-xs" title="Remove">✕</button>

      <Link href={`/dashboard/player/${player.playerId}?cat=${category}`} className="flex items-center gap-3 mb-3 pt-4 group">
        {player.loading
          ? <div className="rounded-full bg-gray-800 animate-pulse flex-shrink-0" style={{width:56,height:56}}/>
          : <PlayerHeadshot playerId={player.playerId} name={player.fullName} size={56}/>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">{player.fullName}</p>
          <p className="text-xs text-gray-500">{player.primaryPosition} · {player.teamName}</p>
          {matchupTxt
            ? <p className="text-xs text-blue-400 mt-0.5 truncate">{matchupTxt}</p>
            : <p className="text-xs text-gray-700 mt-0.5">No game today</p>
          }
        </div>
        <ScoreRing score={projection} size={48} />
      </Link>

      {propLabel && (
        <div className="mb-3">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">🎯 {propLabel}</span>
        </div>
      )}

      {player.loading ? (
        <div className="space-y-2 animate-pulse"><div className="h-3 bg-gray-800 rounded w-full"/><div className="h-3 bg-gray-800 rounded w-5/6"/></div>
      ) : player.error ? (
        <p className="text-xs text-red-400 italic">{player.error}</p>
      ) : !stats ? (
        <p className="text-xs text-gray-600 italic">No stats found for {winLabel}</p>
      ) : category === 'hitting' ? (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="AVG"  value={fmt(stats.avg, 3)}    cls={statCls(stats.avg,  0.280,0.250)} />
          <StatBadge label="OBP"  value={fmt(stats.obpProxy,3)} cls={statCls(stats.obpProxy,0.360,0.320)} />
          <StatBadge label="SLG"  value={fmt(stats.avg + (stats.hPerGame > 0 ? 0 : 0), 3)} cls={statCls(0.4,0.45,0.38)} />
          <StatBadge label={`H(${winLabel})`} value={stats.totalH} cls={statCls(stats.hPerGame,1.0,0.65)} />
        </div>
      ) : category === 'hr' ? (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="HR/G"  value={fmt(stats.hrPerGame,3)} cls={statCls(stats.hrPerGame,0.25,0.12)} />
          <StatBadge label={`HR(${winLabel})`} value={stats.totalHR} cls={statCls(stats.totalHR, win==='5'?1:win==='10'?2:15, win==='5'?0:1)} />
          <StatBadge label="AVG"   value={fmt(stats.avg,3)} cls={statCls(stats.avg,0.280,0.250)} />
          <StatBadge label="Games" value={stats.games} cls={{text:'text-gray-400',bg:'bg-gray-800 border-gray-700'}} />
        </div>
      ) : category === 'runs' ? (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="R/G"   value={fmt(stats.rPerGame,2)}  cls={statCls(stats.rPerGame, 0.7,0.4)} />
          <StatBadge label="R(L10)" value={stats.totalR}          cls={statCls(stats.totalR,   5,3)} />
          <StatBadge label="OBP"   value={fmt(stats.obpProxy,3)}  cls={statCls(stats.obpProxy, 0.360,0.320)} />
          <StatBadge label="Games" value={stats.games}            cls={{text:'text-gray-400',bg:'bg-gray-800 border-gray-700'}} />
        </div>
      ) : category === 'rbi' ? (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="RBI/G"  value={fmt(stats.rbiPerGame,2)} cls={statCls(stats.rbiPerGame,0.7,0.4)} />
          <StatBadge label="RBI(L10)" value={stats.totalRBI}        cls={statCls(stats.totalRBI, 5,3)} />
          <StatBadge label="AVG"    value={fmt(stats.avg,3)}        cls={statCls(stats.avg,0.280,0.250)} />
          <StatBadge label="Games"  value={stats.games}             cls={{text:'text-gray-400',bg:'bg-gray-800 border-gray-700'}} />
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">No pinned stats for this category.</p>
      )}
    </div>
  );
}


// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:'hitting',  label:'Hits',         icon:(
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l14 9-14 9V3z"/>
    </svg>
  )},
  { id:'runs',     label:'Runs',         icon:(
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
    </svg>
  )},
  { id:'rbi',      label:'RBI',          icon:(
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )},
  { id:'hr',       label:'Home Runs',    icon:(
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    </svg>
  )},
  { id:'sb',       label:'Stolen Bases', icon:(
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )},
  { id:'pitching', label:'Pitching',     icon:(
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8c-2.5 0-4 1.5-4 4s1.5 4 4 4 4-1.5 4-4"/>
    </svg>
  )},
];

// Maps dashboard category → player page cat param
const CAT_TO_PLAYER_TAB = { hitting:'hits', hr:'hr', runs:'runs', rbi:'rbi', sb:'sb', pitching:null };

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  // ── Free tier plan check (disabled for beta) ─────────────────────────────
  const [isPro, setIsPro] = useState(true);

  // ── Category ──────────────────────────────────────────────────────────────
  const [category, setCategory] = useState('hitting');

  // ── Auto board ────────────────────────────────────────────────────────────
  const [boardPlayers,  setBoardPlayers]  = useState([]);
  const [boardLoading,  setBoardLoading]  = useState(true);
  const [boardError,    setBoardError]    = useState(null);
  const [todayGames,    setTodayGames]    = useState([]);
  const [gameWeatherMap, setGameWeatherMap] = useState({});

  // ── PrizePicks lines (keyed by player name) ────────────────────────────────
  const [ppLinesByName,  setPpLinesByName]  = useState(null);

  // ── Manual research ───────────────────────────────────────────────────────
  const [teams,            setTeams]           = useState([]);
  const [selectedTeamId,   setSelectedTeamId]  = useState('');
  const [roster,           setRoster]          = useState([]);
  const [selectedPlayerId, setSelectedPlayerId]= useState('');
  const [researchList,     setResearchList]    = useState([]);
  const [teamsLoading,     setTeamsLoading]    = useState(false);
  const [rosterLoading,    setRosterLoading]   = useState(false);

  // ── Derived top-20 for active category ────────────────────────────────────
  const currentBoard = useMemo(() => {
    return [...boardPlayers]
      .filter(p => (p.scores?.[category] ?? 0) > 0)
      .sort((a, b) => (b.scores?.[category] ?? 0) - (a.scores?.[category] ?? 0))
      .slice(0, 25);
  }, [boardPlayers, category]);

  // ── Filtered board (team/player selection) ────────────────────────────────
  const filteredBoard = useMemo(() => {
    if (selectedPlayerId) {
      const p = boardPlayers.find(p => p.playerId === Number(selectedPlayerId));
      return p ? [p] : [];
    }
    if (selectedTeamId) {
      return [...boardPlayers]
        .filter(p => p.teamId === Number(selectedTeamId) && (p.scores?.[category] ?? 0) > 0)
        .sort((a, b) => (b.scores?.[category] ?? 0) - (a.scores?.[category] ?? 0));
    }
    return currentBoard;
  }, [boardPlayers, selectedTeamId, selectedPlayerId, category, currentBoard]);

  // ── Load daily board ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/`).catch(() => {});
    loadDailyBoard();
  }, []);

  // ── Fetch PrizePicks lines (non-blocking, re-scores pitchers when ready) ──
  useEffect(() => {
    async function fetchPP() {
      try {
        const res = await fetch(`/api/prizepicks`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.lines) setPpLinesByName(data.lines);
      } catch {}
    }
    fetchPP();
  }, []);

  // Re-score pitchers once PP lines arrive — OR once the board loads (whichever is later).
  // /api/prizepicks is live (fetches latest from GitHub) but the board takes 5-10s to build,
  // so we depend on boardPlayers.length to catch the case where PP loads first.
  useEffect(() => {
    if (!ppLinesByName || !boardPlayers.length) return;
    setBoardPlayers(prev => prev.map(p => {
      if (p.position !== 'SP') return p;
      const ppMatch = findPPLines(p.fullName, ppLinesByName);
      if (!ppMatch?.strikeouts) return p;
      const kProj   = computeKProjection(p.pitcherStarts, p.k9, p.matchup?.oppAbbrev);
      const newScore = (kProj != null ? pitcherKScore(kProj, ppMatch.strikeouts) : null)
        ?? scorePitcher({ era: p.era, whip: p.whip, k9: p.k9 }, ppMatch.strikeouts);
      return { ...p, scores: { ...p.scores, pitching: newScore } };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppLinesByName, boardPlayers.length]);

  async function loadDailyBoard() {
    // Bust localStorage cache on new deploy.
    // NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is injected automatically by Vercel
    // and changes on every push, so any new deploy wipes stale roster/team cache.
    try {
      const deployId = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev';
      if (localStorage.getItem('ctb_deploy') !== deployId) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k?.startsWith('mlb_')) localStorage.removeItem(k);
        }
        localStorage.setItem('ctb_deploy', deployId);
      }
    } catch {}

    setBoardLoading(true);
    setBoardError(null);
    setBoardPlayers([]); // clear stale data before rebuild

    try {
      // Use local date — toISOString() returns UTC which rolls over to tomorrow
      // for users in US time zones after ~7–8pm ET.
      const _now  = new Date();
      const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

      // 1. Today's games
      const gRes  = await fetch(`${API_URL}/games/probables?date=${today}`);
      if (!gRes.ok) throw new Error('Could not fetch today\'s games');
      const gData = await gRes.json();
      const games = gData.games || [];
      setTodayGames(games);

      if (!games.length) { setBoardLoading(false); return; }

      // 2. Build team map from teams API (cached)
      let teamList = getCached(`mlb_teams_${SEASON}`, 24*60*60*1000);
      if (!teamList) {
        const tr   = await fetch(`${MLB_API}/teams?sportId=1&season=${SEASON}`);
        const td   = await tr.json();
        teamList   = (td.teams||[]).filter(t=>t.sport?.id===1&&t.active)
          .map(t=>({ id:t.id, name:t.name, abbreviation:t.abbreviation }));
        setCached(`mlb_teams_${SEASON}`, teamList);
        setTeams(teamList);
      }
      const teamMap = Object.fromEntries(teamList.map(t=>[t.id, t]));

      // 3. Collect unique team IDs + pitcher IDs
      const teamIds    = new Set();
      const pitcherIds = new Set();
      const gameByTeam = {};  // teamId → game
      for (const g of games) {
        if (g.homeTeamId) { teamIds.add(g.homeTeamId); gameByTeam[g.homeTeamId] = g; }
        if (g.awayTeamId) { teamIds.add(g.awayTeamId); gameByTeam[g.awayTeamId] = g; }
        if (g.homeProbablePitcherId) pitcherIds.add(g.homeProbablePitcherId);
        if (g.awayProbablePitcherId) pitcherIds.add(g.awayProbablePitcherId);
      }

      // 4. Fetch pitcher season stats — 2026 primary, 2025 fallback for thin samples
      const pitcherMap = {};
      if (pitcherIds.size > 0) {
        const ids = [...pitcherIds].join(',');
        const extractPitcher = (p, st) => ({
          id:   p.id, name: p.fullName,
          era:  parseFloat(st.era)  || 4.50,
          whip: parseFloat(st.whip) || 1.30,
          k9:   parseFloat(st.strikeoutsPer9Inn) || parseFloat(st.k9) || 8.0,
          hand: p.pitchHand?.code || null,
          gs26: parseInt(st.gamesStarted) || 0,
        });
        // current season primary
        try {
          const pr = await fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=pitching,type=season,season=${SEASON})`);
          const pd = await pr.json();
          for (const p of (pd.people||[])) {
            const st = p.stats?.find(s=>s.group?.displayName==='pitching')?.splits?.[0]?.stat;
            if (st) pitcherMap[p.id] = extractPitcher(p, st);
          }
        } catch {}
        // 2025 fallback for pitchers with < 3 starts in 2026
        const thin = ids.split(',').filter(pid => !pitcherMap[pid] || (pitcherMap[pid].gs26 < 3));
        if (thin.length > 0) {
          try {
            const pr25 = await fetch(`${MLB_API}/people?personIds=${thin.join(',')}&hydrate=stats(group=pitching,type=season,season=2025)`);
            const pd25 = await pr25.json();
            for (const p of (pd25.people||[])) {
              const st = p.stats?.find(s=>s.group?.displayName==='pitching')?.splits?.[0]?.stat;
              if (st && !pitcherMap[p.id]) pitcherMap[p.id] = extractPitcher(p, st);
              else if (st && pitcherMap[p.id]?.gs26 < 3) {
                // Blend: prefer 2025 ERA/WHIP/K9 as more reliable signal
                pitcherMap[p.id].era  = parseFloat(st.era)  || pitcherMap[p.id].era;
                pitcherMap[p.id].whip = parseFloat(st.whip) || pitcherMap[p.id].whip;
                pitcherMap[p.id].k9   = parseFloat(st.strikeoutsPer9Inn) || pitcherMap[p.id].k9;
              }
            }
          } catch {}
        }
      }

      // 4b. Fetch pitcher game logs — 2026 primary, supplement with 2025 if < 5 starts
      const parseStarts = splits => splits
        .filter(s => (parseFloat(s.stat?.inningsPitched) || 0) >= 3)
        .map(s => ({ date: s.date, strikeOuts: parseInt(s.stat?.strikeOuts)||0, inningsPitched: parseFloat(s.stat?.inningsPitched)||0 }));

      if (Object.keys(pitcherMap).length > 0) {
        await Promise.all(Object.keys(pitcherMap).map(async (pid) => {
          const cKey = `mlb_pitcher_starts_${pid}_${SEASON}`;
          const cached = getCached(cKey, 2 * 60 * 60 * 1000);
          if (cached) { pitcherMap[pid].starts = cached; return; }
          try {
            const gr26 = await fetch(`${MLB_API}/people/${pid}/stats?stats=gameLog&group=pitching&season=${SEASON}&gameType=R`);
            const gd26 = await gr26.json();
            let starts = parseStarts(gd26.stats?.[0]?.splits || []);
            // Supplement with 2025 tail if fewer than 5 starts in 2026
            if (starts.length < 5) {
              try {
                const gr25 = await fetch(`${MLB_API}/people/${pid}/stats?stats=gameLog&group=pitching&season=2025&gameType=R`);
                const gd25 = await gr25.json();
                const starts25 = parseStarts(gd25.stats?.[0]?.splits || []);
                const needed = Math.max(0, 5 - starts.length);
                starts = [...starts25.slice(-needed), ...starts];
              } catch {}
            }
            pitcherMap[pid].starts = starts;
            setCached(cKey, starts);
          } catch { pitcherMap[pid].starts = []; }
        }));
      }

      // 5. For each team playing: get roster + batch batter season stats
      const allPlayers = [];
      await Promise.all([...teamIds].map(async (teamId) => {
        // Roster (cached 6h)
        const rKey   = `mlb_roster_${teamId}_${SEASON}`;
        let roster   = getCached(rKey, 6*60*60*1000);
        if (!roster) {
          try {
            const rr = await fetch(`${MLB_API}/teams/${teamId}/roster?rosterType=active&season=${SEASON}`);
            const rd = await rr.json();
            // Deduplicate by player id — API sometimes returns same player twice
            const seen = new Set();
            roster = (rd.roster||[])
              .filter(p => seen.has(p.person.id) ? false : seen.add(p.person.id))
              .map(p=>({ id:p.person.id, fullName:p.person.fullName, position:p.position?.abbreviation??'' }));
            setCached(rKey, roster);
          } catch { return; }
        }
        // Deduplicate cached roster too (handles legacy entries saved before this fix)
        const seenIds = new Set();
        roster = roster.filter(p => seenIds.has(p.id) ? false : seenIds.add(p.id));
        if (!roster.length) return;

        // Batch season batting stats — fetch both 2026 and 2025 in parallel, blend all players
        const ids = roster.map(p=>p.id).join(',');
        const statsMap = {};
        const raw26 = {}, raw25 = {};
        try {
          const [sr26, sr25] = await Promise.all([
            fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=hitting,type=season,season=${SEASON})`),
            fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=hitting,type=season,season=2025)`),
          ]);
          if (!sr26.ok) return;
          const [sd26, sd25] = await Promise.all([sr26.json(), sr25.ok ? sr25.json() : Promise.resolve({people:[]})]);
          for (const p of (sd26.people||[])) {
            const st = p.stats?.find(s=>s.group?.displayName==='hitting')?.splits?.[0]?.stat;
            if (st) raw26[p.id] = st;
          }
          for (const p of (sd25.people||[])) {
            const st = p.stats?.find(s=>s.group?.displayName==='hitting')?.splits?.[0]?.stat;
            if (st) raw25[p.id] = st;
          }
        } catch { return; }
        for (const p of roster) {
          const blended = blendBatterStats(raw26[p.id], raw25[p.id]);
          if (blended) statsMap[p.id] = blended;
        }

        // Build game context for this team
        const game     = gameByTeam[teamId];
        const isHome   = game?.homeTeamId === teamId;
        const oppId    = isHome ? game?.awayTeamId   : game?.homeTeamId;
        const oppAbbrev= teamMap[oppId]?.abbreviation ?? (isHome ? game?.awayTeam : game?.homeTeam) ?? '';
        const pitId    = isHome ? game?.awayProbablePitcherId : game?.homeProbablePitcherId;
        const pitName  = isHome ? game?.awayProbablePitcher   : game?.homeProbablePitcher;
        const pitcher  = pitcherMap[pitId] || (pitName ? { name:pitName, era:4.50, whip:1.30, k9:8.0, hand:null } : null);
        const team     = teamMap[teamId] || { name:'', abbreviation:'' };

        for (const rp of roster) {
          const stats = statsMap[rp.id];
          if (!stats) continue;
          const homeAbbrevPark = isHome ? normDashAbbrev(team.abbreviation) : normDashAbbrev(oppAbbrev);
          const parkHR         = PARK_HR[homeAbbrevPark] ?? null;
          const pitcherHand    = pitcher?.hand ?? null;
          const gameHomeTeamId = game?.homeTeamId ?? null;
          const playerWithCtx  = { ...stats, matchup:{ isHome, oppAbbrev, pitcher }, parkHR, pitcherHand };
          allPlayers.push({
            playerId:    rp.id,
            fullName:    rp.fullName,
            position:    rp.position,
            teamId,
            teamName:    team.name,
            teamAbbrev:  team.abbreviation,
            ...stats,
            parkHR,
            pitcherHand,
            gameHomeTeamId,
            matchup:     { isHome, oppAbbrev, pitcher },
            scores: {
              hitting:  computeProjectionScore(playerWithCtx, 'hitting'),
              hr:       computeProjectionScore(playerWithCtx, 'hr'),
              runs:     computeProjectionScore(playerWithCtx, 'runs'),
              rbi:      computeProjectionScore(playerWithCtx, 'rbi'),
              sb:       computeProjectionScore(playerWithCtx, 'sb'),
              pitching: 0,
            },
            streak:        null,
            l10Avg:        null,
            streakLoading: true,
          });
        }

        // Add today's pitcher entries for pitching category
        const myPitcherId = isHome ? game?.homeProbablePitcherId : game?.awayProbablePitcherId;
        const myPitcher   = pitcherMap[myPitcherId];
        if (myPitcher && myPitcherId) {
          const oppAbbrevP  = teamMap[oppId]?.abbreviation ?? '';
          const homeAbbrevP = isHome ? team.abbreviation : oppAbbrevP;
          // pitcherSavant starts null — filled in by fetchPitcherStatcastData enrichment
          const kProj = computeKProjection(myPitcher.starts, myPitcher.k9, oppAbbrevP, null, homeAbbrevP);
          const pitchingScore = pitcherKScore(kProj) ?? scorePitcher(myPitcher);
          allPlayers.push({
            playerId:      myPitcherId,
            fullName:      myPitcher.name,
            position:      'SP',
            teamId,
            teamName:      team.name,
            teamAbbrev:    team.abbreviation,
            homeAbbrev:    homeAbbrevP,
            era:           myPitcher.era,
            whip:          myPitcher.whip,
            k9:            myPitcher.k9,
            pitcherStarts: myPitcher.starts || [],
            matchup:       { isHome, oppAbbrev: oppAbbrevP, pitcher: null },
            scores:        { hitting:0, hr:0, runs:0, rbi:0, sb:0, pitching: pitchingScore },
            streak:        null,
            streakLoading: false,
          });
        }
      }));

      // Deduplicate by playerId — guards against roster API returning same player
      // on multiple entries or a player appearing on two teams during a trade window
      const uniqueMap = new Map();
      for (const p of allPlayers) uniqueMap.set(p.playerId, p);
      const dedupedPlayers = [...uniqueMap.values()];

      setBoardPlayers(dedupedPlayers);
      setBoardLoading(false);

      // 6. Enrichment phase — run in parallel (non-blocking)
      // topIds: top 40 per category — wider net covers rank shifts after Statcast/streak enrichment
      const topIds = new Set();
      for (const cat of ['hitting','hr','runs','rbi','sb']) {
        [...dedupedPlayers]
          .filter(p=>p.scores[cat]>0)
          .sort((a,b)=>b.scores[cat]-a.scores[cat])
          .slice(0,40)
          .forEach(p=>topIds.add(p.playerId));
      }
      // Statcast loads fast (1 request), streaks load progressively (batched)
      fetchStatcastData();
      fetchPitcherStatcastData();
      fetchStreaks([...topIds]);
      fetchWeatherData(games, teamMap);
      fetchPlatoonSplits([...topIds]);

    } catch (err) {
      setBoardError(err.message || 'Failed to load today\'s board');
      setBoardLoading(false);
    }
  }

  async function fetchStreaks(playerIds) {
    // Fetch 10 at a time — enough concurrency without hammering the backend
    for (let i = 0; i < playerIds.length; i += 10) {
      const batch = playerIds.slice(i, i + 10);
      await Promise.all(batch.map(async (pid) => {
        try {
          const r = await fetch(`${API_URL}/player/${pid}/gamelog?season=${SEASON}`);
          if (!r.ok) throw new Error();
          const d    = await r.json();
          const games = d.games || [];
          const streak = computeStreak(games);

          // L10 batting average from last 10 games
          const last10 = games.slice(-10);
          const l10H  = last10.reduce((a, g) => a + (Number(g.hits)   || 0), 0);
          const l10AB = last10.reduce((a, g) => a + (Number(g.atBats) || 0), 0);
          const l10Avg = l10AB >= 15 ? l10H / l10AB : null;

          // L10 HR rate — HR-specific recency signal (hit streak ≠ HR predictor)
          const l10HR = last10.reduce((a, g) => a + (Number(g.homeRuns)        || 0), 0);
          const l10PA = last10.reduce((a, g) => a + (Number(g.plateAppearances)|| 0), 0);
          const l10HRrate = l10PA >= 20 ? l10HR / l10PA : null;

          // Total 2026 PA from game log — used to scale L10 HR weight (Option A)
          const pa26Raw = games.reduce((a, g) => a + (Number(g.plateAppearances) || 0), 0);

          setBoardPlayers(prev => prev.map(p => {
            if (p.playerId !== pid) return p;
            const updated = { ...p, streak, l10Avg, l10HRrate, pa26Raw, streakLoading: false };
            // Re-score all batting categories now that recency data is available
            const newScores = { ...p.scores };
            for (const cat of ['hitting', 'hr', 'runs', 'rbi', 'sb']) {
              if (newScores[cat] > 0) {
                newScores[cat] = computeProjectionScore(updated, cat);
              }
            }
            return { ...updated, scores: newScores };
          }));
        } catch {
          setBoardPlayers(prev => prev.map(p => p.playerId===pid ? {...p, streakLoading:false} : p));
        }
      }));
    }
  }

  async function fetchWeatherData(games, teamMap) {
    try {
      const homeTeamVenues = {};
      for (const g of games) {
        if (!g.homeTeamId) continue;
        const abbrev = normDashAbbrev(teamMap[g.homeTeamId]?.abbreviation || '');
        const coords = VENUE_COORDS[abbrev];
        if (coords) homeTeamVenues[g.homeTeamId] = { lat: coords.lat, lon: coords.lon };
      }
      const entries = Object.entries(homeTeamVenues);
      if (!entries.length) return;
      const results = await Promise.allSettled(
        entries.map(([homeTeamId, { lat, lon }]) =>
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m&timezone=auto`,
            { signal: AbortSignal.timeout(6000) }
          )
            .then(r => r.json())
            .then(d => [homeTeamId, {
              temp:      d.current?.temperature_2m     ?? 21,
              windSpeed: d.current?.wind_speed_10m      ?? 0,
              windDir:   d.current?.wind_direction_10m  ?? 0,
            }])
        )
      );
      const wxMap = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const [id, wx] = r.value;
          wxMap[id] = wx;
        }
      }
      if (!Object.keys(wxMap).length) return;
      setGameWeatherMap(wxMap);
      setBoardPlayers(prev => prev.map(p => {
        if (!p.gameHomeTeamId) return p;
        const weather = wxMap[p.gameHomeTeamId];
        if (!weather) return p;
        const updated = { ...p, weather };
        const newScores = { ...p.scores };
        for (const cat of ['hitting', 'hr', 'runs', 'rbi', 'sb']) {
          if (newScores[cat] > 0) newScores[cat] = computeProjectionScore(updated, cat);
        }
        return { ...updated, scores: newScores };
      }));
    } catch {}
  }

  async function fetchPlatoonSplits(playerIds) {
    if (!playerIds.length) return;
    try {
      const ids = playerIds.join(',');
      const r = await fetch(
        `${MLB_API}/people?personIds=${ids}&hydrate=stats(group=%5Bhitting%5D,type=%5BvsPlayer,statSplits%5D,sitCodes=%5Bvl,vr%5D,season=${SEASON})`
      );
      if (!r.ok) return;
      const d = await r.json();
      const splitsMap = {};
      for (const p of (d.people || [])) {
        const stats = p.stats || [];
        let splitData = [];
        for (const sg of stats) {
          if (sg.splits?.length) { splitData = sg.splits; break; }
        }
        const vsLeft  = splitData.find(s => s.split?.code === 'vl');
        const vsRight = splitData.find(s => s.split?.code === 'vr');
        splitsMap[p.id] = {
          vsLeft:  vsLeft?.stat  ? { avg: parseFloat(vsLeft.stat.avg)||null,  obp: parseFloat(vsLeft.stat.obp)||null,  slg: parseFloat(vsLeft.stat.slg)||null  } : null,
          vsRight: vsRight?.stat ? { avg: parseFloat(vsRight.stat.avg)||null, obp: parseFloat(vsRight.stat.obp)||null, slg: parseFloat(vsRight.stat.slg)||null } : null,
        };
      }
      setBoardPlayers(prev => prev.map(p => {
        const sp = splitsMap[p.playerId];
        if (!sp) return p;
        const rel = p.pitcherHand === 'L' ? sp.vsLeft : sp.vsRight;
        if (!rel) return p;
        const updated = { ...p, splitAVG: rel.avg, splitSLG: rel.slg, splitOBP: rel.obp };
        const newScores = { ...p.scores };
        for (const cat of ['hitting', 'hr', 'runs', 'rbi', 'sb']) {
          if (newScores[cat] > 0) newScores[cat] = computeProjectionScore(updated, cat);
        }
        return { ...updated, scores: newScores };
      }));
    } catch {}
  }

  async function fetchStatcastData() {
    try {
      const r = await fetch(`${API_URL}/statcast/batters?season=2025`);
      if (!r.ok) return;
      const map = await r.json();
      setBoardPlayers(prev => prev.map(p => {
        const sc = map[p.playerId];
        if (!sc) return p;
        const updated = { ...p, ...sc };
        const newScores = { ...p.scores };
        for (const cat of ['hitting', 'hr', 'runs']) {
          if (newScores[cat] > 0) {
            newScores[cat] = computeProjectionScore(updated, cat);
          }
        }
        return { ...updated, scores: newScores };
      }));
    } catch {}
  }

  async function fetchPitcherStatcastData() {
    try {
      const r = await fetch(`${API_URL}/statcast/pitchers?season=2025`);
      if (!r.ok) return;
      const map = await r.json();
      setBoardPlayers(prev => prev.map(p => {
        if (p.position !== 'SP') return p;
        const sc = map[p.playerId];
        if (!sc) return p;
        // Re-compute K projection with real Savant data
        const kProj = computeKProjection(
          p.pitcherStarts, p.k9,
          p.matchup?.oppAbbrev ?? '',
          sc,
          p.homeAbbrev ?? ''
        );
        const newPitchingScore = pitcherKScore(kProj) ?? p.scores.pitching;
        return {
          ...p,
          pitcherSavant: sc,
          scores: { ...p.scores, pitching: newPitchingScore },
        };
      }));
    } catch {}
  }

  // ── Load teams for manual dropdown ────────────────────────────────────────
  useEffect(() => {
    if (teams.length) return; // already loaded by loadDailyBoard
    async function fetchTeams() {
      const cached = getCached(`mlb_teams_${SEASON}`, 24*60*60*1000);
      if (cached) { setTeams(cached); return; }
      setTeamsLoading(true);
      try {
        const r = await fetch(`${MLB_API}/teams?sportId=1&season=${SEASON}`);
        const d = await r.json();
        const list = (d.teams||[]).filter(t=>t.sport?.id===1&&t.active)
          .map(t=>({id:t.id,name:t.name,abbreviation:t.abbreviation}))
          .sort((a,b)=>a.name.localeCompare(b.name));
        setCached(`mlb_teams_${SEASON}`, list);
        setTeams(list);
      } catch {}
      setTeamsLoading(false);
    }
    fetchTeams();
  }, [teams.length]);

  // ── Load roster when team changes ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeamId) { setRoster([]); setSelectedPlayerId(''); return; }
    async function fetchRoster() {
      const key    = `mlb_roster_${selectedTeamId}_${SEASON}`;
      const cached = getCached(key, 6*60*60*1000);
      if (cached) { setRoster(cached); setSelectedPlayerId(''); return; }
      setRosterLoading(true);
      try {
        const r = await fetch(`${MLB_API}/teams/${selectedTeamId}/roster?rosterType=active&season=${SEASON}`);
        const d = await r.json();
        const list = (d.roster||[]).map(p=>({id:p.person.id,fullName:p.person.fullName,position:p.position?.abbreviation??''})).sort((a,b)=>a.fullName.localeCompare(b.fullName));
        setCached(key, list);
        setRoster(list);
        setSelectedPlayerId('');
      } catch {}
      setRosterLoading(false);
    }
    fetchRoster();
  }, [selectedTeamId]);

  // ── Platoon fetch for dropdown-selected player ────────────────────────────
  // If a player is chosen from the roster dropdown but wasn't in the initial
  // topIds enrichment (low pre-enrichment score), fetch their splits on demand.
  useEffect(() => {
    if (!selectedPlayerId) return;
    const pid = Number(selectedPlayerId);
    const player = boardPlayers.find(p => p.playerId === pid);
    if (!player || player.splitAVG != null) return; // already has splits
    fetchPlatoonSplits([pid]);
  }, [selectedPlayerId, boardPlayers]);

  // ── Add / remove manual player ────────────────────────────────────────────
  async function addPlayer() {
    if (!selectedPlayerId) return;
    const player = roster.find(p => p.id === Number(selectedPlayerId));
    if (!player || researchList.some(r => r.playerId === player.id)) return;
    const team  = teams.find(t => t.id === Number(selectedTeamId));
    const entry = { playerId:player.id, fullName:player.fullName, primaryPosition:player.position, teamId:Number(selectedTeamId), teamName:team?.name??'', gamelog:[], loading:true, error:null };
    setResearchList(prev => [entry, ...prev]);
    try {
      const r = await fetch(`${API_URL}/player/${player.id}/gamelog?season=${SEASON}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setResearchList(prev => prev.map(p => p.playerId===player.id ? {...p, gamelog:d.games??[], loading:false} : p));
    } catch {
      setResearchList(prev => prev.map(p => p.playerId===player.id ? {...p, loading:false, error:'Could not load stats'} : p));
    }
  }

  function removePlayer(pid) { setResearchList(prev => prev.filter(r => r.playerId !== pid)); }

  // ── Clear filters + pinned players ───────────────────────────────────────
  function clearAll() {
    setSelectedTeamId('');
    setSelectedPlayerId('');
    setResearchList([]);
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Top-level view selector ──────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-gray-900 border border-gray-800 w-fit">
          <button className="relative inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.03]">
            <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500/30 to-transparent pointer-events-none"/>
            Props Board
          </button>
          <Link href="/dashboard/matchup"
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-gray-400 hover:text-white">
            Matchup Analyzer
          </Link>
          <Link href="/dashboard/weather"
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-gray-400 hover:text-white">
            Weather
          </Link>
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="relative mb-8 rounded-2xl border border-gray-700/30 bg-gray-900/40 backdrop-blur-sm px-6 py-5 overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-600/6 rounded-full blur-3xl pointer-events-none"/>
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-indigo-600/4 rounded-full blur-2xl pointer-events-none"/>

          <div className="relative flex items-start justify-between gap-4">
            {/* Left — icon + title */}
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex-shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/15 border border-blue-500/25">
                <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                </svg>
              </div>
              <div>
                <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"/>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                    {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Today&apos;s Top Props</h1>
                <p className="mt-1 text-sm text-gray-400">
                  {boardLoading
                    ? <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"/>Loading today&apos;s slate…</span>
                    : boardError
                      ? <span className="text-red-400">{boardError}</span>
                      : <span>Top <span className="text-white font-semibold">{currentBoard.length}</span> plays ranked by ProprStats model — select a category below</span>
                  }
                </p>
              </div>
            </div>

            {/* Right — stats + refresh pinned to top */}
            {!boardLoading && !boardError && boardPlayers.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <div className="text-center px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/40">
                  <p className="text-xs font-black text-white">{boardPlayers.filter(p=>p.position!=='SP').length}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Batters</p>
                </div>
                <div className="text-center px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/40">
                  <p className="text-xs font-black text-white">{boardPlayers.filter(p=>p.position==='SP').length}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pitchers</p>
                </div>
                <button onClick={loadDailyBoard} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-400 transition-colors border border-gray-700/50 hover:border-blue-500/40 rounded-lg px-3 py-1.5 bg-gray-800/40 hover:bg-blue-500/5">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.07-4.14"/>
                  </svg>
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Category + Filter Controls ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {CATEGORIES.map(cat => {
            const active = category === cat.id;
            return (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.03]'
                    : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 hover:bg-gray-800/80'
                }`}>
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500/30 to-transparent pointer-events-none"/>
                )}
                <span className={active ? 'text-blue-200' : 'text-gray-500'}>{cat.icon}</span>
                {cat.label}
              </button>
            );
          })}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select value={selectedTeamId} onChange={e=>{setSelectedTeamId(e.target.value);setSelectedPlayerId('');}} disabled={teamsLoading}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50">
              <option value="">{teamsLoading?'Loading…':'All Teams'}</option>
              {teams.sort((a,b)=>a.name.localeCompare(b.name)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {selectedTeamId && (
              <select value={selectedPlayerId} onChange={e=>setSelectedPlayerId(e.target.value)} disabled={rosterLoading}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50">
                <option value="">{rosterLoading?'Loading…':'All Players'}</option>
                {roster.map(p=><option key={p.id} value={p.id}>{p.fullName} ({p.position})</option>)}
              </select>
            )}
            {(selectedTeamId || researchList.length > 0) && (
              <button onClick={clearAll}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Board ───────────────────────────────────────────────────────── */}
        {boardLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {Array.from({length:20}).map((_,i) => <SkeletonCard key={i}/>)}
          </div>
        ) : filteredBoard.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 py-16 text-center mb-10">
            <div className="mb-3 opacity-30"><ProprStatsLogo variant="light" size={40} showWordmark={false}/></div>
            {boardPlayers.length === 0 ? (
              <>
                <p className="text-gray-500 font-semibold">No games scheduled today</p>
                <p className="text-sm text-gray-600 mt-1">Come back on a game day for today&apos;s top props.</p>
              </>
            ) : selectedPlayerId ? (
              <>
                <p className="text-gray-500 font-semibold">Player not in today&apos;s slate</p>
                <p className="text-sm text-gray-600 mt-1">This player may not have a game today.</p>
              </>
            ) : category === 'pitching' ? (
              <>
                <p className="text-gray-500 font-semibold">No probable pitchers posted yet</p>
                <p className="text-sm text-gray-600 mt-1">Pitching tab populates once pitchers are announced.</p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-semibold">No qualifying players for this category</p>
                <p className="text-sm text-gray-600 mt-1">Try a different category.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {selectedPlayerId && filteredBoard.length > 0 && (
              <div className="flex justify-end mb-3">
                <button onClick={addPlayer}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20">
                  📌 Pin Player
                </button>
              </div>
            )}
            {(() => {
              const FREE_LIMIT = 5;
              const visiblePlayers = isPro ? filteredBoard : filteredBoard.slice(0, FREE_LIMIT);
              const lockedPlayers  = isPro ? [] : filteredBoard.slice(FREE_LIMIT);
              const gridCls = `grid gap-3 mb-2 ${selectedPlayerId ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`;
              return (
                <>
                  <div className={gridCls}>
                    {visiblePlayers.map((player, idx) => {
                      const pitcher = player.matchup?.pitcher;
                      const playerTab = CAT_TO_PLAYER_TAB[category];
                      const params = new URLSearchParams({
                        name:        player.fullName        || '',
                        teamId:      player.teamId          || '',
                        pitcherId:   pitcher?.id            || '',
                        pitcherName: pitcher?.name          || '',
                        pitcherHand: pitcher?.hand          || '',
                        oppAbbrev:   player.matchup?.oppAbbrev || '',
                        isHome:      player.matchup?.isHome ? 'true' : 'false',
                        teamName:    player.teamName        || '',
                        teamAbbrev:  player.teamAbbrev      || '',
                        position:    player.position        || '',
                        ...(playerTab ? { cat: playerTab } : {}),
                      });
                      return (
                        <Link key={player.playerId} href={`/dashboard/player/${player.playerId}?${params}`} className="block">
                          <AutoPlayerCard player={player} category={category} rank={idx+1}/>
                        </Link>
                      );
                    })}
                  </div>
                  {lockedPlayers.length > 0 && (
                    <div className="relative mb-10">
                      <div className={`${gridCls} pointer-events-none select-none`}>
                        {lockedPlayers.map((player, idx) => (
                          <div key={player.playerId} className="blur-md opacity-40">
                            <AutoPlayerCard player={player} category={category} rank={visiblePlayers.length + idx + 1}/>
                          </div>
                        ))}
                      </div>
                      {/* Gradient fade + CTA overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950/60 to-gray-950 pointer-events-none"/>
                      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end pb-6 gap-3">
                        <p className="text-sm font-bold text-white">Unlock the full board</p>
                        <p className="text-xs text-gray-400">{lockedPlayers.length} more players ranked below your free preview</p>
                        <div className="flex gap-3">
                          <Link href="/signup?plan=monthly" className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5">
                            Upgrade — $18.99/mo
                          </Link>
                          <Link href="/signup?plan=yearly" className="rounded-xl border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 px-5 py-2.5 text-sm font-bold text-blue-300 transition-all hover:-translate-y-0.5">
                            $189.99/yr · Best Value
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                  {isPro && <div className="mb-10"/>}
                </>
              );
            })()}
          </>
        )}

        {/* ── Pinned Players ──────────────────────────────────────────────── */}
        {researchList.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-black text-white">Pinned Players</h2>
              <span className="text-xs text-gray-600">{researchList.length} pinned</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {researchList.map(player => (
                <ManualPlayerCard key={player.playerId} player={player} category={category} win="10" todayGames={todayGames} onRemove={removePlayer}/>
              ))}
            </div>
          </div>
        )}


      </main>
    </div>
  );
}
