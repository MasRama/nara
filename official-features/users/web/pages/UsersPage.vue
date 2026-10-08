<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { createUserInputSchema, updateUserInputSchema } from '../../contract';
import type { ManagedUser, UpdateUserInput } from '../../contract';
import type { ValidationIssue } from '../../../../shared/i18n';
import { createUsersClient } from '../client';
import type { UsersWebHost, UsersWebRole } from '../host';
import { error as errorText, issue as issueText, t } from '../locales';

type FieldErrors = Record<string, string[]>;

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
const fieldErrors = ref<FieldErrors>({});
const isSubmitting = ref(false);
const isResettingPassword = ref(false);

const pendingDelete = ref<ManagedUser | null>(null);
const isDeleting = ref(false);
let usersLoadRequestId = 0;

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

function mapIssues(issues: ReadonlyArray<ValidationIssue>): FieldErrors {
  const mapped: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(issueText(issue));
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
      if (!loadForbidden.value) loadError.value = errorText(response);
      users.value = [];
      return;
    }

    users.value = response.data.users;
    total.value = response.data.total;
    page.value = response.data.page;
    limit.value = response.data.limit;
  } catch (error) {
    if (requestId !== usersLoadRequestId) return;
    loadError.value = error instanceof Error ? error.message : t('users.loadFailed');
    users.value = [];
  } finally {
    if (requestId === usersLoadRequestId) isLoading.value = false;
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
    roleLoadError.value = error instanceof Error ? error.message : t('users.rolesFailed');
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
  formError.value = t('users.form.invalid');
  return undefined;
}

async function resetManagedPassword(): Promise<void> {
  if (!editingUser.value || !canResetEditingPassword.value || isResettingPassword.value) return;

  fieldErrors.value = {};
  formError.value = '';
  notice.value = '';
  if (userPassword.value.length < 8) {
    fieldErrors.value = { password: [t('users.form.passwordTooShort')] };
    formError.value = t('users.form.invalid');
    return;
  }

  isResettingPassword.value = true;
  try {
    const response = await usersClient.resetPassword(editingUser.value.id, { password: userPassword.value });
    if (!response.success) {
      formError.value =
        response.code === 'PROTECTED_ADMIN' ? t('users.form.protectedAdminReset') : errorText(response);
      fieldErrors.value = response.errors ?? {};
      return;
    }
    userPassword.value = '';
    notice.value = t('users.form.passwordReset');
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('users.form.resetFailed');
  } finally {
    isResettingPassword.value = false;
  }
}

async function submitUser(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  notice.value = '';

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
      formError.value = t('users.form.invalid');
      return;
    }

    isSubmitting.value = true;
    try {
      const response = await usersClient.createUser(parsed.data);
      if (!response.success) {
        formError.value = errorText(response);
        fieldErrors.value = response.errors ?? {};
        return;
      }
      isFormOpen.value = false;
      resetForm();
      notice.value = t('users.form.created');
      await loadUsers(1);
    } catch (error) {
      formError.value = error instanceof Error ? error.message : t('users.form.createFailed');
    } finally {
      isSubmitting.value = false;
    }
    return;
  }

  if (!editingUser.value) return;
  isSubmitting.value = true;
  try {
    const response = await usersClient.updateUser(editingUser.value.id, payload);
    if (!response.success) {
      formError.value = errorText(response);
      fieldErrors.value = response.errors ?? {};
      return;
    }
    isFormOpen.value = false;
    resetForm();
    notice.value = t('users.form.updated');
    await loadUsers(page.value);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t('users.form.updateFailed');
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
      actionError.value = errorText(response);
      return;
    }
    notice.value = t('users.delete.done');
    pendingDelete.value = null;
    const remainingTotal = Math.max(0, total.value - response.data.deleted);
    const remainingPages = Math.max(1, Math.ceil(remainingTotal / limit.value));
    await loadUsers(Math.min(page.value, remainingPages));
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : t('users.delete.failed');
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadUsers(1), loadRoles()]);
});
</script>

<template>
  <main class="nara-page" data-testid="users-page">
    <section class="nara-page-inner">
      <header class="users-hero">
        <div class="min-w-0">
          <h1 class="nara-page-title">
            {{ t('users.title') }}<span class="nara-page-title-accent">.</span>
          </h1>
          <p class="nara-page-lede">{{ t('users.lede') }}</p>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink to="/dashboard" class="users-ghost">{{ t('users.dashboard') }}</RouterLink>
          <button
            v-if="canCreate"
            type="button"
            data-testid="create-user"
            :disabled="Boolean(roleLoadError) || Boolean(pendingDelete) || isResettingPassword || isSubmitting"
            class="users-primary"
            @click="openCreate"
          >
            <span class="users-primary-plus" aria-hidden="true">+</span>
            {{ t('users.new') }}
          </button>
        </div>
      </header>

      <div class="users-stack nara-page-body">
        <p v-if="loadForbidden" role="alert" class="users-alert users-alert--error">{{ t('users.forbidden') }}</p>
        <p v-if="loadError" role="alert" class="users-alert users-alert--error">{{ loadError }}</p>
        <p v-if="actionError" role="alert" class="users-alert users-alert--error">{{ actionError }}</p>
        <p v-if="roleLoadError" role="alert" class="users-alert users-alert--error">{{ roleLoadError }}</p>
        <p v-if="notice" role="status" class="users-alert users-alert--ok"><span class="users-live-dot"></span>{{ notice }}</p>

        <section v-if="pendingDelete" class="users-danger" role="dialog" aria-labelledby="delete-user-title">
          <div class="min-w-0">
            <h2 id="delete-user-title" class="font-heading text-lg font-extrabold tracking-[-0.03em]">{{ t('users.delete.title', { name: pendingDelete.name }) }}</h2>
            <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ t('users.delete.lede') }}</p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button type="button" data-testid="cancel-delete" :disabled="isDeleting" class="users-btn" @click="cancelDelete">{{ t('users.delete.cancel') }}</button>
            <button type="button" data-testid="confirm-delete" :disabled="isDeleting" class="users-btn users-btn--danger-solid" @click="confirmDelete">{{ isDeleting ? t('users.delete.deleting') : t('users.delete.confirm') }}</button>
          </div>
        </section>

        <template v-if="!loadForbidden">
          <form class="users-search" data-testid="user-search-form" :aria-label="t('users.search.label')" @submit.prevent="submitSearch">
            <label class="users-search-field" for="user-search">
              <span class="sr-only">{{ t('users.search.field') }}</span>
              <svg class="users-search-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8" /><path d="m13.5 13.5 3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
              <input
                id="user-search"
                v-model="search"
                type="search"
                :disabled="Boolean(pendingDelete) || isDeleting"
                :placeholder="t('users.search.field')"
              />
            </label>
            <label class="users-search-limit" for="user-page-size">
              <span>{{ t('users.search.perPage') }}</span>
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
            <button type="submit" :disabled="Boolean(pendingDelete) || isDeleting" class="users-search-submit">{{ t('users.search.submit') }}</button>
          </form>

          <section v-if="isFormOpen" class="users-form" aria-labelledby="user-form-title">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                <span class="users-avatar users-avatar--lg" aria-hidden="true">{{ isCreating ? '+' : (editingUser?.name ?? '').slice(0, 2).toUpperCase() }}</span>
                <div class="min-w-0">
                  <h2 id="user-form-title" class="font-heading text-xl font-extrabold tracking-[-0.04em]">{{ isCreating ? t('users.form.create') : canEditCurrentForm ? t('users.form.edit') : t('users.form.resetPassword') }}</h2>
                  <p v-if="editingUser" class="mt-0.5 truncate text-sm text-muted-foreground">{{ editingUser.email }}</p>
                </div>
              </div>
              <button type="button" class="users-close" :aria-label="t('users.form.close')" :disabled="isSubmitting || isResettingPassword" @click="closeForm">×</button>
            </div>

            <p v-if="formError" role="alert" class="users-alert users-alert--error mt-6">{{ formError }}</p>
            <form class="mt-6 grid gap-5 md:grid-cols-2" data-testid="user-form" @submit.prevent="submitUser">
              <label class="users-field" for="user-name">
                {{ t('users.form.name') }}
                <input id="user-name" v-model="userName" type="text" autocomplete="name" :disabled="!canEditCurrentForm" class="users-input" />
                <span v-if="fieldError('name')" class="users-error">{{ fieldError('name') }}</span>
              </label>
              <label class="users-field" for="user-email">
                {{ t('users.form.email') }}
                <input id="user-email" v-model="userEmail" type="email" autocomplete="email" :disabled="!canEditCurrentForm" class="users-input" />
                <span v-if="fieldError('email')" class="users-error">{{ fieldError('email') }}</span>
              </label>
              <label v-if="isCreating" class="users-field" for="user-password">
                {{ t('users.form.password') }}
                <input id="user-password" v-model="userPassword" type="password" autocomplete="new-password" :required="isCreating" class="users-input" />
                <span class="users-hint">{{ t('users.form.passwordHint') }}</span>
                <span v-if="fieldError('password')" class="users-error">{{ fieldError('password') }}</span>
              </label>
              <p v-else-if="editingSelf" class="self-end text-xs leading-relaxed text-muted-foreground">
                {{ t('users.form.selfPassword') }}
              </p>

              <div v-else-if="canResetEditingPassword" class="users-field users-reset md:col-span-2">
                <label for="user-password">{{ t('users.form.resetPassword') }}</label>
                <div class="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="user-password"
                    v-model="userPassword"
                    type="password"
                    autocomplete="new-password"
                    :placeholder="t('users.form.newPassword')"
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
                    {{ isResettingPassword ? t('users.form.resetting') : t('users.form.resetPassword') }}
                  </button>
                </div>
                <span class="users-hint">{{ t('users.form.resetHint') }}</span>
                <span v-if="fieldError('password')" class="users-error">{{ fieldError('password') }}</span>
              </div>

              <fieldset v-if="canAssignRoles && canEditCurrentForm" class="users-field md:col-span-2">
                <legend class="mb-2">{{ t('users.form.roles') }}</legend>
                <div class="flex flex-wrap gap-2">
                  <label v-for="role in roles" :key="role.id" class="users-role-option">
                    <input v-model="selectedRoles" type="checkbox" :value="role.slug" :data-role-slug="role.slug" />
                    <span>{{ role.name }} <span class="users-role-slug">{{ role.slug }}</span></span>
                  </label>
                </div>
                <span class="users-hint">{{ t('users.form.rolesHint') }}</span>
              </fieldset>

              <div v-if="canEditCurrentForm" class="flex items-center gap-3 border-t border-border pt-5 md:col-span-2">
                <button type="submit" :disabled="isSubmitting || isResettingPassword" class="users-primary">
                  {{ isSubmitting ? t('users.form.saving') : isCreating ? t('users.form.create') : t('users.form.save') }}
                </button>
                <button type="button" :disabled="isSubmitting || isResettingPassword" class="users-ghost" @click="closeForm">{{ t('users.form.cancel') }}</button>
              </div>
            </form>
          </section>

          <section class="users-window" aria-labelledby="user-list-title">
            <div class="users-window-bar">
              <span class="users-dots" aria-hidden="true"><span></span><span></span><span></span></span>
              <h2 id="user-list-title" class="users-window-title">{{ t('users.list.title') }}</h2>
              <span class="users-count">{{ t('users.list.total', { count: total }) }}</span>
            </div>

            <p v-if="isLoading" role="status" class="users-empty">{{ t('users.list.loading') }}</p>
            <p v-else-if="users.length === 0" class="users-empty">{{ t('users.list.empty') }}</p>

            <template v-else>
              <div class="overflow-x-auto">
                <table class="users-table" data-testid="user-list">
                  <thead>
                    <tr>
                      <th scope="col">{{ t('users.list.user') }}</th>
                      <th scope="col">{{ t('users.list.roles') }}</th>
                      <th scope="col" class="text-right">{{ t('users.list.actions') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in users" :key="user.id" :data-user-id="user.id">
                      <td>
                        <div class="flex items-center gap-3.5">
                          <span class="users-avatar">
                            <img v-if="user.avatar" :src="user.avatar" :alt="t('users.list.avatarAlt', { name: user.name })" class="h-full w-full object-cover" />
                            <span v-else>{{ user.name.slice(0, 2).toUpperCase() }}</span>
                          </span>
                          <span class="min-w-0">
                            <span class="block truncate font-heading font-bold tracking-[-0.02em]">{{ user.name }}</span>
                            <span class="block truncate text-[13px] text-muted-foreground">{{ user.email }}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div class="flex flex-wrap gap-1.5">
                          <span v-for="role in user.roles" :key="role" :class="['users-chip', { 'users-chip--admin': role === 'admin' }]">{{ roleLabel(role) }}</span>
                          <span v-if="user.roles.length === 0" class="text-[13px] text-muted-foreground">{{ t('users.list.noRoles') }}</span>
                        </div>
                      </td>
                      <td class="text-right">
                        <div class="users-row-actions">
                          <button v-if="canEditUser(user) || canResetUser(user)" type="button" :disabled="isResettingPassword || isSubmitting || Boolean(pendingDelete)" :data-testid="`edit-user-${user.id}`" class="users-btn users-btn--sm" @click="openEdit(user)">{{ canEditUser(user) ? t('users.list.edit') : t('users.form.resetPassword') }}</button>
                          <button v-if="canDeleteUser(user)" type="button" :disabled="isResettingPassword || isSubmitting || Boolean(pendingDelete)" :data-testid="`delete-user-${user.id}`" class="users-btn users-btn--sm users-btn--danger" @click="requestDelete(user)">{{ t('users.list.delete') }}</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="users-pager">
                <button type="button" data-testid="user-previous" :disabled="page <= 1 || isLoading || Boolean(pendingDelete) || isDeleting" class="users-btn users-btn--sm" @click="goToPage(page - 1)">{{ t('users.list.previous') }}</button>
                <span aria-live="polite" class="users-pager-label">{{ t('users.list.page', { page, pages: totalPages }) }}</span>
                <button type="button" data-testid="user-next" :disabled="page >= totalPages || isLoading || Boolean(pendingDelete) || isDeleting" class="users-btn users-btn--sm" @click="goToPage(page + 1)">{{ t('users.list.next') }}</button>
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
