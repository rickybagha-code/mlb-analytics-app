import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'PropEdge | MLB Analytics',
  description:
    'Professional MLB prop betting analytics. Batter vs pitcher matchup scoring, weather intelligence, park factors, and recency-weighted trends.',
  keywords: 'MLB analytics, baseball props, batter pitcher matchup, MLB prop betting',
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
