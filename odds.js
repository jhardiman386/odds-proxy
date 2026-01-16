export default async function handler(req, res) {
  const { path = '', ...query } = req.query;

  const ODDS_API_KEY = process.env.ODDS_API_KEY;

  if (!ODDS_API_KEY) {
    return res.status(500).json({ error: 'Missing ODDS_API_KEY env var' });
  }

  const url = new URL(`https://api.the-odds-api.com/v4/${path}`);

  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  url.searchParams.set('apiKey', ODDS_API_KEY);

  try {
    const upstreamRes = await fetch(url.toString());
    const data = await upstreamRes.json();
    return res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(502).json({ error: 'Upstream request failed' });
  }
}
