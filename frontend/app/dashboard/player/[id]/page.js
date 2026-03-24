'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

// ─── Logo ─────────────────────────────────────────────────────────────────────
function LogoMark({ size=30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <path d="M17 1.5L32.5 17L17 32.5L1.5 17Z" fill="#0a1628" stroke="#2563eb" strokeWidth="1.5"/>
      <path d="M17 5.5L28.5 17L17 28.5L5.5 17Z" fill="#0f2548" opacity="0.55"/>
      <path d="M17 25L8.5 21.5L9 16L17 19Z" fill="#1e40af"/>
      <path d="M17 25L25.5 21.5L25 16L17 19Z" fill="#3b82f6"/>
      <line x1="17" y1="19" x2="17" y2="25" stroke="#93c5fd" strokeWidth="0.8" opacity="0.55"/>
      <path d="M17 19C13.5 17.5 12.5 13.5 15 10.5C16 9.2 17 8.2 17 8.2C17 8.2 18 9.2 19 10.5C21.5 13.5 20.5 17.5 17 19Z" fill="#60a5fa"/>
      <path d="M17 17.5C15.8 16 15.5 13.5 16.5 12C17 13 17.5 15.2 17 17.5Z" fill="white" opacity="0.28"/>
      <circle cx="17" cy="8.2" r="1.5" fill="#bae6fd" opacity="0.9"/>
    </svg>
  );
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
  const [cat,         setCat]         = useState('hits');
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

  // ── On line change, reset to first valid line for new cat ─────────────────
  useEffect(() => {
    const cfg = PROP_CATS.find(c => c.id === cat);
    if (cfg && !cfg.lines.includes(line)) setLine(cfg.def);
  }, [cat]);

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
  const pitcherScore = useMemo(() => {
    if (!isPitcherView || !seasonStats?.era) return null;
    return pitcherScoreFromERA(parseFloat(seasonStats.era));
  }, [isPitcherView, seasonStats]);

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
            <Link href="/" className="flex items-center gap-2.5 group">
              <LogoMark />
              <span className="text-base font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">Cook The Books</span>
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
            <div className="flex-shrink-0 text-center">
              {isPitcherView
                ? pitcherScore != null
                  ? <><ScoreRing score={pitcherScore} size={64}/><p className="text-xs text-gray-600 mt-1">ERA Score</p></>
                  : loading
                    ? <Skeleton className="w-16 h-16 rounded-full"/>
                    : <div className="w-16 h-16 rounded-full border-2 border-gray-800 bg-gray-800/50 flex items-center justify-center"><span className="text-gray-700 text-xs">N/A</span></div>
                : modelScore != null
                  ? <><ScoreRing score={modelScore} size={64}/><p className="text-xs text-gray-600 mt-1">Model</p></>
                  : <div className="w-16 h-16 rounded-full border-2 border-gray-800 bg-gray-800/50 flex items-center justify-center"><span className="text-gray-700 text-xs">N/A</span></div>
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
              <span className="text-xs text-gray-600">Cook The Books Model · {catCfg?.label}</span>
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

            {/* ── L10 Starts Table ─────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-base">📋</span>
                <h3 className="text-sm font-bold text-white">Last 10 Starts</h3>
                {!chartLoading && pitcherStarts.length > 0 && (() => {
                  const last10 = pitcherStarts.slice(-10);
                  const avgK = (last10.reduce((a,s)=>a+s.strikeOuts,0)/last10.length).toFixed(1);
                  const avgER= (last10.reduce((a,s)=>a+s.earnedRuns,0)/last10.length).toFixed(2);
                  return (
                    <span className="ml-auto text-xs text-gray-600">
                      avg <span className="text-emerald-400 font-bold">{avgK}K</span>
                      {' · '}
                      <span className="text-yellow-400 font-bold">{avgER} ER</span>
                    </span>
                  );
                })()}
              </div>
              <PitcherStartsTable starts={pitcherStarts} loading={chartLoading}/>
            </div>

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
                    { label:'Strikeouts', value: seasonStats.strikeOuts || 0, cls: statCls(parseInt(seasonStats.strikeOuts)||0, 150, 100) },
                    { label:'Innings Pitched', value: seasonStats.inningsPitched || '0', cls: statCls(parseFloat(seasonStats.inningsPitched)||0, 150, 100) },
                    { label:'HR Allowed',   value: seasonStats.homeRuns || 0, cls: statCls(20-(parseInt(seasonStats.homeRuns)||0), 10, 5) },
                    { label:'Walks',        value: seasonStats.baseOnBalls || 0, cls: statCls(60-(parseInt(seasonStats.baseOnBalls)||0), 20, 0) },
                    { label:'Wins',         value: seasonStats.wins || 0, cls: statCls(parseInt(seasonStats.wins)||0, 15, 10) },
                    { label:'Losses',       value: seasonStats.losses || 0, cls: { text:'text-gray-400', bg:'bg-gray-800/50 border-gray-800' } },
                    { label:'Hits Allowed', value: seasonStats.hits || 0, cls: statCls(200-(parseInt(seasonStats.hits)||0), 80, 30) },
                    { label:'Starts',       value: seasonStats.gamesStarted || seasonStats.gamesPlayed || 0, cls: { text:'text-blue-400', bg:'bg-blue-500/10 border-blue-500/30' } },
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
                    ? <div className="space-y-2">{[1,2,3,4].map(i=><Skeleton key={i} className="h-5 w-full"/>)}</div>
                    : <p className="text-sm text-gray-600 italic">Statcast data not available.</p>
                ) : (
                  <div className="space-y-1">
                    <StatRow label="xwOBA (Expected)" value={fmt(statcast.xwoba,3)} highlight={statCls(statcast.xwoba||0,0.37,0.32).text} sub="luck-adjusted"/>
                    <StatRow label="Barrel %" value={statcast.barrelPct!=null?`${statcast.barrelPct.toFixed(1)}%`:'—'} highlight={statCls(statcast.barrelPct||0,12,6).text}/>
                    <StatRow label="Hard Hit % (95+ mph)" value={statcast.hardHitPct!=null?`${statcast.hardHitPct.toFixed(1)}%`:'—'} highlight={statCls(statcast.hardHitPct||0,50,40).text}/>
                    <StatRow label="Avg Exit Velocity" value={statcast.exitVelo!=null?`${statcast.exitVelo.toFixed(1)} mph`:'—'} highlight={statCls(statcast.exitVelo||0,92,88).text}/>
                    <div className="mt-3 pt-3 border-t border-gray-800/60 text-xs text-gray-600 italic">
                      Source: Baseball Savant 2025 · Updated every 6h
                    </div>
                  </div>
                )}
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
            </div>

            {/* ── Reserved Real Estate ───────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {[
                { icon:'🏟️', title:'Park Factor', desc:'How this stadium affects HR, hits, and run scoring relative to league average.', tag:'Coming Soon' },
                { icon:'📍', title:'Lineup Position', desc:'Expected batting order position — drives R/RBI opportunity context.', tag:'Posts ~3h Before Game' },
              ].map(item => (
                <div key={item.title} className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{item.icon}</span>
                    <h3 className="text-sm font-bold text-gray-500">{item.title}</h3>
                  </div>
                  <p className="text-xs text-gray-700 mb-3">{item.desc}</p>
                  <span className="text-xs text-gray-700 border border-gray-800 rounded-full px-2 py-0.5">{item.tag}</span>
                </div>
              ))}
            </div>
          </>
        )}

      </main>
    </div>
  );
}
