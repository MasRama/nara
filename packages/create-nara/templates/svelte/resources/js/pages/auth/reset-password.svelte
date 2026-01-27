<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import NaraIcon from '../../components/NaraIcon.svelte';
  import DarkModeToggle from '../../components/DarkModeToggle.svelte';
  import { password_generator, Toast } from '../../components/helper';

  interface ResetPasswordForm {
    password: string;
    password_confirmation: string;
    id: string;
  }

  let { id, error }: { id: string, error?: string } = $props();

  $effect(() => {
    if (error) Toast(error, 'error');
  });

  let form: ResetPasswordForm = {
    password: '',
    password_confirmation: '',
    id
  }
 
  function generatePassword(): void { 
    const retVal = password_generator(10); 
    form.password = retVal
    form.password_confirmation = retVal
  }

  function submitForm(): void {
    if (form.password != form.password_confirmation) {
      Toast("Password dan konfirmasi password harus sama", "error")
      return;
    }

    router.post(`/reset-password`, form as any)
  }
</script>

<section class="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
  <!-- Header with dark mode toggle -->
  <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
      <div class="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <a href="/" use:inertia class="flex items-center gap-2">
              <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
              <div class="flex flex-col leading-tight">
                  <span class="text-sm font-semibold tracking-tight text-slate-50">Nara</span>
                  <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500">TypeScript framework</span>
              </div>
          </a>
          <div class="flex items-center gap-3">
              <DarkModeToggle />
          </div>
      </div>
  </header>

  <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-screen lg:py-0">
    <div class="flex items-center mb-6 text-2xl font-semibold text-slate-50">
      <NaraIcon></NaraIcon>
    </div>
    <div class="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shadow-[0_24px_80px_rgba(15,23,42,0.8)] md:mt-0 sm:max-w-md xl:p-0">
      <div class="p-6 space-y-4 md:space-y-6 sm:p-8">
        <h1 class="text-xl font-bold leading-tight tracking-tight text-slate-50 md:text-2xl">
          Reset Password
        </h1>

        <form class="space-y-4 md:space-y-6" on:submit|preventDefault={submitForm}>
          <div>
            <label for="password" class="block mb-2 text-sm font-medium text-slate-200">Password Baru</label>
            <input 
              bind:value={form.password}
              type="password" 
              name="password" 
              id="password" 
              placeholder="••••••••" 
              class="bg-slate-900/70 border border-slate-700 text-slate-50 sm:text-sm rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:outline-none block w-full py-2.5 px-3 placeholder-slate-500"
              required
            >
            <button type="button" on:click={generatePassword} class="text-xs text-slate-400 mt-1">Generate Password</button>
          </div>
          <div>
            <label for="confirm-password" class="block mb-2 text-sm font-medium text-slate-200">Konfirmasi Password</label>
            <input 
              bind:value={form.password_confirmation}
              type="password" 
              name="confirm-password" 
              id="confirm-password" 
              placeholder="••••••••" 
              class="bg-slate-900/70 border border-slate-700 text-slate-50 sm:text-sm rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 focus:outline-none block w-full py-2.5 px-3 placeholder-slate-500"
              required
            >
          </div>

          <button type="submit" class="w-full text-sm font-medium rounded-full px-5 py-2.5 text-slate-950 bg-primary-400 hover:bg-primary-300 focus:ring-4 focus:outline-none focus:ring-primary-300">
            Reset Password
          </button>

          <p class="text-sm font-light text-slate-400">
            Ingat password Anda? <a href="/login" use:inertia class="font-medium text-primary-400 hover:underline">Login disini</a>
          </p>
        </form>
      </div>
    </div>
  </div>
</section>