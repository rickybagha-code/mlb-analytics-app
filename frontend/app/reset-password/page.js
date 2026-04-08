'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';
import { createClient } from '../../lib/supabase/client';

const inputCls =
  'bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-full text-sm';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [ready,           setReady]           = useState(false);

  useEffect(() => {
    // After PKCE flow the callback route already exchanged the code for a session.
    // Just confirm an active session exists — no need to wait for PASSWORD_RECOVERY event.
    async function checkSession() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
      } else {
        // Fallback: listen for PASSWORD_RECOVERY (older hash-based flow)
        supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') setReady(true);
        });
      }
    }
    checkSession();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="bg-gray-950 min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8">

        <div className="flex justify-center mb-5">
          <ProprStatsLogo variant="light" size={28} />
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-2">Set New Password</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Choose a new password for your account.
        </p>

        {!ready ? (
          <p className="text-sm text-gray-500 text-center">Verifying reset link…</p>
        ) : (
          <>
            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={inputCls}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className={inputCls}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}

        <p className="text-sm text-gray-600 text-center mt-6">
          <Link href="/login" className="text-gray-500 hover:text-gray-300 transition-colors">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
