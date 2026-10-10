INSERT INTO permissions (id, name, slug, resource, action, description, created_at, updated_at)
VALUES (
  'nara-permission-activity-view',
  'View Activity',
  'activity.view',
  'activity',
  'view',
  'View application authentication and administration activity history',
  1704067200000,
  1704067200000
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT
  'nara-role-permission:admin:activity.view',
  roles.id,
  permissions.id,
  1704067200000
FROM roles
JOIN permissions ON permissions.slug = 'activity.view'
WHERE roles.slug = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
