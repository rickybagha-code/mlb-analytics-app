// Next.js API route — proxies PrizePicks from Vercel's IPs (not blocked unlike Render).
// Called by frontend as /api/prizepicks instead of the Render backend.
export const runtime = 'edge'; // Edge runtime for lowest latency

const STAT_MAP = {
  'Pitcher Strikeouts': 'strikeouts',
  'Hitter Strikeouts':  'hitterK',
  'Hits':               'hits',
  'Home Runs':          'hr',
  'Runs':               'runs',
  'RBIs':               'rbi',
  'Stolen Bases':       'sb',
  'Walks':              'walks',
  'Total Bases':        'tb',
  'Singles':            'singles',
  'Doubles':            'doubles',
  'Pitching Outs':      'outs',
  'Hits+Runs+RBIs':     'hrr',
  'Walks Allowed':      'walksAllowed',
  'Earned Runs Allowed':'earnedRuns',
  'Hits Allowed':       'hitsAllowed',
};

export async function GET() {
  try {
    const response = await fetch(
      'https://api.prizepicks.com/projections?league_id=2&per_page=250&single_stat=true',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://app.prizepicks.com',
          'Referer': 'https://app.prizepicks.com/',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
        },
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!response.ok) {
      return Response.json({ error: `PrizePicks returned ${response.status}` }, { status: 502 });
    }

    const data = await response.json();

    const playerMap = {};
    (data.included || []).forEach(item => {
      if (item.type === 'new_player') {
        playerMap[item.id] = item.attributes?.display_name || '';
      }
    });

    const lines = {};
    (data.data || []).forEach(proj => {
      const playerId = proj.relationships?.new_player?.data?.id;
      const name = playerMap[playerId];
      if (!name) return;
      const stat = STAT_MAP[proj.attributes?.stat_type];
      if (!stat) return;
      const line = parseFloat(proj.attributes?.line_score);
      if (isNaN(line)) return;
      if (!lines[name]) lines[name] = {};
      lines[name][stat] = line;
    });

    return Response.json(
      { lines, updated: new Date().toISOString() },
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } }
    );
  } catch (err) {
    return Response.json({ error: 'Failed to fetch PrizePicks', details: err.message }, { status: 500 });
  }
}
