'use client';

import { generateBatterInsight } from '../../lib/matchup';

// Returns [bgClass, textClass] — applied directly to <td> for full-cell color
function baCls(v) {
  if (v >= 0.300) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 0.265) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 0.230) return ['bg-gray-800/40',    'text-gray-300'];
  if (v >= 0.200) return ['bg-red-500/15',     'text-red-300'];
  return               ['bg-red-500/30',       'text-red-200'];
}
function wobaCls(v) {
  if (v >= 0.380) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 0.345) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 0.310) return ['bg-gray-800/40',    'text-gray-300'];
  if (v >= 0.275) return ['bg-red-500/15',     'text-red-300'];
  return               ['bg-red-500/30',       'text-red-200'];
}
function slgCls(v) {
  if (v >= 0.550) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 0.430) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 0.340) return ['bg-gray-800/40',    'text-gray-300'];
  if (v >= 0.270) return ['bg-red-500/15',     'text-red-300'];
  return                ['bg-red-500/30',       'text-red-200'];
}
function isoCls(v) {
  if (v >= 0.250) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 0.170) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 0.110) return ['bg-gray-800/40',    'text-gray-300'];
  if (v >= 0.060) return ['bg-red-500/15',     'text-red-300'];
  return                ['bg-red-500/30',       'text-red-200'];
}
function kCls(v) {
  if (v <= 14) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 19) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 25) return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 30) return ['bg-red-500/15',     'text-red-300'];
  return             ['bg-red-500/30',      'text-red-200'];
}
function whiffCls(v) {
  if (v <= 18) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 25) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 32) return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 38) return ['bg-red-500/15',     'text-red-300'];
  return             ['bg-red-500/30',      'text-red-200'];
}
function hrCls(v) {
  if (v >= 6) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 3) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 1) return ['bg-gray-800/40',    'text-gray-300'];
  return             ['bg-red-500/15',      'text-red-300'];
}

function HeatCell({ value, clsFn, raw }) {
  if (raw == null) return <td className="px-2 py-1.5 text-center text-sm text-gray-600 bg-gray-800/20">—</td>;
  const [bg, text] = clsFn(raw);
  return (
    <td className={`px-2 py-1.5 text-center tabular-nums ${bg}`}>
      <span className={`text-sm font-black ${text}`}>{value}</span>
    </td>
  );
}

function fmt3(v) { return v != null ? parseFloat(v).toFixed(3) : null; }
function fmtPct(v) { return v != null ? parseFloat(v).toFixed(1) + '%' : null; }
function fmtHR(v) { return v != null ? String(parseInt(v)) : null; }

export default function BatterPitchCard({ batter, pitcherName, pitcherPitchData, pitcherHand, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden animate-pulse">
        <div className="p-2.5 border-b border-gray-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gray-800 flex-shrink-0"/>
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-32 bg-gray-800 rounded"/>
              <div className="h-2.5 w-24 bg-gray-800 rounded"/>
            </div>
          </div>
        </div>
        {[1,2,3,4].map(i => <div key={i} className="h-9 bg-gray-800/40 border-b border-gray-800/60"/>)}
      </div>
    );
  }

  if (!batter) return null;

  const top4 = (pitcherPitchData ?? []).slice(0, 4);
  const batterMap = Object.fromEntries((batter.pitchData ?? []).map(p => [p.type, p]));
  const rows = top4.length
    ? top4.map(p => batterMap[p.type] ?? { type: p.type, _noData: true })
    : (batter.pitchData ?? []).slice(0, 4);

  const st = batter.seasonStat;
  const statPills = [
    st?.avg != null && { label: 'AVG', val: parseFloat(st.avg).toFixed(3) },
    st?.obp != null && { label: 'OBP', val: parseFloat(st.obp).toFixed(3) },
    st?.slg != null && { label: 'SLG', val: parseFloat(st.slg).toFixed(3) },
    st?.ops != null && { label: 'OPS', val: parseFloat(st.ops).toFixed(3) },
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={batter.headshotUrl}
              alt={batter.name}
              className="w-9 h-9 rounded-full object-cover bg-gray-800 flex-shrink-0 ring-2 ring-sky-500/25"
              onError={e => { e.target.style.display='none'; }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-white">{batter.name}</span>
                {batter.hand && (
                  <span className="rounded-full bg-sky-600/20 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                    {batter.hand === 'L' ? 'LHB' : batter.hand === 'S' ? 'SH' : 'RHB'}
                  </span>
                )}
                {batter.teamAbbrev && (
                  <span className="text-[11px] font-bold text-gray-500">{batter.teamAbbrev}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {statPills.map(p => (
                  <span key={p.label} className="rounded bg-gray-800 border border-gray-700/50 px-1.5 py-0.5 text-[10px] font-bold text-gray-300">
                    <span className="text-gray-500">{p.label} </span>{p.val}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <span className="flex-shrink-0 rounded-full bg-sky-600/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
            {pitcherHand === 'L' ? 'vs LHP' : 'vs RHP'}
          </span>
        </div>
      </div>

      {/* Heatmap table */}
      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-gray-500 text-center">
            {batter.usingFallbackSeason ? 'Showing 2025 stats — limited 2026 data' : 'No pitch breakdown data available yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Pitch</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">PA</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">BA</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">wOBA</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">SLG</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">ISO</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">HR</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">K%</th>
                <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">Whiff%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                if (row._noData) {
                  return (
                    <tr key={row.type} className="border-b border-gray-800/50 border-l-2 border-l-sky-500/50">
                      <td className="px-3 py-1.5 bg-gray-900">
                        <p className="text-xs font-bold text-gray-500">{row.type}</p>
                        <p className="text-[9px] text-gray-700 mt-0.5">No data</p>
                      </td>
                      {[1,2,3,4,5,6,7,8].map(i => (
                        <td key={i} className="px-2 py-1.5 text-center bg-gray-800/20 text-sm text-gray-700">—</td>
                      ))}
                    </tr>
                  );
                }
                return (
                  <tr key={row.type} className="border-b border-gray-800/50 border-l-2 border-l-sky-500/50">
                    <td className="px-3 py-1.5 bg-gray-900 min-w-[110px]">
                      <p className="text-xs font-bold text-gray-200 whitespace-nowrap">{row.type}</p>
                      <p className="text-[9px] text-gray-500 mt-0.5">{row.pitches} pitches</p>
                    </td>
                    <td className="px-2 py-1.5 text-center bg-gray-900 text-sm font-bold text-gray-400 tabular-nums">
                      {row.pitches}
                    </td>
                    <HeatCell value={fmt3(row.ba)}          clsFn={baCls}    raw={row.ba} />
                    <HeatCell value={fmt3(row.woba)}        clsFn={wobaCls}  raw={row.woba} />
                    <HeatCell value={fmt3(row.slg)}         clsFn={slgCls}   raw={row.slg} />
                    <HeatCell value={fmt3(row.iso)}         clsFn={isoCls}   raw={row.iso} />
                    <HeatCell value={fmtHR(row.hr)}         clsFn={hrCls}    raw={row.hr} />
                    <HeatCell value={fmtPct(row.kPct)}      clsFn={kCls}     raw={row.kPct} />
                    <HeatCell value={fmtPct(row.whiffPct)}  clsFn={whiffCls} raw={row.whiffPct} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
