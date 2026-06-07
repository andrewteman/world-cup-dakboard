// /api/wc.js
// Vercel serverless function (Node, ESM).
//
// Why this exists: football-data.org does not reliably allow direct browser
// calls, and a client-side fetch would also expose your API token in the page
// source. This function keeps the token server-side, adds permissive CORS so
// the widget can read it, and edge-caches the result so frequent refreshes (or
// several displays) never burn through the free tier's 10 requests / minute.
//
// It makes two upstream calls (standings + matches) and returns one combined
// JSON payload, so the widget only ever makes a single request.

const BASE = "https://api.football-data.org/v4/competitions/WC";

export default async function handler(req, res) {
  // CORS. The widget reads this from its own origin in the normal case, but
  // allow-all keeps it usable from anywhere (e.g. a quick local test file).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    res.status(500).json({
      error:
        "Missing FOOTBALL_DATA_TOKEN. Add it as an Environment Variable in the Vercel project settings, then redeploy.",
    });
    return;
  }

  const headers = { "X-Auth-Token": token };

  try {
    const [standingsRes, matchesRes] = await Promise.all([
      fetch(`${BASE}/standings`, { headers }),
      fetch(`${BASE}/matches`, { headers }),
    ]);

    if (!standingsRes.ok || !matchesRes.ok) {
      // Surface the upstream status so a 403 (bad token) or 429 (rate limit)
      // is obvious instead of looking like a generic failure.
      res.status(502).json({
        error: "Upstream error from football-data.org",
        standingsStatus: standingsRes.status,
        matchesStatus: matchesRes.status,
      });
      return;
    }

    const standingsJson = await standingsRes.json();
    const matchesJson = await matchesRes.json();

    // Cache at Vercel's edge for 5 minutes, serve stale for up to 10 more while
    // revalidating. This protects the free-tier limit no matter how often the
    // widget or Dakboard refreshes.
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    res.status(200).json({
      fetchedAt: new Date().toISOString(),
      season: standingsJson.season || null,
      standings: standingsJson.standings || [],
      matches: matchesJson.matches || [],
    });
  } catch (err) {
    res.status(500).json({ error: "Proxy failed", message: String(err) });
  }
}
