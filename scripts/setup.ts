import { migrate, seed } from '../src/shared/database';
import { bootstrapAdmin } from './bootstrap-admin';

async function run(): Promise<void> {
  const migrations = migrate();
  const seeds = seed();
  const admin = await bootstrapAdmin();

  process.stdout.write('Nara setup complete.\n\n');
  process.stdout.write(`Migrations applied: ${migrations.applied.length}\n`);
  process.stdout.write(`Reference seeds applied: ${seeds.applied.length}\n\n`);

  if (admin.status === 'created') {
    process.stdout.write(`Admin\n  Email:    ${admin.email}\n`);
    if (admin.temporaryPassword && admin.password) {
      process.stdout.write(`  Password: ${admin.password}\n\nChange the default password after signing in.\n`);
    } else {
      process.stdout.write('  Password: configured via NARA_ADMIN_PASSWORD\n');
    }
    return;
  }

  process.stdout.write(`Admin bootstrap skipped; admin already exists: ${admin.email}.\n`);
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
