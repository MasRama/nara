<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  createUserInputSchema,
  STALE_REVISION,
  updateUserInputSchema,
  USERS_CHANGED_EVENT,
  USERS_EDITING_EVENT,
} from '../../contract';
import type { ManagedUser, StaleUserError, UpdateUserInput, UpdateUserResponse, UsersEditor } from '../../contract';
import { createUsersClient } from '../client';
import { keepEditing, mergeEdit, sameValue } from '../editing';
import type { UsersWebHost, UsersWebRole } from '../host';

const props = defineProps<{ host: UsersWebHost }>();

const usersClient = createUsersClient({ csrf: props.host.csrf });
const users = ref<ManagedUser[]>([]);
const roles = ref<UsersWebRole[]>([]);
const search = ref('');
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const isLoading = ref(false);
const loadError = ref('');
const loadForbidden = ref(false);
const actionError = ref('');
const roleLoadError = ref('');
const notice = ref('');

const isFormOpen = ref(false);
const isCreating = ref(false);
const editingUser = ref<ManagedUser | null>(null);
const userName = ref('');
const userEmail = ref('');
const userPassword = ref('');
const selectedRoles = ref<string[]>([]);
const formError = ref('');
const fieldErrors = ref<Record<string, string[]>>({});
const isSubmitting = ref(false);
const isResettingPassword = ref(false);

const pendingDelete = ref<ManagedUser | null>(null);
const isDeleting = ref(false);
let usersLoadRequestId = 0;

type UserFields = { name: string; email: string; roles: string[] };
const FIELD_LABELS: Record<keyof UserFields, string> = { name: 'Name', email: 'Email', roles: 'Roles' };

// The open edit form tracks the saved version it builds on, so changes saved
// elsewhere merge in instead of being overwritten on save.
const editBase = ref<UserFields | null>(null);
const editRevision = ref(0);
const conflicts = ref<Array<keyof UserFields>>([]);
const mergeNotice = ref('');
const editors = ref<Record<string, UsersEditor[]>>({});
let stopEditing: (() => void) | undefined;

const canCreate = computed(() => props.host.can('users.create'));
const canEdit = computed(() => props.host.can('users.edit'));
const canDelete = computed(() => props.host.can('users.delete'));
const canAssignRoles = computed(() => props.host.isAdmin());
const canResetPasswords = computed(() => props.host.isAdmin() || props.host.can('users.reset-password'));
const editingSelf = computed(() => editingUser.value?.id === props.host.currentSessionUser()?.id);
const editingAdmin = computed(() => editingUser.value?.roles.includes('admin') === true);
const canEditCurrentForm = computed(
  () => isCreating.value || (editingUser.value !== null && canEditUser(editingUser.value)),
);
const canResetEditingPassword = computed(
  () =>
    !isCreating.value &&
    !editingSelf.value &&
    canResetPasswords.value &&
    (props.host.isAdmin() || !editingAdmin.value),
);

function isProtectedAdmin(user: ManagedUser): boolean {
  return user.roles.includes('admin') && !props.host.isAdmin();
}

function canEditUser(user: ManagedUser): boolean {
  return canEdit.value && !isProtectedAdmin(user);
}

function canResetUser(user: ManagedUser): boolean {
  return (
    canResetPasswords.value &&
    user.id !== props.host.currentSessionUser()?.id &&
    !isProtectedAdmin(user)
  );
}

function canDeleteUser(user: ManagedUser): boolean {
  return (
    canDelete.value &&
    user.id !== props.host.currentSessionUser()?.id &&
    !isProtectedAdmin(user)
  );
}
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)));
const formEditors = computed(() => (editingUser.value ? othersEditing(editingUser.value.id) : []));

function othersEditing(userId: string): UsersEditor[] {
  return (editors.value[userId] ?? []).filter((editor) => editor.id !== props.host.currentSessionUser()?.id);
}

function editorNames(list: UsersEditor[]): string {
  return list.map((editor) => editor.name).join(', ');
}

function userFields(user: ManagedUser): UserFields {
  return { name: user.name, email: user.email, roles: [...user.roles] };
}

function formFields(): UserFields {
  return { name: userName.value, email: userEmail.value, roles: [...selectedRoles.value] };
}

function setFormFields(fields: UserFields): void {
  userName.value = fields.name;
  userEmail.value = fields.email;
  selectedRoles.value = [...fields.roles];
}

function displayValue(field: keyof UserFields, value: UserFields[keyof UserFields] | undefined): string {
  if (field === 'roles') return Array.isArray(value) && value.length > 0 ? value.map(roleLabel).join(', ') : 'None';
  return typeof value === 'string' && value !== '' ? value : 'Empty';
}

function isStale(response: UpdateUserResponse): response is StaleUserError {
  return !response.success && response.code === STALE_REVISION && 'current' in response;
}

/**
 * Folds a newer saved version of the open account into the form. Fields you
 * have not touched follow it; fields you both changed are listed as conflicts
 * until you pick a side.
 */
function followSaved(user: ManagedUser): void {
  if (!editBase.value) return;
  const theirs = userFields(user);
  const result = mergeEdit(editBase.value, formFields(), theirs);
  setFormFields(result.merged);
  const open = new Set([...conflicts.value, ...result.conflicts]);
  conflicts.value = [...open].filter((field) => !sameValue(result.merged[field], theirs[field]));
  editBase.value = theirs;
  editRevision.value = user.revision;
  editingUser.value = user;
  if (result.adopted.length > 0) {
    mergeNotice.value = `Updated with changes saved elsewhere: ${result.adopted.map((field) => FIELD_LABELS[field]).join(', ')}.`;
  }
}

function useTheirs(field: keyof UserFields): void {
  if (!editBase.value) return;
  setFormFields({ ...formFields(), [field]: editBase.value[field] });
  conflicts.value = conflicts.value.filter((open) => open !== field);
}

function keepMine(field: keyof UserFields): void {
  conflicts.value = conflicts.value.filter((open) => open !== field);
}

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

function roleLabel(slug: string): string {
  return roles.value.find((role) => role.slug === slug)?.name ?? slug;
}

async function loadUsers(nextPage = page.value): Promise<void> {
  const requestId = ++usersLoadRequestId;
  const requestedLimit = limit.value;
  const requestedSearch = search.value;
  isLoading.value = true;
  loadError.value = '';
  loadForbidden.value = false;
  try {
    const response = await usersClient.listUsers({ page: nextPage, limit: requestedLimit, search: requestedSearch });
    if (requestId !== usersLoadRequestId) return;
    if (!response.success || !response.data) {
      loadForbidden.value = !response.success && response.code === 'FORBIDDEN';
      if (!loadForbidden.value) loadError.value = response.message;
      users.value = [];
      return;
    }

    users.value = response.data.users;
    total.value = response.data.total;
    page.value = response.data.page;
    limit.value = response.data.limit;
  } catch (error) {
    if (requestId !== usersLoadRequestId) return;
    console.error(error);
    loadError.value = 'Unable to load users';
    users.value = [];
  } finally {
    if (requestId === usersLoadRequestId) isLoading.value = false;
  }
}

// Accounts changed elsewhere: refresh the page in place and fold a newer
// version of the account being edited into its form.
async function followUserChanges(): Promise<void> {
  // A search or page change started meanwhile wins over this refresh.
  const requestId = usersLoadRequestId;
  try {
    const response = await usersClient.listUsers({ page: page.value, limit: limit.value, search: search.value });
    if (requestId !== usersLoadRequestId || !response.success) return;
    users.value = response.data.users;
    total.value = response.data.total;
    const open = editingUser.value;
    if (!open || !isFormOpen.value || isSubmitting.value) return;
    const saved = response.data.users.find((user) => user.id === open.id);
    if (saved && saved.revision > editRevision.value) followSaved(saved);
  } catch (error) {
    console.error(error);
  }
}

async function loadEditors(): Promise<void> {
  try {
    const response = await usersClient.listEditing();
    if (response.success) editors.value = response.data.editing;
  } catch (error) {
    console.error(error);
  }
}

async function loadRoles(): Promise<void> {
  roleLoadError.value = '';
  if (!canAssignRoles.value) {
    roles.value = [];
    return;
  }

  try {
    roles.value = await props.host.listRoles();
  } catch (error) {
    roles.value = [];
    console.error(error);
    roleLoadError.value = 'Unable to load roles';
  }
}

function submitSearch(): void {
  if (pendingDelete.value || isDeleting.value) return;
  page.value = 1;
  void loadUsers(1);
}

function changeLimit(): void {
  if (pendingDelete.value || isDeleting.value) return;
  page.value = 1;
  void loadUsers(1);
}

function goToPage(nextPage: number): void {
  if (pendingDelete.value || isDeleting.value) return;
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return;
  void loadUsers(nextPage);
}

function resetForm(): void {
  stopEditing?.();
  stopEditing = undefined;
  editBase.value = null;
  editRevision.value = 0;
  conflicts.value = [];
  mergeNotice.value = '';
  editingUser.value = null;
  userName.value = '';
  userEmail.value = '';
  userPassword.value = '';
  selectedRoles.value = [];
  formError.value = '';
  fieldErrors.value = {};
}

function openCreate(): void {
  if (roleLoadError.value || isResettingPassword.value || isSubmitting.value || pendingDelete.value) return;
  resetForm();
  isCreating.value = true;
  isFormOpen.value = true;
  actionError.value = '';
}

function openEdit(user: ManagedUser): void {
  if (isResettingPassword.value || isSubmitting.value || pendingDelete.value) return;
  if (!canEditUser(user) && !canResetUser(user)) return;
  resetForm();
  editingUser.value = user;
  isCreating.value = false;
  userName.value = user.name;
  userEmail.value = user.email;
  selectedRoles.value = [...user.roles];
  editBase.value = userFields(user);
  editRevision.value = user.revision;
  if (canEditUser(user)) stopEditing = keepEditing(user.id, usersClient);
  isFormOpen.value = true;
  actionError.value = '';
}

function closeForm(): void {
  if (isSubmitting.value || isResettingPassword.value) return;
  isFormOpen.value = false;
  resetForm();
}

function validateUser(): UpdateUserInput | undefined {
  const payload = {
    revision: editRevision.value,
    name: userName.value,
    email: userEmail.value,
    ...(canAssignRoles.value ? { roles: selectedRoles.value } : {}),
  };
  const parsed = updateUserInputSchema.safeParse(payload);
  if (parsed.success) {
    fieldErrors.value = {};
    return parsed.data;
  }

  fieldErrors.value = mapIssues(parsed.error.issues);
  formError.value = 'Please correct the highlighted fields.';
  return undefined;
}

async function resetManagedPassword(): Promise<void> {
  if (!editingUser.value || !canResetEditingPassword.value || isResettingPassword.value) return;

  fieldErrors.value = {};
  formError.value = '';
  notice.value = '';
  if (userPassword.value.length < 8) {
    fieldErrors.value = { password: ['Password must be at least 8 characters'] };
    formError.value = 'Please correct the highlighted fields.';
    return;
  }

  isResettingPassword.value = true;
  try {
    const response = await usersClient.resetPassword(editingUser.value.id, { password: userPassword.value });
    if (!response.success) {
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }
    userPassword.value = '';
    notice.value = 'Password reset';
  } catch (error) {
    console.error(error);
    formError.value = 'Unable to reset password';
  } finally {
    isResettingPassword.value = false;
  }
}

async function submitUser(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  notice.value = '';
  if (!isCreating.value && conflicts.value.length > 0) {
    formError.value = 'Choose which version to keep for each field saved elsewhere.';
    return;
  }

  const payload = isCreating.value
    ? {
        name: userName.value,
        email: userEmail.value,
        password: userPassword.value,
        ...(canAssignRoles.value ? { roles: selectedRoles.value } : {}),
      }
    : validateUser();

  if (!payload) return;

  if (isCreating.value) {
    const parsed = createUserInputSchema.safeParse(payload);
    if (!parsed.success) {
      fieldErrors.value = mapIssues(parsed.error.issues);
      formError.value = 'Please correct the highlighted fields.';
      return;
    }

    isSubmitting.value = true;
    try {
      const response = await usersClient.createUser(parsed.data);
      if (!response.success) {
        formError.value = response.message;
        fieldErrors.value = response.errors ?? {};
        return;
      }
      isFormOpen.value = false;
      resetForm();
      notice.value = 'User created';
      await loadUsers(1);
    } catch (error) {
      console.error(error);
      formError.value = 'Unable to create user';
    } finally {
      isSubmitting.value = false;
    }
    return;
  }

  if (!editingUser.value || !('revision' in payload)) return;
  isSubmitting.value = true;
  try {
    const response = await usersClient.updateUser(editingUser.value.id, payload);
    if (!response.success) {
      if (isStale(response)) {
        followSaved(response.current);
        formError.value =
          conflicts.value.length > 0
            ? 'Someone saved this account while you were editing. Choose which version to keep below.'
            : 'Someone saved this account while you were editing. Their changes are merged in; review and save again.';
        return;
      }
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }
    isFormOpen.value = false;
    resetForm();
    notice.value = 'User updated';
    await loadUsers(page.value);
  } catch (error) {
    console.error(error);
    formError.value = 'Unable to update user';
  } finally {
    isSubmitting.value = false;
  }
}

function requestDelete(user: ManagedUser): void {
  if (isResettingPassword.value || isSubmitting.value || !canDeleteUser(user)) return;
  pendingDelete.value = user;
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
    const response = await usersClient.deleteUsers({ ids: [pendingDelete.value.id] });
    if (!response.success) {
      actionError.value = response.message;
      return;
    }
    notice.value = 'Users deleted';
    pendingDelete.value = null;
    const remainingTotal = Math.max(0, total.value - response.data.deleted);
    const remainingPages = Math.max(1, Math.ceil(remainingTotal / limit.value));
    await loadUsers(Math.min(page.value, remainingPages));
  } catch (error) {
    console.error(error);
    actionError.value = 'Unable to delete user';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadUsers(1), loadRoles(), loadEditors()]);
});
const unsubscribe = [
  props.host.onLiveEvent?.(USERS_CHANGED_EVENT, () => void followUserChanges()),
  props.host.onLiveEvent?.(USERS_EDITING_EVENT, () => void loadEditors()),
];
onUnmounted(() => {
  for (const stop of unsubscribe) stop?.();
  stopEditing?.();
});
</script>

<template>
  <main class="nara-page" data-testid="users-page">
    <section class="nara-page-inner">
      <header class="users-hero">
        <div class="min-w-0">
          <h1 class="nara-page-title">
            Users<span class="nara-page-title-accent">.</span>
          </h1>
          <p class="nara-page-lede">Search accounts, manage access, and keep user records current.</p>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink to="/dashboard" class="users-ghost">Dashboard</RouterLink>
          <button
            v-if="canCreate"
            type="button"
            data-testid="create-user"
            :disabled="Boolean(roleLoadError) || Boolean(pendingDelete) || isResettingPassword || isSubmitting"
            class="users-primary"
            @click="openCreate"
          >
            <span class="users-primary-plus" aria-hidden="true">+</span>
            New user
          </button>
        </div>
      </header>

      <div class="users-stack nara-page-body">
        <p v-if="loadForbidden" role="alert" class="users-alert users-alert--error">You do not have permission to view users.</p>
        <p v-if="loadError" role="alert" class="users-alert users-alert--error">{{ loadError }}</p>
        <p v-if="actionError" role="alert" class="users-alert users-alert--error">{{ actionError }}</p>
        <p v-if="roleLoadError" role="alert" class="users-alert users-alert--error">{{ roleLoadError }}</p>
        <p v-if="notice" role="status" class="users-alert users-alert--ok"><span class="users-live-dot"></span>{{ notice }}</p>

        <section v-if="pendingDelete" class="users-danger" role="dialog" aria-labelledby="delete-user-title">
          <div class="min-w-0">
            <h2 id="delete-user-title" class="font-heading text-lg font-extrabold tracking-[-0.03em]">Delete {{ pendingDelete.name }}?</h2>
            <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">This action cannot be undone. Server protection rules still apply to self-delete and the last administrator.</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button type="button" data-testid="cancel-delete" :disabled="isDeleting" class="users-btn" @click="cancelDelete">Cancel</button>
            <button type="button" data-testid="confirm-delete" :disabled="isDeleting" class="users-btn users-btn--danger-solid" @click="confirmDelete">{{ isDeleting ? 'Deleting…' : 'Delete user' }}</button>
          </div>
        </section>

        <template v-if="!loadForbidden">
          <form class="users-search" data-testid="user-search-form" aria-label="Find users" @submit.prevent="submitSearch">
            <label class="users-search-field" for="user-search">
              <span class="sr-only">Search by name or email</span>
              <svg class="users-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8" /><path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
              <input
                id="user-search"
                v-model="search"
                type="search"
                :disabled="Boolean(pendingDelete) || isDeleting"
                placeholder="Search by name or email"
              />
            </label>
            <label class="users-search-limit" for="user-page-size">
              <span>Per page</span>
              <select
                id="user-page-size"
                v-model.number="limit"
                :disabled="Boolean(pendingDelete) || isDeleting"
                @change="changeLimit"
              >
                <option :value="5">5</option>
                <option :value="1">1</option>
                <option :value="10">10</option>
                <option :value="25">25</option>
              </select>
            </label>
            <button type="submit" :disabled="Boolean(pendingDelete) || isDeleting" class="users-search-submit">Search</button>
          </form>

          <section v-if="isFormOpen" class="users-form" aria-labelledby="user-form-title">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                <span class="users-avatar users-avatar--lg" aria-hidden="true">{{ isCreating ? '+' : (editingUser?.name ?? '').slice(0, 2).toUpperCase() }}</span>
                <div class="min-w-0">
                  <h2 id="user-form-title" class="font-heading text-xl font-extrabold tracking-[-0.04em]">{{ isCreating ? 'Create user' : canEditCurrentForm ? 'Edit user' : 'Reset password' }}</h2>
                  <p v-if="editingUser" class="mt-0.5 truncate text-sm text-muted-foreground">{{ editingUser.email }}</p>
                </div>
              </div>
              <button type="button" class="users-close" aria-label="Close" :disabled="isSubmitting || isResettingPassword" @click="closeForm">×</button>
            </div>

            <p v-if="formError" role="alert" class="users-alert users-alert--error mt-6">{{ formError }}</p>
            <p v-if="formEditors.length" role="status" class="users-alert users-alert--live mt-6" data-testid="user-editors">
              <span class="users-live-dot"></span>{{ editorNames(formEditors) }} {{ formEditors.length === 1 ? 'is' : 'are' }} also editing this account.
            </p>
            <p v-if="mergeNotice" role="status" class="users-alert users-alert--ok mt-6" data-testid="user-merge-notice">{{ mergeNotice }}</p>
            <section v-if="conflicts.length" class="users-conflicts mt-6" data-testid="user-conflicts" aria-labelledby="user-conflicts-title">
              <h3 id="user-conflicts-title" class="users-conflicts-title">Saved elsewhere while you were editing</h3>
              <p class="users-hint mt-1">You and someone else both changed these fields. Choose which version to keep.</p>
              <ul class="mt-3 grid gap-2">
                <li v-for="field in conflicts" :key="field" class="users-conflict" :data-conflict-field="field">
                  <span class="users-conflict-label">{{ FIELD_LABELS[field] }}</span>
                  <span class="users-conflict-values">
                    <span>Theirs: <strong>{{ displayValue(field, editBase?.[field]) }}</strong></span>
                    <span>Yours: <strong>{{ displayValue(field, formFields()[field]) }}</strong></span>
                  </span>
                  <span class="flex gap-2">
                    <button type="button" class="users-btn users-btn--sm" :data-testid="`use-theirs-${field}`" @click="useTheirs(field)">Use theirs</button>
                    <button type="button" class="users-btn users-btn--sm" :data-testid="`keep-mine-${field}`" @click="keepMine(field)">Keep mine</button>
                  </span>
                </li>
              </ul>
            </section>
            <form class="mt-6 grid gap-5 md:grid-cols-2" data-testid="user-form" @submit.prevent="submitUser">
              <label class="users-field" for="user-name">
                Name
                <input id="user-name" v-model="userName" type="text" autocomplete="name" :disabled="!canEditCurrentForm" class="users-input" />
                <span v-if="fieldError('name')" class="users-error">{{ fieldError('name') }}</span>
              </label>
              <label class="users-field" for="user-email">
                Email
                <input id="user-email" v-model="userEmail" type="email" autocomplete="email" :disabled="!canEditCurrentForm" class="users-input" />
                <span v-if="fieldError('email')" class="users-error">{{ fieldError('email') }}</span>
              </label>
              <label v-if="isCreating" class="users-field" for="user-password">
                Password
                <input id="user-password" v-model="userPassword" type="password" autocomplete="new-password" :required="isCreating" class="users-input" />
                <span class="users-hint">Required; use at least 8 characters.</span>
                <span v-if="fieldError('password')" class="users-error">{{ fieldError('password') }}</span>
              </label>
              <p v-else-if="editingSelf" class="self-end text-xs leading-relaxed text-muted-foreground">
                Change your own password from Profile so the current password can be verified.
              </p>

              <div v-else-if="canResetEditingPassword" class="users-field users-reset md:col-span-2">
                <label for="user-password">Reset password</label>
                <div class="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="user-password"
                    v-model="userPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="New password"
                    class="users-input min-w-0 flex-1"
                    @keydown.enter.prevent="resetManagedPassword"
                  />
                  <button
                    type="button"
                    data-testid="reset-user-password"
                    :disabled="isSubmitting || isResettingPassword || !userPassword"
                    class="users-btn"
                    @click="resetManagedPassword"
                  >
                    {{ isResettingPassword ? 'Resetting…' : 'Reset password' }}
                  </button>
                </div>
                <span class="users-hint">Resetting revokes all active sessions for this account.</span>
                <span v-if="fieldError('password')" class="users-error">{{ fieldError('password') }}</span>
              </div>

              <fieldset v-if="canAssignRoles && canEditCurrentForm" class="users-field md:col-span-2">
                <legend class="mb-2">Roles</legend>
                <div class="flex flex-wrap gap-2">
                  <label v-for="role in roles" :key="role.id" class="users-role-option">
                    <input v-model="selectedRoles" type="checkbox" :value="role.slug" :data-role-slug="role.slug" />
                    <span>{{ role.name }} <span class="users-role-slug">{{ role.slug }}</span></span>
                  </label>
                </div>
                <span class="users-hint">Role assignment is limited by the server to administrators.</span>
              </fieldset>

              <div v-if="canEditCurrentForm" class="flex items-center gap-3 border-t border-border pt-5 md:col-span-2">
                <button type="submit" :disabled="isSubmitting || isResettingPassword || (!isCreating && conflicts.length > 0)" class="users-primary">
                  {{ isSubmitting ? 'Saving…' : isCreating ? 'Create user' : 'Save changes' }}
                </button>
                <button type="button" :disabled="isSubmitting || isResettingPassword" class="users-ghost" @click="closeForm">Cancel</button>
              </div>
            </form>
          </section>

          <section class="users-window" aria-labelledby="user-list-title">
            <div class="users-window-bar">
              <span class="users-dots" aria-hidden="true"><span></span><span></span><span></span></span>
              <h2 id="user-list-title" class="users-window-title">User accounts</h2>
              <span class="users-count">{{ total }} {{ total === 1 ? 'total user' : 'total users' }}</span>
            </div>

            <p v-if="isLoading" role="status" class="users-empty">Loading users…</p>
            <p v-else-if="users.length === 0" class="users-empty">No users match this search.</p>

            <template v-else>
              <div class="overflow-x-auto">
                <table class="users-table" data-testid="user-list">
                  <thead>
                    <tr>
                      <th scope="col">User</th>
                      <th scope="col">Roles</th>
                      <th scope="col" class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in users" :key="user.id" :data-user-id="user.id">
                      <td>
                        <div class="flex items-center gap-3.5">
                          <span class="users-avatar">
                            <img v-if="user.avatar" :src="user.avatar" :alt="`${user.name} avatar`" class="h-full w-full object-cover" />
                            <span v-else>{{ user.name.slice(0, 2).toUpperCase() }}</span>
                          </span>
                          <span class="min-w-0">
                            <span class="block truncate font-heading font-bold tracking-[-0.02em]">{{ user.name }}</span>
                            <span class="block truncate text-[13px] text-muted-foreground">{{ user.email }}</span>
                            <span v-if="othersEditing(user.id).length" class="users-editing" data-testid="user-editing"><span class="users-live-dot"></span>{{ editorNames(othersEditing(user.id)) }} editing</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div class="flex flex-wrap gap-1.5">
                          <span v-for="role in user.roles" :key="role" :class="['users-chip', { 'users-chip--admin': role === 'admin' }]">{{ roleLabel(role) }}</span>
                          <span v-if="user.roles.length === 0" class="text-[13px] text-muted-foreground">No roles</span>
                        </div>
                      </td>
                      <td class="text-right">
                        <div class="users-row-actions">
                          <button v-if="canEditUser(user) || canResetUser(user)" type="button" :disabled="isResettingPassword || isSubmitting || Boolean(pendingDelete)" :data-testid="`edit-user-${user.id}`" class="users-btn users-btn--sm" @click="openEdit(user)">{{ canEditUser(user) ? 'Edit' : 'Reset password' }}</button>
                          <button v-if="canDeleteUser(user)" type="button" :disabled="isResettingPassword || isSubmitting || Boolean(pendingDelete)" :data-testid="`delete-user-${user.id}`" class="users-btn users-btn--sm users-btn--danger" @click="requestDelete(user)">Delete</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="users-pager">
                <button type="button" data-testid="user-previous" :disabled="page <= 1 || isLoading || Boolean(pendingDelete) || isDeleting" class="users-btn users-btn--sm" @click="goToPage(page - 1)">← Previous</button>
                <span aria-live="polite" class="users-pager-label">Page {{ page }} of {{ totalPages }}</span>
                <button type="button" data-testid="user-next" :disabled="page >= totalPages || isLoading || Boolean(pendingDelete) || isDeleting" class="users-btn users-btn--sm" @click="goToPage(page + 1)">Next →</button>
              </div>
            </template>
          </section>
        </template>
      </div>
    </section>
  </main>
</template>

<style scoped>
.users-stack { display: flex; flex-direction: column; gap: 20px; }

.users-hero { display: flex; flex-direction: column; gap: 28px; }
@media (min-width: 640px) { .users-hero { flex-direction: row; align-items: flex-end; justify-content: space-between; } }

/* Buttons */
.users-primary { display: inline-flex; height: 44px; align-items: center; gap: 10px; padding: 0 18px 0 8px; border-radius: 13px; background: var(--nara-ink-raised); color: var(--nara-ink-fg); font-size: 14px; font-weight: 700; box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line), var(--nara-shadow); transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
.users-form .users-primary { padding: 0 20px; }
.users-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 60%, transparent), var(--nara-shadow); }
.users-primary:disabled { cursor: not-allowed; opacity: 0.5; }
.users-primary-plus { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 9px; background: color-mix(in srgb, var(--nara-ink-accent) 16%, transparent); color: var(--nara-ink-accent); font-size: 18px; font-weight: 600; line-height: 1; }
.users-ghost { display: inline-flex; height: 44px; align-items: center; padding: 0 14px; border-radius: 13px; color: var(--muted-foreground); font-size: 14px; font-weight: 600; transition: color 0.15s ease, background-color 0.15s ease; }
.users-ghost:hover { background: color-mix(in srgb, var(--foreground) 5%, transparent); color: var(--foreground); }
.users-btn { display: inline-flex; height: 40px; align-items: center; justify-content: center; padding: 0 16px; border: 1px solid var(--border); border-radius: 11px; background: var(--card); font-size: 13.5px; font-weight: 600; white-space: nowrap; transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease; }
.users-btn:hover:not(:disabled) { border-color: color-mix(in srgb, var(--primary) 50%, transparent); color: var(--primary); }
.users-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.users-btn--sm { height: 34px; padding: 0 12px; border-radius: 9px; font-size: 12.5px; }
.users-btn--danger { border-color: color-mix(in srgb, var(--destructive) 30%, transparent); color: var(--nara-danger); }
.users-btn--danger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--destructive) 60%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }
.users-btn--danger-solid { border-color: transparent; background: var(--destructive); color: var(--destructive-foreground); }
.users-btn--danger-solid:hover:not(:disabled) { border-color: transparent; color: var(--destructive-foreground); opacity: 0.9; }

/* Alerts */
.users-alert { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid; border-radius: 14px; font-size: 14px; }
.users-alert--error { border-color: color-mix(in srgb, var(--destructive) 30%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }
.users-alert--ok { border-color: color-mix(in srgb, var(--primary) 30%, transparent); background: color-mix(in srgb, var(--primary) 8%, transparent); color: var(--primary); }
.users-alert--live { border-color: var(--border); background: color-mix(in srgb, var(--foreground) 3%, transparent); color: var(--foreground); }
.users-live-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 16%, transparent); }
.users-danger { display: flex; flex-direction: column; gap: 16px; padding: 20px 22px; border: 1px solid color-mix(in srgb, var(--destructive) 35%, transparent); border-radius: 18px; background: var(--card); box-shadow: 0 0 0 4px color-mix(in srgb, var(--destructive) 8%, transparent), var(--nara-shadow); }
@media (min-width: 768px) { .users-danger { flex-direction: row; align-items: center; justify-content: space-between; } }

/* Search */
.users-search { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--border); border-radius: 18px; background: var(--card); box-shadow: var(--nara-shadow); }
.users-search-field { position: relative; display: flex; min-width: 220px; flex: 1; align-items: center; }
.users-search-icon { position: absolute; left: 14px; width: 18px; height: 18px; color: var(--muted-foreground); pointer-events: none; }
.users-search-field input { width: 100%; height: 44px; padding: 0 14px 0 42px; border-radius: 12px; background: transparent; font-size: 14.5px; outline: none; transition: background-color 0.15s ease; }
.users-search-field input:focus { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
.users-search-limit { display: inline-flex; height: 44px; align-items: center; gap: 8px; padding: 0 6px 0 14px; border-left: 1px solid var(--border); color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.users-search-limit select { height: 32px; padding: 0 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--background); color: var(--foreground); font-family: inherit; font-size: 12.5px; outline: none; }
.users-search-limit select:focus { border-color: var(--primary); }
.users-search-submit { height: 44px; padding: 0 20px; border-radius: 12px; background: var(--primary); color: var(--primary-foreground); font-size: 14px; font-weight: 700; transition: opacity 0.15s ease; }
.users-search-submit:hover:not(:disabled) { opacity: 0.9; }
.users-search-submit:disabled { cursor: not-allowed; opacity: 0.5; }

/* Form */
.users-form { padding: 26px; border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent); border-radius: 22px; background: var(--card); box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 7%, transparent), var(--nara-shadow); animation: users-enter 0.4s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
@media (min-width: 640px) { .users-form { padding: 32px; } }
.users-close { display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid var(--border); border-radius: 50%; color: var(--muted-foreground); font-size: 20px; line-height: 1; transition: color 0.15s ease, border-color 0.15s ease; }
.users-close:hover:not(:disabled) { border-color: color-mix(in srgb, var(--foreground) 40%, transparent); color: var(--foreground); }
.users-field { display: grid; gap: 8px; font-size: 13.5px; font-weight: 600; }
.users-input { height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--background); font-size: 14px; font-weight: 400; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.users-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
.users-input:disabled { cursor: not-allowed; opacity: 0.6; }
.users-hint { color: var(--muted-foreground); font-size: 12px; font-weight: 400; }
.users-error { color: var(--nara-danger); font-size: 12px; font-weight: 400; }
.users-reset { padding: 18px; border: 1px dashed var(--border); border-radius: 16px; background: color-mix(in srgb, var(--foreground) 2%, transparent); }
.users-role-option { display: inline-flex; align-items: center; gap: 10px; padding: 9px 14px; border: 1px solid var(--border); border-radius: 12px; font-weight: 600; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease; }
.users-role-option:has(input:checked) { border-color: color-mix(in srgb, var(--primary) 50%, transparent); background: color-mix(in srgb, var(--primary) 8%, transparent); }
.users-role-option input { accent-color: var(--primary); }
.users-role-slug { margin-left: 4px; color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 11px; font-weight: 500; }

/* Conflicts */
.users-conflicts { padding: 18px 20px; border: 1px solid color-mix(in srgb, var(--destructive) 30%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--destructive) 4%, transparent); }
.users-conflicts-title { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.users-conflict { display: grid; gap: 10px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--card); font-size: 13.5px; }
@media (min-width: 768px) { .users-conflict { grid-template-columns: 110px minmax(0, 1fr) auto; align-items: center; } }
.users-conflict-label { font-weight: 700; }
.users-conflict-values { display: grid; gap: 2px; min-width: 0; color: var(--muted-foreground); overflow-wrap: anywhere; }
.users-conflict-values strong { color: var(--foreground); font-weight: 600; }
.users-editing { display: inline-flex; align-items: center; gap: 7px; margin-top: 4px; color: var(--primary); font-size: 12px; font-weight: 600; }
.users-editing .users-live-dot { width: 6px; height: 6px; }

/* List window */
.users-window { overflow: hidden; border: 1px solid var(--border); border-radius: 22px; background: var(--card); box-shadow: 0 0 0 8px color-mix(in srgb, var(--card) 50%, transparent), var(--nara-shadow); }
.users-window-bar { display: flex; align-items: center; gap: 14px; height: 52px; padding: 0 20px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--foreground) 2.5%, transparent); }
.users-dots { display: flex; gap: 7px; }
.users-dots span { width: 10px; height: 10px; border-radius: 50%; background: color-mix(in srgb, var(--foreground) 14%, transparent); }
.users-window-title { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.users-count { margin-left: auto; padding: 4px 10px; border-radius: 8px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; }
.users-empty { padding: 64px 20px; color: var(--muted-foreground); font-size: 14px; text-align: center; }

.users-table { width: 100%; min-width: 760px; font-size: 14px; text-align: left; }
.users-table th { padding: 14px 24px; border-bottom: 1px solid var(--border); color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.users-table td { padding: 16px 24px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.users-table tbody tr { position: relative; transition: background-color 0.15s ease; }
.users-table tbody tr:hover { background: color-mix(in srgb, var(--primary) 4%, transparent); }
.users-table tbody tr td:first-child { box-shadow: inset 2px 0 0 transparent; transition: box-shadow 0.15s ease; }
.users-table tbody tr:hover td:first-child { box-shadow: inset 2px 0 0 var(--primary); }
.users-row-actions { display: flex; justify-content: flex-end; gap: 8px; }

.users-avatar { display: grid; width: 40px; height: 40px; flex: none; place-items: center; overflow: hidden; border-radius: 12px; background: linear-gradient(145deg, color-mix(in srgb, var(--primary) 18%, transparent), color-mix(in srgb, var(--primary) 6%, transparent)); color: var(--primary); font-size: 12.5px; font-weight: 800; letter-spacing: -0.03em; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 15%, transparent); }
.users-avatar--lg { width: 52px; height: 52px; border-radius: 15px; font-size: 17px; }
.users-chip { padding: 4px 10px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted-foreground); font-size: 12px; font-weight: 600; }
.users-chip--admin { border-color: color-mix(in srgb, var(--primary) 35%, transparent); background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); }

.users-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; }
.users-pager-label { color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; }

@keyframes users-enter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .users-form { animation: none; } }
</style>
