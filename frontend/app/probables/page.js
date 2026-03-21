'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTodayString() {
  // Return today's date as YYYY-MM-DD in local time
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-xl">⚾</span>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              PropEdge
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-sm font-semibold text-emerald-400 border-b-2 border-emerald-400 pb-0.5">
              Probable Pitchers
            </span>
            <Link
              href="/"
              className="hidden sm:inline-flex text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Game Card ────────────────────────────────────────────────────────────────
function GameCard({ game }) {
  const awayTeam = game.awayTeam?.name || game.away?.name || game.awayTeamName || 'Away Team';
  const homeTeam = game.homeTeam?.name || game.home?.name || game.homeTeamName || 'Home Team';

  const awayPitcher =
    game.awayProbablePitcher?.fullName ||
    game.away?.probablePitcher?.fullName ||
    game.awayPitcherName ||
    null;
  const homePitcher =
    game.homeProbablePitcher?.fullName ||
    game.home?.probablePitcher?.fullName ||
    game.homePitcherName ||
    null;

  const awayPitcherId =
    game.awayProbablePitcher?.id ||
    game.away?.probablePitcher?.id ||
    game.awayPitcherId ||
    null;
  const homePitcherId =
    game.homeProbablePitcher?.id ||
    game.home?.probablePitcher?.id ||
    game.homePitcherId ||
    null;

  const venue = game.venue?.name || game.venueName || null;
  const gameTime = game.gameDate || game.time || null;

  let timeStr = '';
  if (gameTime) {
    try {
      const d = new Date(gameTime);
      timeStr = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      timeStr = '';
    }
  }

  return (
    <div className="group rounded-xl border border-gray-800 bg-gray-900 p-5 transition-all duration-200 hover:border-gray-700 hover:bg-gray-900/80">
      {/* Venue + Time */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          {venue && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs">🏟️</span>
              <span className="text-xs font-medium text-gray-400">{venue}</span>
            </div>
          )}
          {timeStr && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs">🕐</span>
              <span className="text-xs text-gray-500">{timeStr}</span>
            </div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-400">
          MLB
        </span>
      </div>

      {/* Matchup */}
      <div className="space-y-3">
        {/* Away */}
        <div className="flex items-start justify-between gap-3 rounded-lg bg-gray-800/40 p-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{awayTeam}</div>
            <div className="text-xs text-gray-500 mt-0.5">Away</div>
          </div>
          <div className="text-right shrink-0">
            {awayPitcher ? (
              <>
                <div className="text-sm font-semibold text-gray-200 whitespace-nowrap">{awayPitcher}</div>
                {awayPitcherId && (
                  <div className="text-xs text-gray-600 mt-0.5 font-mono">
                    ID: {awayPitcherId}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600 italic">TBD</div>
            )}
          </div>
        </div>

        {/* vs divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-xs text-gray-600 font-medium">vs</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* Home */}
        <div className="flex items-start justify-between gap-3 rounded-lg bg-gray-800/40 p-3">
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{homeTeam}</div>
            <div className="text-xs text-gray-500 mt-0.5">Home</div>
          </div>
          <div className="text-right shrink-0">
            {homePitcher ? (
              <>
                <div className="text-sm font-semibold text-gray-200 whitespace-nowrap">{homePitcher}</div>
                {homePitcherId && (
                  <div className="text-xs text-gray-600 mt-0.5 font-mono">
                    ID: {homePitcherId}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600 italic">TBD</div>
            )}
          </div>
        </div>
      </div>

      {/* Pitcher ID helper */}
      {(awayPitcherId || homePitcherId) && (
        <div className="mt-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
          <p className="text-xs text-gray-500 mb-1.5">Copy pitcher ID to use in dashboard:</p>
          <div className="flex flex-wrap gap-2">
            {awayPitcherId && (
              <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-emerald-400 select-all">
                {awayPitcherId}
              </span>
            )}
            {homePitcherId && (
              <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-emerald-400 select-all">
                {homePitcherId}
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <Link
        href="/dashboard"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-700 py-2 text-xs font-semibold text-gray-400 transition-all hover:border-emerald-500/40 hover:text-emerald-400"
      >
        Use in Dashboard
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProbablesPage() {
  const [date, setDate] = useState(getTodayString());
  const [teamId, setTeamId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [games, setGames] = useState(null);

  async function fetchProbables() {
    if (!date) {
      setError('Please select a date.');
      return;
    }

    setLoading(true);
    setError(null);
    setGames(null);

    try {
      let url = `${API_URL}/games/probables?date=${date}`;
      if (teamId.trim()) url += `&teamId=${teamId.trim()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || `Server error: ${res.status}`);
      }

      const data = await res.json();

      // Normalize: API might return array directly or { games: [...] } or { dates: [...] }
      let normalized = [];
      if (Array.isArray(data)) {
        normalized = data;
      } else if (Array.isArray(data?.games)) {
        normalized = data.games;
      } else if (Array.isArray(data?.dates)) {
        for (const dateObj of data.dates) {
          if (Array.isArray(dateObj.games)) normalized.push(...dateObj.games);
        }
      } else if (data && typeof data === 'object') {
        // Last resort: try to find any array value
        const found = Object.values(data).find((v) => Array.isArray(v));
        if (found) normalized = found;
      }

      setGames(normalized);
    } catch (err) {
      setError(err.message || 'Failed to fetch probable pitchers. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const hasGames = games !== null && games.length > 0;
  const isEmpty = games !== null && games.length === 0;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">Probable Pitchers</h1>
          <p className="mt-1.5 text-gray-400">
            Look up today&apos;s or any date&apos;s MLB starting pitchers. Copy IDs directly into
            the Dashboard for instant matchup analysis.
          </p>
        </div>

        {/* Input Card */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-base">📅</span>
            <h2 className="text-base font-bold text-white">Search Parameters</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="date"
                className="text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Date <span className="text-emerald-500">*</span>
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 [color-scheme:dark]"
              />
            </div>

            {/* Team ID */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="teamId"
                className="text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Team ID{' '}
                <span className="text-gray-600 normal-case font-normal">(optional)</span>
              </label>
              <input
                id="teamId"
                type="text"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="Optional — e.g. 119 for Dodgers"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <span className="text-red-400 mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Failed to load games</p>
                <p className="text-sm text-red-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={fetchProbables}
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                  />
                </svg>
                Loading Games...
              </>
            ) : (
              <>
                <span>🔍</span>
                Find Probable Pitchers
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {hasGames && (
          <div>
            {/* Count header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {games.length} {games.length === 1 ? 'Game' : 'Games'} Found
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">{formatDateDisplay(date)}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                MLB Schedule
              </span>
            </div>

            {/* Tip banner */}
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
              <span className="text-emerald-400 text-sm mt-0.5">💡</span>
              <p className="text-xs text-gray-400">
                Pitcher IDs are shown in{' '}
                <span className="font-mono text-emerald-400">green monospace</span> below each
                pitcher name. Click to select and copy, then paste into the{' '}
                <Link href="/dashboard" className="text-emerald-400 hover:underline">
                  Dashboard
                </Link>{' '}
                to run a matchup analysis.
              </p>
            </div>

            {/* Games grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {games.map((game, i) => (
                <GameCard key={game.gamePk || game.id || game.gameId || i} game={game} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/30 py-20 text-center">
            <span className="text-4xl mb-4">😶</span>
            <p className="text-base font-semibold text-gray-400">No games found</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xs">
              There are no scheduled games for{' '}
              <span className="text-gray-400">{formatDateDisplay(date)}</span>. Try a different
              date or check back later.
            </p>
            <button
              onClick={() => {
                setDate(getTodayString());
                setGames(null);
              }}
              className="mt-5 text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Reset to today
            </button>
          </div>
        )}

        {/* Initial empty state (before any search) */}
        {games === null && !loading && !error && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/30 py-20 text-center">
            <span className="text-4xl mb-4">📅</span>
            <p className="text-base font-semibold text-gray-400">Ready to search</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xs">
              Select a date above and click{' '}
              <span className="text-emerald-500 font-medium">Find Probable Pitchers</span> to load
              the day&apos;s MLB slate.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
