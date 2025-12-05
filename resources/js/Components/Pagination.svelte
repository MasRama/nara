<script lang="ts">
  import { router } from '@inertiajs/svelte';
  import type { PaginationMeta } from '../types';

  export let meta: PaginationMeta;
  export let preserveState: boolean = true;

  function goToPage(page: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    router.visit(url.pathname + url.search, { 
      preserveScroll: true, 
      preserveState 
    });
  }
</script>

{#if meta.totalPages > 1}
  <div class="flex items-center justify-between mt-6 text-xs text-slate-400">
    <div>
      Halaman {meta.page} dari {meta.totalPages} ({meta.total} total)
    </div>
    <div class="flex items-center gap-2">
      <button
        class="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => goToPage(meta.page - 1)}
        disabled={!meta.hasPrev}
      >
        ← Prev
      </button>
      
      {#each Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
        const start = Math.max(1, Math.min(meta.page - 2, meta.totalPages - 4));
        return start + i;
      }).filter(p => p <= meta.totalPages) as pageNum}
        <button
          class="px-3 py-1.5 rounded-full transition {pageNum === meta.page 
            ? 'bg-emerald-500 text-slate-950' 
            : 'bg-slate-800 hover:bg-slate-700 text-slate-100'}"
          on:click={() => goToPage(pageNum)}
        >
          {pageNum}
        </button>
      {/each}
      
      <button
        class="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={() => goToPage(meta.page + 1)}
        disabled={!meta.hasNext}
      >
        Next →
      </button>
    </div>
  </div>
{/if}
