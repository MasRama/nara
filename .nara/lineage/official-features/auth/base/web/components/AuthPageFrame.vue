<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

defineProps<{
  heading: string;
  highlight: string;
  description?: string;
  locked?: boolean;
}>();

const isDark = ref(false);
const themeLabel = computed(() => (isDark.value ? 'Use light mode' : 'Use dark mode'));

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark');
});

function toggleTheme(): void {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  try {
    window.localStorage.setItem('nara-theme', isDark.value ? 'dark' : 'light');
  } catch {
    // Private browsing environments may disable storage; the current theme still works.
  }
}
</script>

<template>
  <main class="nara-auth">
    <div class="nara-auth-shell">
      <header class="nara-auth-header">
        <RouterLink v-if="!locked" to="/" class="nara-auth-brand" aria-label="Nara home">
          <img src="/nara.png" width="30" height="30" alt="" />
          <span>nara<b>.</b></span>
        </RouterLink>
        <div v-else class="nara-auth-brand">
          <img src="/nara.png" width="30" height="30" alt="" />
          <span>nara<b>.</b></span>
        </div>
        <div class="nara-auth-header-actions">
          <button class="nara-auth-theme" type="button" :aria-label="themeLabel" @click="toggleTheme">
            <svg v-if="isDark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-19a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1ZM3 13H2a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Zm19 0h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Z" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 14.2A8.5 8.5 0 0 1 9.8 3a8.5 8.5 0 1 0 11.2 11.2Z" /></svg>
          </button>
          <RouterLink v-if="!locked" to="/" class="nara-auth-home">Back to site <span aria-hidden="true">↗</span></RouterLink>
        </div>
      </header>

      <div class="nara-auth-content">
        <aside class="nara-auth-story">
          <p class="nara-auth-story-title">Build by feature.<br /><em>Keep it yours.</em></p>
          <span class="nara-auth-story-rule" aria-hidden="true"></span>
          <p class="nara-auth-story-description">Code you can understand. Architecture you own.</p>
        </aside>

        <section class="nara-auth-form-panel">
          <div class="nara-auth-form-inner">
            <h1>{{ heading }} <span>{{ highlight }}</span></h1>
            <p v-if="description" class="nara-auth-form-description">{{ description }}</p>
            <slot />
          </div>
        </section>
      </div>

      <footer class="nara-auth-footer">
        <span>© {{ new Date().getFullYear() }} Nara</span>
        <span>Build what's yours.</span>
      </footer>
    </div>
  </main>
</template>

<style>
.nara-auth {
  position: relative;
  min-height: 100dvh;
  background: var(--nara-bg);
  color: var(--nara-fg);
  font-family: 'Manrope', system-ui, sans-serif;
}
.nara-auth-shell { position: relative; display: flex; max-width: 1240px; min-height: 100dvh; flex-direction: column; margin-inline: auto; padding: 28px clamp(24px, 4vw, 56px) 22px; }
.nara-auth-header { display: flex; align-items: center; justify-content: space-between; gap: 22px; }
.nara-auth-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--nara-fg); text-decoration: none; }
.nara-auth-brand img { display: block; width: 30px; height: 30px; border-radius: 8px; }
.nara-auth-brand span { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 25px; font-weight: 800; letter-spacing: -.065em; line-height: 1; }
.nara-auth-brand b { color: var(--nara-accent-strong); }
.nara-auth-header-actions { display: inline-flex; align-items: center; gap: 14px; }
.nara-auth-theme { display: flex; width: 40px; height: 40px; align-items: center; justify-content: center; border: 1px solid var(--nara-line); border-radius: 12px; color: var(--nara-muted); transition: color .2s, border-color .2s; }
.nara-auth-theme svg { width: 18px; height: 18px; }
.nara-auth-theme:hover, .nara-auth-home:hover { color: var(--nara-fg); border-color: var(--nara-accent-strong); }
.nara-auth-home { display: inline-flex; align-items: center; gap: 8px; color: var(--nara-muted); font-size: 12px; font-weight: 700; text-decoration: none; transition: color .2s; }
.nara-auth-home span { color: var(--nara-accent-strong); font-size: 17px; }
.nara-auth-content { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(350px, .95fr); align-items: center; flex: 1; gap: clamp(45px, 7vw, 110px); padding-block: 68px; }
.nara-auth-story { min-width: 0; }
.nara-auth-story-title { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: clamp(42px, 4.7vw, 68px); font-weight: 800; letter-spacing: -.068em; line-height: 1.09; }
.nara-auth-story-title em { color: var(--nara-accent-strong); font-style: normal; }
.nara-auth-story-rule { display: block; width: 44px; height: 2px; margin-top: 30px; background: var(--nara-accent-strong); }
.nara-auth-story-description { max-width: 360px; margin-top: 22px; color: var(--nara-muted); font-size: 14px; line-height: 1.75; }
.nara-auth-form-panel { min-width: 0; padding-left: clamp(34px, 4vw, 58px); border-left: 1px solid var(--nara-line); }
.nara-auth-form-inner { max-width: 405px; }
.nara-auth-form-panel h1 { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: clamp(31px, 3vw, 42px); font-weight: 800; letter-spacing: -.055em; line-height: 1.12; }
.nara-auth-form-panel h1 span { color: var(--nara-accent-strong); }
.nara-auth-form-description { margin-top: 13px; color: var(--nara-muted); font-size: 13px; line-height: 1.75; }
.nara-auth-form { display: grid; gap: 19px; margin-top: 33px; }
.nara-auth-field { display: block; color: var(--nara-fg); font-size: 12px; font-weight: 800; }
.nara-auth-input { display: block; width: 100%; min-height: 49px; margin-top: 9px; padding: 0 15px; border: 1px solid var(--nara-line); border-radius: 10px; outline: 0; background: var(--nara-input); color: var(--nara-fg); font-family: 'Manrope', system-ui, sans-serif; font-size: 14px; font-weight: 500; transition: border-color .2s, box-shadow .2s; }
.nara-auth-input::placeholder { color: var(--nara-faint); }
.nara-auth-input:focus { border-color: var(--nara-accent-strong); }
.nara-auth-input[aria-invalid='true'] { border-color: var(--nara-danger); }
.nara-auth-input-password { padding-right: 78px; }
.nara-auth-input-code { font-family: var(--nara-mono); font-size: 18px; font-weight: 600; letter-spacing: .28em; }
.nara-auth-password-wrap { position: relative; display: block; }
.nara-auth-show { position: absolute; top: 9px; right: 7px; display: flex; min-width: 64px; height: 49px; align-items: center; justify-content: center; border-radius: 8px; color: var(--nara-muted); font-size: 11px; font-weight: 800; transition: color .2s; }
.nara-auth-show:hover { color: var(--nara-accent-strong); }
.nara-auth-error { display: block; margin-top: 8px; color: var(--nara-danger); font-size: 11px; font-weight: 600; line-height: 1.5; }
.nara-auth-notice { padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--nara-accent-strong) 35%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--nara-accent-strong) 8%, transparent); color: var(--nara-fg); font-size: 12px; line-height: 1.65; }
.nara-auth-alert { padding: 13px 15px; border: 1px solid color-mix(in srgb, var(--nara-danger) 35%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--nara-danger) 8%, transparent); color: var(--nara-danger); font-size: 12px; line-height: 1.65; }
.nara-auth-submit { display: flex; width: 100%; min-height: 50px; align-items: center; justify-content: center; gap: 12px; padding: 12px 16px; border: 1px solid transparent; border-radius: 10px; background: var(--nara-fg); color: var(--nara-bg); font-family: 'Manrope', system-ui, sans-serif; font-size: 13px; font-weight: 800; transition: background-color .2s, color .2s, transform .2s; }
.nara-auth-submit:hover:not(:disabled) { background: var(--nara-accent-strong); color: var(--nara-bg); }
.nara-auth-submit:active:not(:disabled) { transform: scale(.99); }
.nara-auth-submit:disabled { cursor: wait; opacity: .55; }
.nara-auth-submit-arrow { font-size: 17px; font-weight: 400; }
.nara-auth-alt { margin-top: 25px; padding-top: 21px; border-top: 1px solid var(--nara-line); color: var(--nara-muted); font-size: 12px; line-height: 1.7; text-align: center; }
.nara-auth-alt a { margin-left: 4px; color: var(--nara-accent-strong); font-weight: 800; text-decoration: none; }
.nara-auth-alt a:hover { text-decoration: underline; text-underline-offset: 3px; }
.nara-auth-link-button { margin-left: 4px; color: var(--nara-accent-strong); font-weight: 800; }
.nara-auth-link-button:hover { text-decoration: underline; text-underline-offset: 3px; }
.nara-auth-quiet-button { display: flex; width: 100%; min-height: 42px; align-items: center; justify-content: center; color: var(--nara-muted); font-size: 12px; font-weight: 700; }
.nara-auth-quiet-button:hover { color: var(--nara-accent-strong); }
.nara-auth-footer { display: flex; justify-content: space-between; gap: 12px; padding-top: 20px; border-top: 1px solid var(--nara-line); color: var(--nara-faint); font-size: 11px; }
.nara-auth :is(a, button):focus-visible { outline: 2px solid var(--nara-accent-strong); outline-offset: 3px; }
@media (max-width: 900px) {
  .nara-auth-content { grid-template-columns: 1fr; gap: 36px; max-width: 510px; width: 100%; margin-inline: auto; padding-block: 55px; }
  .nara-auth-story-title { font-size: clamp(32px, 6vw, 45px); }
  .nara-auth-story-rule { margin-top: 20px; }
  .nara-auth-story-description { margin-top: 12px; font-size: 13px; }
  .nara-auth-form-panel { padding: 30px 0 0; border-left: 0; border-top: 1px solid var(--nara-line); }
  .nara-auth-form-inner { max-width: none; }
}
@media (max-width: 540px) {
  .nara-auth-shell { padding: 20px 18px; }
  .nara-auth-content { gap: 0; padding-block: 72px 36px; }
  .nara-auth-story { display: none; }
  .nara-auth-form-panel { border-top: 0; padding: 0; }
  .nara-auth-form-panel h1 { font-size: clamp(28px, 7.3vw, 35px); }
  .nara-auth-form { margin-top: 27px; }
  .nara-auth-home { font-size: 11px; }
  .nara-auth-footer { font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .nara-auth *, .nara-auth *::before, .nara-auth *::after { transition-duration: .01ms !important; }
}
</style>
