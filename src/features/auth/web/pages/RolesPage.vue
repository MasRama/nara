<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { AUTH_ROLES_CHANGED_EVENT, AUTH_ROLES_EDITING_EVENT, createRoleInputSchema, STALE_REVISION } from '../../contract';
import type { Editor, PermissionData, RoleData, StaleRoleError, UpdateRoleResponse } from '../../contract';
import { createAccessClient } from '../access-client';
import { useAuthSession } from '../session';
import { keepEditing, mergeEdit, onServerEvent, sameValue } from '../../../../shared/realtime/browser';

// Keep the page on the auth Feature boundary while reusing its own contracts and client.
const authSession = useAuthSession();
const accessClient = createAccessClient();

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
const fieldErrors = ref<Record<string, string[]>>({});
const isSubmitting = ref(false);

const pendingDelete = ref<RoleData | null>(null);
const isDeleting = ref(false);

type RoleFields = { name: string; slug: string; description: string; permissions: string[] };
const FIELD_LABELS: Record<keyof RoleFields, string> = {
  name: 'Name',
  slug: 'Slug',
  description: 'Description',
  permissions: 'Permissions',
};

// The open edit form tracks the saved version it builds on, so changes saved
// elsewhere merge in instead of being overwritten on save.
const editBase = ref<RoleFields | null>(null);
const editRevision = ref(0);
const conflicts = ref<Array<keyof RoleFields>>([]);
const mergeNotice = ref('');
const editingGone = ref(false);
const editors = ref<Record<string, Editor[]>>({});
let stopEditing: (() => void) | undefined;

const canCreate = computed(() => authSession.can('roles.create'));
const canEdit = computed(() => authSession.can('roles.edit'));
const canDelete = computed(() => authSession.can('roles.delete'));
const formEditors = computed(() => (editingRole.value ? othersEditing(editingRole.value.id) : []));
const permissionGroups = computed(() => Object.entries(permissionsByResource.value).sort(([left], [right]) => left.localeCompare(right)));

function mapIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};
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

function othersEditing(roleId: string): Editor[] {
  return (editors.value[roleId] ?? []).filter((editor) => editor.id !== authSession.user.value?.id);
}

function editorNames(list: Editor[]): string {
  return list.map((editor) => editor.name).join(', ');
}

function roleFields(role: RoleData): RoleFields {
  return { name: role.name, slug: role.slug, description: role.description ?? '', permissions: [...role.permissions] };
}

function formFields(): RoleFields {
  return {
    name: roleName.value,
    slug: roleSlug.value,
    description: roleDescription.value,
    permissions: [...selectedPermissions.value],
  };
}

function setFormFields(fields: RoleFields): void {
  roleName.value = fields.name;
  roleSlug.value = fields.slug;
  roleDescription.value = fields.description;
  selectedPermissions.value = [...fields.permissions];
}

function displayValue(field: keyof RoleFields, value: RoleFields[keyof RoleFields] | undefined): string {
  if (field === 'permissions') return Array.isArray(value) && value.length > 0 ? value.join(', ') : 'None';
  return typeof value === 'string' && value !== '' ? value : 'Empty';
}

function isStale(response: UpdateRoleResponse): response is StaleRoleError {
  return !response.success && response.code === STALE_REVISION && 'current' in response;
}

/**
 * Folds a newer saved version of the open role into the form. Fields you have
 * not touched follow it; fields you both changed are listed as conflicts until
 * you pick a side. Conflicts still open stay listed unless the values now agree.
 */
function followSaved(role: RoleData): void {
  if (!editBase.value) return;
  const theirs = roleFields(role);
  const result = mergeEdit(editBase.value, formFields(), theirs);
  setFormFields(result.merged);
  const open = new Set([...conflicts.value, ...result.conflicts]);
  conflicts.value = [...open].filter((field) => !sameValue(result.merged[field], theirs[field]));
  editBase.value = theirs;
  editRevision.value = role.revision;
  editingRole.value = role;
  if (result.adopted.length > 0) {
    mergeNotice.value = `Updated with changes saved elsewhere: ${result.adopted.map((field) => FIELD_LABELS[field]).join(', ')}.`;
  }
}

function useTheirs(field: keyof RoleFields): void {
  if (!editBase.value) return;
  setFormFields({ ...formFields(), [field]: editBase.value[field] });
  conflicts.value = conflicts.value.filter((open) => open !== field);
}

function keepMine(field: keyof RoleFields): void {
  conflicts.value = conflicts.value.filter((open) => open !== field);
}

function humanize(value: string): string {
  const words = value.replace(/[-_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function resourceLabel(resource: string): string {
  return humanize(resource);
}

interface RolePermissionGroup {
  resource: string;
  label: string;
  actions: string[];
  full: boolean;
}

function rolePermissionGroups(role: RoleData): RolePermissionGroup[] {
  const grouped = new Map<string, string[]>();
  for (const slug of role.permissions) {
    const dot = slug.indexOf('.');
    const resource = dot === -1 ? slug : slug.slice(0, dot);
    const slugs = grouped.get(resource) ?? [];
    slugs.push(slug);
    grouped.set(resource, slugs);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([resource, slugs]) => {
      const catalog = (permissionsByResource.value[resource] ?? []).map((permission) => permission.slug);
      const rank = (slug: string) => (catalog.includes(slug) ? catalog.indexOf(slug) : catalog.length);
      const actions = [...slugs]
        .sort((left, right) => rank(left) - rank(right))
        .map((slug) => {
          const action = slug.slice(slug.indexOf('.') + 1);
          return humanize(action);
        });
      return { resource, label: resourceLabel(resource), actions, full: catalog.length > 0 && catalog.every((slug) => slugs.includes(slug)) };
    });
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
      if (!loadError.value) loadError.value = permissionsResponse.message;
    }
  } catch (error) {
    console.error(error);
    loadError.value = 'Unable to load roles';
  } finally {
    isLoading.value = false;
  }
}

// Roles changed elsewhere: refresh the list in place and fold a newer version
// of the role being edited into its form.
async function followRoleChanges(): Promise<void> {
  try {
    const response = await accessClient.listRoles();
    if (!response.success || !response.data) return;
    roles.value = response.data.roles;
    const open = editingRole.value;
    if (!open || !isFormOpen.value || isSubmitting.value) return;
    const saved = response.data.roles.find((role) => role.id === open.id);
    if (!saved) editingGone.value = true;
    else if (saved.revision > editRevision.value) followSaved(saved);
  } catch (error) {
    console.error(error);
  }
}

async function loadEditors(): Promise<void> {
  try {
    const response = await accessClient.listEditing();
    if (response.success) editors.value = response.data.editing;
  } catch (error) {
    console.error(error);
  }
}

function resetForm(): void {
  stopEditing?.();
  stopEditing = undefined;
  editBase.value = null;
  editRevision.value = 0;
  conflicts.value = [];
  mergeNotice.value = '';
  editingGone.value = false;
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
  editBase.value = roleFields(role);
  editRevision.value = role.revision;
  stopEditing = keepEditing(role.id, accessClient);
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
  if (!isCreating.value && (conflicts.value.length > 0 || editingGone.value)) {
    formError.value = editingGone.value
      ? 'This role no longer exists.'
      : 'Choose which version to keep for each field saved elsewhere.';
    return;
  }
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
  const creating = isCreating.value;
  try {
    const response = creating
      ? await accessClient.createRole(parsed.data)
      : await accessClient.updateRole(editingRole.value?.id ?? '', { ...parsed.data, revision: editRevision.value });
    if (!response.success) {
      if (isStale(response)) {
        followSaved(response.current);
        formError.value =
          conflicts.value.length > 0
            ? 'Someone saved this role while you were editing. Choose which version to keep below.'
            : 'Someone saved this role while you were editing. Their changes are merged in; review and save again.';
        return;
      }
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }

    isFormOpen.value = false;
    resetForm();
    notice.value = (creating ? 'Role created' : 'Role updated');
    await loadAccess();
  } catch (error) {
    console.error(error);
    formError.value = 'Unable to save role';
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
      // PROTECTED_ROLE also answers role edits; this is the delete wording.
      actionError.value = response.message;
      return;
    }
    notice.value = 'Roles deleted';
    pendingDelete.value = null;
    await loadAccess();
  } catch (error) {
    console.error(error);
    actionError.value = 'Unable to delete role';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  void loadAccess();
  void loadEditors();
});
onUnmounted(onServerEvent(AUTH_ROLES_CHANGED_EVENT, () => void followRoleChanges()));
onUnmounted(onServerEvent(AUTH_ROLES_EDITING_EVENT, () => void loadEditors()));
onUnmounted(() => stopEditing?.());
</script>

<template>
  <main class="nara-page" data-testid="roles-page">
    <section class="nara-page-inner">
      <header class="roles-hero">
        <div class="min-w-0">
          <h1 class="nara-page-title">Roles<span class="nara-page-title-accent">.</span></h1>
          <p class="nara-page-lede">Define role access and assign the permissions each role carries.</p>
        </div>
        <div class="flex items-center gap-3">
          <button v-if="canCreate" type="button" data-testid="create-role" class="roles-primary" @click="openCreate">
            <span class="roles-primary-plus" aria-hidden="true">+</span>
            New role
          </button>
        </div>
      </header>

      <div class="roles-stack nara-page-body">
        <p v-if="loadForbidden" role="alert" class="roles-alert roles-alert--error">You do not have permission to view roles.</p>
        <p v-if="loadError" role="alert" class="roles-alert roles-alert--error">{{ loadError }}</p>
        <p v-if="actionError" role="alert" class="roles-alert roles-alert--error">{{ actionError }}</p>
        <p v-if="notice" role="status" class="roles-alert roles-alert--ok"><span class="roles-live-dot"></span>{{ notice }}</p>

        <section v-if="pendingDelete" class="roles-danger" role="dialog" aria-labelledby="delete-role-title">
          <div class="min-w-0">
            <h2 id="delete-role-title" class="font-heading text-lg font-extrabold tracking-[-0.03em]">Delete {{ pendingDelete.name }}?</h2>
            <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">Protected roles cannot be deleted by the browser; the server remains authoritative.</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button type="button" data-testid="cancel-role-delete" :disabled="isDeleting" class="roles-btn" @click="cancelDelete">Cancel</button>
            <button type="button" data-testid="confirm-role-delete" :disabled="isDeleting" class="roles-btn roles-btn--danger-solid" @click="confirmDelete">{{ isDeleting ? 'Deleting…' : 'Delete role' }}</button>
          </div>
        </section>

        <template v-if="!loadForbidden">
          <section v-if="isFormOpen" class="roles-form" aria-labelledby="role-form-title">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                <span class="roles-badge roles-badge--lg" aria-hidden="true">{{ isCreating ? '+' : (editingRole?.name ?? '').slice(0, 2).toUpperCase() }}</span>
                <div class="min-w-0">
                  <h2 id="role-form-title" class="font-heading text-xl font-extrabold tracking-[-0.04em]">{{ isCreating ? 'Create role' : 'Edit role' }}</h2>
                  <p class="mt-0.5 text-sm text-muted-foreground"><span class="roles-mono">{{ selectedPermissions.length }}</span> {{ selectedPermissions.length === 1 ? 'permission selected' : 'permissions selected' }}</p>
                </div>
              </div>
              <button type="button" class="roles-close" aria-label="Close" :disabled="isSubmitting" @click="closeForm">×</button>
            </div>

            <p v-if="formError" role="alert" class="roles-alert roles-alert--error mt-6">{{ formError }}</p>
            <p v-if="formEditors.length" role="status" class="roles-alert roles-alert--live mt-6" data-testid="role-editors">
              <span class="roles-live-dot"></span>{{ editorNames(formEditors) }} {{ formEditors.length === 1 ? 'is' : 'are' }} also editing this role.
            </p>
            <p v-if="mergeNotice" role="status" class="roles-alert roles-alert--ok mt-6" data-testid="role-merge-notice">{{ mergeNotice }}</p>
            <p v-if="editingGone" role="alert" class="roles-alert roles-alert--error mt-6" data-testid="role-gone">This role was deleted while you were editing it.</p>
            <section v-if="conflicts.length" class="roles-conflicts mt-6" data-testid="role-conflicts" aria-labelledby="role-conflicts-title">
              <h3 id="role-conflicts-title" class="roles-conflicts-title">Saved elsewhere while you were editing</h3>
              <p class="roles-hint mt-1">You and someone else both changed these fields. Choose which version to keep.</p>
              <ul class="mt-3 grid gap-2">
                <li v-for="field in conflicts" :key="field" class="roles-conflict" :data-conflict-field="field">
                  <span class="roles-conflict-label">{{ FIELD_LABELS[field] }}</span>
                  <span class="roles-conflict-values">
                    <span>Theirs: <strong>{{ displayValue(field, editBase?.[field]) }}</strong></span>
                    <span>Yours: <strong>{{ displayValue(field, formFields()[field]) }}</strong></span>
                  </span>
                  <span class="flex gap-2">
                    <button type="button" class="roles-btn roles-btn--sm" :data-testid="`use-theirs-${field}`" @click="useTheirs(field)">Use theirs</button>
                    <button type="button" class="roles-btn roles-btn--sm" :data-testid="`keep-mine-${field}`" @click="keepMine(field)">Keep mine</button>
                  </span>
                </li>
              </ul>
            </section>
            <form class="mt-6 grid gap-5 md:grid-cols-2" data-testid="role-form" @submit.prevent="submitRole">
              <label class="roles-field" for="role-name">
                Name
                <input id="role-name" v-model="roleName" type="text" class="roles-input" />
                <span v-if="fieldError('name')" class="roles-error">{{ fieldError('name') }}</span>
              </label>
              <label class="roles-field" for="role-slug">
                Slug
                <input id="role-slug" v-model="roleSlug" type="text" class="roles-input roles-mono" />
                <span v-if="fieldError('slug')" class="roles-error">{{ fieldError('slug') }}</span>
              </label>
              <label class="roles-field md:col-span-2" for="role-description">
                Description
                <textarea id="role-description" v-model="roleDescription" rows="3" class="roles-input roles-textarea"></textarea>
                <span v-if="fieldError('description')" class="roles-error">{{ fieldError('description') }}</span>
              </label>

              <fieldset class="md:col-span-2">
                <legend class="roles-field-label">Permissions</legend>
                <p class="roles-hint mt-1">Choose what members of this role can see and do.</p>
                <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <fieldset v-for="[resource, resourcePermissions] in permissionGroups" :key="resource" class="roles-group">
                    <legend class="sr-only">{{ resourceLabel(resource) }}</legend>
                    <div class="roles-group-head" aria-hidden="true">
                      <span>{{ resourceLabel(resource) }}</span>
                      <span class="roles-group-count">{{ resourcePermissions.filter((p) => selectedPermissions.includes(p.slug)).length }}/{{ resourcePermissions.length }}</span>
                    </div>
                    <label v-for="permission in resourcePermissions" :key="permission.id" class="roles-perm">
                      <input v-model="selectedPermissions" type="checkbox" :value="permission.slug" :data-permission-slug="permission.slug" />
                      <span class="min-w-0">
                        <span class="block font-semibold">{{ permission.name }}</span>
                        <span v-if="permission.description" class="block text-[12px] font-normal leading-snug text-muted-foreground">{{ permission.description }}</span>
                      </span>
                    </label>
                  </fieldset>
                </div>
              </fieldset>

              <div class="flex items-center gap-3 border-t border-border pt-5 md:col-span-2">
                <button type="submit" :disabled="isSubmitting || (!isCreating && (conflicts.length > 0 || editingGone))" class="roles-primary roles-primary--plain">{{ isSubmitting ? 'Saving…' : isCreating ? 'Create role' : 'Save changes' }}</button>
                <button type="button" :disabled="isSubmitting" class="roles-ghost" @click="closeForm">Cancel</button>
              </div>
            </form>
          </section>

          <section class="roles-window" aria-labelledby="role-list-title">
            <div class="roles-window-bar">
              <span class="roles-dots" aria-hidden="true"><span></span><span></span><span></span></span>
              <h2 id="role-list-title" class="roles-window-title">Role directory</h2>
              <span class="roles-count">{{ roles.length }} {{ roles.length === 1 ? 'role' : 'roles' }}</span>
            </div>

            <p v-if="isLoading" role="status" class="roles-empty">Loading roles…</p>
            <p v-else-if="roles.length === 0" class="roles-empty">No roles are available.</p>

            <div v-else class="overflow-x-auto">
              <table class="roles-table" data-testid="role-list">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Permissions</th>
                    <th scope="col">Users</th>
                    <th scope="col" class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="role in roles" :key="role.id" :data-role-id="role.id">
                    <td>
                      <div class="flex items-start gap-3.5">
                        <span :class="['roles-badge', { 'roles-badge--admin': role.slug === 'admin' }]" aria-hidden="true">{{ role.name.slice(0, 2).toUpperCase() }}</span>
                        <span class="min-w-0">
                          <span class="flex items-center gap-2">
                            <span class="font-heading font-bold tracking-[-0.02em]">{{ role.name }}</span>
                            <span v-if="role.slug === 'admin'" class="roles-protected">Protected</span>
                          </span>
                          <span class="roles-mono block text-[11.5px] text-muted-foreground">{{ role.slug }}</span>
                          <span v-if="othersEditing(role.id).length" class="roles-editing" data-testid="role-editing"><span class="roles-live-dot"></span>{{ editorNames(othersEditing(role.id)) }} editing</span>
                          <span v-if="role.description" class="mt-1.5 block max-w-xs text-[13px] leading-relaxed text-muted-foreground">{{ role.description }}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <ul v-if="role.permissions.length" class="roles-perm-list">
                        <li v-for="group in rolePermissionGroups(role)" :key="group.resource">
                          <span class="roles-perm-resource">{{ group.label }}</span>
                          <span v-if="group.full" class="roles-perm-full">Full access</span>
                          <span v-else class="roles-perm-actions">{{ group.actions.join(', ') }}</span>
                        </li>
                      </ul>
                      <span v-else class="text-[13px] text-muted-foreground">No permissions</span>
                    </td>
                    <td>
                      <span class="roles-users"><span data-testid="role-user-count">{{ role.userCount }}</span> {{ role.userCount === 1 ? 'user' : 'users' }}</span>
                    </td>
                    <td class="text-right">
                      <div class="flex justify-end gap-2">
                        <button v-if="canEdit && role.slug !== 'admin'" type="button" :data-testid="`edit-role-${role.id}`" class="roles-btn roles-btn--sm" @click="openEdit(role)">Edit</button>
                        <button v-if="canDelete && role.slug !== 'admin'" type="button" :data-testid="`delete-role-${role.id}`" class="roles-btn roles-btn--sm roles-btn--danger" @click="requestDelete(role)">Delete</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
.roles-stack { display: flex; flex-direction: column; gap: 20px; }
.roles-mono { font-family: var(--nara-mono); }

.roles-hero { display: flex; flex-direction: column; gap: 28px; }
@media (min-width: 640px) { .roles-hero { flex-direction: row; align-items: flex-end; justify-content: space-between; } }

/* Buttons */
.roles-primary { display: inline-flex; height: 44px; align-items: center; gap: 10px; padding: 0 18px 0 8px; border-radius: 13px; background: var(--nara-ink-raised); color: var(--nara-ink-fg); font-size: 14px; font-weight: 700; box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line), var(--nara-shadow); transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
.roles-primary--plain { padding: 0 20px; }
.roles-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 60%, transparent), var(--nara-shadow); }
.roles-primary:disabled { cursor: not-allowed; opacity: 0.5; }
.roles-primary-plus { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--nara-ink-accent) 16%, transparent); color: var(--nara-ink-accent); font-size: 18px; font-weight: 600; line-height: 1; }
.roles-ghost { display: inline-flex; height: 44px; align-items: center; padding: 0 14px; border-radius: 13px; color: var(--muted-foreground); font-size: 14px; font-weight: 600; transition: color 0.15s ease, background-color 0.15s ease; }
.roles-ghost:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); color: var(--foreground); }
.roles-btn { display: inline-flex; height: 40px; align-items: center; justify-content: center; padding: 0 16px; border: 1px solid var(--border); border-radius: 11px; background: var(--card); font-size: 13.5px; font-weight: 600; white-space: nowrap; transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease; }
.roles-btn:hover:not(:disabled) { border-color: color-mix(in srgb, var(--primary) 50%, transparent); color: var(--primary); }
.roles-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.roles-btn--sm { height: 34px; padding: 0 12px; border-radius: 9px; font-size: 12.5px; }
.roles-btn--danger { border-color: color-mix(in srgb, var(--destructive) 30%, transparent); color: var(--nara-danger); }
.roles-btn--danger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--destructive) 60%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }
.roles-btn--danger-solid { border-color: transparent; background: var(--destructive); color: var(--destructive-foreground); }
.roles-btn--danger-solid:hover:not(:disabled) { border-color: transparent; color: var(--destructive-foreground); opacity: 0.9; }

/* Alerts */
.roles-alert { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid; border-radius: 14px; font-size: 14px; }
.roles-alert--error { border-color: color-mix(in srgb, var(--destructive) 30%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }
.roles-alert--ok { border-color: color-mix(in srgb, var(--primary) 30%, transparent); background: color-mix(in srgb, var(--primary) 8%, transparent); color: var(--primary); }
.roles-alert--live { border-color: var(--border); background: color-mix(in srgb, var(--foreground) 3%, transparent); color: var(--foreground); }
.roles-live-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 16%, transparent); }
.roles-danger { display: flex; flex-direction: column; gap: 16px; padding: 20px 22px; border: 1px solid color-mix(in srgb, var(--destructive) 35%, transparent); border-radius: 18px; background: var(--card); box-shadow: 0 0 0 4px color-mix(in srgb, var(--destructive) 8%, transparent), var(--nara-shadow); }
@media (min-width: 768px) { .roles-danger { flex-direction: row; align-items: center; justify-content: space-between; } }

/* Form */
.roles-form { padding: 26px; border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent); border-radius: 22px; background: var(--card); box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 7%, transparent), var(--nara-shadow); animation: roles-enter 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
@media (min-width: 640px) { .roles-form { padding: 32px; } }
.roles-close { display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid var(--border); border-radius: 50%; color: var(--muted-foreground); font-size: 20px; line-height: 1; transition: color 0.15s ease, border-color 0.15s ease; }
.roles-close:hover:not(:disabled) { border-color: color-mix(in srgb, var(--foreground) 40%, transparent); color: var(--foreground); }
.roles-field { display: grid; gap: 8px; font-size: 13.5px; font-weight: 600; }
.roles-field-label { font-size: 13.5px; font-weight: 600; }
.roles-input { height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--background); font-size: 14px; font-weight: 400; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.roles-textarea { height: auto; padding: 12px 14px; line-height: 1.6; resize: vertical; }
.roles-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
.roles-hint { color: var(--muted-foreground); font-size: 12px; font-weight: 400; }
.roles-error { color: var(--nara-danger); font-size: 12px; font-weight: 400; }

.roles-group { padding: 6px; border: 1px solid var(--border); border-radius: 16px; background: color-mix(in srgb, var(--foreground) 2%, transparent); }
.roles-group-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 10px; font-size: 13.5px; font-weight: 800; letter-spacing: -0.02em; }
.roles-group-count { padding: 2px 8px; border-radius: 7px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-family: var(--nara-mono); font-size: 10.5px; font-weight: 600; }
.roles-perm { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border: 1px solid transparent; border-radius: 11px; font-size: 13.5px; cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; }
.roles-perm:hover { background: var(--card); }
.roles-perm:has(input:checked) { border-color: color-mix(in srgb, var(--primary) 35%, transparent); background: color-mix(in srgb, var(--primary) 8%, transparent); }
.roles-perm input { margin-top: 3px; accent-color: var(--primary); }

/* Conflicts */
.roles-conflicts { padding: 18px 20px; border: 1px solid color-mix(in srgb, var(--destructive) 30%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--destructive) 4%, transparent); }
.roles-conflicts-title { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.roles-conflict { display: grid; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--card); font-size: 13.5px; }
@media (min-width: 768px) { .roles-conflict { grid-template-columns: 110px minmax(0, 1fr) auto; align-items: center; } }
.roles-conflict-label { font-weight: 700; }
.roles-conflict-values { display: grid; gap: 2px; min-width: 0; color: var(--muted-foreground); overflow-wrap: anywhere; }
.roles-conflict-values strong { color: var(--foreground); font-weight: 600; }
.roles-editing { display: inline-flex; align-items: center; gap: 7px; margin-top: 6px; color: var(--primary); font-size: 12px; font-weight: 600; }
.roles-editing .roles-live-dot { width: 6px; height: 6px; }

/* List window */
.roles-window { overflow: hidden; border: 1px solid var(--border); border-radius: 22px; background: var(--card); box-shadow: 0 0 0 8px color-mix(in srgb, var(--card) 50%, transparent), var(--nara-shadow); }
.roles-window-bar { display: flex; align-items: center; gap: 14px; height: 52px; padding: 0 20px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--foreground) 2.5%, transparent); }
.roles-dots { display: flex; gap: 7px; }
.roles-dots span { width: 10px; height: 10px; border-radius: 50%; background: color-mix(in srgb, var(--foreground) 14%, transparent); }
.roles-window-title { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.roles-count { margin-left: auto; padding: 4px 10px; border-radius: 8px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; }
.roles-empty { padding: 64px 20px; color: var(--muted-foreground); font-size: 14px; text-align: center; }

.roles-table { width: 100%; min-width: 900px; font-size: 14px; text-align: left; }
.roles-table th { padding: 14px 24px; border-bottom: 1px solid var(--border); color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.roles-table td { padding: 18px 24px; border-bottom: 1px solid var(--border); vertical-align: top; }
.roles-table tbody tr:last-child td { border-bottom: 0; }
.roles-table tbody tr { transition: background-color 0.15s ease; }
.roles-table tbody tr:hover { background: color-mix(in srgb, var(--primary) 4%, transparent); }
.roles-table tbody tr td:first-child { box-shadow: inset 2px 0 0 transparent; transition: box-shadow 0.15s ease; }
.roles-table tbody tr:hover td:first-child { box-shadow: inset 2px 0 0 var(--primary); }

.roles-badge { display: grid; width: 40px; height: 40px; flex: none; place-items: center; border-radius: 12px; background: linear-gradient(145deg, color-mix(in srgb, var(--primary) 18%, transparent), color-mix(in srgb, var(--primary) 6%, transparent)); color: var(--primary); font-size: 12.5px; font-weight: 800; letter-spacing: -0.03em; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 15%, transparent); }
.roles-badge--lg { width: 52px; height: 52px; border-radius: 15px; font-size: 17px; }
.roles-badge--admin { background: var(--nara-ink-raised); color: var(--nara-ink-accent); box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line); }
.roles-protected { padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent); border-radius: 999px; color: var(--primary); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.roles-perm-list { display: grid; max-width: 440px; gap: 6px; }
.roles-perm-list li { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: baseline; gap: 12px; font-size: 13.5px; }
.roles-perm-resource { font-weight: 700; letter-spacing: -0.01em; }
.roles-perm-actions { color: var(--muted-foreground); }
.roles-perm-full { justify-self: start; padding: 1px 9px; border-radius: 999px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-size: 12px; font-weight: 700; }
.roles-users { display: inline-flex; align-items: baseline; gap: 4px; color: var(--muted-foreground); font-size: 13px; white-space: nowrap; }
.roles-users [data-testid='role-user-count'] { color: var(--foreground); font-family: var(--nara-mono); font-size: 15px; font-weight: 700; }

@keyframes roles-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .roles-form { animation: none; } }
</style>
