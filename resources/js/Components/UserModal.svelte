<script lang="ts">
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
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

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }
</script>

{#if show}
  <!-- Backdrop -->
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
    transition:fade={{ duration: 300 }}
  >
    <!-- Background Blur & Overlay -->
    <div class="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
    
    <!-- Decorative Elements -->
    <div class="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- Modal Container -->
    <div 
      class="relative w-full max-w-lg"
      transition:fly={{ y: 50, duration: 500, easing: backOut }}
    >
      <!-- Glowing Border Effect -->
      <div class="absolute -inset-px bg-gradient-to-br from-accent-500/50 via-transparent to-primary-500/50 rounded-3xl blur-sm opacity-60"></div>
      
      <!-- Modal Content -->
      <div class="relative bg-white dark:bg-surface-dark rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
        
        <!-- Header -->
        <div class="relative px-8 pt-8 pb-6 border-b border-slate-100 dark:border-white/5">
          <!-- Decorative Line -->
          <div class="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-accent-500/50 to-transparent"></div>
          
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-[0.3em] text-accent-600 dark:text-accent-400 mb-2">
                {mode === 'create' ? 'New Entry' : 'Edit Entry'}
              </p>
              <h3 id="modal-title" class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {mode === 'create' ? 'Create User' : 'Update User'}
              </h3>
            </div>
            
            <!-- Close Button -->
            <button
              class="group w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-white/10 hover:border-red-500/50 hover:bg-red-500/5 transition-all duration-300"
              onclick={handleClose}
              disabled={isSubmitting}
              aria-label="Close modal"
            >
              <svg class="w-4 h-4 text-slate-400 group-hover:text-red-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Form -->
        <form class="p-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          
          <!-- Name Field -->
          <div class="group">
            <label for="user-name" class="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
              Full Name
            </label>
            <div class="relative">
              <input
                id="user-name"
                class="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-slate-200 dark:border-white/10 text-lg text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-accent-500 dark:focus:border-accent-400 focus:ring-0 outline-none transition-colors"
                type="text"
                bind:value={form.name}
                placeholder="Enter full name"
              />
              <div class="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-500 group-focus-within:w-full transition-all duration-500"></div>
            </div>
          </div>

          <!-- Email Field -->
          <div class="group">
            <label for="user-email" class="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
              Email Address
            </label>
            <div class="relative">
              <input
                id="user-email"
                class="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-slate-200 dark:border-white/10 text-lg text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-accent-500 dark:focus:border-accent-400 focus:ring-0 outline-none transition-colors"
                type="email"
                bind:value={form.email}
                placeholder="user@example.com"
              />
            </div>
          </div>

          <!-- Phone Field -->
          <div class="group">
            <label for="user-phone" class="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
              Phone Number
              <span class="text-slate-400 dark:text-slate-600 font-normal normal-case tracking-normal ml-1">(optional)</span>
            </label>
            <div class="relative">
              <input
                id="user-phone"
                class="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-slate-200 dark:border-white/10 text-lg text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-0 outline-none transition-colors font-mono"
                type="text"
                bind:value={form.phone}
                placeholder="+62 xxx xxxx xxxx"
              />
            </div>
          </div>

          <!-- Role & Status Toggles -->
          <div class="grid grid-cols-2 gap-4 pt-2">
            <!-- Admin Toggle -->
            <label class="group relative flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-accent-500/30 cursor-pointer transition-all duration-300 {form.roles?.includes('admin') ? 'bg-accent-500/5 border-accent-500/30' : ''}">
              <div class="relative">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  checked={form.roles?.includes('admin')}
                  onchange={(e) => {
                    const isAdmin = e.currentTarget.checked;
                    if (isAdmin) {
                      form.roles = [...(form.roles || []), 'admin'];
                    } else {
                      form.roles = (form.roles || []).filter(r => r !== 'admin');
                    }
                  }}
                />
                <div class="w-12 h-7 bg-slate-200 dark:bg-white/10 rounded-full peer-checked:bg-accent-500 transition-colors"></div>
                <div class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform"></div>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">Admin</p>
                <p class="text-[10px] text-slate-400 dark:text-slate-500">Full access</p>
              </div>
            </label>

            <!-- Verified Toggle -->
            <label class="group relative flex items-center gap-4 p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:border-primary-500/30 cursor-pointer transition-all duration-300 {form.is_verified ? 'bg-primary-500/5 border-primary-500/30' : ''}">
              <div class="relative">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  bind:checked={form.is_verified}
                />
                <div class="w-12 h-7 bg-slate-200 dark:bg-white/10 rounded-full peer-checked:bg-primary-500 transition-colors"></div>
                <div class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform"></div>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">Verified</p>
                <p class="text-[10px] text-slate-400 dark:text-slate-500">Email confirmed</p>
              </div>
            </label>
          </div>

          <!-- Password Field -->
          <div class="group pt-2">
            <label for="user-password" class="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3">
              {mode === 'create' ? 'Password' : 'New Password'}
              <span class="text-slate-400 dark:text-slate-600 font-normal normal-case tracking-normal ml-1">(optional)</span>
            </label>
            <div class="relative">
              <input
                id="user-password"
                class="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-slate-200 dark:border-white/10 text-lg text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:border-accent-500 dark:focus:border-accent-400 focus:ring-0 outline-none transition-colors"
                type="password"
                bind:value={form.password}
                placeholder={mode === 'create' ? 'Leave empty to use email' : 'Leave empty to keep current'}
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-4 pt-6 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              class="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50"
              onclick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="group relative px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-bold uppercase tracking-wider rounded-full overflow-hidden hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:hover:scale-100"
              disabled={isSubmitting}
            >
              <span class="relative z-10 flex items-center gap-2">
                {#if isSubmitting}
                  <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                {:else}
                  {mode === 'create' ? 'Create User' : 'Save Changes'}
                  <svg class="w-4 h-4 transform group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                {/if}
              </span>
              <div class="absolute inset-0 bg-gradient-to-r from-accent-500 to-primary-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
