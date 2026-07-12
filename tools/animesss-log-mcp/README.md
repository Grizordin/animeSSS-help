# AnimeSSS Log MCP

Read-only MCP adapter for the private telemetry API exposed by `cloudflare-report-worker.js`.

Required inherited environment variables:

- `ANIMESSS_LOG_API_URL`
- `ANIMESSS_LOG_READ_TOKEN`

The server exposes health, recent-log, incident, session, and aggregate-stat tools. It has no write or arbitrary-SQL tool.
