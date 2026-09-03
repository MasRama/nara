<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { createAccessClient } from '../../../auth/web';
import type { RoleData } from '../../../auth/web';
import { useAuthSession } from '../../../auth/web';
import { createUserInputSchema, updateUserInputSchema } from '../../contract';
import type { ManagedUser, UpdateUserInput } from '../../contract';
import { createUsersClient } from '../client';

type FieldErrors = Record<string, string[]>;

const authSession = useAuthSession();
const usersClient = createUsersClient();
const accessClient = createAccessClient();

const users = ref<ManagedUser[]>([]);
const roles = ref<RoleData[]>([]);
const search = ref('');
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const isLoading = ref(false);
const loadError = ref('');
const loadForbidden = ref(false);
const actionError = ref('');
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

const pendingDelete = ref<ManagedUser | null>(null);
const isDeleting = ref(false);

const canCreate = computed(() => authSession.can('users.create'));
const canEdit = computed(() => authSession.can('users.edit'));
const canDelete = computed(() => authSession.can('users.delete'));
const canAssignRoles = computed(() => authSession.hasRole('admin'));
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)));

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

function roleLabel(slug: string): string {
  return roles.value.find((role) => role.slug === slug)?.name ?? slug;
}

async function loadUsers(nextPage = page.value): Promise<void> {
  isLoading.value = true;
  loadError.value = '';
  loadForbidden.value = false;
  try {
    const response = await usersClient.listUsers({ page: nextPage, limit: limit.value, search: search.value });
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
    loadError.value = error instanceof Error ? error.message : 'Unable to load users';
    users.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadRoles(): Promise<void> {
  if (!canAssignRoles.value) return;

  try {
    const response = await accessClient.listRoles();
    if (response.success && response.data) {
      roles.value = response.data.roles;
    } else if (!response.success && response.code !== 'FORBIDDEN') {
      actionError.value = response.message;
    }
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to load roles';
  }
}

function submitSearch(): void {
  page.value = 1;
  void loadUsers(1);
}

function changeLimit(): void {
  page.value = 1;
  void loadUsers(1);
}

function goToPage(nextPage: number): void {
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
  resetForm();
  isCreating.value = true;
  isFormOpen.value = true;
  actionError.value = '';
}

function openEdit(user: ManagedUser): void {
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
  if (isSubmitting.value) return;
  isFormOpen.value = false;
  resetForm();
}

function validateUser(): UpdateUserInput | undefined {
  const payload = {
    name: userName.value,
    email: userEmail.value,
    ...(userPassword.value ? { password: userPassword.value } : {}),
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
      notice.value = response.message;
      await loadUsers(1);
    } catch (error) {
      formError.value = error instanceof Error ? error.message : 'Unable to create user';
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
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }
    isFormOpen.value = false;
    resetForm();
    notice.value = response.message;
    await loadUsers(page.value);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Unable to update user';
  } finally {
    isSubmitting.value = false;
  }
}

function requestDelete(user: ManagedUser): void {
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
    notice.value = response.message;
    pendingDelete.value = null;
    await loadUsers(page.value);
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Unable to delete user';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  void Promise.all([loadUsers(1), loadRoles()]);
});
</script>

<template>
  <main class="relative overflow-hidden px-6 py-12 sm:px-10 lg:px-16 lg:py-16" data-testid="users-page">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] text-foreground opacity-[0.03] [background-size:22px_22px] dark:opacity-[0.05]"></div>

    <section class="relative mx-auto max-w-[1250px]">
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">Administration</p>
            <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Users</h1>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Search accounts, manage access, and keep user records current.
            </p>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <RouterLink to="/dashboard" class="text-muted-foreground transition-colors hover:text-foreground">Dashboard</RouterLink>
            <button
              v-if="canCreate"
              type="button"
              data-testid="create-user"
              class="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              @click="openCreate"
            >
              New user
            </button>
          </div>
        </div>

        <p v-if="loadForbidden" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          You do not have permission to view users.
        </p>
        <p v-if="loadError" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ loadError }}</p>
        <p v-if="actionError" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ actionError }}</p>
        <p v-if="notice" role="status" class="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">{{ notice }}</p>

        <template v-if="!loadForbidden">
          <section class="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="user-search-title">
            <div class="mb-4">
              <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Directory</p>
              <h2 id="user-search-title" class="mt-2 font-heading text-xl font-semibold tracking-tight">Find users</h2>
            </div>
            <form class="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end" data-testid="user-search-form" @submit.prevent="submitSearch">
              <label class="grid gap-2 text-sm font-medium" for="user-search">
                Search by name or email
                <input
                  id="user-search"
                  v-model="search"
                  type="search"
                  class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                  placeholder="Search users"
                />
              </label>
              <label class="grid gap-2 text-sm font-medium" for="user-page-size">
                Per page
                <select
                  id="user-page-size"
                  v-model.number="limit"
                  class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                  @change="changeLimit"
                >
                  <option :value="5">5</option>
                  <option :value="1">1</option>
                  <option :value="10">10</option>
                  <option :value="25">25</option>
                </select>
              </label>
              <button type="submit" class="h-10 rounded-md border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary">Search</button>
            </form>
          </section>

          <section v-if="isFormOpen" class="rounded-2xl border border-primary/30 bg-card p-5 shadow-soft sm:p-6" aria-labelledby="user-form-title">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 id="user-form-title" class="mt-2 font-heading text-xl font-semibold tracking-tight">{{ isCreating ? 'Create user' : 'Edit user' }}</h2>
              </div>
              <button type="button" class="text-sm text-muted-foreground hover:text-foreground" :disabled="isSubmitting" @click="closeForm">Close</button>
            </div>

            <p v-if="formError" role="alert" class="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ formError }}</p>
            <form class="mt-5 grid gap-5 md:grid-cols-2" data-testid="user-form" @submit.prevent="submitUser">
              <label class="grid gap-2 text-sm font-medium" for="user-name">
                Name
                <input id="user-name" v-model="userName" type="text" autocomplete="name" class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary" />
                <span v-if="fieldError('name')" class="text-xs font-normal text-destructive">{{ fieldError('name') }}</span>
              </label>
              <label class="grid gap-2 text-sm font-medium" for="user-email">
                Email
                <input id="user-email" v-model="userEmail" type="email" autocomplete="email" class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary" />
                <span v-if="fieldError('email')" class="text-xs font-normal text-destructive">{{ fieldError('email') }}</span>
              </label>
              <label class="grid gap-2 text-sm font-medium" for="user-password">
                Password
                <input id="user-password" v-model="userPassword" type="password" autocomplete="new-password" :required="isCreating" class="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary" />
                <span class="text-xs font-normal text-muted-foreground">{{ isCreating ? 'Required; use at least 8 characters.' : 'Leave blank to keep the current password.' }}</span>
                <span v-if="fieldError('password')" class="text-xs font-normal text-destructive">{{ fieldError('password') }}</span>
              </label>

              <fieldset v-if="canAssignRoles" class="grid gap-2 text-sm font-medium">
                <legend>Roles</legend>
                <span class="text-xs font-normal text-muted-foreground">Role assignment is limited by the server to administrators.</span>
                <label v-for="role in roles" :key="role.id" class="flex items-center gap-2 font-normal">
                  <input v-model="selectedRoles" type="checkbox" :value="role.slug" :data-role-slug="role.slug" />
                  <span>{{ role.name }} <span class="text-muted-foreground">({{ role.slug }})</span></span>
                </label>
              </fieldset>

              <div class="flex items-center gap-3 md:col-span-2">
                <button type="submit" :disabled="isSubmitting" class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                  {{ isSubmitting ? 'Saving…' : isCreating ? 'Create user' : 'Save changes' }}
                </button>
                <button type="button" :disabled="isSubmitting" class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground" @click="closeForm">Cancel</button>
              </div>
            </form>
          </section>

          <p v-if="isLoading" role="status" class="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Loading users…</p>
          <p v-else-if="users.length === 0" class="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No users match this search.</p>

          <section v-else class="overflow-hidden rounded-2xl border border-border bg-card shadow-soft" aria-labelledby="user-list-title">
            <div class="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h2 id="user-list-title" class="font-heading text-xl font-semibold tracking-tight">User accounts</h2>
                <p class="mt-1 text-sm text-muted-foreground">{{ total }} total user{{ total === 1 ? '' : 's' }}</p>
              </div>
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <button type="button" data-testid="user-previous" :disabled="page <= 1 || isLoading" class="rounded-md border border-border px-3 py-2 transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" @click="goToPage(page - 1)">Previous</button>
                <span aria-live="polite">Page {{ page }} of {{ totalPages }}</span>
                <button type="button" data-testid="user-next" :disabled="page >= totalPages || isLoading" class="rounded-md border border-border px-3 py-2 transition-colors hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" @click="goToPage(page + 1)">Next</button>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full min-w-[760px] text-left text-sm" data-testid="user-list">
                <thead class="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  <tr>
                    <th scope="col" class="px-5 py-3 font-medium sm:px-6">User</th>
                    <th scope="col" class="px-5 py-3 font-medium sm:px-6">Roles</th>
                    <th scope="col" class="px-5 py-3 text-right font-medium sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr v-for="user in users" :key="user.id" :data-user-id="user.id">
                    <td class="px-5 py-4 sm:px-6">
                      <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-medium">
                          <img v-if="user.avatar" :src="user.avatar" :alt="`${user.name} avatar`" class="h-full w-full object-cover" />
                          <span v-else>{{ user.name.slice(0, 2).toUpperCase() }}</span>
                        </span>
                        <span class="min-w-0">
                          <span class="block truncate font-medium">{{ user.name }}</span>
                          <span class="block truncate text-muted-foreground">{{ user.email }}</span>
                        </span>
                      </div>
                    </td>
                    <td class="px-5 py-4 sm:px-6">
                      <div class="flex flex-wrap gap-1.5">
                        <span v-for="role in user.roles" :key="role" class="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{{ roleLabel(role) }}</span>
                        <span v-if="user.roles.length === 0" class="text-muted-foreground">No roles</span>
                      </div>
                    </td>
                    <td class="px-5 py-4 text-right sm:px-6">
                      <div class="flex justify-end gap-2">
                        <button v-if="canEdit" type="button" :data-testid="`edit-user-${user.id}`" class="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary" @click="openEdit(user)">Edit</button>
                        <button v-if="canDelete" type="button" :data-testid="`delete-user-${user.id}`" class="rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10" @click="requestDelete(user)">Delete</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <section v-if="pendingDelete" class="rounded-xl border border-destructive/30 bg-destructive/10 p-5" role="dialog" aria-labelledby="delete-user-title">
          <h2 id="delete-user-title" class="font-heading font-semibold">Delete {{ pendingDelete.name }}?</h2>
          <p class="mt-2 text-sm text-muted-foreground">This action cannot be undone. Server protection rules still apply to self-delete and the last administrator.</p>
          <div class="mt-4 flex gap-3">
            <button type="button" data-testid="confirm-delete" :disabled="isDeleting" class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60" @click="confirmDelete">{{ isDeleting ? 'Deleting…' : 'Delete user' }}</button>
            <button type="button" data-testid="cancel-delete" :disabled="isDeleting" class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground" @click="cancelDelete">Cancel</button>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
