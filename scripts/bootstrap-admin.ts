import { randomUUID } from 'node:crypto';
import { getDatabase, migrate, seed } from '../src/shared/database';
import { hashPassword, registerInputSchema } from '../src/features/auth';

export const DEFAULT_ADMIN_NAME = 'Admin';
export const DEFAULT_ADMIN_EMAIL = 'admin@nara.local';
export const DEFAULT_ADMIN_PASSWORD = 'admin12345';

export interface BootstrapAdminCredentials {
  name: string;
  email: string;
  password: string;
  temporaryPassword: boolean;
}

export function bootstrapCredentials(): BootstrapAdminCredentials {
  const name = process.env.NARA_ADMIN_NAME?.trim() || DEFAULT_ADMIN_NAME;
  const email = process.env.NARA_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
  const providedPassword = process.env.NARA_ADMIN_PASSWORD;
  const password = providedPassword ?? DEFAULT_ADMIN_PASSWORD;

  const parsed = registerInputSchema.safeParse({ name, email, password });
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '_root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Admin bootstrap credentials are invalid:\n${details}`);
  }

  return { ...parsed.data, temporaryPassword: providedPassword === undefined };
}

export interface BootstrapAdminResult {
  status: 'created' | 'skipped';
  email: string;
  temporaryPassword: boolean;
  password?: string;
}

export async function bootstrapAdmin(credentials = bootstrapCredentials()): Promise<BootstrapAdminResult> {
  const database = getDatabase();
  const existingAdmin = database
    .prepare(
      `SELECT users.email
       FROM users
       INNER JOIN user_roles ON user_roles.user_id = users.id
       INNER JOIN roles ON roles.id = user_roles.role_id
       WHERE roles.slug = 'admin'
       ORDER BY users.created_at ASC
       LIMIT 1`,
    )
    .get() as { email: string } | undefined;
  if (existingAdmin) {
    return { status: 'skipped', email: existingAdmin.email, temporaryPassword: false };
  }

  const existing = database
    .prepare('SELECT id FROM users WHERE lower(email) = ?')
    .get(credentials.email) as { id: string } | undefined;
  if (existing) {
    throw new Error(`Admin bootstrap refused: a non-admin user with email "${credentials.email}" already exists.`);
  }

  const adminRole = database
    .prepare('SELECT id FROM roles WHERE slug = ?')
    .get('admin') as { id: string } | undefined;
  if (!adminRole) {
    throw new Error('Admin bootstrap could not find the admin role after reference seeding.');
  }

  const userId = randomUUID();
  const now = Date.now();
  const passwordHash = await hashPassword(credentials.password);
  const insert = database.transaction(() => {
    database
      .prepare(
        `INSERT INTO users (id, name, email, password, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        credentials.name,
        credentials.email,
        passwordHash,
        credentials.temporaryPassword ? 1 : 0,
        now,
        now,
      );
    database
      .prepare(
        `INSERT INTO user_roles (id, user_id, role_id, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(randomUUID(), userId, adminRole.id, now);
  });
  insert();
  return {
    status: 'created',
    email: credentials.email,
    temporaryPassword: credentials.temporaryPassword,
    ...(credentials.temporaryPassword ? { password: credentials.password } : {}),
  };
}

export async function runBootstrapAdmin(): Promise<BootstrapAdminResult> {
  migrate();
  seed();
  return bootstrapAdmin();
}

if (require.main === module) {
  void runBootstrapAdmin()
    .then((result) => {
      if (result.status === 'skipped') {
        process.stdout.write(`Admin bootstrap skipped; admin already exists: ${result.email}.\n`);
        return;
      }
      process.stdout.write(`Admin bootstrap complete for ${result.email}.\n`);
      if (result.temporaryPassword && result.password) {
        process.stdout.write(`Temporary password: ${result.password}\nChange it after signing in.\n`);
      }
    })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
