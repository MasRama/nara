import { randomUUID } from 'node:crypto';
import { getDatabase, migrate, seed } from '../src/shared/database';
import { hashPassword, registerInputSchema } from '../src/features/auth';

function requiredCredentials(): { name: string; email: string; password: string } {
  const name = process.env.NARA_ADMIN_NAME?.trim() || 'Admin';
  const email = process.env.NARA_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.NARA_ADMIN_PASSWORD;

  if (!email || !password?.trim()) {
    throw new Error('Admin bootstrap requires NARA_ADMIN_EMAIL and a non-empty NARA_ADMIN_PASSWORD.');
  }

  const parsed = registerInputSchema.safeParse({ name, email, password });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '_root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Admin bootstrap credentials are invalid:\n${details}`);
  }

  return parsed.data;
}

function bootstrapAdmin(credentials: { name: string; email: string; password: string }): void {
  const database = getDatabase();
  const existing = database
    .prepare('SELECT id FROM users WHERE lower(email) = ?')
    .get(credentials.email) as { id: string } | undefined;
  if (existing) {
    throw new Error(`Admin bootstrap refused: a user with email "${credentials.email}" already exists.`);
  }

  const adminRole = database
    .prepare('SELECT id FROM roles WHERE slug = ?')
    .get('admin') as { id: string } | undefined;
  if (!adminRole) {
    throw new Error('Admin bootstrap could not find the admin role after reference seeding.');
  }

  const userId = randomUUID();
  const now = Date.now();
  const passwordHash = hashPassword(credentials.password);
  const insert = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO users (id, name, email, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(userId, credentials.name, credentials.email, passwordHash, now, now);
    database
      .prepare(
        `INSERT INTO user_roles (id, user_id, role_id, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(randomUUID(), userId, adminRole.id, now);
  });
  insert();
}

function run(): void {
  const credentials = requiredCredentials();
  migrate();
  seed();
  bootstrapAdmin(credentials);
  process.stdout.write(`Admin bootstrap complete for ${credentials.email}.\n`);
}

try {
  run();
} catch (error: unknown) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
