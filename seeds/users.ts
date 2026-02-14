import { Knex } from "knex";
import Authenticate from "../app/services/Authenticate";
import dayjs from "dayjs";
import { randomUUID } from "crypto";

export async function seed(knex: Knex): Promise<void> {
	// Clean tables in correct order (respecting foreign keys)
	await knex("user_roles").del();
	await knex("role_permissions").del();
	await knex("permissions").del();
	await knex("roles").del();
	await knex("users").del();

	const now = dayjs().valueOf();

	// ==========================================
	// 1. Create Roles
	// ==========================================
	const roles = [
		{
			id: randomUUID(),
			name: "Administrator",
			slug: "admin",
			description: "Full access to all system features",
			created_at: now,
			updated_at: now,
		},
		{
			id: randomUUID(),
			name: "User",
			slug: "user",
			description: "Standard user with limited access",
			created_at: now,
			updated_at: now,
		},
		{
			id: randomUUID(),
			name: "Moderator",
			slug: "moderator",
			description: "Can moderate content and users",
			created_at: now,
			updated_at: now,
		},
	];

	await knex("roles").insert(roles);

	// Get role IDs for later use
	const adminRole = await knex("roles").where("slug", "admin").first();
	const userRole = await knex("roles").where("slug", "user").first();
	const moderatorRole = await knex("roles").where("slug", "moderator").first();

	// ==========================================
	// 2. Create Permissions
	// ==========================================
	const permissions = [
		// User permissions
		{ id: randomUUID(), name: "View Users", slug: "users.view", resource: "users", action: "view", description: "View user list and details", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Create Users", slug: "users.create", resource: "users", action: "create", description: "Create new users", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Edit Users", slug: "users.edit", resource: "users", action: "edit", description: "Edit existing users", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Delete Users", slug: "users.delete", resource: "users", action: "delete", description: "Delete users", created_at: now, updated_at: now },

		// Role permissions
		{ id: randomUUID(), name: "View Roles", slug: "roles.view", resource: "roles", action: "view", description: "View roles list and details", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Create Roles", slug: "roles.create", resource: "roles", action: "create", description: "Create new roles", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Edit Roles", slug: "roles.edit", resource: "roles", action: "edit", description: "Edit existing roles", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Delete Roles", slug: "roles.delete", resource: "roles", action: "delete", description: "Delete roles", created_at: now, updated_at: now },

		// Permission permissions
		{ id: randomUUID(), name: "View Permissions", slug: "permissions.view", resource: "permissions", action: "view", description: "View permissions list", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Assign Permissions", slug: "permissions.assign", resource: "permissions", action: "assign", description: "Assign permissions to roles", created_at: now, updated_at: now },

		// Asset permissions
		{ id: randomUUID(), name: "View Assets", slug: "assets.view", resource: "assets", action: "view", description: "View assets", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Upload Assets", slug: "assets.upload", resource: "assets", action: "upload", description: "Upload new assets", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Delete Assets", slug: "assets.delete", resource: "assets", action: "delete", description: "Delete assets", created_at: now, updated_at: now },

		// Settings permissions
		{ id: randomUUID(), name: "View Settings", slug: "settings.view", resource: "settings", action: "view", description: "View system settings", created_at: now, updated_at: now },
		{ id: randomUUID(), name: "Edit Settings", slug: "settings.edit", resource: "settings", action: "edit", description: "Edit system settings", created_at: now, updated_at: now },
	];

	await knex("permissions").insert(permissions);

	// Get all permissions for role assignment
	const allPermissions = await knex("permissions").select("id", "slug");
	const permissionMap = new Map(allPermissions.map((p) => [p.slug, p.id]));

	// ==========================================
	// 3. Assign Permissions to Roles
	// ==========================================

	// Admin gets all permissions
	const adminPermissions = allPermissions.map((p) => ({
		id: randomUUID(),
		role_id: adminRole.id,
		permission_id: p.id,
		created_at: now,
	}));
	await knex("role_permissions").insert(adminPermissions);

	// Moderator gets user view/edit and asset permissions
	const moderatorPermissionSlugs = [
		"users.view", "users.edit",
		"assets.view", "assets.upload", "assets.delete",
		"settings.view",
	];
	const moderatorPermissions = moderatorPermissionSlugs
		.map((slug) => permissionMap.get(slug))
		.filter((id): id is string => !!id)
		.map((permissionId) => ({
			id: randomUUID(),
			role_id: moderatorRole.id,
			permission_id: permissionId,
			created_at: now,
		}));
	await knex("role_permissions").insert(moderatorPermissions);

	// User gets basic permissions
	const userPermissionSlugs = [
		"assets.view", "assets.upload",
		"settings.view",
	];
	const userPermissions = userPermissionSlugs
		.map((slug) => permissionMap.get(slug))
		.filter((id): id is string => !!id)
		.map((permissionId) => ({
			id: randomUUID(),
			role_id: userRole.id,
			permission_id: permissionId,
			created_at: now,
		}));
	await knex("role_permissions").insert(userPermissions);

	// ==========================================
	// 4. Create Admin User
	// ==========================================
	const password = await Authenticate.hash("nara");
	const adminUserId = randomUUID();

	await knex("users").insert([
		{
			id: adminUserId,
			name: "Nara",
			email: "nara@ramaren.com",
			phone: null,
			avatar: null,
			is_verified: true,
			membership_date: null,
			password: password,
			remember_me_token: null,
			created_at: now,
			updated_at: now,
		},
	]);

	// ==========================================
	// 5. Assign Admin Role to Admin User
	// ==========================================
	await knex("user_roles").insert([
		{
			id: randomUUID(),
			user_id: adminUserId,
			role_id: adminRole.id,
			created_at: now,
		},
	]);
}
