const { supabase } = require('./supabase');

const TTL_MS = {
  player: 24 * 60 * 60 * 1000,  // 24h — season stats change slowly
  gameLog: 4 * 60 * 60 * 1000,  // 4h — updates after each game
};

async function getCachedPlayer(playerId, season, statType) {
  try {
    const { data } = await supabase
      .from('player_cache')
      .select('data, cached_at')
      .eq('player_id', String(playerId))
      .eq('season', String(season))
      .eq('stat_type', statType)
      .single();

    if (!data) return null;
    if (Date.now() - new Date(data.cached_at).getTime() > TTL_MS.player) return null;
    return data.data;
  } catch {
    return null;
  }
}

async function setCachedPlayer(playerId, season, statType, payload) {
  try {
    await supabase
      .from('player_cache')
      .upsert(
        { player_id: String(playerId), season: String(season), stat_type: statType, data: payload, cached_at: new Date().toISOString() },
        { onConflict: 'player_id,season,stat_type' }
      );
  } catch {
    // non-fatal: cache write failure doesn't break the route
  }
}

async function getCachedGameLog(playerId, season) {
  try {
    const { data } = await supabase
      .from('game_log_cache')
      .select('data, cached_at')
      .eq('player_id', String(playerId))
      .eq('season', String(season))
      .single();

    if (!data) return null;
    if (Date.now() - new Date(data.cached_at).getTime() > TTL_MS.gameLog) return null;
    return data.data;
  } catch {
    return null;
  }
}

async function setCachedGameLog(playerId, season, payload) {
  try {
    await supabase
      .from('game_log_cache')
      .upsert(
        { player_id: String(playerId), season: String(season), data: payload, cached_at: new Date().toISOString() },
        { onConflict: 'player_id,season' }
      );
  } catch {
    // non-fatal
  }
}

async function saveMatchupResult({ batterId, pitcherId, batterName, pitcherName, season, stadium, score, recommendation, fullResult }) {
  try {
    await supabase
      .from('matchup_results')
      .insert({
        batter_id: String(batterId),
        pitcher_id: String(pitcherId),
        batter_name: batterName,
        pitcher_name: pitcherName,
        season: String(season),
        stadium,
        score,
        recommendation,
        full_result: fullResult,
      });
  } catch {
    // non-fatal
  }
}

module.exports = { getCachedPlayer, setCachedPlayer, getCachedGameLog, setCachedGameLog, saveMatchupResult };
