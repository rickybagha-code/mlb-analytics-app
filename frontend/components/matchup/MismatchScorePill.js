'use client';

import { scoreStyle, verdictStyle } from '../../lib/matchup';

export default function MismatchScorePill({ score, showVerdict = true, size = 'md' }) {
  const verdict = score >= 65 ? 'Batter Edge' : score <= 35 ? 'Pitcher Edge' : 'Neutral';
  const { text, bg } = scoreStyle(score);

  const sizeCls = size === 'lg'
    ? 'px-3.5 py-1.5 text-sm font-black'
    : size === 'sm'
    ? 'px-2 py-0.5 text-[10px] font-bold'
    : 'px-2.5 py-1 text-xs font-bold';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${bg} ${text} ${sizeCls}`}>
      <span className="tabular-nums">{score}</span>
      {showVerdict && <span className="opacity-80">{verdict}</span>}
    </span>
  );
}
