INSERT INTO permissions (id, name, slug, resource, action, description, created_at, updated_at)
VALUES (
  'nara-permission-users-reset-password',
  'Reset User Passwords',
  'users.reset-password',
  'users',
  'reset-password',
  'Reset another account password and revoke its active sessions',
  1704067200000,
  1704067200000
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'nara-role-permission:admin:users.reset-password',
  roles.id,
  permissions.id,
  1704067200000
FROM roles
JOIN permissions ON permissions.slug = 'users.reset-password'
WHERE roles.slug = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM permissions WHERE slug IN ('settings.view', 'settings.edit');

DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE slug = 'user')
  AND permission_id IN (SELECT id FROM permissions WHERE slug = 'users.view');
