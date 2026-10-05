const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function sitemap() {
  return [
    { url: site, changeFrequency: "weekly" as const, priority: 1 },
    { url: `${site}/about`, changeFrequency: "monthly" as const, priority: 0.6 },
    { url: `${site}/privacy`, changeFrequency: "yearly" as const, priority: 0.4 },
  ];
}
