'use client';

import Link from 'next/link';

export default function ProGateOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-gray-700/60 bg-gray-900/95 shadow-2xl p-8 text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
          <svg className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-black text-white">
          Matchup Analyzer is a Pro feature
        </h3>
        <p className="mb-6 text-sm text-gray-400 leading-relaxed">
          Get pitch-by-pitch breakdowns, mismatch scores, and AI-generated matchup summaries
          for every game today. Upgrade to Pro to unlock.
        </p>

        <Link href="/pricing"
          className="block w-full rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all mb-3">
          Upgrade to Pro — $18.99/mo
        </Link>

        <Link href="/#features" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          See what&apos;s included →
        </Link>
      </div>
    </div>
  );
}
