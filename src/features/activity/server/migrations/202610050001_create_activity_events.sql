CREATE TABLE activity_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  actor_id TEXT,
  target_id TEXT,
  target_label TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  occurred_at INTEGER NOT NULL
);

CREATE INDEX activity_events_occurred_at_idx
  ON activity_events (occurred_at DESC, id DESC);

CREATE INDEX activity_events_actor_id_idx
  ON activity_events (actor_id, occurred_at DESC);

CREATE INDEX activity_events_action_idx
  ON activity_events (action, occurred_at DESC);
