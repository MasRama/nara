<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatDate } from '../../../../shared/i18n';
import type { ActivityRecord } from '../../contract';
import { createActivityClient } from '../client';
import { error as errorText, find, t } from '../locales';

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
const hasFilters = computed(() => Boolean(actionFilter.value || actorFilter.value || fromDate.value || toDate.value));

// Labels for the actions recorded by the shipped features live at `action.<slug>`;
// unknown actions fall back to a generic phrase.
const knownActions = [
  'auth.registered',
  'auth.login',
  'auth.logout',
  'auth.password-changed',
  'auth.session-revoked',
  'auth.sessions-revoked',
  'auth.two-factor-enabled',
  'auth.two-factor-disabled',
  'auth.recovery-codes-regenerated',
  'users.created',
  'users.updated',
  'users.profile-updated',
  'users.password-reset',
  'users.deleted',
  'roles.created',
  'roles.updated',
  'roles.deleted',
];
const actionOptions = computed(() => knownActions.map((slug) => [slug, actionLabel(slug)] as const));

type Tone = 'create' | 'delete' | 'auth' | 'update';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function actionLabel(action: string): string {
  return find(`action.${action}`) ?? capitalize(action.replace(/[.\-_]+/g, ' ').trim());
}

function actionTone(action: string): Tone {
  const verb = action.slice(action.lastIndexOf('.') + 1);
  if (verb === 'deleted') return 'delete';
  if (verb === 'created' || verb === 'registered') return 'create';
  if (action.startsWith('auth.')) return 'auth';
  return 'update';
}

const toneGlyph: Record<Tone, string> = { create: '+', delete: '−', auth: '→', update: '~' };

function dateBoundary(value: string, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const time = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function dayLabel(value: number): string {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return t('feed.today');
  if (day.toDateString() === yesterday.toDateString()) return t('feed.yesterday');
  return formatDate(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const groupedActivities = computed(() => {
  const groups: Array<{ key: string; label: string; items: ActivityRecord[] }> = [];
  for (const activity of activities.value) {
    const key = new Date(activity.occurredAt).toDateString();
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(activity);
    else groups.push({ key, label: dayLabel(activity.occurredAt), items: [activity] });
  }
  return groups;
});

function metadataEntries(activity: ActivityRecord): Array<[string, string]> {
  return Object.entries(activity.metadata).map(([key, value]) => [
    capitalize(key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase()),
    typeof value === 'boolean' ? (value ? t('feed.yes') : t('feed.no')) : String(value),
  ]);
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
      errorMessage.value = errorText(response);
      return;
    }
    activities.value = response.data.activities;
    total.value = response.data.total;
    page.value = response.data.page;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('feed.loadFailed');
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
  <main class="nara-page">
    <section class="nara-page-inner">
      <header class="act-hero">
        <div class="min-w-0">
          <h1 class="nara-page-title">{{ t('page.title') }}<span class="nara-page-title-accent">.</span></h1>
          <p class="nara-page-lede">{{ t('page.lede') }}</p>
        </div>
        <span class="act-total"><span class="act-live-dot"></span>{{ t('page.total', { count: total }) }}</span>
      </header>

      <div class="act-stack nara-page-body">
        <form class="act-filters" :aria-label="t('filters.label')" @submit.prevent="applyFilters">
          <label class="act-field act-field--wide" for="activity-action">
            <span>{{ t('filters.action') }}</span>
            <input id="activity-action" v-model="actionFilter" list="activity-action-options" :placeholder="t('filters.actionPlaceholder')" autocomplete="off" />
            <datalist id="activity-action-options">
              <option v-for="[slug, label] in actionOptions" :key="slug" :value="slug">{{ label }}</option>
            </datalist>
          </label>
          <label class="act-field act-field--wide" for="activity-actor">
            <span>{{ t('filters.actor') }}</span>
            <input id="activity-actor" v-model="actorFilter" :placeholder="t('filters.actorPlaceholder')" autocomplete="off" />
          </label>
          <label class="act-field" for="activity-from">
            <span>{{ t('filters.from') }}</span>
            <input id="activity-from" v-model="fromDate" type="date" />
          </label>
          <label class="act-field" for="activity-to">
            <span>{{ t('filters.to') }}</span>
            <input id="activity-to" v-model="toDate" type="date" />
          </label>
          <div class="act-filter-actions">
            <button v-if="hasFilters" type="button" :disabled="isLoading" class="act-ghost" @click="clearFilters">{{ t('filters.clear') }}</button>
            <button type="submit" :disabled="isLoading" class="act-submit">{{ t('filters.apply') }}</button>
          </div>
        </form>

        <p v-if="errorMessage" role="alert" class="act-alert">{{ errorMessage }}</p>

        <section class="act-window" :aria-label="t('feed.label')">
          <div class="act-window-bar">
            <span class="act-dots" aria-hidden="true"><span></span><span></span><span></span></span>
            <span class="act-window-title">{{ t('feed.title') }}</span>
            <span class="act-page">{{ t('feed.page', { page, pages: totalPages }) }}</span>
          </div>

          <div v-if="isLoading && activities.length === 0" class="act-empty">{{ t('feed.loading') }}</div>
          <div v-else-if="activities.length === 0" class="act-empty">
            <p class="font-heading text-lg font-extrabold tracking-[-0.03em] text-foreground">{{ t('feed.empty') }}</p>
            <p class="mt-1.5">{{ hasFilters ? t('feed.emptyFiltered') : t('feed.emptyHint') }}</p>
          </div>

          <div v-else class="act-feed">
            <section v-for="group in groupedActivities" :key="group.key" class="act-day">
              <h2 class="act-day-label">{{ group.label }}</h2>
              <ol class="act-timeline">
                <li v-for="activity in group.items" :key="activity.id" :class="['act-event', `act-event--${actionTone(activity.action)}`]">
                  <span class="act-node" aria-hidden="true">{{ toneGlyph[actionTone(activity.action)] }}</span>
                  <div class="act-event-body">
                    <div class="act-event-head">
                      <p class="act-event-title">{{ actionLabel(activity.action) }}</p>
                      <time class="act-time" :datetime="new Date(activity.occurredAt).toISOString()">{{ formatDate(activity.occurredAt, { timeStyle: 'short' }) }}</time>
                    </div>
                    <p class="act-event-target">
                      <span class="text-foreground">{{ activity.targetLabel || activity.targetId || t('feed.application') }}</span>
                      <template v-if="activity.actorId"> · {{ t('feed.by') }} <code class="act-mono">{{ activity.actorId }}</code></template>
                    </p>
                    <dl v-if="metadataEntries(activity).length" class="act-meta">
                      <div v-for="entry in metadataEntries(activity)" :key="entry[0]">
                        <dt>{{ entry[0] }}</dt>
                        <dd>{{ entry[1] }}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              </ol>
            </section>
          </div>

          <div class="act-pager">
            <button type="button" :disabled="page <= 1 || isLoading" class="act-btn" @click="load(page - 1)">{{ t('feed.previous') }}</button>
            <button type="button" :disabled="page >= totalPages || isLoading" class="act-btn" @click="load(page + 1)">{{ t('feed.next') }}</button>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.act-stack { display: flex; flex-direction: column; gap: 20px; }
.act-mono { font-family: var(--nara-mono); font-size: 0.92em; }

.act-hero { display: flex; flex-direction: column; gap: 24px; }
@media (min-width: 640px) { .act-hero { flex-direction: row; align-items: flex-end; justify-content: space-between; } }
.act-total { display: inline-flex; align-items: center; gap: 10px; align-self: flex-start; padding: 10px 16px; border-radius: 13px; background: var(--nara-ink-raised); color: var(--nara-ink-fg); font-family: var(--nara-mono); font-size: 12.5px; font-weight: 600; box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line), var(--nara-shadow); }
@media (min-width: 640px) { .act-total { align-self: auto; } }
.act-live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--nara-ink-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--nara-ink-accent) 16%, transparent); animation: act-pulse 2.2s ease-in-out infinite; }

/* Filters */
.act-filters { display: grid; gap: 4px; padding: 8px; border: 1px solid var(--border); border-radius: 18px; background: var(--card); box-shadow: var(--nara-shadow); }
@media (min-width: 900px) { .act-filters { grid-template-columns: 1.3fr 1fr auto auto auto; align-items: stretch; } }
.act-field { display: flex; min-width: 0; flex-direction: column; justify-content: center; gap: 2px; padding: 8px 14px; border-radius: 12px; transition: background-color 0.15s ease; }
.act-field:focus-within { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
@media (min-width: 900px) { .act-field + .act-field { border-left: 1px solid var(--border); border-radius: 0; } .act-field:focus-within { border-radius: 12px; } }
.act-field span { color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.act-field input { width: 100%; min-width: 0; height: 26px; background: transparent; color: var(--foreground); font-size: 14px; outline: none; }
.act-field input::placeholder { color: color-mix(in srgb, var(--muted-foreground) 80%, transparent); }
.act-filter-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 4px; }
.act-submit { height: 44px; padding: 0 22px; border-radius: 12px; background: var(--primary); color: var(--primary-foreground); font-size: 14px; font-weight: 700; transition: opacity 0.15s ease; }
.act-submit:hover:not(:disabled) { opacity: 0.9; }
.act-submit:disabled, .act-ghost:disabled { cursor: not-allowed; opacity: 0.5; }
.act-ghost { height: 44px; padding: 0 14px; border-radius: 12px; color: var(--muted-foreground); font-size: 14px; font-weight: 600; transition: color 0.15s ease, background-color 0.15s ease; }
.act-ghost:hover:not(:disabled) { background: color-mix(in srgb, var(--foreground) 5%, transparent); color: var(--foreground); }

.act-alert { padding: 12px 16px; border: 1px solid color-mix(in srgb, var(--destructive) 30%, transparent); border-radius: 14px; background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); font-size: 14px; }

/* Window */
.act-window { overflow: hidden; border: 1px solid var(--border); border-radius: 22px; background: var(--card); box-shadow: 0 0 0 8px color-mix(in srgb, var(--card) 50%, transparent), var(--nara-shadow); }
.act-window-bar { display: flex; align-items: center; gap: 14px; height: 52px; padding: 0 20px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--foreground) 2.5%, transparent); }
.act-dots { display: flex; gap: 7px; }
.act-dots span { width: 10px; height: 10px; border-radius: 50%; background: color-mix(in srgb, var(--foreground) 14%, transparent); }
.act-window-title { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
.act-page { margin-left: auto; padding: 4px 10px; border-radius: 8px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-family: var(--nara-mono); font-size: 11px; font-weight: 600; }
.act-empty { padding: 72px 20px; color: var(--muted-foreground); font-size: 14px; text-align: center; }

/* Timeline */
.act-feed { padding: 8px 20px 4px; }
@media (min-width: 640px) { .act-feed { padding: 12px 32px 4px; } }
.act-day + .act-day { margin-top: 8px; }
.act-day-label { position: sticky; top: 0; z-index: 1; padding: 18px 0 10px; background: var(--card); color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.act-timeline { position: relative; }
.act-event { position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 16px; padding-bottom: 18px; }
.act-event::before { content: ''; position: absolute; top: 34px; bottom: 2px; left: 15.5px; width: 1px; background: var(--border); }
.act-event:last-child::before { display: none; }
.act-node { position: relative; z-index: 1; display: grid; width: 32px; height: 32px; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: var(--card); color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 14px; font-weight: 700; line-height: 1; }
.act-event--create .act-node { border-color: transparent; background: var(--primary); color: var(--primary-foreground); box-shadow: 0 0 0 5px color-mix(in srgb, var(--primary) 12%, transparent); }
.act-event--delete .act-node { border-color: color-mix(in srgb, var(--destructive) 40%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }
.act-event--auth .act-node { border-color: transparent; background: var(--nara-ink-raised); color: var(--nara-ink-accent); box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line); }
.act-event--update .act-node { border-color: color-mix(in srgb, var(--primary) 40%, transparent); color: var(--primary); }

.act-event-body { min-width: 0; padding: 12px 16px 14px; border: 1px solid transparent; border-radius: 14px; transition: background-color 0.15s ease, border-color 0.15s ease; }
.act-event:hover .act-event-body { border-color: var(--border); background: color-mix(in srgb, var(--foreground) 2%, transparent); }
.act-event-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.act-event-title { font-size: 15px; font-weight: 800; letter-spacing: -0.025em; }
.act-time { flex: none; color: var(--muted-foreground); font-family: var(--nara-mono); font-size: 11.5px; }
.act-event-target { margin-top: 3px; overflow: hidden; color: var(--muted-foreground); font-size: 13.5px; text-overflow: ellipsis; white-space: nowrap; }
.act-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.act-meta > div { display: inline-flex; align-items: baseline; gap: 6px; padding: 3px 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; }
.act-meta dt { color: var(--muted-foreground); }
.act-meta dd { font-weight: 700; }

.act-pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--border); }
.act-btn { height: 34px; padding: 0 12px; border: 1px solid var(--border); border-radius: 9px; background: var(--card); font-size: 12.5px; font-weight: 600; transition: border-color 0.15s ease, color 0.15s ease; }
.act-btn:hover:not(:disabled) { border-color: color-mix(in srgb, var(--primary) 50%, transparent); color: var(--primary); }
.act-btn:disabled { cursor: not-allowed; opacity: 0.4; }

@keyframes act-pulse { 0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--nara-ink-accent) 16%, transparent); } 50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--nara-ink-accent) 4%, transparent); } }
@media (prefers-reduced-motion: reduce) { .act-live-dot { animation: none; } }
</style>
