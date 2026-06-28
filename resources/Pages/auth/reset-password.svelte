<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import axios from 'axios'
  import { api } from '$lib/api'
  import NaraIcon from '../../Components/NaraIcon.svelte';
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte';
  import { password_generator } from '$lib/utils/password';
  import { Toast } from '$lib/toast';
  import Button from '../../Components/Button.svelte';
  import Input from '../../Components/Input.svelte';
  import Label from '../../Components/Label.svelte';

  interface ResetPasswordForm {
    password: string;
    password_confirmation: string;
  }

  let { id, error }: { id: string, error?: string } = $props();

  $effect(() => {
    if (error) Toast(error, 'error');
  });

  let form: ResetPasswordForm = $state({
    password: '',
    password_confirmation: ''
  })
 
  function generatePassword(): void { 
    const retVal = password_generator(10); 
    form.password = retVal
    form.password_confirmation = retVal
  }

  async function submitForm(): Promise<void> {
    if (form.password != form.password_confirmation) {
      Toast("Passwords do not match", "error")
      return;
    }

    const result = await api(() => axios.post(`/reset-password`, { ...form, id }));
    if (result.success) router.visit('/login');
  }
</script>

<section class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
  <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
      <div class="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <a href="/" use:inertia class="flex items-center gap-2">
              <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
              <div class="flex flex-col leading-tight">
                  <span class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Nara</span>
                  <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500">TypeScript starter kit</span>
              </div>
          </a>
          <div class="flex items-center gap-3">
              <DarkModeToggle />
          </div>
      </div>
  </header>

  <div class="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-screen lg:py-0">
    <div class="flex items-center mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-50">
      <NaraIcon />
    </div>
    
    <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
      <h2 class="text-xl font-semibold tracking-tight mb-6">Reset Password</h2>
      <form class="space-y-4 md:space-y-6" onsubmit={(e) => { e.preventDefault(); submitForm(); }}>
        <div class="space-y-2">
          <Label for="password">Password Baru</Label>
          <Input 
            bind:value={form.password}
            type="password" 
            name="password" 
            id="password" 
            placeholder="••••••••" 
            required
          />
          <Button variant="link" type="button" onclick={generatePassword} class="h-auto p-0 text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate Password
          </Button>
        </div>
        
        <div class="space-y-2">
          <Label for="confirm-password">Konfirmasi Password</Label>
          <Input 
            bind:value={form.password_confirmation}
            type="password" 
            name="confirm-password" 
            id="confirm-password" 
            placeholder="••••••••" 
            required
          />
        </div>

        <Button type="submit" class="w-full">
          Reset Password
        </Button>

        <p class="text-sm font-light text-slate-500 dark:text-slate-400">
          Ingat password Anda? <a href="/login" use:inertia class="font-medium text-primary-600 dark:text-primary-400 hover:underline">Login disini</a>
        </p>
      </form>
    </div>
  </div>
</section>