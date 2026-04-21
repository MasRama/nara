<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import NaraIcon from '../../Components/NaraIcon.svelte';
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte';
  import { buildCSRFHeaders } from '$lib/csrf';
  import { password_generator } from '$lib/utils/password';
  import { Toast } from '$lib/toast';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

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

  function submitForm(): void {
    if (form.password != form.password_confirmation) {
      Toast("Password dan konfirmasi password harus sama", "error")
      return;
    }

    router.post(`/reset-password`, { ...form, id } as any, {
      headers: buildCSRFHeaders()
    })
  }
</script>

<section class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
  <header class="fixed inset-x-0 top-0 z-40 border-b border-slate-200 dark:border-slate-800/60 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
      <div class="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
          <a href="/" use:inertia class="flex items-center gap-2">
              <img src="/public/nara.png" alt="Nara logo" class="h-7 w-7 rounded-lg object-cover" />
              <div class="flex flex-col leading-tight">
                  <span class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50">Nara</span>
                  <span class="text-[10px] uppercase tracking-[0.22em] text-slate-500">TypeScript framework</span>
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
    
    <Card class="w-full max-w-md shadow-lg">
      <CardHeader>
        <CardTitle class="text-xl md:text-2xl">Reset Password</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  </div>
</section>