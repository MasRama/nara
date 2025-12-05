<script lang="ts">
  import type { UserForm } from '../types';
  import { createEventDispatcher } from 'svelte';

  export let show: boolean = false;
  export let mode: 'create' | 'edit' = 'create';
  export let form: UserForm;
  export let isSubmitting: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: UserForm;
  }>();

  function handleClose(): void {
    dispatch('close');
  }

  function handleSubmit(): void {
    dispatch('submit', form);
  }
</script>

{#if show}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold tracking-[0.18em] uppercase text-slate-400">
          {mode === 'create' ? 'Tambah user baru' : 'Edit user'}
        </h3>
        <button
          class="text-slate-400 hover:text-slate-200 text-sm"
          on:click={handleClose}
          disabled={isSubmitting}
        >
          ✕
        </button>
      </div>

      <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-1">
          <label for="user-name" class="block text-xs font-medium text-slate-400">Nama</label>
          <input
            id="user-name"
            class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
            type="text"
            bind:value={form.name}
            placeholder="Nama lengkap"
          />
        </div>

        <div class="space-y-1">
          <label for="user-email" class="block text-xs font-medium text-slate-400">Email</label>
          <input
            id="user-email"
            class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none"
            type="email"
            bind:value={form.email}
            placeholder="Alamat email"
          />
        </div>

        <div class="space-y-1">
          <label for="user-phone" class="block text-xs font-medium text-slate-400">No. HP</label>
          <input
            id="user-phone"
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
          <label for="user-password" class="block text-xs font-medium text-slate-400">
            {mode === 'create' ? 'Password (opsional, default pakai email)' : 'Password baru (opsional)'}
          </label>
          <input
            id="user-password"
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
            on:click={handleClose}
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
