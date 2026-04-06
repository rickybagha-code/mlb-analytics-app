'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../lib/supabase/client';

function planLabel(plan) {
  if (plan === 'pro_annual')  return 'Pro Annual';
  if (plan === 'pro_monthly') return 'Pro Monthly';
  return 'Free';
}

function planBadgeCls(plan) {
  if (plan === 'pro_annual' || plan === 'pro_monthly')
    return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
  return 'bg-gray-800 border-gray-700 text-gray-500';
}

export default function NavUserMenu() {
  const router  = useRouter();
  const menuRef = useRef(null);

  const [open,          setOpen]          = useState(false);
  const [user,          setUser]          = useState(null);
  const [profile,       setProfile]       = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      setUser(u);
      const { data } = await supabase
        .from('profiles')
        .select('plan, current_period_end')
        .eq('id', u.id)
        .single();
      setProfile(data ?? { plan: 'free' });
    }
    load();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Reset spinner when user navigates back (bfcache restores actionLoading=true)
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) setActionLoading(false);
    }
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  async function handleUpgrade(plan) {
    setActionLoading(true);
    setOpen(false);
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
    setOpen(false);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url } = await res.json();
    if (url) window.location.href = url;
    else setActionLoading(false);
  }

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/';
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="text-sm text-gray-500 hover:text-white transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const isPro    = profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual';
  const initials = user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm font-bold hover:bg-blue-600/30 hover:border-blue-500/50 transition-all"
      >
        {actionLoading ? (
          <span className="w-3.5 h-3.5 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
        ) : initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-72 rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/50 z-50 overflow-hidden">

          {/* User info */}
          <div className="px-4 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white font-semibold truncate">{user.email}</p>
                <span className={`inline-flex mt-1 rounded-full border px-2 py-0.5 text-xs font-bold ${planBadgeCls(profile?.plan)}`}>
                  {planLabel(profile?.plan)}
                </span>
              </div>
            </div>
            {isPro && profile?.current_period_end && (
              <p className="text-xs text-gray-600 mt-2 pl-12">
                Renews {new Date(profile.current_period_end).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Upgrade / Manage */}
          <div className="px-4 py-3 border-b border-gray-800">
            {isPro ? (
              <button
                onClick={handleManage}
                className="w-full rounded-xl border border-gray-700 py-2 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-all text-center"
              >
                Manage Subscription →
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-600 mb-2">Unlock full access with Pro</p>
                <button
                  onClick={() => handleUpgrade('yearly')}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20"
                >
                  Upgrade to Pro Annual — $189.99/yr
                </button>
                <button
                  onClick={() => handleUpgrade('monthly')}
                  className="w-full rounded-xl border border-gray-700 py-2 text-sm font-semibold text-gray-400 hover:text-white hover:border-gray-500 transition-all"
                >
                  Upgrade to Pro — $18.99/mo
                </button>
              </div>
            )}
          </div>

          {/* Links */}
          <div className="px-2 py-2">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
            >
              <span className="text-base">⚙</span> Account Settings
            </Link>
            <Link
              href="/legal/terms"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
            >
              <span className="text-base">📄</span> Terms of Service
            </Link>
            <Link
              href="/legal/privacy"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
            >
              <span className="text-base">🔒</span> Privacy Policy
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
            >
              <span className="text-base">↩</span> Sign Out
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
