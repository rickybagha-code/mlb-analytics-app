// Next.js API route — fetches PrizePicks projections server-side.
// Uses allorigins.win as fallback if direct fetch is blocked by datacenter IP detection.
export const runtime = 'nodejs';
export const maxDuration = 30;

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

const PP_URL = 'https://api.prizepicks.com/projections?league_id=2&per_page=250&single_stat=true';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://app.prizepicks.com',
  'Referer': 'https://app.prizepicks.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
};

function parseLines(data) {
  const playerMap = {};
  (data.included || []).forEach(item => {
    if (item.type === 'new_player') playerMap[item.id] = item.attributes?.display_name || '';
  });
  const lines = {};
  (data.data || []).forEach(proj => {
    const pid  = proj.relationships?.new_player?.data?.id;
    const name = playerMap[pid];
    if (!name) return;
    const stat = STAT_MAP[proj.attributes?.stat_type];
    if (!stat) return;
    const line = parseFloat(proj.attributes?.line_score);
    if (isNaN(line)) return;
    if (!lines[name]) lines[name] = {};
    lines[name][stat] = line;
  });
  return lines;
}

export async function GET() {
  // ── Attempt 1: direct fetch ───────────────────────────────────────────────
  try {
    const res = await fetch(PP_URL, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const data = await res.json();
      const lines = parseLines(data);
      return Response.json(
        { lines, updated: new Date().toISOString(), source: 'direct' },
        { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } }
      );
    }
  } catch {}

  // ── Attempt 2: via allorigins.win proxy (bypasses datacenter IP blocks) ──
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(PP_URL)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
    if (res.ok) {
      const wrapper = await res.json();
      const data = JSON.parse(wrapper.contents);
      const lines = parseLines(data);
      return Response.json(
        { lines, updated: new Date().toISOString(), source: 'proxy' },
        { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' } }
      );
    }
  } catch {}

  return Response.json({ error: 'PrizePicks unavailable', lines: {} }, { status: 502 });
}
