'use client';

import { generatePitcherInsight } from '../../lib/matchup';

// Pitcher-favorable = green (low BA/wOBA allowed, high K%)
function baCls(v) {
  if (v <= 0.220) return 'bg-emerald-500/20 text-emerald-300';
  if (v <= 0.269) return 'bg-emerald-500/10 text-emerald-400';
  if (v <= 0.299) return 'text-gray-300';
  if (v <= 0.319) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}
function wobaCls(v) {
  if (v <= 0.280) return 'bg-emerald-500/20 text-emerald-300';
  if (v <= 0.319) return 'bg-emerald-500/10 text-emerald-400';
  if (v <= 0.349) return 'text-gray-300';
  if (v <= 0.379) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}
function kCls(v) {
  if (v >= 30) return 'bg-emerald-500/20 text-emerald-300';
  if (v >= 25) return 'bg-emerald-500/10 text-emerald-400';
  if (v >= 20) return 'text-gray-300';
  if (v >= 15) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}
function whiffCls(v) {
  if (v >= 35) return 'bg-emerald-500/20 text-emerald-300';
  if (v >= 28) return 'bg-emerald-500/10 text-emerald-400';
  if (v >= 22) return 'text-gray-300';
  if (v >= 16) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}

function StatCell({ value, cls }) {
  return (
    <td className="px-2 py-2.5 text-right tabular-nums">
      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${cls || 'text-gray-300'}`}>
        {value}
      </span>
    </td>
  );
}

function UsageBar({ pct }) {
  const w = Math.min(100, Math.round(parseFloat(pct) || 0));
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${w}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-7">{w}%</span>
    </div>
  );
}

function fmt3(v) { return v != null && v !== 0 ? parseFloat(v).toFixed(3) : v === 0 ? '.000' : '—'; }
function fmtPct(v) { return v != null ? parseFloat(v).toFixed(1) + '%' : '—'; }
function fmtN(v) { return v != null ? parseInt(v) : '—'; }

export default function PitcherPitchCard({ pitcher, batterName, batterPitchStats, batterHand, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden animate-pulse">
        <div className="p-4 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-800"/>
            <div className="flex-1">
              <div className="h-4 w-36 bg-gray-800 rounded mb-2"/>
              <div className="h-3 w-28 bg-gray-800 rounded"/>
            </div>
          </div>
        </div>
        {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-gray-800/60 mx-4 my-2 rounded"/>)}
      </div>
    );
  }

  if (!pitcher) return null;

  const pitches = pitcher.pitchData ?? [];
  const insight = pitches.length
    ? generatePitcherInsight(pitcher.name, pitches.slice(0, 4), batterName, batterPitchStats)
    : null;

  const statPills = [
    pitcher.era   != null && { label: 'ERA',  val: pitcher.era.toFixed(2) },
    pitcher.whip  != null && { label: 'WHIP', val: pitcher.whip.toFixed(2) },
    pitcher.kPct  != null && { label: 'K%',   val: (pitcher.kPct * 100).toFixed(1) + '%' },
    pitcher.k9    != null && { label: 'K/9',  val: pitcher.k9.toFixed(1) },
  ].filter(Boolean);

  const relevantHandLabel = batterHand === 'L' ? 'vs LHB' : 'vs RHB';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={pitcher.headshotUrl}
              alt={pitcher.name}
              className="w-14 h-14 rounded-full object-cover bg-gray-800 flex-shrink-0 ring-2 ring-violet-500/20"
              onError={e => { e.target.style.display='none'; }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-white">{pitcher.name}</span>
                {pitcher.hand && (
                  <span className="rounded-full bg-violet-600/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                    {pitcher.hand}HP
                  </span>
                )}
                {pitcher.teamAbbrev && (
                  <span className="text-xs text-gray-500 font-semibold">{pitcher.teamAbbrev}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {statPills.map(p => (
                  <span key={p.label} className="rounded-md bg-gray-800 border border-gray-700/50 px-2 py-0.5 text-[10px] font-bold text-gray-300">
                    <span className="text-gray-500">{p.label} </span>{p.val}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <span className="flex-shrink-0 rounded-full bg-violet-600/10 border border-violet-500/20 px-2 py-1 text-[10px] font-bold text-violet-400">
            {relevantHandLabel}
          </span>
        </div>
      </div>

      {/* Pitch table */}
      {!pitcher.hasPitchData ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-gray-500 text-center">
            {pitcher.usingFallbackSeason ? 'Showing 2025 stats — limited 2026 data' : 'No pitch data available yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/60">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Pitch</th>
                <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Usage</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">BA</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">wOBA</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">K%</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">Whiff</th>
              </tr>
            </thead>
            <tbody>
              {pitches.map((row, idx) => (
                <tr key={row.type}
                  className={`border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors ${idx < 4 ? 'border-l-2 border-l-violet-500/50' : 'border-l-2 border-l-transparent'}`}>
                  <td className="px-3 py-2.5">
                    <span className="text-sm font-bold text-gray-200">{row.type}</span>
                    <span className="block text-[10px] text-gray-600">{fmtN(row.pitches)} pitches</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <UsageBar pct={row.usagePct} />
                  </td>
                  <StatCell value={fmt3(row.ba)}       cls={baCls(row.ba)} />
                  <StatCell value={fmt3(row.woba)}     cls={wobaCls(row.woba)} />
                  <StatCell value={fmtPct(row.kPct)}   cls={kCls(row.kPct)} />
                  <StatCell value={fmtPct(row.whiffPct)} cls={whiffCls(row.whiffPct)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Insight */}
      {insight && (
        <div className="px-4 py-3 border-t border-gray-800/60 bg-gray-950/40">
          <p className="text-xs text-gray-400 leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}
