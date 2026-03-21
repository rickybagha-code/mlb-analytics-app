import Link from 'next/link';

// ─── Logo Mark ────────────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Baseball diamond outline */}
      <path d="M17 2L32 17L17 32L2 17Z" fill="#0f1e3a" stroke="#3b82f6" strokeWidth="1.5"/>
      {/* Inner glow fill */}
      <path d="M17 6L28 17L17 28L6 17Z" fill="#1e3a5f" opacity="0.5"/>
      {/* Trend line rising */}
      <path d="M10 21L13.5 15.5L16.5 18L23 11" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Dot at peak */}
      <circle cx="23" cy="11" r="2.2" fill="#3b82f6"/>
      <circle cx="23" cy="11" r="1" fill="#93c5fd"/>
    </svg>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-gray-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <LogoMark />
            <span className="font-black text-lg tracking-tight text-white group-hover:text-blue-400 transition-colors">
              Cook The Books
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Pricing</a>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/probables" className="text-sm text-gray-400 hover:text-white transition-colors">Probables</Link>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
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
    <div className="relative rounded-2xl border border-blue-500/20 bg-gray-900 p-6 shadow-2xl shadow-blue-500/10">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-cyan-500/5 pointer-events-none" />
      <div className="absolute -inset-px rounded-2xl ring-1 ring-blue-500/10 pointer-events-none" />

      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-gray-500">Matchup Analysis</span>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400 ring-1 ring-blue-500/20">
          Live
        </span>
      </div>

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

      <div className="mb-5 text-center rounded-xl bg-gray-950/80 py-5 border border-white/5">
        <div className="text-6xl font-black text-yellow-400 tabular-nums">72</div>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="text-sm">✅</span>
          <span className="text-sm font-semibold text-gray-300">Good Value</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-800/50 p-3 border border-white/5">
          <div className="text-xs text-gray-500 mb-1">Batting AVG</div>
          <div className="text-sm font-bold text-white">.312</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3 border border-white/5">
          <div className="text-xs text-gray-500 mb-1">OPS</div>
          <div className="text-sm font-bold text-white">.931</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3 border border-white/5">
          <div className="text-xs text-gray-500 mb-1">HR Rate</div>
          <div className="text-sm font-bold text-white">6.2%</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 p-3 border border-white/5">
          <div className="text-xs text-gray-500 mb-1">Park Factor</div>
          <div className="text-sm font-bold text-blue-400">+1.4%</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>🌤️</span>
          <span>72°F · Wind 8 mph out to RF</span>
        </div>
        <span className="text-xs font-medium text-blue-400">Favorable</span>
      </div>
    </div>
  );
}

// ─── Feature Icons (SVG, electric blue) ──────────────────────────────────────
function IconTarget() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function IconWind() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
      <path d="M17.59 11.59A2 2 0 1 1 19 15H2" />
      <path d="M14.59 17.59A2 2 0 1 0 16 21H2" />
    </svg>
  );
}

function IconTrend() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconStadium() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconSplit() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="M12 22v-8.3a4 4 0 0 1 1.172-2.872L21 3" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    icon: <IconTarget />,
    title: 'Matchup Scoring Engine',
    description: 'A proprietary 0–100 composite score combining six data inputs. Instantly know which matchups are worth your stack.',
  },
  {
    icon: <IconWind />,
    title: 'Weather Intelligence',
    description: 'Real-time temperature, wind speed, and direction. Know if the wind is blowing out before you place a bet.',
  },
  {
    icon: <IconTrend />,
    title: 'Recency-Weighted Trends',
    description: 'Last-5 and last-10 game windows tracked separately — because hot streaks matter more than season averages.',
  },
  {
    icon: <IconStadium />,
    title: 'Park Factor Adjustments',
    description: 'All 30 MLB stadiums calibrated with run and HR multipliers. Coors and Oracle Park are very different ballparks.',
  },
  {
    icon: <IconSplit />,
    title: 'Handedness Splits',
    description: 'vs LHP and vs RHP resolved automatically based on the probable pitcher. Always the right platoon stats.',
  },
  {
    icon: <IconZap />,
    title: 'Auto-Matchup Builder',
    description: "Pull today's probable pitchers and build your research list in one click. No manual lookup required.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-28 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Platform Features</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Cook The Books
            </span>
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Six data inputs. One score. Stop guessing and start analyzing with institutional-grade tools built for serious prop researchers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-xl border border-gray-800 bg-gray-900 p-7 overflow-hidden transition-all duration-300 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10"
            >
              {/* Top gradient line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {/* Corner glow */}
              <div className="absolute top-0 left-0 h-32 w-32 bg-blue-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              {/* Icon container */}
              <div className="relative mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/15 group-hover:border-blue-500/40 group-hover:text-blue-300 transition-all duration-300">
                {feature.icon}
              </div>

              <h3 className="mb-2.5 text-base font-bold text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
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
    <section id="pricing" className="py-28 bg-gray-900/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">Pricing</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Simple, Transparent Pricing</h2>
          <p className="mt-4 text-lg text-gray-400">No hidden fees. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all ${
                plan.highlight
                  ? 'border-blue-500/50 bg-gray-900 shadow-[0_0_40px_rgba(59,130,246,0.10)]'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow-lg shadow-blue-500/30">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className={`block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20'
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
    <footer className="border-t border-white/5 bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-black text-white">Cook The Books</span>
          </Link>
          <p className="text-sm text-gray-500 text-center">
            © 2025 Cook The Books. For research purposes only.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Terms</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Privacy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0 hero-grid" />
      {/* Blue radial glow from top-center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-blue-600/8 blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[250px] w-[400px] rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-sm font-medium text-blue-300">MLB 2025 Season · Live Data</span>
            </div>

            <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
              The Analytics Edge for{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                MLB Props
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-gray-400 max-w-xl">
              Cook The Books combines batter-pitcher splits, park factors, weather conditions, and recency-weighted trends into a single matchup score — so you spend less time researching and more time making confident picks.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-500 transition-all hover:-translate-y-0.5"
              >
                Start Analyzing
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/probables"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-6 py-3.5 text-base font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-all hover:-translate-y-0.5"
              >
                View Today&apos;s Probables
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Right — sample card */}
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

// ─── Page ──────────────────────────────────────────────────────────────────────
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
