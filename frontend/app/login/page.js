'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';
import { createClient } from '../../lib/supabase/client';

const inputCls =
  'bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-full text-sm';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get('next') || '/dashboard';
  const urlError     = searchParams.get('error');

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState(urlError || null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="bg-gray-950 min-h-screen flex flex-col items-center justify-center px-4 py-16">

      {/* Decorative quote */}
      <div className="w-full max-w-lg mb-10 text-center">
        <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-blue-400 to-transparent mb-6"/>
        <p className="text-2xl sm:text-3xl font-bold italic text-white leading-snug">
          &ldquo;The book sets the line. You find the edge.&rdquo;
        </p>
        <p className="mt-3 text-sm text-gray-400">&mdash; ProprStats</p>
        <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-blue-400 to-transparent mt-6"/>
      </div>

      {/* Card */}
      <div className="w-full max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8">

        <div className="flex justify-center mb-5">
          <ProprStatsLogo variant="light" size={28} />
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-6">Welcome Back</h2>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={inputCls}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25 mt-2"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-800"/>
          <span className="text-xs text-gray-700">or</span>
          <div className="flex-1 h-px bg-gray-800"/>
        </div>

        <p className="text-sm text-gray-500 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign up
          </Link>
        </p>
      </div>

      <div className="mt-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          &larr; Back home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
