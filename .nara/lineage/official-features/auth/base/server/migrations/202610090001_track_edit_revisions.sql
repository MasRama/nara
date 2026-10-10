-- Each edit of an account or a role raises its revision. An update names the
-- revision it was based on and applies only while that is still current, so
-- an edit made from stale data is refused instead of silently replacing a
-- newer one.
ALTER TABLE users ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE roles ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
