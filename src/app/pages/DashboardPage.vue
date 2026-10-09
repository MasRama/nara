<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthSession } from '../../features/auth/web';

const authSession = useAuthSession();
const user = authSession.user;
const firstName = computed(() => user.value?.name.split(' ')[0] || 'there');
const initials = computed(() =>
  (user.value?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?',
);

const actions = computed(() => [
  { to: '/profile', icon: 'Aa', title: 'Edit profile', description: 'Update your name, email, and avatar.' },
  { to: '/profile#security', icon: '•••', title: 'Change password', description: 'Rotate your credentials and keep the account secure.' },
]);
</script>

<template>
  <main class="nara-page">
    <div class="nara-page-inner">
      <header>
        <h1 class="nara-page-title">
          Hi, <span class="nara-page-title-accent">{{ firstName }}.</span>
        </h1>
        <p class="nara-page-lede">Manage your account details and security from here.</p>
      </header>

      <div class="dash-grid nara-page-body">
        <section class="dash-window" aria-labelledby="dashboard-account-title">
          <div class="dash-window-bar">
            <span class="dash-dots" aria-hidden="true"><span></span><span></span><span></span></span>
            <span class="dash-window-path">account / session</span>
            <span class="dash-window-live"><span class="dash-live-dot"></span>active</span>
          </div>

          <div class="dash-identity">
            <div class="dash-avatar">{{ initials }}</div>
            <div class="min-w-0">
              <h2 id="dashboard-account-title" class="dash-name">{{ user?.name }}</h2>
              <p class="dash-email">{{ user?.email }}</p>
            </div>
          </div>

          <dl class="dash-facts">
            <div>
              <dt>Session</dt>
              <dd><span class="dash-live-dot"></span>Signed in</dd>
            </div>
            <div>
              <dt>Sign-in method</dt>
              <dd>Email &amp; password</dd>
            </div>
          </dl>
        </section>

        <section class="dash-actions" aria-labelledby="dashboard-actions-title">
          <h2 id="dashboard-actions-title" class="dash-actions-title">Account</h2>
          <RouterLink v-for="action in actions" :key="action.to" :to="action.to" class="dash-action">
            <span class="dash-action-icon" aria-hidden="true">{{ action.icon }}</span>
            <span class="min-w-0 flex-1">
              <strong class="dash-action-title">{{ action.title }}</strong>
              <small class="dash-action-desc">{{ action.description }}</small>
            </span>
            <span class="dash-action-arrow" aria-hidden="true">→</span>
          </RouterLink>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.dash-grid { display: grid; gap: 28px; }
@media (min-width: 1024px) { .dash-grid { grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 40px; align-items: start; } }

/* Identity window */
.dash-window {
  overflow: hidden;
  border-radius: 20px;
  background: var(--nara-ink);
  color: var(--nara-ink-fg);
  box-shadow: 0 0 0 1px var(--nara-ink-line), 0 0 0 8px color-mix(in srgb, var(--card) 60%, transparent), var(--nara-shadow-lift);
  animation: dash-enter 0.7s 120ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
.dash-window-bar { display: flex; align-items: center; gap: 14px; height: 42px; padding: 0 16px; border-bottom: 1px solid var(--nara-ink-line); background: var(--nara-ink-bar); }
.dash-dots { display: flex; gap: 7px; }
.dash-dots span { width: 10px; height: 10px; border-radius: 50%; background: var(--nara-ink-dot); }
.dash-window-path { color: var(--nara-ink-muted); font-family: var(--nara-mono); font-size: 11.5px; }
.dash-window-live { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; padding: 4px 9px; border-radius: 7px; background: color-mix(in srgb, var(--nara-ink-accent) 10%, transparent); color: var(--nara-ink-accent); font-family: var(--nara-mono); font-size: 11px; }
.dash-live-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--nara-ink-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--nara-ink-accent) 16%, transparent); animation: dash-pulse 2.2s ease-in-out infinite; }

.dash-identity { display: flex; align-items: center; gap: 22px; padding: 36px 32px 32px; }
.dash-avatar {
  display: grid;
  width: 76px;
  height: 76px;
  flex: none;
  place-items: center;
  border-radius: 22px;
  background: var(--nara-avatar);
  color: var(--nara-avatar-fg);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.06em;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--nara-avatar-fg) 18%, transparent), 0 0 0 6px color-mix(in srgb, var(--nara-ink-accent) 8%, transparent);
}
.dash-name { font-size: clamp(1.4rem, 2.6vw, 1.9rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.045em; overflow-wrap: anywhere; }
.dash-email { margin-top: 6px; color: var(--nara-ink-muted); font-size: 14px; word-break: break-all; }

.dash-facts { display: grid; border-top: 1px solid var(--nara-ink-line); }
@media (min-width: 640px) { .dash-facts { grid-template-columns: 1fr 1fr; } }
.dash-facts > div { padding: 22px 32px 26px; }
.dash-facts > div + div { border-top: 1px solid var(--nara-ink-line); }
@media (min-width: 640px) { .dash-facts > div + div { border-top: 0; border-left: 1px solid var(--nara-ink-line); } }
.dash-facts dt { color: var(--nara-ink-muted); font-size: 12px; font-weight: 600; }
.dash-facts dd { display: inline-flex; align-items: center; gap: 10px; margin-top: 8px; font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }

/* Actions */
.dash-actions { display: flex; flex-direction: column; gap: 14px; }
.dash-actions-title { margin-bottom: 4px; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.045em; }
.dash-action {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
  box-shadow: var(--nara-shadow);
  transition: transform 0.2s cubic-bezier(0.2, 0.7, 0.2, 1), border-color 0.2s ease, box-shadow 0.2s ease;
}
.dash-action:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--primary) 45%, transparent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 8%, transparent), var(--nara-shadow); }
.dash-action-icon { display: grid; width: 46px; height: 46px; flex: none; place-items: center; border-radius: 13px; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-size: 14px; font-weight: 800; letter-spacing: -0.04em; }
.dash-action-title { display: block; font-size: 1.05rem; font-weight: 800; letter-spacing: -0.03em; }
.dash-action-desc { display: block; margin-top: 4px; color: var(--muted-foreground); font-size: 13.5px; line-height: 1.6; }
.dash-action-arrow { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border: 1px solid var(--border); border-radius: 50%; color: var(--primary); transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
.dash-action:hover .dash-action-arrow { transform: translateX(3px); border-color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); }

@keyframes dash-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes dash-pulse { 0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--nara-ink-accent) 16%, transparent); } 50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--nara-ink-accent) 4%, transparent); } }
@media (prefers-reduced-motion: reduce) { .dash-window, .dash-live-dot { animation: none; } .dash-action, .dash-action-arrow { transition: none; } }
</style>
