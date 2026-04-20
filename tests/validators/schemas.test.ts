import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  RegisterSchema,
  ChangePasswordSchema,
  CreateUserSchema,
  UpdateUserSchema,
  DeleteUsersSchema,
  ChangeProfileSchema,
  ResetPasswordSchema,
  ForgotPasswordSchema,
} from '../../app/validators/schemas';

describe('LoginSchema', () => {
  it('accepts valid email + password', () => {
    const result = LoginSchema({ email: 'user@example.com', password: 'secret123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('lowercases email', () => {
    const result = LoginSchema({ email: 'USER@EXAMPLE.COM', password: 'secret123' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('user@example.com');
  });

  it('accepts valid phone + password', () => {
    const result = LoginSchema({ phone: '08123456789', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('fails when no email and no phone', () => {
    const result = LoginSchema({ password: 'secret' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors._root).toBeDefined();
  });

  it('fails when password is empty', () => {
    const result = LoginSchema({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.password).toBeDefined();
  });

  it('fails when data is not an object', () => {
    const result = LoginSchema('invalid');
    expect(result.success).toBe(false);
  });
});

describe('RegisterSchema', () => {
  const valid = { name: 'John Doe', email: 'john@example.com', password: 'password123' };

  it('accepts valid registration data', () => {
    const result = RegisterSchema(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('John Doe');
      expect(result.data.email).toBe('john@example.com');
    }
  });

  it('fails when name is too short', () => {
    const result = RegisterSchema({ ...valid, name: 'J' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.name).toBeDefined();
  });

  it('fails with invalid email', () => {
    const result = RegisterSchema({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.email).toBeDefined();
  });

  it('fails when password is shorter than 8 chars', () => {
    const result = RegisterSchema({ ...valid, password: '123' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.password).toBeDefined();
  });

  it('accepts optional phone', () => {
    const result = RegisterSchema({ ...valid, phone: '08123456789' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid phone when provided', () => {
    const result = RegisterSchema({ ...valid, phone: 'abc' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.phone).toBeDefined();
  });
});

describe('ChangePasswordSchema', () => {
  it('accepts valid password change', () => {
    const result = ChangePasswordSchema({ current_password: 'oldpass', new_password: 'newpass123' });
    expect(result.success).toBe(true);
  });

  it('fails when current_password is empty', () => {
    const result = ChangePasswordSchema({ current_password: '', new_password: 'newpass123' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.current_password).toBeDefined();
  });

  it('fails when new_password is too short', () => {
    const result = ChangePasswordSchema({ current_password: 'old', new_password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.new_password).toBeDefined();
  });
});

describe('CreateUserSchema', () => {
  const valid = { name: 'Alice', email: 'alice@example.com' };

  it('accepts minimal valid data', () => {
    const result = CreateUserSchema(valid);
    expect(result.success).toBe(true);
  });

  it('accepts roles array', () => {
    const result = CreateUserSchema({ ...valid, roles: ['admin', 'editor'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roles).toEqual(['admin', 'editor']);
  });

  it('fails when roles is not an array', () => {
    const result = CreateUserSchema({ ...valid, roles: 'admin' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.roles).toBeDefined();
  });

  it('defaults is_verified to false', () => {
    const result = CreateUserSchema(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_verified).toBe(false);
  });
});

describe('UpdateUserSchema', () => {
  it('accepts partial update', () => {
    const result = UpdateUserSchema({ name: 'New Name' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('New Name');
  });

  it('fails when no fields provided', () => {
    const result = UpdateUserSchema({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors._root).toBeDefined();
  });
});

describe('DeleteUsersSchema', () => {
  it('accepts valid UUID array', () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000'];
    const result = DeleteUsersSchema({ ids });
    expect(result.success).toBe(true);
  });

  it('fails with empty array', () => {
    const result = DeleteUsersSchema({ ids: [] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.ids).toBeDefined();
  });

  it('fails with invalid UUIDs', () => {
    const result = DeleteUsersSchema({ ids: ['not-a-uuid'] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.ids).toBeDefined();
  });
});

describe('ChangeProfileSchema', () => {
  it('accepts valid profile data', () => {
    const result = ChangeProfileSchema({ name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
  });

  it('trims name and lowercases email', () => {
    const result = ChangeProfileSchema({ name: '  Bob  ', email: 'BOB@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Bob');
      expect(result.data.email).toBe('bob@example.com');
    }
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts valid token and password', () => {
    const result = ResetPasswordSchema({ id: 'some-token-123', password: 'newpassword' });
    expect(result.success).toBe(true);
  });

  it('fails with empty token', () => {
    const result = ResetPasswordSchema({ id: '', password: 'newpassword' });
    expect(result.success).toBe(false);
  });

  it('fails with short password', () => {
    const result = ResetPasswordSchema({ id: 'token', password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('ForgotPasswordSchema', () => {
  it('accepts email', () => {
    const result = ForgotPasswordSchema({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('accepts phone', () => {
    const result = ForgotPasswordSchema({ phone: '08123456789' });
    expect(result.success).toBe(true);
  });

  it('fails when neither email nor phone provided', () => {
    const result = ForgotPasswordSchema({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors._root).toBeDefined();
  });
});
