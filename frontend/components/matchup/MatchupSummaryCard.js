'use client';

import MismatchScorePill from './MismatchScorePill';
import {
  generateMatchupSummary, findKVulnerability, findPrimaryThreat, verdictStyle,
  calculateMismatchScore, calculateSimplifiedMismatchScore,
} from '../../lib/matchup';
import { calculateEdgeScoreAdjustment } from '../../lib/matchupAdjustment';

export default function MatchupSummaryCard({ pitcher, batter, h2h, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/60 p-5 animate-pulse">
        <div className="h-5 w-40 bg-gray-800 rounded mb-4"/>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-800 rounded-lg"/>)}
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-800 rounded w-full"/>
          <div className="h-3 bg-gray-800 rounded w-5/6"/>
          <div className="h-3 bg-gray-800 rounded w-4/6"/>
        </div>
      </div>
    );
  }

  if (!pitcher || !batter) return null;

  const top4 = (pitcher.pitchData ?? []).slice(0, 4);
  const kVuln   = findKVulnerability(batter.pitchData, top4);
  const threat  = findPrimaryThreat(batter.pitchData, top4);

  // Calculate mismatch score from available data
  let mismatch;
  if ((batter.pitchData ?? []).length > 0 && top4.length > 0) {
    mismatch = calculateMismatchScore(batter.pitchData, top4);
  } else {
    const splitAvg = batter.splitAVG ?? null;
    const seasonAvg = parseFloat(batter.seasonStat?.avg) || null;
    const seasonOBP = parseFloat(batter.seasonStat?.obp) || null;
    const seasonSLG = parseFloat(batter.seasonStat?.slg) || null;
    const batterOPS = (seasonOBP != null && seasonSLG != null) ? seasonOBP + seasonSLG : null;
    mismatch = calculateSimplifiedMismatchScore(splitAvg, seasonAvg, pitcher.era, h2h?.avg ?? null, h2h?.ab ?? 0, batterOPS, pitcher.whip ?? null);
  }

  const summary = generateMatchupSummary(
    pitcher.name, pitcher.hand,
    batter.name,  batter.hand,
    mismatch, h2h,
    top4.slice(0, 2)
  );

  const { text: verdictText, bg: verdictBg } = verdictStyle(mismatch.verdict);

  // Compute per-prop EdgeScore adjustments using a reference base of 60
  // (slightly above league avg — shows direction and magnitude of impact)
  const REF_BASE = 60;
  const primaryWobaEdge = threat?.edge ?? 0;
  const h2hAvg = h2h?.avg ?? null;
  const h2hAB  = h2h?.ab  ?? 0;
  const propImpacts = ['hits', 'hr', 'runs', 'rbi', 'strikeouts'].map(prop => {
    const adj = calculateEdgeScoreAdjustment(
      REF_BASE,
      mismatch.score,
      primaryWobaEdge,
      h2hAvg,
      h2hAB,
      prop
    );
    return { prop, pts: adj.adjustedPoints };
  });

  const metricBoxCls = 'rounded-lg border border-gray-700/40 bg-gray-800/50 p-3 text-center';

  return (
    <div className="rounded-xl border border-gray-700/40 bg-gray-900/60 p-5">
      {/* Title row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Matchup Summary</h3>
        <MismatchScorePill score={mismatch.score} showVerdict={false} size="md" />
      </div>

      {/* Four metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className={metricBoxCls}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Mismatch Score</p>
          <p className="text-2xl font-black tabular-nums" style={{
            color: mismatch.score >= 65 ? '#34d399' : mismatch.score <= 35 ? '#f87171' : '#9ca3af'
          }}>{mismatch.score}</p>
        </div>

        <div className={metricBoxCls}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Top Pitch Edge</p>
          {threat ? (
            <>
              <p className="text-sm font-bold text-white truncate">{threat.pitch}</p>
              <p className={`text-xs font-bold mt-0.5 ${threat.edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {threat.edge > 0 ? '+' : ''}{threat.edge.toFixed(3)} wOBA
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </div>

        <div className={metricBoxCls}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">K Vulnerability</p>
          {kVuln ? (
            <>
              <p className="text-sm font-bold text-white truncate">{kVuln.pitch}</p>
              <p className="text-xs font-bold text-red-400 mt-0.5">{kVuln.kPct.toFixed(1)}% K rate</p>
            </>
          ) : (
            <p className="text-sm text-gray-500">—</p>
          )}
        </div>

        <div className={metricBoxCls}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1">Verdict</p>
          <span className={`inline-flex items-center gap-1 rounded-full border ${verdictBg} ${verdictText} px-2 py-1 text-xs font-bold`}>
            {mismatch.verdict}
          </span>
        </div>
      </div>

      {/* Summary paragraph */}
      {summary && (
        <div className="rounded-lg border border-gray-700/40 bg-gray-800/30 px-4 py-3 mb-4">
          <p className="text-xs text-gray-300 leading-relaxed">{summary}</p>
        </div>
      )}

      {/* Prop impact row */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">EdgeScore Adjustment by Prop</p>
        <div className="flex gap-2 flex-wrap">
          {propImpacts.map(({ prop, pts }) => {
            const isPos = pts > 0;
            const isNeg = pts < 0;
            const label = prop === 'strikeouts' ? "K's" : prop.charAt(0).toUpperCase() + prop.slice(1);
            const cls = isPos ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                       : isNeg ? 'bg-red-500/10 border-red-500/25 text-red-400'
                       : 'bg-gray-800/50 border-gray-700/40 text-gray-500';
            return (
              <div key={prop} className={`flex-1 min-w-[4rem] rounded-lg border px-2 py-1.5 text-center ${cls}`}>
                <p className="text-[9px] font-bold uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
                <p className="text-xs font-black tabular-nums">
                  {pts > 0 ? '+' : ''}{pts !== 0 ? pts : '—'}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5">Based on mismatch score vs a 60-pt reference</p>
      </div>
    </div>
  );
}
