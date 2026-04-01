// Fetches pp-lines from the GitHub raw URL — always reflects the latest GH Actions commit,
// no Vercel redeploy needed. Falls back to the bundled static file on error.
// In-memory cache for 10 min to avoid hammering GitHub on every page load.

export const runtime = 'nodejs';

const RAW_URL =
  'https://raw.githubusercontent.com/rickybagha-code/mlb-analytics-app/main/frontend/public/pp-lines.json';

let _cache    = null;
let _cacheTs  = 0;
const TTL_MS  = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  const now = Date.now();

  if (_cache && now - _cacheTs < TTL_MS) {
    return new Response(JSON.stringify(_cache), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
    });
  }

  try {
    const r = await fetch(RAW_URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`GitHub raw returned ${r.status}`);
    const data = await r.json();
    _cache   = data;
    _cacheTs = now;
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
    });
  } catch {
    // Fall back to bundled static file
    try {
      const { readFileSync } = await import('fs');
      const { join }         = await import('path');
      const raw = readFileSync(join(process.cwd(), 'public', 'pp-lines.json'), 'utf8');
      return new Response(raw, {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, s-maxage=300' },
      });
    } catch {
      return Response.json({ error: 'PP cache not available', lines: {} }, { status: 503 });
    }
  }
}
