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
    const result = LoginSchema.safeParse({ email: 'user@example.com', password: 'secret123' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }
  });

  it('accepts uppercase email (LoginSchema does not lowercase)', () => {
    const result = LoginSchema.safeParse({ email: 'USER@EXAMPLE.COM', password: 'secret123' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('USER@EXAMPLE.COM');
  });

  it('fails when email is missing', () => {
    const result = LoginSchema.safeParse({ password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('fails when password is empty', () => {
    const result = LoginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('RegisterSchema', () => {
  const valid = { name: 'John Doe', email: 'john@example.com', password: 'password123' };

  it('accepts valid registration data', () => {
    const result = RegisterSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('John Doe');
      expect(result.data.email).toBe('john@example.com');
    }
  });

  it('fails when name is too short', () => {
    const result = RegisterSchema.safeParse({ ...valid, name: 'J' });
    expect(result.success).toBe(false);
  });

  it('fails with invalid email', () => {
    const result = RegisterSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('fails when password is shorter than 8 chars', () => {
    const result = RegisterSchema.safeParse({ ...valid, password: '123' });
    expect(result.success).toBe(false);
  });
});

describe('ChangePasswordSchema', () => {
  it('accepts valid password change', () => {
    const result = ChangePasswordSchema.safeParse({ current_password: 'oldpass', new_password: 'newpass123' });
    expect(result.success).toBe(true);
  });

  it('fails when current_password is empty', () => {
    const result = ChangePasswordSchema.safeParse({ current_password: '', new_password: 'newpass123' });
    expect(result.success).toBe(false);
  });

  it('fails when new_password is too short', () => {
    const result = ChangePasswordSchema.safeParse({ current_password: 'old', new_password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('CreateUserSchema', () => {
  const valid = { name: 'Alice', email: 'alice@example.com' };

  it('accepts minimal valid data', () => {
    const result = CreateUserSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts roles array', () => {
    const result = CreateUserSchema.safeParse({ ...valid, roles: ['admin', 'editor'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roles).toEqual(['admin', 'editor']);
  });
});

describe('UpdateUserSchema', () => {
  it('accepts partial update', () => {
    const result = UpdateUserSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('New Name');
  });

  it('fails when no fields provided', () => {
    const result = UpdateUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('DeleteUsersSchema', () => {
  it('accepts valid UUID array', () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000'];
    const result = DeleteUsersSchema.safeParse({ ids });
    expect(result.success).toBe(true);
  });

  it('fails with empty array', () => {
    const result = DeleteUsersSchema.safeParse({ ids: [] });
    expect(result.success).toBe(false);
  });

  it('fails with invalid UUIDs', () => {
    const result = DeleteUsersSchema.safeParse({ ids: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });
});

describe('ChangeProfileSchema', () => {
  it('accepts valid profile data', () => {
    const result = ChangeProfileSchema.safeParse({ name: 'Bob', email: 'bob@example.com' });
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = ChangeProfileSchema.safeParse({ name: 'Bob', email: 'BOB@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('bob@example.com');
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts valid token and password', () => {
    const result = ResetPasswordSchema.safeParse({ id: 'some-token-123', password: 'newpassword' });
    expect(result.success).toBe(true);
  });

  it('fails with empty token', () => {
    const result = ResetPasswordSchema.safeParse({ id: '', password: 'newpassword' });
    expect(result.success).toBe(false);
  });

  it('fails with short password', () => {
    const result = ResetPasswordSchema.safeParse({ id: 'token', password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('ForgotPasswordSchema', () => {
  it('accepts email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('fails when email not provided', () => {
    const result = ForgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
