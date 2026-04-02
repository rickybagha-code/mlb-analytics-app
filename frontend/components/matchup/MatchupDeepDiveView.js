'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import SeasonToggle from './SeasonToggle';
import PitcherPitchCard from './PitcherPitchCard';
import BatterPitchCard from './BatterPitchCard';
import H2HStrip from './H2HStrip';
import MatchupSummaryCard from './MatchupSummaryCard';

export default function MatchupDeepDiveView({ pitcherId, batterId }) {
  const [season,  setSeason]  = useState('2026');
  const [pitcher, setPitcher] = useState(null);
  const [batter,  setBatter]  = useState(null);
  const [h2h,     setH2H]     = useState(null);
  const [loadingPitcher, setLoadingPitcher] = useState(true);
  const [loadingBatter,  setLoadingBatter]  = useState(true);
  const [loadingH2H,     setLoadingH2H]     = useState(true);
  const [errorPitcher,   setErrorPitcher]   = useState(null);
  const [errorBatter,    setErrorBatter]    = useState(null);

  // Fetch pitcher data when season changes
  useEffect(() => {
    if (!pitcherId) return;
    setLoadingPitcher(true);
    setErrorPitcher(null);
    fetch(`/api/matchup/pitcher/${pitcherId}?season=${season}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setPitcher(d); setLoadingPitcher(false); })
      .catch(e => { setErrorPitcher(`Could not load pitcher data (${e})`); setLoadingPitcher(false); });
  }, [pitcherId, season]);

  // Fetch batter data — depends on pitcher.hand for correct platoon split
  useEffect(() => {
    if (!batterId) return;
    setLoadingBatter(true);
    setErrorBatter(null);
    const hand = pitcher?.hand ?? '';
    fetch(`/api/matchup/batter/${batterId}?season=${season}&pitcherHand=${hand}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setBatter(d); setLoadingBatter(false); })
      .catch(e => { setErrorBatter(`Could not load batter data (${e})`); setLoadingBatter(false); });
  }, [batterId, season, pitcher?.hand]);

  // Fetch H2H
  useEffect(() => {
    if (!batterId || !pitcherId) return;
    setLoadingH2H(true);
    fetch(`/api/matchup/h2h/${batterId}?pitcherId=${pitcherId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setH2H(d); setLoadingH2H(false); })
      .catch(() => { setH2H({ ab: 0 }); setLoadingH2H(false); });
  }, [batterId, pitcherId]);

  const pitcherName = pitcher?.name ?? '…';
  const batterName  = batter?.name  ?? '…';
  const pitcherHand = pitcher?.hand ?? 'R';
  const batterHand  = batter?.hand  ?? 'R';

  return (
    <div>
      {/* Navigation + header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link href="/dashboard/matchup"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-200 transition-colors mb-2">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Today&apos;s Matchups
          </Link>
          <div className="text-xs text-gray-500 mb-1">
            Matchup Analyzer →{' '}
            <span className="text-gray-300">{pitcherName} vs {batterName}</span>
          </div>
          <h2 className="text-xl font-black text-white">
            {pitcherName} <span className="text-gray-500 font-medium">vs</span> {batterName}
          </h2>
        </div>
        <SeasonToggle season={season} onChange={setSeason} />
      </div>

      <div className="space-y-4">
        {/* Pitcher card */}
        {errorPitcher ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
            <p className="text-sm text-gray-500">{errorPitcher}</p>
          </div>
        ) : (
          <PitcherPitchCard
            pitcher={pitcher}
            batterName={batterName}
            batterPitchStats={batter?.pitchData ?? []}
            batterHand={batterHand}
            loading={loadingPitcher}
          />
        )}

        {/* H2H strip */}
        <H2HStrip h2h={h2h} loading={loadingH2H} />

        {/* Batter card */}
        {errorBatter ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
            <p className="text-sm text-gray-500">{errorBatter}</p>
          </div>
        ) : (
          <BatterPitchCard
            batter={batter}
            pitcherName={pitcherName}
            pitcherPitchData={pitcher?.pitchData ?? []}
            pitcherHand={pitcherHand}
            loading={loadingBatter}
          />
        )}

        {/* Summary card */}
        <MatchupSummaryCard
          pitcher={pitcher}
          batter={batter}
          h2h={h2h}
          loading={loadingPitcher || loadingBatter}
        />
      </div>
    </div>
  );
}
