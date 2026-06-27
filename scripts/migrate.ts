import Migrator from '@services/Migrator';

const arg = process.argv[2];

if (arg === '--rollback') {
  const result = Migrator.migrateRollback();
  console.log(`Rolled back ${result.rolledBack.length} migration(s):`);
  result.rolledBack.forEach(name => console.log(`  - ${name}`));
} else if (arg === '--status') {
  const status = Migrator.migrateStatus();
  console.log('Applied:');
  status.applied.forEach(name => console.log(`  ✓ ${name}`));
  console.log('Pending:');
  if (status.pending.length === 0) {
    console.log('  (none)');
  } else {
    status.pending.forEach(name => console.log(`  ⏳ ${name}`));
  }
} else if (arg === '--fresh') {
  const result = Migrator.migrateFresh();
  console.log(`Fresh migration complete. Applied ${result.applied.length} migration(s):`);
  result.applied.forEach(name => console.log(`  ✓ ${name}`));
} else {
  const result = Migrator.migrate();
  if (result.applied.length > 0) {
    console.log(`Applied ${result.applied.length} migration(s):`);
    result.applied.forEach(name => console.log(`  ✓ ${name}`));
  } else {
    console.log('No pending migrations.');
  }
  if (result.skipped.length > 0) {
    console.log(`Skipped ${result.skipped.length} already-applied migration(s).`);
  }
}
