import type { ZodError } from 'zod';

export function zodToErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) errors[path] = [];
    errors[path].push(issue.message);
  }

  return errors;
}

export {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUsersSchema,
  DeleteRolesSchema,
  ChangeProfileSchema,
  CreateRoleSchema,
  UpdateRoleSchema,
} from './schemas';

export type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  CreateUserInput,
  UpdateUserInput,
  DeleteUsersInput,
  DeleteRolesInput,
  ChangeProfileInput,
  CreateRoleInput,
  UpdateRoleInput,
} from './schemas';
