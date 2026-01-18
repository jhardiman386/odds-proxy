/**
 * Unified Super-Pipeline Router v3.2.1
 * Compatible with: NFL/NBA/NHL/NCAAF/NCAAB/PGA/SOCCER/UFC pipelines
 * Purpose: Route orchestrator operations to correct Netlify functions.
 * Author: Professional Sports Analytics Engine (2026)
 */

const BASE_URL = process.env.URL || 'https://jazzy-mandazi-d04d35.netlify.app/.netlify/functions';

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const operation = params.operation || '';
    const sport = params.sport || '';
    const regions = params.regions || 'us,us2';
    const markets = params.markets || 'all';
    const bookmakers = params.bookmakers || 'draftkings,fanduel';
    const oddsFormat = params.oddsFormat || 'american';
    const dateFormat = params.dateFormat || 'iso';
    const force = params.force || false;

    console.log(`[Router] Received operation: ${operation} | sport: ${sport}`);

    // Helper to fetch downstream function
    const callFunction = async (fn, query) => {
      const url = `${BASE_URL}/${fn}?${query}`;
      console.log(`[Router] Forwarding to: ${url}`);
      const res = await fetch(url);
      const text = await res.text();
      try {
        return {
          statusCode: res.status,
          body: text || JSON.stringify({ message: 'Empty response from child function' }),
        };
      } catch {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to parse downstream response', text }),
        };
      }
    };

    switch (operation) {
      // 🧠 Health / Validation
      case 'health':
        return await callFunction('health', '');

      case 'validateConfigs':
      case 'validate_configs':
        return await callFunction('validate_configs', '');

      // 🏈 Roster Operations
      case 'getRosterStatus':
      case 'rosterStatus':
        return await callFunction('roster-status', `sport=${sport}&force=${force}`);

      case 'syncRoster':
      case 'rosterSync':
      case 'roster-sync':
        return await callFunction('roster-sync', `sport=${sport}`);

      case 'refreshRoster':
      case 'rosterRefresh':
      case 'roster-refresh':
        return await callFunction('roster-refresh', `sport=${sport}`);

      // 🎯 Odds / Market Operations
      case 'getOdds':
      case 'odds':
        return await callFunction(
          'sportsDataproxy',
          `operation=getOdds&sport=${sport}&regions=${regions}&markets=${markets}&bookmakers=${bookmakers}&oddsFormat=${oddsFormat}&dateFormat=${dateFormat}`
        );

      // 🕒 Scheduler
      case 'scheduler':
        return await callFunction('scheduler', '');

      // 🚨 Default
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Unknown or unsupported operation',
            received: operation,
            valid_operations: [
              'health',
              'validate_configs',
              'getRosterStatus',
              'syncRoster',
              'refreshRoster',
              'getOdds',
              'scheduler',
            ],
          }),
        };
    }
  } catch (err) {
    console.error('[Router] Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Router internal error',
        details: err.message || 'No error message',
      }),
    };
  }
};
