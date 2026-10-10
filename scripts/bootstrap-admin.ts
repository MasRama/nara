import { migrate, seed } from '../src/shared/database';
import { ensureAdministrator, registerInputSchema } from '../src/features/auth';

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

/** Accounts and roles are Auth's; the first administrator is made through it. */
export async function bootstrapAdmin(credentials = bootstrapCredentials()): Promise<BootstrapAdminResult> {
  let administrator;
  try {
    administrator = await ensureAdministrator(credentials);
  } catch (error) {
    throw new Error(`Admin bootstrap refused: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (administrator.status === 'existing') {
    return { status: 'skipped', email: administrator.email, temporaryPassword: false };
  }
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
