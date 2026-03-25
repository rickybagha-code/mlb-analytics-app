import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Cook The Books | MLB Prop Research',
  description:
    'The only MLB prop research tool that combines Statcast exit velocity, pitcher matchup data, park factors, and a Poisson EV model — so you know exactly where the line is mispriced before you bet it.',
  keywords: 'MLB analytics, baseball props, batter pitcher matchup, MLB prop betting, Statcast, Poisson EV model',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    images: [{ url: '/brand-logo.svg', width: 400, height: 400 }],
  },
  twitter: {
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
