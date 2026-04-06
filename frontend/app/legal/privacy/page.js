import Link from 'next/link';
import ProprStatsLogo from '../../../components/ProprStatsLogo';

export const metadata = {
  title: 'Privacy Policy',
  description: 'ProprStats Privacy Policy — how we collect, use, and protect your data.',
};

const EFFECTIVE_DATE = 'April 6, 2026';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-gray-950/80 backdrop-blur-xl px-4 sm:px-8 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <ProprStatsLogo variant="light" size={28} />
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← Back to home</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 sm:px-8 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-gray-400 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Overview</h2>
            <p>
              ProprStats (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy. This Privacy Policy explains
              what information we collect, how we use it, and your rights regarding your data when you use proprstats.com
              (the &ldquo;Service&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-sm font-bold text-gray-300 mb-2 mt-4">Information you provide</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Email address and password when you create an account</li>
              <li>Payment information (processed securely by Stripe — we do not store card details)</li>
              <li>Any communications you send us (e.g., support requests)</li>
            </ul>

            <h3 className="text-sm font-bold text-gray-300 mb-2 mt-4">Information collected automatically</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Browser type and version</li>
              <li>Pages visited and features used within the Service</li>
              <li>IP address and approximate geographic location</li>
              <li>Session duration and interaction timestamps</li>
              <li>Device type and operating system</li>
            </ul>

            <h3 className="text-sm font-bold text-gray-300 mb-2 mt-4">Local storage</h3>
            <p className="mt-2">
              We use browser localStorage to cache sports odds data and your session preferences (e.g., selected tabs,
              recently viewed players). This data never leaves your device and is not transmitted to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>To provide, maintain, and improve the Service</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (account confirmation, subscription receipts)</li>
              <li>To respond to support requests</li>
              <li>To detect and prevent fraud or abuse</li>
              <li>To analyze usage patterns and improve the platform</li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information to third parties. We do not use your data to build advertising profiles or
              share it with data brokers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Third-Party Services</h2>
            <p>We use the following third-party services which may process your data:</p>
            <div className="mt-3 space-y-3">
              {[
                { name: 'Stripe', purpose: 'Payment processing. Stripe\'s privacy policy governs payment data.', url: 'stripe.com/privacy' },
                { name: 'Vercel', purpose: 'Hosting and deployment infrastructure. May process request logs.', url: 'vercel.com/legal/privacy-policy' },
                { name: 'The Odds API', purpose: 'Sports odds data. Requests are server-side — no user data is sent.', url: 'the-odds-api.com' },
              ].map(s => (
                <div key={s.name} className="rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-300">{s.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.purpose}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Cookies</h2>
            <p>
              We use minimal cookies for authentication (session management). We do not use advertising cookies or tracking
              pixels. If you block cookies, you will not be able to stay logged in to your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you delete your account, we will remove your
              personal data within 30 days, except where retention is required by law (e.g., billing records, which are retained
              for 7 years for tax compliance).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Data Security</h2>
            <p>
              We use industry-standard security measures including HTTPS encryption for all data in transit and secure password
              hashing. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security but
              take reasonable precautions to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>Access a copy of your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;)</li>
              <li>Opt out of non-essential communications</li>
              <li>Data portability (receive your data in a portable format)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@proprstats.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                support@proprstats.com
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed to individuals under 18 years of age. We do not knowingly collect personal information
              from minors. If you believe we have inadvertently collected such information, please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes by email or by posting a
              notice on the Service. Your continued use of the Service after changes are posted constitutes acceptance of the
              revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Contact</h2>
            <p>
              Questions or concerns about this Privacy Policy? Reach us at{' '}
              <a href="mailto:support@proprstats.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                support@proprstats.com
              </a>
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-4 text-sm text-gray-600">
          <Link href="/legal/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">← Home</Link>
        </div>
      </main>
    </div>
  );
}
