<script setup lang="ts">
import { LOCALE_NAMES, LOCALES, locale, setLocale, type Locale } from './index';

// A native select keeps keyboard and screen-reader behavior; the visible face
// shows only the short locale code so it fits next to header icons.
function choose(event: Event): void {
  void setLocale((event.target as HTMLSelectElement).value as Locale);
}
</script>

<template>
  <label class="locale-switcher">
    <span class="locale-switcher-code" aria-hidden="true">{{ locale.toUpperCase() }}</span>
    <select :value="locale" aria-label="Language / Bahasa" @change="choose">
      <option v-for="option in LOCALES" :key="option" :value="option" :lang="option">{{ LOCALE_NAMES[option] }}</option>
    </select>
  </label>
</template>

<style scoped>
.locale-switcher { position: relative; display: inline-flex; width: 38px; height: 38px; align-items: center; justify-content: center; border-radius: 11px; color: var(--nara-muted, currentColor); transition: color 0.15s ease, background-color 0.15s ease; }
.locale-switcher:hover, .locale-switcher:focus-within { background: var(--nara-surface-soft, transparent); color: var(--nara-fg, currentColor); }
.locale-switcher:focus-within { outline: 2px solid var(--nara-accent, currentColor); outline-offset: 1px; }
.locale-switcher-code { font-family: var(--nara-mono, ui-monospace, monospace); font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; }
.locale-switcher select { position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; opacity: 0; }
</style>
