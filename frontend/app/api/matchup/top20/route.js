// GET /api/matchup/top20?season=2026
// Top 20 batter-pitcher mismatches for today's slate.
// Uses MLB Stats API for schedule, probables, rosters, and platoon splits.
// Savant pitch-type data enriches the top-40 candidates for accurate mismatch scoring.
// Cache: 2 hours

import { NextResponse } from 'next/server';
import { calculateMismatchScore, LEAGUE_AVG_WOBA_BY_PITCH } from '../../../../lib/matchup';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

// ─── Savant CSV helpers ───────────────────────────────────────────────────────
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
    } else { cur += c; }
  }
  fields.push(cur.trim());
  return fields;
}

function parseCSV(text) {
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

// Fetch one full Savant leaderboard and return a map of playerId → pitch rows.
// hand = 'L' | 'R' | '' — for pitchers, 'L' means stats vs LHB, 'R' vs RHB.
async function fetchSavantLeaderboard(type, year, hand = '') {
  try {
    const handParam = hand === 'L' || hand === 'R' ? `&hand=${hand}` : '';
    const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?min=0&pitchType=&year=${year}${handParam}&startInning=1&endInning=9&minPA=1&type=${type}&stats=pa-percentages,pa-details&groupBy=name&sort=pa&sortDir=desc&csv=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProprStats/1.0)' },
      signal: AbortSignal.timeout(20000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return {};
    const text = await res.text();
    if (!text || text.includes('<!DOCTYPE')) return {};
    const rows = parseCSV(text);

    const map = {}; // playerId → pitch[]
    for (const row of rows) {
      const id = String(row.player_id).trim();
      if (!id) continue;
      const pitchName = (row.pitch_name || '').trim();
      if (!pitchName) continue;
      const pitches = parseInt(row.pitches) || 0;
      const minPitches = type === 'pitcher' ? 10 : 5;
      if (pitches < minPitches) continue;

      if (!map[id]) map[id] = [];
      map[id].push({
        type:     pitchName,
        woba:     parseFloat(row.woba)        || 0,
        usagePct: parseFloat(row.pitch_usage) || 0,
      });
    }
    return map;
  } catch { return {}; }
}

function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Abbreviation normalizer (mirrors dashboard)
const ABBREV_MAP = { TB:'TBR', KC:'KCR', SD:'SDP', SF:'SFG', WSH:'WSN', CHW:'CWS', AZ:'ARI' };
function normAbbrev(a) { return a ? (ABBREV_MAP[a] || a) : a; }

// Simplified mismatch score (platoon + pitcher ERA + H2H)
function calcMismatchScore(batterAvg, batterSplitAvg, pitcherERA, h2hAvg, h2hAB) {
  let score = 50;
  if (batterSplitAvg != null && batterAvg != null && batterAvg > 0) {
    const platoonEdge = (batterSplitAvg - batterAvg) / batterAvg;
    score += Math.max(-12, Math.min(12, platoonEdge * 60));
  }
  if (pitcherERA != null) {
    score += Math.max(-10, Math.min(10, (pitcherERA - 4.20) * 3));
  }
  if (h2hAvg != null && h2hAB >= 10 && batterAvg != null && batterAvg > 0) {
    score += Math.max(-6, Math.min(6, ((h2hAvg - batterAvg) / batterAvg) * 20));
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function verdictFromScore(score) {
  if (score >= 65) return 'Batter Edge';
  if (score <= 35) return 'Pitcher Edge';
  return 'Neutral';
}

async function getTodayGames(date) {
  const url = `${MLB_API}/schedule?sportId=1&date=${date}&hydrate=probablePitcher,team,lineups`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error('Schedule fetch failed');
  const data = await res.json();
  return data.dates?.[0]?.games ?? [];
}

async function getTeamRoster(teamId, season) {
  try {
    const url = `${MLB_API}/teams/${teamId}/roster?rosterType=active&season=${season}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.roster ?? [])
      .filter(p => !['P','SP','RP','CP'].includes(p.position?.abbreviation))
      .map(p => ({ id: p.person?.id, name: p.person?.fullName, position: p.position?.abbreviation }));
  } catch { return []; }
}

async function getBatchPlatoonSplits(playerIds, season) {
  if (!playerIds.length) return {};
  try {
    const ids = playerIds.slice(0, 60).join(','); // MLB API limit
    const url = `${MLB_API}/people?personIds=${ids}&hydrate=stats(group=%5Bhitting%5D,type=%5BstatSplits%5D,sitCodes=%5Bvl,vr%5D,season=${season})`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const p of (data.people ?? [])) {
      const stats = p.stats ?? [];
      let splits = [];
      for (const sg of stats) { if (sg.splits?.length) { splits = sg.splits; break; } }
      const vl = splits.find(s => s.split?.code === 'vl')?.stat ?? null;
      const vr = splits.find(s => s.split?.code === 'vr')?.stat ?? null;
      map[p.id] = {
        vsLeft:  vl ? { avg: parseFloat(vl.avg)||null, obp: parseFloat(vl.obp)||null, slg: parseFloat(vl.slg)||null } : null,
        vsRight: vr ? { avg: parseFloat(vr.avg)||null, obp: parseFloat(vr.obp)||null, slg: parseFloat(vr.slg)||null } : null,
        seasonAvg: parseFloat(p.stats?.[0]?.splits?.[0]?.stat?.avg) || null,
      };
    }
    return map;
  } catch { return {}; }
}

async function getBatchSeasonStats(playerIds, season) {
  if (!playerIds.length) return {};
  try {
    const ids = playerIds.slice(0, 60).join(',');
    const url = `${MLB_API}/people?personIds=${ids}&hydrate=stats(group=%5Bhitting%5D,type=%5Bseason%5D,season=${season})`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const p of (data.people ?? [])) {
      const stat = p.stats?.[0]?.splits?.[0]?.stat ?? null;
      if (stat) {
        map[p.id] = {
          avg: parseFloat(stat.avg) || null,
          obp: parseFloat(stat.obp) || null,
          slg: parseFloat(stat.slg) || null,
          name: p.fullName,
          hand: p.batSide?.code ?? null,
          position: p.primaryPosition?.abbreviation ?? null,
          headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`,
        };
      }
    }
    return map;
  } catch { return {}; }
}

async function getPitcherInfo(pitcherId, season) {
  try {
    const url = `${MLB_API}/people/${pitcherId}/stats?stats=season&group=pitching&season=${season}&sportId=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = res.ok ? await res.json() : null;
    const stat = data?.stats?.[0]?.splits?.[0]?.stat ?? null;
    return {
      era:  parseFloat(stat?.era)  || null,
      whip: parseFloat(stat?.whip) || null,
    };
  } catch { return { era: null, whip: null }; }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') || '2026';
  const date   = todayEST();

  try {
    const games = await getTodayGames(date);
    if (!games.length) {
      return NextResponse.json({ matchups: [], date, gamesCount: 0 });
    }

    // Build pitcher map from probable pitchers
    const pitcherMap = {}; // pitcherId → { name, hand, teamId, teamAbbrev, era, whip, gameTime, gameId, oppTeamId, oppAbbrev }
    const gameInfoByPitcher = {};

    for (const game of games) {
      const gameTime = game.gameDate ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET' : null;
      const isLive   = game.status?.abstractGameState === 'Live';
      const homeTeamId = game.teams?.home?.team?.id;
      const awayTeamId = game.teams?.away?.team?.id;
      const homeAbbrev = normAbbrev(game.teams?.home?.team?.abbreviation);
      const awayAbbrev = normAbbrev(game.teams?.away?.team?.abbreviation);

      for (const side of ['home', 'away']) {
        const sp = game.teams?.[side]?.probablePitcher;
        if (!sp?.id) continue;
        const oppSide   = side === 'home' ? 'away' : 'home';
        const oppTeamId = game.teams?.[oppSide]?.team?.id;
        const oppAbbrev = side === 'home' ? awayAbbrev : homeAbbrev;
        pitcherMap[sp.id] = {
          id:         sp.id,
          name:       sp.fullName,
          hand:       sp.pitchHand?.code ?? null,
          teamAbbrev: side === 'home' ? homeAbbrev : awayAbbrev,
          gameTime,
          isLive,
          gameId:     game.gamePk,
          oppTeamId,
          oppAbbrev,
        };
        gameInfoByPitcher[sp.id] = { homeTeamId, awayTeamId, homeAbbrev, awayAbbrev, gameTime, isLive };
      }
    }

    if (!Object.keys(pitcherMap).length) {
      return NextResponse.json({ matchups: [], date, gamesCount: games.length, note: 'No probable pitchers posted yet' });
    }

    // Fetch ERA for all pitchers in parallel
    const pitcherIds = Object.keys(pitcherMap);
    const pitcherStatResults = await Promise.allSettled(
      pitcherIds.map(id => getPitcherInfo(id, season))
    );
    pitcherIds.forEach((id, i) => {
      if (pitcherStatResults[i].status === 'fulfilled') {
        pitcherMap[id] = { ...pitcherMap[id], ...pitcherStatResults[i].value };
      }
    });

    // For each pitcher, get opposing lineup or roster
    const rosterResults = await Promise.allSettled(
      pitcherIds.map(id => {
        const info = pitcherMap[id];
        return info.oppTeamId ? getTeamRoster(info.oppTeamId, season) : Promise.resolve([]);
      })
    );

    // Collect all unique batter IDs
    const allBatterIds = new Set();
    const pitcherBatters = {};
    pitcherIds.forEach((pid, i) => {
      const batters = rosterResults[i].status === 'fulfilled' ? rosterResults[i].value : [];
      pitcherBatters[pid] = batters;
      batters.forEach(b => allBatterIds.add(b.id));
    });

    const batterIdArr = [...allBatterIds].filter(Boolean);

    // Batch fetch stats for all batters
    const [platoonMap, seasonStatsMap] = await Promise.all([
      getBatchPlatoonSplits(batterIdArr, season),
      getBatchSeasonStats(batterIdArr, season),
    ]);

    // Build all matchup pairs and score them
    const pairs = [];
    for (const [pid, pitcher] of Object.entries(pitcherMap)) {
      const batters = pitcherBatters[pid] ?? [];
      for (const batter of batters) {
        if (!batter.id) continue;
        const stats  = seasonStatsMap[batter.id];
        const splits = platoonMap[batter.id];
        if (!stats?.avg) continue;

        const relevantSplit = pitcher.hand === 'L' ? splits?.vsLeft : splits?.vsRight;
        const score = calcMismatchScore(
          stats.avg,
          relevantSplit?.avg ?? null,
          pitcher.era ?? null,
          null, 0 // H2H not fetched for speed; shown in deep dive
        );
        const verdict = verdictFromScore(score);

        pairs.push({
          batterId:    batter.id,
          batterName:  stats.name ?? batter.name,
          batterHand:  stats.hand ?? null,
          batterPos:   stats.position ?? batter.position ?? null,
          batterAVG:   stats.avg,
          splitAVG:    relevantSplit?.avg ?? null,
          headshotUrl: stats.headshotUrl,
          teamAbbrev:  pitcher.oppAbbrev,

          pitcherId:    parseInt(pid),
          pitcherName:  pitcher.name,
          pitcherHand:  pitcher.hand ?? 'R',
          pitcherTeam:  pitcher.teamAbbrev,
          pitcherERA:   pitcher.era ?? null,
          pitcherWHIP:  pitcher.whip ?? null,

          mismatchScore: score,
          verdict,
          topEdgePitch:  '',
          topEdgeValue:  0,

          gameTime: pitcher.gameTime,
          isLive:   pitcher.isLive,
        });
      }
    }

    // ── Savant enrichment: 3 leaderboard calls total (vs 60+ per-player calls) ──
    // pitcher vs LHB, pitcher vs RHB, batter overall (no hand filter)
    const [pitcherVsLMap, pitcherVsRMap, batterMap] = await Promise.all([
      fetchSavantLeaderboard('pitcher', '2025', 'L'),
      fetchSavantLeaderboard('pitcher', '2025', 'R'),
      fetchSavantLeaderboard('batter',  '2025', ''),
    ]);

    // Score every pair using accurate Savant data where available
    for (const pair of pairs) {
      const batterHand = pair.batterHand ?? 'R';
      // Switch hitters: vs RHP they bat left → pitcher stats vs LHB, and vice versa
      // We use pitcher hand stored on each pitcher to determine this
      const pitcherHandForBatter = pitcherMap[String(pair.pitcherId)]?.hand ?? 'R';
      let effectiveBatterHand = batterHand;
      if (batterHand === 'S') effectiveBatterHand = pitcherHandForBatter === 'L' ? 'R' : 'L';

      const pitcherPitches = effectiveBatterHand === 'L'
        ? pitcherVsLMap[String(pair.pitcherId)]
        : pitcherVsRMap[String(pair.pitcherId)];
      const batterPitches = batterMap[String(pair.batterId)];

      if (pitcherPitches?.length && batterPitches?.length) {
        const mismatch = calculateMismatchScore(batterPitches, pitcherPitches);
        pair.mismatchScore = mismatch.score;
        pair.topEdgePitch  = mismatch.topEdgePitch;
        pair.topEdgeValue  = mismatch.topEdgeValue;
        pair.verdict       = mismatch.verdict;
      }
    }

    // Sort by accurate score — take top 20
    const top20 = pairs
      .sort((a, b) => b.mismatchScore - a.mismatchScore)
      .slice(0, 20)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    return NextResponse.json(
      { matchups: top20, date, gamesCount: games.length },
      { headers: { 'Cache-Control': 'public, max-age=7200' } }
    );
  } catch (err) {
    console.error('Top20 route error:', err.message);
    return NextResponse.json({ matchups: [], date, error: err.message }, { status: 500 });
  }
}
