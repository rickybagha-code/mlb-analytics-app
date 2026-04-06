// POST /api/stripe/webhook
// Handles Stripe webhook events to keep Supabase profiles in sync.
//
// Events handled:
//   checkout.session.completed      → activate subscription after payment
//   customer.subscription.updated   → handle renewals, plan changes, pauses
//   customer.subscription.deleted   → downgrade to free on cancellation
//
// Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — server-only, never sent to client.
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);

// Service role client — can write to profiles regardless of RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function planFromSubscription(subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (priceId === process.env.STRIPE_PRICE_ANNUAL)  return 'pro_annual';
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'pro_monthly';
  return 'free';
}

export async function POST(request) {
  const body = await request.text();
  const sig  = request.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.user_id;
        if (!userId) { console.error('No user_id in checkout metadata'); break; }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);

        await supabase.from('profiles').update({
          stripe_customer_id:      session.customer,
          stripe_subscription_id:  session.subscription,
          plan:                    planFromSubscription(subscription),
          subscription_status:     subscription.status,
          current_period_end:      new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at:              new Date().toISOString(),
        }).eq('id', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await supabase.from('profiles').update({
          plan:                planFromSubscription(subscription),
          subscription_status: subscription.status,
          current_period_end:  new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at:          new Date().toISOString(),
        }).eq('stripe_customer_id', subscription.customer);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabase.from('profiles').update({
          plan:                    'free',
          subscription_status:     'cancelled',
          stripe_subscription_id:  null,
          current_period_end:      null,
          updated_at:              new Date().toISOString(),
        }).eq('stripe_customer_id', subscription.customer);
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err.message);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
