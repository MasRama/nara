import { describe, expect, it } from 'vitest';
import { USERS_PERMISSIONS } from '..';

describe('Users permissions', () => {
  it('declares each Users action once', () => {
    expect(USERS_PERMISSIONS.map((permission) => permission.action)).toEqual([
      'view',
      'create',
      'edit',
      'reset-password',
      'delete',
    ]);
  });
});
