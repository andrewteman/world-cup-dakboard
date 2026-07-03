// /api/wc.js
// Vercel serverless function (Node, ESM).
//
// Why this exists: football-data.org does not reliably allow direct browser
// calls, and a client-side fetch would also expose your API token in the page
// source. This function keeps the token server-side, adds permissive CORS so
// the widget can read it, and edge-caches the result so frequent refreshes (or
// several displays) never burn through the free tier's 10 requests / minute.
//
// Knockout-stage version: fetches matches only. The standings call was
// removed when the group stage ended, halving upstream API usage.
//
// Resilience: the free tier occasionally throws a slow response or a 429. Two
// layers absorb that so the wall never flashes an error. First, the edge cache
// keeps serving the last good response (stale-while-revalidate / stale-if-error)
// for up to a day while it revalidates in the background. Second, a warm
// instance keeps the last good payload in memory and serves it if an upstream
// call fails outright.

const BASE = "https://api.football-data.org/v4/competitions/WC";

// Persists across invocations on a warm instance (not guaranteed on cold start,
// which is why the edge cache header below is the primary safety net).
let lastGoodPayload = null;

async function fetchCombined(token) {
  const headers = { "X-Auth-Token": token };
  const matchesRes = await fetch(`${BASE}/matches`, { headers });

  if (!matchesRes.ok) {
    const err = new Error("Upstream error from football-data.org");
    err.matchesStatus = matchesRes.status;
    throw err;
  }

  const matchesJson = await matchesRes.json();

  return {
    fetchedAt: new Date().toISOString(),
    matches: matchesJson.matches || [],
  };
}

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

  try {
    const payload = await fetchCombined(token);
    lastGoodPayload = payload;

    // Edge cache: fresh for 5 minutes, then serve stale for up to a day while
    // revalidating in the background, and serve stale if a revalidation errors.
    // This is what masks transient upstream blips from the wall display.
    res.setHeader(
      "Cache-Control",
      "s-maxage=300, stale-while-revalidate=86400, stale-if-error=86400"
    );
    res.status(200).json(payload);
  } catch (err) {
    // Upstream failed. If this warm instance still holds a good payload, serve
    // it (marked stale) rather than erroring. Sent no-store so the edge cache
    // keeps its own, possibly newer, cached copy as the source of truth.
    if (lastGoodPayload) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(Object.assign({ stale: true }, lastGoodPayload));
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({
      error: "Upstream error from football-data.org, and no cached data yet.",
      matchesStatus: err.matchesStatus,
      message: String(err && err.message ? err.message : err),
    });
  }
}
