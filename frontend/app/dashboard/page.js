'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MLB_API = 'https://statsapi.mlb.com/api/v1';

// ─── LocalStorage Cache Helpers ───────────────────────────────────────────────
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

// ─── Stats Computation ────────────────────────────────────────────────────────
function computeWindowStats(games, win) {
  if (!games || !games.length) return null;
  const slice = win === 'season' ? games : games.slice(-Number(win));
  if (!slice.length) return null;
  const totals = slice.reduce((acc, g) => ({
    h:   acc.h   + (Number(g.hits)         || 0),
    hr:  acc.hr  + (Number(g.homeRuns)     || 0),
    rbi: acc.rbi + (Number(g.rbi)          || 0),
    r:   acc.r   + (Number(g.runs)         || 0),
    ab:  acc.ab  + (Number(g.atBats)       || 0),
    bb:  acc.bb  + (Number(g.baseOnBalls)  || 0),
  }), { h: 0, hr: 0, rbi: 0, r: 0, ab: 0, bb: 0 });
  const g = slice.length;
  return {
    games:      g,
    avg:        totals.ab > 0 ? totals.h / totals.ab : 0,
    hPerGame:   totals.h  / g,
    hrPerGame:  totals.hr / g,
    rbiPerGame: totals.rbi / g,
    rPerGame:   totals.r  / g,
    obpProxy:   (totals.ab + totals.bb) > 0 ? (totals.h + totals.bb) / (totals.ab + totals.bb) : 0,
    totalH:     totals.h,
    totalHR:    totals.hr,
    totalRBI:   totals.rbi,
    totalR:     totals.r,
  };
}

function calcProjectionScore(stats, category) {
  if (!stats || stats.games === 0) return 50;
  if (category === 'hitting') {
    const base = Math.min(55, stats.avg * 190);
    const freq = Math.min(25, stats.hPerGame * 18);
    const obp  = Math.min(15, stats.obpProxy * 30);
    return Math.round(Math.max(10, Math.min(99, base + freq + obp)));
  }
  if (category === 'hr') {
    const rateScore   = Math.min(80, stats.hrPerGame * 420);
    const volumeScore = Math.min(20, stats.totalHR * 3);
    return Math.round(Math.max(5, Math.min(99, rateScore + volumeScore)));
  }
  if (category === 'runs') {
    const combined = (stats.rPerGame + stats.rbiPerGame);
    return Math.round(Math.max(10, Math.min(99, Math.min(60, combined * 35) + Math.min(30, stats.obpProxy * 55))));
  }
  return 50;
}

function getPropLabel(stats, category) {
  if (!stats) return null;
  if (category === 'hitting') {
    if (stats.hPerGame >= 1.2) return 'Over 1.5 H';
    if (stats.hPerGame >= 0.65) return 'Over 0.5 H';
    return null;
  }
  if (category === 'hr') {
    if (stats.hrPerGame >= 0.25) return 'Over 0.5 HR';
    return null;
  }
  if (category === 'runs') {
    const combined = stats.rPerGame + stats.rbiPerGame;
    if (combined >= 1.5) return 'Over 1.5 R+RBI';
    if (combined >= 0.7) return 'Over 0.5 R+RBI';
    return null;
  }
  return null;
}

// ─── Score / Color Helpers ────────────────────────────────────────────────────
function getScoreColor(score) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBg(score) {
  if (score >= 75) return 'border-emerald-500/30 bg-emerald-500/5';
  if (score >= 60) return 'border-yellow-500/30 bg-yellow-500/5';
  if (score >= 45) return 'border-orange-500/30 bg-orange-500/5';
  return 'border-red-500/30 bg-red-500/5';
}

function getScoreRingColor(score) {
  if (score >= 75) return '#34d399';
  if (score >= 60) return '#facc15';
  if (score >= 45) return '#fb923c';
  return '#f87171';
}

function getRecommendationIcon(score) {
  if (score >= 75) return { icon: '✅', label: 'Strong Value', color: 'text-emerald-300' };
  if (score >= 60) return { icon: '👍', label: 'Good Value',   color: 'text-yellow-300' };
  if (score >= 45) return { icon: '⚠️', label: 'Marginal',     color: 'text-orange-300' };
  return { icon: '❌', label: 'Avoid', color: 'text-red-300' };
}

function formatNum(val, decimals = 3) {
  if (val === null || val === undefined) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toFixed(decimals);
}

// ─── Logo Mark ────────────────────────────────────────────────────────────────
function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <span className="text-base font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
              Cook The Books
            </span>
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
function PlayerHeadshot({ playerId, name, size = 56 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';
  const src = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`;

  if (imgFailed) {
    return (
      <div
        style={{ width: size, height: size, minWidth: size }}
        className="rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm"
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size, minWidth: size }}
      className="rounded-full object-cover border border-gray-700 bg-gray-800"
      onError={() => setImgFailed(true)}
    />
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const color = getScoreRingColor(score);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 48, height: 48 }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#1f2937" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className={`absolute text-xs font-black tabular-nums ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ─── Category Stats Display ───────────────────────────────────────────────────
function CategoryStats({ stats, category, win }) {
  if (!stats) return <p className="text-xs text-gray-600 italic">No stats available</p>;
  const label = win === 'season' ? 'Season' : `L${win}`;

  if (category === 'hitting') {
    return (
      <div className="space-y-1.5">
        <StatRow label={`AVG (${label})`} value={formatNum(stats.avg, 3)} />
        <StatRow label="H/Game" value={formatNum(stats.hPerGame, 2)} />
        <StatRow label="OBP (proxy)" value={formatNum(stats.obpProxy, 3)} />
        <StatRow label={`Total H (${label})`} value={stats.totalH} highlight />
      </div>
    );
  }
  if (category === 'hr') {
    return (
      <div className="space-y-1.5">
        <StatRow label={`HR/Game (${label})`} value={formatNum(stats.hrPerGame, 3)} />
        <StatRow label="Total HR" value={stats.totalHR} highlight />
        <StatRow label="AVG" value={formatNum(stats.avg, 3)} />
        <StatRow label="Games" value={stats.games} />
      </div>
    );
  }
  if (category === 'runs') {
    return (
      <div className="space-y-1.5">
        <StatRow label={`R/Game (${label})`} value={formatNum(stats.rPerGame, 2)} />
        <StatRow label="RBI/Game" value={formatNum(stats.rbiPerGame, 2)} />
        <StatRow label="Total R" value={stats.totalR} highlight />
        <StatRow label="Total RBI" value={stats.totalRBI} highlight />
      </div>
    );
  }
  return <p className="text-xs text-gray-500 italic">Use Matchup Analysis below for pitching metrics.</p>;
}

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-bold tabular-nums ${highlight ? 'text-blue-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────
function PlayerCard({ player, category, win, todayGames, onRemove }) {
  const stats      = useMemo(() => computeWindowStats(player.gamelog, win),  [player.gamelog, win]);
  const projection = useMemo(() => calcProjectionScore(stats, category),     [stats, category]);
  const propLabel  = useMemo(() => getPropLabel(stats, category),             [stats, category]);

  const matchup = todayGames?.find(
    g => g.homeTeamId === player.teamId || g.awayTeamId === player.teamId
  );
  let matchupText = null;
  if (matchup) {
    const isHome     = matchup.homeTeamId === player.teamId;
    const oppAbbrev  = isHome ? (matchup.awayTeamAbbrev ?? matchup.awayTeam ?? '') : (matchup.homeTeamAbbrev ?? matchup.homeTeam ?? '');
    const pitcher    = isHome ? matchup.awayProbablePitcher : matchup.homeProbablePitcher;
    const hand       = isHome ? matchup.awayProbablePitcherHand : matchup.homeProbablePitcherHand;
    const handStr    = hand ? `${hand}HP` : '';
    const lastName   = pitcher ? pitcher.split(' ').slice(-1)[0] : 'TBD';
    matchupText = `${isHome ? 'vs' : '@'} ${oppAbbrev} · ${handStr ? handStr + ' ' : ''}${lastName}`;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 relative hover:border-gray-700 transition-colors">
      <button
        onClick={() => onRemove(player.playerId)}
        className="absolute top-3 right-3 text-gray-700 hover:text-red-400 transition-colors text-xs leading-none"
        title="Remove player"
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3 pr-5">
        {player.loading ? (
          <div className="rounded-full bg-gray-800 animate-pulse flex-shrink-0" style={{ width: 56, height: 56 }} />
        ) : (
          <PlayerHeadshot playerId={player.playerId} name={player.fullName} size={56} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{player.fullName}</p>
          <p className="text-xs text-gray-500">{player.primaryPosition} · {player.teamName}</p>
          {matchupText ? (
            <p className="text-xs text-blue-400 mt-0.5 truncate">{matchupText}</p>
          ) : (
            <p className="text-xs text-gray-700 mt-0.5">No game today</p>
          )}
        </div>
        <ScoreRing score={projection} />
      </div>

      {/* Prop badge */}
      {propLabel && (
        <div className="mb-3">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">
            🎯 {propLabel}
          </span>
        </div>
      )}

      {/* Stats */}
      {player.loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-gray-800 rounded w-full" />
          <div className="h-3 bg-gray-800 rounded w-5/6" />
          <div className="h-3 bg-gray-800 rounded w-4/6" />
        </div>
      ) : player.error ? (
        <p className="text-xs text-red-400 italic">{player.error}</p>
      ) : (
        <CategoryStats stats={stats} category={category} win={win} />
      )}
    </div>
  );
}

// ─── Input Field ──────────────────────────────────────────────────────────────
function InputField({ label, id, value, onChange, placeholder, required = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}{required && <span className="ml-1 text-blue-400">*</span>}
      </label>
      <input
        id={id} type="text" value={value} onChange={onChange} placeholder={placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
      />
    </div>
  );
}

// ─── Matchup Result Cards ─────────────────────────────────────────────────────
function ScoreCard({ score }) {
  const rec = getRecommendationIcon(score);
  return (
    <div className={`col-span-full rounded-xl border p-8 text-center ${getScoreBg(score)}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Matchup Score</div>
      <div className={`text-7xl font-black tabular-nums ${getScoreColor(score)}`}>{score}</div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-lg">{rec.icon}</span>
        <span className={`text-base font-bold ${rec.color}`}>{rec.label}</span>
      </div>
      <div className="mt-2 text-sm text-gray-500">out of 100</div>
    </div>
  );
}

function RecencyCard({ recency }) {
  if (!recency) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4"><span className="text-base">📊</span><h3 className="text-sm font-bold text-white">Recency Trends</h3></div>
        <p className="text-sm text-gray-500">No recency data available.</p>
      </div>
    );
  }
  const rows = [
    { label: 'Last 10 — Avg Hits/Game',  value: recency.last10AvgHitsPerGame !== undefined ? formatNum(recency.last10AvgHitsPerGame, 2) : '—' },
    { label: 'Last 5 — Avg Hits/Game',   value: recency.last5AvgHitsPerGame  !== undefined ? formatNum(recency.last5AvgHitsPerGame,  2) : '—' },
    { label: 'HR (Last 10 games)',        value: recency.last10HR             !== undefined ? recency.last10HR : '—' },
    { label: 'HR (Last 5 games)',         value: recency.last5HR              !== undefined ? recency.last5HR  : '—' },
    { label: 'Recency Adjustment',        value: recency.recencyAdjustment    !== undefined ? `${recency.recencyAdjustment > 0 ? '+' : ''}${formatNum(recency.recencyAdjustment, 2)}` : '—', highlight: true },
  ];
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span className="text-base">📊</span><h3 className="text-sm font-bold text-white">Recency Trends</h3></div>
      <div className="space-y-2.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">{row.label}</span>
            <span className={`text-xs font-bold tabular-nums ${row.highlight ? 'text-blue-400' : 'text-white'}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParkFactorsCard({ parkFactors }) {
  if (!parkFactors) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4"><span className="text-base">🏟️</span><h3 className="text-sm font-bold text-white">Park Factors</h3></div>
        <p className="text-sm text-gray-500">No park factor data available.</p>
      </div>
    );
  }
  const rows = [
    { label: 'Run Factor', value: formatNum(parkFactors.runFactor, 3) },
    { label: 'HR Factor',  value: formatNum(parkFactors.hrFactor,  3) },
    { label: 'Park Adjustment', value: parkFactors.parkAdjustment !== undefined ? `${parkFactors.parkAdjustment > 0 ? '+' : ''}${formatNum(parkFactors.parkAdjustment, 2)}` : '—', highlight: true },
  ];
  const stadium = parkFactors.stadium || parkFactors.name || '—';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-1"><span className="text-base">🏟️</span><h3 className="text-sm font-bold text-white">Park Factors</h3></div>
      {stadium !== '—' && <p className="text-xs text-gray-500 mb-4">{stadium}</p>}
      {stadium === '—' && <div className="mb-4" />}
      <div className="space-y-2.5">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">{row.label}</span>
            <span className={`text-xs font-bold tabular-nums ${row.highlight ? 'text-blue-400' : 'text-white'}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherCard({ weather }) {
  if (!weather || (!weather.temperature && !weather.windSpeed && !weather.weatherImpact)) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4"><span className="text-base">🌤️</span><h3 className="text-sm font-bold text-white">Weather</h3></div>
        <p className="text-sm text-gray-500">No weather data provided.</p>
        <p className="text-xs text-gray-600 mt-1">Add latitude &amp; longitude to include weather analysis.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4"><span className="text-base">🌤️</span><h3 className="text-sm font-bold text-white">Weather</h3></div>
      <div className="space-y-2.5">
        {weather.temperature !== undefined && (
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-gray-500">Temperature</span><span className="text-xs font-bold text-white">{weather.temperature}°C</span></div>
        )}
        {weather.windSpeed !== undefined && (
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-gray-500">Wind Speed</span><span className="text-xs font-bold text-white">{weather.windSpeed} km/h</span></div>
        )}
        {weather.windDirection !== undefined && (
          <div className="flex items-center justify-between gap-2"><span className="text-xs text-gray-500">Wind Direction</span><span className="text-xs font-bold text-white">{weather.windDirection}°</span></div>
        )}
        {weather.weatherImpact !== undefined && (
          <div className="mt-1 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Impact Score</span>
              <span className={`text-xs font-bold tabular-nums ${weather.weatherImpact > 0 ? 'text-blue-400' : weather.weatherImpact < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {weather.weatherImpact > 0 ? '+' : ''}{formatNum(weather.weatherImpact, 2)}
              </span>
            </div>
          </div>
        )}
        {weather.notes && <p className="mt-2 text-xs text-gray-500 italic">{weather.notes}</p>}
      </div>
    </div>
  );
}

function SplitStatsCard({ data }) {
  const split   = data.splitUsed || data.split || null;
  const matchup = data.matchupStats || data.stats || null;
  const batterRows = [
    { label: 'Batting AVG', value: matchup?.avg       !== undefined ? formatNum(matchup.avg, 3)    : '—' },
    { label: 'OPS',         value: matchup?.ops       !== undefined ? formatNum(matchup.ops, 3)    : '—' },
    { label: 'SLG',         value: matchup?.slg       !== undefined ? formatNum(matchup.slg, 3)    : '—' },
    { label: 'OBP',         value: matchup?.obp       !== undefined ? formatNum(matchup.obp, 3)    : '—' },
    { label: 'HR Rate',     value: matchup?.hrRate    !== undefined ? `${formatNum(matchup.hrRate * 100, 1)}%` : '—' },
    { label: 'At Bats',     value: matchup?.atBats    ?? '—' },
    { label: 'Home Runs',   value: matchup?.homeRuns  ?? '—' },
  ];
  const pitcherRows = [
    { label: 'ERA',  value: matchup?.era  !== undefined ? formatNum(matchup.era,  2) : '—' },
    { label: 'WHIP', value: matchup?.whip !== undefined ? formatNum(matchup.whip, 3) : '—' },
    { label: 'K/9',  value: matchup?.k9   !== undefined ? formatNum(matchup.k9,   2) : '—' },
    { label: 'BB/9', value: matchup?.bb9  !== undefined ? formatNum(matchup.bb9,  2) : '—' },
    { label: 'FIP',  value: matchup?.fip  !== undefined ? formatNum(matchup.fip,  2) : '—' },
  ];
  const hasBatter  = batterRows.some(r => r.value !== '—');
  const hasPitcher = pitcherRows.some(r => r.value !== '—');
  return (
    <div className="col-span-full rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div className="flex items-center gap-2"><span className="text-base">✂️</span><h3 className="text-sm font-bold text-white">Split Stats</h3></div>
        {split && (
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">{split}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {hasBatter && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Batter Stats</div>
            <div className="space-y-2">
              {batterRows.filter(r => r.value !== '—').map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-xs font-bold text-white tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasPitcher && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Pitcher Stats</div>
            <div className="space-y-2">
              {pitcherRows.filter(r => r.value !== '—').map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-xs font-bold text-white tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!hasBatter && !hasPitcher && (
          <div className="col-span-2"><p className="text-sm text-gray-500">No split stats available for this matchup.</p></div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'hitting', label: 'Hitting'    },
  { id: 'hr',      label: 'Home Runs'  },
  { id: 'runs',    label: 'Runs / RBI' },
  { id: 'pitching',label: 'Pitching'   },
];

export default function DashboardPage() {
  // ── Research state ────────────────────────────────────────────────────────
  const [category,        setCategory]        = useState('hitting');
  const [win,             setWin]             = useState('10');
  const [teams,           setTeams]           = useState([]);
  const [selectedTeamId,  setSelectedTeamId]  = useState('');
  const [roster,          setRoster]          = useState([]);
  const [selectedPlayerId,setSelectedPlayerId]= useState('');
  const [researchList,    setResearchList]    = useState([]);
  const [todayGames,      setTodayGames]      = useState([]);
  const [teamsLoading,    setTeamsLoading]    = useState(false);
  const [rosterLoading,   setRosterLoading]   = useState(false);

  // ── Matchup analysis state ────────────────────────────────────────────────
  const [batterId,  setBatterId]  = useState('');
  const [pitcherId, setPitcherId] = useState('');
  const [season,    setSeason]    = useState('2025');
  const [stadium,   setStadium]   = useState('');
  const [lat,       setLat]       = useState('');
  const [lon,       setLon]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);

  // ── Load teams on mount ───────────────────────────────────────────────────
  useEffect(() => {
    async function fetchTeams() {
      const cached = getCached('mlb_teams_2025', 24 * 60 * 60 * 1000);
      if (cached) { setTeams(cached); return; }
      setTeamsLoading(true);
      try {
        const res  = await fetch(`${MLB_API}/teams?sportId=1&season=2025`);
        const data = await res.json();
        const list = (data.teams || [])
          .filter(t => t.sport?.id === 1 && t.active)
          .map(t => ({ id: t.id, name: t.name, abbreviation: t.abbreviation }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCached('mlb_teams_2025', list);
        setTeams(list);
      } catch {}
      setTeamsLoading(false);
    }
    fetchTeams();
  }, []);

  // ── Load today's probables on mount ──────────────────────────────────────
  useEffect(() => {
    async function fetchProbables() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res   = await fetch(`${API_URL}/games/probables?date=${today}`);
        if (!res.ok) return;
        const data  = await res.json();
        setTodayGames(data.games || []);
      } catch {}
    }
    fetchProbables();
  }, []);

  // ── Load roster when team changes ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeamId) { setRoster([]); setSelectedPlayerId(''); return; }
    async function fetchRoster() {
      const key    = `mlb_roster_${selectedTeamId}_2025`;
      const cached = getCached(key, 6 * 60 * 60 * 1000);
      if (cached) { setRoster(cached); setSelectedPlayerId(''); return; }
      setRosterLoading(true);
      try {
        const res  = await fetch(`${MLB_API}/teams/${selectedTeamId}/roster?rosterType=active&season=2025`);
        const data = await res.json();
        const list = (data.roster || [])
          .map(p => ({ id: p.person.id, fullName: p.person.fullName, position: p.position?.abbreviation ?? '' }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setCached(key, list);
        setRoster(list);
        setSelectedPlayerId('');
      } catch {}
      setRosterLoading(false);
    }
    fetchRoster();
  }, [selectedTeamId]);

  // ── Add player to research list ───────────────────────────────────────────
  async function addPlayer() {
    if (!selectedPlayerId) return;
    const player = roster.find(p => p.id === Number(selectedPlayerId));
    if (!player) return;
    if (researchList.some(r => r.playerId === player.id)) return;
    const team = teams.find(t => t.id === Number(selectedTeamId));
    const entry = {
      playerId:        player.id,
      fullName:        player.fullName,
      primaryPosition: player.position,
      teamId:          Number(selectedTeamId),
      teamName:        team?.name ?? '',
      teamAbbrev:      team?.abbreviation ?? '',
      gamelog:         [],
      loading:         true,
      error:           null,
    };
    setResearchList(prev => [entry, ...prev]);
    try {
      const res  = await fetch(`${API_URL}/player/${player.id}/gamelog?season=2025`);
      if (!res.ok) throw new Error('Failed to load game log');
      const data = await res.json();
      const games = data.games ?? data.gamelog ?? [];
      setResearchList(prev =>
        prev.map(r => r.playerId === player.id ? { ...r, gamelog: games, loading: false } : r)
      );
    } catch {
      setResearchList(prev =>
        prev.map(r => r.playerId === player.id ? { ...r, loading: false, error: 'Could not load stats' } : r)
      );
    }
  }

  function removePlayer(playerId) {
    setResearchList(prev => prev.filter(r => r.playerId !== playerId));
  }

  // ── Matchup analysis ──────────────────────────────────────────────────────
  async function runMatchup() {
    if (!batterId.trim() || !pitcherId.trim()) { setError('Batter ID and Pitcher ID are required.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      let url = `${API_URL}/matchup/batter/${batterId.trim()}/pitcher/${pitcherId.trim()}?season=${season}`;
      if (stadium.trim()) url += `&stadium=${encodeURIComponent(stadium.trim())}`;
      if (lat.trim() && lon.trim()) url += `&lat=${lat.trim()}&lon=${lon.trim()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Server error: ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || 'Failed to fetch matchup data.');
    } finally {
      setLoading(false);
    }
  }

  const score = result?.score ?? result?.matchupScore ?? null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">Player Research</h1>
          <p className="mt-1.5 text-gray-400">Browse rosters, track recent form, and surface top prop plays by category.</p>
        </div>

        {/* Controls Bar */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">

            {/* Category toggles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    category === cat.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="w-px h-6 bg-gray-700 hidden sm:block" />

            {/* Window select */}
            <select
              value={win}
              onChange={e => setWin(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="5">Last 5 Games</option>
              <option value="10">Last 10 Games</option>
              <option value="season">Full Season</option>
            </select>

            <div className="w-px h-6 bg-gray-700 hidden sm:block" />

            {/* Team select */}
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              disabled={teamsLoading}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 min-w-[160px] cursor-pointer disabled:opacity-50"
            >
              <option value="">{teamsLoading ? 'Loading teams…' : 'Select Team'}</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {/* Player select */}
            {selectedTeamId && (
              <select
                value={selectedPlayerId}
                onChange={e => setSelectedPlayerId(e.target.value)}
                disabled={rosterLoading}
                className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-bold text-gray-300 outline-none focus:border-blue-500 min-w-[190px] cursor-pointer disabled:opacity-50"
              >
                <option value="">{rosterLoading ? 'Loading roster…' : 'Select Player'}</option>
                {roster.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.position})</option>)}
              </select>
            )}

            {/* Add button */}
            {selectedPlayerId && (
              <button
                onClick={addPlayer}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                + Add Player
              </button>
            )}
          </div>
        </div>

        {/* Research List */}
        {researchList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {researchList.map(player => (
              <PlayerCard
                key={player.playerId}
                player={player}
                category={category}
                win={win}
                todayGames={todayGames}
                onRemove={removePlayer}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/30 py-20 text-center mb-10">
            <div className="mb-4 opacity-40"><LogoMark size={40} /></div>
            <p className="text-base font-semibold text-gray-400">No players added yet</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xs">
              Select a team and player above to start building your research board.
            </p>
            <Link href="/probables" className="mt-5 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View today&apos;s probable pitchers →
            </Link>
          </div>
        )}

        {/* Advanced Matchup Analysis (collapsible) */}
        <details className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden group">
          <summary className="cursor-pointer px-6 py-4 flex items-center gap-3 select-none hover:bg-gray-900/80 transition-colors list-none">
            <span className="text-base">⚡</span>
            <span className="text-sm font-bold text-white">Advanced Matchup Analysis</span>
            <span className="ml-auto text-xs text-gray-600">Deep batter vs pitcher scoring</span>
          </summary>

          <div className="px-6 pb-6 pt-2 border-t border-gray-800">
            <p className="text-sm text-gray-500 mb-5">
              Run a full batter vs pitcher analysis with park factors, weather, and split stats.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <InputField label="Batter ID"  id="batterId"  value={batterId}  onChange={e => setBatterId(e.target.value)}  placeholder="e.g. 660271"       required />
              <InputField label="Pitcher ID" id="pitcherId" value={pitcherId} onChange={e => setPitcherId(e.target.value)} placeholder="e.g. 592789"       required />
              <InputField label="Season"     id="season"    value={season}    onChange={e => setSeason(e.target.value)}    placeholder="2025" />
              <InputField label="Stadium"    id="stadium"   value={stadium}   onChange={e => setStadium(e.target.value)}   placeholder="e.g. Dodger Stadium" />
              <InputField label="Latitude"   id="lat"       value={lat}       onChange={e => setLat(e.target.value)}       placeholder="Optional" />
              <InputField label="Longitude"  id="lon"       value={lon}       onChange={e => setLon(e.target.value)}       placeholder="Optional" />
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-red-400">Analysis failed</p>
                  <p className="text-sm text-red-300/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={runMatchup}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  Analyzing Matchup…
                </>
              ) : (
                <><span>⚡</span> Run Matchup Analysis</>
              )}
            </button>

            {/* Results */}
            {result && score !== null && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-bold text-white">Results</h2>
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">Analysis Complete</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ScoreCard score={score} />
                  <RecencyCard recency={result.recency ?? result.recencyData ?? null} />
                  <ParkFactorsCard parkFactors={result.parkFactors ?? result.parkFactor ?? null} />
                  <WeatherCard weather={result.weather ?? result.weatherData ?? null} />
                  <SplitStatsCard data={result} />
                </div>
                <details className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                  <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors select-none list-none">
                    View raw API response
                  </summary>
                  <pre className="overflow-x-auto px-5 pb-5 pt-2 text-xs text-gray-500 leading-relaxed">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </details>

      </main>
    </div>
  );
}
