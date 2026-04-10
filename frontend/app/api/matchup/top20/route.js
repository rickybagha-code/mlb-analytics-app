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
        pitches,
        kPct:     parseFloat(row.k_percent)   || 0,
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

// Simplified mismatch score for dashboard ranking (platoon + ERA/WHIP + OPS + H2H)
// Caps reduced so score cannot reach 100 — max realistic output ~87
function calcMismatchScore(batterAvg, batterSplitAvg, pitcherERA, h2hAvg, h2hAB, batterOPS, pitcherWHIP) {
  let score = 50;
  if (batterSplitAvg != null && batterAvg != null && batterAvg > 0) {
    const platoonEdge = (batterSplitAvg - batterAvg) / batterAvg;
    score += Math.max(-10, Math.min(10, platoonEdge * 50));
  }
  if (pitcherERA != null) {
    score += Math.max(-8, Math.min(8, (pitcherERA - 4.20) * 2.5));
  } else if (pitcherWHIP != null) {
    score += Math.max(-7, Math.min(7, (1.25 - pitcherWHIP) * 28));
  }
  if (batterOPS != null && batterOPS > 0) {
    score += Math.max(-8, Math.min(12, (batterOPS - 0.710) / 0.100 * 4.5));
  }
  if (h2hAvg != null && h2hAB >= 10 && batterAvg != null && batterAvg > 0) {
    score += Math.max(-5, Math.min(5, ((h2hAvg - batterAvg) / batterAvg) * 18));
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
    // Chunk into 60s and merge
    const chunks = [];
    for (let i = 0; i < playerIds.length; i += 60) chunks.push(playerIds.slice(i, i + 60));
    const allPeople = (await Promise.all(chunks.map(async chunk => {
      const ids = chunk.join(',');
      const url = `${MLB_API}/people?personIds=${ids}&hydrate=stats(group=%5Bhitting%5D,type=%5BstatSplits%5D,sitCodes=%5Bvl,vr%5D,season=${season})`;
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.people ?? [];
    }))).flat();
    const map = {};
    for (const p of allPeople) {
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

async function fetchStatsBatch(ids, season) {
  const url = `${MLB_API}/people?personIds=${ids.join(',')}&hydrate=stats(group=%5Bhitting%5D,type=%5Bseason%5D,season=${season})`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json();
  return data.people ?? [];
}

async function getBatchSeasonStats(playerIds, season) {
  if (!playerIds.length) return {};
  try {
    // Chunk into groups of 60 (MLB API limit) and fetch all in parallel
    const chunks = [];
    for (let i = 0; i < playerIds.length; i += 60) chunks.push(playerIds.slice(i, i + 60));
    const results = await Promise.all(chunks.map(chunk => fetchStatsBatch(chunk, season)));
    const people  = results.flat();

    // Also fetch 2025 fallback for anyone missing current-season stats
    const map = {};
    const missingIds = [];
    for (const p of people) {
      const stat = p.stats?.[0]?.splits?.[0]?.stat ?? null;
      if (stat && (parseFloat(stat.avg) || 0) > 0) {
        const k  = parseInt(stat.strikeOuts)       || 0;
        const pa = parseInt(stat.plateAppearances) || parseInt(stat.atBats) || 0;
        map[p.id] = {
          avg:  parseFloat(stat.avg) || null,
          obp:  parseFloat(stat.obp) || null,
          slg:  parseFloat(stat.slg) || null,
          kPct: pa > 0 ? k / pa : null,
          name: p.fullName,
          hand: p.batSide?.code ?? null,
          position: p.primaryPosition?.abbreviation ?? null,
          headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current`,
        };
      } else {
        missingIds.push(p.id);
        // Store name/hand/position even without stats so fallback can reuse
        map[p.id] = { avg: null, kPct: null, name: p.fullName, hand: p.batSide?.code ?? null, position: p.primaryPosition?.abbreviation ?? null,
          headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${p.id}/headshot/67/current` };
      }
    }

    // Fallback: fetch 2025 stats for players with no current-season data
    if (missingIds.length && season !== '2025') {
      const fbChunks = [];
      for (let i = 0; i < missingIds.length; i += 60) fbChunks.push(missingIds.slice(i, i + 60));
      const fbResults = await Promise.all(fbChunks.map(chunk => fetchStatsBatch(chunk, '2025')));
      for (const p of fbResults.flat()) {
        const stat = p.stats?.[0]?.splits?.[0]?.stat ?? null;
        if (stat && (parseFloat(stat.avg) || 0) > 0 && map[p.id]) {
          const k  = parseInt(stat.strikeOuts)       || 0;
          const pa = parseInt(stat.plateAppearances) || parseInt(stat.atBats) || 0;
          map[p.id] = { ...map[p.id], avg: parseFloat(stat.avg) || null, obp: parseFloat(stat.obp) || null, slg: parseFloat(stat.slg) || null, kPct: pa > 0 ? k / pa : null };
        }
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
  const season     = searchParams.get('season')   || '2026';
  const pitcherFilter = searchParams.get('pitcherId') ? parseInt(searchParams.get('pitcherId')) : null;
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
        const batterOPS = (stats.obp != null && stats.slg != null) ? stats.obp + stats.slg : null;
        const score = calcMismatchScore(
          stats.avg,
          relevantSplit?.avg ?? null,
          pitcher.era ?? null,
          null, 0, // H2H not fetched for speed; shown in deep dive
          batterOPS,
          pitcher.whip ?? null
        );
        const verdict = verdictFromScore(score);

        pairs.push({
          batterId:    batter.id,
          batterName:  stats.name ?? batter.name,
          batterHand:  stats.hand ?? null,
          batterPos:   stats.position ?? batter.position ?? null,
          batterAVG:   stats.avg,
          batterKPct:  stats.kPct ?? null,
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

    // When pitcher filter is active, patch in any roster batters that were excluded
    // from pairs (e.g. no 2026/2025 stats yet). Done before Savant enrichment so
    // patched batters also get Savant scores when available.
    if (pitcherFilter) {
      const pairedBatterIds = new Set(
        pairs.filter(p => p.pitcherId === pitcherFilter).map(p => p.batterId)
      );
      const pitcher = pitcherMap[String(pitcherFilter)];
      if (pitcher) {
        const missingBatters = (pitcherBatters[String(pitcherFilter)] ?? [])
          .filter(b => b.id && !pairedBatterIds.has(b.id));
        for (const batter of missingBatters) {
          const stats = seasonStatsMap[batter.id];
          const defaultScore = calcMismatchScore(null, null, pitcher.era ?? null, null, 0, null, pitcher.whip ?? null);
          pairs.push({
            batterId:    batter.id,
            batterName:  stats?.name ?? batter.name,
            batterHand:  stats?.hand ?? null,
            batterPos:   stats?.position ?? batter.position ?? null,
            batterAVG:   null,
            splitAVG:    null,
            headshotUrl: stats?.headshotUrl ?? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${batter.id}/headshot/67/current`,
            teamAbbrev:  pitcher.oppAbbrev,
            pitcherId:    pitcherFilter,
            pitcherName:  pitcher.name,
            pitcherHand:  pitcher.hand ?? 'R',
            pitcherTeam:  pitcher.teamAbbrev,
            pitcherERA:   pitcher.era ?? null,
            pitcherWHIP:  pitcher.whip ?? null,
            mismatchScore: defaultScore,
            verdict:       verdictFromScore(defaultScore),
            topEdgePitch:  '',
            topEdgeValue:  0,
            gameTime: pitcher.gameTime,
            isLive:   pitcher.isLive,
          });
        }
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
        // Pass platoon + ERA context so dashboard score matches player card matrix
        // H2H omitted here for speed (not batch-fetched); shown in deep dive
        const context = {
          splitAVG:    pair.splitAVG   ?? null,
          seasonAVG:   pair.batterAVG  ?? null,
          pitcherERA:  pair.pitcherERA ?? null,
          pitcherWHIP: pair.pitcherWHIP ?? null,
          h2hAvg: null,
          h2hAB:  0,
        };
        const mismatch = calculateMismatchScore(batterPitches, pitcherPitches, context);
        pair.mismatchScore = mismatch.score;
        pair.topEdgePitch  = mismatch.topEdgePitch;
        pair.topEdgeValue  = mismatch.topEdgeValue;
        pair.verdict       = mismatch.verdict;
        // K% penalty removed — now handled per-pitch inside calculateMismatchScore
      }
    }

    // Sort by score — return all for a specific pitcher, else top 20
    const sorted = pairs.sort((a, b) => b.mismatchScore - a.mismatchScore);
    const filtered = pitcherFilter
      ? sorted.filter(p => p.pitcherId === pitcherFilter)
      : sorted.slice(0, 20);
    const matchups = filtered.map((p, i) => ({ ...p, rank: i + 1 }));

    return NextResponse.json({ matchups, date, gamesCount: games.length });
  } catch (err) {
    console.error('Top20 route error:', err.message);
    return NextResponse.json({ matchups: [], date, error: err.message }, { status: 500 });
  }
}
