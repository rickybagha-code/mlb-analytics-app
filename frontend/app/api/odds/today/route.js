// GET /api/odds/today
// Fetches today's MLB player prop odds from The Odds API.
// Returns a normalised player-name map so the deep-dive can look up any player.
//
// Credit cost per call: (number of markets × 1 region) × number of games
//   = 6 markets × ~15 games = ~90 credits per full refresh
// Free tier: 500 credits/month — keep revalidate high (3600 = 1 h, ~5 refreshes/day)
// $30/month plan: 20k credits — comfortable for hourly refreshes across a full season.

import { NextResponse } from 'next/server';

const ODDS_API_KEY  = process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Markets to fetch — covers all props in our model
const BATTER_MARKETS   = ['batter_hits', 'batter_home_runs', 'batter_total_bases', 'batter_rbis', 'batter_runs_scored'];
const PITCHER_MARKETS  = ['pitcher_strikeouts'];
const ALL_MARKETS      = [...BATTER_MARKETS, ...PITCHER_MARKETS].join(',');

// Odds API market key → internal prop label
const MARKET_LABEL = {
  batter_hits:        'Hits',
  batter_home_runs:   'Home Runs',
  batter_total_bases: 'Total Bases',
  batter_rbis:        'RBIs',
  batter_runs_scored: 'Runs',
  pitcher_strikeouts: 'Strikeouts',
};

// Strip accents, suffixes, lowercase — for fuzzy name matching
function normName(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv)\.?\s*$/i, '')
    .trim();
}

// American odds → implied probability (0–1), removes vig direction awareness
function impliedProb(americanOdds) {
  if (americanOdds == null) return null;
  const o = Number(americanOdds);
  if (o < 0) return Math.round((-o / (-o + 100)) * 1000) / 10;   // e.g. -115 → 53.5
  return Math.round((100 / (o + 100)) * 1000) / 10;              // e.g. +105 → 48.8
}

export async function GET() {
  if (!ODDS_API_KEY) {
    return NextResponse.json(
      { players: {}, error: 'ODDS_API_KEY not set — add it to .env.local and Vercel env vars' },
      { status: 200 }
    );
  }

  try {
    // ── Step 1: get today's event IDs ─────────────────────────────────────────
    const eventsRes = await fetch(
      `${ODDS_API_BASE}/sports/baseball_mlb/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`,
      {
        headers: { 'User-Agent': 'ProprStats/1.0' },
        cache:   'no-store',
      }
    );

    const creditsRemaining = eventsRes.headers.get('x-requests-remaining');
    const creditsUsed      = eventsRes.headers.get('x-requests-last');

    if (!eventsRes.ok) {
      const body = await eventsRes.text();
      console.error('Odds API events error:', eventsRes.status, body);
      return NextResponse.json({ players: {}, creditsRemaining });
    }

    const events = await eventsRes.json();
    if (!Array.isArray(events) || !events.length) {
      return NextResponse.json({ players: {}, creditsRemaining, note: 'No games today' });
    }

    // ── Step 2: fetch prop odds for every game in parallel ────────────────────
    const propResults = await Promise.allSettled(
      events.map(ev =>
        fetch(
          `${ODDS_API_BASE}/sports/baseball_mlb/events/${ev.id}/odds` +
          `?apiKey=${ODDS_API_KEY}&regions=us&markets=${ALL_MARKETS}&oddsFormat=american`,
          {
            headers: { 'User-Agent': 'ProprStats/1.0' },
            cache:   'no-store',
          }
        ).then(r => r.ok ? r.json() : null)
      )
    );

    // ── Step 3: build normalised player map ───────────────────────────────────
    // players[normName] = {
    //   displayName, hits, hr, totalBases, rbi, runs, strikeouts
    // }
    // Each prop: { label, line, over, under, overProb, underProb, book }
    const players = {};

    for (const result of propResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const ev = result.value;

      for (const bookmaker of (ev.bookmakers ?? [])) {
        for (const market of (bookmaker.markets ?? [])) {
          const label = MARKET_LABEL[market.key];
          if (!label) continue;

          const internalKey = {
            batter_hits:        'hits',
            batter_home_runs:   'hr',
            batter_total_bases: 'totalBases',
            batter_rbis:        'rbi',
            batter_runs_scored: 'runs',
            pitcher_strikeouts: 'strikeouts',
          }[market.key];
          if (!internalKey) continue;

          // Group by player → point value → side
          // Markets like batter_home_runs list multiple Over lines (0.5, 1.5, 2.5) per player
          const byPlayer = {};
          for (const outcome of (market.outcomes ?? [])) {
            const pName = outcome.description;
            if (!pName) continue;
            const pt = outcome.point ?? 0;
            if (!byPlayer[pName]) byPlayer[pName] = {};
            if (!byPlayer[pName][pt]) byPlayer[pName][pt] = {};
            if (outcome.name === 'Over')  byPlayer[pName][pt].over  = outcome.price;
            if (outcome.name === 'Under') byPlayer[pName][pt].under = outcome.price;
          }

          for (const [pName, byPoint] of Object.entries(byPlayer)) {
            // Always use the lowest point (primary line: 0.5 for HR, standard for others)
            const points = Object.keys(byPoint).map(Number).sort((a, b) => a - b);
            const selectedPoint = points[0];
            const sides = byPoint[selectedPoint];

            const key = normName(pName);
            if (!players[key]) players[key] = { displayName: pName };

            // Prefer lowest point (primary line); tiebreak on best over odds
            const existing = players[key][internalKey];
            const existingLine = existing?.line ?? 9999;
            const newOverPrice = sides.over ?? -9999;
            const existingOverPrice = existing?.over ?? -9999;
            const shouldReplace = !existing
              || selectedPoint < existingLine
              || (selectedPoint === existingLine && newOverPrice > existingOverPrice);
            if (shouldReplace) {
              players[key][internalKey] = {
                label,
                line:      selectedPoint,
                over:      sides.over  ?? null,
                under:     sides.under ?? null,
                overProb:  impliedProb(sides.over),
                underProb: impliedProb(sides.under),
                book:      bookmaker.title,
              };
            }
          }
        }
      }
    }

    return NextResponse.json(
      { players, creditsRemaining, creditsUsed, gamesCount: events.length }
    );
  } catch (err) {
    console.error('Odds API error:', err.message);
    return NextResponse.json({ players: {}, error: err.message });
  }
}
