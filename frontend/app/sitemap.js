export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proprstats.com';
  return [
    { url: base,                        lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/dashboard`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/dashboard/matchup`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/signup`,            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/login`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/account`,           lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/legal/terms`,       lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/legal/privacy`,     lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
