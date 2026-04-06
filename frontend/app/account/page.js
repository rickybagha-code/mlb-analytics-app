'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';
import { createClient } from '../../lib/supabase/client';

function planLabel(plan) {
  if (plan === 'pro_annual')  return 'Pro Annual';
  if (plan === 'pro_monthly') return 'Pro Monthly';
  return 'Free';
}

function planBadgeCls(plan) {
  if (plan === 'pro_annual' || plan === 'pro_monthly')
    return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
  return 'bg-gray-800/60 border-gray-700 text-gray-400';
}

function SectionHeader({ label }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-4">{label}</p>
  );
}

function AccountContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get('success') === '1';

  const [profile,      setProfile]      = useState(null);
  const [user,         setUser]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab,    setActiveTab]    = useState('subscription');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);

      const { data } = await supabase
        .from('profiles')
        .select('plan, subscription_status, current_period_end, stripe_customer_id, created_at')
        .eq('id', u.id)
        .single();

      setProfile(data ?? { plan: 'free' });
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }

  async function handleUpgrade(plan) {
    setActionLoading(true);
    const res = await fetch('/api/stripe/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setActionLoading(false);
  }

  async function handleManage() {
    setActionLoading(true);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setActionLoading(false);
  }

  const isPro = profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual';

  const tabs = [
    { id: 'subscription', label: 'Subscription' },
    { id: 'account',      label: 'Account' },
    { id: 'settings',     label: 'Settings' },
  ];

  return (
    <div className="bg-gray-950 min-h-screen text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-gray-950/80 backdrop-blur-xl px-4 sm:px-8 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link href="/dashboard">
            <ProprStatsLogo variant="light" size={28} />
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 sm:px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-lg">
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">{user?.email}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${planBadgeCls(profile?.plan)}`}>
                {planLabel(profile?.plan)}
              </span>
              {profile?.created_at && (
                <span className="text-xs text-gray-600">
                  Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Success banner */}
        {justUpgraded && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-400">
              Welcome to Pro! Your subscription is now active.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                activeTab === t.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-gray-900 border border-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Subscription tab ── */}
            {activeTab === 'subscription' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <SectionHeader label="Current Plan" />

                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-lg font-black text-white">{planLabel(profile?.plan)}</p>
                      {isPro && profile?.current_period_end && (
                        <p className="text-xs text-gray-500 mt-1">
                          {profile.subscription_status === 'canceled' ? 'Access until' : 'Renews'}{' '}
                          {new Date(profile.current_period_end).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-sm font-bold ${planBadgeCls(profile?.plan)}`}>
                      {planLabel(profile?.plan)}
                    </span>
                  </div>

                  {/* Feature list */}
                  <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-4 mb-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">
                      {isPro ? 'Your Pro features' : 'Free features'}
                    </p>
                    <ul className="space-y-2 text-sm text-gray-400">
                      {isPro ? (
                        <>
                          <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Unlimited LineCheck</li>
                          <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> All player deep-dives</li>
                          <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Full prop EV models</li>
                          <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Live book lines via Odds API</li>
                          <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Matchup analyzer</li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-center gap-2"><span className="text-blue-400">✓</span> Dashboard player board</li>
                          <li className="flex items-center gap-2"><span className="text-blue-400">✓</span> Basic matchup view</li>
                          <li className="flex items-center gap-2"><span className="text-gray-600">✗</span> <span className="text-gray-600">LineCheck (Pro)</span></li>
                          <li className="flex items-center gap-2"><span className="text-gray-600">✗</span> <span className="text-gray-600">Player deep-dives (Pro)</span></li>
                          <li className="flex items-center gap-2"><span className="text-gray-600">✗</span> <span className="text-gray-600">Full prop EV models (Pro)</span></li>
                        </>
                      )}
                    </ul>
                  </div>

                  {isPro ? (
                    profile?.stripe_customer_id ? (
                    <button
                      onClick={handleManage}
                      disabled={actionLoading}
                      className="w-full rounded-xl border border-gray-700 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-all disabled:opacity-50"
                    >
                      {actionLoading ? 'Loading…' : 'Manage Subscription →'}
                    </button>
                    ) : (
                      <p className="text-xs text-gray-600">Contact support@proprstats.com to manage your subscription.</p>
                    )
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => handleUpgrade('monthly')}
                        disabled={actionLoading}
                        className="w-full rounded-xl border border-gray-700 py-2.5 text-sm font-semibold text-gray-300 hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
                      >
                        {actionLoading ? 'Loading…' : 'Upgrade to Pro — $18.99/mo'}
                      </button>
                      <button
                        onClick={() => handleUpgrade('yearly')}
                        disabled={actionLoading}
                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                      >
                        {actionLoading ? 'Loading…' : 'Upgrade to Pro Annual — $189.99/yr (save $37)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Account tab ── */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <SectionHeader label="Profile" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-800">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Email</span>
                      <span className="text-sm text-white">{user?.email}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-800">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">User ID</span>
                      <span className="text-xs text-gray-600 font-mono">{user?.id?.slice(0, 16)}…</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Member Since</span>
                      <span className="text-sm text-gray-400">
                        {profile?.created_at
                          ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <SectionHeader label="Security" />
                  <p className="text-xs text-gray-600 mb-4">
                    To change your password, sign out and use the "Forgot password" link on the login page.
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-xl border border-gray-800 hover:border-red-500/30 py-2.5 text-sm font-semibold text-gray-400 hover:text-red-400 transition-all"
                  >
                    Sign Out
                  </button>
                </div>

                <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-5">
                  <SectionHeader label="Danger Zone" />
                  <p className="text-xs text-gray-600 mb-4">
                    To permanently delete your account and data, email{' '}
                    <a href="mailto:support@proprstats.com" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
                      support@proprstats.com
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* ── Settings tab ── */}
            {activeTab === 'settings' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <SectionHeader label="Preferences" />
                  <p className="text-xs text-gray-600">
                    Display and notification preferences coming soon.
                  </p>
                </div>

                <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <SectionHeader label="Support" />
                  <div className="space-y-3 text-sm">
                    <a
                      href="mailto:support@proprstats.com"
                      className="flex items-center justify-between py-2 border-b border-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                      <span>Contact Support</span>
                      <span className="text-gray-600">support@proprstats.com →</span>
                    </a>
                    <Link
                      href="/legal/terms"
                      className="flex items-center justify-between py-2 border-b border-gray-800 text-gray-400 hover:text-white transition-colors"
                    >
                      <span>Terms of Service</span>
                      <span className="text-gray-600">→</span>
                    </Link>
                    <Link
                      href="/legal/privacy"
                      className="flex items-center justify-between py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <span>Privacy Policy</span>
                      <span className="text-gray-600">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}
