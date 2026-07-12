CREATE TABLE IF NOT EXISTS telemetry_batches (
  batch_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  nick TEXT NOT NULL,
  install_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  module TEXT NOT NULL,
  reason TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  script_version TEXT NOT NULL,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL,
  events_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_received_module
  ON telemetry_batches(received_at, module);

CREATE INDEX IF NOT EXISTS idx_telemetry_nick_received
  ON telemetry_batches(nick, received_at);

CREATE TABLE IF NOT EXISTS telemetry_incidents (
  incident_key TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  received_at TEXT NOT NULL,
  module TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  nick TEXT NOT NULL,
  details_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incidents_received_type
  ON telemetry_incidents(received_at, incident_type);
