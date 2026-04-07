// GET /api/matchup/batter/[batterId]?season=2026&pitcherHand=R
// Batter stats vs each pitch type from Baseball Savant + MLB Stats API.
// pitcherHand param enforces correct platoon split.
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

async function fetchSavantBatterVsPitch(batterId, year) {
  try {
    // Full season stats vs ALL pitchers — no hand filter so sample sizes are meaningful
    const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?min=0&pitchType=&year=${year}&startInning=1&endInning=9&minPA=1&type=batter&stats=pa-percentages,pa-details&groupBy=name&sort=pa&sortDir=desc&playerId=${batterId}&csv=true`;
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
      // Filter to only this batter's rows
      if (String(row.player_id).trim() !== String(batterId).trim()) continue;
      const code = (row.pitch_type || '').trim().toUpperCase();
      if (!code) continue;
      const pitchName = (row.pitch_name || '').trim() || PITCH_NAMES[code] || code;
      const pitches   = parseInt(row.pitches || row.pa) || 0;
      if (pitches < 5) continue;

      results.push({
        code,
        type:     pitchName,
        pitches,
        usagePct: parseFloat(row.pitch_usage || row.pitch_percent) || 0,
        ba:       parseFloat(row.ba)              || 0,
        woba:     parseFloat(row.woba)            || 0,
        slg:      parseFloat(row.slg)             || 0,
        iso:      (parseFloat(row.slg) - parseFloat(row.ba)) || 0,
        kPct:     parseFloat(row.k_percent)       || 0,
        whiffPct: parseFloat(row.whiff_percent)   || 0,
      });
    }

    if (!results.length) return null;
    // If usagePct not in CSV, derive from pitch counts
    const hasUsage = results.some(r => r.usagePct > 0);
    if (!hasUsage) {
      const total = results.reduce((s, r) => s + r.pitches, 0);
      results.forEach(r => { r.usagePct = total > 0 ? (r.pitches / total) * 100 : 0; });
    }

    return results;
  } catch {
    return null;
  }
}

async function fetchMLBBatterStats(batterId, year) {
  try {
    const [s26, s25] = await Promise.all([
      fetch(`${MLB_API}/people/${batterId}/stats?stats=season&group=hitting&season=${year}&sportId=1`, { next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : null),
      year === '2026'
        ? fetch(`${MLB_API}/people/${batterId}/stats?stats=season&group=hitting&season=2025&sportId=1`, { next: { revalidate: 86400 } }).then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
    ]);
    const st26 = s26?.stats?.[0]?.splits?.[0]?.stat ?? null;
    const st25 = s25?.stats?.[0]?.splits?.[0]?.stat ?? null;
    return { st26, st25 };
  } catch {
    return { st26: null, st25: null };
  }
}

async function fetchPlatoonSplits(batterId, year) {
  try {
    const url = `${MLB_API}/people/${batterId}/stats?stats=statSplits&group=hitting&season=${year}&sportId=1&sitCodes=vl,vr`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const splits = data?.stats?.[0]?.splits ?? [];
    const vsLeft  = splits.find(s => s.split?.code === 'vl')?.stat ?? null;
    const vsRight = splits.find(s => s.split?.code === 'vr')?.stat ?? null;
    return {
      vsLeft:  vsLeft  ? { avg: parseFloat(vsLeft.avg)||null,  obp: parseFloat(vsLeft.obp)||null,  slg: parseFloat(vsLeft.slg)||null  } : null,
      vsRight: vsRight ? { avg: parseFloat(vsRight.avg)||null, obp: parseFloat(vsRight.obp)||null, slg: parseFloat(vsRight.slg)||null } : null,
    };
  } catch {
    return null;
  }
}

async function fetchPlayerInfo(batterId) {
  try {
    const url = `${MLB_API}/people/${batterId}?hydrate=currentTeam`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.people?.[0];
    if (!p) return null;
    return {
      name:        p.fullName,
      hand:        p.batSide?.code ?? null,
      position:    p.primaryPosition?.abbreviation ?? null,
      teamAbbrev:  p.currentTeam?.abbreviation ?? null,
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${batterId}/headshot/67/current`,
    };
  } catch {
    return null;
  }
}

export async function GET(request, { params }) {
  const { batterId } = await params;
  const { searchParams } = new URL(request.url);
  const year        = searchParams.get('season')      || '2026';
  const pitcherHand = searchParams.get('pitcherHand') || '';

  if (!batterId || !/^\d+$/.test(String(batterId))) {
    return NextResponse.json({ error: 'Invalid batterId' }, { status: 400 });
  }

  const [savantData, mlbStats, platoon, playerInfo] = await Promise.all([
    fetchSavantBatterVsPitch(batterId, year),
    fetchMLBBatterStats(batterId, year),
    fetchPlatoonSplits(batterId, year),
    fetchPlayerInfo(batterId),
  ]);

  // Fallback to 2025 Savant if 2026 unavailable
  let pitchData = savantData;
  let usingFallbackSeason = false;
  if (!pitchData && year !== '2025') {
    pitchData = await fetchSavantBatterVsPitch(batterId, '2025');
    if (pitchData) usingFallbackSeason = true;
  }

  // Get relevant platoon split based on pitcher hand
  const relevantSplit = pitcherHand === 'L' ? platoon?.vsLeft : platoon?.vsRight;

  return NextResponse.json(
    {
      batterId:    parseInt(batterId),
      name:        playerInfo?.name        ?? null,
      hand:        playerInfo?.hand        ?? null,
      position:    playerInfo?.position    ?? null,
      teamAbbrev:  playerInfo?.teamAbbrev  ?? null,
      headshotUrl: playerInfo?.headshotUrl ?? null,
      seasonStat:  mlbStats.st26,
      prevStat:    mlbStats.st25,
      platoon:     platoon ?? null,
      splitAVG:    relevantSplit?.avg ?? null,
      splitOBP:    relevantSplit?.obp ?? null,
      splitSLG:    relevantSplit?.slg ?? null,
      pitchData:   pitchData ?? [],
      hasPitchData: (pitchData?.length ?? 0) > 0,
      usingFallbackSeason,
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
