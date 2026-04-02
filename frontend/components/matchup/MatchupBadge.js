'use client';

import Link from 'next/link';

/**
 * Small matchup adjustment badge shown below the EdgeScore ring on player cards.
 * Only rendered when |adjustedPoints| > 2 and adjustment was applied.
 *
 * Props:
 *  batterId    – MLB player ID
 *  pitcherId   – opposing pitcher ID (null = no pitcher announced)
 *  adjustment  – { adjustedPoints, direction, applied } from calculateEdgeScoreAdjustment
 *  isPro       – whether to show the full link (non-pro sees upgrade modal trigger)
 */
export default function MatchupBadge({ batterId, pitcherId, adjustment, isPro }) {
  if (!adjustment?.applied) return null;
  if (Math.abs(adjustment.adjustedPoints) <= 2) return null;

  const isUp  = adjustment.direction === 'up';
  const pts   = Math.abs(adjustment.adjustedPoints);
  const label = `${isUp ? '↑' : '↓'} Matchup ${isUp ? '+' : '-'}${pts}`;
  const cls   = isUp ? 'text-emerald-400' : 'text-red-400';

  const matchupHref = pitcherId
    ? `/dashboard/matchup?pitcher=${pitcherId}&batter=${batterId}`
    : '/dashboard/matchup';

  const tooltipBody = (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-2 text-[10px] text-gray-300 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
      Pitch type matchup analysis adjusted this EdgeScore by {isUp ? '+' : '-'}{pts} points.
      {isPro && pitcherId && (
        <span className="block mt-1 text-violet-400 pointer-events-auto">
          → View full matchup analysis
        </span>
      )}
    </div>
  );

  if (isPro && pitcherId) {
    return (
      <div className="relative group mt-0.5 text-center">
        <Link href={matchupHref} className={`text-[10px] font-bold ${cls} hover:underline`}>
          {label}
        </Link>
        {tooltipBody}
      </div>
    );
  }

  return (
    <div className="relative group mt-0.5 text-center">
      <span className={`text-[10px] font-bold ${cls}`}>{label}</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-2 text-[10px] text-gray-300 leading-snug opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl">
        Pitch type matchup adjusted this EdgeScore by {isUp ? '+' : '-'}{pts} points.
        <span className="block mt-1 text-violet-400">Upgrade to Pro to view full analysis.</span>
      </div>
    </div>
  );
}
