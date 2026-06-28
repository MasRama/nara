<script lang="ts">
  import { router } from '@inertiajs/svelte';
  import { cn } from '$lib/utils.js';
  import type { PaginationMeta } from '../types';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';

  let { meta, preserveState = true }: { meta: PaginationMeta; preserveState?: boolean } = $props();

  function goToPage(page: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    router.visit(url.pathname + url.search, { preserveScroll: true, preserveState });
  }

  function getPageNumbers(): number[] {
    const start = Math.max(1, Math.min(meta.page - 2, meta.totalPages - 4));
    return Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => start + i).filter(p => p <= meta.totalPages);
  }

  const showStartEllipsis = $derived(getPageNumbers()[0] > 1);
  const showEndEllipsis = $derived(getPageNumbers()[getPageNumbers().length - 1] < meta.totalPages);

  const linkBase = cn("inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-heading font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 w-9");
  const navBtn = cn("inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-xl text-sm font-heading font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-3 text-muted-foreground hover:bg-muted hover:text-foreground");
</script>

{#if meta.totalPages > 1}
  <div class="mt-8">
    <div class="flex items-center justify-between mb-3 text-xs text-muted-foreground font-heading">
      <span>Page {meta.page} of {meta.totalPages} &middot; {meta.total} total</span>
    </div>
    <nav class="mx-auto flex w-full justify-center">
      <ul class="flex flex-row items-center gap-1">
        <li>
          <button class={navBtn} onclick={() => goToPage(meta.page - 1)} disabled={!meta.hasPrev} aria-label="Go to previous page">
            <ChevronLeft class="size-4" /><span>Prev</span>
          </button>
        </li>

        {#if showStartEllipsis}
          <li><button class={linkBase} onclick={() => goToPage(1)}>1</button></li>
          <li><span class="flex h-9 w-9 items-center justify-center text-muted-foreground">...</span></li>
        {/if}

        {#each getPageNumbers() as pageNum}
          <li>
            <button
              class={cn(linkBase, pageNum === meta.page ? "bg-foreground text-background" : "text-foreground hover:bg-muted border border-border")}
              onclick={() => goToPage(pageNum)}
              aria-current={pageNum === meta.page ? "page" : undefined}
            >{pageNum}</button>
          </li>
        {/each}

        {#if showEndEllipsis}
          <li><span class="flex h-9 w-9 items-center justify-center text-muted-foreground">...</span></li>
          <li><button class={linkBase} onclick={() => goToPage(meta.totalPages)}>{meta.totalPages}</button></li>
        {/if}

        <li>
          <button class={navBtn} onclick={() => goToPage(meta.page + 1)} disabled={!meta.hasNext} aria-label="Go to next page">
            <span>Next</span><ChevronRight class="size-4" />
          </button>
        </li>
      </ul>
    </nav>
  </div>
{/if}
