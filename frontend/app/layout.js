import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'ProprStats — MLB Analytics App',
    template: '%s | ProprStats',
  },
  description:
    'ProprStats is the MLB prop research platform built for serious bettors. Statcast-powered player analysis, Poisson EV% modeling, and real-time splits for Hits, HR, Runs, RBI, and Strikeout props — updated daily.',
  keywords: 'MLB analytics, baseball props, batter pitcher matchup, MLB prop betting, Statcast, Poisson EV model, ProprStats',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/brand-logo.svg',
  },
  openGraph: {
    title: 'ProprStats — MLB Analytics App',
    description:
      'Statcast-powered MLB prop research. Poisson EV modeling, real-time splits, and a 0–100 model score for every player — updated daily.',
    siteName: 'ProprStats',
    type: 'website',
    images: [{ url: '/brand-logo.svg', width: 400, height: 400 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ProprStats — MLB Analytics App',
    description: 'MLB prop research powered by Statcast and Poisson EV modeling.',
    images: ['/brand-logo.svg'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
