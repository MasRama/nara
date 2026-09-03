process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';
// Load after test environment assignment so shared config selects :memory:.
const { migrate } = await import('../../src/shared/database');
migrate();
