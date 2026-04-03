'use client';

import { generateBatterInsight } from '../../lib/matchup';

// Batter-favorable = green (high BA/wOBA, low K%)
function baCls(v) {
  if (v >= 0.300) return 'bg-emerald-500/20 text-emerald-300';
  if (v >= 0.260) return 'bg-emerald-500/10 text-emerald-400';
  if (v >= 0.221) return 'text-gray-300';
  if (v >= 0.200) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}
function wobaCls(v) {
  if (v >= 0.380) return 'bg-emerald-500/20 text-emerald-300';
  if (v >= 0.350) return 'bg-emerald-500/10 text-emerald-400';
  if (v >= 0.320) return 'text-gray-300';
  if (v >= 0.281) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}
function kCls(v) {
  if (v <= 14) return 'bg-emerald-500/20 text-emerald-300';
  if (v <= 19) return 'bg-emerald-500/10 text-emerald-400';
  if (v <= 24) return 'text-gray-300';
  if (v <= 29) return 'bg-red-500/10 text-red-400';
  return 'bg-red-500/20 text-red-300';
}
function whiffCls(v) {
  if (v <= 18) return 'bg-emerald-500/20 text-emerald-300';
  if (v <= 24) return 'bg-emerald-500/10 text-emerald-400';
  if (v <= 30) return 'text-gray-300';
  if (v <= 36) return 'bg-red-500/10 text-red-400';
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

function fmt3(v) { return v != null && v !== 0 ? parseFloat(v).toFixed(3) : v === 0 ? '.000' : '—'; }
function fmtPct(v) { return v != null ? parseFloat(v).toFixed(1) + '%' : '—'; }

export default function BatterPitchCard({ batter, pitcherName, pitcherPitchData, pitcherHand, loading }) {
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

  if (!batter) return null;

  // Align rows to pitcher's top 4 pitches; fill '—' for any the batter hasn't faced
  const top4 = (pitcherPitchData ?? []).slice(0, 4);
  const batterMap = Object.fromEntries((batter.pitchData ?? []).map(p => [p.type, p]));
  const rows = top4.length
    ? top4.map(p => batterMap[p.type] ?? { type: p.type, _noData: true })
    : (batter.pitchData ?? []).slice(0, 6);

  const insight = rows.length
    ? generateBatterInsight(batter.name, (pitcherPitchData ?? []).slice(0, 4), batter.pitchData, pitcherName)
    : null;

  const st = batter.seasonStat;
  const statPills = [
    st?.avg  != null && { label: 'AVG', val: parseFloat(st.avg).toFixed(3) },
    st?.obp  != null && { label: 'OBP', val: parseFloat(st.obp).toFixed(3) },
    st?.slg  != null && { label: 'SLG', val: parseFloat(st.slg).toFixed(3) },
    st?.ops  != null && { label: 'OPS', val: parseFloat(st.ops).toFixed(3) },
  ].filter(Boolean);

  const relevantHandLabel = pitcherHand === 'L' ? 'vs LHP' : 'vs RHP';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={batter.headshotUrl}
              alt={batter.name}
              className="w-14 h-14 rounded-full object-cover bg-gray-800 flex-shrink-0 ring-2 ring-sky-500/20"
              onError={e => { e.target.style.display='none'; }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-white">{batter.name}</span>
                {batter.hand && (
                  <span className="rounded-full bg-sky-600/20 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    {batter.hand === 'L' ? 'LHB' : batter.hand === 'S' ? 'SH' : 'RHB'}
                  </span>
                )}
                {batter.teamAbbrev && (
                  <span className="text-xs text-gray-500 font-semibold">{batter.teamAbbrev}</span>
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
          <span className="flex-shrink-0 rounded-full bg-sky-600/10 border border-sky-500/20 px-2 py-1 text-[10px] font-bold text-sky-400">
            {relevantHandLabel}
          </span>
        </div>
      </div>

      {/* Pitch table — aligned to pitcher's top 4 pitches */}
      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-gray-500 text-center">
            {batter.usingFallbackSeason ? 'Showing 2025 stats — limited 2026 data' : 'No pitch breakdown data available yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/60">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Pitch</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">PA</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">BA</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">wOBA</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">K%</th>
                <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">Whiff</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row._noData) {
                  return (
                    <tr key={row.type} className="border-b border-gray-800/30 border-l-2 border-l-sky-500/40">
                      <td className="px-3 py-2.5">
                        <span className="text-sm font-bold text-gray-500">{row.type}</span>
                        <span className="block text-[10px] text-gray-700">No data vs this pitch</span>
                      </td>
                      {[1,2,3,4,5].map(i => (
                        <td key={i} className="px-2 py-2.5 text-right text-xs text-gray-700">—</td>
                      ))}
                    </tr>
                  );
                }
                return (
                  <tr key={row.type}
                    className={`border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors ${idx < 4 ? 'border-l-2 border-l-sky-500/40' : 'border-l-2 border-l-transparent'}`}>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-bold text-gray-200">{row.type}</span>
                      <span className="block text-[10px] text-gray-600">{row.pitches} pitches seen</span>
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs text-gray-400 tabular-nums">{row.pitches}</td>
                    <StatCell value={fmt3(row.ba)}       cls={baCls(row.ba)} />
                    <StatCell value={fmt3(row.woba)}     cls={wobaCls(row.woba)} />
                    <StatCell value={fmtPct(row.kPct)}   cls={kCls(row.kPct)} />
                    <StatCell value={fmtPct(row.whiffPct)} cls={whiffCls(row.whiffPct)} />
                  </tr>
                );
              })}
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
