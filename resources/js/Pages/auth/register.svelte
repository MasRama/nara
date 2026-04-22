<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import { password_generator } from '$lib/utils/password';
  import { Toast } from '$lib/toast';
  import NaraIcon from '../../Components/NaraIcon.svelte';
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte';
  import { fly } from 'svelte/transition';

  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Alert, AlertDescription } from '$lib/components/ui/alert';
  import { Eye, EyeOff } from 'lucide-svelte';

  interface RegisterForm {
    email: string;
    password: string;
    name: string;
    phone: string;
    password_confirmation: string;
  }

  let form: RegisterForm = $state({
    email: '',
    password: '',
    name: '',
    phone: '',
    password_confirmation: '',
  });

  let showPassword = $state(false);
  let showConfirm = $state(false);

  let { error }: { error?: string } = $props();

  $effect(() => {
    if (error) Toast(error, 'error');
  });

  function submitForm(): void {
    if (form.password != form.password_confirmation) {
      Toast("Password dan konfirmasi password harus sama", "error");
      return;
    }

    form.phone = form.phone.toString()
    router.post("/register", form as Record<string, unknown>, {})
  }

  function generatePassword(): void {
    const retVal = password_generator(10);
    form.password = retVal
    form.password_confirmation = retVal
  }
</script>

<div class="min-h-screen bg-background text-foreground font-body transition-colors duration-500 relative overflow-hidden">

  <div class="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]"></div>
  <div class="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

  <nav class="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 flex justify-between items-center py-5">
    <a href="/" class="text-xl font-heading font-bold tracking-tighter hover:opacity-70 transition-opacity flex items-center gap-2" style="font-feature-settings: 'ss01'">
      <NaraIcon />
      <span>NARA.</span>
    </a>
    <DarkModeToggle />
  </nav>

  <div class="flex items-center justify-center min-h-screen px-6 py-24">
    <div class="w-full max-w-sm" in:fly={{ y: 20, duration: 800, delay: 100 }}>

      <div class="mb-8">
        <span class="block text-xs font-mono-accent font-semibold uppercase tracking-widest text-primary mb-3">New account</span>
        <h1 class="text-4xl font-heading font-bold tracking-tighter" style="font-feature-settings: 'ss01'">Create Account.</h1>
      </div>

      {#if error}
        <Alert variant="destructive" class="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      {/if}

      <div class="flex flex-col gap-4 mb-8">
        <a href="/google/redirect"
           class="group w-full flex items-center justify-center px-6 py-3.5 border border-border bg-card hover:border-primary/40 hover:bg-secondary rounded-2xl transition-all duration-300 cursor-pointer">
          <svg class="h-4 w-4 mr-3 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span class="font-body font-medium text-foreground text-sm">Sign up with Google</span>
        </a>

        <div class="relative py-1">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-border"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="bg-background px-4 text-muted-foreground font-mono-accent text-[10px] uppercase tracking-widest">Or via email</span>
          </div>
        </div>
      </div>

      <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); submitForm(); }}>
        <div class="space-y-2">
          <Label for="name">Full Name</Label>
          <Input bind:value={form.name} required type="text" name="name" id="name" placeholder="Rama Ren" />
        </div>

        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input bind:value={form.email} required type="text" name="email" id="email" placeholder="nara@example.com" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <div class="relative">
              <Input bind:value={form.password} required type={showPassword ? 'text' : 'password'} name="password" id="password" placeholder="••••••••" class="pr-10" />
              <button type="button" onclick={() => showPassword = !showPassword} class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <Label for="confirm-password">Confirm</Label>
            <div class="relative">
              <Input bind:value={form.password_confirmation} required type={showConfirm ? 'text' : 'password'} name="confirm-password" id="confirm-password" placeholder="••••••••" class="pr-10" />
              <button type="button" onclick={() => showConfirm = !showConfirm} class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
                {#if showConfirm}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <Button variant="ghost" size="sm" type="button" onclick={generatePassword} class="text-xs font-mono-accent text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 cursor-pointer h-auto py-1 px-0">
            <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H12" stroke-linecap="round" stroke-linejoin="round"/></svg>
            GENERATE SECURE PASSWORD
          </Button>
        </div>

        <Button type="submit" size="lg" class="w-full rounded-full py-6 font-heading font-semibold tracking-wide hover:scale-105 active:scale-95 transition-transform text-base shadow-sm mt-2">
          Create Account
        </Button>

        <p class="text-center text-muted-foreground font-body text-sm">
          Already have an account?
          <a href="/login" use:inertia class="font-semibold text-primary hover:underline">Sign in</a>
        </p>
      </form>
    </div>
  </div>

  <footer class="absolute bottom-0 left-0 right-0 px-6 py-5 flex justify-center">
    <span class="text-xs font-mono-accent text-muted-foreground uppercase tracking-widest">&copy; {new Date().getFullYear()} NARA FRAMEWORK</span>
  </footer>

</div>
