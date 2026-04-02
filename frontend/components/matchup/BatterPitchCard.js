'use client';

import { generateBatterInsight, LEAGUE_AVG_WOBA_BY_PITCH } from '../../lib/matchup';

// Batter-favorable = green (high BA/wOBA, low K%)
function baCls(v) {
  if (v >= 0.300) return 'bg-[#14532d] text-[#86efac]';
  if (v >= 0.260) return 'bg-[#166534] text-[#bbf7d0]';
  if (v >= 0.221) return '';
  if (v >= 0.200) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function wobaCls(v) {
  if (v >= 0.380) return 'bg-[#14532d] text-[#86efac]';
  if (v >= 0.350) return 'bg-[#166534] text-[#bbf7d0]';
  if (v >= 0.320) return '';
  if (v >= 0.281) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function slgCls(v) {
  if (v >= 0.510) return 'bg-[#14532d] text-[#86efac]';
  if (v >= 0.460) return 'bg-[#166534] text-[#bbf7d0]';
  if (v >= 0.410) return '';
  if (v >= 0.351) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
function isoCls(v) {
  if (v >= 0.240) return 'bg-[#14532d] text-[#86efac]';
  if (v >= 0.200) return 'bg-[#166534] text-[#bbf7d0]';
  if (v >= 0.170) return '';
  if (v >= 0.131) return 'bg-[#7f1d1d] text-[#fca5a5]';
  return 'bg-[#450a0a] text-[#f87171]';
}
// Low K% is batter-favorable
function kCls(v) {
  if (v <= 14) return 'bg-[#14532d] text-[#86efac]';
  if (v <= 19) return 'bg-[#166534] text-[#bbf7d0]';
  if (v <= 24) return '';
  if (v <= 29) return 'bg-[#7f1d1d] text-[#fca5a5]';
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

export default function BatterPitchCard({ batter, pitcherName, pitcherPitchData, pitcherHand, loading }) {
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

  if (!batter) return null;

  // Show ONLY the pitcher's top 4 pitches
  const top4Types = (pitcherPitchData ?? []).slice(0, 4).map(p => p.type);
  const rows = top4Types.length
    ? (batter.pitchData ?? []).filter(p => top4Types.includes(p.type))
    : (batter.pitchData ?? []).slice(0, 6);

  const insight = rows.length
    ? generateBatterInsight(batter.name, (pitcherPitchData ?? []).slice(0, 4), batter.pitchData, pitcherName)
    : null;

  const st = batter.seasonStat;
  const statPills = [
    st?.avg  != null && { label: 'AVG',  val: parseFloat(st.avg).toFixed(3)  },
    st?.obp  != null && { label: 'OBP',  val: parseFloat(st.obp).toFixed(3)  },
    st?.slg  != null && { label: 'SLG',  val: parseFloat(st.slg).toFixed(3)  },
    st?.ops  != null && { label: 'OPS',  val: parseFloat(st.ops).toFixed(3)  },
    batter.splitAVG != null && { label: `vs ${pitcherHand}HP`, val: batter.splitAVG.toFixed(3) },
  ].filter(Boolean);

  const relevantHandLabel = pitcherHand === 'L' ? 'vs LHP' : 'vs RHP';
  const otherHandLabel    = pitcherHand === 'L' ? 'vs RHP' : 'vs LHP';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={batter.headshotUrl}
              alt={batter.name}
              className="w-12 h-12 rounded-full object-cover bg-gray-800 flex-shrink-0"
              onError={e => { e.target.style.display='none'; }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-white">{batter.name}</span>
                {batter.hand && (
                  <span className="rounded-full bg-violet-600/20 border border-violet-500/30 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                    {batter.hand === 'L' ? 'LHB' : batter.hand === 'S' ? 'SH' : 'RHB'}
                  </span>
                )}
                {batter.teamAbbrev && (
                  <span className="text-xs text-gray-500">{batter.teamAbbrev}</span>
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
            <div className="relative group">
              <button className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-700 text-gray-500 hover:text-gray-300 text-[10px] font-black">ⓘ</button>
              <div className="absolute right-0 top-6 w-56 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-[10px] text-gray-300 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
                Showing stats vs {pitcherHand === 'L' ? 'left-handed' : 'right-handed'} pitchers — matched to today&apos;s starter
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pitch table — only pitcher's top 4 pitches */}
      {!batter.hasPitchData || rows.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-sm text-gray-500">
            {batter.usingFallbackSeason ? 'Showing 2025 stats — limited 2026 data' : 'No pitch breakdown data available yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800/60 text-gray-600 uppercase tracking-wide">
                <th className="px-3 py-2 text-left font-bold">Type</th>
                <th className="px-2 py-2 text-right font-bold">#</th>
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
              {rows.map(row => (
                <tr key={row.type}
                  className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-colors">
                  <td className="px-3 py-1.5 text-left font-semibold text-gray-200">{row.type}</td>
                  <Td>{fmtN(row.pitches)}</Td>
                  <Td cls={baCls(row.ba)}>{fmt3(row.ba)}</Td>
                  <Td cls={wobaCls(row.woba)}>{fmt3(row.woba)}</Td>
                  <Td cls={slgCls(row.slg)}>{fmt3(row.slg)}</Td>
                  <Td cls={isoCls(row.iso)}>{fmt3(row.iso)}</Td>
                  <Td>{fmtN(row.hr)}</Td>
                  <Td cls={kCls(row.kPct)}>{fmtPct(row.kPct)}</Td>
                  <Td cls={kCls(row.whiffPct)}>{fmtPct(row.whiffPct)}</Td>
                </tr>
              ))}
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
