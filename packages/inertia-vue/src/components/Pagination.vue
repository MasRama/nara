<script setup lang="ts">
import { computed } from 'vue';
import { router } from '@inertiajs/vue3';

interface PaginationMeta {
  page: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const props = withDefaults(defineProps<{
  meta: PaginationMeta;
  preserveState?: boolean;
}>(), {
  preserveState: true
});

const goToPage = (page: number) => {
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(page));
  router.visit(url.pathname + url.search, {
    preserveScroll: true,
    preserveState: props.preserveState
  });
};

const pages = computed(() => {
  const length = Math.min(5, props.meta.totalPages);
  const start = Math.max(1, Math.min(props.meta.page - 2, props.meta.totalPages - 4));
  return Array.from({ length }, (_, i) => start + i).filter(p => p <= props.meta.totalPages);
});
</script>

<template>
  <div v-if="meta.totalPages > 1" class="flex items-center justify-between mt-6 text-xs text-slate-400">
    <div>
      Halaman {{ meta.page }} dari {{ meta.totalPages }} ({{ meta.total }} total)
    </div>
    <div class="flex items-center gap-2">
      <button
        class="px-3 py-1.5 rounded-full bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 text-slate-100 dark:text-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        @click="goToPage(meta.page - 1)"
        :disabled="!meta.hasPrev"
      >
        ← Prev
      </button>

      <button
        v-for="pageNum in pages"
        :key="pageNum"
        class="px-3 py-1.5 rounded-full transition"
        :class="pageNum === meta.page
          ? 'bg-primary-500 text-white'
          : 'bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 text-slate-100 dark:text-slate-800'"
        @click="goToPage(pageNum)"
      >
        {{ pageNum }}
      </button>

      <button
        class="px-3 py-1.5 rounded-full bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 text-slate-100 dark:text-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        @click="goToPage(meta.page + 1)"
        :disabled="!meta.hasNext"
      >
        Next →
      </button>
    </div>
  </div>
</template>
