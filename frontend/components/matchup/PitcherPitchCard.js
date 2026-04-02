'use client';

import { generatePitcherInsight, LEAGUE_AVG_WOBA_BY_PITCH } from '../../lib/matchup';

// Pitcher-favorable = green (low BA/wOBA allowed, high K%)
function baCls(v) {
  if (v <= 0.220) return 'bg-[#14532d] text-[#86efac]';
  if (v <= 0.269) return 'bg-[#166534] text-[#bbf7d0]';
  if (v <= 0.299) return '';
  if (v <= 0.319) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function wobaCls(v) {
  if (v <= 0.280) return 'bg-[#14532d] text-[#86efac]';
  if (v <= 0.319) return 'bg-[#166534] text-[#bbf7d0]';
  if (v <= 0.349) return '';
  if (v <= 0.379) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function slgCls(v) {
  if (v <= 0.350) return 'bg-[#14532d] text-[#86efac]';
  if (v <= 0.409) return 'bg-[#166534] text-[#bbf7d0]';
  if (v <= 0.459) return '';
  if (v <= 0.509) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function isoCls(v) {
  if (v <= 0.130) return 'bg-[#14532d] text-[#86efac]';
  if (v <= 0.169) return 'bg-[#166534] text-[#bbf7d0]';
  if (v <= 0.199) return '';
  if (v <= 0.239) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function kCls(v) {
  if (v >= 30) return 'bg-[#14532d] text-[#86efac]';
  if (v >= 25) return 'bg-[#166534] text-[#bbf7d0]';
  if (v >= 20) return '';
  if (v >= 15) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function hrCls(hrPer100) {
  if (hrPer100 === 0) return 'bg-[#14532d] text-[#86efac]';
  if (hrPer100 < 3)   return '';
  return 'bg-[#450a0a] text-[#f87171]';
}

function Td({ cls, children }) {
  return (
    <td className={`px-2 py-1.5 text-right text-xs tabular-nums ${cls || 'text-gray-300'}`}>
      <span className={cls ? `rounded px-1 py-0.5 ${cls}` : ''}>{children}</span>
    </td>
  );
}

function fmt3(v) { return v != null ? parseFloat(v).toFixed(3) : '—'; }
function fmtPct(v) { return v != null ? parseFloat(v).toFixed(1) + '%' : '—'; }
function fmtN(v) { return v != null ? parseInt(v) : '—'; }

export default function PitcherPitchCard({ pitcher, batterName, batterPitchStats, batterHand, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gray-800"/>
          <div className="flex-1">
            <div className="h-4 w-32 bg-gray-800 rounded mb-2"/>
            <div className="h-3 w-24 bg-gray-800 rounded"/>
          </div>
        </div>
        {[1,2,3,4].map(i => <div key={i} className="h-8 bg-gray-800 rounded mb-2"/>)}
      </div>
    );
  }

  if (!pitcher) return null;

  const top4 = (pitcher.pitchData ?? []).slice(0, 4);
  const insight = top4.length
    ? generatePitcherInsight(pitcher.name, top4, batterName, batterPitchStats)
    : null;

  const statPills = [
    pitcher.era   != null && { label: 'ERA',  val: pitcher.era.toFixed(2) },
    pitcher.whip  != null && { label: 'WHIP', val: pitcher.whip.toFixed(2) },
    pitcher.kPct  != null && { label: 'K%',   val: (pitcher.kPct * 100).toFixed(1) + '%' },
    pitcher.bbPct != null && { label: 'BB%',  val: (pitcher.bbPct * 100).toFixed(1) + '%' },
    pitcher.k9    != null && { label: 'K/9',  val: pitcher.k9.toFixed(1) },
  ].filter(Boolean);

  const relevantHandLabel = batterHand === 'L' ? 'vs LHB' : 'vs RHB';
  const otherHandLabel    = batterHand === 'L' ? 'vs RHB' : 'vs LHB';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={pitcher.headshotUrl}
              alt={pitcher.name}
              className="w-12 h-12 rounded-full object-cover bg-gray-800 flex-shrink-0"
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
                  <span className="text-xs text-gray-500">{pitcher.teamAbbrev}</span>
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

          {/* Platoon header */}
          <div className="flex-shrink-0 flex items-center gap-3 text-xs font-bold">
            <span className="text-gray-600">{otherHandLabel}</span>
            <span className="border-b-2 border-violet-500 text-white pb-0.5">{relevantHandLabel}</span>
            {/* Info tooltip */}
            <div className="relative group">
              <button className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-700 text-gray-500 hover:text-gray-300 text-[10px] font-black">ⓘ</button>
              <div className="absolute right-0 top-6 w-56 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[10px] text-gray-300 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                Showing stats for pitches thrown to {batterHand === 'L' ? 'LHB' : 'RHB'} batters — matched to today&apos;s opponent
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pitch table */}
      {!pitcher.hasPitchData ? (
        <div className="p-4 text-center">
          <p className="text-sm text-gray-500">
            {pitcher.usingFallbackSeason ? 'Showing 2025 season stats — limited 2026 data' : 'No pitch data available yet — check back closer to game time'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800/60 text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2 text-left font-bold">Type</th>
                <th className="px-2 py-2 text-right font-bold">#</th>
                <th className="px-2 py-2 text-right font-bold">%</th>
                <th className="px-2 py-2 text-right font-bold">BA</th>
                <th className="px-2 py-2 text-right font-bold">wOBA</th>
                <th className="px-2 py-2 text-right font-bold">SLG</th>
                <th className="px-2 py-2 text-right font-bold">ISO</th>
                <th className="px-2 py-2 text-right font-bold">HR</th>
                <th className="px-2 py-2 text-right font-bold">K%</th>
                <th className="px-2 py-2 text-right font-bold">WHIFF%</th>
              </tr>
            </thead>
            <tbody>
              {(pitcher.pitchData ?? []).map((row, idx) => {
                const isPrimary = idx < 4;
                const hrPer100 = row.pitches > 0 ? (row.hr / row.pitches) * 100 : 0;
                return (
                  <tr key={row.type}
                    className={`border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors ${isPrimary ? 'border-l-2 border-l-violet-500/60' : ''}`}>
                    <td className="px-3 py-1.5 text-left">
                      <span className="font-semibold text-gray-200">{row.type}</span>
                    </td>
                    <Td>{fmtN(row.pitches)}</Td>
                    <Td>{row.usagePct.toFixed(1)}%</Td>
                    <Td cls={baCls(row.ba)}>{fmt3(row.ba)}</Td>
                    <Td cls={wobaCls(row.woba)}>{fmt3(row.woba)}</Td>
                    <Td cls={slgCls(row.slg)}>{fmt3(row.slg)}</Td>
                    <Td cls={isoCls(row.iso)}>{fmt3(row.iso)}</Td>
                    <Td cls={hrCls(hrPer100)}>{fmtN(row.hr)}</Td>
                    <Td cls={kCls(row.kPct)}>{fmtPct(row.kPct)}</Td>
                    <Td cls={kCls(row.whiffPct)}>{fmtPct(row.whiffPct)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Auto insight */}
      {insight && (
        <div className="px-4 py-3 border-t border-gray-800/60 bg-gray-900/50">
          <p className="text-xs text-gray-400 leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}
