<script lang="ts">
  import { toggleMode, mode } from 'mode-watcher';
  import { Sun, Moon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  let { onchange = (_isDark: boolean) => {} }: { onchange?: (isDark: boolean) => void } = $props();

  function handleToggle() {
    toggleMode();
    onchange(mode.current === 'dark');
  }
</script>

<Button
  variant="ghost"
  size="icon"
  onclick={handleToggle}
  aria-label="Toggle dark mode"
  class="rounded-full"
>
  {#if mode.current === 'dark'}
    <Sun class="h-5 w-5" />
  {:else}
    <Moon class="h-5 w-5" />
  {/if}
</Button>
