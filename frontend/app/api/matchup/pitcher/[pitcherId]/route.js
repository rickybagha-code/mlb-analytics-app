// GET /api/matchup/pitcher/[pitcherId]?season=2026&hand=R
// Pitch type breakdown for a pitcher from Baseball Savant + MLB Stats API.
// hand param = opposing batter handedness ('L' or 'R') — filters Savant results.
// Cache: 24 hours

import { NextResponse } from 'next/server';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

const PITCH_NAMES = {
  FF:'Four-Seam FB', SI:'Sinker', FC:'Cutter', SL:'Slider',
  CU:'Curveball', CH:'Changeup', FS:'Splitter', ST:'Sweeper',
  SV:'Slurve', KC:'Knuckle-Curve', KN:'Knuckleball', EP:'Eephus',
};

function parseCSVRow(line) {
  const fields = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      fields.push(cur.trim()); cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCSV(text) {
  // Strip UTF-8 BOM if present
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  const lines = cleaned.split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

async function fetchSavantPitchArsenal(pitcherId, year, vsHand) {
  try {
    // vsHand = batting hand of today's opponent ('L' or 'R') for platoon-split filtering
    const handFilter = vsHand === 'L' || vsHand === 'R' ? `&hand=${vsHand}` : '';
    // Baseball Savant pitch-arsenal-stats leaderboard — per pitch type with hitting stats
    const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?min=0&pitchType=&year=${year}${handFilter}&startInning=1&endInning=9&minPA=1&type=pitcher&stats=pa-percentages,pa-details&groupBy=name&sort=pa&sortDir=desc&playerId=${pitcherId}&csv=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProprStats/1.0)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.includes('<!DOCTYPE')) return null;
    const rows = parseCSV(text);
    if (!rows.length) return null;

    const results = [];
    for (const row of rows) {
      // Filter to only this pitcher's rows
      if (String(row.player_id).trim() !== String(pitcherId).trim()) continue;
      const code = (row.pitch_type || '').trim().toUpperCase();
      if (!code) continue;
      // pitch_name from CSV preferred; fall back to PITCH_NAMES map
      const pitchName = (row.pitch_name || '').trim() || PITCH_NAMES[code] || code;
      const pitches   = parseInt(row.pitches || row.pa) || 0;
      if (pitches < 5) continue;

      results.push({
        code,
        type:      pitchName,
        pitches,
        ba:        parseFloat(row.ba)            || 0,
        woba:      parseFloat(row.woba)          || 0,
        slg:       parseFloat(row.slg)           || 0,
        iso:       (parseFloat(row.slg) - parseFloat(row.ba)) || 0,
        kPct:      parseFloat(row.k_percent)     || 0,
        whiffPct:  parseFloat(row.whiff_percent) || 0,
        usagePct:  parseFloat(row.pitch_usage || row.pitch_percent) || 0,
      });
    }

    if (!results.length) return null;
    // If usagePct not in CSV, derive from pitch counts
    const hasUsage = results.some(r => r.usagePct > 0);
    if (!hasUsage) {
      const totalPitches = results.reduce((s, r) => s + r.pitches, 0);
      results.forEach(r => { r.usagePct = totalPitches > 0 ? (r.pitches / totalPitches) * 100 : 0; });
    }
    return results.sort((a, b) => b.usagePct - a.usagePct);
  } catch {
    return null;
  }
}

async function fetchMLBSeasonStats(pitcherId, year) {
  try {
    const url = `${MLB_API}/people/${pitcherId}/stats?stats=season&group=pitching&season=${year}&sportId=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const stat = data?.stats?.[0]?.splits?.[0]?.stat ?? null;
    if (!stat) return null;
    const ip = parseFloat(stat.inningsPitched) || 0;
    const k  = parseInt(stat.strikeOuts) || 0;
    const pa = parseInt(stat.battersFaced) || (ip > 0 ? Math.round(ip * 4.3) : 0);
    return {
      era:    parseFloat(stat.era)    || null,
      whip:   parseFloat(stat.whip)   || null,
      kPct:   pa > 0 ? (k / pa) : null,
      bbPct:  pa > 0 ? (parseInt(stat.baseOnBalls) / pa) : null,
      k9:     parseFloat(stat.strikeoutsPer9Inn) || null,
      ip,
    };
  } catch {
    return null;
  }
}

async function fetchPlayerInfo(pitcherId) {
  try {
    const url = `${MLB_API}/people/${pitcherId}?hydrate=currentTeam`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.people?.[0];
    if (!p) return null;
    return {
      name:       p.fullName,
      hand:       p.pitchHand?.code ?? null,
      teamAbbrev: p.currentTeam?.abbreviation ?? null,
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${pitcherId}/headshot/67/current`,
    };
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const { pitcherId } = await params;
  const { searchParams } = new URL(request.url);
  const year    = searchParams.get('season') || '2026';
  // 'hand' = batting hand of the opposing batter (for platoon split filtering)
  const vsHand  = searchParams.get('hand') || '';

  if (!pitcherId) {
    return NextResponse.json({ error: 'Missing pitcherId' }, { status: 400 });
  }

  const [savantData, seasonStats, playerInfo] = await Promise.all([
    fetchSavantPitchArsenal(pitcherId, year, vsHand),
    fetchMLBSeasonStats(pitcherId, year),
    fetchPlayerInfo(pitcherId),
  ]);

  // If Savant returns nothing for the current year, try prior year as fallback
  let pitchData = savantData;
  let usingFallbackSeason = false;
  if (!pitchData && year !== '2025') {
    pitchData = await fetchSavantPitchArsenal(pitcherId, '2025', vsHand);
    if (pitchData) usingFallbackSeason = true;
  }

  return NextResponse.json(
    {
      pitcherId: parseInt(pitcherId),
      name:       playerInfo?.name        ?? null,
      hand:       playerInfo?.hand        ?? null,
      teamAbbrev: playerInfo?.teamAbbrev  ?? null,
      headshotUrl: playerInfo?.headshotUrl ?? null,
      era:         seasonStats?.era        ?? null,
      whip:        seasonStats?.whip       ?? null,
      kPct:        seasonStats?.kPct       ?? null,
      bbPct:       seasonStats?.bbPct      ?? null,
      k9:          seasonStats?.k9         ?? null,
      pitchData:   pitchData ?? [],
      hasPitchData: (pitchData?.length ?? 0) > 0,
      usingFallbackSeason,
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
