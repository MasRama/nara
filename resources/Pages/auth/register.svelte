<script lang="ts">
  import { inertia, router } from '@inertiajs/svelte'
  import axios from 'axios'
  import { api } from '$lib/api'
  import { password_generator } from '$lib/utils/password'
  import { Toast } from '$lib/toast'
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte'
  import { fly, fade } from 'svelte/transition'
  import { ArrowRight, Eye, EyeOff, Sparkles } from '@lucide/svelte'

  import Button from '../../Components/Button.svelte'
  import Input from '../../Components/Input.svelte'
  import Label from '../../Components/Label.svelte'

  interface RegisterForm {
    email: string
    password: string
    name: string
    password_confirmation: string
  }

  let form: RegisterForm = $state({
    email: '',
    password: '',
    name: '',
    password_confirmation: '',
  })

  let showPassword = $state(false)
  let showConfirm = $state(false)
  let isLoading = $state(false)

  let { error }: { error?: string } = $props()

  $effect(() => {
    if (error) Toast(error, 'error')
  })

  async function submitForm(): Promise<void> {
    if (form.password != form.password_confirmation) {
      Toast('Passwords do not match', 'error')
      return
    }
    isLoading = true
    const result = await api(() => axios.post('/register', form))
    isLoading = false
    if (result.success) router.visit('/dashboard')
  }

  function generatePassword(): void {
    const retVal = password_generator(10)
    form.password = retVal
    form.password_confirmation = retVal
  }
</script>

<div class="relative min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-hidden">

  <!-- ───────────── FULL-BLEED IMAGE BACKGROUND ───────────── -->
  <img
    src="/public/landing/register.webp"
    alt="A quiet beginning"
    class="absolute inset-0 w-full h-full object-cover grayscale contrast-110 brightness-[0.45]"
  />
  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60"></div>
  <div class="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent"></div>

  <!-- ───────────── NAV (floating, like landing) ───────────── -->
  <nav class="relative z-20 flex items-center justify-between h-16 px-6 sm:px-10 lg:px-16">
    <a href="/" use:inertia class="flex items-center gap-2 group">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
      <span class="font-heading font-semibold tracking-tight text-lg text-white">Nara</span>
    </a>
    <div class="flex items-center gap-5 text-sm">
      <a href="/" use:inertia class="text-white/60 hover:text-white transition-colors">Home</a>
      <span class="w-px h-4 bg-white/20"></span>
      <DarkModeToggle />
    </div>
  </nav>

  <!-- ───────────── CONTENT: centered editorial, on image ───────────── -->
  <div class="relative z-10 flex flex-col items-center justify-center text-center min-h-[calc(100dvh-4rem)] px-6 sm:px-10 lg:px-16 pb-20">
    <div class="w-full max-w-[520px]" in:fly={{ y: 30, duration: 1000, delay: 100 }}>

      <p in:fade={{ duration: 700 }} class="font-heading text-xs uppercase tracking-[0.25em] text-white/50 mb-6">
        A foundation for building with AI
      </p>

      <h1 class="font-heading font-semibold tracking-[-0.03em] leading-[0.95] text-[clamp(3rem,8vw,6rem)] text-white" in:fly={{ y: 28, duration: 1000, delay: 150 }}>
        Begin<br />
        <span class="italic font-medium text-primary leading-[1.05] pb-1">quietly.</span>
      </h1>

      <p in:fly={{ y: 22, duration: 1000, delay: 300 }} class="mt-6 text-lg text-white/60 leading-relaxed max-w-[44ch] mx-auto">
        A blank repository, a willing machine, an afternoon. That is all.
      </p>

      {#if error}
        <div in:fade={{ duration: 200 }} role="alert" class="mt-8 rounded-xl border border-red-400/30 bg-red-500/10 backdrop-blur-sm px-4 py-3 text-sm text-red-200 text-left">
          {error}
        </div>
      {/if}

      <!-- form: glass inputs on image -->
      <form class="mt-10 flex flex-col gap-5 text-left" onsubmit={(e) => { e.preventDefault(); submitForm() }}>
        <div class="flex flex-col gap-2">
          <Label for="name" class="text-xs uppercase tracking-[0.2em] font-heading text-white/50">Full name</Label>
          <Input bind:value={form.name} required type="text" name="name" id="name" placeholder="Your name" class="rounded-xl h-12 text-base text-white bg-white/5 border-white/15 backdrop-blur-md placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="email" class="text-xs uppercase tracking-[0.2em] font-heading text-white/50">Email</Label>
          <Input bind:value={form.email} required type="text" name="email" id="email" placeholder="you@example.com" class="rounded-xl h-12 text-base text-white bg-white/5 border-white/15 backdrop-blur-md placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div class="flex flex-col gap-2">
            <Label for="password" class="text-xs uppercase tracking-[0.2em] font-heading text-white/50">Password</Label>
            <div class="relative">
              <Input bind:value={form.password} required type={showPassword ? 'text' : 'password'} name="password" id="password" placeholder="••••••••" class="pr-10 rounded-xl h-12 text-base text-white bg-white/5 border-white/15 backdrop-blur-md placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30" />
              <button type="button" onclick={() => (showPassword = !showPassword)} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="confirm-password" class="text-xs uppercase tracking-[0.2em] font-heading text-white/50">Confirm</Label>
            <div class="relative">
              <Input bind:value={form.password_confirmation} required type={showConfirm ? 'text' : 'password'} name="confirm-password" id="confirm-password" placeholder="••••••••" class="pr-10 rounded-xl h-12 text-base text-white bg-white/5 border-white/15 backdrop-blur-md placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30" />
              <button type="button" onclick={() => (showConfirm = !showConfirm)} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer" aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {#if showConfirm}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onclick={generatePassword}
          class="self-start inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-primary transition-colors cursor-pointer group"
        >
          <Sparkles class="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          Generate a secure one
        </button>

        <div class="flex flex-wrap items-center justify-center gap-5 pt-3">
          <Button type="submit" disabled={isLoading} size="lg" class="rounded-xl px-7 h-12 text-sm normal-case tracking-normal font-heading font-medium">
            {#if isLoading}
              Creating account...
            {:else}
              Begin
              <ArrowRight class="w-4 h-4" />
            {/if}
          </Button>
          <a href="/login" use:inertia class="text-sm text-white/50 hover:text-white transition-colors inline-flex items-center gap-1.5 group">
            Have an account?
            <span class="text-white underline underline-offset-4 decoration-white/30">Sign in</span>
          </a>
        </div>
      </form>
    </div>
  </div>

  <!-- ───────────── FOOTER (on image) ───────────── -->
  <footer class="absolute bottom-0 inset-x-0 z-10 px-6 sm:px-10 lg:px-16 py-6 flex justify-between items-center text-xs text-white/40">
    <span>&copy; {new Date().getFullYear()} Nara</span>
    <span class="font-heading uppercase tracking-[0.2em]">A foundation for building with AI</span>
  </footer>
</div>
