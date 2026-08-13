// Test bootstrap — run before every test file (vitest setupFiles).
// Forces an in-memory SQLite so tests never touch database/dev.sqlite3.
// Must run before app/services/SQLite.ts is first imported (dotenv would
// otherwise load DB_FILE from .env and tests would mutate the dev database).
process.env.DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';
