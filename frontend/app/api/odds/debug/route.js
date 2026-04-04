// GET /api/odds/debug
// Returns raw Odds API responses for diagnosis — remove before prod
import { NextResponse } from 'next/server';

const ODDS_API_KEY  = process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ALL_MARKETS   = 'batter_hits,batter_home_runs,batter_total_bases,batter_rbis,batter_runs_scored,pitcher_strikeouts';

export async function GET() {
  if (!ODDS_API_KEY) {
    return NextResponse.json({ error: 'ODDS_API_KEY not set' });
  }

  // Step 1: events
  const eventsRes = await fetch(
    `${ODDS_API_BASE}/sports/baseball_mlb/events?apiKey=${ODDS_API_KEY}&dateFormat=iso`,
    { cache: 'no-store' }
  );

  const creditsRemaining = eventsRes.headers.get('x-requests-remaining');
  const status = eventsRes.status;

  if (!eventsRes.ok) {
    const body = await eventsRes.text();
    return NextResponse.json({ step: 'events', status, body, creditsRemaining });
  }

  const events = await eventsRes.json();
  if (!Array.isArray(events) || !events.length) {
    return NextResponse.json({ step: 'events', count: 0, creditsRemaining });
  }

  // Step 2: odds for first event only (save credits)
  const firstEvent = events[0];
  const oddsRes = await fetch(
    `${ODDS_API_BASE}/sports/baseball_mlb/events/${firstEvent.id}/odds` +
    `?apiKey=${ODDS_API_KEY}&regions=us&markets=${ALL_MARKETS}&oddsFormat=american`,
    { cache: 'no-store' }
  );

  const oddsStatus = oddsRes.status;
  if (!oddsRes.ok) {
    const body = await oddsRes.text();
    return NextResponse.json({ step: 'odds', status: oddsStatus, body, event: firstEvent });
  }

  const oddsData = await oddsRes.json();

  // Aggregate all markets across all bookmakers
  const allMarketKeys = new Set();
  const playersByMarket = {};

  for (const bm of (oddsData.bookmakers ?? [])) {
    for (const market of (bm.markets ?? [])) {
      allMarketKeys.add(market.key);
      if (!playersByMarket[market.key]) playersByMarket[market.key] = {};
      for (const outcome of (market.outcomes ?? [])) {
        if (outcome.description) playersByMarket[market.key][outcome.description] = outcome.point;
      }
    }
  }

  const summary = {
    creditsRemaining,
    eventCount: events.length,
    firstEvent: { id: firstEvent.id, home: firstEvent.home_team, away: firstEvent.away_team },
    oddsStatus,
    bookmakerCount: oddsData.bookmakers?.length ?? 0,
    marketsAvailable: [...allMarketKeys],
    playerCountByMarket: Object.fromEntries(
      Object.entries(playersByMarket).map(([k, v]) => [k, Object.keys(v).length])
    ),
    // Show all players with their primary line for each market
    playersByMarket,
  };

  return NextResponse.json(summary);
}
