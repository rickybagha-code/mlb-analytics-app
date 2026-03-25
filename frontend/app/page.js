'use client';
import Link from 'next/link';
import { useState } from 'react';
import ProprStatsLogo from '../components/ProprStatsLogo';

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center group">
            <ProprStatsLogo variant="light" size={32} wordmarkClass="group-hover:text-blue-400 transition-colors" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#ev-model" className="text-sm text-gray-400 hover:text-white transition-colors">EV Model</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 hover:-translate-y-px"
          >
            Get Started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Sample Player Dashboard Card ────────────────────────────────────────────
function SamplePlayerCard() {
  const hits  = [2, 1, 3, 2, 0, 2, 1, 2, 3, 2];
  const dates = ['3/13','3/14','3/15','3/16','3/17','3/18','3/19','3/20','3/21','3/22'];
  const line  = 1.5;
  const overCount = hits.filter(h => h > line).length;
  const score = 87;
  const r = 18, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const BAR_W = 28, GAP = 5;
  const VW = hits.length * (BAR_W + GAP) + GAP;
  const H = 116, PT = 16, PB = 28, CH = H - PT - PB;
  const maxVal = 4;
  const lineY = PT + CH * (1 - line / maxVal);

  return (
    <div className="relative rounded-2xl border border-blue-500/20 bg-gray-900 p-5 shadow-2xl shadow-blue-500/10">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 pointer-events-none"/>
      <div className="absolute -inset-px rounded-2xl ring-1 ring-blue-500/10 pointer-events-none"/>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium uppercase tracking-widest text-gray-500">Player Analysis</span>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Live
        </span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <img
          src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/592450/headshot/67/current"
          alt="Aaron Judge" width={56} height={56}
          className="rounded-full border-2 border-gray-700 bg-gray-800 object-cover flex-shrink-0"
          style={{width:56,height:56}}
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white leading-tight">Aaron Judge</p>
          <p className="text-xs text-gray-500">OF · NYY · Bats R</p>
          <p className="text-xs text-blue-400 mt-0.5">vs T. Skubal · LHP · 2.94 ERA</p>
        </div>
        <div className="relative flex items-center justify-center flex-shrink-0" style={{width:52,height:52}}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r={r} fill="none" stroke="#1f2937" strokeWidth="3.5"/>
            <circle cx="26" cy="26" r={r} fill="none" stroke="#34d399" strokeWidth="3.5"
              strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" transform="rotate(-90 26 26)"/>
          </svg>
          <div className="absolute text-center">
            <div className="text-xs font-black text-emerald-400 leading-none">{score}</div>
            <div className="text-gray-600 leading-none" style={{fontSize:7}}>Model</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">Hits — Last 10 Games</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">Line: 1.5</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-emerald-400">{overCount}/10 OVER</span>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-2.5 h-2 rounded-sm bg-emerald-500/80 inline-block"/>Over
            <span className="w-2.5 h-2 rounded-sm bg-red-500/80 inline-block ml-1.5"/>Under
          </div>
        </div>
      </div>
      <div className="mb-4 rounded-xl bg-gray-950/60 border border-gray-800/50 px-1 pt-1 pb-0.5">
        <svg viewBox={`0 0 ${VW} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
          {[1,2,3,4].map(v => (
            <line key={v} x1={0} y1={PT + CH*(1-v/maxVal)} x2={VW} y2={PT + CH*(1-v/maxVal)} stroke="#1f2937" strokeWidth="1"/>
          ))}
          <line x1={0} y1={lineY} x2={VW} y2={lineY} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9"/>
          {hits.map((val, i) => {
            const isOver = val > line;
            const barX = i * (BAR_W + GAP) + GAP;
            const barH = Math.max(3, (val / maxVal) * CH);
            const barY = PT + CH * (1 - val / maxVal);
            const lblY = barY > PT + 12 ? barY - 4 : barY + 12;
            return (
              <g key={i}>
                <rect x={barX+1} y={barY+1} width={BAR_W} height={barH} rx={3} fill={isOver ? '#16a34a' : val===0 ? '#111827' : '#b91c1c'} opacity="0.3"/>
                <rect x={barX} y={barY} width={BAR_W} height={barH} rx={3} fill={val===0 ? '#1f2937' : isOver ? '#22c55e' : '#ef4444'} opacity="0.88"/>
                {barH > 6 && <rect x={barX+3} y={barY+2} width={BAR_W-6} height={2} rx={1} fill="white" opacity="0.1"/>}
                <text x={barX+BAR_W/2} y={lblY} textAnchor="middle" fill="white" fontSize="9" fontWeight="700">{val}</text>
                <text x={barX+BAR_W/2} y={H-PB+13} textAnchor="middle" fill="#6b7280" fontSize="7.5">{dates[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {[
          { l:'AVG',      v:'.327', c:'text-emerald-400' },
          { l:'OPS',      v:'.987', c:'text-emerald-400' },
          { l:'Barrel%',  v:'20.1%',c:'text-yellow-400'  },
          { l:'Hard Hit%',v:'63.1%',c:'text-emerald-400' },
        ].map(s => (
          <div key={s.l} className="rounded-lg bg-gray-800/60 border border-gray-700/40 py-2 text-center">
            <div className={`text-xs font-black tabular-nums ${s.c}`}>{s.v}</div>
            <div className="text-gray-600 mt-0.5" style={{fontSize:9}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 flex items-center justify-between">
        <span className="text-sm font-bold text-emerald-400">Strong Value — Over 1.5</span>
        <span className="text-xs text-gray-600">ProprStats</span>
      </div>
    </div>
  );
}

function SampleSideCards() {
  return (
    <div className="flex flex-col gap-3 mt-3">
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-white">Handedness Splits</span>
          <span className="ml-auto text-xs text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">Today</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label:'vs Left',  stats:[{l:'AVG',v:'.341',c:'text-emerald-400'},{l:'OPS',v:'1.042',c:'text-emerald-400'}] },
            { label:'vs Right', stats:[{l:'AVG',v:'.301',c:'text-yellow-400'}, {l:'OPS',v:'.921',c:'text-emerald-400'}] },
          ].map(row => (
            <div key={row.label} className={`rounded-lg p-2.5 border ${row.label==='vs Left' ? 'border-blue-500/30 bg-blue-500/5' : 'border-gray-800 bg-gray-800/30'}`}>
              <p className={`text-xs font-bold mb-1.5 ${row.label==='vs Left' ? 'text-blue-400' : 'text-gray-500'}`}>{row.label}</p>
              <div className="flex gap-3">
                {row.stats.map(s => (
                  <div key={s.l}>
                    <div className={`text-xs font-black tabular-nums ${s.c}`}>{s.v}</div>
                    <div className="text-gray-600" style={{fontSize:9}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-white">Career vs Pitcher</span>
          <span className="ml-auto text-xs text-gray-500 tabular-nums">42 AB career</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            {l:'AVG',v:'.333',c:'text-emerald-400'},
            {l:'OBP',v:'.381',c:'text-emerald-400'},
            {l:'SLG',v:'.619',c:'text-emerald-400'},
            {l:'OPS',v:'1.000',c:'text-emerald-400'},
            {l:'HR', v:'5',   c:'text-yellow-400'},
          ].map(s => (
            <div key={s.l} className="rounded bg-gray-800/60 border border-gray-700/30 py-1.5 text-center">
              <div className={`text-xs font-black tabular-nums ${s.c}`}>{s.v}</div>
              <div className="text-gray-600" style={{fontSize:9}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0 hero-grid"/>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-blue-600/6 blur-3xl pointer-events-none"/>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[300px] w-[500px] rounded-full bg-blue-500/8 blur-2xl pointer-events-none"/>
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none"/>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">

          {/* Left copy */}
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"/>
              <span className="text-sm font-medium text-blue-300">Live Data · Updated Daily</span>
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Stop Guessing.<br/>
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent">
                Start Cooking.
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-gray-400">
              ProprStats turns raw MLB Statcast data into a clear edge signal for every prop — hits, home runs, runs, RBI, and strikeouts. Know if the line is mispriced before you bet it.
            </p>

            {/* 3-col trust row */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: '6 Prop Models', sub: 'Hits · HR · R · RBI · SB · Ks',
                  icon: <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg> },
                { label: 'Poisson EV%', sub: 'Model vs devigged odds',
                  icon: <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg> },
                { label: 'Live Statcast', sub: 'xwOBA · Barrel% · Hard Hit%',
                  icon: <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
              ].map(p => (
                <div key={p.label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 text-center">
                  <div className="flex justify-center mb-1.5">{p.icon}</div>
                  <div className="text-xs font-bold text-white">{p.label}</div>
                  <div className="text-gray-600 mt-0.5 leading-tight" style={{fontSize:9}}>{p.sub}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Analyzing Free
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
              <a
                href="#ev-model"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-7 py-3.5 text-base font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-all"
              >
                See how the EV model works →
              </a>
            </div>
            <p className="mt-3 text-xs text-gray-600">No credit card required · Free to start</p>
          </div>

          {/* Right preview */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm">
              <SamplePlayerCard/>
              <SampleSideCards/>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Browse the Board',
      desc: 'Open the dashboard to see every batter with a probable pitcher today, scored and sorted by the model.',
      color: 'blue',
    },
    {
      num: '02',
      title: 'Deep Dive Any Player',
      desc: 'Click a card to see their full breakdown — L5/L10 chart, Statcast quality, handedness splits, and career H2H.',
      color: 'cyan',
    },
    {
      num: '03',
      title: 'Make Confident Picks',
      desc: 'The 0–100 ProprStats score and EV% signal tells you exactly where the line is mispriced — and how much edge you have.',
      color: 'emerald',
    },
  ];
  const colorMap = {
    blue:    { num: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/10',    glow: 'shadow-blue-500/10'    },
    cyan:    { num: 'text-cyan-400',    border: 'border-cyan-500/30',    bg: 'bg-cyan-500/10',    glow: 'shadow-cyan-500/10'    },
    emerald: { num: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/10' },
  };
  return (
    <section id="how-it-works" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none"/>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"/>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">How It Works</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Research in{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Three Steps
            </span>
          </h2>
          <p className="mt-3 text-gray-400 max-w-xl mx-auto">
            From raw matchup data to a confident prop pick — in under a minute.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          <div className="hidden lg:block absolute top-12 left-[calc(33.333%+1rem)] right-[calc(33.333%+1rem)] h-px bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-emerald-500/30"/>
          {steps.map((step) => {
            const c = colorMap[step.color];
            return (
              <div key={step.num} className={`relative rounded-2xl border ${c.border} bg-gray-900/60 p-7 shadow-xl ${c.glow}`}>
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${c.bg} border ${c.border} mb-5`}>
                  <span className={`text-xl font-black tabular-nums ${c.num}`}>{step.num}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Open the dashboard →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    num: '01',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
        <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      </svg>
    ),
    title: 'Composite Model Score',
    description: 'A proprietary 0–100 score blending wOBA, xwOBA, barrel%, hard hit%, recency trends, and today\'s pitcher — condensed into a single number you can act on.',
  },
  {
    num: '02',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: 'Statcast Integration',
    description: 'xwOBA strips out BABIP luck. Barrel% and hard hit% (95+ mph) expose who\'s genuinely hitting the ball hard — regardless of what the box score says.',
  },
  {
    num: '03',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
    title: 'Recency-Weighted Trends',
    description: 'L5 and L10 game logs visualized as color-coded bar charts. Cold snaps and hot streaks feed directly into the model score in real time.',
  },
  {
    num: '04',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5"/><path d="M8 3H3v5"/>
        <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/>
        <path d="M12 22v-8.3a4 4 0 0 1 1.172-2.872L21 3"/>
      </svg>
    ),
    title: 'Auto Handedness Splits',
    description: 'vs LHP and vs RHP splits auto-matched against today\'s probable starter. The right platoon stats, resolved for you — every game, every day.',
  },
  {
    num: '05',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Career Head-to-Head',
    description: 'Full batter-vs-pitcher career history — AB, H, 2B, HR, RBI, AVG, OBP, SLG, OPS, and wOBA in a single card. Know who owns who before the first pitch.',
  },
  {
    num: '06',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    title: 'Full Prop Categories',
    description: 'Hits, Home Runs, Runs, RBI, and Stolen Bases — each category scored independently with its own model weighting and line-specific context.',
  },
  {
    num: '07',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/>
      </svg>
    ),
    title: 'Prop EV Model',
    description: 'Poisson distribution across every prop total, an EV% gauge that measures model probability vs. devigged book price, and a factor breakdown — for all five prop types.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"/>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Platform Features</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Every Edge, In One Place
          </h2>
          <p className="mt-3 text-gray-400 max-w-2xl mx-auto">
            Stop juggling Baseball Savant, FanGraphs, and box scores. ProprStats pulls it all together — automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.num}
              className="group relative rounded-xl border border-gray-800 bg-gray-900 p-6 overflow-hidden transition-all duration-300 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/8 hover:-translate-y-0.5"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"/>
              <div className="absolute -top-12 -left-12 h-32 w-32 bg-blue-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"/>

              <div className="flex items-start justify-between mb-5">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/15 group-hover:text-blue-300 transition-all duration-300">
                  {f.icon}
                </div>
                <span className="text-xs font-black tabular-nums text-gray-700 group-hover:text-gray-600 transition-colors">{f.num}</span>
              </div>
              <h3 className="mb-2 text-sm font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-gray-500 group-hover:text-gray-400 transition-colors">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── EV Model Section ─────────────────────────────────────────────────────────
const DEMO_BARS = {
  strikeouts: [
    { k:0,  h:3,   over:false }, { k:1,  h:4,   over:false }, { k:2,  h:15,  over:false },
    { k:3,  h:34,  over:false }, { k:4,  h:62,  over:false }, { k:5,  h:90,  over:false },
    { k:6,  h:107, over:false }, { k:7,  h:110, over:true  }, { k:8,  h:99,  over:true  },
    { k:9,  h:79,  over:true  }, { k:10, h:57,  over:true  }, { k:11, h:37,  over:true  },
    { k:12, h:23,  over:true  }, { k:13, h:12,  over:true  }, { k:14, h:7,   over:true  },
  ],
  hits: [
    { k:0, h:25, over:false }, { k:1, h:72, over:false },
    { k:2, h:110, over:true }, { k:3, h:82, over:true },
    { k:4, h:44, over:true  }, { k:5, h:17, over:true }, { k:6, h:5, over:true },
  ],
  hr: [
    { k:0, h:110, over:false }, { k:1, h:27, over:true }, { k:2, h:4, over:true },
  ],
  runs: [
    { k:0, h:66, over:false }, { k:1, h:110, over:true },
    { k:2, h:76, over:true  }, { k:3, h:32, over:true }, { k:4, h:10, over:true },
  ],
  rbi: [
    { k:0, h:74, over:false }, { k:1, h:110, over:true },
    { k:2, h:70, over:true  }, { k:3, h:28, over:true }, { k:4, h:8, over:true },
  ],
};

const DEMO_PROPS = {
  strikeouts: {
    label:'Strikeouts', line:'6.5', projVal:'7.2', ci:'5.1–9.3', evPct:4.7,
    pOver:'60.0', pUnder:'40.0', xAxisLabel:'Strikeouts',
    tiles:[
      { label:'Proj Ks',   val:'7.2',     cls:'text-blue-400',    bg:'bg-blue-500/10 border-blue-500/30'     },
      { label:'80% CI',    val:'5.1–9.3', cls:'text-gray-300',    bg:'bg-gray-800/60 border-gray-700/40'     },
      { label:'Book Line', val:'6.5',     cls:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/30'   },
      { label:'EV Signal', val:'+4.7%',   cls:'text-yellow-400',  bg:'bg-yellow-500/10 border-yellow-500/30' },
    ],
    factors:[
      { label:'L5 K avg',       impact:'+1.70', dir:'↑', cls:'text-emerald-400' },
      { label:'Season K/start', impact:'+0.30', dir:'↑', cls:'text-emerald-400' },
      { label:'Rest/weather',   impact:'+0.20', dir:'↑', cls:'text-emerald-400' },
      { label:'Park factor',    impact:'—',     dir:'',  cls:'text-gray-600'    },
    ],
  },
  hits: {
    label:'Hits', line:'1.5', projVal:'1.9', ci:'0.8–3.0', evPct:3.2,
    pOver:'52.4', pUnder:'47.6', xAxisLabel:'Hits',
    tiles:[
      { label:'Proj H',    val:'1.9',     cls:'text-blue-400',    bg:'bg-blue-500/10 border-blue-500/30'     },
      { label:'80% CI',    val:'0.8–3.0', cls:'text-gray-300',    bg:'bg-gray-800/60 border-gray-700/40'     },
      { label:'Book Line', val:'1.5',     cls:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/30'   },
      { label:'EV Signal', val:'+3.2%',   cls:'text-yellow-400',  bg:'bg-yellow-500/10 border-yellow-500/30' },
    ],
    factors:[
      { label:'L10 H avg',       impact:'+0.40', dir:'↑', cls:'text-emerald-400' },
      { label:'Season BA',       impact:'+0.20', dir:'↑', cls:'text-emerald-400' },
      { label:'Handedness split',impact:'+0.10', dir:'↑', cls:'text-emerald-400' },
      { label:'Park factor',     impact:'—',     dir:'',  cls:'text-gray-600'    },
    ],
  },
  hr: {
    label:'Home Runs', line:'0.5', projVal:'0.22', ci:'0–1', evPct:6.8,
    pOver:'19.7', pUnder:'80.3', xAxisLabel:'Home Runs',
    tiles:[
      { label:'Proj HR',   val:'0.22', cls:'text-blue-400',    bg:'bg-blue-500/10 border-blue-500/30'       },
      { label:'80% CI',    val:'0–1',  cls:'text-gray-300',    bg:'bg-gray-800/60 border-gray-700/40'       },
      { label:'Book Line', val:'0.5',  cls:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/30'     },
      { label:'EV Signal', val:'+6.8%',cls:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30' },
    ],
    factors:[
      { label:'HR rate (L10)',   impact:'+0.08', dir:'↑', cls:'text-emerald-400' },
      { label:'Barrel% vs SP',   impact:'+0.06', dir:'↑', cls:'text-emerald-400' },
      { label:'Park HR factor',  impact:'+0.04', dir:'↑', cls:'text-emerald-400' },
      { label:'Handedness',      impact:'—',     dir:'',  cls:'text-gray-600'    },
    ],
  },
  runs: {
    label:'Runs', line:'0.5', projVal:'0.72', ci:'0–2', evPct:-1.4,
    pOver:'51.3', pUnder:'48.7', xAxisLabel:'Runs',
    tiles:[
      { label:'Proj R',    val:'0.72',  cls:'text-blue-400',  bg:'bg-blue-500/10 border-blue-500/30'   },
      { label:'80% CI',    val:'0–2',   cls:'text-gray-300',  bg:'bg-gray-800/60 border-gray-700/40'   },
      { label:'Book Line', val:'0.5',   cls:'text-amber-400', bg:'bg-amber-500/10 border-amber-500/30' },
      { label:'EV Signal', val:'-1.4%', cls:'text-red-400',   bg:'bg-red-500/10 border-red-500/30'     },
    ],
    factors:[
      { label:'L10 R avg',   impact:'+0.18', dir:'↑', cls:'text-emerald-400' },
      { label:'Lineup slot', impact:'-0.12', dir:'↓', cls:'text-red-400'     },
      { label:'Pitcher ERA', impact:'-0.10', dir:'↓', cls:'text-red-400'     },
      { label:'Park factor', impact:'+0.06', dir:'↑', cls:'text-emerald-400' },
    ],
  },
  rbi: {
    label:'RBI', line:'0.5', projVal:'0.68', ci:'0–2', evPct:5.1,
    pOver:'43.1', pUnder:'56.9', xAxisLabel:'RBI',
    tiles:[
      { label:'Proj RBI',  val:'0.68',  cls:'text-blue-400',    bg:'bg-blue-500/10 border-blue-500/30'       },
      { label:'80% CI',    val:'0–2',   cls:'text-gray-300',    bg:'bg-gray-800/60 border-gray-700/40'       },
      { label:'Book Line', val:'0.5',   cls:'text-amber-400',   bg:'bg-amber-500/10 border-amber-500/30'     },
      { label:'EV Signal', val:'+5.1%', cls:'text-emerald-400', bg:'bg-emerald-500/10 border-emerald-500/30' },
    ],
    factors:[
      { label:'L10 RBI avg', impact:'+0.22', dir:'↑', cls:'text-emerald-400' },
      { label:'SLG vs SP',   impact:'+0.14', dir:'↑', cls:'text-emerald-400' },
      { label:'RISP OPS',    impact:'+0.08', dir:'↑', cls:'text-emerald-400' },
      { label:'Park factor', impact:'—',     dir:'',  cls:'text-gray-600'    },
    ],
  },
};

function InteractiveDemoCard({ propKey }) {
  const prop = DEMO_PROPS[propKey];
  const bars = DEMO_BARS[propKey];

  const evPct = prop.evPct;
  const norm = Math.max(0, Math.min(1, (evPct + 15) / 30));
  const sweep = norm * 180;
  const cx = 80, cy = 72, R = 54, sw = 13;
  const d2r = d => d * Math.PI / 180;
  const sx = cx + R * Math.cos(d2r(180));
  const sy = cy + R * Math.sin(d2r(180));
  const ex = cx + R * Math.cos(d2r(180 + sweep));
  const ey = cy + R * Math.sin(d2r(180 + sweep));
  const gaugeColor = evPct >= 5 ? '#34d399' : evPct >= 2 ? '#eab308' : evPct >= 0 ? '#6b7280' : '#ef4444';
  const evSign = evPct > 0 ? '+' : '';

  const barW = 19, gap = 2.2, H = 148, PT = 22, PB = 26, PL = 8;
  const CH = H - PT - PB;
  const W = PL * 2 + bars.length * (barW + gap);
  const lineBarIdx = bars.findIndex(b => b.over);
  const lineX = PL + lineBarIdx * (barW + gap) - 1;

  return (
    <div className="relative rounded-2xl border border-blue-500/20 bg-gray-900 p-5 shadow-2xl shadow-blue-500/10">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 pointer-events-none"/>
      <div className="absolute -inset-px rounded-2xl ring-1 ring-blue-500/10 pointer-events-none"/>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-white leading-tight">Prop EV Model</p>
          <p className="text-xs text-gray-500">{prop.label} · Line {prop.line}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>Live
        </span>
      </div>

      {/* 4 tiles */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {prop.tiles.map(t => (
          <div key={t.label} className={`rounded-lg border p-2 text-center ${t.bg}`}>
            <div className={`text-xs font-black tabular-nums ${t.cls}`}>{t.val}</div>
            <div className="text-gray-600 mt-0.5" style={{fontSize:8}}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Poisson chart + EV gauge */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="col-span-3 rounded-xl bg-gray-950/60 border border-gray-800/50 px-1 pt-1 pb-0.5">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
            <text x={W*0.28} y={13} textAnchor="middle" fill="#60a5fb" fontSize="8" fontWeight="700">P(Under) {prop.pUnder}%</text>
            <text x={W*0.72} y={13} textAnchor="middle" fill="#f59e0b" fontSize="8" fontWeight="700">P(Over) {prop.pOver}%</text>
            {bars.map(({ k, h, over }) => {
              const x = PL + k * (barW + gap);
              const y = PT + CH - h;
              return (
                <g key={k}>
                  <rect x={x} y={y} width={barW} height={h} rx={2}
                    fill={over ? '#f59e0b' : '#3b82f6'} opacity="0.85"/>
                </g>
              );
            })}
            <line x1={lineX} y1={PT-4} x2={lineX} y2={H-PB+4} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 2"/>
            {bars.map(({ k }) => (
              <text key={k} x={PL+k*(barW+gap)+barW/2} y={H-PB+12} textAnchor="middle" fill="#6b7280" fontSize="7">{k}</text>
            ))}
            <text x={W/2} y={H-1} textAnchor="middle" fill="#374151" fontSize="7">{prop.xAxisLabel}</text>
          </svg>
        </div>

        <div className="col-span-2 flex items-center justify-center">
          <svg width={cx*2} height={cy+20} viewBox={`0 0 ${cx*2} ${cy+20}`} style={{overflow:'visible'}}>
            <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`}
              fill="none" stroke="#1f2937" strokeWidth={sw} strokeLinecap="round"/>
            <path d={`M ${sx} ${sy} A ${R} ${R} 0 0 1 ${ex} ${ey}`}
              fill="none" stroke={gaugeColor} strokeWidth={sw} strokeLinecap="round"/>
            <text x={cx} y={cy-20} textAnchor="middle" fontSize="18" fontWeight="900" fill={gaugeColor} fontFamily="monospace">{evSign}{evPct}%</text>
            <text x={cx} y={cy-6}  textAnchor="middle" fontSize="8" fill="#6b7280">EV Edge</text>
            <text x={cx-R-2} y={cy+14} textAnchor="end"   fontSize="7" fill="#374151">-15%</text>
            <text x={cx+R+2} y={cy+14} textAnchor="start" fontSize="7" fill="#374151">+15%</text>
          </svg>
        </div>
      </div>

      {/* Factor table */}
      <div className="rounded-lg border border-gray-800 bg-gray-950/40 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800">
          <span className="text-xs font-bold text-gray-400">Factor Breakdown</span>
        </div>
        {prop.factors.map(f => (
          <div key={f.label} className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 last:border-0">
            <span className="text-xs text-gray-500">{f.label}</span>
            <span className={`text-xs font-bold tabular-nums ${f.cls}`}>{f.dir} {f.impact}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EVSection() {
  const [activeProp, setActiveProp] = useState('strikeouts');
  const PROP_TABS = [
    { id:'hits',       label:'Hits'       },
    { id:'hr',         label:'Home Runs'  },
    { id:'runs',       label:'Runs'       },
    { id:'rbi',        label:'RBI'        },
    { id:'strikeouts', label:'Strikeouts' },
  ];

  return (
    <section id="ev-model" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none"/>
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-blue-600/5 blur-3xl rounded-full pointer-events-none"/>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left copy */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"/>
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Prop Intelligence</span>
            </div>

            <h2 className="text-3xl font-bold text-white sm:text-4xl leading-tight">
              Know Where Every Line<br/>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Is Mispriced
              </span>
            </h2>

            <p className="mt-4 text-gray-400 leading-relaxed">
              Our Poisson EV model runs across all five prop categories — hits, home runs, runs, RBI, and stolen bases — building a full probability distribution for each, then comparing it against the devigged book price to surface genuine edge.
            </p>

            <div className="mt-8 space-y-4">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/>
                    </svg>
                  ),
                  title: 'Full Distribution',
                  desc: 'P(k) curve across every possible outcome — so you see P(Over) and P(Under) for any book line, not just the projected mean.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                    </svg>
                  ),
                  title: 'EV% Signal',
                  desc: 'Model probability vs. devigged implied odds. Positive EV means the line is mispriced in your favor. Negative EV = fade or pass.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                  ),
                  title: 'Confidence Band',
                  desc: 'Lower and upper bounds on the projection — know the realistic floor and ceiling before you size the bet.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ),
                  title: 'All 5 Prop Types',
                  desc: 'One model framework across Hits, HR, Runs, RBI, and SB — consistent methodology whether you\'re fading a cold bat or riding a hot arm.',
                },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3.5">
                  <div className="flex-shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800/80 border border-gray-700/50">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all hover:-translate-y-0.5"
              >
                See It on a Live Player
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* Right interactive card */}
          <div className="flex flex-col items-center lg:items-end gap-4">
            {/* Prop selector pills */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-end">
              {PROP_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveProp(tab.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeProp === tab.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : 'border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="w-full max-w-sm">
              <InteractiveDemoCard propKey={activeProp} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Great for casual research and trying out the model.',
    highlight: false,
    features: [
      'Full dashboard access',
      'Basic batter & pitcher stats',
      'Handedness splits',
      'L5 game log charts',
    ],
    cta: 'Start Free',
    ctaHref: '/dashboard',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'The full toolkit for serious prop researchers.',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Everything in Free',
      'Statcast xwOBA + Barrel% model',
      'Career head-to-head history',
      'L10 recency-weighted scores',
      'Real-time weather intelligence',
      'Priority email support',
    ],
    cta: 'Start Pro Trial',
    ctaHref: '/dashboard',
  },
  {
    name: 'Elite',
    price: '$79',
    period: '/month',
    description: 'For power users and professional handicappers.',
    highlight: false,
    features: [
      'Everything in Pro',
      'Full REST API access',
      'CSV bulk export',
      'Custom backtesting (date range)',
      'Dedicated Slack channel',
      'Priority feature requests',
    ],
    cta: 'Go Elite',
    ctaHref: '/dashboard',
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/8 to-transparent pointer-events-none"/>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"/>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Pricing</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Simple, Transparent Pricing</h2>
          <p className="mt-3 text-gray-400">No hidden fees. Cancel anytime. Start free forever.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                plan.highlight
                  ? 'border-blue-500/50 bg-gray-900 shadow-[0_0_60px_rgba(59,130,246,0.12)]'
                  : 'border-gray-800 bg-gray-900/60'
              }`}
            >
              {plan.highlight && (
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-t-2xl"/>
              )}
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="mb-6">
                <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-blue-400' : 'text-gray-500'}`}>{plan.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
              </div>
              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${plan.highlight ? 'text-blue-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                    <span className="text-sm text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`block w-full rounded-xl py-3 text-center text-sm font-bold transition-all ${
                  plan.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/25 hover:-translate-y-px'
                    : 'border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {['No credit card required', 'Cancel anytime', 'For research purposes only', 'MLB season data — updated daily'].map(t => (
            <div key={t} className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="h-3.5 w-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
              </svg>
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Bottom CTA ───────────────────────────────────────────────────────────────
function BottomCTA() {
  const quotes = [
    { text: 'Finally a tool that shows the math behind the edge — not just a pick.', handle: '@propgrinder' },
    { text: 'The Poisson chart and EV% gauge changed how I approach K props. Night and day.', handle: '@sharpbettingpod' },
    { text: 'Statcast + head-to-head in one place. I stopped using five tabs the same day.', handle: '@baseballbettingpro' },
  ];

  return (
    <section className="py-20 px-4">
      <div className="mx-auto max-w-5xl">

        {/* Social proof strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {quotes.map(q => (
            <div key={q.handle} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
              <p className="text-sm text-gray-300 leading-relaxed mb-3">&ldquo;{q.text}&rdquo;</p>
              <p className="text-xs font-semibold text-blue-400">{q.handle}</p>
            </div>
          ))}
        </div>

        {/* CTA card */}
        <div className="relative rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-950/40 via-gray-900 to-gray-900 p-12 text-center overflow-hidden shadow-2xl shadow-blue-500/5">
          <div className="absolute inset-0 hero-grid opacity-50 pointer-events-none"/>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-blue-500/10 blur-3xl rounded-full pointer-events-none"/>
          <div className="absolute -inset-px rounded-3xl ring-1 ring-blue-500/15 pointer-events-none"/>

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"/>
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Ready to Research?</span>
            </div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-black text-white leading-tight">
              Your Edge Is<br/>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                One Click Away
              </span>
            </h2>
            <p className="mt-4 text-gray-400 max-w-lg mx-auto">
              Join prop researchers who use ProprStats every game day to find mispriced lines before they close. The dashboard is live now — no account required to start.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-blue-500/25 hover:bg-blue-500 transition-all hover:-translate-y-0.5"
              >
                Open Dashboard Now
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <ProprStatsLogo variant="light" size={28} showSubLabel />
            </Link>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs mb-4">
              MLB prop research powered by Statcast, Poisson EV modeling, and real-time player splits.
            </p>
            <a
              href="/brand-logo.svg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-blue-400 transition-colors border border-gray-800 hover:border-blue-500/30 rounded-lg px-3 py-2"
            >
              <img src="/brand-logo.svg" alt="ProprStats Logo" className="w-6 h-6 rounded"/>
              Download ProprStats logo (400×400 SVG)
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Product</p>
            <div className="flex flex-col gap-2">
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">Dashboard</Link>
              <a href="#features" className="text-sm text-gray-500 hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-500 hover:text-white transition-colors">Pricing</a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Legal</p>
            <div className="flex flex-col gap-2">
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="text-sm text-gray-500 hover:text-white transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-700">© 2025 ProprStats. For research purposes only. Not financial advice.</p>
          <p className="text-xs text-gray-700">Data: MLB Stats API · Baseball Savant · Open-Meteo — updated daily</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <Navbar/>
      <main>
        <Hero/>
        <HowItWorks/>
        <FeaturesSection/>
        <EVSection/>
        <PricingSection/>
        <BottomCTA/>
      </main>
      <Footer/>
    </>
  );
}
