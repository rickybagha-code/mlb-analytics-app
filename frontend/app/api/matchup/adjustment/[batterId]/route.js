// GET /api/matchup/adjustment/[batterId]?pitcherId=[id]&prop=[type]
// Pre-calculated EdgeScore adjustment for a batter-pitcher pair.
// Cache: 12 hours

import { NextResponse } from 'next/server';
import { calculateEdgeScoreAdjustment } from '../../../../../lib/matchupAdjustment';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

async function getSimplifiedMatchupData(batterId, pitcherId) {
  try {
    const [batterRes, pitcherRes, h2hRes] = await Promise.all([
      fetch(`${MLB_API}/people/${batterId}/stats?stats=season&group=hitting&season=2026&sportId=1`, { next: { revalidate: 3600 } }),
      fetch(`${MLB_API}/people/${pitcherId}/stats?stats=season&group=pitching&season=2026&sportId=1`, { next: { revalidate: 3600 } }),
      fetch(`${MLB_API}/people/${batterId}/stats?stats=vsPlayer&opposingPlayerId=${pitcherId}&sportId=1&gameType=R`, { next: { revalidate: 86400 } }),
    ]);

    const batterData  = batterRes.ok  ? await batterRes.json()  : null;
    const pitcherData = pitcherRes.ok ? await pitcherRes.json() : null;
    const h2hData     = h2hRes.ok     ? await h2hRes.json()     : null;

    const batterStat  = batterData?.stats?.[0]?.splits?.[0]?.stat  ?? null;
    const pitcherStat = pitcherData?.stats?.[0]?.splits?.[0]?.stat ?? null;
    const h2hStat     = h2hData?.stats?.[0]?.splits?.[0]?.stat     ?? null;

    return {
      batterAVG:  parseFloat(batterStat?.avg)  || null,
      pitcherERA: parseFloat(pitcherStat?.era) || null,
      h2hAvg:     parseFloat(h2hStat?.avg)     || null,
      h2hAB:      parseInt(h2hStat?.atBats)    || 0,
    };
  } catch {
    return { batterAVG: null, pitcherERA: null, h2hAvg: null, h2hAB: 0 };
  }
}

export async function GET(request, { params }) {
  const { batterId } = params;
  const { searchParams } = new URL(request.url);
  const pitcherId = searchParams.get('pitcherId');
  const propType  = searchParams.get('prop') || 'hits';

  if (!batterId || !pitcherId) {
    return NextResponse.json({ applied: false, multiplier: 1, adjustedPoints: 0, direction: 'neutral' });
  }

  try {
    const matchupData = await getSimplifiedMatchupData(batterId, pitcherId);

    // Use simplified mismatch score (no pitch type data needed for adjustment badge)
    // Score 50 = neutral; shifts based on ERA and H2H
    const eraNorm = matchupData.pitcherERA != null
      ? Math.max(-1, Math.min(1, (matchupData.pitcherERA - 4.20) / 2.0))
      : 0;
    const h2hNorm = matchupData.h2hAvg != null && matchupData.h2hAB >= 10 && matchupData.batterAVG
      ? Math.max(-1, Math.min(1, (matchupData.h2hAvg - matchupData.batterAVG) / 0.100))
      : 0;
    const mismatchScore = Math.max(0, Math.min(100, Math.round(50 + eraNorm * 15 + h2hNorm * 8)));
    const primaryPitchWobaEdge = eraNorm * 0.05; // proxy

    const result = calculateEdgeScoreAdjustment(
      75, // placeholder — caller applies multiplier to their own score
      mismatchScore,
      primaryPitchWobaEdge,
      matchupData.h2hAvg,
      matchupData.h2hAB,
      propType
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=43200' },
    });
  } catch (err) {
    console.error('Adjustment route error:', err.message);
    return NextResponse.json({ applied: false, multiplier: 1, adjustedPoints: 0, direction: 'neutral' });
  }
}
