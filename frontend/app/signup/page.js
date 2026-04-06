'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ProprStatsLogo from '../../components/ProprStatsLogo';
import { createClient } from '../../lib/supabase/client';

const inputCls =
  'bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 w-full text-sm';

function SignupForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const plan         = searchParams.get('plan') || 'free'; // 'free' | 'monthly' | 'yearly'

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [showPromo,       setShowPromo]       = useState(false);

  const isPaid = plan === 'monthly' || plan === 'yearly';

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
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/api/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If paid plan, create Stripe checkout session
    if (isPaid) {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ plan }),
        });
        const { url, error: stripeError } = await res.json();
        if (url) {
          window.location.href = url;
          return;
        }
        // If Stripe fails, still let them into dashboard on free plan
        console.error('Stripe checkout error:', stripeError);
      } catch (err) {
        console.error('Checkout fetch error:', err);
      }
    }

    router.push('/dashboard');
    router.refresh();
  }

  const planLabel = plan === 'yearly' ? 'Pro Annual — $189.99/yr'
    : plan === 'monthly' ? 'Pro — $18.99/mo'
    : 'Free';

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

        <h2 className="text-xl font-bold text-white text-center mb-1">Create Your Account</h2>

        {/* Plan badge */}
        {isPaid && (
          <div className="flex justify-center mb-5">
            <span className="rounded-full bg-blue-600/20 border border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-400">
              {planLabel}
            </span>
          </div>
        )}
        {!isPaid && <div className="mb-5"/>}

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
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            className={inputCls}
          />

          {/* Promo code (Stripe handles it on checkout page for paid plans) */}
          {!isPaid && (
            <div>
              <button
                type="button"
                onClick={() => setShowPromo(v => !v)}
                className="text-xs text-blue-400 cursor-pointer underline-offset-2 hover:text-blue-300 underline"
              >
                Have a promo code?
              </button>
              {showPromo && (
                <p className="text-xs text-gray-600 mt-1">
                  Promo codes are applied on the payment page after you choose a plan.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25 mt-2"
          >
            {loading
              ? isPaid ? 'Creating account…' : 'Creating account…'
              : isPaid ? `Create Account & Continue to Payment →` : 'Create Free Account'}
          </button>
        </form>

        <p className="text-xs text-gray-600 text-center mt-4">
          By creating an account you agree to our{' '}
          <Link href="/legal/terms" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/legal/privacy" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-800"/>
          <span className="text-xs text-gray-700">or</span>
          <div className="flex-1 h-px bg-gray-800"/>
        </div>

        <p className="text-sm text-gray-500 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-6">
        <Link href="/#pricing" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          &larr; Back to pricing
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
