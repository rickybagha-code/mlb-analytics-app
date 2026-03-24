'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MLB_API  = 'https://statsapi.mlb.com/api/v1';

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
    const hrComp  = Math.min(55, (hrRate / 0.08) * 55);
    const isoComp = Math.max(0, Math.min(15, (iso - 0.100) / 0.200 * 15));
    const kHit    = Math.max(0, (kPct - 0.25) * 25);
    // Barrel bonus: league avg ~7%, elite ~20%+ (brl_percent from Baseball Savant)
    const barrelBonus = barrelPct != null ? Math.max(0, Math.min(15, (barrelPct - 5) / 15 * 15)) : 0;
    base = 18 + hrComp + isoComp - kHit + barrelBonus + pitcherMod * 0.7;

  } else if (category === 'runs') {
    const rComp   = Math.max(-15, Math.min(25, (r   / gp - 0.45) * 55));
    const rbiComp = Math.max(-15, Math.min(25, (rbi / gp - 0.45) * 55));
    const obpComp = Math.max(0,   Math.min(15, (obp - 0.300) / 0.120 * 15));
    const hardBonus = hardHitPct != null ? Math.max(0, Math.min(5, (hardHitPct - 40) / 18 * 5)) : 0;
    base = 40 + rComp + rbiComp + obpComp + hardBonus + pitcherMod;
  }

  // Shrink score toward 50 for thin sample sizes
  const adjusted = 50 + (base - 50) * confidence;
  return Math.round(Math.max(5, Math.min(99, adjusted + recencyBoost)));
}

function scorePitcher(stats) {
  const era  = stats.era  ?? 4.50;
  const whip = stats.whip ?? 1.30;
  const k9   = stats.k9   ?? 8.0;
  // Centred at league avg: ERA 4.50, WHIP 1.30, K/9 8.5
  const eraScore  = Math.max(-20, Math.min(30, (4.50 - era)  * 12));
  const k9Score   = Math.max(-10, Math.min(20, (k9   - 7.50) * 5));
  const whipScore = Math.max(-10, Math.min(15, (1.30 - whip) * 25));
  return Math.round(Math.max(5, Math.min(99, 50 + eraScore + k9Score + whipScore)));
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
  if (category === 'runs') {
    const c = stats.rPerGame + stats.rbiPerGame;
    return Math.round(Math.max(10, Math.min(99, Math.min(60, c * 35) + Math.min(30, stats.obpProxy * 55))));
  }
  return 50;
}

function getPropLabel(stats, category) {
  if (!stats) return null;
  if (category === 'hitting') { if (stats.hPerGame >= 1.2) return 'Over 1.5 H'; if (stats.hPerGame >= 0.65) return 'Over 0.5 H'; }
  if (category === 'hr'     &&  stats.hrPerGame >= 0.25)   return 'Over 0.5 HR';
  if (category === 'runs')   { const c = stats.rPerGame + stats.rbiPerGame; if (c >= 1.5) return 'Over 1.5 R+RBI'; if (c >= 0.7) return 'Over 0.5 R+RBI'; }
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

// ─── Logo Mark ────────────────────────────────────────────────────────────────
function LogoMark({ size=30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <path d="M17 2L32 17L17 32L2 17Z" fill="#0f1e3a" stroke="#3b82f6" strokeWidth="1.5"/>
      <path d="M17 6L28 17L17 28L6 17Z" fill="#1e3a5f" opacity="0.5"/>
      <path d="M10 21L13.5 15.5L16.5 18L23 11" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="23" cy="11" r="2.2" fill="#3b82f6"/>
      <circle cx="23" cy="11" r="1" fill="#93c5fd"/>
    </svg>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark />
            <span className="text-base font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">Cook The Books</span>
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-blue-400 border-b-2 border-blue-500 pb-0.5">Dashboard</span>
            <Link href="/probables" className="text-sm text-gray-400 hover:text-white transition-colors">Probable Pitchers</Link>
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
        <ScoreRing score={score} size={44} />
      </div>

      {isPitcher ? (
        <div className="grid grid-cols-3 gap-1">
          <StatBadge label="ERA"  value={fmt(player.era,  2)} cls={eraCls(player.era)}  />
          <StatBadge label="WHIP" value={fmt(player.whip, 2)} cls={whipCls(player.whip)} />
          <StatBadge label="K/9"  value={fmt(player.k9,   1)} cls={k9C}                  />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1">
          <StatBadge label="AVG" value={fmt(player.avg, 3)} cls={avgC} />
          <StatBadge label="SLG" value={fmt(player.slg, 3)} cls={slgC} />
          {category === 'hr'
            ? <StatBadge label="HR"  value={player.homeRuns ?? '—'} cls={hrNumC} />
            : <StatBadge label="OBP" value={fmt(player.obp, 3)}     cls={obpC}   />
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
          <StatBadge label="R/G"   value={fmt(stats.rPerGame,2)}   cls={statCls(stats.rPerGame,  0.7,0.4)} />
          <StatBadge label="RBI/G" value={fmt(stats.rbiPerGame,2)} cls={statCls(stats.rbiPerGame,0.7,0.4)} />
          <StatBadge label="R"     value={stats.totalR}   cls={statCls(stats.totalR,  win==='5'?3:5, win==='5'?1:3)} />
          <StatBadge label="RBI"   value={stats.totalRBI} cls={statCls(stats.totalRBI,win==='5'?3:5, win==='5'?1:3)} />
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">Use Matchup Analysis below for pitching metrics.</p>
      )}
    </div>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function InputField({ label, id, value, onChange, placeholder, required=false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}{required && <span className="ml-1 text-blue-400">*</span>}
      </label>
      <input id={id} type="text" value={value} onChange={onChange} placeholder={placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"/>
    </div>
  );
}

// ─── Matchup Result Cards (unchanged) ────────────────────────────────────────
function ScoreCard({ score }) {
  const rec = getRecIcon(score);
  return (
    <div className={`col-span-full rounded-xl border p-8 text-center ${getScoreBg(score)}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Matchup Score</div>
      <div className={`text-7xl font-black tabular-nums ${getScoreColor(score)}`}>{score}</div>
      <div className="mt-3 flex items-center justify-center gap-2"><span className="text-lg">{rec.icon}</span><span className={`text-base font-bold ${rec.color}`}>{rec.label}</span></div>
      <div className="mt-2 text-sm text-gray-500">out of 100</div>
    </div>
  );
}

function RecencyCard({ recency }) {
  if (!recency) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span>📊</span><h3 className="text-sm font-bold text-white">Recency Trends</h3></div>
      <p className="text-sm text-gray-500">No recency data available.</p>
    </div>
  );
  const rows = [
    { label:'Last 10 — Avg Hits/Game', value: recency.last10AvgHitsPerGame != null ? fmt(recency.last10AvgHitsPerGame,2) : '—' },
    { label:'Last 5 — Avg Hits/Game',  value: recency.last5AvgHitsPerGame  != null ? fmt(recency.last5AvgHitsPerGame, 2) : '—' },
    { label:'HR (Last 10)',            value: recency.last10HR ?? '—' },
    { label:'HR (Last 5)',             value: recency.last5HR  ?? '—' },
    { label:'Recency Adjustment',      value: recency.recencyAdjustment != null ? `${recency.recencyAdjustment>0?'+':''}${fmt(recency.recencyAdjustment,2)}` : '—', hi:true },
  ];
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span>📊</span><h3 className="text-sm font-bold text-white">Recency Trends</h3></div>
      <div className="space-y-2.5">{rows.map(r=>(
        <div key={r.label} className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{r.label}</span>
          <span className={`text-xs font-bold tabular-nums ${r.hi?'text-blue-400':'text-white'}`}>{r.value}</span>
        </div>
      ))}</div>
    </div>
  );
}

function ParkFactorsCard({ parkFactors }) {
  if (!parkFactors) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span>🏟️</span><h3 className="text-sm font-bold text-white">Park Factors</h3></div>
      <p className="text-sm text-gray-500">No park factor data available.</p>
    </div>
  );
  const rows = [
    { label:'Run Factor', value: fmt(parkFactors.runFactor, 3) },
    { label:'HR Factor',  value: fmt(parkFactors.hrFactor,  3) },
    { label:'Park Adjustment', value: parkFactors.parkAdjustment != null ? `${parkFactors.parkAdjustment>0?'+':''}${fmt(parkFactors.parkAdjustment,2)}` : '—', hi:true },
  ];
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-1"><span>🏟️</span><h3 className="text-sm font-bold text-white">Park Factors</h3></div>
      {parkFactors.stadium && <p className="text-xs text-gray-500 mb-4">{parkFactors.stadium}</p>}
      <div className="space-y-2.5">{rows.map(r=>(
        <div key={r.label} className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">{r.label}</span>
          <span className={`text-xs font-bold tabular-nums ${r.hi?'text-blue-400':'text-white'}`}>{r.value}</span>
        </div>
      ))}</div>
    </div>
  );
}

function WeatherCard({ weather }) {
  if (!weather || (!weather.temperature && !weather.windSpeed && !weather.weatherImpact)) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span>🌤️</span><h3 className="text-sm font-bold text-white">Weather</h3></div>
      <p className="text-sm text-gray-500">No weather data provided.</p>
      <p className="text-xs text-gray-600 mt-1">Add lat &amp; lon for weather analysis.</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span>🌤️</span><h3 className="text-sm font-bold text-white">Weather</h3></div>
      <div className="space-y-2.5">
        {weather.temperature != null && <div className="flex justify-between"><span className="text-xs text-gray-500">Temperature</span><span className="text-xs font-bold text-white">{weather.temperature}°C</span></div>}
        {weather.windSpeed    != null && <div className="flex justify-between"><span className="text-xs text-gray-500">Wind Speed</span><span className="text-xs font-bold text-white">{weather.windSpeed} km/h</span></div>}
        {weather.weatherImpact != null && <div className="mt-1 pt-2 border-t border-gray-800 flex justify-between"><span className="text-xs text-gray-500">Impact</span><span className={`text-xs font-bold tabular-nums ${weather.weatherImpact>0?'text-blue-400':weather.weatherImpact<0?'text-red-400':'text-gray-400'}`}>{weather.weatherImpact>0?'+':''}{fmt(weather.weatherImpact,2)}</span></div>}
        {weather.notes && <p className="text-xs text-gray-500 italic mt-2">{weather.notes}</p>}
      </div>
    </div>
  );
}

function SplitStatsCard({ data }) {
  const split = data.splitUsed || data.split || null;
  const m     = data.matchupStats || data.stats || null;
  const batterRows  = [
    { label:'Batting AVG', value: m?.avg      != null ? fmt(m.avg,3)    : '—' },
    { label:'OPS',         value: m?.ops      != null ? fmt(m.ops,3)    : '—' },
    { label:'SLG',         value: m?.slg      != null ? fmt(m.slg,3)    : '—' },
    { label:'OBP',         value: m?.obp      != null ? fmt(m.obp,3)    : '—' },
    { label:'HR Rate',     value: m?.hrRate   != null ? `${fmt(m.hrRate*100,1)}%` : '—' },
    { label:'At Bats',     value: m?.atBats   ?? '—' },
    { label:'Home Runs',   value: m?.homeRuns ?? '—' },
  ];
  const pitcherRows = [
    { label:'ERA',  value: m?.era  != null ? fmt(m.era, 2)  : '—' },
    { label:'WHIP', value: m?.whip != null ? fmt(m.whip,3)  : '—' },
    { label:'K/9',  value: m?.k9   != null ? fmt(m.k9,  2)  : '—' },
    { label:'BB/9', value: m?.bb9  != null ? fmt(m.bb9, 2)  : '—' },
    { label:'FIP',  value: m?.fip  != null ? fmt(m.fip, 2)  : '—' },
  ];
  const hb = batterRows.some(r=>r.value!=='—'), hp = pitcherRows.some(r=>r.value!=='—');
  return (
    <div className="col-span-full rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div className="flex items-center gap-2"><span>✂️</span><h3 className="text-sm font-bold text-white">Split Stats</h3></div>
        {split && <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">{split}</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {hb && <div><div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Batter Stats</div><div className="space-y-2">{batterRows.filter(r=>r.value!=='—').map(r=><div key={r.label} className="flex justify-between"><span className="text-xs text-gray-500">{r.label}</span><span className="text-xs font-bold text-white tabular-nums">{r.value}</span></div>)}</div></div>}
        {hp && <div><div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Pitcher Stats</div><div className="space-y-2">{pitcherRows.filter(r=>r.value!=='—').map(r=><div key={r.label} className="flex justify-between"><span className="text-xs text-gray-500">{r.label}</span><span className="text-xs font-bold text-white tabular-nums">{r.value}</span></div>)}</div></div>}
        {!hb && !hp && <div className="col-span-2"><p className="text-sm text-gray-500">No split stats available.</p></div>}
      </div>
    </div>
  );
}

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:'hitting',  label:'Hitting'    },
  { id:'hr',       label:'Home Runs'  },
  { id:'runs',     label:'Runs / RBI' },
  { id:'pitching', label:'Pitching'   },
];

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  // ── Category / window ─────────────────────────────────────────────────────
  const [category, setCategory] = useState('hitting');
  const [win,      setWin]      = useState('10');

  // ── Auto board ────────────────────────────────────────────────────────────
  const [boardPlayers,  setBoardPlayers]  = useState([]);
  const [boardLoading,  setBoardLoading]  = useState(true);
  const [boardError,    setBoardError]    = useState(null);
  const [todayGames,    setTodayGames]    = useState([]);

  // ── Manual research ───────────────────────────────────────────────────────
  const [teams,            setTeams]           = useState([]);
  const [selectedTeamId,   setSelectedTeamId]  = useState('');
  const [roster,           setRoster]          = useState([]);
  const [selectedPlayerId, setSelectedPlayerId]= useState('');
  const [researchList,     setResearchList]    = useState([]);
  const [teamsLoading,     setTeamsLoading]    = useState(false);
  const [rosterLoading,    setRosterLoading]   = useState(false);

  // ── Matchup analysis ──────────────────────────────────────────────────────
  const [batterId,  setBatterId]  = useState('');
  const [pitcherId, setPitcherId] = useState('');
  const [season,    setSeason]    = useState('2025');
  const [stadium,   setStadium]   = useState('');
  const [lat,       setLat]       = useState('');
  const [lon,       setLon]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);

  // ── Derived top-20 for active category ────────────────────────────────────
  const currentBoard = useMemo(() => {
    return [...boardPlayers]
      .filter(p => (p.scores?.[category] ?? 0) > 0)
      .sort((a, b) => (b.scores?.[category] ?? 0) - (a.scores?.[category] ?? 0))
      .slice(0, 20);
  }, [boardPlayers, category]);

  // ── Load daily board ──────────────────────────────────────────────────────
  useEffect(() => {
    loadDailyBoard();
  }, []);

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
      let teamList = getCached('mlb_teams_2025', 24*60*60*1000);
      if (!teamList) {
        const tr   = await fetch(`${MLB_API}/teams?sportId=1&season=2025`);
        const td   = await tr.json();
        teamList   = (td.teams||[]).filter(t=>t.sport?.id===1&&t.active)
          .map(t=>({ id:t.id, name:t.name, abbreviation:t.abbreviation }));
        setCached('mlb_teams_2025', teamList);
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

      // 4. Fetch pitcher season stats (one batch call)
      const pitcherMap = {};
      if (pitcherIds.size > 0) {
        try {
          const ids  = [...pitcherIds].join(',');
          const pr   = await fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=pitching,type=season,season=2025)`);
          const pd   = await pr.json();
          for (const p of (pd.people||[])) {
            const st = p.stats?.find(s=>s.group?.displayName==='pitching')?.splits?.[0]?.stat;
            if (st) {
              pitcherMap[p.id] = {
                id:   p.id,
                name: p.fullName,
                era:  parseFloat(st.era)  || 4.50,
                whip: parseFloat(st.whip) || 1.30,
                k9:   parseFloat(st.strikeoutsPer9Inn) || parseFloat(st.k9) || 8.0,
                hand: p.pitchHand?.code || null,
              };
            }
          }
        } catch {}
      }

      // 5. For each team playing: get roster + batch batter season stats
      const allPlayers = [];
      await Promise.all([...teamIds].map(async (teamId) => {
        // Roster (cached 6h)
        const rKey   = `mlb_roster_${teamId}_2025`;
        let roster   = getCached(rKey, 6*60*60*1000);
        if (!roster) {
          try {
            const rr = await fetch(`${MLB_API}/teams/${teamId}/roster?rosterType=active&season=2025`);
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

        // Batch season batting stats
        const ids    = roster.map(p=>p.id).join(',');
        const statsMap = {};
        try {
          const sr = await fetch(`${MLB_API}/people?personIds=${ids}&hydrate=stats(group=hitting,type=season,season=2025)`);
          const sd = await sr.json();
          for (const p of (sd.people||[])) {
            const st = p.stats?.find(s=>s.group?.displayName==='hitting')?.splits?.[0]?.stat;
            if (st && (parseInt(st.atBats)||0) >= 150) {
              statsMap[p.id] = {
                avg:               parseFloat(st.avg)              || 0,
                slg:               parseFloat(st.slg)              || 0,
                obp:               parseFloat(st.obp)              || 0,
                homeRuns:          parseInt(st.homeRuns)            || 0,
                atBats:            parseInt(st.atBats)              || 0,
                gamesPlayed:       parseInt(st.gamesPlayed)         || 1,
                runs:              parseInt(st.runs)                || 0,
                rbi:               parseInt(st.rbi)                 || 0,
                // Extra fields for wOBA proxy + K%/BB% model
                hits:              parseInt(st.hits)                || 0,
                doubles:           parseInt(st.doubles)             || 0,
                triples:           parseInt(st.triples)             || 0,
                baseOnBalls:       parseInt(st.baseOnBalls)         || 0,
                strikeOuts:        parseInt(st.strikeOuts)          || 0,
                plateAppearances:  parseInt(st.plateAppearances)    || 0,
                babip:             parseFloat(st.babip)             || 0,
              };
            }
          }
        } catch { return; }

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
          allPlayers.push({
            playerId:    myPitcherId,
            fullName:    myPitcher.name,
            position:    'SP',
            teamId,
            teamName:    team.name,
            teamAbbrev:  team.abbreviation,
            era:         myPitcher.era,
            whip:        myPitcher.whip,
            k9:          myPitcher.k9,
            matchup:     { isHome, oppAbbrev: oppAbbrevP, pitcher: null },
            scores:      { hitting:0, hr:0, runs:0, pitching: scorePitcher(myPitcher) },
            streak:      null,
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
      for (const cat of ['hitting','hr','runs']) {
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
    // Fetch 5 at a time to avoid hammering the backend
    for (let i = 0; i < playerIds.length; i += 5) {
      const batch = playerIds.slice(i, i + 5);
      await Promise.all(batch.map(async (pid) => {
        try {
          const r = await fetch(`${API_URL}/player/${pid}/gamelog?season=2025`);
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
            for (const cat of ['hitting', 'hr', 'runs']) {
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

  // ── Load teams for manual dropdown ────────────────────────────────────────
  useEffect(() => {
    if (teams.length) return; // already loaded by loadDailyBoard
    async function fetchTeams() {
      const cached = getCached('mlb_teams_2025', 24*60*60*1000);
      if (cached) { setTeams(cached); return; }
      setTeamsLoading(true);
      try {
        const r = await fetch(`${MLB_API}/teams?sportId=1&season=2025`);
        const d = await r.json();
        const list = (d.teams||[]).filter(t=>t.sport?.id===1&&t.active)
          .map(t=>({id:t.id,name:t.name,abbreviation:t.abbreviation}))
          .sort((a,b)=>a.name.localeCompare(b.name));
        setCached('mlb_teams_2025', list);
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
      const key    = `mlb_roster_${selectedTeamId}_2025`;
      const cached = getCached(key, 6*60*60*1000);
      if (cached) { setRoster(cached); setSelectedPlayerId(''); return; }
      setRosterLoading(true);
      try {
        const r = await fetch(`${MLB_API}/teams/${selectedTeamId}/roster?rosterType=active&season=2025`);
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
      const r = await fetch(`${API_URL}/player/${player.id}/gamelog?season=2025`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setResearchList(prev => prev.map(p => p.playerId===player.id ? {...p, gamelog:d.games??[], loading:false} : p));
    } catch {
      setResearchList(prev => prev.map(p => p.playerId===player.id ? {...p, loading:false, error:'Could not load stats'} : p));
    }
  }

  function removePlayer(pid) { setResearchList(prev => prev.filter(r => r.playerId !== pid)); }

  // ── Matchup analysis ──────────────────────────────────────────────────────
  async function runMatchup() {
    if (!batterId.trim() || !pitcherId.trim()) { setError('Batter ID and Pitcher ID are required.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      let url = `${API_URL}/matchup/batter/${batterId.trim()}/pitcher/${pitcherId.trim()}?season=${season}`;
      if (stadium.trim()) url += `&stadium=${encodeURIComponent(stadium.trim())}`;
      if (lat.trim() && lon.trim()) url += `&lat=${lat.trim()}&lon=${lon.trim()}`;
      const r = await fetch(url);
      if (!r.ok) { const b = await r.json().catch(()=>({})); throw new Error(b?.error||`Server error: ${r.status}`); }
      setResult(await r.json());
    } catch (err) { setError(err.message||'Failed to fetch matchup data.'); }
    finally { setLoading(false); }
  }

  const score = result?.score ?? result?.matchupScore ?? null;

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
                  : `${currentBoard.length} plays ranked by Cook The Books model · ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}`
              }
            </p>
          </div>
          {!boardLoading && !boardError && boardPlayers.length > 0 && (
            <button onClick={loadDailyBoard} className="text-xs text-gray-500 hover:text-blue-400 transition-colors border border-gray-800 hover:border-blue-500/30 rounded-lg px-3 py-1.5 flex-shrink-0">
              ↻ Refresh
            </button>
          )}
        </div>

        {/* ── Category + Window Controls ──────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5 flex-wrap">
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
          </div>
          <select value={win} onChange={e=>setWin(e.target.value)}
            className="ml-auto rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 cursor-pointer">
            <option value="5">Last 5 Games</option>
            <option value="10">Last 10 Games</option>
            <option value="season">Full Season</option>
          </select>
        </div>

        {/* ── Auto Board ──────────────────────────────────────────────────── */}
        {boardLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {Array.from({length:20}).map((_,i) => <SkeletonCard key={i}/>)}
          </div>
        ) : currentBoard.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 py-16 text-center mb-10">
            <div className="mb-3 opacity-30"><LogoMark size={40}/></div>
            {boardPlayers.length === 0 ? (
              <>
                <p className="text-gray-500 font-semibold">No games scheduled today</p>
                <p className="text-sm text-gray-600 mt-1">Come back on a game day for today&apos;s top props.</p>
              </>
            ) : category === 'pitching' ? (
              <>
                <p className="text-gray-500 font-semibold">No probable pitchers posted yet</p>
                <p className="text-sm text-gray-600 mt-1">Pitching tab populates once pitchers are announced, usually by game day morning.</p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-semibold">No qualifying players for this category</p>
                <p className="text-sm text-gray-600 mt-1">Try a different category.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            {currentBoard.map((player, idx) => {
              const pitcher = player.matchup?.pitcher;
              const params = new URLSearchParams({
                teamId:      player.teamId          || '',
                pitcherId:   pitcher?.id            || '',
                pitcherName: pitcher?.name          || '',
                pitcherHand: pitcher?.hand          || '',
                oppAbbrev:   player.matchup?.oppAbbrev || '',
                isHome:      player.matchup?.isHome ? 'true' : 'false',
                teamName:    player.teamName        || '',
                teamAbbrev:  player.teamAbbrev      || '',
              });
              return (
                <Link key={player.playerId} href={`/dashboard/player/${player.playerId}?${params}`} className="block">
                  <AutoPlayerCard player={player} category={category} rank={idx+1}/>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Manual Research ─────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-black text-white">Pin a Player</h2>
            <span className="text-xs text-gray-600">Add to the top of your board for any player</span>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <select value={selectedTeamId} onChange={e=>setSelectedTeamId(e.target.value)} disabled={teamsLoading}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 min-w-[160px] cursor-pointer disabled:opacity-50">
                <option value="">{teamsLoading?'Loading…':'Select Team'}</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {selectedTeamId && (
                <select value={selectedPlayerId} onChange={e=>setSelectedPlayerId(e.target.value)} disabled={rosterLoading}
                  className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 min-w-[190px] cursor-pointer disabled:opacity-50">
                  <option value="">{rosterLoading?'Loading…':'Select Player'}</option>
                  {roster.map(p=><option key={p.id} value={p.id}>{p.fullName} ({p.position})</option>)}
                </select>
              )}
              {selectedPlayerId && (
                <button onClick={addPlayer} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20">
                  + Pin Player
                </button>
              )}
            </div>
          </div>

          {researchList.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {researchList.map(player => (
                <ManualPlayerCard key={player.playerId} player={player} category={category} win={win} todayGames={todayGames} onRemove={removePlayer}/>
              ))}
            </div>
          )}
        </div>

        {/* ── Advanced Matchup Analysis (collapsible) ──────────────────────── */}
        <details className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden group">
          <summary className="cursor-pointer px-6 py-4 flex items-center gap-3 select-none hover:bg-gray-900/80 transition-colors list-none">
            <span>⚡</span>
            <span className="text-sm font-bold text-white">Advanced Matchup Analysis</span>
            <span className="ml-auto text-xs text-gray-600">Deep batter vs pitcher scoring</span>
          </summary>
          <div className="px-6 pb-6 pt-2 border-t border-gray-800">
            <p className="text-sm text-gray-500 mb-5">Full analysis with park factors, weather, and split stats.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <InputField label="Batter ID"  id="batterId"  value={batterId}  onChange={e=>setBatterId(e.target.value)}  placeholder="e.g. 660271"        required/>
              <InputField label="Pitcher ID" id="pitcherId" value={pitcherId} onChange={e=>setPitcherId(e.target.value)} placeholder="e.g. 592789"        required/>
              <InputField label="Season"     id="season"    value={season}    onChange={e=>setSeason(e.target.value)}    placeholder="2025"/>
              <InputField label="Stadium"    id="stadium"   value={stadium}   onChange={e=>setStadium(e.target.value)}   placeholder="e.g. Dodger Stadium"/>
              <InputField label="Latitude"   id="lat"       value={lat}       onChange={e=>setLat(e.target.value)}       placeholder="Optional"/>
              <InputField label="Longitude"  id="lon"       value={lon}       onChange={e=>setLon(e.target.value)}       placeholder="Optional"/>
            </div>
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <span className="text-red-400">⚠️</span>
                <div><p className="text-sm font-semibold text-red-400">Analysis failed</p><p className="text-sm text-red-300/80 mt-0.5">{error}</p></div>
              </div>
            )}
            <button onClick={runMatchup} disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
              {loading
                ? <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/></svg>Analyzing…</>
                : <><span>⚡</span> Run Matchup Analysis</>
              }
            </button>
            {result && score !== null && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-bold text-white">Results</h2>
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">Analysis Complete</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ScoreCard score={score}/>
                  <RecencyCard recency={result.recency??result.recencyData??null}/>
                  <ParkFactorsCard parkFactors={result.parkFactors??result.parkFactor??null}/>
                  <WeatherCard weather={result.weather??result.weatherData??null}/>
                  <SplitStatsCard data={result}/>
                </div>
                <details className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                  <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors select-none list-none">View raw API response</summary>
                  <pre className="overflow-x-auto px-5 pb-5 pt-2 text-xs text-gray-500 leading-relaxed">{JSON.stringify(result,null,2)}</pre>
                </details>
              </div>
            )}
          </div>
        </details>

      </main>
    </div>
  );
}
