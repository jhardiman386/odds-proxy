exports.handler = async function (event, context) {
  const { sport = 'nfl' } = event.queryStringParameters;

  try {
    // You can call APIs here directly with fetch — no import needed
    const res = await fetch(`https://api.sportsdata.io/v3/${sport}/scores/json/Players?key=${process.env.SPORTSDATAIO_KEY}`);
    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${sport.toUpperCase()} roster synced successfully.`,
        active_count: data.length,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error('Roster Sync Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Roster sync failed', details: err.message }),
    };
  }
};