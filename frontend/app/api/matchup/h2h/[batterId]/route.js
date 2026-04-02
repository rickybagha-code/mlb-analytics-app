// GET /api/matchup/h2h/[batterId]?pitcherId=[id]
// Career head-to-head stats via MLB Stats API vsPlayer.
// Cache: 7 days (H2H history doesn't change intra-day)

import { NextResponse } from 'next/server';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

export async function GET(request, { params }) {
  const { batterId } = params;
  const { searchParams } = new URL(request.url);
  const pitcherId = searchParams.get('pitcherId');

  if (!batterId || !pitcherId) {
    return NextResponse.json({ error: 'Missing batterId or pitcherId' }, { status: 400 });
  }

  try {
    const url = `${MLB_API}/people/${batterId}/stats?stats=vsPlayer&opposingPlayerId=${pitcherId}&sportId=1&gameType=R`;
    const res = await fetch(url, { next: { revalidate: 86400 * 7 } });
    if (!res.ok) throw new Error(`MLB API ${res.status}`);

    const data = await res.json();
    const splits = data?.stats?.[0]?.splits ?? [];
    const stat   = splits[0]?.stat ?? null;

    if (!stat) {
      return NextResponse.json({
        ab: 0, h: 0, dbl: 0, tri: 0, hr: 0, bb: 0, k: 0,
        avg: null, obp: null, slg: null, ops: null, woba: null,
      }, { headers: { 'Cache-Control': 'public, max-age=604800' } });
    }

    const ab  = parseInt(stat.atBats)        || 0;
    const h   = parseInt(stat.hits)          || 0;
    const dbl = parseInt(stat.doubles)       || 0;
    const tri = parseInt(stat.triples)       || 0;
    const hr  = parseInt(stat.homeRuns)      || 0;
    const bb  = parseInt(stat.baseOnBalls)   || 0;
    const k   = parseInt(stat.strikeOuts)    || 0;
    const avg = parseFloat(stat.avg)         || null;
    const obp = parseFloat(stat.obp)         || null;
    const slg = parseFloat(stat.slg)         || null;
    const ops = parseFloat(stat.ops)         || null;

    // Simple wOBA proxy from available stats
    const pa = ab + bb;
    const singles = Math.max(0, h - dbl - tri - hr);
    const woba = pa > 0
      ? (bb * 0.690 + singles * 0.888 + dbl * 1.271 + tri * 1.616 + hr * 2.101) / pa
      : null;

    return NextResponse.json(
      { ab, h, dbl, tri, hr, bb, k, avg, obp, slg, ops, woba: woba ? parseFloat(woba.toFixed(3)) : null },
      { headers: { 'Cache-Control': 'public, max-age=604800' } }
    );
  } catch (err) {
    console.error('H2H fetch error:', err.message);
    return NextResponse.json({ ab: 0, h: 0, avg: null, error: true });
  }
}
