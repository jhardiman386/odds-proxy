# Super Pipeline Orchestrator

## Live Endpoints
- Health: https://super-pipeline-orchestrator.netlify.app/.netlify/functions/health
- Router: https://super-pipeline-orchestrator.netlify.app/.netlify/functions/router

## Environment Variables
- ODDS_API_KEY
- ROSTER_API_KEY

## Testing
Use PowerShell:
Invoke-WebRequest -Uri "<endpoint>" | Select-Object -ExpandProperty Content

## Schedule
- roster-refresh → every 12h
- scheduler → every 6h
- health-check → every 30m
