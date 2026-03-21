'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getScoreColor(score) {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 45) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBg(score) {
  if (score >= 75) return 'border-emerald-500/30 bg-emerald-500/5';
  if (score >= 60) return 'border-yellow-500/30 bg-yellow-500/5';
  if (score >= 45) return 'border-orange-500/30 bg-orange-500/5';
  return 'border-red-500/30 bg-red-500/5';
}

function getRecommendationIcon(score) {
  if (score >= 75) return { icon: '✅', label: 'Strong Value', color: 'text-emerald-300' };
  if (score >= 60) return { icon: '👍', label: 'Good Value', color: 'text-yellow-300' };
  if (score >= 45) return { icon: '⚠️', label: 'Marginal Value', color: 'text-orange-300' };
  return { icon: '❌', label: 'Avoid', color: 'text-red-300' };
}

function formatNum(val, decimals = 3) {
  if (val === null || val === undefined) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toFixed(decimals);
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
            <span className="text-sm font-semibold text-emerald-400 border-b-2 border-emerald-400 pb-0.5">
              Dashboard
            </span>
            <Link
              href="/probables"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Probable Pitchers
            </Link>
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

// ─── Input field component ────────────────────────────────────────────────────
function InputField({ label, id, value, onChange, placeholder, type = 'text', required = false }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
        {required && <span className="ml-1 text-emerald-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
      />
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────
function ScoreCard({ score }) {
  const rec = getRecommendationIcon(score);
  return (
    <div className={`col-span-full rounded-xl border p-8 text-center ${getScoreBg(score)}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Matchup Score
      </div>
      <div className={`text-7xl font-black tabular-nums ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-lg">{rec.icon}</span>
        <span className={`text-base font-bold ${rec.color}`}>{rec.label}</span>
      </div>
      <div className="mt-2 text-sm text-gray-500">out of 100</div>
    </div>
  );
}

// ─── Recency Card ─────────────────────────────────────────────────────────────
function RecencyCard({ recency }) {
  if (!recency) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">📊</span>
          <h3 className="text-sm font-bold text-white">Recency Trends</h3>
        </div>
        <p className="text-sm text-gray-500">No recency data available.</p>
      </div>
    );
  }

  const rows = [
    {
      label: 'Last 10 — Avg Hits/Game',
      value: recency.last10AvgHitsPerGame !== undefined ? formatNum(recency.last10AvgHitsPerGame, 2) : '—',
    },
    {
      label: 'Last 5 — Avg Hits/Game',
      value: recency.last5AvgHitsPerGame !== undefined ? formatNum(recency.last5AvgHitsPerGame, 2) : '—',
    },
    {
      label: 'HR (Last 10 games)',
      value: recency.last10HR !== undefined ? recency.last10HR : '—',
    },
    {
      label: 'HR (Last 5 games)',
      value: recency.last5HR !== undefined ? recency.last5HR : '—',
    },
    {
      label: 'Recency Adjustment',
      value:
        recency.recencyAdjustment !== undefined
          ? `${recency.recencyAdjustment > 0 ? '+' : ''}${formatNum(recency.recencyAdjustment, 2)}`
          : '—',
      highlight: true,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📊</span>
        <h3 className="text-sm font-bold text-white">Recency Trends</h3>
      </div>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">{row.label}</span>
            <span
              className={`text-xs font-bold tabular-nums ${
                row.highlight ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Park Factors Card ────────────────────────────────────────────────────────
function ParkFactorsCard({ parkFactors }) {
  if (!parkFactors) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🏟️</span>
          <h3 className="text-sm font-bold text-white">Park Factors</h3>
        </div>
        <p className="text-sm text-gray-500">No park factor data available.</p>
      </div>
    );
  }

  const rows = [
    { label: 'Run Factor', value: formatNum(parkFactors.runFactor, 3) },
    { label: 'HR Factor', value: formatNum(parkFactors.hrFactor, 3) },
    {
      label: 'Park Adjustment',
      value:
        parkFactors.parkAdjustment !== undefined
          ? `${parkFactors.parkAdjustment > 0 ? '+' : ''}${formatNum(parkFactors.parkAdjustment, 2)}`
          : '—',
      highlight: true,
    },
  ];

  const stadium = parkFactors.stadium || parkFactors.name || '—';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🏟️</span>
        <h3 className="text-sm font-bold text-white">Park Factors</h3>
      </div>
      {stadium !== '—' && (
        <p className="text-xs text-gray-500 mb-4">{stadium}</p>
      )}
      {stadium === '—' && <div className="mb-4" />}
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">{row.label}</span>
            <span
              className={`text-xs font-bold tabular-nums ${
                row.highlight ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Weather Card ─────────────────────────────────────────────────────────────
function WeatherCard({ weather }) {
  if (!weather || (!weather.temperature && !weather.windSpeed && !weather.weatherImpact)) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">🌤️</span>
          <h3 className="text-sm font-bold text-white">Weather</h3>
        </div>
        <p className="text-sm text-gray-500">No weather data provided.</p>
        <p className="text-xs text-gray-600 mt-1">
          Add latitude &amp; longitude to include weather analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">🌤️</span>
        <h3 className="text-sm font-bold text-white">Weather</h3>
      </div>
      <div className="space-y-2.5">
        {weather.temperature !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">Temperature</span>
            <span className="text-xs font-bold text-white">{weather.temperature}°F</span>
          </div>
        )}
        {weather.windSpeed !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">Wind Speed</span>
            <span className="text-xs font-bold text-white">{weather.windSpeed} mph</span>
          </div>
        )}
        {weather.windDirection !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">Wind Direction</span>
            <span className="text-xs font-bold text-white">{weather.windDirection}</span>
          </div>
        )}
        {weather.condition !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">Condition</span>
            <span className="text-xs font-bold text-white">{weather.condition}</span>
          </div>
        )}
        {weather.weatherImpact !== undefined && (
          <div className="mt-1 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Impact Score</span>
              <span
                className={`text-xs font-bold tabular-nums ${
                  weather.weatherImpact > 0 ? 'text-emerald-400' : weather.weatherImpact < 0 ? 'text-red-400' : 'text-gray-400'
                }`}
              >
                {weather.weatherImpact > 0 ? '+' : ''}
                {formatNum(weather.weatherImpact, 2)}
              </span>
            </div>
          </div>
        )}
        {weather.notes && (
          <p className="mt-2 text-xs text-gray-500 italic">{weather.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Split Stats Card ─────────────────────────────────────────────────────────
function SplitStatsCard({ data }) {
  const split = data.splitUsed || data.split || null;
  const matchup = data.matchupStats || data.stats || null;

  const batterRows = [
    { label: 'Batting AVG', value: matchup?.avg !== undefined ? formatNum(matchup.avg, 3) : '—' },
    { label: 'OPS', value: matchup?.ops !== undefined ? formatNum(matchup.ops, 3) : '—' },
    { label: 'SLG', value: matchup?.slg !== undefined ? formatNum(matchup.slg, 3) : '—' },
    { label: 'OBP', value: matchup?.obp !== undefined ? formatNum(matchup.obp, 3) : '—' },
    { label: 'HR Rate', value: matchup?.hrRate !== undefined ? `${formatNum(matchup.hrRate * 100, 1)}%` : '—' },
    { label: 'At Bats', value: matchup?.atBats ?? '—' },
    { label: 'Home Runs', value: matchup?.homeRuns ?? '—' },
  ];

  const pitcherRows = [
    { label: 'ERA', value: matchup?.era !== undefined ? formatNum(matchup.era, 2) : '—' },
    { label: 'WHIP', value: matchup?.whip !== undefined ? formatNum(matchup.whip, 3) : '—' },
    { label: 'K/9', value: matchup?.k9 !== undefined ? formatNum(matchup.k9, 2) : '—' },
    { label: 'BB/9', value: matchup?.bb9 !== undefined ? formatNum(matchup.bb9, 2) : '—' },
    { label: 'FIP', value: matchup?.fip !== undefined ? formatNum(matchup.fip, 2) : '—' },
  ];

  const hasBatterStats = batterRows.some((r) => r.value !== '—');
  const hasPitcherStats = pitcherRows.some((r) => r.value !== '—');

  return (
    <div className="col-span-full rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-base">✂️</span>
          <h3 className="text-sm font-bold text-white">Split Stats</h3>
        </div>
        {split && (
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
            {split}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {hasBatterStats && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Batter Stats
            </div>
            <div className="space-y-2">
              {batterRows.map(
                (row) =>
                  row.value !== '—' && (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{row.label}</span>
                      <span className="text-xs font-bold text-white tabular-nums">{row.value}</span>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {hasPitcherStats && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Pitcher Stats
            </div>
            <div className="space-y-2">
              {pitcherRows.map(
                (row) =>
                  row.value !== '—' && (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{row.label}</span>
                      <span className="text-xs font-bold text-white tabular-nums">{row.value}</span>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {!hasBatterStats && !hasPitcherStats && (
          <div className="col-span-2">
            <p className="text-sm text-gray-500">No split stats available for this matchup.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [batterId, setBatterId] = useState('');
  const [pitcherId, setPitcherId] = useState('');
  const [season, setSeason] = useState('2025');
  const [stadium, setStadium] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function runMatchup() {
    if (!batterId.trim() || !pitcherId.trim()) {
      setError('Batter ID and Pitcher ID are required.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let url = `${API_URL}/matchup/batter/${batterId.trim()}/pitcher/${pitcherId.trim()}?season=${season}`;
      if (stadium.trim()) url += `&stadium=${encodeURIComponent(stadium.trim())}`;
      if (lat.trim() && lon.trim()) url += `&lat=${lat.trim()}&lon=${lon.trim()}`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch matchup data. Please check the IDs and try again.');
    } finally {
      setLoading(false);
    }
  }

  const score = result?.score ?? result?.matchupScore ?? null;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">Matchup Analysis</h1>
          <p className="mt-1.5 text-gray-400">
            Run a batter vs pitcher matchup analysis powered by PropEdge&apos;s scoring engine.
          </p>
        </div>

        {/* Input Card */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-base">⚙️</span>
            <h2 className="text-base font-bold text-white">Configure Matchup</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <InputField
              label="Batter ID"
              id="batterId"
              value={batterId}
              onChange={(e) => setBatterId(e.target.value)}
              placeholder="e.g. 660271"
              required
            />
            <InputField
              label="Pitcher ID"
              id="pitcherId"
              value={pitcherId}
              onChange={(e) => setPitcherId(e.target.value)}
              placeholder="e.g. 592789"
              required
            />
            <InputField
              label="Season"
              id="season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2025"
            />
            <InputField
              label="Stadium"
              id="stadium"
              value={stadium}
              onChange={(e) => setStadium(e.target.value)}
              placeholder="e.g. Dodger Stadium"
            />
            <InputField
              label="Latitude"
              id="lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Optional"
            />
            <InputField
              label="Longitude"
              id="lon"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
              <span className="text-red-400 mt-0.5">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Analysis failed</p>
                <p className="text-sm text-red-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={runMatchup}
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
                Analyzing Matchup...
              </>
            ) : (
              <>
                <span>⚡</span>
                Run Matchup Analysis
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {result && score !== null && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-white">Results</h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
                Analysis Complete
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Score (full width) */}
              <ScoreCard score={score} />

              {/* Detail cards */}
              <RecencyCard recency={result.recency ?? result.recencyData ?? null} />
              <ParkFactorsCard
                parkFactors={result.parkFactors ?? result.parkFactor ?? null}
              />
              <WeatherCard weather={result.weather ?? result.weatherData ?? null} />

              {/* Split stats (full width) */}
              <SplitStatsCard data={result} />
            </div>

            {/* Raw data accordion (debug-friendly) */}
            <details className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
              <summary className="cursor-pointer px-5 py-3.5 text-sm font-semibold text-gray-400 hover:text-white transition-colors select-none">
                View raw API response
              </summary>
              <pre className="overflow-x-auto px-5 pb-5 pt-2 text-xs text-gray-500 leading-relaxed">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/30 py-20 text-center">
            <span className="text-4xl mb-4">⚾</span>
            <p className="text-base font-semibold text-gray-400">No analysis yet</p>
            <p className="text-sm text-gray-600 mt-1 max-w-xs">
              Enter a batter ID and pitcher ID above, then click{' '}
              <span className="text-emerald-500 font-medium">Run Matchup Analysis</span> to get
              started.
            </p>
            <Link
              href="/probables"
              className="mt-5 inline-flex items-center gap-1.5 text-sm text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Find today&apos;s probable pitchers →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
