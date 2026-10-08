<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <main class="not-found" data-testid="not-found-page">
    <div class="not-found-inner">
      <RouterLink to="/" class="not-found-brand" aria-label="Nara home">
        <img src="/nara.png" alt="" width="29" height="29" />
        <span>nara<b>.</b></span>
      </RouterLink>
      <div class="not-found-copy">
        <p class="not-found-index">404 / UNKNOWN ROUTE</p>
        <span class="not-found-number" aria-hidden="true">404<span>.</span></span>
        <h1>Page <em>not found.</em></h1>
        <p>This route doesn't exist in this application. The rest of your workspace is still right where you left it.</p>
        <RouterLink to="/" class="not-found-action">Return home <span aria-hidden="true">↗</span></RouterLink>
      </div>
      <footer class="not-found-footer">
        <span>YOUR CODE. YOUR BOUNDARIES.</span>
        <span>NARA / APPLICATION KIT</span>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.not-found {
  min-height: 100dvh;
  background: var(--nara-bg);
  color: var(--nara-fg);
  font-family: 'Manrope', system-ui, sans-serif;
}
.not-found-inner { display: flex; max-width: 1160px; min-height: 100dvh; flex-direction: column; margin-inline: auto; padding: 28px clamp(22px, 5vw, 56px) 22px; }
.not-found-brand { display: flex; width: fit-content; align-items: center; gap: 10px; color: var(--nara-fg); text-decoration: none; }
.not-found-brand img { width: 29px; height: 29px; border-radius: 8px; }
.not-found-brand span { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 25px; font-weight: 800; letter-spacing: -.065em; }
.not-found-brand b { color: var(--nara-accent-strong); }
.not-found-copy { display: flex; flex: 1; flex-direction: column; align-items: flex-start; justify-content: center; padding-block: 70px; }
.not-found-index, .not-found-footer { color: var(--nara-muted); font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px; font-weight: 600; letter-spacing: .12em; }
.not-found-index { color: var(--nara-accent-strong); }
.not-found-number { margin-top: 18px; color: var(--nara-fg); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: clamp(88px, 15vw, 175px); font-weight: 800; letter-spacing: -.085em; line-height: 1.05; }
.not-found-number span { color: var(--nara-accent-strong); }
.not-found h1 { margin-top: 15px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: clamp(28px, 4vw, 45px); font-weight: 800; letter-spacing: -.052em; line-height: 1.2; }
.not-found h1 em { color: var(--nara-accent-strong); font-style: normal; }
.not-found-copy > p:not(.not-found-index) { max-width: 460px; margin-top: 18px; color: var(--nara-muted); font-size: 14px; line-height: 1.8; }
.not-found-action { display: inline-flex; min-height: 48px; align-items: center; gap: 28px; margin-top: 32px; padding: 0 20px; border-radius: 11px; background: var(--nara-fg); color: var(--nara-bg); font-size: 13px; font-weight: 800; text-decoration: none; transition: background-color .2s, transform .2s; }
.not-found-action:hover { background: var(--nara-accent-strong); transform: translateY(-1px); }
.not-found-action:focus-visible { outline: 2px solid var(--nara-accent-strong); outline-offset: 3px; }
.not-found-footer { display: flex; justify-content: space-between; gap: 15px; padding-top: 21px; border-top: 1px solid var(--nara-line); font-size: 9px; }
@media (max-width: 520px) { .not-found-footer { flex-direction: column; } .not-found-copy { padding-block: 80px; } }
</style>
