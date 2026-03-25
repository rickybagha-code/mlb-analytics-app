'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProprStatsLogo from '../../../../components/ProprStatsLogo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MLB_API  = 'https://statsapi.mlb.com/api/v1';

// ─── Prop Categories ──────────────────────────────────────────────────────────
const PROP_CATS = [
  { id:'hits', label:'Hits',         field:'hits',        lines:[0.5,1.5,2.5], def:0.5 },
  { id:'runs', label:'Runs',         field:'runs',        lines:[0.5,1.5],     def:0.5 },
  { id:'rbi',  label:'RBI',          field:'rbi',         lines:[0.5,1.5],     def:0.5 },
  { id:'hr',   label:'Home Runs',    field:'homeRuns',    lines:[0.5],         def:0.5 },
  { id:'sb',   label:'Stolen Bases', field:'stolenBases', lines:[0.5],         def:0.5 },
];
const CAT_MODEL = { hits:'hitting', runs:'runs', rbi:'runs', hr:'hr', sb:null };

// ─── Projection Model (mirrors dashboard) ────────────────────────────────────
function computeProjectionScore(player, category) {
  const ab  = player.atBats           || 0;
  const pa  = player.plateAppearances || (ab + (player.baseOnBalls || 0));
  const avg = player.avg              || 0;
  const obp = player.obp              || 0;
  const slg = player.slg              || 0;
  const hr  = player.homeRuns         || 0;
  const rbi = player.rbi              || 0;
  const r   = player.runs             || 0;
  const gp  = Math.max(player.gamesPlayed || 1, 1);
  const bb  = player.baseOnBalls      || 0;
  const k   = player.strikeOuts       || 0;
  const hits= player.hits             || 0;
  const dbl = player.doubles          || 0;
  const tri = player.triples          || 0;
  const xwoba      = player.xwoba      ?? null;
  const barrelPct  = player.barrelPct  ?? null;
  const hardHitPct = player.hardHitPct ?? null;
  const hrRate  = ab > 0 ? hr / ab : 0;
  const iso     = Math.max(0, slg - avg);
  const kPct    = pa > 0 ? k  / pa : 0.22;
  const bbPct   = pa > 0 ? bb / pa : 0.08;
  const singles = Math.max(0, hits - dbl - tri - hr);
  const wOBA = pa > 0
    ? (bb*0.690 + singles*0.888 + dbl*1.271 + tri*1.616 + hr*2.101) / pa
    : (avg * 0.88 + obp * 0.12);
  const effectiveWOBA = xwoba != null ? wOBA * 0.35 + xwoba * 0.65 : wOBA;
  const confidence = Math.min(1.0, Math.max(0.5, (ab - 150) / 300 + 0.5));
  const era = player.matchupEra ?? null;
  const pitcherMod = era != null ? Math.max(-10, Math.min(10, (era - 4.50) * 2.5)) : 0;
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
    const wComp    = (effectiveWOBA - 0.315) * 250;
    const kPenalty = Math.max(0, (kPct - 0.20) * 50);
    const bbBonus  = Math.max(0, (bbPct - 0.08) * 25);
    const hardBonus = hardHitPct != null ? Math.max(0, Math.min(8, (hardHitPct - 40) / 18 * 8)) : 0;
    base = 53 + wComp - kPenalty + bbBonus + hardBonus + pitcherMod;
  } else if (category === 'hr') {
    const hrComp      = Math.min(55, (hrRate / 0.08) * 55);
    const isoComp     = Math.max(0, Math.min(15, (iso - 0.100) / 0.200 * 15));
    const kHit        = Math.max(0, (kPct - 0.25) * 25);
    const barrelBonus = barrelPct != null ? Math.max(0, Math.min(15, (barrelPct - 5) / 15 * 15)) : 0;
    base = 18 + hrComp + isoComp - kHit + barrelBonus + pitcherMod * 0.7;
  } else if (category === 'runs') {
    const rComp   = Math.max(-15, Math.min(25, (r   / gp - 0.45) * 55));
    const rbiComp = Math.max(-15, Math.min(25, (rbi / gp - 0.45) * 55));
    const obpComp = Math.max(0,   Math.min(15, (obp - 0.300) / 0.120 * 15));
    const hardBonus = hardHitPct != null ? Math.max(0, Math.min(5, (hardHitPct - 40) / 18 * 5)) : 0;
    base = 40 + rComp + rbiComp + obpComp + hardBonus + pitcherMod;
  }
  const adjusted = 50 + (base - 50) * confidence;
  return Math.round(Math.max(5, Math.min(99, adjusted + recencyBoost)));
}

function computeStreak(games) {
  let s = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    if ((Number(games[i].hits) || 0) > 0) s++;
    else break;
  }
  return s;
}

function computeL10Avg(games) {
  const last10 = games.slice(-10);
  const h  = last10.reduce((a, g) => a + (Number(g.hits)   || 0), 0);
  const ab = last10.reduce((a, g) => a + (Number(g.atBats) || 0), 0);
  return ab >= 15 ? h / ab : null;
}

// ─── Pitcher helpers ──────────────────────────────────────────────────────────
function computeFIP(st) {
  const ip = parseFloat(st?.inningsPitched) || 0;
  const hr = parseInt(st?.homeRuns)         || 0;
  const bb = parseInt(st?.baseOnBalls)      || 0;
  const k  = parseInt(st?.strikeOuts)       || 0;
  if (ip < 1) return null;
  return (13 * hr + 3 * bb - 2 * k) / ip + 3.10;
}
function pitcherScoreFromERA(era) {
  if (era == null) return null;
  return Math.round(Math.max(10, Math.min(95, 50 + (4.50 - era) * 15)));
}
function pitcherScoreFromKProj(projected) {
  if (projected == null) return null;
  // League avg K/start ≈ 5.5; scale ±10 points per K above/below
  return Math.round(Math.max(10, Math.min(99, 50 + (projected - 5.5) * 10)));
}
function getStartResult(s) {
  if (s.isWin)  return { label:'W', cls:'text-emerald-400' };
  if (s.isLoss) return { label:'L', cls:'text-red-400' };
  return { label:'ND', cls:'text-gray-500' };
}
function pitcherAvgCls(avg) {
  const v = parseFloat(avg) || 0.250;
  if (v <= 0.200) return { text:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30' };
  if (v <= 0.250) return { text:'text-yellow-400',  bg:'bg-yellow-500/10  border-yellow-500/30'  };
  return             { text:'text-red-400',      bg:'bg-red-500/10     border-red-500/30'     };
}
function computeDaysRest(starts) {
  if (!starts?.length) return null;
  const last = starts[starts.length - 1];
  if (!last?.date) return null;
  const diff = Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000);
  return diff;
}

// ─── Math utilities (Poisson / EV) ───────────────────────────────────────────
function poissonPMF(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let j = 1; j <= k; j++) logP -= Math.log(j);
  return Math.exp(logP);
}
function poissonCDF(k, lambda) {
  if (lambda <= 0) return 1;
  let s = 0;
  for (let i = 0; i <= k; i++) s += poissonPMF(i, lambda);
  return Math.min(1, s);
}
function americanToDecimal(odds) {
  const n = parseInt(odds) || -115;
  return n < 0 ? Math.abs(n) / (Math.abs(n) + 100) : 100 / (n + 100);
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
function fmt(v, d=3) { if (v==null) return '—'; const n=parseFloat(v); return isNaN(n)?'—':n.toFixed(d); }
function fmtDate(s) {
  if (!s) return '';
  const p = s.split('-');
  return p.length >= 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : s;
}
function getScoreColor(s) { if(s>=75) return 'text-emerald-400'; if(s>=60) return 'text-yellow-400'; if(s>=45) return 'text-orange-400'; return 'text-red-400'; }
function ringColor(s)      { if(s>=75) return '#34d399'; if(s>=60) return '#facc15'; if(s>=45) return '#fb923c'; return '#f87171'; }
function statCls(v, good, ok) {
  if(v>=good) return { text:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30' };
  if(v>=ok)   return { text:'text-yellow-400',  bg:'bg-yellow-500/10  border-yellow-500/30' };
  return             { text:'text-red-400',      bg:'bg-red-500/10     border-red-500/30'    };
}
function eraCls(era)  { return statCls(6-(era??4.5), 2, 1); }
function whipCls(w)   { return statCls(2-(w??1.3), 0.7, 0.3); }

function getRecommendation(score) {
  if (score >= 75) return { label:'Strong Value — Over',   color:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30' };
  if (score >= 60) return { label:'Lean Over',             color:'text-yellow-400',  bg:'bg-yellow-500/10  border-yellow-500/30' };
  if (score >= 45) return { label:'Neutral',               color:'text-orange-400',  bg:'bg-orange-500/10  border-orange-500/30' };
  return                   { label:'Lean Under / Avoid',   color:'text-red-400',     bg:'bg-red-500/10     border-red-500/30'    };
}

// ─── Player Headshot ──────────────────────────────────────────────────────────
function PlayerHeadshot({ playerId, name, size=80 }) {
  const [failed, setFailed] = useState(false);
  const initials = name ? name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '??';
  if (failed) return (
    <div style={{width:size,height:size,minWidth:size}} className="rounded-full bg-blue-600/20 border-2 border-blue-500/30 flex items-center justify-center text-blue-400 font-bold flex-shrink-0"
      style={{width:size,height:size,minWidth:size,fontSize:size*0.3}}>
      {initials}
    </div>
  );
  return (
    <img src={`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${playerId}/headshot/67/current`}
      alt={name} style={{width:size,height:size,minWidth:size,objectFit:'cover'}}
      className="rounded-full border-2 border-gray-700 bg-gray-800 flex-shrink-0"
      onError={()=>setFailed(true)} />
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size=56 }) {
  const r=20, circ=2*Math.PI*r, dash=(score/100)*circ;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#1f2937" strokeWidth="4"/>
        <circle cx="28" cy="28" r={r} fill="none" stroke={ringColor(score)} strokeWidth="4"
          strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round" transform="rotate(-90 28 28)"/>
      </svg>
      <span className={`absolute text-sm font-black tabular-nums ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function GameLogChart({ games, field, line, win }) {
  const slice = games.slice(-win);
  if (!slice.length) return (
    <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No game log data available.</div>
  );

  const vals    = slice.map(g => Number(g[field]) || 0);
  const maxVal  = Math.max(1, Math.ceil(line) + 1, ...vals);
  const overCnt = vals.filter(v => v > line).length;

  const BAR_W = 54, BAR_GAP = 10;
  const VW = slice.length * (BAR_W + BAR_GAP) + BAR_GAP;
  const H = 210, PT = 28, PB = 44, CH = H - PT - PB;

  const yOf = v => PT + CH * (1 - Math.min(v, maxVal) / maxVal);
  const lineY = yOf(line);

  return (
    <div>
      {/* Legend row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className={`text-sm font-black tabular-nums ${overCnt/slice.length >= 0.6 ? 'text-emerald-400' : overCnt/slice.length >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
            {overCnt}/{slice.length} OVER
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-emerald-500/80 inline-block"/>Over</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-red-500/80 inline-block"/>Under</span>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-400">── Line: {line}</span>
      </div>

      <div className="overflow-x-auto pb-1">
        <svg viewBox={`0 0 ${VW} ${H}`} style={{width:'100%', minWidth: Math.min(VW, 320)}} preserveAspectRatio="xMidYMid meet">
          {/* Subtle grid lines */}
          {[0.25,0.5,0.75,1].map(pct => {
            const gy = PT + CH * (1 - pct);
            const gv = maxVal * pct;
            return (
              <g key={pct}>
                <line x1={0} y1={gy} x2={VW} y2={gy} stroke="#1f2937" strokeWidth="1"/>
                <text x={2} y={gy - 3} fill="#374151" fontSize="9">{Number.isInteger(gv) ? gv : ''}</text>
              </g>
            );
          })}

          {/* Vegas line */}
          <line x1={0} y1={lineY} x2={VW} y2={lineY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.9"/>

          {/* Bars */}
          {slice.map((game, i) => {
            const val  = vals[i];
            const isOver = val > line;
            const barX = i * (BAR_W + BAR_GAP) + BAR_GAP;
            const barH = Math.max(3, (val / maxVal) * CH);
            const barY = yOf(val);
            const lblY = barY > PT + 18 ? barY - 6 : barY + 16;
            const opp  = (game.opponent || '').split(' ').at(-1);

            return (
              <g key={i}>
                {/* Bar shadow */}
                <rect x={barX+1} y={barY+1} width={BAR_W} height={barH} rx={5}
                  fill={isOver ? '#16a34a' : val===0 ? '#111827' : '#b91c1c'} opacity="0.3"/>
                {/* Bar */}
                <rect x={barX} y={barY} width={BAR_W} height={barH} rx={5}
                  fill={val===0 ? '#1f2937' : isOver ? '#22c55e' : '#ef4444'} opacity="0.88"/>
                {/* Top highlight */}
                {barH > 8 && <rect x={barX+4} y={barY+2} width={BAR_W-8} height={3} rx={2}
                  fill="white" opacity="0.12"/>}
                {/* Value label */}
                <text x={barX+BAR_W/2} y={lblY} textAnchor="middle"
                  fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{val}</text>
                {/* Date */}
                <text x={barX+BAR_W/2} y={H-PB+15} textAnchor="middle" fill="#6b7280" fontSize="10">{fmtDate(game.date)}</text>
                {/* Opponent */}
                <text x={barX+BAR_W/2} y={H-PB+27} textAnchor="middle" fill="#4b5563" fontSize="9">{opp ? `@${opp}` : ''}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, sub, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-800/60 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-right">
        <span className={`text-xs font-bold tabular-nums ${highlight || 'text-white'}`}>{value}</span>
        {sub && <span className="ml-1 text-xs text-gray-600">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Card Wrapper ─────────────────────────────────────────────────────────────
function Card({ title, icon, children, className='' }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900 p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">{icon}</span>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`rounded bg-gray-800 animate-pulse ${className}`}/>;
}

// ─── Sparkline (pure SVG — no Chart.js) ──────────────────────────────────────
function Sparkline({ values, width=160, height=28, color='#3b82f6' }) {
  if (!values || values.length < 2) return <span className="text-gray-700 text-xs">—</span>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = (height - 4) - ((v - min) / range) * (height - 8) + 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = values[values.length - 1];
  const lx = width - 2;
  const ly = (height - 4) - ((last - min) / range) * (height - 8) + 2;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{overflow:'visible'}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
      <circle cx={lx} cy={ly} r="3" fill={color}/>
    </svg>
  );
}

// ─── Pitcher L10 Starts Table ─────────────────────────────────────────────────
function PitcherStartsTable({ starts, loading }) {
  if (loading) return (
    <div className="space-y-2">{[1,2,3,4,5].map(i=><Skeleton key={i} className="h-8 w-full"/>)}</div>
  );
  if (!starts?.length) return <p className="text-sm text-gray-600 italic">No starts found this season.</p>;
  const last10 = [...starts].slice(-10).reverse();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-600 border-b border-gray-800">
            {['Date','Opp','IP','K','BB','HR','ER','Res'].map(h=>(
              <th key={h} className={`py-2 font-semibold ${h==='Date'||h==='Opp'?'text-left pr-3':'text-center px-2'} ${h==='Res'?'text-right pl-2':''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {last10.map((s, i) => {
            const opp = (s.opponent || '').split(' ').at(-1);
            const res = getStartResult(s);
            const kCls = s.strikeOuts >= 9 ? 'text-emerald-400 font-black' : s.strikeOuts >= 7 ? 'text-emerald-400 font-bold' : s.strikeOuts >= 5 ? 'text-yellow-400' : s.strikeOuts >= 3 ? 'text-white' : 'text-red-400';
            const erCls= s.earnedRuns === 0 ? 'text-emerald-400' : s.earnedRuns <= 2 ? 'text-yellow-400' : s.earnedRuns <= 4 ? 'text-orange-400' : 'text-red-400';
            return (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                <td className="py-2 pr-3 text-gray-500">{fmtDate(s.date)}</td>
                <td className="py-2 pr-3 text-gray-400 font-medium">{opp||'—'}</td>
                <td className="py-2 px-2 text-center text-white tabular-nums">{s.inningsPitched||'0'}</td>
                <td className={`py-2 px-2 text-center tabular-nums ${kCls}`}>{s.strikeOuts}</td>
                <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{s.baseOnBalls}</td>
                <td className="py-2 px-2 text-center tabular-nums">{s.homeRuns>0?<span className="text-red-400">{s.homeRuns}</span>:<span className="text-gray-700">0</span>}</td>
                <td className={`py-2 px-2 text-center tabular-nums ${erCls}`}>{s.earnedRuns}</td>
                <td className={`py-2 pl-2 text-right font-black tabular-nums ${res.cls}`}>{res.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pitcher K Trend Card ─────────────────────────────────────────────────────
function PitcherKTrendCard({ starts, loading }) {
  const last10 = starts.slice(-10);
  if (loading) return <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div>;
  if (!last10.length) return <p className="text-sm text-gray-600 italic">No starts data available.</p>;

  const kVals  = last10.map(s => s.strikeOuts);
  const erVals = last10.map(s => s.earnedRuns);
  const ipVals = last10.map(s => parseFloat(s.inningsPitched) || 0);
  const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

  return (
    <div className="space-y-5">
      {[
        { label:'K per Start',  values: kVals,  avg: avg(kVals).toFixed(1),  color:'#34d399', note: `${Math.max(...kVals)} peak` },
        { label:'ER per Start', values: erVals, avg: avg(erVals).toFixed(1), color:'#f87171', note: `${Math.min(...erVals)} min` },
        { label:'IP per Start', values: ipVals, avg: avg(ipVals).toFixed(1), color:'#60a5fa', note: `${Math.max(...ipVals)} max` },
      ].map(({ label, values, avg: avgV, color, note }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{note}</span>
              <span className="text-xs font-bold text-white tabular-nums">avg {avgV}</span>
            </div>
          </div>
          <Sparkline values={values} width={220} height={30} color={color}/>
        </div>
      ))}
      <p className="text-xs text-gray-700 pt-1 border-t border-gray-800/50">Last {last10.length} starts · newest right</p>
    </div>
  );
}

// ─── Pitcher Platoon Splits Card ──────────────────────────────────────────────
function PitcherPlatoonCard({ splits, loading }) {
  if (loading && !splits) return (
    <div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-16 w-full"/>)}</div>
  );
  if (!splits) return <p className="text-sm text-gray-600 italic">Splits data not available yet this season.</p>;

  return (
    <div className="space-y-3">
      {[
        { label:'vs LHB', data: splits.vsLeftHandedBatters },
        { label:'vs RHB', data: splits.vsRightHandedBatters },
      ].map(({ label, data }) => (
        <div key={label} className="rounded-lg border border-gray-800 bg-gray-800/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400">{label}</span>
            {data && <span className="text-xs text-gray-600 tabular-nums">{data.battersFaced} BF</span>}
          </div>
          {data ? (
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { l:'AVG vs', v: fmt(data.avg,3),  c: pitcherAvgCls(data.avg) },
                { l:'OPS vs', v: fmt(data.ops,3),  c: pitcherAvgCls(data.ops ? String(parseFloat(data.ops)-0.200) : null) },
                { l:'K%',    v: data.kPct != null  ? `${(data.kPct*100).toFixed(0)}%`  : '—', c: statCls((data.kPct||0)*100, 28, 22) },
                { l:'BB%',   v: data.bbPct != null ? `${(data.bbPct*100).toFixed(0)}%` : '—', c: statCls(12-(data.bbPct||0)*100, 4, 0) },
              ].map(s => (
                <div key={s.l}>
                  <div className={`text-sm font-black tabular-nums ${s.c.text}`}>{s.v}</div>
                  <div className="text-xs text-gray-600">{s.l}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 italic">No data</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Pitcher Contextual Factors Row ──────────────────────────────────────────
function PitcherContextRow({ starts, oppAbbrev, isHome }) {
  const daysRest = computeDaysRest(starts);
  const items = [
    {
      icon: '📅',
      label: 'Days Rest',
      value: daysRest != null ? `${daysRest}d` : '—',
      sub:   daysRest != null ? (daysRest >= 5 ? 'Well rested' : daysRest >= 4 ? 'Normal rest' : 'Short rest') : '—',
      cls:   daysRest != null ? (daysRest >= 5 ? 'text-emerald-400' : daysRest >= 4 ? 'text-yellow-400' : 'text-orange-400') : 'text-gray-600',
    },
    {
      icon: '🏟️',
      label: 'Park K Factor',
      value: '—',
      sub:   'Coming Soon',
      cls:   'text-gray-600',
    },
    {
      icon: '🌤️',
      label: 'Weather',
      value: '—',
      sub:   'Coming Soon',
      cls:   'text-gray-600',
    },
    {
      icon: '⚖️',
      label: 'Ump K/Game',
      value: '—',
      sub:   'Coming Soon',
      cls:   'text-gray-600',
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(item => (
        <div key={item.label} className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-center">
          <div className="text-xl mb-1">{item.icon}</div>
          <div className={`text-lg font-black tabular-nums ${item.cls}`}>{item.value}</div>
          <div className="text-xs text-white mt-0.5 font-medium">{item.label}</div>
          <div className="text-xs text-gray-600 mt-0.5">{item.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Pitcher chart categories ────────────────────────────────────────────────
const PITCHER_CHART_CATS = [
  { id:'k',   label:'K',          field:'strikeOuts',  defaultLine:4.5,  higherIsBetter:true  },
  { id:'er',  label:'ER',         field:'earnedRuns',  defaultLine:2.5,  higherIsBetter:false },
  { id:'outs',label:'Outs',       field:'_outs',       defaultLine:15.5, higherIsBetter:true  },
  { id:'h',   label:'H Allowed',  field:'hits',        defaultLine:5.5,  higherIsBetter:false },
  { id:'bb',  label:'BB',         field:'baseOnBalls', defaultLine:2.5,  higherIsBetter:false },
  { id:'hr',  label:'HR Allowed', field:'homeRuns',    defaultLine:0.5,  higherIsBetter:false },
];

// ─── Pitcher Bar Chart (mirrors GameLogChart style) ───────────────────────────
function PitcherGameLogChart({ starts, catId, line, win }) {
  const cat = PITCHER_CHART_CATS.find(c => c.id === catId) || PITCHER_CHART_CATS[0];
  const processed = starts.map(s => ({ ...s, _outs: Math.round(parseFloat(s.inningsPitched || '0') * 3) }));
  const slice = processed.slice(-win);
  if (!slice.length) return (
    <div className="flex items-center justify-center h-40 text-gray-600 text-sm">No start data available.</div>
  );
  const vals    = slice.map(g => Number(g[cat.field]) || 0);
  const maxVal  = Math.max(1, Math.ceil(line) + 2, ...vals);
  const goodCnt = vals.filter(v => cat.higherIsBetter ? v > line : v <= line).length;
  const BAR_W = 54, BAR_GAP = 10;
  const VW = slice.length * (BAR_W + BAR_GAP) + BAR_GAP;
  const H = 210, PT = 28, PB = 48, CH = H - PT - PB;
  const yOf  = v => PT + CH * (1 - Math.min(v, maxVal) / maxVal);
  const lineY = yOf(line);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className={`text-sm font-black tabular-nums ${goodCnt/slice.length >= 0.6 ? 'text-emerald-400' : goodCnt/slice.length >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
            {goodCnt}/{slice.length} {cat.higherIsBetter ? 'OVER' : 'UNDER'}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-emerald-500/80 inline-block"/>{cat.higherIsBetter ? 'Over' : 'Under'}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-red-500/80 inline-block"/>{cat.higherIsBetter ? 'Under' : 'Over'}</span>
          </div>
        </div>
        <span className="text-xs font-bold text-amber-400">── Line: {line}</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <svg viewBox={`0 0 ${VW} ${H}`} style={{width:'100%', minWidth:Math.min(VW,320)}} preserveAspectRatio="xMidYMid meet">
          {[0.25,0.5,0.75,1].map(pct => {
            const gy = PT + CH * (1 - pct);
            const gv = maxVal * pct;
            return (
              <g key={pct}>
                <line x1={0} y1={gy} x2={VW} y2={gy} stroke="#1f2937" strokeWidth="1"/>
                <text x={2} y={gy-3} fill="#374151" fontSize="9">{Number.isInteger(gv)?gv:''}</text>
              </g>
            );
          })}
          <line x1={0} y1={lineY} x2={VW} y2={lineY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.9"/>
          {slice.map((game, i) => {
            const val   = vals[i];
            const isGood = cat.higherIsBetter ? val > line : val <= line;
            const barX  = i * (BAR_W + BAR_GAP) + BAR_GAP;
            const barH  = Math.max(3, (val / maxVal) * CH);
            const barY  = yOf(val);
            const lblY  = barY > PT + 18 ? barY - 6 : barY + 16;
            const opp   = (game.opponent || '').split(' ').at(-1);
            const resClr = game.isWin ? '#34d399' : game.isLoss ? '#f87171' : '#6b7280';
            const resLbl = game.isWin ? 'W' : game.isLoss ? 'L' : 'ND';
            return (
              <g key={i}>
                <rect x={barX+1} y={barY+1} width={BAR_W} height={barH} rx={5}
                  fill={isGood ? '#16a34a' : val===0 ? '#111827' : '#b91c1c'} opacity="0.3"/>
                <rect x={barX} y={barY} width={BAR_W} height={barH} rx={5}
                  fill={val===0 ? '#1f2937' : isGood ? '#22c55e' : '#ef4444'} opacity="0.88"/>
                {barH > 8 && <rect x={barX+4} y={barY+2} width={BAR_W-8} height={3} rx={2} fill="white" opacity="0.12"/>}
                <text x={barX+BAR_W/2} y={lblY} textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="monospace">{val}</text>
                <text x={barX+BAR_W/2} y={H-PB+14} textAnchor="middle" fill="#6b7280" fontSize="10">{fmtDate(game.date)}</text>
                <text x={barX+BAR_W/2} y={H-PB+26} textAnchor="middle" fill="#4b5563" fontSize="9">{opp ? `@${opp}` : ''}</text>
                <text x={barX+BAR_W/2} y={H-PB+38} textAnchor="middle" fill={resClr} fontSize="9" fontWeight="700">{resLbl}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── Career H2H Matchup Card ─────────────────────────────────────────────────
function H2HMatchupCard({ data, loading, pitcherId, pitcherName, pitcherHand }) {
  if (!pitcherId && !pitcherName) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">⚔️</span>
          <h3 className="text-sm font-bold text-white">Career Head-to-Head</h3>
        </div>
        <p className="text-sm text-gray-600 italic">No probable pitcher found for today.</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">⚔️</span>
          <h3 className="text-sm font-bold text-white">Career Head-to-Head</h3>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg"/>
          <Skeleton className="h-10 w-full rounded-lg"/>
          <Skeleton className="h-10 w-full rounded-lg"/>
        </div>
      </div>
    );
  }

  const batter  = data?.batter;
  const pitcher = data?.pitcher;
  const match   = data?.careerMatchup;
  const hasData = data?.hasData && match;
  const lowSample = hasData && (match.atBats || 0) < 20;

  const displayPitcherName = pitcher?.fullName || pitcherName || '—';
  const displayPitcherHand = pitcher?.pitchHand || pitcherHand;

  const rateStats = hasData ? [
    { l:'AVG',  v: fmt(match.avg,3),  cls: statCls(parseFloat(match.avg)||0,  0.28, 0.25) },
    { l:'OBP',  v: fmt(match.obp,3),  cls: statCls(parseFloat(match.obp)||0,  0.36, 0.32) },
    { l:'SLG',  v: fmt(match.slg,3),  cls: statCls(parseFloat(match.slg)||0,  0.45, 0.38) },
    { l:'OPS',  v: fmt(match.ops,3),  cls: statCls(parseFloat(match.ops)||0,  0.80, 0.70) },
    { l:'wOBA', v: fmt(match.woba,3), cls: statCls(parseFloat(match.woba)||0, 0.37, 0.32) },
  ] : [];

  const countStats = hasData ? [
    { l:'AB',  v: match.atBats      || 0 },
    { l:'H',   v: match.hits        || 0 },
    { l:'1B',  v: match.singles     || 0 },
    { l:'2B',  v: match.doubles     || 0 },
    { l:'3B',  v: match.triples     || 0 },
    { l:'HR',  v: match.homeRuns    || 0 },
    { l:'RBI', v: match.rbi         || 0 },
    { l:'BB',  v: match.baseOnBalls || 0 },
    { l:'K',   v: match.strikeOuts  || 0 },
  ] : [];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-base">⚔️</span>
          <h3 className="text-sm font-bold text-white">Career Head-to-Head</h3>
        </div>
        {hasData && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2.5 py-1 rounded-full tabular-nums">
            {match.atBats} AB · {match.plateAppearances} PA career
          </span>
        )}
      </div>

      {/* Players row */}
      <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-3 mb-5">
        {/* Batter */}
        <div className="flex items-center gap-3">
          <PlayerHeadshot playerId={batter?.id} name={batter?.fullName} size={52}/>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white leading-tight truncate">{batter?.fullName || '—'}</p>
            <p className="text-xs text-gray-500 truncate">{batter?.teamAbbrev}{batter?.position ? ` · ${batter.position}` : ''}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {batter?.batSide && <span className="text-xs text-gray-600">Bats {batter.batSide}</span>}
              {batter?.seasonAvg != null && <span className="text-xs text-blue-400 font-semibold tabular-nums">{fmt(batter.seasonAvg,3)}</span>}
              {batter?.seasonOps != null && <span className="text-xs text-gray-600 tabular-nums">{fmt(batter.seasonOps,3)} OPS</span>}
            </div>
          </div>
        </div>

        {/* VS badge */}
        <div className="flex justify-center">
          <div className="w-11 h-11 rounded-full border-2 border-gray-700 bg-gray-800 flex items-center justify-center shadow-inner">
            <span className="text-xs font-black text-gray-400 tracking-wider">VS</span>
          </div>
        </div>

        {/* Pitcher */}
        <div className="flex items-center gap-3 flex-row-reverse">
          <PlayerHeadshot playerId={pitcher?.id} name={displayPitcherName} size={52}/>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-sm font-bold text-white leading-tight truncate">{displayPitcherName}</p>
            <p className="text-xs text-gray-500 truncate">{pitcher?.teamAbbrev}{displayPitcherHand ? ` · ${displayPitcherHand}HP` : ''}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
              {pitcher?.era != null && <span className={`text-xs font-semibold tabular-nums ${eraCls(pitcher.era).text}`}>{fmt(pitcher.era,2)} ERA</span>}
              {pitcher?.whip != null && <span className="text-xs text-gray-600 tabular-nums">{fmt(pitcher.whip,3)} WHIP</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Section divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-800"/>
        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest whitespace-nowrap">Career Matchup Stats</span>
        <div className="flex-1 h-px bg-gray-800"/>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-600 italic text-center py-3">
          No career matchup history found — these two may not have faced each other yet.
        </p>
      ) : (
        <>
          {lowSample && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <span className="text-amber-400 text-sm">⚠</span>
              <span className="text-xs text-amber-400/80">Small sample ({match.atBats} AB) — interpret with caution</span>
            </div>
          )}

          {/* Rate stats */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {rateStats.map(s => (
              <div key={s.l} className={`rounded-lg border p-3 text-center ${s.cls.bg}`}>
                <div className={`text-sm font-black tabular-nums ${s.cls.text}`}>{s.v}</div>
                <div className="text-xs text-gray-600 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Counting stats */}
          <div className="grid grid-cols-9 gap-1.5">
            {countStats.map(s => (
              <div key={s.l} className="rounded-lg bg-gray-800/50 border border-gray-700/40 py-2.5 text-center">
                <div className="text-sm font-black text-white tabular-nums">{s.v}</div>
                <div className="text-xs text-gray-600">{s.l}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Projection & EV Section ─────────────────────────────────────────────────

class ProjectionErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center">
        <p className="text-sm text-red-400 font-semibold">Projection model error</p>
        <p className="text-xs text-gray-600 mt-1">Could not compute EV — insufficient data for this pitcher.</p>
      </div>
    );
    return this.props.children;
  }
}

function useKProjection(pitcherStarts, seasonStats) {
  return useMemo(() => {
    if (!pitcherStarts?.length) return null;
    const last5  = pitcherStarts.slice(-5);
    const last10 = pitcherStarts.slice(-10);
    const l5Ks = last5.map(s => s.strikeOuts);
    const l5K  = l5Ks.reduce((a,b)=>a+b,0) / l5Ks.length;
    const l5IP = last5.map(s => parseFloat(s.inningsPitched)||0);
    const avgL5IP = Math.max(1, l5IP.reduce((a,b)=>a+b,0) / l5IP.length);
    const k9 = parseFloat(seasonStats?.strikeoutsPer9Inn) || null;
    const seasonK = k9 != null ? k9 / 9 * avgL5IP : null;
    const leagueK = 5.5;
    const projected = l5K * 0.60 + (seasonK ?? leagueK) * 0.30 + leagueK * 0.10;
    const kVals = last10.map(s => s.strikeOuts);
    const kMean = kVals.reduce((a,b)=>a+b,0) / kVals.length;
    const kVar  = kVals.length > 1 ? kVals.reduce((a,v)=>a+(v-kMean)**2,0)/(kVals.length-1) : 4;
    const kStdDev = Math.max(1.2, Math.sqrt(kVar));
    const daysRest   = computeDaysRest(pitcherStarts);
    const restFactor = daysRest != null ? (daysRest < 4 ? 0.95 : daysRest >= 6 ? 1.02 : 1.0) : 1.0;
    const adj      = Math.round(projected * restFactor * 10) / 10;
    const lower80  = Math.max(0, Math.round((adj - 1.28 * kStdDev) * 10) / 10);
    const upper80  = Math.round((adj + 1.28 * kStdDev) * 10) / 10;
    const projectedOuts = Math.round(avgL5IP * 3 * 10) / 10;
    const outLower = Math.max(0, Math.round((avgL5IP - 1.2) * 3));
    const outUpper = Math.round((avgL5IP + 1.2) * 3);
    const confidence = pitcherStarts.length >= 10 ? 'High' : pitcherStarts.length >= 5 ? 'Medium' : 'Low';
    const factorImpacts = [
      { label:'L5 K avg',       impact: Math.round((l5K - leagueK) * 0.60 * 10)/10,                            dir: l5K > leagueK ? '↑' : l5K < leagueK ? '↓' : '—' },
      { label:'Season K/start', impact: seasonK != null ? Math.round((seasonK - leagueK)*0.30*10)/10 : 0,       dir: (seasonK??leagueK) > leagueK ? '↑' : '↓', note: seasonK == null ? 'using L5 only' : null },
      { label:'SwStr% edge',    impact: 0, dir:'—', note:'Savant — coming soon' },
      { label:'Park factor',    impact: 0, dir:'—', note:'Coming soon' },
      { label:'Umpire K/game',  impact: 0, dir:'—', note:'Coming soon' },
      { label:'Rest/weather',   impact: Math.round((restFactor - 1) * projected * 10)/10, dir: restFactor > 1 ? '↑' : restFactor < 1 ? '↓' : '—' },
    ];
    return {
      projected: adj, lower80, upper80, kStdDev: Math.round(kStdDev*10)/10,
      l5K: Math.round(l5K*10)/10, seasonK: seasonK != null ? Math.round(seasonK*10)/10 : null,
      avgL5IP: Math.round(avgL5IP*10)/10, projectedOuts, outLower, outUpper,
      confidence, restFactor, daysRest, l5Ks, l5IPValues: l5IP,
      factorImpacts, hasSeasStats: seasonK != null,
    };
  }, [pitcherStarts, seasonStats]);
}

function PoissonBarChart({ lambda, bookLine }) {
  if (!lambda || lambda <= 0 || !bookLine) return (
    <p className="text-xs text-gray-600 italic text-center py-6">Enter a book line to see distribution.</p>
  );
  const maxK  = Math.max(14, Math.ceil(lambda * 2.2));
  const probs = Array.from({length: maxK+1}, (_, k) => poissonPMF(k, lambda));
  const maxP  = Math.max(...probs, 0.001);
  const floor = Math.floor(bookLine);
  const pOver = 1 - poissonCDF(floor, lambda);
  const pUnder = poissonCDF(floor, lambda);
  const W=310, H=165, PB=28, PT=22, PL=8, PR=8;
  const CH=H-PB-PT, CW=W-PL-PR;
  const gap=1, barW=Math.max(10, CW/(maxK+1) - gap);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%'}}>
      <text x={W*0.28} y={13} textAnchor="middle" fill="#60a5fb" fontSize="8.5" fontWeight="700">P(Under) {(pUnder*100).toFixed(1)}%</text>
      <text x={W*0.72} y={13} textAnchor="middle" fill="#f59e0b" fontSize="8.5" fontWeight="700">P(Over) {(pOver*100).toFixed(1)}%</text>
      {probs.map((p, k) => {
        const x = PL + k * (barW + gap);
        const bH = Math.max(2, (p / maxP) * CH);
        return <rect key={k} x={x} y={PT+CH-bH} width={barW} height={bH} rx={2} fill={k > floor ? '#f59e0b' : '#3b82f6'} opacity="0.85"/>;
      })}
      <line x1={PL+(floor+1)*(barW+gap)-gap/2} y1={PT-4} x2={PL+(floor+1)*(barW+gap)-gap/2} y2={H-PB+4}
        stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2"/>
      {probs.map((_, k) => k%2===0 && (
        <text key={k} x={PL+k*(barW+gap)+barW/2} y={H-PB+14} textAnchor="middle" fill="#6b7280" fontSize="7.5">{k}</text>
      ))}
      <text x={W/2} y={H} textAnchor="middle" fill="#374151" fontSize="7.5">Strikeouts</text>
    </svg>
  );
}

function EVGaugeSVG({ evPct }) {
  const v    = isNaN(evPct) ? 0 : Math.max(-15, Math.min(15, evPct));
  const norm = (v + 15) / 30;
  const W=160, H=92, cx=80, cy=84, R=62, sw=16;
  const d2r = deg => deg * Math.PI / 180;
  const sweepDeg = norm * 180;
  const sx = cx + R * Math.cos(d2r(180)), sy = cy + R * Math.sin(d2r(180));
  const ex = cx + R * Math.cos(d2r(180+sweepDeg)), ey = cy + R * Math.sin(d2r(180+sweepDeg));
  const col = v > 5 ? '#10b981' : v > 2 ? '#eab308' : v > -2 ? '#6b7280' : '#ef4444';
  const lbl = `${evPct >= 0 ? '+' : ''}${(evPct||0).toFixed(1)}%`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
      <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`} fill="none" stroke="#1f2937" strokeWidth={sw} strokeLinecap="round"/>
      {sweepDeg > 0.5 && (
        <path d={`M ${sx} ${sy} A ${R} ${R} 0 ${sweepDeg>180?1:0} 1 ${ex} ${ey}`} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round"/>
      )}
      <text x={cx} y={cy-28} textAnchor="middle" fontSize="22" fontWeight="900" fill={col} fontFamily="monospace">{lbl}</text>
      <text x={cx} y={cy-12} textAnchor="middle" fontSize="9" fill="#6b7280">EV%</text>
      <text x={cx-R-2} y={cy+16} textAnchor="end"   fontSize="8" fill="#374151">-15%</text>
      <text x={cx+R+2} y={cy+16} textAnchor="start" fontSize="8" fill="#374151">+15%</text>
    </svg>
  );
}

function ProjectionEVCard({ pitcherStarts, seasonStats }) {
  const [bookLine,  setBookLine]  = useState('');
  const [overOdds,  setOverOdds]  = useState('-115');
  const [underOdds, setUnderOdds] = useState('-115');
  const [debLine,   setDebLine]   = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebLine(bookLine), 300);
    return () => clearTimeout(t);
  }, [bookLine]);

  const proj   = useKProjection(pitcherStarts, seasonStats);
  const line   = parseFloat(debLine) || null;
  const oOdds  = parseInt(overOdds)  || -115;
  const uOdds  = parseInt(underOdds) || -115;

  const evResult = useMemo(() => {
    if (!proj || !line) return null;
    const floor  = Math.floor(line);
    const pOver  = 1 - poissonCDF(floor, proj.projected);
    const pUnder = poissonCDF(floor, proj.projected);
    const rawO = americanToDecimal(oOdds), rawU = americanToDecimal(uOdds);
    const tot  = rawO + rawU;
    return { pOver, pUnder, evOver:(pOver-rawO/tot)*100, evUnder:(pUnder-rawU/tot)*100 };
  }, [proj, line, oOdds, uOdds]);

  if (!proj) return (
    <div className="rounded-xl border border-gray-800 bg-[#0f1117] p-6 text-center">
      <p className="text-sm text-gray-600 italic">Need 3+ starts to compute a projection.</p>
    </div>
  );

  const confColor = proj.confidence === 'High' ? 'text-emerald-400' : proj.confidence === 'Medium' ? 'text-yellow-400' : 'text-red-400';
  const evBadge = evResult ? (() => {
    const ev = evResult.evOver;
    if (ev > 6)  return { label:'Strong Value',  cls:'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' };
    if (ev > 3)  return { label:'Moderate Edge', cls:'bg-yellow-500/20  border-yellow-500/40  text-yellow-400'  };
    if (ev > 1)  return { label:'Slight Edge',   cls:'bg-gray-700/50    border-gray-600        text-gray-400'   };
    return             { label:'No Value',       cls:'bg-red-500/10     border-red-500/30      text-red-400'    };
  })() : null;

  return (
    <div className="rounded-xl border border-gray-700/50 bg-[#0f1117] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎰</span>
          <div>
            <h3 className="text-sm font-black text-white">Projection & EV%</h3>
            <p className="text-xs text-gray-600">Strikeout prop model · ProprStats</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold ${confColor}`}>Confidence: {proj.confidence}</span>
          {evBadge && <span className={`text-xs font-bold border rounded-full px-2.5 py-1 ${evBadge.cls}`}>{evBadge.label}</span>}
        </div>
      </div>

      {/* Top 4 tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border bg-blue-500/10 border-blue-500/30 p-3 text-center">
          <div className="text-xl font-black text-blue-400 tabular-nums">{proj.projected.toFixed(1)}</div>
          <div className="text-xs text-gray-600 mt-0.5">Projected Ks</div>
        </div>
        <div className="rounded-lg border bg-gray-800/50 border-gray-700 p-3 text-center">
          <div className="text-sm font-black text-gray-300 tabular-nums">{proj.lower80} – {proj.upper80}</div>
          <div className="text-xs text-gray-600 mt-0.5">80% Range</div>
        </div>
        <div className="rounded-lg border bg-gray-800/50 border-gray-700 p-3 text-center">
          <input type="number" step="0.5" placeholder="e.g. 5.5" value={bookLine}
            onChange={e => setBookLine(e.target.value)}
            className="w-full bg-transparent text-center text-base font-black text-white tabular-nums outline-none placeholder-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
          <div className="text-xs text-gray-600 mt-0.5">Book Line ↑ type here</div>
        </div>
        <div className={`rounded-lg border p-3 text-center ${evBadge ? evBadge.cls : 'bg-gray-800/50 border-gray-700'}`}>
          <div className={`text-xl font-black tabular-nums ${evBadge ? '' : 'text-gray-600'}`}>
            {evResult ? `${evResult.evOver>=0?'+':''}${evResult.evOver.toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">EV Signal</div>
        </div>
      </div>

      {/* 3-column main section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
        {/* Col 1 — Poisson distribution */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">K Distribution (Poisson)</p>
          <PoissonBarChart lambda={proj.projected} bookLine={line || (proj.projected + 0.5)}/>
          {!line && <p className="text-xs text-gray-700 italic mt-1 text-center">Enter a book line for probabilities</p>}
        </div>

        {/* Col 2 — EV gauge */}
        <div className="flex flex-col items-center">
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">EV% Gauge</p>
          <EVGaugeSVG evPct={evResult?.evOver ?? 0}/>
          {evResult ? (
            <div className="flex gap-2 mt-2 flex-wrap justify-center">
              <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${evResult.evOver>0?'text-emerald-400 border-emerald-500/30 bg-emerald-500/10':'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                Over {evResult.evOver>=0?'+':''}{evResult.evOver.toFixed(1)}%
              </span>
              <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${evResult.evUnder>0?'text-emerald-400 border-emerald-500/30 bg-emerald-500/10':'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                Under {evResult.evUnder>=0?'+':''}{evResult.evUnder.toFixed(1)}%
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-700 italic mt-3 text-center">Enter line & odds for EV%</p>
          )}
          <p className="text-xs text-gray-700 mt-3 text-center leading-relaxed px-2">
            EV% measures edge vs book. <span className="text-emerald-700">EV &gt; 5% = strong value.</span>
          </p>
        </div>

        {/* Col 3 — Factor breakdown */}
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Factor Breakdown</p>
          <table className="w-full text-xs">
            <tbody>
              {proj.factorImpacts.map((f, i) => (
                <tr key={i} className="border-b border-gray-800/40">
                  <td className="py-1.5 text-gray-500">{f.label}</td>
                  <td className={`py-1.5 text-right tabular-nums ${f.note ? 'text-gray-700 italic' : f.impact > 0 ? 'text-emerald-400' : f.impact < 0 ? 'text-red-400' : 'text-gray-600'}`}>
                    {f.note ? f.note : f.impact !== 0 ? `${f.impact>0?'+':''}${f.impact.toFixed(1)} K` : '—'}
                  </td>
                  <td className={`py-1.5 pl-2 text-right font-bold ${f.dir==='↑'?'text-emerald-400':f.dir==='↓'?'text-red-400':'text-gray-600'}`}>
                    {f.note ? '' : f.dir}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-700">
                <td className="py-2 font-black text-white">Projected total</td>
                <td className="py-2 text-right font-black text-blue-400 tabular-nums">{proj.projected.toFixed(1)} K</td>
                <td className="py-2 pl-2 text-right text-gray-600">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Odds input row */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 mb-4">
        <p className="text-xs text-gray-600 mb-2">Enter sportsbook odds for accurate EV%:</p>
        <div className="flex flex-wrap items-center gap-3">
          {[
            { label:'Over line', val:bookLine,  set:setBookLine,  step:'0.5', ph:'5.5'  },
            { label:'Over odds', val:overOdds,  set:setOverOdds,  step:'1',   ph:'-115' },
            { label:'Under odds',val:underOdds, set:setUnderOdds, step:'1',   ph:'-105' },
          ].map(inp => (
            <label key={inp.label} className="flex items-center gap-1.5 text-xs text-gray-500">
              {inp.label}:
              <input type="number" step={inp.step} value={inp.val} placeholder={inp.ph}
                onChange={e => inp.set(e.target.value)}
                className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white text-center tabular-nums outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
            </label>
          ))}
        </div>
      </div>

      {/* Projected Outs section */}
      <div className="rounded-lg border border-gray-800/60 bg-gray-900/30 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Projected Outs (IP × 3)</p>
          <p className="text-xs text-gray-600 tabular-nums">{proj.outLower} – {proj.outUpper} range</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-lg font-black text-blue-400 tabular-nums">{proj.avgL5IP}</div>
            <div className="text-xs text-gray-600">Proj IP</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-black text-white tabular-nums">{proj.projectedOuts}</div>
            <div className="text-xs text-gray-600">Proj Outs</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 mb-1">L5 IP per start</p>
            <div className="flex items-end gap-1 h-8">
              {proj.l5IPValues.map((ip, i) => {
                const maxIP = Math.max(...proj.l5IPValues, 1);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <div className="w-full rounded-sm bg-blue-500/60" style={{height:`${(ip/maxIP)*100}%`, minHeight:'4px'}}/>
                    <span className="text-xs text-gray-700 tabular-nums leading-none">{ip.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {proj.avgL5IP < 5 && (
          <p className="text-xs text-amber-500/80 italic mt-2">⚠ Averaging &lt;5 IP — factor in bullpen usage for outs props.</p>
        )}
      </div>
    </div>
  );
}

// ─── Game Log Detail Table ────────────────────────────────────────────────────
function GameLogTable({ games, cat, loading }) {
  if (loading) return (
    <div className="space-y-2">{[1,2,3,4,5].map(i=><Skeleton key={i} className="h-8 w-full"/>)}</div>
  );
  const last10 = games.slice(-10).reverse();
  if (!last10.length) return <p className="text-sm text-gray-600 italic">No game log data available.</p>;

  const colDefs = {
    hits: ['Date','Opp','PA','AB','H','2B','HR','BB','K','AVG'],
    runs: ['Date','Opp','PA','R','RBI','BB','K'],
    rbi:  ['Date','Opp','PA','AB','H','RBI','BB','K'],
    hr:   ['Date','Opp','PA','AB','H','HR','BB','K'],
    sb:   ['Date','Opp','PA','AB','H','SB','BB','K'],
  };
  const cols     = colDefs[cat] || colDefs.hits;
  const keyCol   = { hits:'H', runs:'R', rbi:'RBI', hr:'HR', sb:'SB' }[cat] || 'H';
  const keyField = { hits:'hits', runs:'runs', rbi:'rbi', hr:'homeRuns', sb:'stolenBases' }[cat] || 'hits';

  const getVal = (g, col) => {
    if (col==='Date') return fmtDate(g.date);
    if (col==='Opp')  return (g.opponent||'').split(' ').at(-1) || '—';
    if (col==='PA')   return g.plateAppearances ?? '—';
    if (col==='AB')   return g.atBats ?? '—';
    if (col==='H')    return g.hits    ?? 0;
    if (col==='2B')   return g.doubles ?? 0;
    if (col==='HR')   return g.homeRuns ?? 0;
    if (col==='BB')   return g.baseOnBalls ?? 0;
    if (col==='K')    return g.strikeOuts  ?? 0;
    if (col==='RBI')  return g.rbi ?? 0;
    if (col==='R')    return g.runs ?? 0;
    if (col==='SB')   return g.stolenBases ?? 0;
    if (col==='AVG') {
      const ab = g.atBats || 0, h = g.hits || 0;
      return ab > 0 ? `.${Math.round(h/ab*1000).toString().padStart(3,'0')}` : '—';
    }
    return '—';
  };

  const keyCls = (col, rawVal) => {
    if (col !== keyCol) return null;
    const n = Number(rawVal) || 0;
    if (cat === 'hr' || cat === 'sb') return n >= 1 ? 'text-emerald-400 font-black' : 'text-red-400';
    return n >= 2 ? 'text-emerald-400 font-black' : n >= 1 ? 'text-yellow-400 font-bold' : 'text-red-400';
  };

  const keyVals = last10.map(g => Number(g[keyField]) || 0);
  const keyAvg  = keyVals.reduce((a,b)=>a+b,0) / keyVals.length;
  const hitRate = cat === 'hits' ? keyVals.filter(v=>v>=1).length : null;
  const hrRate  = cat === 'hr'   ? keyVals.filter(v=>v>=1).length : null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="border-b border-gray-800">
              {cols.map(c => (
                <th key={c} className={`py-2 font-semibold whitespace-nowrap ${
                  c==='Date'||c==='Opp' ? 'text-left pr-3 text-gray-600' : `text-center px-2 ${c===keyCol ? 'text-blue-400' : 'text-gray-600'}`
                }`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {last10.map((g, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                {cols.map(c => {
                  const val   = getVal(g, c);
                  const extra = keyCls(c, val);
                  return (
                    <td key={c} className={`py-2 tabular-nums whitespace-nowrap ${
                      c==='Date'||c==='Opp' ? 'pr-3 text-gray-500' : `px-2 text-center ${extra || 'text-white'}`
                    }`}>{String(val)}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800/60 flex flex-wrap gap-4">
        <span className="text-xs text-gray-600">{keyCol} avg (L10): <span className="text-white font-bold tabular-nums">{keyAvg.toFixed(2)}</span></span>
        {hitRate !== null && (
          <span className="text-xs text-gray-600">Hit rate: <span className={`font-bold tabular-nums ${hitRate>=7?'text-emerald-400':hitRate>=5?'text-yellow-400':'text-red-400'}`}>{hitRate}/10 games</span></span>
        )}
        {hrRate !== null && (
          <span className="text-xs text-gray-600">HR rate: <span className={`font-bold tabular-nums ${hrRate>=3?'text-emerald-400':hrRate>=1?'text-yellow-400':'text-gray-600'}`}>{hrRate}/10 games</span></span>
        )}
        {cat === 'rbi' && <span className="text-xs text-gray-700 italic">RBI is lineup-dependent — see Lineup Position card</span>}
      </div>
    </div>
  );
}

// ─── Park Factors lookup (Baseball Reference 2024/2025 avg) ──────────────────
const PARK_FACTORS = {
  NYY:{ name:'Yankee Stadium',     hits:1.01, hr:1.18, runs:1.04, k:0.99 },
  BOS:{ name:'Fenway Park',        hits:1.05, hr:0.97, runs:1.06, k:0.97 },
  BAL:{ name:'Camden Yards',       hits:1.02, hr:1.10, runs:1.05, k:0.98 },
  TBR:{ name:'Tropicana Field',    hits:0.97, hr:0.93, runs:0.96, k:1.02 },
  TOR:{ name:'Rogers Centre',      hits:1.00, hr:1.08, runs:1.02, k:1.00 },
  CLE:{ name:'Progressive Field',  hits:0.99, hr:1.00, runs:0.98, k:1.01 },
  CWS:{ name:'Guaranteed Rate Fld',hits:1.00, hr:1.05, runs:1.01, k:1.00 },
  DET:{ name:'Comerica Park',      hits:0.97, hr:0.88, runs:0.96, k:1.03 },
  KCR:{ name:'Kauffman Stadium',   hits:1.03, hr:0.95, runs:1.01, k:0.99 },
  MIN:{ name:'Target Field',       hits:0.99, hr:0.96, runs:0.98, k:1.01 },
  HOU:{ name:'Minute Maid Park',   hits:1.00, hr:1.06, runs:1.03, k:1.00 },
  LAA:{ name:'Angel Stadium',      hits:0.99, hr:0.97, runs:0.98, k:1.01 },
  OAK:{ name:'Oakland Coliseum',   hits:0.96, hr:0.88, runs:0.94, k:1.04 },
  SEA:{ name:'T-Mobile Park',      hits:0.96, hr:0.91, runs:0.95, k:1.04 },
  TEX:{ name:'Globe Life Field',   hits:1.02, hr:1.12, runs:1.06, k:0.97 },
  ATL:{ name:'Truist Park',        hits:1.01, hr:1.05, runs:1.03, k:0.99 },
  MIA:{ name:'loanDepot Park',     hits:0.94, hr:0.84, runs:0.91, k:1.06 },
  NYM:{ name:'Citi Field',         hits:0.97, hr:0.93, runs:0.96, k:1.03 },
  PHI:{ name:'Citizens Bank Park', hits:1.02, hr:1.10, runs:1.05, k:0.98 },
  WSN:{ name:'Nationals Park',     hits:1.01, hr:1.04, runs:1.02, k:0.99 },
  CHC:{ name:'Wrigley Field',      hits:1.02, hr:1.06, runs:1.04, k:0.98 },
  CIN:{ name:'Great American BP',  hits:1.06, hr:1.15, runs:1.08, k:0.96 },
  MIL:{ name:'American Family Fld',hits:0.99, hr:0.97, runs:0.98, k:1.01 },
  PIT:{ name:'PNC Park',           hits:0.98, hr:0.93, runs:0.96, k:1.02 },
  STL:{ name:'Busch Stadium',      hits:1.00, hr:0.96, runs:0.99, k:1.00 },
  ARI:{ name:'Chase Field',        hits:1.03, hr:1.07, runs:1.05, k:0.97 },
  COL:{ name:'Coors Field',        hits:1.14, hr:1.19, runs:1.18, k:0.94 },
  LAD:{ name:'Dodger Stadium',     hits:0.97, hr:0.94, runs:0.96, k:1.03 },
  SDP:{ name:'Petco Park',         hits:0.95, hr:0.88, runs:0.93, k:1.05 },
  SFG:{ name:'Oracle Park',        hits:0.97, hr:0.88, runs:0.95, k:1.04 },
};

function ParkFactorCard({ spTeamAbbrev, spOppAbbrev, spIsHome, activeCat }) {
  const homeAbbrev = spIsHome ? spTeamAbbrev : spOppAbbrev;
  const park = homeAbbrev ? PARK_FACTORS[homeAbbrev] : null;

  if (!park) return (
    <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🏟️</span>
        <h3 className="text-sm font-bold text-gray-500">Park Factor</h3>
      </div>
      <p className="text-xs text-gray-700">Park factor data unavailable — team info not found for this game.</p>
    </div>
  );

  const rows = [
    { prop:'Hits',       val: park.hits, cat:'hits' },
    { prop:'Home Runs',  val: park.hr,   cat:'hr'   },
    { prop:'Runs',       val: park.runs, cat:'runs'  },
    { prop:'Strikeouts', val: park.k,    cat:'k'    },
  ];
  const favors   = v => v >= 1.03 ? 'Hitter' : v <= 0.97 ? 'Pitcher' : 'Neutral';
  const favorCls = v => v >= 1.03
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : v <= 0.97
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : 'text-gray-400 bg-gray-800/50 border-gray-700';
  const valCls   = v => v >= 1.03 ? 'text-emerald-400' : v <= 0.97 ? 'text-red-400' : 'text-gray-400';
  const pctStr   = v => `${v >= 1 ? '+' : ''}${Math.round((v-1)*100)}%`;

  const catParkVal   = activeCat === 'hits' ? park.hits : activeCat === 'hr' ? park.hr : activeCat === 'runs' ? park.runs : null;
  const catPropLabel = activeCat === 'hits' ? 'hits' : activeCat === 'hr' ? 'home runs' : activeCat === 'runs' ? 'runs' : null;
  const overallChar  = (park.hits >= 1.04 || park.hr >= 1.08) ? "hitter's" : (park.hits <= 0.96 || park.hr <= 0.92) ? "pitcher's" : 'neutral';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🏟️</span>
        <h3 className="text-sm font-bold text-white">Park Factor</h3>
        <span className="ml-auto text-xs text-gray-600 truncate max-w-[140px]">{park.name}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800">
              {['Prop','Factor','vs Lg','Favors'].map(h => (
                <th key={h} className={`py-2 font-semibold text-gray-600 ${h==='Prop'?'text-left':'text-center px-2'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.prop} className={`border-b border-gray-800/50 ${r.cat === activeCat ? 'bg-blue-500/5' : ''}`}>
                <td className={`py-2 font-medium ${r.cat === activeCat ? 'text-blue-400' : 'text-gray-400'}`}>{r.prop}</td>
                <td className={`py-2 px-2 text-center font-black tabular-nums ${valCls(r.val)}`}>{r.val.toFixed(2)}</td>
                <td className={`py-2 px-2 text-center font-bold tabular-nums ${valCls(r.val)}`}>{pctStr(r.val)}</td>
                <td className="py-2 px-2 text-center">
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-bold ${favorCls(r.val)}`}>{favors(r.val)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {catParkVal != null && catPropLabel && (
        <p className="mt-3 text-xs text-gray-500 leading-relaxed pt-2 border-t border-gray-800/60">
          <span className="text-gray-400">{park.name}</span> is a{' '}
          <span className={`font-bold ${catParkVal >= 1.03 ? 'text-emerald-400' : catParkVal <= 0.97 ? 'text-red-400' : 'text-gray-400'}`}>{overallChar} park</span>{' '}
          for {catPropLabel}, historically{' '}
          {catParkVal >= 1.03 ? 'boosting' : catParkVal <= 0.97 ? 'suppressing' : 'not significantly affecting'}{' '}
          {catPropLabel} by <span className="font-bold tabular-nums">{pctStr(catParkVal)}</span> vs league avg.
        </p>
      )}
    </div>
  );
}

function LineupPositionCard({ games, loading }) {
  if (loading) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📍</span>
        <h3 className="text-sm font-bold text-white">Lineup Position</h3>
      </div>
      <div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-8 w-full"/>)}</div>
    </div>
  );

  const bOrders = games.slice(-10)
    .map(g => g.battingOrder ? Math.ceil(parseInt(g.battingOrder) / 100) : null)
    .filter(v => v != null && v >= 1 && v <= 9);
  const avgSlot = bOrders.length ? Math.round(bOrders.reduce((a,b)=>a+b,0)/bOrders.length) : null;
  const slotLabel = s => !s ? '' : s <= 2 ? 'Table setter' : s <= 5 ? 'Run producer' : 'Bottom order';
  const slotCls   = s => !s ? 'text-gray-500' : s <= 2 ? 'text-blue-400' : s <= 5 ? 'text-emerald-400' : 'text-gray-400';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📍</span>
        <h3 className="text-sm font-bold text-white">Lineup Position</h3>
      </div>
      {avgSlot ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 bg-gray-800/50 font-black text-xl tabular-nums flex-shrink-0 ${avgSlot<=2?'border-blue-500/40 text-blue-400':avgSlot<=5?'border-emerald-500/40 text-emerald-400':'border-gray-700 text-gray-400'}`}>
              #{avgSlot}
            </div>
            <div>
              <p className={`text-sm font-bold ${slotCls(avgSlot)}`}>{slotLabel(avgSlot)}</p>
              <p className="text-xs text-gray-600">L10 avg batting slot</p>
            </div>
          </div>
          <div className="flex items-center gap-1 mb-2">
            {[1,2,3,4,5,6,7,8,9].map(s => (
              <div key={s} className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs font-black tabular-nums ${
                s===avgSlot ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-800/60 text-gray-700 border border-gray-800'
              }`}>{s}</div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-700 mb-3 px-0.5">
            <span>Setters</span><span>Producers</span><span>Bottom</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed pt-2 border-t border-gray-800/60">
            Batting <span className="font-bold text-white">#{avgSlot}</span>{' '}
            {avgSlot<=2 ? 'offers high plate appearances but fewer RBI spots.'
              : avgSlot<=5 ? 'maximizes RBI opportunity with runners expected on base ahead.'
              : 'means fewer PA but lineup context can still create RBI chances.'}
          </p>
        </>
      ) : (
        <div className="text-center py-2">
          <div className="flex items-center gap-1 mb-4">
            {[1,2,3,4,5,6,7,8,9].map(s => (
              <div key={s} className="flex-1 h-7 rounded-md flex items-center justify-center text-xs font-bold text-gray-800 bg-gray-800/30 border border-gray-800/30">{s}</div>
            ))}
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-800 rounded-full px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse"/>
            Posts ~3h Before Game
          </span>
          <p className="text-xs text-gray-700 mt-2 leading-relaxed">Batting order affects R and RBI potential. Check back closer to first pitch.</p>
        </div>
      )}
    </div>
  );
}

// ─── Hitting Projection Models ────────────────────────────────────────────────
const LG = { avg:0.243, obp:0.317, slg:0.413, era:4.50, barrel:8.2, xwoba:0.315 };
const SLOT_FACTORS = {1:1.18,2:1.12,3:1.05,4:1.02,5:0.98,6:0.93,7:0.88,8:0.82,9:0.78};

function buildHittingCtx(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev) {
  const seasonAVG = parseFloat(seasonStats?.avg)  || LG.avg;
  const seasonOBP = parseFloat(seasonStats?.obp)  || LG.obp;
  const seasonSLG = parseFloat(seasonStats?.slg)  || LG.slg;
  const seasonPA  = Math.max(1, parseInt(seasonStats?.plateAppearances) || 1);
  const seasonGP  = Math.max(1, parseInt(seasonStats?.gamesPlayed) || 1);
  const avgPA     = Math.min(5.0, Math.max(3.0, seasonPA / seasonGP));
  const L5 = gameLog.slice(-5), L10 = gameLog.slice(-10);

  const safeAvg = (games, fb) => {
    const ab = games.reduce((a,g)=>a+(Number(g.atBats)||0),0);
    const h  = games.reduce((a,g)=>a+(Number(g.hits)||0),0);
    return ab >= 8 ? h/ab : fb;
  };
  const l5Avg  = safeAvg(L5,  seasonAVG);
  const l10Avg = safeAvg(L10, seasonAVG);

  const pitcherERA = parseFloat(pitcher?.stats?.era) || LG.era;
  const pitcherAdj = -(pitcherERA - LG.era) * 0.012;

  const relSplit  = spPitcherHand === 'L' ? splits?.vsLeftHandedPitching : splits?.vsRightHandedPitching;
  const splitAVG  = parseFloat(relSplit?.avg) || null;
  const splitOBP  = parseFloat(relSplit?.obp) || null;
  const splitSLG  = parseFloat(relSplit?.slg) || null;
  const handFactor = splitAVG && seasonAVG > 0
    ? Math.max(0.75, Math.min(1.25, splitAVG / seasonAVG)) : 1.0;

  const homeAbbrev = spIsHome ? spTeamAbbrev : spOppAbbrev;
  const park = homeAbbrev ? PARK_FACTORS[homeAbbrev] : null;

  const xwobaFactor = statcast?.xwoba
    ? Math.min(1.10, Math.max(0.90, statcast.xwoba / LG.xwoba)) : 1.0;
  const barrelPct = statcast?.barrelPct || LG.barrel;
  const powerEdge = 1 + ((barrelPct - LG.barrel) / LG.barrel * 0.5);

  const avgSlot = (() => {
    const orders = L10.map(g => g.battingOrder ? Math.ceil(parseInt(g.battingOrder)/100) : null).filter(v=>v&&v>=1&&v<=9);
    return orders.length ? Math.round(orders.reduce((a,b)=>a+b,0)/orders.length) : null;
  })();

  return {
    seasonAVG, seasonOBP, seasonSLG, seasonPA, seasonGP, avgPA,
    L5, L10, l5Avg, l10Avg,
    pitcherERA, pitcherAdj,
    relSplit, splitAVG, splitOBP, splitSLG, handFactor,
    homeAbbrev, park,
    xwobaFactor, barrelPct, powerEdge,
    avgSlot,
  };
}

function l10StdDev(vals, fallback) {
  if (vals.length < 2) return fallback;
  const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
  const v    = vals.reduce((a,x)=>a+(x-mean)**2,0)/(vals.length-1);
  return Math.max(fallback, Math.sqrt(v));
}

function useHitsProjection(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev) {
  return useMemo(() => {
    if (!gameLog.length && !seasonStats) return null;
    const c = buildHittingCtx(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
    const batterAvg = c.l5Avg * 0.50 + c.l10Avg * 0.30 + c.seasonAVG * 0.20;
    const proj = Math.max(0.1,
      batterAvg * (1 + c.pitcherAdj) * c.handFactor * (c.park?.hits || 1.0) * c.avgPA * c.xwobaFactor
    );
    const std = l10StdDev(c.L10.map(g=>Number(g.hits)||0), 0.6);
    const adj = Math.round(proj*10)/10;
    return {
      projected: adj,
      lower80: Math.max(0, Math.round((adj - 1.28*std)*10)/10),
      upper80: Math.round((adj + 1.28*std)*10)/10,
      stdDev: Math.round(std*10)/10,
      factorImpacts: [
        { label:'L5/L10 batting avg',   impact:Math.round((batterAvg - c.seasonAVG)*c.avgPA*10)/10, dir:batterAvg>c.seasonAVG?'↑':'↓' },
        { label:'Pitcher ERA adj',      impact:Math.round(c.pitcherAdj*adj*10)/10,                  dir:c.pitcherAdj>=0?'↑':'↓' },
        { label:`${spPitcherHand||'?'}HP split`, impact:Math.round((c.handFactor-1)*adj*10)/10,    dir:c.handFactor>1?'↑':'↓', note:!c.splitAVG?'no split data':null },
        { label:'Park hit factor',      impact:Math.round(((c.park?.hits||1)-1)*adj*10)/10,         dir:(c.park?.hits||1)>1?'↑':'↓', note:!c.park?'no data':null },
        { label:'xwOBA form',           impact:Math.round((c.xwobaFactor-1)*adj*10)/10,             dir:c.xwobaFactor>=1?'↑':'↓', note:!statcast?.xwoba?'no Statcast':null },
      ],
    };
  }, [gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev]);
}

function useHRProjection(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev) {
  return useMemo(() => {
    if (!gameLog.length && !seasonStats) return null;
    const c = buildHittingCtx(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
    const seasonHR   = parseInt(seasonStats?.homeRuns) || 0;
    const seasonHRpa = seasonHR / Math.max(1, c.seasonPA);
    const L10HR = c.L10.map(g=>Number(g.homeRuns)||0);
    const L10PA = c.L10.map(g=>Number(g.plateAppearances)||c.avgPA);
    const l10HRpa = L10PA.reduce((a,b)=>a+b,0) > 0
      ? L10HR.reduce((a,b)=>a+b,0) / L10PA.reduce((a,b)=>a+b,0) : seasonHRpa;
    const hrRate = l10HRpa * 0.50 + seasonHRpa * 0.40 + seasonHRpa * 0.9 * 0.10;
    const pitcherHRAdj = (c.pitcherERA - LG.era) * 0.04;
    const hrHandFactor = c.splitSLG && c.seasonSLG > 0
      ? Math.max(0.70, Math.min(1.30, c.splitSLG / c.seasonSLG)) : 1.0;
    const parkHR = c.park?.hr || 1.0;
    const adjRate = Math.max(0.001, hrRate * c.powerEdge * (1 + pitcherHRAdj) * hrHandFactor * parkHR);
    const lambda  = adjRate * c.avgPA;
    const pHR     = 1 - Math.exp(-lambda);
    return {
      projected: Math.round(lambda*100)/100,
      pHR: Math.round(pHR*1000)/10,
      lower80: 0, upper80: Math.round(lambda*2*10)/10,
      stdDev: Math.round(Math.sqrt(lambda)*10)/10,
      isBernoulli: true,
      factorImpacts: [
        { label:'L10 HR rate',           impact:Math.round((l10HRpa-seasonHRpa)*c.avgPA*100)/100, dir:l10HRpa>seasonHRpa?'↑':'↓' },
        { label:'Barrel% power edge',    impact:Math.round((c.powerEdge-1)*lambda*100)/100,       dir:c.powerEdge>=1?'↑':'↓', note:!statcast?.barrelPct?'no Statcast':null },
        { label:'Pitcher HR tendency',   impact:Math.round(pitcherHRAdj*lambda*100)/100,          dir:pitcherHRAdj>=0?'↑':'↓' },
        { label:`${spPitcherHand||'?'}HP SLG split`, impact:Math.round((hrHandFactor-1)*lambda*100)/100, dir:hrHandFactor>=1?'↑':'↓', note:!c.splitSLG?'no split data':null },
        { label:'Park HR factor',        impact:Math.round((parkHR-1)*lambda*100)/100,            dir:parkHR>=1?'↑':'↓', note:!c.park?'no data':null },
      ],
    };
  }, [gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev]);
}

function useRunsProjection(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev) {
  return useMemo(() => {
    if (!gameLog.length && !seasonStats) return null;
    const c = buildHittingCtx(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
    const seasonR   = parseInt(seasonStats?.runs) || 0;
    const seasonRpg = seasonR / c.seasonGP;
    const L10R  = c.L10.map(g=>Number(g.runs)||0);
    const l10Rpg = L10R.reduce((a,b)=>a+b,0) / Math.max(L10R.length,1);
    const L10H  = c.L10.reduce((a,g)=>a+(Number(g.hits)||0),0);
    const L10BB = c.L10.reduce((a,g)=>a+(Number(g.baseOnBalls)||0),0);
    const L10PA = c.L10.reduce((a,g)=>a+(Number(g.plateAppearances)||0),0);
    const l10OBP = L10PA > 15 ? (L10H+L10BB)/L10PA : c.seasonOBP;
    const obpW = c.splitOBP
      ? c.splitOBP*0.40 + l10OBP*0.35 + c.seasonOBP*0.25
      : l10OBP*0.50 + c.seasonOBP*0.50;
    const teamRunEnv = c.park?.runs || 1.0;
    const slotFactor = c.avgSlot ? (SLOT_FACTORS[c.avgSlot]||1.0) : 1.0;
    const pitcherRunAdj = Math.max(0.75, 1-(c.pitcherERA-LG.era)*0.05);
    const rateProj = l10Rpg*0.50 + seasonRpg*0.40 + 0.45*0.10;
    const proj = Math.max(0.05, rateProj * pitcherRunAdj * teamRunEnv * slotFactor);
    const std = l10StdDev(L10R, 0.5);
    const adj = Math.round(proj*10)/10;
    return {
      projected: adj,
      lower80: Math.max(0, Math.round((adj-1.28*std)*10)/10),
      upper80: Math.round((adj+1.28*std)*10)/10,
      stdDev: Math.round(std*10)/10,
      factorImpacts: [
        { label:'L10 R/game avg',     impact:Math.round((l10Rpg-seasonRpg)*10)/10,          dir:l10Rpg>seasonRpg?'↑':'↓' },
        { label:'OBP on-base opp',    impact:Math.round((obpW-c.seasonOBP)*adj*10)/10,       dir:obpW>c.seasonOBP?'↑':'↓' },
        { label:'Pitcher quality',    impact:Math.round((pitcherRunAdj-1)*adj*10)/10,        dir:pitcherRunAdj>=1?'↑':'↓' },
        { label:'Park run factor',    impact:Math.round((teamRunEnv-1)*adj*10)/10,           dir:teamRunEnv>=1?'↑':'↓', note:!c.park?'no data':null },
        { label:'Batting slot',       impact:Math.round((slotFactor-1)*adj*10)/10,           dir:slotFactor>=1?'↑':'↓', note:!c.avgSlot?'slot unavail':` #${c.avgSlot}` },
      ],
    };
  }, [gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev]);
}

function useRBIProjection(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev) {
  return useMemo(() => {
    if (!gameLog.length && !seasonStats) return null;
    const c = buildHittingCtx(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
    const seasonRBI  = parseInt(seasonStats?.rbi) || 0;
    const seasonRBIpg = seasonRBI / c.seasonGP;
    const L10RBI  = c.L10.map(g=>Number(g.rbi)||0);
    const l10RBIpg = L10RBI.reduce((a,b)=>a+b,0) / Math.max(L10RBI.length,1);
    const slgFactor = c.splitSLG && c.seasonSLG > 0
      ? Math.max(0.75, Math.min(1.25, c.splitSLG/c.seasonSLG)) : 1.0;
    const rbiSlot = c.avgSlot
      ? (c.avgSlot<=2?0.85:c.avgSlot<=5?1.08:c.avgSlot<=7?0.95:0.82) : 1.0;
    const pitcherRBIAdj = Math.max(0.75, 1-(c.pitcherERA-LG.era)*0.05);
    const parkFactor = c.park?.runs || 1.0;
    const rateProj = l10RBIpg*0.50 + seasonRBIpg*0.40 + 0.43*0.10;
    const proj = Math.max(0.05, rateProj * pitcherRBIAdj * slgFactor * parkFactor * rbiSlot);
    const std = l10StdDev(L10RBI, 0.5);
    const adj = Math.round(proj*10)/10;
    return {
      projected: adj,
      lower80: Math.max(0, Math.round((adj-1.28*std)*10)/10),
      upper80: Math.round((adj+1.28*std)*10)/10,
      stdDev: Math.round(std*10)/10,
      factorImpacts: [
        { label:'L10 RBI/game avg',   impact:Math.round((l10RBIpg-seasonRBIpg)*10)/10,      dir:l10RBIpg>seasonRBIpg?'↑':'↓' },
        { label:`${spPitcherHand||'?'}HP SLG split`, impact:Math.round((slgFactor-1)*adj*10)/10, dir:slgFactor>=1?'↑':'↓', note:!c.splitSLG?'no split data':null },
        { label:'Pitcher quality',    impact:Math.round((pitcherRBIAdj-1)*adj*10)/10,       dir:pitcherRBIAdj>=1?'↑':'↓' },
        { label:'Batting slot (RBI)', impact:Math.round((rbiSlot-1)*adj*10)/10,             dir:rbiSlot>=1?'↑':'↓', note:!c.avgSlot?'slot unavail':` #${c.avgSlot}` },
        { label:'Park run factor',    impact:Math.round((parkFactor-1)*adj*10)/10,          dir:parkFactor>=1?'↑':'↓', note:!c.park?'no data':null },
      ],
    };
  }, [gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev]);
}

function useSBProjection(gameLog, seasonStats, spTeamAbbrev, spOppAbbrev, spIsHome) {
  return useMemo(() => {
    const st = seasonStats;
    const gp = Math.max(st?.gamesPlayed || 1, 1);
    const seasonSB = (st?.stolenBases || 0) / gp;
    const L10 = gameLog.slice(-10);
    const L10SB = L10.map(g => Number(g.stolenBases) || 0);
    const l10SBpg = L10SB.reduce((a,b)=>a+b,0) / Math.max(L10.length,1);
    const parkKey = spIsHome ? spTeamAbbrev : spOppAbbrev;
    // Park factor for SB is mostly neutral; use a slight home field adjustment
    const parkFactor = 1.0;
    const lambda = Math.max(0, (seasonSB * 0.5 + l10SBpg * 0.5) * parkFactor);
    const dist = Array.from({length:5},(_,k)=>({ k, p: Math.round(Math.exp(-lambda)*Math.pow(lambda,k)/[1,1,2,6,24][k]*1000)/10 }));
    const pAtLeast1 = Math.round((1 - Math.exp(-lambda)) * 100);
    const std = l10StdDev(L10SB, 0.2);
    return {
      projected: Math.round(lambda * 10) / 10,
      pAtLeast1,
      dist,
      std,
      factors: [
        { label:'Season SB/game',  impact:Math.round((seasonSB-0.10)*100)/100,  dir:seasonSB>0.10?'↑':'↓' },
        { label:'L10 SB/game avg', impact:Math.round((l10SBpg-seasonSB)*100)/100, dir:l10SBpg>=seasonSB?'↑':'↓' },
        { label:'Park factor',     impact:0, dir:'→' },
      ],
    };
  }, [gameLog, seasonStats, spTeamAbbrev, spOppAbbrev, spIsHome]);
}

function HittingProjectionEVCard({ gameLog, seasonStats, splits, statcast, pitcher, playerName,
  spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev, activeTab, loading }) {

  const [activeProp, setActiveProp] = useState(activeTab || 'hits');
  const [lines,     setLines]     = useState({ hits:'', hr:'', runs:'', rbi:'', sb:'' });
  const [overOdds,  setOverOdds]  = useState({ hits:'-115', hr:'-130', runs:'-115', rbi:'-115', sb:'-130' });
  const [underOdds, setUnderOdds] = useState({ hits:'-115', hr:'+110', runs:'-115', rbi:'-115', sb:'+110' });
  const [debLines,  setDebLines]  = useState({ hits:'', hr:'', runs:'', rbi:'', sb:'' });

  useEffect(() => { setActiveProp(activeTab || 'hits'); }, [activeTab]);
  useEffect(() => {
    const cur = lines[activeProp];
    const t = setTimeout(() => setDebLines(prev => ({ ...prev, [activeProp]: cur })), 300);
    return () => clearTimeout(t);
  }, [lines.hits, lines.hr, lines.runs, lines.rbi, lines.sb, activeProp]);

  const hitsProj = useHitsProjection(gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
  const hrProj   = useHRProjection(  gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
  const runsProj = useRunsProjection( gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
  const rbiProj  = useRBIProjection(  gameLog, seasonStats, splits, statcast, pitcher, spPitcherHand, spIsHome, spTeamAbbrev, spOppAbbrev);
  const sbProj   = useSBProjection(   gameLog, seasonStats, spTeamAbbrev, spOppAbbrev, spIsHome);

  const projMap  = { hits:hitsProj, hr:hrProj, runs:runsProj, rbi:rbiProj, sb:sbProj };
  const proj     = projMap[activeProp];
  const line     = parseFloat(debLines[activeProp]) || null;
  const oOdds    = parseInt(overOdds[activeProp])   || -115;
  const uOdds    = parseInt(underOdds[activeProp])  || -115;

  const evResult = useMemo(() => {
    if (!proj || !line) return null;
    const floor  = Math.floor(line);
    const lambda = proj.projected;
    const pOver  = 1 - poissonCDF(floor, lambda);
    const pUnder = poissonCDF(floor, lambda);
    const rawO = americanToDecimal(oOdds), rawU = americanToDecimal(uOdds);
    const tot  = rawO + rawU;
    return { pOver, pUnder, evOver:(pOver-rawO/tot)*100, evUnder:(pUnder-rawU/tot)*100 };
  }, [proj, line, oOdds, uOdds, activeProp]);

  const evBadge = evResult ? (() => {
    const ev = evResult.evOver;
    if (ev > 6)  return { label:'Strong Value',  cls:'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' };
    if (ev > 3)  return { label:'Moderate Edge', cls:'bg-yellow-500/20  border-yellow-500/40  text-yellow-400'  };
    if (ev > 1)  return { label:'Slight Edge',   cls:'bg-gray-700/50    border-gray-600        text-gray-300'   };
    return             { label:'No Value',       cls:'bg-red-500/10     border-red-500/30      text-red-400'    };
  })() : null;

  const PROP_TABS = [
    { id:'hits', label:'Hits',         unit:'H',   icon:'🎯' },
    { id:'hr',   label:'Home Runs',    unit:'HR',  icon:'💣' },
    { id:'runs', label:'Runs',         unit:'R',   icon:'🏃' },
    { id:'rbi',  label:'RBI',          unit:'RBI', icon:'💰' },
    { id:'sb',   label:'Stolen Bases', unit:'SB',  icon:'⚡' },
  ];
  const activeTab_ = PROP_TABS.find(t=>t.id===activeProp);
  const propUnit   = activeTab_?.unit || 'H';
  const projLabel  = activeProp === 'hr' ? 'P(HR ≥ 1)' : activeProp === 'sb' ? 'P(SB ≥ 1)' : `Proj ${propUnit}`;
  const projVal    = activeProp === 'hr' && proj?.pHR != null
    ? `${proj.pHR}%`
    : activeProp === 'sb' && proj?.pAtLeast1 != null
      ? `${proj.pAtLeast1}%`
      : (proj?.projected?.toFixed(1) ?? '—');

  if (loading) return (
    <div className="rounded-xl border border-gray-700/50 bg-[#0f1117] p-6">
      <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-16 w-full rounded-xl"/>)}</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-700/50 bg-[#0f1117] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div>
            <h3 className="text-sm font-black text-white">Hitting Projection & EV%</h3>
            <p className="text-xs text-gray-600">Multi-prop model · ProprStats</p>
          </div>
        </div>
        {evBadge && <span className={`text-xs font-bold border rounded-full px-2.5 py-1 ${evBadge.cls}`}>{evBadge.label}</span>}
      </div>

      {/* Prop tab bar */}
      <div className="flex rounded-lg border border-gray-800 overflow-hidden mb-5">
        {PROP_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveProp(t.id)}
            className={`flex-1 px-3 py-2 text-xs font-bold transition-colors ${
              activeProp === t.id ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {!proj ? (
        <p className="text-sm text-gray-600 italic text-center py-4">Need at least 3 games of data to compute a projection.</p>
      ) : (
        <>
          {/* 4 summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border bg-blue-500/10 border-blue-500/30 p-3 text-center">
              <div className="text-xl font-black text-blue-400 tabular-nums">{projVal}</div>
              <div className="text-xs text-gray-600 mt-0.5">{projLabel}</div>
            </div>
            <div className="rounded-lg border bg-gray-800/50 border-gray-700 p-3 text-center">
              <div className="text-sm font-black text-gray-300 tabular-nums">{proj.lower80} – {proj.upper80}</div>
              <div className="text-xs text-gray-600 mt-0.5">80% Range</div>
            </div>
            <div className="rounded-lg border bg-gray-800/50 border-gray-700 p-3 text-center">
              <input type="number" step="0.5" placeholder="e.g. 1.5" value={lines[activeProp]}
                onChange={e => setLines(prev => ({ ...prev, [activeProp]: e.target.value }))}
                className="w-full bg-transparent text-center text-base font-black text-white tabular-nums outline-none placeholder-gray-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
              <div className="text-xs text-gray-600 mt-0.5">Book Line ↑ type here</div>
            </div>
            <div className={`rounded-lg border p-3 text-center ${evBadge ? evBadge.cls : 'bg-gray-800/50 border-gray-700'}`}>
              <div className={`text-xl font-black tabular-nums ${evBadge ? '' : 'text-gray-600'}`}>
                {evResult ? `${evResult.evOver>=0?'+':''}${evResult.evOver.toFixed(1)}%` : '—'}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">EV Signal</div>
            </div>
          </div>

          {/* 3-col section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
            {/* Poisson chart */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">{propUnit} Distribution (Poisson)</p>
              <PoissonBarChart lambda={proj.projected} bookLine={line || (proj.projected + 0.5)}/>
              {!line && <p className="text-xs text-gray-700 italic mt-1 text-center">Enter a book line for probabilities</p>}
            </div>

            {/* EV gauge */}
            <div className="flex flex-col items-center">
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">EV% Gauge</p>
              <EVGaugeSVG evPct={evResult?.evOver ?? 0}/>
              {evResult ? (
                <div className="flex gap-2 mt-2 flex-wrap justify-center">
                  <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${evResult.evOver>0?'text-emerald-400 border-emerald-500/30 bg-emerald-500/10':'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                    Over {evResult.evOver>=0?'+':''}{evResult.evOver.toFixed(1)}%
                  </span>
                  <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${evResult.evUnder>0?'text-emerald-400 border-emerald-500/30 bg-emerald-500/10':'text-red-400 border-red-500/30 bg-red-500/10'}`}>
                    Under {evResult.evUnder>=0?'+':''}{evResult.evUnder.toFixed(1)}%
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-700 italic mt-3 text-center">Enter line & odds for EV%</p>
              )}
              <p className="text-xs text-gray-700 mt-3 text-center leading-relaxed px-2">
                EV% measures edge vs book. <span className="text-emerald-700">EV &gt; 5% = strong value.</span>
              </p>
            </div>

            {/* Factor breakdown */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Factor Breakdown</p>
              <table className="w-full text-xs">
                <tbody>
                  {proj.factorImpacts.map((f, i) => (
                    <tr key={i} className="border-b border-gray-800/40">
                      <td className="py-1.5 text-gray-500">{f.label}</td>
                      <td className={`py-1.5 text-right tabular-nums ${f.note?'text-gray-700 italic':f.impact>0?'text-emerald-400':f.impact<0?'text-red-400':'text-gray-600'}`}>
                        {f.note ? f.note : f.impact!==0 ? `${f.impact>0?'+':''}${f.impact.toFixed(2)}` : '—'}
                      </td>
                      <td className={`py-1.5 pl-2 text-right font-bold ${f.dir==='↑'?'text-emerald-400':f.dir==='↓'?'text-red-400':'text-gray-600'}`}>
                        {f.note?'':f.dir}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-700">
                    <td className="py-2 font-black text-white">Projected</td>
                    <td className="py-2 text-right font-black text-blue-400 tabular-nums">{projVal}</td>
                    <td className="py-2 pl-2 text-right text-gray-600">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Odds input row */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
            <p className="text-xs text-gray-600 mb-2">Enter sportsbook odds for accurate EV%:</p>
            <div className="flex flex-wrap items-center gap-3">
              {[
                { label:'Book line',  val:lines[activeProp],     set:v=>setLines(p=>({...p,[activeProp]:v})),       step:'0.5', ph:'1.5'  },
                { label:'Over odds',  val:overOdds[activeProp],  set:v=>setOverOdds(p=>({...p,[activeProp]:v})),   step:'1',   ph:'-115' },
                { label:'Under odds', val:underOdds[activeProp], set:v=>setUnderOdds(p=>({...p,[activeProp]:v})), step:'1',   ph:'-105' },
              ].map(inp => (
                <label key={inp.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  {inp.label}:
                  <input type="number" step={inp.step} value={inp.val} placeholder={inp.ph}
                    onChange={e => inp.set(e.target.value)}
                    className="w-16 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white text-center tabular-nums outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlayerDetailPage() {
  const { id }      = useParams();
  const sp          = useSearchParams();

  // Search param context (passed from dashboard card)
  const spTeamId      = sp.get('teamId')      || '';
  const spPitcherId   = sp.get('pitcherId')   || '';
  const spPitcherName = sp.get('pitcherName') || '';
  const spPitcherHand = sp.get('pitcherHand') || '';
  const spOppAbbrev   = sp.get('oppAbbrev')   || '';
  const spIsHome      = sp.get('isHome') === 'true';
  const spName        = sp.get('name')        || '';
  const spTeamAbbrev  = sp.get('teamAbbrev')  || '';
  const spTeamName    = sp.get('teamName')    || '';
  const spPosition    = sp.get('position')   || '';

  // ── State ─────────────────────────────────────────────────────────────────
  const validCats = ['hits','runs','rbi','hr','sb'];
  const initCat   = validCats.includes(sp.get('cat')) ? sp.get('cat') : 'hits';
  const [cat,         setCat]         = useState(initCat);
  const [win,         setWin]         = useState(10);
  const [line,        setLine]        = useState(0.5);
  const [gameLog,     setGameLog]     = useState([]);
  const [seasonStats, setSeasonStats] = useState(null);
  const [playerInfo,  setPlayerInfo]  = useState({
    fullName: spName, teamAbbrev: spTeamAbbrev, teamName: spTeamName,
  });
  const [splits,      setSplits]      = useState(null);
  const [statcast,    setStatcast]    = useState(null);
  const [pitcher,     setPitcher]     = useState(
    spPitcherName ? { id: spPitcherId, name: spPitcherName, hand: spPitcherHand } : null
  );
  const [h2hData,     setH2hData]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [chartLoading,setChartLoading]= useState(true);

  // ── Pitcher-specific state ─────────────────────────────────────────────
  const [pitcherStarts, setPitcherStarts] = useState([]);
  const [pitcherSplits, setPitcherSplits] = useState(null);
  const [pitcherChartCat,  setPitcherChartCat]  = useState('k');
  const [pitcherChartLine, setPitcherChartLine] = useState(4.5);
  const [pitcherChartWin,  setPitcherChartWin]  = useState(10);

  // ── On line change, reset to first valid line for new cat ─────────────────
  useEffect(() => {
    const cfg = PROP_CATS.find(c => c.id === cat);
    if (cfg && !cfg.lines.includes(line)) setLine(cfg.def);
  }, [cat]);

  // ── Reset pitcher chart line when metric changes ───────────────────────
  useEffect(() => {
    const cfg = PITCHER_CHART_CATS.find(c => c.id === pitcherChartCat);
    if (cfg) setPitcherChartLine(cfg.defaultLine);
  }, [pitcherChartCat]);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setChartLoading(true);
    loadData();
  }, [id]);

  async function loadData() {
    const isPitcherLoad = ['SP', 'RP', 'P'].includes(spPosition);
    try {
      if (isPitcherLoad) {
        // ── Pitcher loading path ──────────────────────────────────────────
        // Phase 1: game log (for table & sparklines)
        const glRes = await fetch(`${API_URL}/pitcher/${id}/gamelog?season=2025`);
        if (glRes.ok) {
          const d = await glRes.json();
          setPitcherStarts(d.starts || []);
        }
        setChartLoading(false);

        // Phase 2: season stats + splits in parallel
        const [mlbRes, splitsRes] = await Promise.allSettled([
          fetch(`${MLB_API}/people/${id}?hydrate=stats(group=pitching,type=season,season=2025)`),
          fetch(`${API_URL}/pitcher/${id}/splits?season=2025`),
        ]);

        if (mlbRes.status === 'fulfilled' && mlbRes.value?.ok) {
          const d = await mlbRes.value.json();
          const p = d.people?.[0];
          if (p) {
            setPlayerInfo({
              fullName:   p.fullName,
              teamName:   p.currentTeam?.name         || spTeamName,
              teamAbbrev: p.currentTeam?.abbreviation || spTeamAbbrev,
              position:   p.primaryPosition?.abbreviation || spPosition,
              pitchHand:  p.pitchHand?.code || '',
            });
            const st = p.stats?.find(s => s.group?.displayName === 'pitching')?.splits?.[0]?.stat;
            if (st) setSeasonStats(st);
          }
        }

        if (splitsRes.status === 'fulfilled' && splitsRes.value?.ok) {
          const d = await splitsRes.value.json();
          setPitcherSplits(d.splits || null);
        }

      } else {
        // ── Batter loading path ───────────────────────────────────────────
        // Phase 1: game log (for chart — show ASAP)
        const glRes = await fetch(`${API_URL}/player/${id}/gamelog?season=2025`);
        if (glRes.ok) {
          const d = await glRes.json();
          setGameLog(d.games || []);
        }
        setChartLoading(false);

        // Phase 2: everything else in parallel
        const [mlbRes, splitsRes, statcastRes, pitcherRes, h2hRes] = await Promise.allSettled([
          fetch(`${MLB_API}/people/${id}?hydrate=stats(group=hitting,type=season,season=2025)`),
          fetch(`${API_URL}/player/${id}/splits?season=2025`),
          fetch(`${API_URL}/statcast/batters?season=2025`),
          spPitcherId ? fetch(`${API_URL}/pitcher/${spPitcherId}`) : Promise.resolve(null),
          spPitcherId ? fetch(`${API_URL}/career-matchup/batter/${id}/pitcher/${spPitcherId}`) : Promise.resolve(null),
        ]);

        // Player info + season stats
        if (mlbRes.status === 'fulfilled' && mlbRes.value?.ok) {
          const d = await mlbRes.value.json();
          const p = d.people?.[0];
          if (p) {
            setPlayerInfo({
              fullName:   p.fullName,
              teamName:   p.currentTeam?.name    || spTeamName,
              teamAbbrev: p.currentTeam?.abbreviation || spTeamAbbrev,
              position:   p.primaryPosition?.abbreviation || '',
              batSide:    p.batSide?.code || '',
            });
            const st = p.stats?.find(s => s.group?.displayName === 'hitting')?.splits?.[0]?.stat;
            if (st) setSeasonStats(st);
          }
        }

        // Splits
        if (splitsRes.status === 'fulfilled' && splitsRes.value?.ok) {
          const d = await splitsRes.value.json();
          setSplits(d.splits || null);
        }

        // Statcast
        if (statcastRes.status === 'fulfilled' && statcastRes.value?.ok) {
          const d = await statcastRes.value.json();
          const pid = parseInt(id);
          setStatcast(d[pid] || d[id] || null);
        }

        // Pitcher
        if (pitcherRes.status === 'fulfilled' && pitcherRes.value?.ok) {
          const d = await pitcherRes.value.json();
          setPitcher(prev => ({
            ...prev,
            ...d.pitcher,
            stats: d.pitchingStats || null,
          }));
        }

        // Career H2H
        if (h2hRes.status === 'fulfilled' && h2hRes.value?.ok) {
          const d = await h2hRes.value.json();
          setH2hData(d);
        }
      }
    } catch {}
    setLoading(false);
  }

  // ── Derived: streak + l10avg from game log ────────────────────────────────
  const streak = useMemo(() => computeStreak(gameLog),  [gameLog]);
  const l10Avg = useMemo(() => computeL10Avg(gameLog),  [gameLog]);

  // ── Derived: model score ──────────────────────────────────────────────────
  const modelScore = useMemo(() => {
    const modelCat = CAT_MODEL[cat];
    if (!modelCat || !seasonStats) return null;
    const st = seasonStats;
    return computeProjectionScore({
      avg:              parseFloat(st.avg)             || 0,
      obp:              parseFloat(st.obp)             || 0,
      slg:              parseFloat(st.slg)             || 0,
      homeRuns:         parseInt(st.homeRuns)          || 0,
      atBats:           parseInt(st.atBats)            || 0,
      gamesPlayed:      parseInt(st.gamesPlayed)       || 1,
      runs:             parseInt(st.runs)              || 0,
      rbi:              parseInt(st.rbi)               || 0,
      hits:             parseInt(st.hits)              || 0,
      doubles:          parseInt(st.doubles)           || 0,
      triples:          parseInt(st.triples)           || 0,
      baseOnBalls:      parseInt(st.baseOnBalls)       || 0,
      strikeOuts:       parseInt(st.strikeOuts)        || 0,
      plateAppearances: parseInt(st.plateAppearances)  || 0,
      xwoba:      statcast?.xwoba      ?? null,
      barrelPct:  statcast?.barrelPct  ?? null,
      hardHitPct: statcast?.hardHitPct ?? null,
      matchupEra: pitcher?.stats?.era ? parseFloat(pitcher.stats.era) : null,
      streak,
      l10Avg,
    }, modelCat);
  }, [cat, seasonStats, statcast, pitcher, streak, l10Avg]);

  // ── Relevant split (vs today's pitcher hand) ──────────────────────────────
  const relevantSplit = useMemo(() => {
    if (!splits || !spPitcherHand) return null;
    return spPitcherHand === 'L' ? splits.vsLeftHandedPitching : splits.vsRightHandedPitching;
  }, [splits, spPitcherHand]);

  // ── L5 summary for current category ──────────────────────────────────────
  const l5Summary = useMemo(() => {
    const cfg = PROP_CATS.find(c => c.id === cat);
    if (!cfg || !gameLog.length) return null;
    const slice = gameLog.slice(-5);
    const vals  = slice.map(g => Number(g[cfg.field]) || 0);
    return {
      avg:  vals.reduce((a,b)=>a+b,0) / vals.length,
      over: vals.filter(v => v > line).length,
      total: vals.length,
    };
  }, [cat, gameLog, line]);

  const catCfg  = PROP_CATS.find(c => c.id === cat);
  const rec     = modelScore != null ? getRecommendation(modelScore) : null;
  const st      = seasonStats;

  // Season rate stats
  const ab   = parseInt(st?.atBats)            || 0;
  const pa   = parseInt(st?.plateAppearances)  || 0;
  const kPct = pa > 0 ? (parseInt(st?.strikeOuts)||0) / pa : null;
  const bbPct= pa > 0 ? (parseInt(st?.baseOnBalls)||0) / pa : null;

  // ── Pitcher-specific derived ─────────────────────────────────────────────
  const isPitcherView = ['SP', 'RP', 'P'].includes(spPosition) ||
    ['SP', 'RP', 'P'].includes(playerInfo.position || '');

  const pitcherFIP   = useMemo(() => computeFIP(seasonStats), [seasonStats]);
  const pitcherERAScore = useMemo(() => {
    if (!isPitcherView || !seasonStats?.era) return null;
    return pitcherScoreFromERA(parseFloat(seasonStats.era));
  }, [isPitcherView, seasonStats]);

  // Page-level K projection (mirrors ProjectionEVCard)
  const pageKProj = useKProjection(isPitcherView ? pitcherStarts : [], isPitcherView ? seasonStats : null);
  const kProjScore = useMemo(() => {
    if (!isPitcherView || !pageKProj) return null;
    return pitcherScoreFromKProj(pageKProj.projected);
  }, [isPitcherView, pageKProj]);

  // Main pitcher score is K projection; fall back to ERA score
  const pitcherScore = kProjScore ?? pitcherERAScore;

  const pitcherKPct = useMemo(() => {
    if (!seasonStats) return null;
    const k  = parseInt(seasonStats.strikeOuts)   || 0;
    const bf = parseInt(seasonStats.battersFaced) || 0;
    return bf > 0 ? k / bf : null;
  }, [seasonStats]);

  const pitcherBBPct = useMemo(() => {
    if (!seasonStats) return null;
    const bb = parseInt(seasonStats.baseOnBalls) || 0;
    const bf = parseInt(seasonStats.battersFaced) || 0;
    return bf > 0 ? bb / bf : null;
  }, [seasonStats]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center group">
              <ProprStatsLogo variant="light" size={30} wordmarkClass="group-hover:text-blue-400 transition-colors" />
            </Link>
            <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Player Header ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 mb-6">
          <div className="flex items-center gap-5">
            {loading && !playerInfo.fullName
              ? <Skeleton className="w-20 h-20 rounded-full flex-shrink-0"/>
              : <PlayerHeadshot playerId={id} name={playerInfo.fullName} size={80}/>
            }
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white truncate">
                {playerInfo.fullName || <Skeleton className="h-7 w-48"/>}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {playerInfo.position && <span>{playerInfo.position} · </span>}
                {playerInfo.teamName || playerInfo.teamAbbrev}
                {playerInfo.batSide && <span className="ml-2 text-gray-600">Bats {playerInfo.batSide}</span>}
                {playerInfo.pitchHand && <span className="ml-2 text-gray-600">Throws {playerInfo.pitchHand}</span>}
              </p>
              {(pitcher || spOppAbbrev) && (
                <p className="text-sm text-blue-400 mt-1">
                  {spIsHome ? 'vs' : '@'} {spOppAbbrev}
                  {pitcher?.name && ` · ${spPitcherHand || ''}HP ${pitcher.name.split(' ').slice(-1)[0]}`}
                  {pitcher?.stats?.era && <span className="text-gray-500 ml-1">({fmt(pitcher.stats.era,2)} ERA)</span>}
                </p>
              )}
            </div>
            {/* Score ring */}
            <div className="flex-shrink-0 flex items-center gap-3">
              {isPitcherView
                ? <>
                    {/* K Projection — main score */}
                    <div className="text-center">
                      {kProjScore != null
                        ? <><ScoreRing score={kProjScore} size={64}/><p className="text-xs text-gray-600 mt-1">K Proj</p></>
                        : loading
                          ? <Skeleton className="w-16 h-16 rounded-full"/>
                          : <div className="w-16 h-16 rounded-full border-2 border-gray-800 bg-gray-800/50 flex items-center justify-center"><span className="text-gray-700 text-xs">N/A</span></div>
                      }
                    </div>
                    {/* ERA — secondary score */}
                    <div className="text-center">
                      {pitcherERAScore != null
                        ? <><ScoreRing score={pitcherERAScore} size={44}/><p className="text-xs text-gray-600 mt-1">ERA</p></>
                        : !loading && <div className="w-11 h-11 rounded-full border-2 border-gray-800 bg-gray-800/50 flex items-center justify-center"><span className="text-gray-700 text-xs">—</span></div>
                      }
                    </div>
                  </>
                : <div className="text-center">
                    {modelScore != null
                      ? <><ScoreRing score={modelScore} size={64}/><p className="text-xs text-gray-600 mt-1">Model</p></>
                      : <div className="w-16 h-16 rounded-full border-2 border-gray-800 bg-gray-800/50 flex items-center justify-center"><span className="text-gray-700 text-xs">N/A</span></div>
                    }
                  </div>
              }
            </div>
          </div>

          {/* Pitcher stat pills */}
          {isPitcherView && seasonStats && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { l:'ERA',  v: fmt(parseFloat(seasonStats.era),2),  cls: eraCls(parseFloat(seasonStats.era)||4.5) },
                { l:'FIP',  v: pitcherFIP!=null ? fmt(pitcherFIP,2) : '—', cls: eraCls(pitcherFIP||4.5) },
                { l:'WHIP', v: fmt(parseFloat(seasonStats.whip),2), cls: whipCls(parseFloat(seasonStats.whip)||1.3) },
                { l:'K/9',  v: fmt(parseFloat(seasonStats.strikeoutsPer9Inn),1), cls: statCls(parseFloat(seasonStats.strikeoutsPer9Inn)||0,10,8) },
                { l:'K%',   v: pitcherKPct!=null ? `${(pitcherKPct*100).toFixed(0)}%` : '—', cls: statCls((pitcherKPct||0)*100,28,22) },
                { l:'BB%',  v: pitcherBBPct!=null ? `${(pitcherBBPct*100).toFixed(0)}%` : '—', cls: statCls(12-(pitcherBBPct||0)*100,4,0) },
                { l:'W-L',  v: `${seasonStats.wins||0}-${seasonStats.losses||0}`, cls:{ text:'text-blue-400', bg:'bg-blue-500/10 border-blue-500/30' } },
              ].map(s => (
                <span key={s.l} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${s.cls.bg}`}>
                  <span className={s.cls.text}>{s.v}</span>
                  <span className="text-gray-600">{s.l}</span>
                </span>
              ))}
            </div>
          )}

          {/* Batter rec banner */}
          {!isPitcherView && rec && (
            <div className={`mt-4 rounded-lg border px-4 py-2 flex items-center justify-between ${rec.bg}`}>
              <span className={`text-sm font-bold ${rec.color}`}>{rec.label}</span>
              <span className="text-xs text-gray-600">ProprStats Model · {catCfg?.label}</span>
            </div>
          )}
        </div>

        {/* ═══════════════ PITCHER DASHBOARD ═══════════════════════════════ */}
        {isPitcherView && (
          <>
            {/* ── Section header label ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Pitcher Dashboard · 2025</h2>
              <div className="flex-1 h-px bg-gray-800"/>
              {spOppAbbrev && (
                <span className="text-xs text-blue-400 font-semibold">
                  {spIsHome ? 'vs' : '@'} {spOppAbbrev}
                </span>
              )}
            </div>

            {/* ── Bar Chart (K / ER / Outs / H / BB / HR) ─────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
              {/* Controls row */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {PITCHER_CHART_CATS.find(c=>c.id===pitcherChartCat)?.label} — Last {pitcherChartWin} Starts
                  </h3>
                  {!chartLoading && pitcherStarts.length > 0 && (() => {
                    const cat = PITCHER_CHART_CATS.find(c=>c.id===pitcherChartCat);
                    const processed = pitcherStarts.map(s=>({...s, _outs:Math.round(parseFloat(s.inningsPitched||'0')*3)}));
                    const slice = processed.slice(-pitcherChartWin);
                    const vals  = slice.map(g => Number(g[cat?.field||'strikeOuts'])||0);
                    const avg   = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '—';
                    const good  = cat ? vals.filter(v => cat.higherIsBetter ? v > pitcherChartLine : v <= pitcherChartLine).length : 0;
                    return <p className="text-xs text-gray-500">avg <span className="text-white font-semibold">{avg}</span> · {good}/{slice.length} {cat?.higherIsBetter ? 'over' : 'under'} {pitcherChartLine}</p>;
                  })()}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Metric toggle */}
                  <div className="flex rounded-lg border border-gray-800 overflow-hidden flex-wrap">
                    {PITCHER_CHART_CATS.map(c => (
                      <button key={c.id} onClick={() => setPitcherChartCat(c.id)}
                        className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          pitcherChartCat === c.id ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                        }`}>{c.label}</button>
                    ))}
                  </div>
                  {/* Window toggle */}
                  <div className="flex rounded-lg border border-gray-800 overflow-hidden">
                    {[5,10].map(w => (
                      <button key={w} onClick={() => setPitcherChartWin(w)}
                        className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                          pitcherChartWin === w ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                        }`}>L{w}</button>
                    ))}
                  </div>
                  {/* Vegas line input */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Line:</span>
                    <input type="number" step="0.5" value={pitcherChartLine}
                      onChange={e => setPitcherChartLine(parseFloat(e.target.value)||0)}
                      className="w-16 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2 py-1.5 text-xs font-bold text-amber-400 text-center tabular-nums outline-none focus:border-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                  </div>
                </div>
              </div>
              {chartLoading
                ? <div className="h-40 flex items-center justify-center"><div className="text-gray-700 text-sm animate-pulse">Loading starts…</div></div>
                : <PitcherGameLogChart starts={pitcherStarts} catId={pitcherChartCat} line={pitcherChartLine} win={pitcherChartWin}/>
              }
            </div>

            {/* ── Projection & EV% ─────────────────────────────────────────── */}
            <ProjectionErrorBoundary>
              <ProjectionEVCard pitcherStarts={pitcherStarts} seasonStats={seasonStats}/>
            </ProjectionErrorBoundary>

            {/* ── K Trend + Platoon Splits (2-col) ─────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <Card title="K · ER · IP Trend" icon="📈">
                <PitcherKTrendCard starts={pitcherStarts} loading={chartLoading}/>
              </Card>
              <Card title="Platoon Splits" icon="✂️">
                <PitcherPlatoonCard splits={pitcherSplits} loading={loading}/>
              </Card>
            </div>

            {/* ── Pitch Arsenal placeholder ─────────────────────────────────── */}
            <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-5 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">🎯</span>
                <h3 className="text-sm font-bold text-gray-500">Pitch Arsenal</h3>
                <span className="ml-auto text-xs text-gray-700 border border-gray-800 rounded-full px-2 py-0.5">Coming Soon</span>
              </div>
              <p className="text-xs text-gray-700">Per-pitch usage %, whiff %, and CSW% from Baseball Savant. In development.</p>
            </div>

            {/* ── Season Stats grid ─────────────────────────────────────────── */}
            {seasonStats && (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">📊</span>
                  <h3 className="text-sm font-bold text-white">2025 Season Stats</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label:'Strikeouts',     value: seasonStats.strikeOuts || 0,          cls: statCls(parseInt(seasonStats.strikeOuts)||0, 150, 100) },
                    { label:'Innings Pitched',value: seasonStats.inningsPitched || '0',     cls: statCls(parseFloat(seasonStats.inningsPitched)||0, 150, 100) },
                    { label:'HR Allowed',     value: seasonStats.homeRuns || 0,             cls: statCls(20-(parseInt(seasonStats.homeRuns)||0), 10, 5) },
                    { label:'Walks',          value: seasonStats.baseOnBalls || 0,          cls: statCls(60-(parseInt(seasonStats.baseOnBalls)||0), 20, 0) },
                    { label:'Wins',           value: seasonStats.wins || 0,                 cls: statCls(parseInt(seasonStats.wins)||0, 15, 10) },
                    { label:'Losses',         value: seasonStats.losses || 0,               cls: { text:'text-gray-400', bg:'bg-gray-800/50 border-gray-800' } },
                    { label:'Hits Allowed',   value: seasonStats.hits || 0,                 cls: statCls(200-(parseInt(seasonStats.hits)||0), 80, 30) },
                    { label:'Starts',         value: seasonStats.gamesStarted || seasonStats.gamesPlayed || 0, cls: { text:'text-blue-400', bg:'bg-blue-500/10 border-blue-500/30' } },
                  ].map(item => (
                    <div key={item.label} className={`rounded-lg border p-3 text-center ${item.cls.bg}`}>
                      <div className={`text-lg font-black tabular-nums ${item.cls.text}`}>{item.value}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Contextual Factors ────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🔮</span>
                <h3 className="text-sm font-bold text-white">Contextual Factors</h3>
              </div>
              <PitcherContextRow starts={pitcherStarts} oppAbbrev={spOppAbbrev} isHome={spIsHome}/>
            </div>

          </>
        )}

        {/* ═══════════════ BATTER DASHBOARD ════════════════════════════════ */}
        {!isPitcherView && (
          <>
            {/* ── Category Tabs ──────────────────────────────────────────── */}
            <div className="flex items-center gap-2 flex-wrap mb-5">
              {PROP_CATS.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    cat === c.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* ── Chart Card ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-sm font-bold text-white mb-0.5">
                    {catCfg?.label} — Last {win} Games
                  </h2>
                  {l5Summary && (
                    <p className="text-xs text-gray-500">
                      L5 avg: <span className="text-white font-semibold">{l5Summary.avg.toFixed(1)}</span>
                      <span className="mx-1">·</span>
                      {l5Summary.over}/{l5Summary.total} over {line}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex rounded-lg border border-gray-800 overflow-hidden">
                    {[5,10].map(w => (
                      <button key={w} onClick={() => setWin(w)}
                        className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                          win === w ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                        }`}>L{w}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Line:</span>
                    <div className="flex rounded-lg border border-gray-800 overflow-hidden">
                      {(catCfg?.lines || [0.5]).map(l => (
                        <button key={l} onClick={() => setLine(l)}
                          className={`px-3 py-1.5 text-xs font-bold tabular-nums transition-colors ${
                            line === l ? 'bg-amber-500/80 text-black' : 'bg-gray-900 text-gray-400 hover:text-white'
                          }`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {chartLoading
                ? <div className="h-40 flex items-center justify-center"><div className="text-gray-700 text-sm animate-pulse">Loading game log…</div></div>
                : <GameLogChart games={gameLog} field={catCfg?.field || 'hits'} line={line} win={win}/>
              }
            </div>

            {/* ── Projection & EV% ──────────────────────────────────────── */}
            <ProjectionErrorBoundary>
              <HittingProjectionEVCard
                gameLog={gameLog}
                seasonStats={seasonStats}
                splits={splits}
                statcast={statcast}
                pitcher={pitcher}
                playerName={playerInfo.fullName}
                spPitcherHand={spPitcherHand}
                spIsHome={spIsHome}
                spTeamAbbrev={spTeamAbbrev}
                spOppAbbrev={spOppAbbrev}
                activeTab={cat}
                loading={loading || chartLoading}
              />
            </ProjectionErrorBoundary>

            {/* ── Game Log Detail Table ───────────────────────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📋</span>
                <h3 className="text-sm font-bold text-white">{catCfg?.label} — Last 10 Games</h3>
                <span className="ml-auto text-xs text-gray-600 border border-gray-800 rounded-full px-2 py-0.5">tab-aware</span>
              </div>
              <GameLogTable games={gameLog} cat={cat} loading={chartLoading}/>
            </div>

            {/* ── Detail Grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="col-span-1 sm:col-span-2">
                <H2HMatchupCard
                  data={h2hData}
                  loading={loading}
                  pitcherId={spPitcherId}
                  pitcherName={spPitcherName}
                  pitcherHand={spPitcherHand}
                />
              </div>

              <Card title="Handedness Splits" icon="✂️">
                {!splits ? (
                  loading
                    ? <div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-5 w-full"/>)}</div>
                    : <p className="text-sm text-gray-600 italic">Splits data unavailable — may not have enough PA yet this season.</p>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label:'vs Left', data: splits.vsLeftHandedPitching,  relevant: spPitcherHand === 'L' },
                      { label:'vs Right', data: splits.vsRightHandedPitching, relevant: spPitcherHand === 'R' },
                    ].map(({ label, data, relevant }) => (
                      <div key={label} className={`rounded-lg p-3 border ${relevant ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-800 bg-gray-800/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold ${relevant ? 'text-blue-400' : 'text-gray-400'}`}>{label}</span>
                          {relevant && <span className="text-xs text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">Today</span>}
                        </div>
                        {data ? (
                          <div className="grid grid-cols-4 gap-1 text-center">
                            {[
                              { l:'AVG', v: fmt(data.avg,3),  c: statCls(parseFloat(data.avg)||0,0.28,0.25) },
                              { l:'OBP', v: fmt(data.obp,3),  c: statCls(parseFloat(data.obp)||0,0.36,0.32) },
                              { l:'SLG', v: fmt(data.slg,3),  c: statCls(parseFloat(data.slg)||0,0.45,0.38) },
                              { l:'OPS', v: fmt(data.ops,3),  c: statCls(parseFloat(data.ops)||0,0.80,0.70) },
                            ].map(s => (
                              <div key={s.l}>
                                <div className={`text-sm font-black ${s.c.text}`}>{s.v}</div>
                                <div className="text-xs text-gray-600">{s.l}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-600 italic">No data</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Statcast Quality" icon="⚡">
                {!statcast ? (
                  loading
                    ? <div className="space-y-2">{[1,2,3,4,5,6].map(i=><Skeleton key={i} className="h-10 w-full rounded-lg"/>)}</div>
                    : <p className="text-sm text-gray-600 italic">Statcast data not available.</p>
                ) : (() => {
                  const lgAvg = { exitVelo:88.5, hardHitPct:38.0, barrelPct:8.2, sweetSpotPct:31.5, xwoba:0.315, xslg:0.402 };
                  const metrics = [
                    { label:'Exit Velocity',  val:statcast.exitVelo,     unit:' mph', lg:lgAvg.exitVelo,    fmt2:v=>v.toFixed(1), cls:statCls(statcast.exitVelo||0,92,88) },
                    { label:'Hard Hit %',     val:statcast.hardHitPct,   unit:'%',    lg:lgAvg.hardHitPct,  fmt2:v=>v.toFixed(1), cls:statCls(statcast.hardHitPct||0,50,38) },
                    { label:'Barrel %',       val:statcast.barrelPct,    unit:'%',    lg:lgAvg.barrelPct,   fmt2:v=>v.toFixed(1), cls:statCls(statcast.barrelPct||0,12,8.2) },
                    { label:'Sweet Spot %',   val:statcast.sweetSpotPct, unit:'%',    lg:lgAvg.sweetSpotPct,fmt2:v=>v.toFixed(1), cls:statCls(statcast.sweetSpotPct||0,35,31.5) },
                    { label:'xwOBA',          val:statcast.xwoba,        unit:'',     lg:lgAvg.xwoba,       fmt2:v=>v.toFixed(3), cls:statCls(statcast.xwoba||0,0.37,0.32) },
                    { label:'xSLG',           val:statcast.xslg,         unit:'',     lg:lgAvg.xslg,        fmt2:v=>v.toFixed(3), cls:statCls(statcast.xslg||0,0.45,0.38) },
                  ];
                  return (
                    <div>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {metrics.map(m => {
                          const ok = m.val != null;
                          const above = ok && m.val > m.lg;
                          return (
                            <div key={m.label} className={`rounded-lg border p-2.5 text-center ${ok ? m.cls.bg : 'bg-gray-800/30 border-gray-800'}`}>
                              <div className={`text-sm font-black tabular-nums ${ok ? m.cls.text : 'text-gray-700'}`}>
                                {ok ? `${m.fmt2(m.val)}${m.unit}` : '—'}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">{m.label}</div>
                              {ok && (
                                <div className={`text-xs mt-0.5 tabular-nums ${above ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {above ? '↑' : '↓'} lg {m.fmt2(m.lg)}{m.unit}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {statcast.exitVelo != null && statcast.xwoba != null && (
                        <p className="text-xs text-gray-500 leading-relaxed mb-2">
                          <span className="text-gray-300">{playerInfo.fullName?.split(' ').slice(-1)[0]||'This player'}</span>{' '}
                          is hitting the ball{' '}
                          <span className={`font-bold ${(statcast.exitVelo||0)>=90?'text-emerald-400':'text-red-400'}`}>
                            {(statcast.exitVelo||0)>=90?'harder':'softer'} than league average
                          </span>{' '}—{' '}
                          <span className={`font-bold ${(statcast.xwoba||0)>=0.315?'text-emerald-400':'text-red-400'}`}>
                            {(statcast.xwoba||0)>=0.350?'significantly outperforming':(statcast.xwoba||0)>=0.315?'outperforming':'underperforming'}
                          </span>{' '}
                          their expected contact level (xwOBA: {fmt(statcast.xwoba,3)}).
                        </p>
                      )}
                      <div className="text-xs text-gray-700 italic border-t border-gray-800/60 pt-2">
                        Source: Baseball Savant 2025 · Updated every 6h
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>

            {/* ── Recent Form ────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">🔥</span>
                <h3 className="text-sm font-bold text-white">Recent Form</h3>
              </div>
              {chartLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1,2,3,4].map(i=><Skeleton key={i} className="h-16 rounded-lg"/>)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label:'Hitting Streak', value:`${streak} game${streak!==1?'s':''}`, cls:statCls(streak,5,3) },
                    { label:'L10 AVG', value:l10Avg!=null?l10Avg.toFixed(3):'—', cls:l10Avg!=null?statCls(l10Avg,0.280,0.250):{text:'text-gray-600',bg:'bg-gray-800/50 border-gray-800'} },
                    {
                      label:'vs Season AVG',
                      value: l10Avg!=null&&(parseFloat(st?.avg)||0)>0
                        ? `${l10Avg>parseFloat(st.avg)?'▲':'▼'} ${Math.abs(((l10Avg-parseFloat(st.avg))/parseFloat(st.avg))*100).toFixed(0)}%`
                        : '—',
                      cls: l10Avg!=null&&st?.avg ? statCls(l10Avg-parseFloat(st.avg),0.010,-0.010) : {text:'text-gray-600',bg:'bg-gray-800/50 border-gray-800'},
                    },
                    {
                      label:`L5 ${catCfg?.label||'Hits'}/G`,
                      value: (() => {
                        const cfg=PROP_CATS.find(c=>c.id===cat);
                        if(!cfg||!gameLog.length) return '—';
                        const vals=gameLog.slice(-5).map(g=>Number(g[cfg.field])||0);
                        return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
                      })(),
                      cls:{text:'text-blue-400',bg:'bg-blue-500/10 border-blue-500/30'},
                    },
                  ].map(item => (
                    <div key={item.label} className={`rounded-lg border p-3 text-center ${item.cls.bg}`}>
                      <div className={`text-lg font-black tabular-nums ${item.cls.text}`}>{item.value}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sparkline trends */}
              {!chartLoading && gameLog.length >= 5 && (
                <div className="mt-5 pt-4 border-t border-gray-800/60 space-y-4">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">L10 Trends</p>
                  {[
                    { label:'Hits/G',  field:'hits',      color:'#34d399' },
                    { label:'Runs/G',  field:'runs',      color:'#60a5fa' },
                    { label:'HR/G',    field:'homeRuns',  color:'#f59e0b' },
                  ].map(({ label, field, color }) => {
                    const l10 = gameLog.slice(-10).map(g => Number(g[field]) || 0);
                    const l5  = l10.slice(-5);
                    const l5avg  = l5.reduce((a,b)=>a+b,0) / Math.max(l5.length,1);
                    const l10avg = l10.reduce((a,b)=>a+b,0) / Math.max(l10.length,1);
                    const heating = l10.length >= 6 && l5avg - l10avg > 0.20;
                    const cooling = l10.length >= 6 && l10avg - l5avg > 0.20;
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-gray-500">{label}</span>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {heating && <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">heating up ↑</span>}
                            {cooling && <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">cooling off ↓</span>}
                            <span className="text-xs text-gray-600 tabular-nums">L5: {l5avg.toFixed(2)} · L10: {l10avg.toFixed(2)}</span>
                          </div>
                        </div>
                        <Sparkline values={l10} width={340} height={32} color={color}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Park Factor + Lineup Position ──────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <ParkFactorCard
                spTeamAbbrev={spTeamAbbrev}
                spOppAbbrev={spOppAbbrev}
                spIsHome={spIsHome}
                activeCat={cat}
              />
              <LineupPositionCard games={gameLog} loading={chartLoading}/>
            </div>

          </>
        )}

      </main>
    </div>
  );
}
