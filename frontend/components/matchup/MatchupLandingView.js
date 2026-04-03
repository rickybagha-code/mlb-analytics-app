'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import MismatchScorePill from './MismatchScorePill';
import SeasonToggle from './SeasonToggle';
import ProGateOverlay from './ProGateOverlay';

// ─── Searchable player dropdown ───────────────────────────────────────────────
function PlayerSearchDropdown({ options, value, onChange, placeholder, disabled, label }) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const inputRef     = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset highlight when query changes
  useEffect(() => { setHighlighted(0); }, [query]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter(o => o.name.toLowerCase().includes(q) || (o.team || '').toLowerCase().includes(q))
      .slice(0, 40);
  }, [options, query]);

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') { setHighlighted(h => Math.min(h + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setHighlighted(h => Math.max(h - 1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter') {
      if (filtered[highlighted]) { onChange(filtered[highlighted]); setOpen(false); setQuery(''); }
      e.preventDefault();
    } else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  const displayName = value ? value.name : '';

  return (
    <div ref={containerRef} className="relative w-full">
      {label && <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{label}</p>}
      <div
        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
          open ? 'border-violet-500/60 bg-gray-800' : 'border-gray-700 bg-gray-900 hover:border-gray-600'
        } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
        onClick={() => { if (!disabled) { setOpen(o => !o); if (!open) setTimeout(() => inputRef.current?.focus(), 10); } }}
      >
        {value?.headshotUrl && (
          <img src={value.headshotUrl} alt=""
            className="w-6 h-6 rounded-full object-cover bg-gray-800 flex-shrink-0"
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        {!value?.headshotUrl && (
          <div className="w-6 h-6 rounded-full bg-gray-800 flex-shrink-0 flex items-center justify-center">
            <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="7" r="4"/><path d="M5.5 21c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6"/>
            </svg>
          </div>
        )}
        <input
          ref={inputRef}
          value={open ? query : displayName}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none min-w-0"
          onClick={e => { e.stopPropagation(); setOpen(true); }}
        />
        {value && !open && (
          <button
            onClick={e => { e.stopPropagation(); onChange(null); }}
            className="flex-shrink-0 text-gray-600 hover:text-gray-300 transition-colors p-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
        <svg className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-40 max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-500">{query ? `No results for "${query}"` : 'No players available'}</p>
          ) : filtered.map((opt, i) => (
            <button
              key={`${opt.id}-${opt.probablePitcherId ?? ''}`}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => { onChange(opt); setOpen(false); setQuery(''); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                i === highlighted ? 'bg-gray-800' : 'hover:bg-gray-800/60'
              }`}
            >
              <img src={opt.headshotUrl} alt=""
                className="w-6 h-6 rounded-full object-cover bg-gray-800 flex-shrink-0"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{opt.name}</p>
              </div>
              {opt.team && (
                <span className="text-[10px] font-bold text-gray-500 flex-shrink-0 tabular-nums">{opt.team}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 animate-pulse">
      <div className="w-6 h-4 bg-gray-800 rounded flex-shrink-0"/>
      <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0"/>
      <div className="flex-1 min-w-0">
        <div className="h-3.5 w-28 bg-gray-800 rounded mb-1"/>
        <div className="h-2.5 w-16 bg-gray-800 rounded"/>
      </div>
      <div className="w-20 h-6 bg-gray-800 rounded-full"/>
      <div className="hidden sm:block w-24 h-4 bg-gray-800 rounded"/>
      <div className="hidden md:block w-16 h-4 bg-gray-800 rounded"/>
    </div>
  );
}

function VerdictEdgeLabel({ value }) {
  if (!value) return <span className="text-gray-600">—</span>;
  const isPos = value > 0;
  return (
    <span className={`font-bold tabular-nums text-xs ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPos ? '+' : ''}{value.toFixed(3)}
    </span>
  );
}

function H2HCell({ h2h }) {
  if (!h2h || h2h.ab === 0) return <span className="text-gray-600 text-xs">First meeting</span>;
  if (h2h.ab < 5)            return <span className="text-gray-600 text-xs">No H2H data</span>;
  const avg = h2h.avg;
  const cls = avg >= 0.280 ? 'text-emerald-400' : avg <= 0.199 ? 'text-red-400' : 'text-gray-300';
  return (
    <span className={`text-xs font-bold ${cls}`}>
      {h2h.h}/{h2h.ab} ({avg?.toFixed(3) ?? '.---'}) · {h2h.ab} AB
    </span>
  );
}

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>LIVE
    </span>
  );
}

export default function MatchupLandingView({ isPro }) {
  const router = useRouter();
  const [season,  setSeason]  = useState('2026');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Dropdown state
  const [todayPlayers,     setTodayPlayers]     = useState({ batters: [], pitchers: [], hasLineups: false });
  const [selectedBatter,   setSelectedBatter]   = useState(null);
  const [selectedPitcher,  setSelectedPitcher]  = useState(null);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  // Fetch top-20 list
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/matchup/top20?season=${season}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(`Failed to load matchups (${e})`); setLoading(false); });
  }, [season]);

  // Fetch today's players for dropdowns (once on mount)
  useEffect(() => {
    fetch('/api/matchup/batters-today')
      .then(r => r.ok ? r.json() : { batters: [], pitchers: [], hasLineups: false })
      .then(d => { setTodayPlayers(d); setLoadingDropdowns(false); })
      .catch(() => setLoadingDropdowns(false));
  }, []);

  // Batters from today filtered to selected pitcher's opponents
  const dropdownBatters = useMemo(() => {
    if (!selectedPitcher) return todayPlayers.batters;
    return todayPlayers.batters.filter(b => b.probablePitcherId === selectedPitcher.id);
  }, [selectedPitcher, todayPlayers.batters]);

  function handleBatterSelect(batter) {
    if (!batter) { setSelectedBatter(null); return; }
    setSelectedBatter(batter);
    // Auto-populate pitcher from probable pitcher data
    if (batter.probablePitcherId) {
      const existingPitcher = todayPlayers.pitchers.find(p => p.id === batter.probablePitcherId);
      setSelectedPitcher(existingPitcher ?? {
        id:         batter.probablePitcherId,
        name:       batter.probablePitcherName,
        hand:       batter.probablePitcherHand,
        teamAbbrev: batter.probablePitcherTeam,
        headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${batter.probablePitcherId}/headshot/67/current`,
      });
    }
  }

  function handlePitcherSelect(pitcher) {
    if (!pitcher) { setSelectedPitcher(null); setSelectedBatter(null); return; }
    setSelectedPitcher(pitcher);
    // Clear batter if they don't face this pitcher
    if (selectedBatter && selectedBatter.probablePitcherId !== pitcher.id) {
      setSelectedBatter(null);
    }
  }

  function handleAnalyze() {
    if (selectedBatter && selectedPitcher) {
      router.push(`/dashboard/matchup?pitcher=${selectedPitcher.id}&batter=${selectedBatter.id}`);
    }
  }

  const matchups = data?.matchups ?? [];
  const canAnalyze = !!(selectedBatter && selectedPitcher);

  function handleRowClick(m) {
    router.push(`/dashboard/matchup?pitcher=${m.pitcherId}&batter=${m.batterId}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-white">Matchup Analyzer</h2>
          <p className="mt-1 text-sm text-gray-400">
            Today&apos;s biggest pitcher vs batter mismatches — ranked by exploitable edge
          </p>
        </div>
        <SeasonToggle season={season} onChange={setSeason} />
      </div>

      {/* Player search dropdowns */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-3">
          Deep-dive any matchup
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 min-w-0">
            <PlayerSearchDropdown
              options={todayPlayers.batters}
              value={selectedBatter}
              onChange={handleBatterSelect}
              placeholder={loadingDropdowns ? 'Loading players…' : 'Search batter…'}
              disabled={loadingDropdowns}
              label="Batter"
            />
          </div>
          <div className="hidden sm:flex items-center pb-2 text-gray-600">
            <span className="text-sm font-bold">vs</span>
          </div>
          <div className="flex-1 min-w-0">
            <PlayerSearchDropdown
              options={todayPlayers.pitchers}
              value={selectedPitcher}
              onChange={handlePitcherSelect}
              placeholder={loadingDropdowns ? 'Loading pitchers…' : 'Search pitcher…'}
              disabled={loadingDropdowns}
              label="Pitcher"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`flex-shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-150 ${
              canAnalyze
                ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/25'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            Analyze
          </button>
        </div>
        {!loadingDropdowns && !todayPlayers.hasLineups && todayPlayers.batters.length > 0 && (
          <p className="mt-2 text-[10px] text-gray-600">
            Lineups not yet posted — showing roster-based batters
          </p>
        )}
        {!loadingDropdowns && todayPlayers.pitchers.length === 0 && (
          <p className="mt-2 text-[10px] text-gray-600">
            No probable pitchers posted yet — check back closer to game time
          </p>
        )}
      </div>

      {/* Top 20 list */}
      <div className="relative rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        {/* Pro gate overlay */}
        {!isPro && (
          <div className="relative">
            <ProGateOverlay />
          </div>
        )}

        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[32px_1fr_80px_160px_130px_130px_100px_80px] items-center gap-2 px-4 py-2.5 border-b border-gray-800/60 bg-gray-950/50">
          {['#','Batter','Team','vs Pitcher','Mismatch','Top Edge Pitch','H2H','Time'].map(col => (
            <span key={col} className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{col}</span>
          ))}
        </div>

        {/* Loading skeletons */}
        {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

        {/* Error state */}
        {!loading && error && (
          <div className="py-12 text-center">
            <p className="text-gray-500 text-sm">{error}</p>
            <button onClick={() => { setLoading(true); fetch(`/api/matchup/top20?season=${season}`).then(r=>r.json()).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false)); }}
              className="mt-3 px-4 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-all">
              Retry
            </button>
          </div>
        )}

        {/* No games */}
        {!loading && !error && matchups.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500 font-semibold">
              {data?.note ?? 'No matchups available yet'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {data?.gamesCount === 0
                ? 'No games scheduled today'
                : 'Probable pitchers have not been posted yet — check back closer to game time'}
            </p>
          </div>
        )}

        {/* Matchup rows */}
        {!loading && !error && matchups.map(m => (
          <button key={`${m.pitcherId}-${m.batterId}`}
            onClick={() => handleRowClick(m)}
            className="w-full text-left hover:bg-gray-800/50 transition-colors border-b border-gray-800/40 last:border-0 group">

            {/* Desktop row */}
            <div className="hidden md:grid grid-cols-[32px_1fr_80px_160px_130px_130px_100px_80px] items-center gap-2 px-4 py-3">
              {/* Rank */}
              <span className="text-sm font-black text-gray-600 tabular-nums">#{m.rank}</span>

              {/* Batter */}
              <div className="flex items-center gap-2.5 min-w-0">
                <img src={m.headshotUrl} alt={m.batterName}
                  className="w-8 h-8 rounded-full object-cover bg-gray-800 flex-shrink-0"
                  onError={e => { e.target.style.display='none'; }} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">{m.batterName}</p>
                  {m.batterPos && <p className="text-[10px] text-gray-500">{m.batterPos}</p>}
                </div>
              </div>

              {/* Team */}
              <span className="text-xs font-bold text-gray-400">{m.teamAbbrev}</span>

              {/* vs Pitcher */}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{m.pitcherName}</p>
                <span className="inline-block mt-0.5 rounded-full bg-violet-600/15 border border-violet-500/20 px-1.5 py-px text-[9px] font-bold text-violet-400">
                  {m.pitcherHand}HP
                </span>
              </div>

              {/* Mismatch pill */}
              <div>
                <MismatchScorePill score={m.mismatchScore} size="sm" />
              </div>

              {/* Top edge pitch */}
              <div>
                {m.topEdgePitch ? (
                  <span className="text-xs text-gray-300">
                    {m.topEdgePitch} <VerdictEdgeLabel value={m.topEdgeValue} />
                  </span>
                ) : (
                  <span className="text-xs text-gray-600">—</span>
                )}
              </div>

              {/* H2H */}
              <H2HCell h2h={m.h2h} />

              {/* Time */}
              <div>
                {m.isLive ? <LiveDot /> : <span className="text-xs text-gray-500">{m.gameTime}</span>}
              </div>
            </div>

            {/* Mobile card */}
            <div className="md:hidden flex items-center gap-3 px-4 py-3">
              <span className="text-xs font-black text-gray-600 w-5 flex-shrink-0">#{m.rank}</span>
              <img src={m.headshotUrl} alt={m.batterName}
                className="w-8 h-8 rounded-full object-cover bg-gray-800 flex-shrink-0"
                onError={e => { e.target.style.display='none'; }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{m.batterName}</p>
                <p className="text-xs text-gray-500 truncate">vs {m.pitcherName} · {m.pitcherHand}HP</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <MismatchScorePill score={m.mismatchScore} showVerdict={false} size="sm" />
                {m.isLive ? <LiveDot /> : <span className="text-xs text-gray-600">{m.gameTime}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!loading && !error && matchups.length > 0 && (
        <p className="mt-3 text-[11px] text-gray-600 text-right">
          Scores based on platoon splits vs today&apos;s probable pitcher · Click any row for full pitch breakdown
        </p>
      )}
    </div>
  );
}
