import type { PermissionDeclaration } from './permissions';

/**
 * What an account must hold to do something, as data rather than a check: a
 * declared permission, or being an administrator. The server's guards enforce
 * it, the browser hides what the server would refuse, and the authorization
 * matrix tests it, all from the same value. Administrators satisfy every rule;
 * whichever Feature owns access control decides who they are.
 */
export type AccessRule = { readonly permission: string } | { readonly administrator: true };

export const ADMINISTRATOR: AccessRule = Object.freeze({ administrator: true as const });

/**
 * The rule for each permission a resource declares, as `<resource>.<action>`;
 * an action the declarations do not list does not compile.
 */
export function permissionRules<const Declared extends readonly PermissionDeclaration[]>(
  resource: string,
  _declarations: Declared,
): (action: Declared[number]['action']) => AccessRule {
  return (action) => ({ permission: `${resource}.${action}` });
}
