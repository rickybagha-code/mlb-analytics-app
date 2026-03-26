'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    localStorage.setItem('proprstats_plan', 'free');
    window.location.href = '/dashboard';
  }

  const inputCls =
    'bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-full text-sm';

  return (
    <div className="bg-gray-950 min-h-screen flex flex-col items-center justify-center px-4 py-16">

      {/* ── Decorative quote section ────────────────────────────────────────── */}
      <div className="w-full max-w-lg mb-10 text-center">
        <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-blue-400 to-transparent mb-6"/>
        <p className="text-2xl sm:text-3xl font-bold italic text-white leading-snug">
          &ldquo;The book sets the line. You find the edge.&rdquo;
        </p>
        <p className="mt-3 text-sm text-gray-400">&mdash; ProprStats</p>
        <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-blue-400 to-transparent mt-6"/>
      </div>

      {/* ── Card ────────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-8">

        {/* Logo */}
        <div className="flex justify-center mb-5">
          <ProprStatsLogo variant="light" size={28} />
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-6">Welcome Back</h2>

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
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25 mt-2"
          >
            Sign In
          </button>
        </form>

        {/* Divider */}
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

      {/* ── Back home ───────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          &larr; Back home
        </Link>
      </div>
    </div>
  );
}
