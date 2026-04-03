'use client';

// Returns [bgClass, textClass] — applied directly to <td> for full-cell color
function baCls(v) {
  if (v <= 0.220) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 0.259) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 0.289) return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 0.319) return ['bg-red-500/15',     'text-red-300'];
  return               ['bg-red-500/30',       'text-red-200'];
}
function wobaCls(v) {
  if (v <= 0.280) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 0.314) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 0.344) return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 0.374) return ['bg-red-500/15',     'text-red-300'];
  return               ['bg-red-500/30',       'text-red-200'];
}
function slgCls(v) {
  if (v <= 0.300) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 0.380) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 0.450) return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 0.530) return ['bg-red-500/15',     'text-red-300'];
  return               ['bg-red-500/30',       'text-red-200'];
}
function isoCls(v) {
  if (v <= 0.100) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 0.150) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 0.200) return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 0.250) return ['bg-red-500/15',     'text-red-300'];
  return               ['bg-red-500/30',       'text-red-200'];
}
function kCls(v) {
  if (v >= 30) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 25) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 19) return ['bg-gray-800/40',    'text-gray-300'];
  if (v >= 14) return ['bg-red-500/15',     'text-red-300'];
  return              ['bg-red-500/30',      'text-red-200'];
}
function whiffCls(v) {
  if (v >= 35) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v >= 27) return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v >= 20) return ['bg-gray-800/40',    'text-gray-300'];
  if (v >= 14) return ['bg-red-500/15',     'text-red-300'];
  return              ['bg-red-500/30',      'text-red-200'];
}
function hrCls(v) {
  if (v === 0) return ['bg-emerald-500/30', 'text-emerald-200'];
  if (v <= 2)  return ['bg-emerald-500/15', 'text-emerald-300'];
  if (v <= 4)  return ['bg-gray-800/40',    'text-gray-300'];
  if (v <= 7)  return ['bg-red-500/15',     'text-red-300'];
  return              ['bg-red-500/30',      'text-red-200'];
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

export default function PitcherPitchCard({ pitcher, batterName, batterPitchStats, batterHand, loading }) {
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

  if (!pitcher) return null;

  const pitches = (pitcher.pitchData ?? []).slice(0, 4);

  const statPills = [
    pitcher.era   != null && { label: 'ERA',  val: pitcher.era.toFixed(2) },
    pitcher.whip  != null && { label: 'WHIP', val: pitcher.whip.toFixed(2) },
    pitcher.kPct  != null && { label: 'K%',   val: (pitcher.kPct * 100).toFixed(1) + '%' },
    pitcher.k9    != null && { label: 'K/9',  val: pitcher.k9.toFixed(1) },
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-800/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={pitcher.headshotUrl}
              alt={pitcher.name}
              className="w-9 h-9 rounded-full object-cover bg-gray-800 flex-shrink-0 ring-2 ring-violet-500/25"
              onError={e => { e.target.style.display='none'; }}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-white">{pitcher.name}</span>
                {pitcher.hand && (
                  <span className="rounded-full bg-violet-600/20 border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                    {pitcher.hand}HP
                  </span>
                )}
                {pitcher.teamAbbrev && (
                  <span className="text-[11px] font-bold text-gray-500">{pitcher.teamAbbrev}</span>
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
          <span className="flex-shrink-0 rounded-full bg-violet-600/10 border border-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-400">
            {batterHand === 'L' ? 'vs LHB' : 'vs RHB'}
          </span>
        </div>
      </div>

      {/* Heatmap table */}
      {!pitcher.hasPitchData ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-gray-500 text-center">
            {pitcher.usingFallbackSeason ? 'Showing 2025 stats — limited 2026 data' : 'No pitch data available yet'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Pitch</th>
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
              {pitches.map((row) => (
                <tr key={row.type} className="border-b border-gray-800/50 border-l-2 border-l-violet-500/60">
                  <td className="px-3 py-1.5 bg-gray-900 min-w-[130px]">
                    <p className="text-xs font-bold text-gray-200 whitespace-nowrap">{row.type}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-14 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500/60" style={{ width: `${Math.min(100, Math.round(parseFloat(row.usagePct) || 0))}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-500 tabular-nums">{(parseFloat(row.usagePct) || 0).toFixed(0)}%</span>
                    </div>
                  </td>
                  <HeatCell value={fmt3(row.ba)}         clsFn={baCls}    raw={row.ba} />
                  <HeatCell value={fmt3(row.woba)}       clsFn={wobaCls}  raw={row.woba} />
                  <HeatCell value={fmt3(row.slg)}        clsFn={slgCls}   raw={row.slg} />
                  <HeatCell value={fmt3(row.iso)}        clsFn={isoCls}   raw={row.iso} />
                  <HeatCell value={fmtHR(row.hr)}        clsFn={hrCls}    raw={row.hr} />
                  <HeatCell value={fmtPct(row.kPct)}     clsFn={kCls}     raw={row.kPct} />
                  <HeatCell value={fmtPct(row.whiffPct)} clsFn={whiffCls} raw={row.whiffPct} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
