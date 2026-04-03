// GET /api/matchup/batters-today
// Returns today's batters paired with their probable opposing pitcher.
// Primary: uses lineup data when available (posted ~1-2h before game time).
// Fallback: uses active roster batters (always available once probables posted).
// Cache: 30 minutes

import { NextResponse } from 'next/server';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

const ABBREV_MAP = { TB:'TBR', KC:'KCR', SD:'SDP', SF:'SFG', WSH:'WSN', CHW:'CWS', AZ:'ARI' };
function normAbbrev(a) { return a ? (ABBREV_MAP[a] || a) : a; }

function todayEST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function headshotUrl(id) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${id}/headshot/67/current`;
}

async function getTeamRosterBatters(teamId, season) {
  try {
    const url = `${MLB_API}/teams/${teamId}/roster?rosterType=active&season=${season}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.roster ?? [])
      .filter(p => !['P', 'SP', 'RP', 'CP'].includes(p.position?.abbreviation))
      .map(p => ({
        id: p.person?.id,
        name: p.person?.fullName,
        hand: null, // not in roster endpoint
        position: p.position?.abbreviation,
        headshotUrl: headshotUrl(p.person?.id),
      }));
  } catch { return []; }
}

export async function GET() {
  const date   = todayEST();
  const season = new Date().getFullYear().toString();

  try {
    const schedRes = await fetch(
      `${MLB_API}/schedule?sportId=1&date=${date}&hydrate=lineups,probablePitcher,team`,
      { next: { revalidate: 1800 } }
    );
    if (!schedRes.ok) {
      return NextResponse.json({ batters: [], pitchers: [] }, { status: 200 });
    }

    const schedData = await schedRes.json();
    const games = schedData.dates?.[0]?.games ?? [];

    const batters  = [];
    const pitchers = [];
    const seenPitcherIds = new Set();
    let hasLineups = false;
    // Track pitcher entries that need a roster fallback (no lineup for their opponent)
    const rosterFallbackNeeded = [];

    for (const game of games) {
      const awayLineup = game.lineups?.awayPlayers ?? [];
      const homeLineup = game.lineups?.homePlayers ?? [];
      const awayPitcher = game.teams?.away?.probablePitcher;
      const homePitcher = game.teams?.home?.probablePitcher;
      const awayAbbrev  = normAbbrev(game.teams?.away?.team?.abbreviation);
      const homeAbbrev  = normAbbrev(game.teams?.home?.team?.abbreviation);
      const awayTeamId  = game.teams?.away?.team?.id;
      const homeTeamId  = game.teams?.home?.team?.id;
      const gameTime    = game.gameDate
        ? new Date(game.gameDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET'
        : null;

      if (awayLineup.length || homeLineup.length) hasLineups = true;

      // Collect probable pitchers (deduplicated)
      if (homePitcher?.id && !seenPitcherIds.has(homePitcher.id)) {
        seenPitcherIds.add(homePitcher.id);
        pitchers.push({
          id:         homePitcher.id,
          name:       homePitcher.fullName,
          hand:       homePitcher.pitchHand?.code ?? 'R',
          teamAbbrev: homeAbbrev,
          teamId:     homeTeamId,
          oppAbbrev:  awayAbbrev,
          oppTeamId:  awayTeamId,
          headshotUrl: headshotUrl(homePitcher.id),
          gameTime,
        });
      }
      if (awayPitcher?.id && !seenPitcherIds.has(awayPitcher.id)) {
        seenPitcherIds.add(awayPitcher.id);
        pitchers.push({
          id:         awayPitcher.id,
          name:       awayPitcher.fullName,
          hand:       awayPitcher.pitchHand?.code ?? 'R',
          teamAbbrev: awayAbbrev,
          teamId:     awayTeamId,
          oppAbbrev:  homeAbbrev,
          oppTeamId:  homeTeamId,
          headshotUrl: headshotUrl(awayPitcher.id),
          gameTime,
        });
      }

      // Away batters face home pitcher
      if (homePitcher?.id) {
        if (awayLineup.length) {
          for (const p of awayLineup) {
            if (!p.id) continue;
            batters.push({
              id:   p.id,
              name: p.fullName,
              hand: p.batSide?.code ?? null,
              team: awayAbbrev,
              teamId: awayTeamId,
              headshotUrl: headshotUrl(p.id),
              probablePitcherId:    homePitcher.id,
              probablePitcherName:  homePitcher.fullName,
              probablePitcherHand:  homePitcher.pitchHand?.code ?? 'R',
              probablePitcherTeam:  homeAbbrev,
              gameTime,
              fromLineup: true,
            });
          }
        } else {
          // No lineup yet — queue a roster fallback for the away team
          rosterFallbackNeeded.push({
            pitcherId:    homePitcher.id,
            pitcherName:  homePitcher.fullName,
            pitcherHand:  homePitcher.pitchHand?.code ?? 'R',
            pitcherTeam:  homeAbbrev,
            oppTeamId:    awayTeamId,
            oppAbbrev:    awayAbbrev,
            gameTime,
          });
        }
      }

      // Home batters face away pitcher
      if (awayPitcher?.id) {
        if (homeLineup.length) {
          for (const p of homeLineup) {
            if (!p.id) continue;
            batters.push({
              id:   p.id,
              name: p.fullName,
              hand: p.batSide?.code ?? null,
              team: homeAbbrev,
              teamId: homeTeamId,
              headshotUrl: headshotUrl(p.id),
              probablePitcherId:    awayPitcher.id,
              probablePitcherName:  awayPitcher.fullName,
              probablePitcherHand:  awayPitcher.pitchHand?.code ?? 'R',
              probablePitcherTeam:  awayAbbrev,
              gameTime,
              fromLineup: true,
            });
          }
        } else {
          // No lineup yet — queue a roster fallback for the home team
          rosterFallbackNeeded.push({
            pitcherId:    awayPitcher.id,
            pitcherName:  awayPitcher.fullName,
            pitcherHand:  awayPitcher.pitchHand?.code ?? 'R',
            pitcherTeam:  awayAbbrev,
            oppTeamId:    homeTeamId,
            oppAbbrev:    homeAbbrev,
            gameTime,
          });
        }
      }
    }

    // Per-game roster fallback: for any game without lineup data, fetch active roster
    if (rosterFallbackNeeded.length > 0) {
      const rosterFetches = rosterFallbackNeeded.map(async (entry) => {
        const rosterBatters = await getTeamRosterBatters(entry.oppTeamId, season);
        return rosterBatters.map(b => ({
          ...b,
          team:                 entry.oppAbbrev,
          teamId:               entry.oppTeamId,
          probablePitcherId:    entry.pitcherId,
          probablePitcherName:  entry.pitcherName,
          probablePitcherHand:  entry.pitcherHand,
          probablePitcherTeam:  entry.pitcherTeam,
          gameTime:             entry.gameTime,
          fromLineup:           false,
        }));
      });

      const rosterResults = await Promise.allSettled(rosterFetches);
      for (const result of rosterResults) {
        if (result.status === 'fulfilled') {
          batters.push(...result.value);
        }
      }
    }

    // Deduplicate batters (same player can appear if lineup loaded AND roster fetched)
    const seen = new Set();
    const dedupedBatters = batters.filter(b => {
      const key = `${b.id}-${b.probablePitcherId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(
      { batters: dedupedBatters, pitchers, hasLineups, date },
      { headers: { 'Cache-Control': 'public, max-age=1800' } }
    );
  } catch (err) {
    console.error('batters-today error:', err.message);
    return NextResponse.json({ batters: [], pitchers: [], error: err.message });
  }
}
