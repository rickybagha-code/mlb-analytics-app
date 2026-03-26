'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MLB_API  = 'https://statsapi.mlb.com/api/v1';

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

  // Sample confidence: 0.5 at 150 AB → 1.0 at 450+ AB
  const confidence = Math.min(1.0, Math.max(0.5, (ab - 150) / 300 + 0.5));

  // Pitcher difficulty — positive = batter-friendly (high ERA), negative = tough ace
  const era = player.matchup?.pitcher?.era;
  const pitcherMod = era != null ? Math.max(-10, Math.min(10, (era - 4.50) * 2.5)) : 0;

  // Recency boost — applied when game log loads (defaults 0 until then)
  let recencyBoost = 0;
  const { streak, l10Avg } = player;
  if (streak != null) {
    if      (streak >= 8) recencyBoost += 12;
    else if (streak >= 5) recencyBoost += 8;
    else if (streak >= 3) recencyBoost += 4;
    else if (streak === 0) recencyBoost -= 5;
  }
  if (l10Avg != null && avg > 0) {
    recencyBoost += Math.max(-8, Math.min(8, ((l10Avg - avg) / avg) * 25));
  }

  let base = 50;

  if (category === 'hitting') {
    // effectiveWOBA (blended with xwOBA) centred at league avg ~0.315
    const wComp     = (effectiveWOBA - 0.315) * 250;
    const kPenalty  = Math.max(0, (kPct - 0.20) * 50);
    const bbBonus   = Math.max(0, (bbPct - 0.08) * 25);
    // Hard hit bonus: league median ~40%, elite ~58%+ (ev95percent from Baseball Savant)
    const hardBonus = hardHitPct != null ? Math.max(0, Math.min(8, (hardHitPct - 40) / 18 * 8)) : 0;
    base = 53 + wComp - kPenalty + bbBonus + hardBonus + pitcherMod;

  } else if (category === 'hr') {
    // Poisson-based P(HR ≥ 1 today) — prevents 99-inflation seen with additive cap formula.
    // lambda = seasonal HR/AB rate × avg ABs per game
    const avgABs    = Math.max(3.0, Math.min(4.5, gp > 0 ? ab / gp : 3.8));
    const lambda    = Math.max(0, hrRate * avgABs);
    const pHR       = 1 - Math.exp(-lambda); // P(HR ≥ 1) = 1 − Poisson(0, λ)
    // ISO and barrel % as quality-of-contact modifiers (small adjustments, not dominant)
    const isoMod    = Math.max(-0.03, Math.min(0.03, (iso - 0.150) * 0.15));
    const barrelMod = barrelPct != null ? Math.max(0, Math.min(0.025, (barrelPct - 8) / 48)) : 0;
    const adjustedP = Math.min(0.40, Math.max(0.005, pHR + isoMod + barrelMod));
    // Scale: 0.40 (elite max) → base≈90, 0.20 → base≈49, 0.10 → base≈27
    base = Math.round(adjustedP * 212 + 6) + pitcherMod * 0.5;

  } else if (category === 'runs') {
    const rComp   = Math.max(-15, Math.min(30, (r   / gp - 0.45) * 65));
    const obpComp = Math.max(0,   Math.min(15, (obp - 0.300) / 0.120 * 15));
    const hardBonus = hardHitPct != null ? Math.max(0, Math.min(5, (hardHitPct - 40) / 18 * 5)) : 0;
    base = 40 + rComp + obpComp + hardBonus + pitcherMod;

  } else if (category === 'rbi') {
    const rbiComp = Math.max(-15, Math.min(35, (rbi / gp - 0.45) * 70));
    const slgComp = Math.max(0,   Math.min(15, (slg - 0.400) / 0.200 * 15));
    const hrComp  = Math.max(0,   Math.min(10, (hrRate / 0.06) * 10));
    base = 38 + rbiComp + slgComp + hrComp + pitcherMod;

  } else if (category === 'sb') {
    const sbRate  = player.stolenBases != null && gp > 0 ? player.stolenBases / gp : 0;
    const sbComp  = Math.min(55, sbRate * 220);
    base = 15 + sbComp + pitcherMod * 0.3;
  }

  // Shrink score toward 50 for thin sample sizes
  const adjusted = 50 + (base - 50) * confidence;
  return Math.round(Math.max(5, Math.min(99, adjusted + recencyBoost)));
}

// ─── Poisson CDF ─────────────────────────────────────────────────────────────
function poissonCDF(k, lambda) {
  if (lambda <= 0) return 1;
  let sum = 0, term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) { sum += term; term *= lambda / (i + 1); }
  return Math.min(1, sum);
}

// ─── K Projection (pure fn mirroring player-page useKProjection hook) ────────
// starts: [{strikeOuts, inningsPitched, date}, ...] — last N regular starts
function computeKProjection(starts, k9, oppTeamAbbrev) {
  if (!starts?.length) return null;
  const last5  = starts.slice(-5);
  const last10 = starts.slice(-10);
  const l5Ks   = last5.map(s => s.strikeOuts);
  const l5K    = l5Ks.reduce((a, b) => a + b, 0) / l5Ks.length;
  const l5IP   = last5.map(s => parseFloat(s.inningsPitched) || 0);
  const avgL5IP = Math.max(1, l5IP.reduce((a, b) => a + b, 0) / l5IP.length);
  const seasonK = k9 != null ? k9 / 9 * avgL5IP : null;
  const leagueK = 5.5;
  const raw = l5K * 0.60 + (seasonK ?? leagueK) * 0.30 + leagueK * 0.10;
  const oppKRate   = TEAM_K_RATES[oppTeamAbbrev] || LG_K_RATE;
  const oppKFactor = oppKRate / LG_K_RATE;
  const last = starts[starts.length - 1];
  const daysRest = last?.date
    ? Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000)
    : null;
  const restFactor = daysRest != null ? (daysRest < 4 ? 0.95 : daysRest >= 6 ? 1.02 : 1.0) : 1.0;
  return Math.round(raw * restFactor * oppKFactor * 10) / 10;
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
  hitting:  'ProprStats Model Score — likelihood of recording a hit today',
  hr:       'ProprStats HR Score — likelihood of hitting a home run today',
  runs:     'ProprStats Model Score — likelihood of scoring a run today',
  rbi:      'ProprStats Model Score — likelihood of driving in a run today',
  sb:       'ProprStats Model Score — likelihood of stealing a base today',
  pitching: 'ProprStats K Score — likelihood of exceeding the strikeout line today',
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

      <div className="flex items-center gap-3 mb-3 pt-4">
        {player.loading
          ? <div className="rounded-full bg-gray-800 animate-pulse flex-shrink-0" style={{width:56,height:56}}/>
          : <PlayerHeadshot playerId={player.playerId} name={player.fullName} size={56}/>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{player.fullName}</p>
          <p className="text-xs text-gray-500">{player.primaryPosition} · {player.teamName}</p>
          {matchupTxt
            ? <p className="text-xs text-blue-400 mt-0.5 truncate">{matchupTxt}</p>
            : <p className="text-xs text-gray-700 mt-0.5">No game today</p>
          }
        </div>
        <ScoreRing score={projection} size={48} />
      </div>

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
  { id:'hitting',  label:'Hits'          },
  { id:'runs',     label:'Runs'          },
  { id:'rbi',      label:'RBI'           },
  { id:'hr',       label:'Home Runs'     },
  { id:'sb',       label:'Stolen Bases'  },
  { id:'pitching', label:'Pitching'      },
];

// Maps dashboard category → player page cat param
const CAT_TO_PLAYER_TAB = { hitting:'hits', hr:'hr', runs:'runs', rbi:'rbi', sb:'sb', pitching:null };

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  // ── Free tier plan check ──────────────────────────────────────────────────
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    const plan = localStorage.getItem('proprstats_plan');
    setIsPro(plan === 'pro' || plan === 'yearly');
  }, []);

  // ── Category ──────────────────────────────────────────────────────────────
  const [category, setCategory] = useState('hitting');

  // ── Auto board ────────────────────────────────────────────────────────────
  const [boardPlayers,  setBoardPlayers]  = useState([]);
  const [boardLoading,  setBoardLoading]  = useState(true);
  const [boardError,    setBoardError]    = useState(null);
  const [todayGames,    setTodayGames]    = useState([]);

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
      .slice(0, 20);
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
        const res = await fetch(`/pp-lines.json`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data = await res.json();
        if (data.lines) setPpLinesByName(data.lines);
      } catch {}
    }
    fetchPP();
  }, []);

  // Re-score pitchers once PP lines arrive — OR once the board loads (whichever is later).
  // /pp-lines.json is a static file (~100ms) but the board takes 5-10s to build,
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
      const today = new Date().toISOString().split('T')[0];

      // 1. Today's games
      const gRes  = await fetch(`${API_URL}/games/probables?date=${today}`);
      if (!gRes.ok) throw new Error('Could not fetch today\'s games');
      const gData = await gRes.json();
      const games = gData.games || [];
      setTodayGames(games);

      if (!games.length) { setBoardLoading(false); return; }

      // 2. Build team map from teams API (cached)
      let teamList = getCached('mlb_teams_2026', 24*60*60*1000);
      if (!teamList) {
        const tr   = await fetch(`${MLB_API}/teams?sportId=1&season=2026`);
        const td   = await tr.json();
        teamList   = (td.teams||[]).filter(t=>t.sport?.id===1&&t.active)
          .map(t=>({ id:t.id, name:t.name, abbreviation:t.abbreviation }));
        setCached('mlb_teams_2026', teamList);
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
        // 2026 primary
        try {
          const pr = await fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=pitching,type=season,season=2026)`);
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
          const cKey = `mlb_pitcher_starts_${pid}_2026`;
          const cached = getCached(cKey, 2 * 60 * 60 * 1000);
          if (cached) { pitcherMap[pid].starts = cached; return; }
          try {
            const gr26 = await fetch(`${MLB_API}/people/${pid}/stats?stats=gameLog&group=pitching&season=2026&gameType=R`);
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
        const rKey   = `mlb_roster_${teamId}_2026`;
        let roster   = getCached(rKey, 6*60*60*1000);
        if (!roster) {
          try {
            const rr = await fetch(`${MLB_API}/teams/${teamId}/roster?rosterType=active&season=2026`);
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

        // Batch season batting stats — 2026 primary, 2025 fallback for thin samples
        const ids = roster.map(p=>p.id).join(',');
        const statsMap = {};
        const extractBatter = st => ({
          avg:              parseFloat(st.avg)             || 0,
          slg:              parseFloat(st.slg)             || 0,
          obp:              parseFloat(st.obp)             || 0,
          homeRuns:         parseInt(st.homeRuns)           || 0,
          atBats:           parseInt(st.atBats)             || 0,
          gamesPlayed:      parseInt(st.gamesPlayed)        || 1,
          runs:             parseInt(st.runs)               || 0,
          rbi:              parseInt(st.rbi)                || 0,
          hits:             parseInt(st.hits)               || 0,
          doubles:          parseInt(st.doubles)            || 0,
          triples:          parseInt(st.triples)            || 0,
          baseOnBalls:      parseInt(st.baseOnBalls)        || 0,
          strikeOuts:       parseInt(st.strikeOuts)         || 0,
          plateAppearances: parseInt(st.plateAppearances)   || 0,
          babip:            parseFloat(st.babip)            || 0,
          stolenBases:      parseInt(st.stolenBases)        || 0,
        });
        const thin26 = []; // player IDs with < 50 AB in 2026
        try {
          const sr = await fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=hitting,type=season,season=2026)`);
          const sd = await sr.json();
          for (const p of (sd.people||[])) {
            const st = p.stats?.find(s=>s.group?.displayName==='hitting')?.splits?.[0]?.stat;
            const ab = parseInt(st?.atBats) || 0;
            if (st && ab >= 50) {
              statsMap[p.id] = extractBatter(st);
            } else {
              thin26.push(p.id); // needs 2025 fallback
            }
          }
        } catch { return; }
        // 2025 fallback for players not yet reaching 50 AB in 2026
        if (thin26.length > 0) {
          try {
            const sr25 = await fetch(`${MLB_API}/people?personIds=${thin26.join(',')}&hydrate=stats(group=hitting,type=season,season=2025)`);
            const sd25 = await sr25.json();
            for (const p of (sd25.people||[])) {
              const st = p.stats?.find(s=>s.group?.displayName==='hitting')?.splits?.[0]?.stat;
              if (st && (parseInt(st.atBats)||0) >= 150) {
                statsMap[p.id] = extractBatter(st);
              }
            }
          } catch {}
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
          allPlayers.push({
            playerId:    rp.id,
            fullName:    rp.fullName,
            position:    rp.position,
            teamId,
            teamName:    team.name,
            teamAbbrev:  team.abbreviation,
            ...stats,
            matchup:     { isHome, oppAbbrev, pitcher },
            scores: {
              hitting:  computeProjectionScore({ ...stats, matchup:{ isHome, oppAbbrev, pitcher } }, 'hitting'),
              hr:       computeProjectionScore({ ...stats, matchup:{ isHome, oppAbbrev, pitcher } }, 'hr'),
              runs:     computeProjectionScore({ ...stats, matchup:{ isHome, oppAbbrev, pitcher } }, 'runs'),
              rbi:      computeProjectionScore({ ...stats, matchup:{ isHome, oppAbbrev, pitcher } }, 'rbi'),
              sb:       computeProjectionScore({ ...stats, matchup:{ isHome, oppAbbrev, pitcher } }, 'sb'),
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
          const oppAbbrevP = teamMap[oppId]?.abbreviation ?? '';
          const kProj = computeKProjection(myPitcher.starts, myPitcher.k9, oppAbbrevP);
          const pitchingScore = pitcherKScore(kProj) ?? scorePitcher(myPitcher);
          allPlayers.push({
            playerId:      myPitcherId,
            fullName:      myPitcher.name,
            position:      'SP',
            teamId,
            teamName:      team.name,
            teamAbbrev:    team.abbreviation,
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
      const topIds = new Set();
      for (const cat of ['hitting','hr','runs','rbi','sb']) {
        [...dedupedPlayers]
          .filter(p=>p.scores[cat]>0)
          .sort((a,b)=>b.scores[cat]-a.scores[cat])
          .slice(0,20)
          .forEach(p=>topIds.add(p.playerId));
      }
      // Statcast loads fast (1 request), streaks load progressively (batched)
      fetchStatcastData();
      fetchStreaks([...topIds]);

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
          const r = await fetch(`${API_URL}/player/${pid}/gamelog?season=2026`);
          if (!r.ok) throw new Error();
          const d    = await r.json();
          const games = d.games || [];
          const streak = computeStreak(games);

          // L10 batting average from last 10 games
          const last10 = games.slice(-10);
          const l10H  = last10.reduce((a, g) => a + (Number(g.hits)   || 0), 0);
          const l10AB = last10.reduce((a, g) => a + (Number(g.atBats) || 0), 0);
          const l10Avg = l10AB >= 15 ? l10H / l10AB : null;

          setBoardPlayers(prev => prev.map(p => {
            if (p.playerId !== pid) return p;
            const updated = { ...p, streak, l10Avg, streakLoading: false };
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

  async function fetchStatcastData() {
    try {
      const r = await fetch(`${API_URL}/statcast/batters?season=2026`);
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

  // ── Load teams for manual dropdown ────────────────────────────────────────
  useEffect(() => {
    if (teams.length) return; // already loaded by loadDailyBoard
    async function fetchTeams() {
      const cached = getCached('mlb_teams_2026', 24*60*60*1000);
      if (cached) { setTeams(cached); return; }
      setTeamsLoading(true);
      try {
        const r = await fetch(`${MLB_API}/teams?sportId=1&season=2026`);
        const d = await r.json();
        const list = (d.teams||[]).filter(t=>t.sport?.id===1&&t.active)
          .map(t=>({id:t.id,name:t.name,abbreviation:t.abbreviation}))
          .sort((a,b)=>a.name.localeCompare(b.name));
        setCached('mlb_teams_2026', list);
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
      const key    = `mlb_roster_${selectedTeamId}_2026`;
      const cached = getCached(key, 6*60*60*1000);
      if (cached) { setRoster(cached); setSelectedPlayerId(''); return; }
      setRosterLoading(true);
      try {
        const r = await fetch(`${MLB_API}/teams/${selectedTeamId}/roster?rosterType=active&season=2026`);
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

  // ── Add / remove manual player ────────────────────────────────────────────
  async function addPlayer() {
    if (!selectedPlayerId) return;
    const player = roster.find(p => p.id === Number(selectedPlayerId));
    if (!player || researchList.some(r => r.playerId === player.id)) return;
    const team  = teams.find(t => t.id === Number(selectedTeamId));
    const entry = { playerId:player.id, fullName:player.fullName, primaryPosition:player.position, teamId:Number(selectedTeamId), teamName:team?.name??'', gamelog:[], loading:true, error:null };
    setResearchList(prev => [entry, ...prev]);
    try {
      const r = await fetch(`${API_URL}/player/${player.id}/gamelog?season=2026`);
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

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-white">Today&apos;s Top Props</h1>
            <p className="mt-1 text-gray-400 text-sm">
              {boardLoading
                ? 'Loading today\'s slate…'
                : boardError
                  ? boardError
                  : `${currentBoard.length} plays ranked by ProprStats model · ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}`
              }
            </p>
          </div>
          {!boardLoading && !boardError && boardPlayers.length > 0 && (
            <button onClick={loadDailyBoard} className="text-xs text-gray-500 hover:text-blue-400 transition-colors border border-gray-800 hover:border-blue-500/30 rounded-lg px-3 py-1.5 flex-shrink-0">
              ↻ Refresh
            </button>
          )}
        </div>

        {/* ── Category + Filter Controls ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                category === cat.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
              }`}>
              {cat.label}
            </button>
          ))}
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
              const FREE_LIMIT = 4;
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
