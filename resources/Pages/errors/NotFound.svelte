<script lang="ts">
  import { inertia } from '@inertiajs/svelte'
  import DarkModeToggle from '../../Components/DarkModeToggle.svelte'
  import Button from '../../Components/Button.svelte'
  import { ArrowRight, Compass } from '@lucide/svelte'
</script>

<div class="min-h-[100dvh] bg-background text-foreground font-body antialiased selection:bg-primary/20 selection:text-primary overflow-x-hidden">

  <!-- ───────────────────────── NAV ───────────────────────── -->
  <nav class="fixed top-0 inset-x-0 z-50 flex items-center justify-between h-16 px-6 sm:px-10 lg:px-16 bg-background/85 backdrop-blur-md border-b border-border">
    <a href="/" use:inertia class="flex items-center gap-2 group">
      <span class="inline-block w-2.5 h-2.5 rounded-full bg-primary transition-transform duration-300 group-hover:scale-125"></span>
      <span class="font-heading font-semibold tracking-tight text-lg">Nara</span>
    </a>

    <div class="flex items-center gap-5 text-sm">
      <DarkModeToggle />
    </div>
  </nav>

  <!-- ───────────────────────── 404 ───────────────────────── -->
  <main class="relative min-h-[100dvh] flex items-center justify-center px-6 sm:px-10 lg:px-16 overflow-hidden">
    <div class="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:22px_22px] text-foreground"></div>

    <div class="relative max-w-[520px] flex flex-col items-center text-center gap-7">
      <div class="flex items-center gap-3">
        <span class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 border border-primary/20">
          <Compass class="w-5 h-5 text-primary" />
        </span>
        <span class="text-xs uppercase tracking-[0.2em] text-muted-foreground">Error 404</span>
      </div>

      <div>
        <h1 class="font-heading font-bold tracking-tight text-7xl sm:text-8xl text-foreground">Lost?</h1>
        <p class="mt-4 text-muted-foreground text-lg leading-relaxed">
          This page doesn't exist. The route was never wired — or it moved.
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-4 pt-2">
        <a href="/" use:inertia>
          <Button variant="default" size="lg">Back home <ArrowRight class="w-4 h-4" /></Button>
        </a>
      </div>
    </div>
  </main>
</div>
