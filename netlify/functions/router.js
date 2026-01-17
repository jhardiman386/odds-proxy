export const handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { operation, ...rest } = params;

  const baseUrl = "https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions";

  let target;
  switch (operation) {
    case "getRosterStatus":
      target = `${baseUrl}/roster-status?${new URLSearchParams(rest)}`;
      break;
    case "syncRoster":
      target = `${baseUrl}/roster-sync?${new URLSearchParams(rest)}`;
      break;
    case "getOdds":
      target = `${baseUrl}/odds?${new URLSearchParams(rest)}`;
      break;
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or missing operation parameter" }),
      };
  }

  try {
    const response = await fetch(target);
    const text = await response.text();
    return {
      statusCode: response.status,
      body: text,
      headers: { "Content-Type": "application/json" },
    };
  } catch (err) {
    console.error("Router error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Router failed to forward request", details: err.message }),
    };
  }
};