'use client';

import { LEAGUE_AVG_WOBA_BY_PITCH } from '../../lib/matchup';

// Returns a 0-100 edge score for the batter vs this pitch
// Positive = batter advantage, negative = pitcher advantage
function calcEdge(batterWoba, pitcherWoba, pitchName) {
  const lgAvg = LEAGUE_AVG_WOBA_BY_PITCH[pitchName] ?? 0.300;
  // Edge = how much better batter does vs how well pitcher suppresses
  // pitcher edge: how much below lg avg they allow
  // batter edge: how much above lg avg they hit
  const pitcherEdge = lgAvg - (pitcherWoba ?? lgAvg); // positive = pitcher good
  const batterEdge  = (batterWoba  ?? lgAvg) - lgAvg; // positive = batter good
  // Net edge from batter perspective
  return batterEdge - pitcherEdge;
}

function edgeLabel(net) {
  if (net >  0.080) return { text: 'Strong edge', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  if (net >  0.035) return { text: 'Slight edge',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  if (net < -0.080) return { text: 'Pitcher wins', cls: 'bg-red-500/15 text-red-300 border-red-500/30' };
  if (net < -0.035) return { text: 'Pitcher edge', cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
  return { text: 'Even',        cls: 'bg-gray-700/40 text-gray-400 border-gray-600/30' };
}

function usageBar(pct) {
  const val = parseFloat(pct) || 0;
  const w = Math.min(100, Math.round(val));
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-violet-500/60" style={{ width: `${w}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">{val.toFixed(0)}%</span>
    </div>
  );
}

function StatCell({ label, value, cls }) {
  return (
    <div className={`rounded px-2 py-1.5 text-center ${cls || 'bg-gray-800/40'}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-600 mb-0.5">{label}</p>
      <p className="text-xs font-black tabular-nums text-gray-200">
        {value != null ? (typeof value === 'number' && value < 1 ? value.toFixed(3) : value) : '—'}
      </p>
    </div>
  );
}

function wobaCls(v, invert) {
  // invert=true for pitcher (low wOBA = good for pitcher = green)
  if (v == null) return 'bg-gray-800/40';
  const good = invert ? v <= 0.280 : v >= 0.380;
  const ok   = invert ? v <= 0.319 : v >= 0.340;
  const bad  = invert ? v >= 0.380 : v <= 0.270;
  const ugly = invert ? v >= 0.420 : v <= 0.240;
  if (ugly) return invert ? 'bg-[#450a0a]' : 'bg-[#14532d]';
  if (bad)  return invert ? 'bg-[#7f1d1d]' : 'bg-[#166534]';
  if (good) return invert ? 'bg-[#14532d]' : 'bg-[#14532d]';
  if (ok)   return invert ? 'bg-[#166534]' : 'bg-[#166534]';
  return 'bg-gray-800/40';
}

function kPctCls(v, invert) {
  // invert=true for pitcher (high K% = good for pitcher = green)
  if (v == null) return 'bg-gray-800/40';
  if (invert) {
    if (v >= 30) return 'bg-[#14532d]';
    if (v >= 24) return 'bg-[#166534]';
    if (v <= 14) return 'bg-[#450a0a]';
    if (v <= 18) return 'bg-[#7f1d1d]';
  } else {
    if (v <= 14) return 'bg-[#14532d]';
    if (v <= 19) return 'bg-[#166534]';
    if (v >= 30) return 'bg-[#450a0a]';
    if (v >= 25) return 'bg-[#7f1d1d]';
  }
  return 'bg-gray-800/40';
}

export default function PitchMatchupMatrix({ pitcher, batter, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse space-y-3">
        <div className="h-4 w-48 bg-gray-800 rounded" />
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!pitcher || !batter) return null;

  const pitcherPitches = (pitcher.pitchData ?? []).slice(0, 6);
  if (!pitcherPitches.length) return null;

  const batterMap = Object.fromEntries(
    (batter.pitchData ?? []).map(p => [p.type, p])
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Pitch Matchup Matrix</h3>
          <p className="text-[10px] text-gray-600 mt-0.5">Pitcher&apos;s arsenal vs batter&apos;s results against each pitch type</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-600">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-violet-500/50" /> Pitcher
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-sky-500/50" /> Batter
          </span>
        </div>
      </div>

      {/* Matrix rows */}
      <div className="divide-y divide-gray-800/40">
        {pitcherPitches.map((pp, idx) => {
          const bp  = batterMap[pp.type] ?? null;
          const net = calcEdge(bp?.woba, pp.woba, pp.type);
          const edge = edgeLabel(net);
          const isPrimary = idx < 4;

          return (
            <div
              key={pp.type}
              className={`px-4 py-3 ${isPrimary ? 'border-l-2 border-l-violet-500/50' : 'border-l-2 border-l-transparent'}`}
            >
              {/* Pitch name + usage + edge badge */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-black text-white min-w-[110px]">{pp.type}</span>
                <div className="flex-1">{usageBar(pp.usagePct)}</div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${edge.cls}`}>
                  {edge.text}
                </span>
              </div>

              {/* Stats grid: pitcher side | divider | batter side */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                {/* Pitcher side */}
                <div className="grid grid-cols-3 gap-1">
                  <StatCell label="P-wOBA" value={pp.woba} cls={wobaCls(pp.woba, true)} />
                  <StatCell label="P-K%"   value={pp.kPct != null ? pp.kPct.toFixed(1) + '%' : null} cls={kPctCls(pp.kPct, true)} />
                  <StatCell label="Whiff%" value={pp.whiffPct != null ? pp.whiffPct.toFixed(1) + '%' : null} cls="bg-gray-800/40" />
                </div>

                {/* Divider */}
                <div className="flex flex-col items-center justify-center self-center px-1">
                  <div className="w-px h-8 bg-gray-700/60" />
                  <span className="text-[9px] text-gray-700 font-bold my-0.5">VS</span>
                  <div className="w-px h-8 bg-gray-700/60" />
                </div>

                {/* Batter side */}
                {bp ? (
                  <div className="grid grid-cols-3 gap-1">
                    <StatCell label="B-wOBA" value={bp.woba} cls={wobaCls(bp.woba, false)} />
                    <StatCell label="B-K%"   value={bp.kPct != null ? bp.kPct.toFixed(1) + '%' : null} cls={kPctCls(bp.kPct, false)} />
                    <StatCell label="BA"     value={bp.ba} cls="bg-gray-800/40" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-10">
                    <span className="text-[10px] text-gray-700 italic">No data vs this pitch</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-800/40 flex flex-wrap gap-3">
        {[
          { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', text: 'Batter edge' },
          { cls: 'bg-gray-700/40 text-gray-400 border-gray-600/30', text: 'Even' },
          { cls: 'bg-red-500/15 text-red-300 border-red-500/30', text: 'Pitcher edge' },
        ].map(l => (
          <span key={l.text} className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${l.cls}`}>{l.text}</span>
        ))}
        <span className="text-[9px] text-gray-700 ml-auto">Edge = batter wOBA vs pitcher wOBA vs league avg</span>
      </div>
    </div>
  );
}
