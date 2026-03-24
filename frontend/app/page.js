import Link from 'next/link';

// ─── Logo Mark ────────────────────────────────────────────────────────────────
function LogoMark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      {/* Diamond frame */}
      <path d="M17 1.5L32.5 17L17 32.5L1.5 17Z" fill="#0a1628" stroke="#2563eb" strokeWidth="1.5"/>
      <path d="M17 5.5L28.5 17L17 28.5L5.5 17Z" fill="#0f2548" opacity="0.55"/>
      {/* Book left page */}
      <path d="M17 25L8.5 21.5L9 16L17 19Z" fill="#1e40af"/>
      {/* Book right page */}
      <path d="M17 25L25.5 21.5L25 16L17 19Z" fill="#3b82f6"/>
      {/* Spine */}
      <line x1="17" y1="19" x2="17" y2="25" stroke="#93c5fd" strokeWidth="0.8" opacity="0.55"/>
      {/* Flame */}
      <path d="M17 19C13.5 17.5 12.5 13.5 15 10.5C16 9.2 17 8.2 17 8.2C17 8.2 18 9.2 19 10.5C21.5 13.5 20.5 17.5 17 19Z"
        fill="#60a5fa"/>
      {/* Flame inner highlight */}
      <path d="M17 17.5C15.8 16 15.5 13.5 16.5 12C17 13 17.5 15.2 17 17.5Z"
        fill="white" opacity="0.28"/>
      {/* Tip spark */}
      <circle cx="17" cy="8.2" r="1.5" fill="#bae6fd" opacity="0.9"/>
    </svg>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark />
            <span className="font-black text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors">
              Cook The Books
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-gray-400 hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
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
        <span className="text-xs text-gray-600">Cook The Books</span>
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
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent pointer-events-none"/>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 w-full">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">

          {/* Left copy */}
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"/>
              <span className="text-sm font-medium text-blue-300">MLB 2025 Season · Live Data</span>
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Stop Guessing.<br/>
              <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent">
                Start Cooking.
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-gray-400">
              Cook The Books turns raw MLB data into a single 0–100 model score per player — combining Statcast quality of contact, batter-pitcher splits, recency trends, and career head-to-head history.
            </p>

            {/* Inline proof points */}
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {[
                { icon: '⚡', text: 'xwOBA + Barrel% model' },
                { icon: '📊', text: 'L5 / L10 bar charts' },
                { icon: '⚔️', text: 'Career vs pitcher data' },
                { icon: '✂️', text: 'Auto handedness splits' },
              ].map(p => (
                <div key={p.text} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span>{p.icon}</span>
                  <span>{p.text}</span>
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
              <Link
                href="/probables"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-7 py-3.5 text-base font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-all hover:-translate-y-0.5"
              >
                Today&apos;s Probables
              </Link>
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

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: '700+',  label: 'Players tracked daily',   accent: 'text-blue-400'    },
    { value: '30',    label: 'MLB teams covered',        accent: 'text-cyan-400'    },
    { value: '6',     label: 'Data inputs per score',    accent: 'text-blue-400'    },
    { value: '0–100', label: 'Composite model scale',    accent: 'text-emerald-400' },
  ];
  return (
    <div className="border-y border-gray-800/60 bg-gray-900/30 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 divide-x-0 lg:divide-x divide-gray-800/50">
          {stats.map((s, i) => (
            <div key={i} className="text-center lg:px-8">
              <div className={`text-3xl font-black tabular-nums ${s.accent}`}>{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
      desc: 'The 0–100 score and Strong Value / Lean Over / Neutral recommendation tells you exactly where to put your stack.',
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
          {/* Connector line (desktop only) */}
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

// ─── Feature Icons ────────────────────────────────────────────────────────────
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
    description: 'A proprietary 0–100 score blending wOBA, xwOBA, barrel%, hard hit%, recency, and pitcher ERA. One number — the full picture.',
  },
  {
    num: '02',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: 'Statcast Integration',
    description: 'xwOBA removes BABIP luck. Barrel% and hard hit% (95+ mph) reveal the true quality behind every batted ball.',
  },
  {
    num: '03',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
    title: 'Recency-Weighted Trends',
    description: 'L5 and L10 game windows shown as visual bar charts. Hot streaks and cold snaps are reflected in the model score in real time.',
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
    description: 'vs LHP and vs RHP splits resolved automatically against today\'s probable. Always the right platoon stats — no manual lookup.',
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
    description: 'Complete batter vs pitcher career history — AB, H, 1B, 2B, 3B, HR, RBI, BB, K, AVG, OBP, SLG, OPS, and wOBA in one card.',
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
    description: 'Hits, Runs, RBI, Home Runs, and Stolen Bases — each with selectable Vegas lines and their own model scoring context.',
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
            Stop juggling Baseball Savant, Fangraphs, and box scores. Cook The Books pulls it all together — automatically.
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
      'Probable pitchers lookup',
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
              {/* Pro gradient top accent */}
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

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {['No credit card required', 'Cancel anytime', 'For research purposes only', 'MLB 2025 season data'].map(t => (
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
  return (
    <section className="py-20 px-4">
      <div className="mx-auto max-w-3xl">
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
              Make Every Pick With<br/>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Data Behind It
              </span>
            </h2>
            <p className="mt-4 text-gray-400 max-w-lg mx-auto">
              Join prop researchers who trust numbers over gut feel. The dashboard is live right now — no account required.
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
              <Link
                href="/probables"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                View today&apos;s probable pitchers →
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
              <LogoMark size={36}/>
              <span className="font-black text-white">Cook The Books</span>
            </Link>
            <p className="text-sm text-gray-600 leading-relaxed max-w-xs mb-4">
              MLB prop research powered by Statcast, real-time splits, and a proprietary model score.
            </p>
            {/* Brand logo export */}
            <a
              href="/brand-logo.svg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-gray-600 hover:text-blue-400 transition-colors border border-gray-800 hover:border-blue-500/30 rounded-lg px-3 py-2"
            >
              <img src="/brand-logo.svg" alt="Logo" className="w-6 h-6 rounded"/>
              Download brand logo (400×400 SVG)
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
              <Link href="/probables" className="text-sm text-gray-500 hover:text-white transition-colors">Today&apos;s Probables</Link>
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
          <p className="text-xs text-gray-700">© 2025 Cook The Books. For research purposes only. Not financial advice.</p>
          <p className="text-xs text-gray-700">Data: MLB Stats API · Baseball Savant · Open-Meteo</p>
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
        <StatsBar/>
        <HowItWorks/>
        <FeaturesSection/>
        <PricingSection/>
        <BottomCTA/>
      </main>
      <Footer/>
    </>
  );
}
