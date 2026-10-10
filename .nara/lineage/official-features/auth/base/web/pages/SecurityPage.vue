<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { AUTH_SESSIONS_CHANGED_EVENT, confirmPasswordInputSchema, twoFactorCodeInputSchema, type SessionData, type TwoFactorSetup, type TwoFactorStatus } from '../../contract';
import { encodeQr, qrSvgPath } from '../qr';
import { createSecurityClient } from '../security-client';
import { useAuthSession } from '../session';
import { onServerEvent } from '../../../../shared/realtime/browser';

type PasswordAction = 'setup' | 'regenerate' | 'disable';

const client = createSecurityClient();
const authSession = useAuthSession();

const twoFactor = ref<TwoFactorStatus | null>(null);
const sessions = ref<SessionData[]>([]);
const loading = ref(true);
const loadError = ref('');

const passwordAction = ref<PasswordAction | null>(null);
const password = ref('');
const setup = ref<TwoFactorSetup | null>(null);
const code = ref('');
const recoveryCodes = ref<string[]>([]);
const twoFactorBusy = ref(false);
const twoFactorError = ref('');
const twoFactorNotice = ref('');
const fieldError = ref('');

const sessionBusy = ref<string | null>(null);
const sessionError = ref('');
const sessionNotice = ref('');

const qr = computed(() => {
  if (!setup.value) return null;
  const modules = encodeQr(setup.value.otpauthUrl);
  return { size: modules.length + 8, path: qrSvgPath(modules) };
});
const groupedSecret = computed(() => setup.value?.secret.match(/.{1,4}/g)?.join(' ') ?? '');
const otherSessions = computed(() => sessions.value.filter((session) => !session.current).length);
const passwordActionLabel = computed<Record<PasswordAction, { title: string; submit: string; busy: string }>>(() => ({
  setup: { title: 'Confirm your password to start setup.', submit: 'Continue', busy: 'Checking…' },
  regenerate: {
    title: 'Confirm your password to replace your recovery codes. Old codes stop working.',
    submit: 'Generate new codes',
    busy: 'Generating…',
  },
  disable: { title: 'Confirm your password to turn off two-factor authentication.', submit: 'Turn off', busy: 'Turning off…' },
}));

function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function relativeTime(timestamp: number): string {
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return 'just now';
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86_400], ['hour', 3_600], ['minute', 60]];
  const [unit, size] = units.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds)!;
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / size), unit);
}

/** Readable "Browser on OS" label from a user agent; falls back to the raw string. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
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
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? userAgent.slice(0, 60);
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    const [status, list] = await Promise.all([client.twoFactorStatus(), client.listSessions()]);
    if (!status.success) throw new Error(status.message);
    if (!list.success) throw new Error(list.message);
    twoFactor.value = status.data!.twoFactor;
    sessions.value = list.data!.sessions;
  } catch (error) {
    console.error(error);
    loadError.value = 'Unable to load security settings';
  } finally {
    loading.value = false;
  }
}

// A device signed in or out elsewhere: refresh the list in place, without the loading state.
async function followSessionChanges(): Promise<void> {
  try {
    const list = await client.listSessions();
    if (list.success) sessions.value = list.data!.sessions;
  } catch (error) {
    console.error(error);
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
    fieldError.value = parsed.error.issues[0]!.message;
    return;
  }

  twoFactorBusy.value = true;
  try {
    if (action === 'setup') {
      const response = await client.startTwoFactorSetup(parsed.data);
      if (!response.success) throw new Error(response.message);
      setup.value = response.data!;
      passwordAction.value = null;
      password.value = '';
    } else if (action === 'regenerate') {
      const response = await client.regenerateRecoveryCodes(parsed.data);
      if (!response.success) throw new Error(response.message);
      resetTwoFactorForm();
      recoveryCodes.value = response.data!.recoveryCodes;
      await refreshStatus();
    } else {
      const response = await client.disableTwoFactor(parsed.data);
      if (!response.success) throw new Error(response.message);
      resetTwoFactorForm();
      twoFactorNotice.value = 'Two-factor authentication is off.';
      await refreshStatus();
    }
  } catch (error) {
    console.error(error);
    twoFactorError.value = 'Something went wrong';
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
    fieldError.value = parsed.error.issues[0]!.message;
    return;
  }

  twoFactorBusy.value = true;
  try {
    const response = await client.enableTwoFactor(parsed.data);
    if (!response.success) {
      // The code was already checked against the same schema here, so a server-side code error is a mismatch.
      fieldError.value = response.errors?.code?.length ? 'That code did not match. Check your device clock and try again.' : '';
      if (!fieldError.value) twoFactorError.value = response.message;
      return;
    }
    resetTwoFactorForm();
    recoveryCodes.value = response.data!.recoveryCodes;
    await refreshStatus();
  } catch (error) {
    console.error(error);
    twoFactorError.value = 'Unable to enable two-factor authentication';
  } finally {
    twoFactorBusy.value = false;
  }
}

async function copyRecoveryCodes(): Promise<void> {
  try {
    await navigator.clipboard.writeText(recoveryCodes.value.join('\n'));
    twoFactorNotice.value = 'Recovery codes copied.';
  } catch {
    twoFactorError.value = 'Copy failed. Select the codes and copy them manually.';
  }
}

function downloadRecoveryCodes(): void {
  const account = authSession.user.value?.email ?? 'account';
  const body = `${`Recovery codes for ${account}`}\n${'Each code works once.'}\n\n${recoveryCodes.value.join('\n')}\n`;
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
    if (!response.success) throw new Error(response.message);
    sessions.value = sessions.value.filter((session) => session.id !== id);
    sessionNotice.value = 'Session signed out.';
  } catch (error) {
    console.error(error);
    sessionError.value = 'Unable to sign out that session';
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
    if (!response.success) throw new Error(response.message);
    sessions.value = sessions.value.filter((session) => session.current);
    const revoked = response.data!.revoked;
    sessionNotice.value = `Signed out ${revoked} other ${revoked === 1 ? 'session' : 'sessions'}.`;
  } catch (error) {
    console.error(error);
    sessionError.value = 'Unable to sign out other sessions';
  } finally {
    sessionBusy.value = null;
  }
}

onMounted(() => {
  void load();
});
onUnmounted(onServerEvent(AUTH_SESSIONS_CHANGED_EVENT, () => void followSessionChanges()));
</script>

<template>
  <main class="nara-page">
    <section class="nara-page-inner">
      <header>
        <h1 class="nara-page-title">Security<span class="nara-page-title-accent">.</span></h1>
        <p class="nara-page-lede">Add a second sign-in step and see every device that can open your account.</p>
      </header>

      <p v-if="loading" role="status" class="sec-alert sec-alert--muted nara-page-body">Loading security settings…</p>
      <p v-else-if="loadError" role="alert" class="sec-alert sec-alert--error nara-page-body">{{ loadError }}</p>

      <div v-else class="sec-settings nara-page-body">
        <section class="sec-row" aria-labelledby="two-factor-title">
          <div class="sec-row-intro">
            <h2 id="two-factor-title" class="sec-row-title">Two-factor authentication</h2>
            <p class="sec-row-desc">After your password, sign-in also asks for a code from an authenticator app such as 1Password, Google Authenticator, or Authy.</p>
          </div>

          <div class="sec-row-body" data-testid="two-factor-panel">
            <div class="sec-status">
              <span :class="['sec-badge', twoFactor?.enabled ? 'sec-badge--on' : 'sec-badge--off']">{{ twoFactor?.enabled ? 'On' : 'Off' }}</span>
              <p v-if="twoFactor?.enabled" class="sec-status-text">
                Enabled {{ shortDate(twoFactor.enabledAt!) }} ·
                <span :class="{ 'sec-warn': twoFactor.recoveryCodesRemaining <= 2 }">{{ twoFactor.recoveryCodesRemaining }} {{ twoFactor.recoveryCodesRemaining === 1 ? 'recovery code left' : 'recovery codes left' }}</span>
              </p>
              <p v-else class="sec-status-text">Your account is protected by your password only.</p>
            </div>

            <div v-if="recoveryCodes.length" class="sec-codes" data-testid="recovery-codes">
              <p class="sec-codes-title">Save your recovery codes</p>
              <p class="sec-codes-desc">Each code signs you in once if you lose your authenticator. They are shown only now.</p>
              <ol class="sec-codes-grid">
                <li v-for="recoveryCode in recoveryCodes" :key="recoveryCode">{{ recoveryCode }}</li>
              </ol>
              <div class="sec-actions sec-actions--flush">
                <button type="button" class="sec-btn" @click="copyRecoveryCodes">Copy</button>
                <button type="button" class="sec-btn" @click="downloadRecoveryCodes">Download .txt</button>
                <button type="button" class="sec-primary" @click="recoveryCodes = []; twoFactorNotice = ''">I saved them</button>
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
                <button type="button" class="sec-btn" @click="resetTwoFactorForm">Cancel</button>
                <button type="submit" :disabled="twoFactorBusy" :class="passwordAction === 'disable' ? 'sec-danger' : 'sec-primary'">
                  {{ twoFactorBusy ? passwordActionLabel[passwordAction].busy : passwordActionLabel[passwordAction].submit }}
                </button>
              </div>
            </form>

            <form v-else-if="setup && qr" class="sec-form" data-testid="two-factor-setup" @submit.prevent="submitCode">
              <div class="sec-enroll">
                <svg class="sec-qr" :viewBox="`0 0 ${qr.size} ${qr.size}`" role="img" aria-label="QR code for your authenticator app" shape-rendering="crispEdges">
                  <rect :width="qr.size" :height="qr.size" fill="#fff" />
                  <path :d="qr.path" fill="#111" />
                </svg>
                <div class="sec-enroll-steps">
                  <p><strong>1.</strong> Scan the QR code with your authenticator app.</p>
                  <p class="sec-secret-hint">Can't scan? Enter this key manually:</p>
                  <code class="sec-secret" data-testid="two-factor-secret">{{ groupedSecret }}</code>
                  <div class="sec-field">
                    <label for="two-factor-enable-code"><strong>2.</strong> Enter the 6-digit code it shows.</label>
                    <input id="two-factor-enable-code" v-model="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" class="sec-input sec-input--code" :aria-invalid="Boolean(fieldError)" />
                    <p v-if="fieldError" class="sec-error">{{ fieldError }}</p>
                  </div>
                </div>
              </div>
              <div class="sec-actions">
                <p v-if="twoFactorError" role="alert" class="sec-msg sec-msg--error">{{ twoFactorError }}</p>
                <button type="button" class="sec-btn" @click="resetTwoFactorForm">Cancel</button>
                <button type="submit" :disabled="twoFactorBusy" class="sec-primary">{{ twoFactorBusy ? 'Verifying…' : 'Turn on' }}</button>
              </div>
            </form>

            <div v-else class="sec-actions">
              <p v-if="twoFactorNotice" role="status" class="sec-msg sec-msg--ok"><span class="sec-dot"></span>{{ twoFactorNotice }}</p>
              <template v-if="twoFactor?.enabled">
                <button type="button" class="sec-btn" @click="askPassword('regenerate')">New recovery codes</button>
                <button type="button" class="sec-btn sec-btn--danger" @click="askPassword('disable')">Turn off</button>
              </template>
              <button v-else type="button" class="sec-primary" @click="askPassword('setup')">Set up two-factor</button>
            </div>
          </div>
        </section>

        <section class="sec-row" aria-labelledby="sessions-title">
          <div class="sec-row-intro">
            <h2 id="sessions-title" class="sec-row-title">Active sessions</h2>
            <p class="sec-row-desc">Devices currently signed in to your account. Sign out anything you don't recognise, then change your password.</p>
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
                    <span v-if="session.current" class="sec-badge sec-badge--on">This device</span>
                  </span>
                  <span class="sec-session-meta">
                    <span v-if="session.ipAddress">{{ session.ipAddress }} · </span>
                    Active {{ relativeTime(session.lastSeenAt ?? session.createdAt) }} · Signed in {{ shortDate(session.createdAt) }}
                  </span>
                </span>
                <button v-if="!session.current" type="button" class="sec-btn" :disabled="sessionBusy !== null" @click="revokeSession(session.id)">
                  {{ sessionBusy === session.id ? 'Signing out…' : 'Sign out' }}
                </button>
              </li>
            </ul>
            <div class="sec-actions">
              <p v-if="sessionError" role="alert" class="sec-msg sec-msg--error">{{ sessionError }}</p>
              <p v-else-if="sessionNotice" role="status" class="sec-msg sec-msg--ok"><span class="sec-dot"></span>{{ sessionNotice }}</p>
              <p v-else-if="otherSessions === 0" class="sec-msg sec-msg--muted">Only this device is signed in.</p>
              <button type="button" class="sec-btn sec-btn--danger" :disabled="otherSessions === 0 || sessionBusy !== null" @click="revokeOthers">
                {{ sessionBusy === 'others' ? 'Signing out…' : 'Sign out other sessions' }}
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
