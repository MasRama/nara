<script lang="ts">
  import { router } from '@inertiajs/svelte';
  import type { PaginationMeta } from '../types';
  import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis,
  } from '$lib/components/ui/pagination';

  let { meta, preserveState = true }: { meta: PaginationMeta; preserveState?: boolean } = $props();

  function goToPage(page: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    router.visit(url.pathname + url.search, {
      preserveScroll: true,
      preserveState,
    });
  }

  function getPageNumbers(): number[] {
    const start = Math.max(1, Math.min(meta.page - 2, meta.totalPages - 4));
    return Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => start + i)
      .filter(p => p <= meta.totalPages);
  }

  const showStartEllipsis = $derived(getPageNumbers()[0] > 1);
  const showEndEllipsis = $derived(getPageNumbers()[getPageNumbers().length - 1] < meta.totalPages);
</script>

{#if meta.totalPages > 1}
  <div class="mt-6">
    <div class="flex items-center justify-between mb-2 text-xs text-muted-foreground">
      <span>Page {meta.page} of {meta.totalPages} ({meta.total} total)</span>
    </div>
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onclick={() => goToPage(meta.page - 1)}
            aria-disabled={!meta.hasPrev}
            class={!meta.hasPrev ? 'pointer-events-none opacity-50' : ''}
          />
        </PaginationItem>

        {#if showStartEllipsis}
          <PaginationItem>
            <PaginationLink onclick={() => goToPage(1)}>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        {/if}

        {#each getPageNumbers() as pageNum}
          <PaginationItem>
            <PaginationLink
              onclick={() => goToPage(pageNum)}
              isActive={pageNum === meta.page}
            >
              {pageNum}
            </PaginationLink>
          </PaginationItem>
        {/each}

        {#if showEndEllipsis}
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink onclick={() => goToPage(meta.totalPages)}>
              {meta.totalPages}
            </PaginationLink>
          </PaginationItem>
        {/if}

        <PaginationItem>
          <PaginationNext
            onclick={() => goToPage(meta.page + 1)}
            aria-disabled={!meta.hasNext}
            class={!meta.hasNext ? 'pointer-events-none opacity-50' : ''}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  </div>
{/if}
