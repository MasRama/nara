<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { loginInputSchema, twoFactorChallengeInputSchema, type LoginInput } from '../../contract';
import { createAuthClient } from '../client';
import { createSecurityClient } from '../security-client';
import { useAuthSession } from '../session';
import AuthPageFrame from '../components/AuthPageFrame.vue';
import { useLocalFieldErrors, useLocalText, type LocalFieldErrors, type ValidationIssue } from '../../../../shared/i18n';
import { error as errorText, issue as issueText, t } from '../locales';

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const isSubmitting = ref(false);
const formError = useLocalText();
const fieldErrors = useLocalFieldErrors();
const step = ref<'password' | 'two-factor'>('password');
const useRecoveryCode = ref(false);
const twoFactorCode = ref('');
const twoFactorInput = ref<HTMLInputElement | null>(null);

const authClient = createAuthClient();
const securityClient = createSecurityClient();
const authSession = useAuthSession();
const route = useRoute();
const router = useRouter();

function mapIssues(issues: ValidationIssue[]): LocalFieldErrors {
  const mapped: LocalFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root';
    mapped[key] ??= [];
    mapped[key].push(() => issueText(issue));
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
  formError.value = () => t('common.correctFields');
  return undefined;
}

async function finishSignIn(): Promise<void> {
  if (!(await authSession.refresh())) {
    formError.value = () => t('login.sessionFailed');
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
      formError.value = () => errorText(response);
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
    formError.value = () => t('login.failed');
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
    formError.value = () => t('common.correctFields');
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
      formError.value = () => errorText(response);
      fieldErrors.value = response.errors ?? {};
      return;
    }
    await finishSignIn();
  } catch (error) {
    console.error(error);
    formError.value = () => t('login.twoFactor.failed');
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
    :heading="t('login.twoFactor.heading')"
    :highlight="t('login.twoFactor.highlight')"
    :description="useRecoveryCode ? t('login.twoFactor.recoveryDescription') : t('login.twoFactor.appDescription')"
  >
      <form class="nara-auth-form" data-testid="two-factor-form" @submit.prevent="submitTwoFactor">
        <label class="nara-auth-field" for="two-factor-code">
          {{ useRecoveryCode ? t('login.twoFactor.recoveryLabel') : t('login.twoFactor.codeLabel') }}
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
          {{ isSubmitting ? t('login.twoFactor.submitting') : t('login.twoFactor.submit') }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
        <button type="button" class="nara-auth-quiet-button" @click="toggleRecoveryCode">
          {{ useRecoveryCode ? t('login.twoFactor.useApp') : t('login.twoFactor.useRecovery') }}
        </button>
      </form>

      <p class="nara-auth-alt">
        {{ t('login.twoFactor.notYou') }}
        <button type="button" class="nara-auth-link-button" @click="startOver">{{ t('login.twoFactor.switchAccount') }}</button>
      </p>
  </AuthPageFrame>

  <AuthPageFrame v-else :heading="t('login.heading')" :highlight="t('login.highlight')">
      <form class="nara-auth-form" @submit.prevent="submitLogin">
        <label class="nara-auth-field" for="email">
          {{ t('common.email') }}
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            :aria-invalid="Boolean(fieldErrors.email)"
            :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
            :placeholder="t('common.emailPlaceholder')"
            class="nara-auth-input"
          />
          <span v-if="fieldErrors.email" id="email-error" class="nara-auth-error">{{ fieldErrors.email[0] }}</span>
        </label>

        <label class="nara-auth-field" for="password">
          {{ t('common.password') }}
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
              :aria-label="showPassword ? t('common.hidePassword') : t('common.showPassword')"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? t('common.hide') : t('common.show') }}
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
          {{ isSubmitting ? t('login.submitting') : t('login.submit') }}<span v-if="!isSubmitting" class="nara-auth-submit-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      <p class="nara-auth-alt">
        {{ t('login.newHere') }}
        <RouterLink :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : {} }">{{ t('login.register') }} <span aria-hidden="true">↗</span></RouterLink>
      </p>
  </AuthPageFrame>
</template>
