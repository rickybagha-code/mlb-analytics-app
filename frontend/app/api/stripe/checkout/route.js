// POST /api/stripe/checkout
// Creates a Stripe Checkout Session and returns the redirect URL.
// Body: { plan: 'monthly' | 'yearly' }
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '../../../../lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  yearly:  process.env.STRIPE_PRICE_ANNUAL,
};

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { plan } = await request.json();
  const priceId = PRICE_IDS[plan];
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });

  // Look up existing Stripe customer ID to avoid duplicates
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proprstats.com';

  const session = await stripe.checkout.sessions.create({
    mode:                 'subscription',
    payment_method_types: ['card'],
    line_items:           [{ price: priceId, quantity: 1 }],
    // Reuse existing customer if present, otherwise let Stripe create one
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email }
    ),
    metadata:             { user_id: user.id },
    success_url:          `${base}/account?success=1`,
    cancel_url:           `${base}/#pricing`,
    allow_promotion_codes: true,
    subscription_data:    { metadata: { user_id: user.id } },
  });

  return NextResponse.json({ url: session.url });
}
