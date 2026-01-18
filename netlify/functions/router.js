/**
 * Unified Sports Data Proxy — Netlify Router
 * Compatible with Super-Pipeline v3.2.0+
 * Supports: getRosterStatus, syncRoster, getOdds
 */

import fetch from 'node-fetch';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ROSTER_API_KEY = process.env.ROSTER_API_KEY;
const BASE_ODDS_URL = 'https://api.the-odds-api.com/v4/sports';
const BASE_ROSTER_URL = 'https://api.sportsdata.io/v4';
const DEFAULT_REGION = 'us';

export default async (req, res) => {
  try {
    const body = await req.json();
    const { operation, sport, regions, markets, bookmakers, oddsFormat, dateFormat, force } = body;

    if (!operation) {
      return res.status(400).json({ message: 'Missing required field: operation' });
    }

    let responseData;
    const sportKey = sport || 'americanfootball_nfl';
    const region = regions || DEFAULT_REGION;

    switch (operation) {
      // =========================
      // 1️⃣  GET ROSTER STATUS
      // =========================
      case 'getRosterStatus': {
        const rosterUrl = `${BASE_ROSTER_URL}/${sportKey}/scores/json/Players?key=${ROSTER_API_KEY}`;
        const rosterRes = await fetch(rosterUrl);
        const rosterJson = await rosterRes.json();
        responseData = {
          message: 'Roster status fetched successfully',
          sport: sportKey,
          count: rosterJson?.length || 0,
          data: rosterJson,
        };
        break;
      }

      // =========================
      // 2️⃣  SYNC ROSTER (FORCE REFRESH)
      // =========================
      case 'syncRoster': {
        const syncUrl = `${BASE_ROSTER_URL}/${sportKey}/scores/json/Players?key=${ROSTER_API_KEY}`;
        const syncRes = await fetch(syncUrl, { cache: 'no-store' });
        const syncJson = await syncRes.json();
        responseData = {
          message: 'Roster synced successfully',
          sport: sportKey,
          count: syncJson?.length || 0,
          data: syncJson,
        };
        break;
      }

      // =========================
      // 3️⃣  GET ODDS (H2H / SPREADS / TOTALS / PROPS)
      // =========================
      case 'getOdds': {
        const regionParam = region || 'us';
        const marketParam = markets || 'h2h,spreads,totals,player_props';
        const bookmakerParam = bookmakers || 'draftkings,fanduel';
        const oddsUrl = `${BASE_ODDS_URL}/${sportKey}/odds?regions=${regionParam}&markets=${marketParam}&bookmakers=${bookmakerParam}&oddsFormat=${oddsFormat || 'american'}&dateFormat=${dateFormat || 'iso'}&apiKey=${ODDS_API_KEY}`;

        const oddsRes = await fetch(oddsUrl);
        const oddsJson = await oddsRes.json();

        responseData = {
          message: 'Odds data retrieved successfully',
          sport: sportKey,
          region: regionParam,
          marketCount: oddsJson?.length || 0,
          data: oddsJson,
        };
        break;
      }

      default:
        return res.status(400).json({ message: `Unknown operation: ${operation}` });
    }

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Router error:', error);
    return res.status(500).json({ message: 'Router function failed', error: error.message });
  }
};