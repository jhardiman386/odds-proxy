exports.handler = async function (event) {
  const { sport = "nfl" } = event.queryStringParameters;
  const API_KEY = process.env.SPORTSDATAIO_KEY;

  const sportEndpoints = {
    nfl: "nfl/scores/json/Players",
    nba: "nba/scores/json/Players",
    nhl: "nhl/scores/json/Players",
    ncaab: "cbb/scores/json/Players",
    pga: "golf/scores/json/Players",
    ufc: "mma/scores/json/Fighters",
    soccer: "soccer/scores/json/Players"
  };

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing SPORTSDATAIO_KEY env var" }),
    };
  }

  const endpoint = sportEndpoints[sport];
  if (!endpoint) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Invalid sport: ${sport}` }),
    };
  }

  const url = `https://api.sportsdata.io/v3/${endpoint}?key=${API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully.`,
        active_count: Array.isArray(data) ? data.length : 0,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error("Roster Sync Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Roster sync failed",
        details: err.message,
        attempted_url: url
      }),
    };
  }
};