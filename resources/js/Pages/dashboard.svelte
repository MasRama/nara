<script>
  import { fly } from 'svelte/transition';
  import { page } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';

  export let users = [];
  export let total;
  export let search = '';
  export let filter = 'all';
  export let pageCurrent;
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
      <h2 class="text-sm font-semibold tracking-[0.18em] uppercase text-slate-400">User list</h2>
      <p class="text-xs text-slate-500">Menampilkan data user dari backend, layout senada dengan landing.</p>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <table class="min-w-full text-sm text-slate-200">
        <thead class="bg-slate-900/90 border-b border-slate-800 text-xs uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th class="px-4 py-3 text-left">Nama</th>
            <th class="px-4 py-3 text-left">Email</th>
            <th class="px-4 py-3 text-left">Phone</th>
            <th class="px-4 py-3 text-left">Verified</th>
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
              </tr>
            {/each}
          {:else}
            <tr>
              <td colspan="4" class="px-4 py-6 text-center text-slate-500 text-sm">Belum ada data user untuk ditampilkan.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</section>
