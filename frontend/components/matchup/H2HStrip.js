'use client';

function statVal(v, d = 3) {
  if (v == null) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : n.toFixed(d);
}

function avgCls(avg) {
  if (avg == null) return '';
  if (avg >= 0.300) return 'text-emerald-400 font-bold';
  if (avg <= 0.199) return 'text-red-400 font-bold';
  return 'text-gray-200';
}
function opsCls(ops) {
  if (ops == null) return '';
  if (ops >= 0.900) return 'text-emerald-400 font-bold';
  if (ops <= 0.599) return 'text-red-400 font-bold';
  return 'text-gray-200';
}

function SampleBadge({ ab }) {
  if (ab >= 20) return null;
  if (ab >= 10) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
      Moderate sample
    </span>
  );
  if (ab >= 5) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-400">
      Small sample — use with caution
    </span>
  );
  if (ab >= 1) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-400">
      Very small sample — not reliable
    </span>
  );
  return null;
}

export default function H2HStrip({ h2h, loading }) {
  if (loading) {
    return (
      <div className="border-y border-gray-800/60 py-4 px-4 animate-pulse">
        <div className="h-4 w-36 bg-gray-800 rounded mb-3"/>
        <div className="h-8 bg-gray-800 rounded"/>
      </div>
    );
  }

  return (
    <div className="border-y border-gray-800/60 py-4 px-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <span className="text-xs font-black uppercase tracking-widest text-gray-500">Career Head-to-Head</span>
        <div className="flex items-center gap-2">
          {h2h?.ab > 0 && (
            <span className="rounded-full bg-gray-800 border border-gray-700 px-2.5 py-0.5 text-[10px] font-bold text-gray-400">
              {h2h.ab} career AB
            </span>
          )}
          <SampleBadge ab={h2h?.ab ?? 0} />
        </div>
      </div>

      {(!h2h || h2h.ab === 0) ? (
        <p className="text-center text-sm text-gray-500 py-2">First career meeting</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-600 uppercase tracking-wide border-b border-gray-800">
                {['AB','H','2B','3B','HR','BB','K','AVG','OBP','SLG','OPS','wOBA'].map(col => (
                  <th key={col} className="pb-1.5 pr-4 text-right font-bold first:text-left">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pt-2 pr-4 text-gray-200">{h2h.ab}</td>
                <td className="pt-2 pr-4 text-gray-200">{h2h.h}</td>
                <td className="pt-2 pr-4 text-gray-200">{h2h.dbl ?? '—'}</td>
                <td className="pt-2 pr-4 text-gray-200">{h2h.tri ?? '—'}</td>
                <td className="pt-2 pr-4 text-gray-200">{h2h.hr ?? '—'}</td>
                <td className="pt-2 pr-4 text-gray-200">{h2h.bb ?? '—'}</td>
                <td className="pt-2 pr-4 text-gray-200">{h2h.k ?? '—'}</td>
                <td className={`pt-2 pr-4 ${avgCls(h2h.avg)}`}>{statVal(h2h.avg)}</td>
                <td className="pt-2 pr-4 text-gray-200">{statVal(h2h.obp)}</td>
                <td className="pt-2 pr-4 text-gray-200">{statVal(h2h.slg)}</td>
                <td className={`pt-2 pr-4 ${opsCls(h2h.ops)}`}>{statVal(h2h.ops)}</td>
                <td className="pt-2 text-gray-200">{statVal(h2h.woba)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
