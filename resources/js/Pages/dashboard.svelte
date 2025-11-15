<script>
  import { fly } from 'svelte/transition';
  import { page, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import axios from 'axios';
  import { Toast } from '../Components/helper';

  export let users = [];
  export let total;
  export let search = '';
  export let filter = 'all';
  export let pageCurrent;

  const currentUser = $page.props.user;

  let showUserModal = false;
  let isSubmitting = false;
  let mode = 'create';
  let form = {
    id: null,
    name: '',
    email: '',
    phone: '',
    is_admin: false,
    is_verified: false,
    password: ''
  };

  function resetForm() {
    form = {
      id: null,
      name: '',
      email: '',
      phone: '',
      is_admin: false,
      is_verified: false,
      password: ''
    };
  }

  function openCreateUser() {
    mode = 'create';
    resetForm();
    showUserModal = true;
  }

  function openEditUser(userItem) {
    mode = 'edit';
    form = {
      id: userItem.id,
      name: userItem.name || '',
      email: userItem.email || '',
      phone: userItem.phone || '',
      is_admin: !!userItem.is_admin,
      is_verified: !!userItem.is_verified,
      password: ''
    };
    showUserModal = true;
  }

  function closeUserModal() {
    showUserModal = false;
    resetForm();
  }

  async function submitUserForm() {
    if (!form.name || !form.email) {
      Toast('Nama dan email wajib diisi', 'error');
      return;
    }

    isSubmitting = true;

    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        is_admin: form.is_admin,
        is_verified: form.is_verified,
        password: form.password || undefined
      };

      if (mode === 'create') {
        await axios.post('/users', payload);
        Toast('User berhasil dibuat', 'success');
      } else {
        await axios.put(`/users/${form.id}`, payload);
        Toast('User berhasil diupdate', 'success');
      }

      closeUserModal();
      router.visit('/dashboard', { preserveScroll: true, preserveState: true });
    } catch (error) {
      const message = error?.response?.data?.message || 'Terjadi kesalahan, coba lagi';
      Toast(message, 'error');
    }

    isSubmitting = false;
  }

  async function deleteUser(id) {
    if (!confirm('Yakin ingin menghapus user ini?')) {
      return;
    }

    isSubmitting = true;

    try {
      await axios.delete('/users', { data: { ids: [id] } });
      Toast('User berhasil dihapus', 'success');
      router.visit('/dashboard', { preserveScroll: true, preserveState: true });
    } catch (error) {
      const message = error?.response?.data?.message || 'Gagal menghapus user';
      Toast(message, 'error');
    }

    isSubmitting = false;
  }
</script>

<Header group="dashboard" />

<section class="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
    <div class="grid gap-10 lg:grid-cols-[3fr,2fr] items-start">
      <div in:fly={{ x: -20, duration: 600 }}>
        <p class="text-xs tracking-[0.35em] uppercase text-slate-400 mb-4">
          Dashboard
        </p>
        <h1 class="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.25] mb-4">
          Selamat datang kembali,
          <span
            class="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
          >
            {$page.props.user?.name || 'Nara user'}
          </span>
        </h1>
        <p class="text-base sm:text-lg text-slate-300/90 max-w-xl mb-8">
          Ini adalah ringkasan singkat aktivitas dan data akun kamu. Desain dan nuansanya
          dibuat senada dengan landing page supaya terasa satu produk yang utuh.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-xs text-slate-300/90">
          <div class="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Users</p>
            <p class="text-lg font-semibold text-slate-50">{users?.length ?? 0}</p>
          </div>
          <div class="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Filter</p>
            <p class="text-sm font-medium capitalize">{filter}</p>
          </div>
          <div class="rounded-2xl bg-slate-900/80 border border-slate-800 px-4 py-3">
            <p class="text-[11px] tracking-[0.18em] uppercase text-slate-500 mb-1">Halaman</p>
            <p class="text-sm font-medium">{pageCurrent || 1}</p>
          </div>
        </div>
      </div>

      <div class="relative" in:fly={{ x: 20, duration: 600, delay: 80 }}>
        <div class="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/20 via-cyan-500/10 to-transparent blur-2xl"></div>
        <div class="relative rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.8)]">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-medium tracking-[0.18em] uppercase text-slate-500">Account snapshot</span>
            <span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 px-3 py-1 text-[10px] font-medium text-emerald-200">
              ● Active
            </span>
          </div>

          <div class="space-y-4 text-xs text-slate-200/90">
            <div class="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3 border border-slate-800">
              <div>
                <p class="text-[11px] uppercase tracking-[0.18em] text-slate-500">Email</p>
                <p class="text-sm font-medium">{$page.props.user?.email}</p>
              </div>
              <span class="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-300">
                {($page.props.user?.is_verified ? 'verified' : 'unverified')}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Status</p>
                <p class="text-sm font-semibold text-slate-50">{($page.props.user?.is_admin ? 'Admin' : 'User')}</p>
              </div>
              <div class="rounded-2xl bg-slate-900/70 border border-slate-800 px-3 py-3">
                <p class="text-[11px] text-slate-500 mb-1">Search</p>
                <p class="text-sm font-semibold text-slate-50 truncate">{search || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-slate-800 bg-slate-950">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-slate-400">User list</h2>
        <p class="text-xs text-slate-500">Menampilkan data user dari backend, layout senada dengan landing.</p>
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

    <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <table class="min-w-full text-sm text-slate-200">
        <thead class="bg-slate-900/90 border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-500">
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
              <tr class="border-t border-slate-800/70 hover:bg-slate-800/60">
                <td class="px-4 py-3 font-medium">{userItem.name}</td>
                <td class="px-4 py-3 text-slate-300">{userItem.email}</td>
                <td class="px-4 py-3 text-slate-400">{userItem.phone || '-'}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium {userItem.is_verified ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/70 text-slate-300'}">
                    {userItem.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                {#if currentUser && currentUser.is_admin}
                  <td class="px-4 py-3 text-right space-x-2">
                    <button
                      class="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs text-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
              <td colspan={currentUser && currentUser.is_admin ? 5 : 4} class="px-4 py-6 text-center text-slate-500 text-sm">Belum ada data user untuk ditampilkan.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
  {#if showUserModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold tracking-[0.18em] uppercase text-slate-400">
            {mode === 'create' ? 'Tambah user baru' : 'Edit user'}
          </h3>
          <button
            class="text-slate-400 hover:text-slate-200 text-sm"
            on:click={closeUserModal}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <form class="space-y-4" on:submit|preventDefault={submitUserForm}>
          <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-400">Nama</label>
            <input
              class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              type="text"
              bind:value={form.name}
              placeholder="Nama lengkap"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-400">Email</label>
            <input
              class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              type="email"
              bind:value={form.email}
              placeholder="Alamat email"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-400">No. HP</label>
            <input
              class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              type="text"
              bind:value={form.phone}
              placeholder="Nomor HP (opsional)"
            />
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs text-slate-300">
            <label class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                class="rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-400/60"
                bind:checked={form.is_admin}
              />
              <span>Admin</span>
            </label>
            <label class="inline-flex items-center gap-2">
              <input
                type="checkbox"
                class="rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-400/60"
                bind:checked={form.is_verified}
              />
              <span>Verified</span>
            </label>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-medium text-slate-400">
              {mode === 'create' ? 'Password (opsional, default pakai email)' : 'Password baru (opsional)'}
            </label>
            <input
              class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
              type="password"
              bind:value={form.password}
              placeholder={mode === 'create' ? 'Kosongkan untuk gunakan email sebagai password' : 'Biarkan kosong jika tidak mengganti password'}
            />
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="inline-flex items-center px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              on:click={closeUserModal}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              class="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-medium shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {#if isSubmitting}
                Menyimpan...
              {:else}
                {mode === 'create' ? 'Simpan user' : 'Update user'}
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</section>
