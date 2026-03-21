import Link from 'next/link';

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="text-xl">⚾</span>
            <span className="text-lg font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
              PropEdge
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Pricing
            </a>
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/probables"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Probables
            </Link>
          </div>

          {/* CTA */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
          >
            Get Started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Sample Matchup Card ──────────────────────────────────────────────────────
function SampleMatchupCard() {
  return (
    <div className="relative rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl">
      {/* Glow effect */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 pointer-events-none" />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-gray-500">
          Matchup Analysis
        </span>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
          Live
        </span>
      </div>

      {/* Players */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-base font-bold text-white">Mike Trout</div>
          <div className="text-xs text-gray-500">Batter · OF · LAA</div>
        </div>
        <div className="text-gray-600 text-lg font-light">vs</div>
        <div className="text-right">
          <div className="text-base font-bold text-white">Gerrit Cole</div>
          <div className="text-xs text-gray-500">Pitcher · SP · NYY</div>
        </div>
      </div>

      {/* Score */}
      <div className="mb-5 text-center">
        <div className="text-5xl font-black text-emerald-400 tabular-nums">72</div>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="text-sm">✅</span>
          <span className="text-sm font-semibold text-emerald-300">Good Value</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="text-xs text-gray-500 mb-1">Batting AVG</div>
          <div className="text-sm font-bold text-white">.312</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="text-xs text-gray-500 mb-1">OPS</div>
          <div className="text-sm font-bold text-white">.931</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="text-xs text-gray-500 mb-1">HR Rate</div>
          <div className="text-sm font-bold text-white">6.2%</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3">
          <div className="text-xs text-gray-500 mb-1">Park Factor</div>
          <div className="text-sm font-bold text-emerald-400">+1.4%</div>
        </div>
      </div>

      {/* Weather row */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-800/30 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>🌤️</span>
          <span>72°F · Wind 8 mph out to RF</span>
        </div>
        <span className="text-xs font-medium text-emerald-400">Favorable</span>
      </div>
    </div>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
const features = [
  {
    icon: '⚡',
    title: 'Matchup Scoring Engine',
    description:
      'Our proprietary algorithm combines six data inputs into a single 0–100 score. Instantly know which matchups are worth your time.',
  },
  {
    icon: '🌤️',
    title: 'Weather Intelligence',
    description:
      'Real-time conditions including temperature, wind speed, and direction. Know if the wind is blowing out to left before you place a bet.',
  },
  {
    icon: '📊',
    title: 'Recency-Weighted Trends',
    description:
      'Recent performance matters more than season averages. We track last-5 and last-10 game windows for both batters and pitchers.',
  },
  {
    icon: '🏟️',
    title: 'Park Factor Adjustments',
    description:
      'Every stadium plays differently. Our run and HR factors calibrate each matchup score to the actual venue being played in.',
  },
  {
    icon: '✂️',
    title: 'Handedness Splits',
    description:
      'Left vs right matchups are automatically resolved. Get the correct platoon stats for every batter-pitcher combination.',
  },
  {
    icon: '🔄',
    title: 'Auto-Matchup Builder',
    description:
      "Pull today's probable pitchers and instantly build your research list. No manual lookup — just one click to load tomorrow's slate.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-16 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Platform Features
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Everything You Need to Research{' '}
            <span className="text-gradient-emerald">MLB Props</span>
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Six data inputs. One score. Stop guessing and start analyzing with institutional-grade tools built for serious prop researchers.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-gray-800 bg-gray-900 p-6 transition-all duration-200 hover:border-emerald-500/30 hover:bg-gray-900/80"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gray-800 text-xl group-hover:bg-emerald-500/10 transition-colors">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────
const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with basic matchup research.',
    highlight: false,
    features: [
      '5 matchup analyses per day',
      'Basic batter & pitcher stats',
      'Probable pitchers lookup',
      'Handedness splits',
      'Community support',
    ],
    cta: 'Start Free',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'The full toolkit for serious prop researchers.',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited matchup analyses',
      'Real-time weather intelligence',
      'Recency-weighted trends (L5 / L10)',
      'Park factor adjustments',
      'Auto-matchup builder',
      'Priority email support',
    ],
    cta: 'Start Pro Trial',
  },
  {
    name: 'Elite',
    price: '$79',
    period: '/month',
    description: 'For power users and professional handicappers.',
    highlight: false,
    features: [
      'Everything in Pro',
      'Full REST API access',
      'CSV bulk export',
      'Custom date-range backtesting',
      'Dedicated Slack channel',
      'Priority feature requests',
    ],
    cta: 'Go Elite',
  },
];

function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-gray-900/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-16 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Pricing
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            No hidden fees. Cancel anytime.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                plan.highlight
                  ? 'border-emerald-500/50 bg-gray-900 ring-1 ring-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.08)]'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold text-white shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'border border-gray-700 text-gray-300 hover:border-gray-600 hover:text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-lg">⚾</span>
            <span className="font-bold text-white">PropEdge</span>
          </Link>

          {/* Center text */}
          <p className="text-sm text-gray-500 text-center">
            © 2025 PropEdge. For research purposes only.
          </p>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Terms
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 hero-grid" />

      {/* Emerald radial glow from top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[300px] w-[500px] rounded-full bg-emerald-500/8 blur-2xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left column */}
          <div>
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="text-sm">⚡</span>
              <span className="text-sm font-medium text-emerald-300">
                MLB 2025 Season · Live Data
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
              The Analytics Edge for{' '}
              <span className="text-gradient-emerald">MLB Props</span>
            </h1>

            {/* Subtext */}
            <p className="mt-6 text-lg leading-relaxed text-gray-400 max-w-xl">
              PropEdge combines batter-pitcher history, park factors, weather conditions, and recency-weighted trends into a single matchup score — so you spend less time researching and more time making confident picks.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all hover:shadow-emerald-500/30 hover:-translate-y-0.5"
              >
                Start Analyzing
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/probables"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-6 py-3.5 text-base font-semibold text-gray-300 hover:border-gray-600 hover:text-white transition-all hover:-translate-y-0.5"
              >
                View Today&apos;s Probables
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </Link>
            </div>

            {/* Stat row */}
            <div className="mt-12 flex items-center gap-8 border-t border-gray-800/60 pt-8">
              {[
                { value: '30', label: 'Stadiums' },
                { value: 'Real-time', label: 'Weather' },
                { value: '6', label: 'Data Inputs' },
              ].map((stat, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-2xl font-black text-emerald-400">{stat.value}</span>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-0.5">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — sample card */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-sm">
              <SampleMatchupCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
