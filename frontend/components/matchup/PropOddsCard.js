'use client';

import { useState, useEffect } from 'react';

// Strip accents + suffixes, lowercase — matches the API route normalisation
function normName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+(jr|sr|ii|iii|iv)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fmtOdds(v) {
  if (v == null) return '—';
  return v > 0 ? `+${v}` : String(v);
}

// Colour the odds pill based on juice
function oddsCls(v) {
  if (v == null) return 'text-gray-500';
  if (v >= 100)  return 'text-emerald-400 font-bold';  // plus money = value
  if (v >= -110) return 'text-gray-300 font-semibold';
  if (v >= -130) return 'text-gray-400';
  return 'text-red-400';                                // heavy juice = caution
}

// Edge indicator — mismatch score direction vs prop type
function edgeCls(score, propKey, isOver) {
  const batterProps = ['hits', 'hr', 'totalBases', 'rbi', 'runs'];
  const isBatterProp = batterProps.includes(propKey);
  const batterFavored  = score >= 65;
  const pitcherFavored = score <= 35;

  if (isBatterProp) {
    if (isOver  && batterFavored)  return 'text-emerald-400';
    if (!isOver && pitcherFavored) return 'text-emerald-400';
    if (isOver  && pitcherFavored) return 'text-red-400';
    if (!isOver && batterFavored)  return 'text-red-400';
  } else {
    // Strikeouts — pitcher high K% = over edge
    if (isOver  && pitcherFavored) return 'text-emerald-400';
    if (!isOver && batterFavored)  return 'text-emerald-400';
  }
  return 'text-gray-500';
}

const BATTER_PROPS  = ['hits', 'hr', 'totalBases', 'rbi', 'runs'];
const PITCHER_PROPS = ['strikeouts'];
const PROP_LABEL    = {
  hits: 'Hits', hr: 'Home Runs', totalBases: 'Total Bases',
  rbi: 'RBIs', runs: 'Runs', strikeouts: 'Strikeouts',
};

function PropRow({ propKey, prop, mismatchScore }) {
  if (!prop) return null;
  const lineStr = prop.line != null ? `O/U ${prop.line}` : '—';
  return (
    <tr className="border-b border-gray-800/50 last:border-0">
      <td className="px-3 py-2 text-xs font-semibold text-gray-300 whitespace-nowrap">
        {PROP_LABEL[propKey]}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 tabular-nums text-center">
        {lineStr}
      </td>
      {/* Over */}
      <td className="px-2 py-2 text-center">
        <span className={`text-xs tabular-nums ${oddsCls(prop.over)}`}>
          {fmtOdds(prop.over)}
        </span>
        {prop.overProb != null && (
          <span className={`block text-[9px] tabular-nums ${edgeCls(mismatchScore, propKey, true)}`}>
            {prop.overProb}%
          </span>
        )}
      </td>
      {/* Under */}
      <td className="px-2 py-2 text-center">
        <span className={`text-xs tabular-nums ${oddsCls(prop.under)}`}>
          {fmtOdds(prop.under)}
        </span>
        {prop.underProb != null && (
          <span className={`block text-[9px] tabular-nums ${edgeCls(mismatchScore, propKey, false)}`}>
            {prop.underProb}%
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-[10px] text-gray-600 whitespace-nowrap">
        {prop.book}
      </td>
    </tr>
  );
}

function PlayerOddsSection({ name, propKeys, playerData, mismatchScore, accentCls }) {
  const available = propKeys.filter(k => playerData?.[k]);
  if (!available.length) {
    return (
      <div className="px-4 py-3 text-xs text-gray-600 italic">
        No lines posted yet for {name}
      </div>
    );
  }
  return (
    <div>
      <div className={`px-3 py-1.5 border-b border-gray-800/60 flex items-center gap-2`}>
        <span className={`text-[10px] font-black uppercase tracking-widest ${accentCls}`}>{name}</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-800/40">
            <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Prop</th>
            <th className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">Line</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">Over</th>
            <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-600">Under</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Book</th>
          </tr>
        </thead>
        <tbody>
          {available.map(k => (
            <PropRow key={k} propKey={k} prop={playerData[k]} mismatchScore={mismatchScore} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PropOddsCard({ pitcher, batter, mismatchScore }) {
  const [oddsData,  setOddsData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch('/api/odds/today')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setOddsData(d);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch(e => {
        setError(`Could not load odds (${e})`);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-gray-800/60">
          <div className="h-3.5 w-32 bg-gray-800 rounded"/>
        </div>
        {[1,2,3,4].map(i => <div key={i} className="h-9 border-b border-gray-800/40 bg-gray-800/20"/>)}
      </div>
    );
  }

  if (error || oddsData?.error) {
    const msg = error || oddsData?.error;
    // If just missing key, show a friendly setup prompt
    if (msg?.includes('ODDS_API_KEY')) {
      return (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
          <p className="text-sm font-bold text-gray-400 mb-1">Prop Lines Unavailable</p>
          <p className="text-xs text-gray-600">Add <code className="text-violet-400">ODDS_API_KEY</code> to your environment variables to enable live odds.</p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-center">
        <p className="text-xs text-gray-500">{msg}</p>
      </div>
    );
  }

  const players = oddsData?.players ?? {};
  const batterKey  = normName(batter?.name  ?? '');
  const pitcherKey = normName(pitcher?.name ?? '');
  const batterData  = players[batterKey]  ?? null;
  const pitcherData = players[pitcherKey] ?? null;

  const noData = !batterData && !pitcherData;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Prop Lines</h3>
          <p className="text-[10px] text-gray-600 mt-0.5">Best available odds across US books · implied % shown</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {oddsData?.creditsRemaining && (
            <span className="text-[9px] text-gray-700 tabular-nums">
              {oddsData.creditsRemaining} credits left
            </span>
          )}
          {lastUpdated && (
            <span className="text-[9px] text-gray-700">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-1.5 border-b border-gray-800/40 flex gap-4 text-[9px] font-bold">
        <span className="text-emerald-400">■ Edge signal</span>
        <span className="text-gray-500">■ Neutral</span>
        <span className="text-red-400">■ Against signal</span>
        <span className="text-gray-600 ml-auto">% = implied probability</span>
      </div>

      {noData ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500">No lines posted yet for this matchup</p>
          <p className="text-xs text-gray-600 mt-1">Lines typically appear 1–2 hours before first pitch</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {batter?.name && (
            <PlayerOddsSection
              name={batter.name}
              propKeys={BATTER_PROPS}
              playerData={batterData}
              mismatchScore={mismatchScore ?? 50}
              accentCls="text-sky-400"
            />
          )}
          {pitcher?.name && (
            <PlayerOddsSection
              name={pitcher.name}
              propKeys={PITCHER_PROPS}
              playerData={pitcherData}
              mismatchScore={mismatchScore ?? 50}
              accentCls="text-violet-400"
            />
          )}
        </div>
      )}
    </div>
  );
}
