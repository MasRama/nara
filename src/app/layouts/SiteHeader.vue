<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import LocaleSwitcher from '../../shared/i18n/LocaleSwitcher.vue';
import { t } from '../locales';

// One floating header frame for the landing page and the authenticated shell.
// `landing` overlays the hero (fixed, centred links); `app` sits in the page
// flow (sticky, links next to the brand).
withDefaults(defineProps<{ variant?: 'landing' | 'app'; navLabel: string }>(), { variant: 'app' });

const isDark = ref(document.documentElement.classList.contains('dark'));
const scrolled = ref(false);
const themeLabel = computed(() => (isDark.value ? t('header.useLight') : t('header.useDark')));

function toggleTheme(): void {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  try {
    window.localStorage.setItem('nara-theme', isDark.value ? 'dark' : 'light');
  } catch {
    // Keep the current visual preference even when storage is unavailable.
  }
}

function updateScrollState(): void {
  scrolled.value = window.scrollY > 20;
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark');
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateScrollState);
});
</script>

<template>
  <header class="site-header" :class="[`site-header--${variant}`, { 'site-header--scrolled': scrolled }]">
    <div class="site-header-frame">
      <RouterLink to="/" class="site-header-brand" :aria-label="t('header.homeLabel')">
        <img src="/nara.png" alt="" width="28" height="28" class="site-header-logo" />
        <span class="site-header-wordmark" translate="no">nara<span class="site-header-dot">.</span></span>
      </RouterLink>

      <nav v-if="$slots.nav" class="site-header-nav" :aria-label="navLabel">
        <slot name="nav" />
      </nav>

      <div class="site-header-actions">
        <slot name="actions-start" />
        <LocaleSwitcher />
        <button type="button" class="theme-button site-header-icon" :aria-label="themeLabel" @click="toggleTheme">
          <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-19a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1ZM3.5 20.5a1 1 0 0 1-.7-1.7l.7-.8a1 1 0 1 1 1.5 1.4l-.8.8a1 1 0 0 1-.7.3Zm15-15a1 1 0 0 1-.7-1.7l.8-.8a1 1 0 0 1 1.4 1.5l-.8.7a1 1 0 0 1-.7.3ZM3 13H2a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Zm19 0h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2ZM4.3 5.7a1 1 0 0 1-.8-.3l-.7-.8a1 1 0 1 1 1.4-1.4l.8.7a1 1 0 0 1-.7 1.8Zm15 14.8a1 1 0 0 1-.7-.3l-.8-.8a1 1 0 1 1 1.4-1.4l.8.8a1 1 0 0 1-.7 1.7Z" /></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 14.2A8.5 8.5 0 0 1 9.8 3a8.5 8.5 0 1 0 11.2 11.2Z" /></svg>
        </button>
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </header>
</template>

<style scoped>
/* Colors come from the shared --nara-* palette in resources/index.css. */
.site-header {
  z-index: 50;
  padding: 14px 24px 0;
  color: var(--nara-fg);
  font-family: 'Manrope', system-ui, sans-serif;
  pointer-events: none;
}
.site-header > * { pointer-events: auto; }
.site-header--landing { position: fixed; inset: 0 0 auto; }
.site-header--app { position: sticky; top: 0; }

.site-header-frame { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 24px; max-width: 1112px; min-height: 56px; margin: auto; padding: 8px 8px 8px 16px; border: 1px solid color-mix(in srgb, var(--nara-line) 80%, transparent); border-radius: 18px; background: color-mix(in srgb, var(--nara-surface) 78%, transparent); -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4); animation: site-header-enter 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both; transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; }
.site-header--app .site-header-frame { grid-template-columns: auto 1fr auto; }
.site-header--scrolled .site-header-frame { border-color: var(--nara-line); background: color-mix(in srgb, var(--nara-surface) 94%, transparent); box-shadow: var(--nara-shadow); }

.site-header-brand { display: inline-flex; align-items: center; gap: 10px; justify-self: start; }
.site-header-logo { width: 28px; height: 28px; border-radius: 8px; }
.site-header-wordmark { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -0.06em; }
.site-header-dot { color: var(--nara-accent); }

.site-header-nav { display: flex; min-width: 0; align-items: center; gap: 2px; }
.site-header--app .site-header-nav { justify-self: start; }
.site-header-actions { display: flex; align-items: center; gap: 4px; justify-self: end; }

:slotted(.site-header-link) { display: inline-flex; flex-shrink: 0; align-items: center; min-height: 36px; padding: 0 12px; border-radius: 10px; color: var(--nara-muted); font-size: 13px; font-weight: 600; white-space: nowrap; transition: color 0.15s ease, background-color 0.15s ease; }
:slotted(.site-header-link:hover) { background: var(--nara-surface-soft); color: var(--nara-fg); }
:slotted(.site-header-link--active), :slotted(.site-header-link--active:hover) { background: var(--nara-accent-soft); color: var(--nara-accent-strong); }
:slotted(.site-header-link:disabled) { cursor: not-allowed; opacity: 0.6; }

.site-header-icon, :slotted(.site-header-icon) { display: inline-flex; width: 38px; height: 38px; align-items: center; justify-content: center; border-radius: 11px; color: var(--nara-muted); transition: color 0.15s ease, background-color 0.15s ease, transform 0.15s ease; }
.site-header-icon:hover, :slotted(.site-header-icon:hover) { background: var(--nara-surface-soft); color: var(--nara-fg); }
.site-header-icon svg, :slotted(.site-header-icon svg) { width: 17px; height: 17px; transition: transform 0.2s ease; }
.theme-button:hover svg { transform: rotate(8deg) scale(1.05); }

:slotted(.site-header-avatar) { display: inline-flex; width: 34px; height: 34px; margin-inline: 2px; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--nara-line); border-radius: 999px; background: var(--nara-surface-soft); color: var(--nara-fg); font-size: 12px; font-weight: 700; transition: border-color 0.15s ease; }
:slotted(.site-header-avatar:hover) { border-color: var(--nara-accent-strong); }
:slotted(.site-header-avatar img) { width: 100%; height: 100%; object-fit: cover; }

:slotted(.site-header-cta) { display: inline-flex; align-items: center; gap: 10px; min-height: 38px; margin-left: 6px; padding: 0 16px; border-radius: 11px; background: var(--nara-fg); color: var(--nara-bg); font-size: 13px; font-weight: 700; white-space: nowrap; transition: background-color 0.15s ease, transform 0.15s ease; }
:slotted(.site-header-cta)::after { content: '→'; transition: transform 0.15s ease; }
:slotted(.site-header-cta:hover) { background: var(--nara-accent-strong); }
:slotted(.site-header-cta:hover)::after { transform: translateX(2px); }

.site-header :deep(button) { cursor: pointer; }
.site-header :deep(:is(a, button):focus-visible) { outline: 2px solid var(--nara-accent-strong); outline-offset: 4px; }

@keyframes site-header-enter { from { opacity: 0; transform: translateY(-8px); } }

@media (hover: hover) {
  .site-header-icon:hover, :slotted(.site-header-icon:hover) { transform: translateY(-1px); }
}
.site-header-icon:active, :slotted(.site-header-icon:active), :slotted(.site-header-cta:active) { transform: scale(0.985); }

@media (max-width: 900px) {
  .site-header-frame, .site-header--app .site-header-frame { grid-template-columns: 1fr auto; row-gap: 4px; padding: 8px 8px 6px 14px; }
  .site-header-nav { grid-row: 2; grid-column: 1 / -1; justify-content: space-between; padding-top: 4px; border-top: 1px solid var(--nara-line); overflow-x: auto; scrollbar-width: none; }
  .site-header-nav::-webkit-scrollbar { display: none; }
  .site-header--app .site-header-nav { justify-content: flex-start; }
  :slotted(.site-header-link) { padding: 0 8px; font-size: 12.5px; }
}

@media (max-width: 640px) {
  .site-header { padding: 10px 12px 0; }
}

@media (max-width: 380px) {
  :slotted(.site-header-link) { padding: 0 4px; font-size: 12px; }
  :slotted(.site-header-cta) { padding: 0 12px; }
  :slotted(.site-header-cta)::after { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .site-header-frame { animation: none; }
  .site-header *, .site-header :deep(*) { transition-duration: 0.01ms !important; }
}
</style>
