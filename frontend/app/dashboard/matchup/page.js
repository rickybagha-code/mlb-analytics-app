'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProprStatsLogo from '../../../components/ProprStatsLogo';
import MatchupLandingView from '../../../components/matchup/MatchupLandingView';
import MatchupDeepDiveView from '../../../components/matchup/MatchupDeepDiveView';

// Pro check — matches dashboard pattern (hardcoded true for beta)
const isPro = true;

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-gray-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center group">
            <ProprStatsLogo variant="light" size={30} wordmarkClass="group-hover:text-blue-400 transition-colors" />
          </Link>
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-violet-400 border-b-2 border-violet-500 pb-0.5">Matchup Analyzer</span>
            <Link href="/dashboard" className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-300 transition-colors">← Dashboard</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Segmented control (mirrors dashboard) ────────────────────────────────────
function DashboardSegments() {
  return (
    <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-gray-900 border border-gray-800 w-fit">
      <Link href="/dashboard"
        className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-gray-400 hover:text-white">
        Props Board
      </Link>
      <button
        className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 bg-violet-600 text-white shadow-lg shadow-violet-500/30 scale-[1.03]">
        Matchup Analyzer
      </button>
      <Link href="/dashboard/weather"
        className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 text-gray-400 hover:text-white">
        Weather
      </Link>
    </div>
  );
}

// ─── Inner page (reads URL params) ────────────────────────────────────────────
function MatchupPageInner() {
  const sp = useSearchParams();
  const pitcherId = sp.get('pitcher');
  const batterId  = sp.get('batter');

  const isDeepDive = !!(pitcherId && batterId);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <DashboardSegments />
        {isDeepDive ? (
          <MatchupDeepDiveView pitcherId={pitcherId} batterId={batterId} />
        ) : (
          <MatchupLandingView isPro={isPro} />
        )}
      </main>
    </div>
  );
}

// ─── Page export (Suspense for useSearchParams) ───────────────────────────────
export default function MatchupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-sm text-gray-500 animate-pulse">Loading matchup analyzer…</div>
      </div>
    }>
      <MatchupPageInner />
    </Suspense>
  );
}
