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
  if (plan === 'pro_annual' || plan === 'pro_monthly') return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
  return 'bg-gray-800/60 border-gray-700 text-gray-400';
}

function AccountContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get('success') === '1';

  const [profile,  setProfile]  = useState(null);
  const [email,    setEmail]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setEmail(user.email ?? '');

      const { data } = await supabase
        .from('profiles')
        .select('plan, subscription_status, current_period_end, stripe_customer_id')
        .eq('id', user.id)
        .single();

      setProfile(data ?? { plan: 'free' });
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  async function handleUpgrade(plan) {
    setActionLoading(true);
    const res  = await fetch('/api/stripe/checkout', {
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
    const res  = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setActionLoading(false);
  }

  const isPro = profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual';

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

      <main className="mx-auto max-w-2xl px-4 sm:px-8 py-12">
        <h1 className="text-2xl font-black text-white mb-8">Your Account</h1>

        {/* Success banner */}
        {justUpgraded && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-400">
              🎉 Welcome to Pro! Your subscription is now active.
            </p>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 rounded-xl bg-gray-900 border border-gray-800 animate-pulse"/>
            ))}
          </div>
        ) : (
          <div className="space-y-4">

            {/* Account info */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Account</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{email}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Signed in</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-gray-500 hover:text-red-400 transition-colors border border-gray-800 hover:border-red-500/30 rounded-lg px-3 py-1.5"
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Plan */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-3">Plan</p>
              <div className="flex items-center justify-between mb-4">
                <span className={`rounded-full border px-3 py-1 text-sm font-bold ${planBadgeCls(profile?.plan)}`}>
                  {planLabel(profile?.plan)}
                </span>
                {isPro && profile?.current_period_end && (
                  <p className="text-xs text-gray-600">
                    Renews {new Date(profile.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>

              {isPro ? (
                <button
                  onClick={handleManage}
                  disabled={actionLoading}
                  className="w-full rounded-xl border border-gray-700 py-2.5 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Loading…' : 'Manage Subscription →'}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 mb-3">
                    Upgrade for unlimited LineCheck, all player deep-dives, and full prop models.
                  </p>
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

            {/* Legal */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-700 pt-2">
              <Link href="/legal/terms"   className="hover:text-gray-400 transition-colors">Terms of Service</Link>
              <Link href="/legal/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
              <a href="mailto:support@proprstats.com" className="hover:text-gray-400 transition-colors">support@proprstats.com</a>
            </div>

          </div>
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
