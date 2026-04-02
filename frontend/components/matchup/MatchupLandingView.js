'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MismatchScorePill from './MismatchScorePill';
import SeasonToggle from './SeasonToggle';
import ProGateOverlay from './ProGateOverlay';

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
  const [season, setSeason] = useState('2026');
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]  = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/matchup/top20?season=${season}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(`Failed to load matchups (${e})`); setLoading(false); });
  }, [season]);

  const matchups = data?.matchups ?? [];

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
