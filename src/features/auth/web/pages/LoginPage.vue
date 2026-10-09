<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { loginInputSchema, twoFactorChallengeInputSchema, type LoginInput } from '../../contract';
import { createAuthClient } from '../client';
import { createSecurityClient } from '../security-client';
import { SESSION_ENDED_REASON, useAuthSession } from '../session';
import AuthPageFrame from '../components/AuthPageFrame.vue';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isSubmitting = ref(false);
const formError = ref('');
const fieldErrors = ref<Record<string, string[]>>({});
const step = ref<'password' | 'two-factor'>('password');
const useRecoveryCode = ref(false);
const twoFactorCode = ref('');
const twoFactorInput = ref<HTMLInputElement | null>(null);

const authClient = createAuthClient();
const securityClient = createSecurityClient();
const authSession = useAuthSession();
const route = useRoute();
const router = useRouter();

function mapIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(issue.message);
  }
  return mapped;
}

function redirectTarget(): string {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return '/dashboard';
}

function validate(): LoginInput | undefined {
  const parsed = loginInputSchema.safeParse({
    email: email.value,
    password: password.value,
  });
  if (parsed.success) {
    fieldErrors.value = {};
    return parsed.data;
  }

  fieldErrors.value = mapIssues(parsed.error.issues);
  formError.value = 'Please correct the highlighted fields.';
  return undefined;
}

async function finishSignIn(): Promise<void> {
  if (!(await authSession.refresh())) {
    formError.value = 'Sign in succeeded, but the current session could not be loaded.';
    return;
  }
  await router.replace(redirectTarget());
}

async function focusTwoFactor(): Promise<void> {
  await nextTick();
  twoFactorInput.value?.focus();
}

async function submitLogin(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  const input = validate();
  if (!input) return;

  isSubmitting.value = true;
  try {
    const response = await authClient.login(input);
    if (!response.success) {
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }

    if (response.data?.twoFactorRequired) {
      password.value = '';
      step.value = 'two-factor';
      await focusTwoFactor();
      return;
    }
    await finishSignIn();
  } catch (error) {
    console.error(error);
    formError.value = 'Unable to sign in';
  } finally {
    isSubmitting.value = false;
  }
}

async function submitTwoFactor(): Promise<void> {
  if (isSubmitting.value) return;

  formError.value = '';
  fieldErrors.value = {};
  const parsed = twoFactorChallengeInputSchema.safeParse(
    useRecoveryCode.value ? { recovery_code: twoFactorCode.value } : { code: twoFactorCode.value },
  );
  if (!parsed.success) {
    fieldErrors.value = mapIssues(parsed.error.issues);
    formError.value = 'Please correct the highlighted fields.';
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await securityClient.completeTwoFactor(parsed.data);
    if (!response.success) {
      if (response.code === 'TWO_FACTOR_CHALLENGE_EXPIRED' || response.code === 'TWO_FACTOR_LOCKED') {
        startOver();
      } else {
        twoFactorCode.value = '';
      }
      formError.value = response.message;
      fieldErrors.value = response.errors ?? {};
      return;
    }
    await finishSignIn();
  } catch (error) {
    console.error(error);
    formError.value = 'Unable to verify the code';
  } finally {
    isSubmitting.value = false;
  }
}

async function toggleRecoveryCode(): Promise<void> {
  useRecoveryCode.value = !useRecoveryCode.value;
  twoFactorCode.value = '';
  formError.value = '';
  fieldErrors.value = {};
  await focusTwoFactor();
}

function startOver(): void {
  step.value = 'password';
  useRecoveryCode.value = false;
  twoFactorCode.value = '';
  formError.value = '';
  fieldErrors.value = {};
}
</script>

<template>
  <AuthPageFrame
    v-if="step === 'two-factor'"
    heading="Confirm it's"
    highlight="you."
    :description="useRecoveryCode ? 'Enter one of the recovery codes you saved when you turned on two-factor authentication.' : 'Open your authenticator app and enter the 6-digit code for this account.'"
  >
      <form class="nara-auth-form" data-testid="two-factor-form" @submit.prevent="submitTwoFactor">
        <label class="nara-auth-field" for="two-factor-code">
          {{ useRecoveryCode ? 'Recovery code' : 'Authentication code' }}
          <input
            id="two-factor-code"
            ref="twoFactorInput"
            v-model="twoFactorCode"
            type="text"
            name="code"
            :inputmode="useRecoveryCode ? 'text' : 'numeric'"
            :autocomplete="useRecoveryCode ? 'off' : 'one-time-code'"
            :maxlength="useRecoveryCode ? 32 : 6"
            :placeholder="useRecoveryCode ? 'xxxxx-xxxxx' : '123456'"
            spellcheck="false"
            required
            :aria-invalid="Boolean(fieldErrors.code || fieldErrors.recovery_code)"
            class="nara-auth-input nara-auth-input-code"
          />
          <span v-if="fieldErrors.code || fieldErrors.recovery_code" class="nara-auth-error">{{ (fieldErrors.code ?? fieldErrors.recovery_code)![0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="nara-auth-alert">{{ formError }}</p>

        <button type="submit" :disabled="isSubmitting" class="nara-auth-submit">
          {{ isSubmitting ? 'Verifying…' : 'Verify and sign in' }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" class="nara-auth-quiet-button" @click="toggleRecoveryCode">
          {{ useRecoveryCode ? 'Use your authenticator app instead' : 'Use a recovery code' }}
        </button>
      </form>

      <p class="nara-auth-alt">
        Not you?
        <button type="button" class="nara-auth-link-button" @click="startOver">Sign in with a different account</button>
      </p>
  </AuthPageFrame>

  <AuthPageFrame v-else heading="Welcome" highlight="back.">
      <form class="nara-auth-form" @submit.prevent="submitLogin">
        <p v-if="route.query.reason === SESSION_ENDED_REASON" role="status" class="nara-auth-notice">Your session was ended. Sign in again to continue.</p>
        <label class="nara-auth-field" for="email">
          Email
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="Boolean(fieldErrors.email)"
            :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            placeholder="you@example.com"
            class="nara-auth-input"
          />
          <span v-if="fieldErrors.email" id="email-error" class="nara-auth-error">{{ fieldErrors.email[0] }}</span>
        </label>

        <label class="nara-auth-field" for="password">
          Password
          <span class="nara-auth-password-wrap">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              name="password"
              autocomplete="current-password"
              required
              :aria-invalid="Boolean(fieldErrors.password)"
              :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
            class="nara-auth-input nara-auth-input-password"
            />
            <button
              type="button"
              class="nara-auth-show"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </span>
          <span v-if="fieldErrors.password" id="password-error" class="nara-auth-error">{{ fieldErrors.password[0] }}</span>
        </label>

        <p v-if="formError" role="alert" class="nara-auth-alert">
          {{ formError }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="nara-auth-submit"
        >
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p class="nara-auth-alt">
        New to Nara?
        <RouterLink :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">Create an account <span aria-hidden="true">↗</span></RouterLink>
      </p>
  </AuthPageFrame>
</template>
