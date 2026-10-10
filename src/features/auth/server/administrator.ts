import { randomUUID } from 'node:crypto';
import { findAllRoles, getUsersWithRole } from './access';
import { accountEmailTaken, createAccountWithRoles } from './accounts';
import { hashPassword } from './service';

export interface AdministratorInput {
  name: string;
  email: string;
  password: string;
  /** The account must replace the password at its first sign-in. */
  temporaryPassword: boolean;
}

/** `existing` names the earliest administrator; nothing was written. */
export type AdministratorResult = { status: 'created' | 'existing'; email: string };

/**
 * Gives a fresh installation its first administrator: when no account holds
 * the `admin` role, creates this one with it. An account already using the
 * email is refused rather than promoted, so setup never hands an existing
 * account administrator rights.
 */
export async function ensureAdministrator(input: AdministratorInput): Promise<AdministratorResult> {
  const adminRole = findAllRoles().find((role) => role.slug === 'admin');
  if (!adminRole) throw new Error('No admin role exists; run the reference seed first.');
  const [earliest] = getUsersWithRole(adminRole.id);
  if (earliest) return { status: 'existing', email: earliest.email };
  if (accountEmailTaken(input.email)) {
    throw new Error(`A non-admin account with email "${input.email}" already exists.`);
  }
  createAccountWithRoles(
    {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      mustChangePassword: input.temporaryPassword,
    },
    [adminRole.id],
  );
  return { status: 'created', email: input.email };
}
