<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { confirmPasswordInputSchema, twoFactorCodeInputSchema, type SessionData, type TwoFactorSetup, type TwoFactorStatus } from '../../contract';
import { encodeQr, qrSvgPath } from '../qr';
import { createSecurityClient } from '../security-client';
import { useAuthSession } from '../session';
import { formatDate, formatRelativeTime, useLocalText } from '../../../../shared/i18n';
import { error as errorText, issue as issueText, t } from '../locales';

type PasswordAction = 'setup' | 'regenerate' | 'disable';

const client = createSecurityClient();
const authSession = useAuthSession();

const twoFactor = ref<TwoFactorStatus | null>(null);
const sessions = ref<SessionData[]>([]);
const loading = ref(true);
const loadError = useLocalText();

const passwordAction = ref<PasswordAction | null>(null);
const password = ref('');
const setup = ref<TwoFactorSetup | null>(null);
const code = ref('');
const recoveryCodes = ref<string[]>([]);
const twoFactorBusy = ref(false);
const twoFactorError = useLocalText();
const twoFactorNotice = useLocalText();
const fieldError = useLocalText();

const sessionBusy = ref<string | null>(null);
const sessionError = useLocalText();
const sessionNotice = useLocalText();

const qr = computed(() => {
  if (!setup.value) return null;
  const modules = encodeQr(setup.value.otpauthUrl);
  return { size: modules.length + 8, path: qrSvgPath(modules) };
});
const groupedSecret = computed(() => setup.value?.secret.match(/.{1,4}/g)?.join(' ') ?? '');
const otherSessions = computed(() => sessions.value.filter((session) => !session.current).length);
const passwordActionLabel = computed<Record<PasswordAction, { title: string; submit: string; busy: string }>>(() => ({
  setup: { title: t('security.confirm.setup.title'), submit: t('security.confirm.setup.submit'), busy: t('security.confirm.setup.busy') },
  regenerate: {
    title: t('security.confirm.regenerate.title'),
    submit: t('security.confirm.regenerate.submit'),
    busy: t('security.confirm.regenerate.busy'),
  },
  disable: { title: t('security.confirm.disable.title'), submit: t('security.confirm.disable.submit'), busy: t('security.confirm.disable.busy') },
}));

function shortDate(timestamp: number): string {
  return formatDate(timestamp, { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeTime(timestamp: number): string {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return t('security.sessions.justNow');
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86_400], ['hour', 3_600], ['minute', 60]];
  const [unit, size] = units.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds)!;
  return formatRelativeTime(Math.round(seconds / size), unit);
}

/** Readable "Browser on OS" label from a user agent; falls back to the raw string. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return t('security.sessions.unknownDevice');
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /OPR\//.test(userAgent) ? 'Opera'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : null;
  const os =
    /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Android/.test(userAgent) ? 'Android'
    : /Mac OS X/.test(userAgent) ? 'macOS'
    : /Windows/.test(userAgent) ? 'Windows'
    : /Linux/.test(userAgent) ? 'Linux'
    : null;
  if (browser && os) return t('security.sessions.device', { browser, os });
  return browser ?? os ?? userAgent.slice(0, 60);
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    const [status, list] = await Promise.all([client.twoFactorStatus(), client.listSessions()]);
    if (!status.success) throw new Error(errorText(status));
    if (!list.success) throw new Error(errorText(list));
    twoFactor.value = status.data!.twoFactor;
    sessions.value = list.data!.sessions;
  } catch (error) {
    console.error(error);
    loadError.value = () => t('security.loadFailed');
  } finally {
    loading.value = false;
  }
}

function resetTwoFactorForm(): void {
  passwordAction.value = null;
  password.value = '';
  code.value = '';
  setup.value = null;
  fieldError.value = '';
  twoFactorError.value = '';
}

function askPassword(action: PasswordAction): void {
  resetTwoFactorForm();
  recoveryCodes.value = [];
  twoFactorNotice.value = '';
  passwordAction.value = action;
}

async function refreshStatus(): Promise<void> {
  const status = await client.twoFactorStatus();
  if (status.success) twoFactor.value = status.data!.twoFactor;
}

async function submitPassword(): Promise<void> {
  const action = passwordAction.value;
  if (!action || twoFactorBusy.value) return;
  twoFactorError.value = '';
  fieldError.value = '';
  const parsed = confirmPasswordInputSchema.safeParse({ password: password.value });
  if (!parsed.success) {
    fieldError.value = () => issueText(parsed.error.issues[0]!);
    return;
  }

  twoFactorBusy.value = true;
  try {
    if (action === 'setup') {
      const response = await client.startTwoFactorSetup(parsed.data);
      if (!response.success) throw new Error(errorText(response));
      setup.value = response.data!;
      passwordAction.value = null;
      password.value = '';
    } else if (action === 'regenerate') {
      const response = await client.regenerateRecoveryCodes(parsed.data);
      if (!response.success) throw new Error(errorText(response));
      resetTwoFactorForm();
      recoveryCodes.value = response.data!.recoveryCodes;
      await refreshStatus();
    } else {
      const response = await client.disableTwoFactor(parsed.data);
      if (!response.success) throw new Error(errorText(response));
      resetTwoFactorForm();
      twoFactorNotice.value = () => t('security.twoFactor.turnedOff');
      await refreshStatus();
    }
  } catch (error) {
    console.error(error);
    twoFactorError.value = () => t('security.failed');
  } finally {
    twoFactorBusy.value = false;
  }
}

async function submitCode(): Promise<void> {
  if (twoFactorBusy.value) return;
  twoFactorError.value = '';
  fieldError.value = '';
  const parsed = twoFactorCodeInputSchema.safeParse({ code: code.value });
  if (!parsed.success) {
    fieldError.value = () => issueText(parsed.error.issues[0]!);
    return;
  }

  twoFactorBusy.value = true;
  try {
    const response = await client.enableTwoFactor(parsed.data);
    if (!response.success) {
      // The code was already checked against the same schema here, so a server-side code error is a mismatch.
      fieldError.value = response.errors?.code?.length ? () => t('security.setup.codeMismatch') : '';
      if (!fieldError.value) twoFactorError.value = () => errorText(response);
      return;
    }
    resetTwoFactorForm();
    recoveryCodes.value = response.data!.recoveryCodes;
    await refreshStatus();
  } catch (error) {
    console.error(error);
    twoFactorError.value = () => t('security.setup.failed');
  } finally {
    twoFactorBusy.value = false;
  }
}

async function copyRecoveryCodes(): Promise<void> {
  try {
    await navigator.clipboard.writeText(recoveryCodes.value.join('\n'));
    twoFactorNotice.value = () => t('security.codes.copied');
  } catch {
    twoFactorError.value = () => t('security.codes.copyFailed');
  }
}

function downloadRecoveryCodes(): void {
  const account = authSession.user.value?.email ?? t('security.codes.fileAccount');
  const body = `${t('security.codes.fileHeading', { account })}\n${t('security.codes.fileNote')}\n\n${recoveryCodes.value.join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'recovery-codes.txt';
  link.click();
  URL.revokeObjectURL(url);
}

async function revokeSession(id: string): Promise<void> {
  if (sessionBusy.value) return;
  sessionBusy.value = id;
  sessionError.value = '';
  sessionNotice.value = '';
  try {
    const response = await client.revokeSession(id);
    if (!response.success) throw new Error(errorText(response));
    sessions.value = sessions.value.filter((session) => session.id !== id);
    sessionNotice.value = () => t('security.sessions.revoked');
  } catch (error) {
    console.error(error);
    sessionError.value = () => t('security.sessions.revokeFailed');
  } finally {
    sessionBusy.value = null;
  }
}

async function revokeOthers(): Promise<void> {
  if (sessionBusy.value) return;
  sessionBusy.value = 'others';
  sessionError.value = '';
  sessionNotice.value = '';
  try {
    const response = await client.revokeOtherSessions();
    if (!response.success) throw new Error(errorText(response));
    sessions.value = sessions.value.filter((session) => session.current);
    const revoked = response.data!.revoked;
    sessionNotice.value = () => t('security.sessions.revokedOthers', { count: revoked });
  } catch (error) {
    console.error(error);
    sessionError.value = () => t('security.sessions.revokeOthersFailed');
  } finally {
    sessionBusy.value = null;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <main class="nara-page">
    <section class="nara-page-inner">
      <header>
        <h1 class="nara-page-title">{{ t('security.title') }}<span class="nara-page-title-accent">.</span></h1>
        <p class="nara-page-lede">{{ t('security.lede') }}</p>
      </header>

      <p v-if="loading" role="status" class="sec-alert sec-alert--muted nara-page-body">{{ t('security.loading') }}</p>
      <p v-else-if="loadError" role="alert" class="sec-alert sec-alert--error nara-page-body">{{ loadError }}</p>

      <div v-else class="sec-settings nara-page-body">
        <section class="sec-row" aria-labelledby="two-factor-title">
          <div class="sec-row-intro">
            <h2 id="two-factor-title" class="sec-row-title">{{ t('security.twoFactor.title') }}</h2>
            <p class="sec-row-desc">{{ t('security.twoFactor.description') }}</p>
          </div>

          <div class="sec-row-body" data-testid="two-factor-panel">
            <div class="sec-status">
              <span :class="['sec-badge', twoFactor?.enabled ? 'sec-badge--on' : 'sec-badge--off']">{{ twoFactor?.enabled ? t('security.twoFactor.on') : t('security.twoFactor.off') }}</span>
              <p v-if="twoFactor?.enabled" class="sec-status-text">
                {{ t('security.twoFactor.enabledOn', { date: shortDate(twoFactor.enabledAt!) }) }} ·
                <span :class="{ 'sec-warn': twoFactor.recoveryCodesRemaining <= 2 }">{{ t('security.twoFactor.codesLeft', { count: twoFactor.recoveryCodesRemaining }) }}</span>
              </p>
              <p v-else class="sec-status-text">{{ t('security.twoFactor.passwordOnly') }}</p>
            </div>

            <div v-if="recoveryCodes.length" class="sec-codes" data-testid="recovery-codes">
              <p class="sec-codes-title">{{ t('security.codes.title') }}</p>
              <p class="sec-codes-desc">{{ t('security.codes.description') }}</p>
              <ol class="sec-codes-grid">
                <li v-for="recoveryCode in recoveryCodes" :key="recoveryCode">{{ recoveryCode }}</li>
              </ol>
              <div class="sec-actions sec-actions--flush">
                <button type="button" class="sec-btn" @click="copyRecoveryCodes">{{ t('security.codes.copy') }}</button>
                <button type="button" class="sec-btn" @click="downloadRecoveryCodes">{{ t('security.codes.download') }}</button>
                <button type="button" class="sec-primary" @click="recoveryCodes = []; twoFactorNotice = ''">{{ t('security.codes.done') }}</button>
              </div>
            </div>

            <form v-else-if="passwordAction" class="sec-form" data-testid="confirm-password-form" @submit.prevent="submitPassword">
              <div class="sec-field">
                <label for="security-password">{{ passwordActionLabel[passwordAction].title }}</label>
                <input id="security-password" v-model="password" type="password" autocomplete="current-password" class="sec-input" :aria-invalid="Boolean(fieldError)" />
                <p v-if="fieldError" class="sec-error">{{ fieldError }}</p>
              </div>
              <div class="sec-actions">
                <p v-if="twoFactorError" role="alert" class="sec-msg sec-msg--error">{{ twoFactorError }}</p>
                <button type="button" class="sec-btn" @click="resetTwoFactorForm">{{ t('common.cancel') }}</button>
                <button type="submit" :disabled="twoFactorBusy" :class="passwordAction === 'disable' ? 'sec-danger' : 'sec-primary'">
                  {{ twoFactorBusy ? passwordActionLabel[passwordAction].busy : passwordActionLabel[passwordAction].submit }}
                </button>
              </div>
            </form>

            <form v-else-if="setup && qr" class="sec-form" data-testid="two-factor-setup" @submit.prevent="submitCode">
              <div class="sec-enroll">
                <svg class="sec-qr" :viewBox="`0 0 ${qr.size} ${qr.size}`" role="img" :aria-label="t('security.setup.qrLabel')" shape-rendering="crispEdges">
                  <rect :width="qr.size" :height="qr.size" fill="#fff" />
                  <path :d="qr.path" fill="#111" />
                </svg>
                <div class="sec-enroll-steps">
                  <p><strong>1.</strong> {{ t('security.setup.scan') }}</p>
                  <p class="sec-secret-hint">{{ t('security.setup.manual') }}</p>
                  <code class="sec-secret" data-testid="two-factor-secret">{{ groupedSecret }}</code>
                  <div class="sec-field">
                    <label for="two-factor-enable-code"><strong>2.</strong> {{ t('security.setup.enterCode') }}</label>
                    <input id="two-factor-enable-code" v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" class="sec-input sec-input--code" :aria-invalid="Boolean(fieldError)" />
                    <p v-if="fieldError" class="sec-error">{{ fieldError }}</p>
                  </div>
                </div>
              </div>
              <div class="sec-actions">
                <p v-if="twoFactorError" role="alert" class="sec-msg sec-msg--error">{{ twoFactorError }}</p>
                <button type="button" class="sec-btn" @click="resetTwoFactorForm">{{ t('common.cancel') }}</button>
                <button type="submit" :disabled="twoFactorBusy" class="sec-primary">{{ twoFactorBusy ? t('security.setup.submitting') : t('security.setup.submit') }}</button>
              </div>
            </form>

            <div v-else class="sec-actions">
              <p v-if="twoFactorNotice" role="status" class="sec-msg sec-msg--ok"><span class="sec-dot"></span>{{ twoFactorNotice }}</p>
              <template v-if="twoFactor?.enabled">
                <button type="button" class="sec-btn" @click="askPassword('regenerate')">{{ t('security.twoFactor.newCodes') }}</button>
                <button type="button" class="sec-btn sec-btn--danger" @click="askPassword('disable')">{{ t('security.twoFactor.turnOff') }}</button>
              </template>
              <button v-else type="button" class="sec-primary" @click="askPassword('setup')">{{ t('security.twoFactor.setUp') }}</button>
            </div>
          </div>
        </section>

        <section class="sec-row" aria-labelledby="sessions-title">
          <div class="sec-row-intro">
            <h2 id="sessions-title" class="sec-row-title">{{ t('security.sessions.title') }}</h2>
            <p class="sec-row-desc">{{ t('security.sessions.description') }}</p>
          </div>

          <div class="sec-row-body" data-testid="sessions-panel">
            <ul class="sec-sessions">
              <li v-for="session in sessions" :key="session.id" class="sec-session" data-testid="session-row">
                <span class="sec-session-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
                </span>
                <span class="sec-session-main">
                  <span class="sec-session-name">
                    {{ deviceLabel(session.userAgent) }}
                    <span v-if="session.current" class="sec-badge sec-badge--on">{{ t('security.sessions.thisDevice') }}</span>
                  </span>
                  <span class="sec-session-meta">
                    <span v-if="session.ipAddress">{{ session.ipAddress }} · </span>
                    {{ t('security.sessions.active', { time: relativeTime(session.lastSeenAt ?? session.createdAt) }) }} · {{ t('security.sessions.signedIn', { date: shortDate(session.createdAt) }) }}
                  </span>
                </span>
                <button v-if="!session.current" type="button" class="sec-btn" :disabled="sessionBusy !== null" @click="revokeSession(session.id)">
                  {{ sessionBusy === session.id ? t('security.sessions.signingOut') : t('security.sessions.signOut') }}
                </button>
              </li>
            </ul>
            <div class="sec-actions">
              <p v-if="sessionError" role="alert" class="sec-msg sec-msg--error">{{ sessionError }}</p>
              <p v-else-if="sessionNotice" role="status" class="sec-msg sec-msg--ok"><span class="sec-dot"></span>{{ sessionNotice }}</p>
              <p v-else-if="otherSessions === 0" class="sec-msg sec-msg--muted">{{ t('security.sessions.onlyThisDevice') }}</p>
              <button type="button" class="sec-btn sec-btn--danger" :disabled="otherSessions === 0 || sessionBusy !== null" @click="revokeOthers">
                {{ sessionBusy === 'others' ? t('security.sessions.signingOut') : t('security.sessions.signOutOthers') }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.sec-alert { padding: 12px 16px; border: 1px solid; border-radius: 14px; font-size: 14px; }
.sec-alert--muted { border-color: var(--border); background: var(--card); color: var(--muted-foreground); }
.sec-alert--error { border-color: color-mix(in srgb, var(--destructive) 30%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }

.sec-settings { border-top: 1px solid var(--border); }
.sec-row { display: grid; gap: 20px; padding: 32px 0; border-bottom: 1px solid var(--border); }
.sec-row:last-child { border-bottom: 0; }
@media (min-width: 900px) { .sec-row { grid-template-columns: 260px minmax(0, 1fr); gap: 48px; padding: 36px 0; } }
.sec-row-title { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.035em; }
.sec-row-desc { margin-top: 6px; max-width: 260px; color: var(--muted-foreground); font-size: 13.5px; line-height: 1.7; }
.sec-row-body { display: flex; min-width: 0; flex-direction: column; gap: 18px; padding: 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--card); box-shadow: var(--nara-shadow); }

.sec-status { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.sec-status-text { color: var(--muted-foreground); font-size: 13.5px; }
.sec-warn { color: var(--nara-danger); font-weight: 700; }
.sec-badge { display: inline-flex; height: 24px; align-items: center; padding: 0 10px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.02em; }
.sec-badge--on { background: var(--nara-accent-soft); color: var(--nara-accent-strong); }
.sec-badge--off { background: color-mix(in srgb, var(--muted-foreground) 14%, transparent); color: var(--muted-foreground); }

.sec-form { display: flex; flex-direction: column; gap: 18px; }
.sec-field { display: grid; gap: 8px; }
.sec-field label { font-size: 13.5px; font-weight: 600; line-height: 1.6; }
.sec-input { width: 100%; max-width: 360px; height: 44px; padding: 0 14px; border: 1px solid var(--input); border-radius: 12px; background: var(--background); font-size: 14px; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.sec-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
.sec-input[aria-invalid='true'] { border-color: color-mix(in srgb, var(--destructive) 60%, transparent); }
.sec-input--code { max-width: 200px; font-family: var(--nara-mono); font-size: 18px; letter-spacing: 0.28em; }
.sec-error { color: var(--nara-danger); font-size: 12.5px; }

.sec-enroll { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 24px; }
.sec-qr { width: 176px; height: 176px; flex: none; border: 1px solid var(--border); border-radius: 14px; }
.sec-enroll-steps { display: flex; min-width: 220px; flex: 1; flex-direction: column; gap: 10px; font-size: 13.5px; line-height: 1.6; }
.sec-secret-hint { color: var(--muted-foreground); }
.sec-secret { align-self: flex-start; padding: 8px 12px; border-radius: 10px; background: var(--nara-surface-soft); font-family: var(--nara-mono); font-size: 13px; letter-spacing: 0.06em; word-break: break-all; user-select: all; }
.sec-enroll-steps .sec-field { margin-top: 8px; }

.sec-codes { display: flex; flex-direction: column; gap: 8px; padding: 18px; border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent); border-radius: 16px; background: var(--nara-accent-soft); }
.sec-codes-title { font-size: 14.5px; font-weight: 800; }
.sec-codes-desc { color: var(--muted-foreground); font-size: 13px; }
.sec-codes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px 16px; margin: 8px 0; padding: 14px; border-radius: 12px; background: var(--card); font-family: var(--nara-mono); font-size: 14px; letter-spacing: 0.04em; user-select: all; }

.sec-sessions { display: flex; flex-direction: column; }
.sec-session { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border); }
.sec-session:first-child { padding-top: 0; }
.sec-session-icon { display: grid; width: 40px; height: 40px; flex: none; place-items: center; border-radius: 12px; background: var(--nara-surface-soft); color: var(--muted-foreground); }
.sec-session-icon svg { width: 20px; height: 20px; }
.sec-session-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.sec-session-name { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 700; letter-spacing: -0.01em; }
.sec-session-meta { color: var(--muted-foreground); font-size: 12.5px; }

.sec-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; padding-top: 18px; border-top: 1px solid var(--border); }
.sec-actions--flush { padding-top: 4px; border-top: 0; }
.sec-msg { display: flex; margin-right: auto; align-items: center; gap: 8px; font-size: 13.5px; }
.sec-msg--error { color: var(--nara-danger); }
.sec-msg--ok { color: var(--primary); }
.sec-msg--muted { color: var(--muted-foreground); }
.sec-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 16%, transparent); }

.sec-btn { display: inline-flex; height: 40px; align-items: center; padding: 0 16px; border: 1px solid var(--border); border-radius: 11px; background: var(--background); font-size: 13.5px; font-weight: 600; transition: border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease; }
.sec-btn:hover:not(:disabled) { border-color: color-mix(in srgb, var(--primary) 50%, transparent); color: var(--primary); }
.sec-btn--danger:hover:not(:disabled) { border-color: color-mix(in srgb, var(--destructive) 50%, transparent); color: var(--nara-danger); }
.sec-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.sec-primary, .sec-danger { height: 42px; padding: 0 20px; border-radius: 12px; font-size: 14px; font-weight: 700; transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
.sec-primary { background: var(--nara-ink-raised); color: var(--nara-ink-fg); box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line), var(--nara-shadow); }
.sec-danger { background: var(--destructive); color: var(--destructive-foreground); box-shadow: var(--nara-shadow); }
.sec-primary:hover:not(:disabled), .sec-danger:hover:not(:disabled) { transform: translateY(-1px); }
.sec-primary:disabled, .sec-danger:disabled { cursor: not-allowed; opacity: 0.6; }
</style>
