<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import UserModal from '../Components/UserModal.svelte';
  import Pagination from '../Components/Pagination.svelte';
  import axios from 'axios';
  import { api, Toast } from '../Components/helper';
  import type { User, UserForm, PaginationMeta } from '../types';
  import { createEmptyUserForm, userToForm } from '../types';

  export let users: User[] = [];
  // Pagination meta from backend
  export let total: number = 0;
  export let page: number = 1;
  export let limit: number = 10;
  export let totalPages: number = 1;
  export let hasNext: boolean = false;
  export let hasPrev: boolean = false;
  export let search: string = '';
  export let filter: string = 'all';

  const currentUser = $inertiaPage.props.user as User | undefined;

  // Build pagination meta object
  $: paginationMeta = { total, page, limit, totalPages, hasNext, hasPrev } as PaginationMeta;

  let showUserModal: boolean = false;
  let isSubmitting: boolean = false;
  let mode: 'create' | 'edit' = 'create';
  let form: UserForm = createEmptyUserForm();

  function openCreateUser(): void {
    mode = 'create';
    form = createEmptyUserForm();
    showUserModal = true;
  }

  function openEditUser(userItem: User): void {
    mode = 'edit';
    form = userToForm(userItem);
    showUserModal = true;
  }

  function closeUserModal(): void {
    showUserModal = false;
    form = createEmptyUserForm();
  }

  async function handleSubmit(event: CustomEvent<UserForm>): Promise<void> {
    const formData = event.detail;
    if (!formData.name || !formData.email) {
      Toast('Nama dan email wajib diisi', 'error');
      return;
    }

    isSubmitting = true;

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || null,
      is_admin: formData.is_admin,
      is_verified: formData.is_verified,
      password: formData.password || undefined
    };

    const result = mode === 'create'
      ? await api(() => axios.post('/users', payload))
      : await api(() => axios.put(`/users/${formData.id}`, payload));

    if (result.success) {
      closeUserModal();
      router.visit('/users', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }

  async function deleteUser(id: string): Promise<void> {
    if (!confirm('Yakin ingin menghapus user ini?')) {
      return;
    }

    isSubmitting = true;

    const result = await api(() => axios.delete('/users', { data: { ids: [id] } }));

    if (result.success) {
      router.visit('/users', { preserveScroll: true, preserveState: true });
    }

    isSubmitting = false;
  }
</script>

<Header group="users" />

<section class="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
    <div class="flex items-center justify-between mb-6">
      <div>
        <p class="text-xs tracking-[0.35em] uppercase text-slate-500 dark:text-slate-400 mb-2">
          Users
        </p>
        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.25] mb-2">
          Manajemen User
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-300/90 max-w-xl">
          Kelola akun pengguna aplikasi di halaman terpisah dari dashboard utama.
        </p>
      </div>
      {#if currentUser && currentUser.is_admin}
        <button
          class="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-medium shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={openCreateUser}
          disabled={isSubmitting}
        >
          Tambah user
        </button>
      {/if}
    </div>

    <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
      <table class="min-w-full text-sm text-slate-700 dark:text-slate-200">
        <thead class="bg-gray-50 dark:bg-slate-900/90 border-b border-gray-200 dark:border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th class="px-4 py-3 text-left">Nama</th>
            <th class="px-4 py-3 text-left">Email</th>
            <th class="px-4 py-3 text-left">Phone</th>
            <th class="px-4 py-3 text-left">Verified</th>
            {#if currentUser && currentUser.is_admin}
              <th class="px-4 py-3 text-right">Aksi</th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#if users && users.length}
            {#each users as userItem}
              <tr class="border-t border-gray-200 dark:border-slate-800/70 hover:bg-gray-50 dark:hover:bg-slate-800/60">
                <td class="px-4 py-3 font-medium">{userItem.name}</td>
                <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{userItem.email}</td>
                <td class="px-4 py-3 text-slate-500 dark:text-slate-400">{userItem.phone || '-'}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium {userItem.is_verified ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-gray-200 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300'}">
                    {userItem.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                {#if currentUser && currentUser.is_admin}
                  <td class="px-4 py-3 text-right space-x-2">
                    <button
                      class="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      on:click={() => openEditUser(userItem)}
                      disabled={isSubmitting}
                    >
                      Edit
                    </button>
                    <button
                      class="inline-flex items-center px-3 py-1.5 rounded-full bg-red-500/90 hover:bg-red-400 text-xs text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                      on:click={() => deleteUser(userItem.id)}
                      disabled={isSubmitting}
                    >
                      Hapus
                    </button>
                  </td>
                {/if}
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan={currentUser && currentUser.is_admin ? 5 : 4} class="px-4 py-6 text-center text-slate-500 dark:text-slate-500 text-sm">Belum ada data user untuk ditampilkan.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    <Pagination meta={paginationMeta} />
  </div>

  <UserModal 
    show={showUserModal} 
    {mode} 
    {form} 
    {isSubmitting}
    on:close={closeUserModal}
    on:submit={handleSubmit}
  />
</section>
