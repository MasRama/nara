<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ActivityRecord } from '../../contract';
import { createActivityClient } from '../client';

const client = createActivityClient();
const activities = ref<ActivityRecord[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const isLoading = ref(false);
const errorMessage = ref('');
const actionFilter = ref('');
const actorFilter = ref('');
const fromDate = ref('');
const toDate = ref('');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

function dateBoundary(value: string, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const time = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function actionLabel(action: string): string {
  return action
    .split('.')
    .map((part) => part.replace(/-/g, ' '))
    .join(' · ');
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function metadataEntries(activity: ActivityRecord): Array<[string, string]> {
  return Object.entries(activity.metadata).map(([key, value]) => [key, String(value)]);
}

async function load(nextPage = page.value): Promise<void> {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await client.list({
      page: nextPage,
      limit,
      action: actionFilter.value,
      actorId: actorFilter.value,
      from: dateBoundary(fromDate.value),
      to: dateBoundary(toDate.value, true),
    });
    if (!response.success) {
      errorMessage.value = response.message;
      return;
    }
    activities.value = response.data.activities;
    total.value = response.data.total;
    page.value = response.data.page;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load activity';
  } finally {
    isLoading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await load(1);
}

async function clearFilters(): Promise<void> {
  actionFilter.value = '';
  actorFilter.value = '';
  fromDate.value = '';
  toDate.value = '';
  await load(1);
}

onMounted(() => load());
</script>

<template>
  <main class="px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
    <section class="mx-auto max-w-[1200px]">
      <div class="flex flex-col gap-2 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Operations</p>
          <h1 class="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Activity</h1>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Security and administration events recorded by this application. Sensitive request data is never stored here.
          </p>
        </div>
        <p class="text-sm text-muted-foreground">{{ total }} event{{ total === 1 ? '' : 's' }}</p>
      </div>

      <form class="grid gap-3 border-b border-border py-5 md:grid-cols-[1fr_1fr_auto_auto_auto]" @submit.prevent="applyFilters">
        <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Action
          <input v-model="actionFilter" class="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="users.updated" />
        </label>
        <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
          Actor ID
          <input v-model="actorFilter" class="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" placeholder="Exact actor ID" />
        </label>
        <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
          From
          <input v-model="fromDate" type="date" class="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
        </label>
        <label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
          To
          <input v-model="toDate" type="date" class="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
        </label>
        <div class="flex items-end gap-2">
          <button type="submit" :disabled="isLoading" class="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">Filter</button>
          <button type="button" :disabled="isLoading" class="h-10 rounded-md border border-border px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60" @click="clearFilters">Clear</button>
        </div>
      </form>

      <p v-if="errorMessage" role="alert" class="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{{ errorMessage }}</p>

      <div v-if="isLoading && activities.length === 0" class="py-16 text-center text-sm text-muted-foreground">Loading activity…</div>
      <div v-else-if="activities.length === 0" class="py-16 text-center">
        <p class="font-heading text-lg font-medium">No activity found</p>
        <p class="mt-1 text-sm text-muted-foreground">Events will appear here after authentication or administration changes.</p>
      </div>
      <ol v-else class="divide-y divide-border">
        <li v-for="activity in activities" :key="activity.id" class="grid gap-3 py-5 md:grid-cols-[190px_minmax(0,1fr)_minmax(220px,0.8fr)] md:items-start">
          <time class="text-xs text-muted-foreground" :datetime="new Date(activity.occurredAt).toISOString()">{{ formatTime(activity.occurredAt) }}</time>
          <div class="min-w-0">
            <p class="font-heading text-sm font-semibold capitalize">{{ actionLabel(activity.action) }}</p>
            <p class="mt-1 truncate text-sm text-muted-foreground">
              <span class="text-foreground">{{ activity.targetLabel || activity.targetId || 'Application' }}</span>
              <span v-if="activity.actorId"> · actor {{ activity.actorId }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5 md:justify-end">
            <span class="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{{ activity.resource }}</span>
            <span v-for="entry in metadataEntries(activity)" :key="entry[0]" class="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {{ entry[0] }}={{ entry[1] }}
            </span>
          </div>
        </li>
      </ol>

      <div class="flex items-center justify-between border-t border-border pt-5">
        <p class="text-xs text-muted-foreground">Page {{ page }} of {{ totalPages }}</p>
        <div class="flex gap-2">
          <button type="button" :disabled="page <= 1 || isLoading" class="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40" @click="load(page - 1)">Previous</button>
          <button type="button" :disabled="page >= totalPages || isLoading" class="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40" @click="load(page + 1)">Next</button>
        </div>
      </div>
    </section>
  </main>
</template>
