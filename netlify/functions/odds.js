exports.handler = async function (event, context) {
  const { path = '', ...query } = event.queryStringParameters;

  const ODDS_API_KEY = process.env.ODDS_API_KEY;

  if (!ODDS_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing ODDS_API_KEY env var' }),
    };
  }

  const url = new URL(`https://api.the-odds-api.com/v4/${path}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set('apiKey', ODDS_API_KEY);

  try {
    const upstreamRes = await fetch(url.toString());
    const data = await upstreamRes.json();
    return {
      statusCode: upstreamRes.status,
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Proxy error:', err);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Upstream request failed' }),
    };
  }
};
