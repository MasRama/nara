<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { createRoleInputSchema } from '../../contract';
import type { PermissionData, RoleData } from '../../contract';
import { createAccessClient } from '../access-client';
import { useAuthSession } from '../session';

// Keep the page on the auth Feature boundary while reusing its own contracts and client.
const authSession = useAuthSession();
const accessClient = createAccessClient();

type FieldErrors = Record<string, string[]>;

const roles = ref<RoleData[]>([]);
const permissionsByResource = ref<Record<string, PermissionData[]>>({});
const isLoading = ref(false);
const loadError = ref('');
const loadForbidden = ref(false);
const actionError = ref('');
const notice = ref('');

const isFormOpen = ref(false);
const isCreating = ref(false);
const editingRole = ref<RoleData | null>(null);
const roleName = ref('');
const roleSlug = ref('');
const roleDescription = ref('');
const selectedPermissions = ref<string[]>([]);
const formError = ref('');
const fieldErrors = ref<FieldErrors>({});
const isSubmitting = ref(false);

const pendingDelete = ref<RoleData | null>(null);
const isDeleting = ref(false);

const canCreate = computed(() => authSession.can('roles.create'));
const canEdit = computed(() => authSession.can('roles.edit'));
const canDelete = computed(() => authSession.can('roles.delete'));
const permissionGroups = computed(() => Object.entries(permissionsByResource.value).sort(([left], [right]) => left.localeCompare(right)));

function mapIssues(issues: Array<{ path: PropertyKey[]; message: string }>): FieldErrors {
  const mapped: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(issue.message);
  }
  return mapped;
}

function fieldError(name: string): string {
  return fieldErrors.value[name]?.join('; ') ?? '';
}

function permissionLabel(slug: string): string {
  return slug;
}

async function loadAccess(): Promise<void> {
  isLoading.value = true;
  loadError.value = '';
  loadForbidden.value = false;
  try {
    const [rolesResponse, permissionsResponse] = await Promise.all([
      accessClient.listRoles(),
      accessClient.listPermissions(),
    ]);

    if (!rolesResponse.success || !rolesResponse.data) {
      loadForbidden.value = !rolesResponse.success && rolesResponse.code === 'FORBIDDEN';
      if (!loadForbidden.value) loadError.value = rolesResponse.message;
      roles.value = [];
    } else {
      roles.value = rolesResponse.data.roles;
    }

    if (permissionsResponse.success && permissionsResponse.data) {
      permissionsByResource.value = permissionsResponse.data;
    } else if (!permissionsResponse.success && permissionsResponse.code !== 'FORBIDDEN') {
      loadError.value ||= permissionsResponse.message;
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Unable to load roles';
  } finally {
    isLoading.value = false;
  }
}

function resetForm(): void {
  editingRole.value = null;
  roleName.value = '';
  roleSlug.value = '';
  roleDescription.value = '';
  selectedPermissions.value = [];
  formError.value = '';
  fieldErrors.value = {};
}

function openCreate(): void {
  resetForm();
  isCreating.value = true;
  isFormOpen.value = true;
  actionError.value = '';
}

function openEdit(role: RoleData): void {
  resetForm();
  editingRole.value = role;
  isCreating.value = false;
  roleName.value = role.name;
  roleSlug.value = role.slug;
  roleDescription.value = role.description ?? '';
  selectedPermissions.value = [...role.permissions];
  isFormOpen.value = true;
  actionError.value = '';
}

function closeForm(): void {
  if (isSubmitting.value) return;
  isFormOpen.value = false;
  resetForm();
}

async function submitRole(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  notice.value = '';
  const payload = {
    name: roleName.value,
    slug: roleSlug.value,
    description: roleDescription.value || null,
    permissions: selectedPermissions.value,
  };
  const parsed = createRoleInputSchema.safeParse(payload);
  if (!parsed.success) {
    fieldErrors.value = mapIssues(parsed.error.issues);
    formError.value = 'Please correct the highlighted fields.';
    return;
  }

  isSubmitting.value = true;
  try {
    const response = isCreating.value
      ? await accessClient.createRole(parsed.data)
      : await accessClient.updateRole(editingRole.value?.id ?? '', parsed.data);
    if (!response.success) {
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }

    isFormOpen.value = false;
    resetForm();
    notice.value = response.message;
    await loadAccess();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to save role';
  } finally {
    isSubmitting.value = false;
  }

}
function requestDelete(role: RoleData): void {
  pendingDelete.value = role;
  actionError.value = '';
  notice.value = '';
}

function cancelDelete(): void {
  if (isDeleting.value) return;
  pendingDelete.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!pendingDelete.value || isDeleting.value) return;

  isDeleting.value = true;
  actionError.value = '';
  try {
    const response = await accessClient.deleteRoles({ ids: [pendingDelete.value.id] });
    if (!response.success) {
      actionError.value = response.message;
      return;
    }
    notice.value = response.message;
    pendingDelete.value = null;
    await loadAccess();
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to delete role';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  void loadAccess();
});
</script>

<template>
  <main class="relative overflow-hidden px-6 py-12 sm:px-10 lg:px-16 lg:py-16" data-testid="roles-page">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] text-foreground opacity-[0.03] [background-size:22px_22px] dark:opacity-[0.05]"></div>

    <section class="relative mx-auto max-w-[1250px]">
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">Access control</p>
            <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Roles</h1>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Define role access and assign the permissions each role carries.
            </p>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <RouterLink to="/dashboard" class="text-muted-foreground transition-colors hover:text-foreground">Dashboard</RouterLink>
            <button
              v-if="canCreate"
              type="button"
              data-testid="create-role"
              class="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              @click="openCreate"
            >
              New role
            </button>
          </div>
        </div>

        <p v-if="loadForbidden" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">You do not have permission to view roles.</p>
        <p v-if="loadError" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ loadError }}</p>
        <p v-if="actionError" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ actionError }}</p>
        <p v-if="notice" role="status" class="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{{ notice }}</p>

        <template v-if="!loadForbidden">
          <section v-if="isFormOpen" class="rounded-2xl border border-primary/30 bg-card p-5 shadow-soft sm:p-6" aria-labelledby="role-form-title">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="font-heading text-xs uppercase tracking-[0.2em] text-primary">Access definition</p>
                <h2 id="role-form-title" class="mt-2 font-heading text-xl font-semibold tracking-tight">{{ isCreating ? 'Create role' : 'Edit role' }}</h2>
              </div>
              <button type="button" class="text-sm text-muted-foreground hover:text-foreground" :disabled="isSubmitting" @click="closeForm">Close</button>
            </div>

            <p v-if="formError" role="alert" class="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ formError }}</p>
            <form class="mt-5 grid gap-5 md:grid-cols-2" data-testid="role-form" @submit.prevent="submitRole">
              <label class="grid gap-2 text-sm font-medium" for="role-name">
                Name
                <input id="role-name" v-model="roleName" type="text" class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary" />
                <span v-if="fieldError('name')" class="text-xs font-normal text-destructive">{{ fieldError('name') }}</span>
              </label>
              <label class="grid gap-2 text-sm font-medium" for="role-slug">
                Slug
                <input id="role-slug" v-model="roleSlug" type="text" class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary" />
                <span v-if="fieldError('slug')" class="text-xs font-normal text-destructive">{{ fieldError('slug') }}</span>
              </label>
              <label class="grid gap-2 text-sm font-medium md:col-span-2" for="role-description">
                Description
                <textarea id="role-description" v-model="roleDescription" rows="3" class="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"></textarea>
                <span v-if="fieldError('description')" class="text-xs font-normal text-destructive">{{ fieldError('description') }}</span>
              </label>

              <fieldset class="grid gap-4 md:col-span-2">
                <legend class="text-sm font-medium">Permissions</legend>
                <p class="text-xs text-muted-foreground">Permissions are grouped using the server-provided resource metadata.</p>
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <fieldset v-for="[resource, resourcePermissions] in permissionGroups" :key="resource" class="rounded-xl border border-border p-4">
                    <legend class="px-1 text-sm font-medium capitalize">{{ resource }}</legend>
                    <label v-for="permission in resourcePermissions" :key="permission.id" class="mt-3 flex items-start gap-2 text-sm font-normal first:mt-2">
                      <input v-model="selectedPermissions" type="checkbox" :value="permission.slug" :data-permission-slug="permission.slug" />
                      <span>
                        <span class="block">{{ permission.name }}</span>
                        <span class="block text-xs text-muted-foreground">{{ permissionLabel(permission.slug) }}</span>
                      </span>
                    </label>
                  </fieldset>
                </div>
              </fieldset>

              <div class="flex items-center gap-3 md:col-span-2">
                <button type="submit" :disabled="isSubmitting" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">{{ isSubmitting ? 'Saving…' : isCreating ? 'Create role' : 'Save changes' }}</button>
                <button type="button" :disabled="isSubmitting" class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground" @click="closeForm">Cancel</button>
              </div>
            </form>
          </section>

          <p v-if="isLoading" role="status" class="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Loading roles…</p>
          <p v-else-if="roles.length === 0" class="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No roles are available.</p>

          <section v-else class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft" aria-labelledby="role-list-title">
            <div class="border-b border-border px-5 py-4 sm:px-6">
              <h2 id="role-list-title" class="font-heading text-xl font-semibold tracking-tight">Role directory</h2>
              <p class="mt-1 text-sm text-muted-foreground">Permission assignments and user counts come from the RBAC API.</p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[900px] text-left text-sm" data-testid="role-list">
                <thead class="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-5 py-3 font-medium sm:px-6">Role</th>
                    <th scope="col" class="px-5 py-3 font-medium sm:px-6">Permissions</th>
                    <th scope="col" class="px-5 py-3 font-medium sm:px-6">Users</th>
                    <th scope="col" class="px-5 py-3 text-right font-medium sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr v-for="role in roles" :key="role.id" :data-role-id="role.id">
                    <td class="px-5 py-4 sm:px-6">
                      <span class="block font-medium">{{ role.name }}</span>
                      <span class="block text-xs text-muted-foreground">{{ role.slug }}</span>
                      <span v-if="role.description" class="mt-1 block max-w-xs text-xs text-muted-foreground">{{ role.description }}</span>
                    </td>
                    <td class="px-5 py-4 sm:px-6">
                      <div class="flex max-w-md flex-wrap gap-1.5">
                        <span v-for="permission in role.permissions" :key="permission" class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{{ permission }}</span>
                        <span v-if="role.permissions.length === 0" class="text-muted-foreground">No permissions</span>
                      </div>
                    </td>
                    <td class="px-5 py-4 sm:px-6"><span data-testid="role-user-count">{{ role.userCount }}</span> user{{ role.userCount === 1 ? '' : 's' }}</td>
                    <td class="px-5 py-4 text-right sm:px-6">
                      <div class="flex justify-end gap-2">
                        <button v-if="canEdit" type="button" :data-testid="`edit-role-${role.id}`" class="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary" @click="openEdit(role)">Edit</button>
                        <button v-if="canDelete" type="button" :data-testid="`delete-role-${role.id}`" class="rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10" @click="requestDelete(role)">Delete</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <section v-if="pendingDelete" class="rounded-xl border border-destructive/30 bg-destructive/10 p-5" role="dialog" aria-labelledby="delete-role-title">
          <h2 id="delete-role-title" class="font-heading font-semibold">Delete {{ pendingDelete.name }}?</h2>
          <p class="mt-2 text-sm text-muted-foreground">Protected roles cannot be deleted by the browser; the server remains authoritative.</p>
          <div class="mt-4 flex gap-3">
            <button type="button" data-testid="confirm-role-delete" :disabled="isDeleting" class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60" @click="confirmDelete">{{ isDeleting ? 'Deleting…' : 'Delete role' }}</button>
            <button type="button" data-testid="cancel-role-delete" :disabled="isDeleting" class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground" @click="cancelDelete">Cancel</button>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
