import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Per-IP, per-route-group. Suitable for single-instance Railway deployment.
// State persists in-process; resets on server restart.
const _rlStore = new Map(); // `${ip}:${group}` → { count, windowStart }

function checkRateLimit(ip, group, max, windowMs) {
  const key = `${ip}:${group}`;
  const now = Date.now();
  const entry = _rlStore.get(key);
  if (!entry || now - entry.windowStart >= windowMs) {
    _rlStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Purge entries older than 5 minutes every 5 minutes to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, entry] of _rlStore.entries()) {
    if (entry.windowStart < cutoff) _rlStore.delete(key);
  }
}, 5 * 60 * 1000);

function rateLimitResponse() {
  return new NextResponse(
    JSON.stringify({ error: 'Too many requests, please try again in a minute.' }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Rate limiting on /api/* routes ─────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    let allowed = true;
    if (pathname.startsWith('/api/stripe/')) {
      // Stripe checkout/portal — very tight: 10 req/min
      allowed = checkRateLimit(ip, 'stripe', 10, 60_000);
    } else if (pathname.startsWith('/api/auth/')) {
      // Auth endpoints (sign in, sign out, reset) — 20 req/min
      allowed = checkRateLimit(ip, 'auth', 20, 60_000);
    } else {
      // All other API routes (matchup, player data, etc.) — 60 req/min
      allowed = checkRateLimit(ip, 'api', 60, 60_000);
    }

    if (!allowed) return rateLimitResponse();
  }

  // ── Supabase session + page auth ───────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must call getUser() not getSession() per Supabase SSR docs
  const { data: { user } } = await supabase.auth.getUser();

  // Protect /dashboard and /account — redirect to login if not authenticated
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/account'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // If logged-in user hits login/signup, send to dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*', '/login', '/signup', '/api/:path*'],
};
