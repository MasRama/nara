<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { changePasswordInputSchema, createAuthClient, useAuthSession } from '../../../auth/web';
import type { ChangePasswordInput } from '../../../auth/web';
import { profileInputSchema } from '../../contract';
import type { UserProfile } from '../../contract';
import { createUsersClient } from '../client';

type FieldErrors = Record<string, string[]>;

const authSession = useAuthSession();
const authClient = createAuthClient();
const usersClient = createUsersClient();
const router = useRouter();

const profile = ref<UserProfile | null>(null);
const name = ref('');
const email = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const profileLoading = ref(true);
const profileSaving = ref(false);
const passwordSaving = ref(false);
const avatarSaving = ref(false);
const profileLoadError = ref('');
const profileError = ref('');
const profileNotice = ref('');
const passwordError = ref('');
const passwordNotice = ref('');
const avatarError = ref('');
const avatarNotice = ref('');
const profileErrors = ref<FieldErrors>({});
const passwordErrors = ref<FieldErrors>({});

const displayName = computed(() => profile.value?.name || authSession.user.value?.name || 'Your account');
const initials = computed(() => {
  const value = displayName.value.trim();
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA';
});
const avatarUrl = computed(() => profile.value?.avatar || authSession.user.value?.avatar || '');

function errorsFromIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

function setSessionUser(user: UserProfile): void {
  profile.value = user;
  name.value = user.name;
  email.value = user.email;
  authSession.setAuthenticated(user);
}

async function loadProfile(): Promise<void> {
  profileLoading.value = true;
  profileLoadError.value = '';
  try {
    const response = await usersClient.me();
    if (response.success) {
      setSessionUser(response.data.user);
      return;
    }

    if (response.code === 'UNAUTHORIZED') {
      let authenticated = false;
      try {
        authenticated = await authSession.refresh();
      } catch {
        authenticated = false;
      }
      if (!authenticated) {
        await router.replace({ name: 'login', query: { redirect: '/profile' } });
        return;
      }
    }
    profileLoadError.value = response.message;
  } catch (error) {
    profileLoadError.value = error instanceof Error ? error.message : 'Unable to load your profile';
  } finally {
    profileLoading.value = false;
  }
}

async function saveProfile(): Promise<void> {
  profileError.value = '';
  profileNotice.value = '';
  profileErrors.value = {};

  const parsed = profileInputSchema.safeParse({ name: name.value.trim(), email: email.value.trim() });
  if (!parsed.success) {
    profileErrors.value = errorsFromIssues(parsed.error.issues);
    profileError.value = 'Please correct the highlighted profile fields.';
    return;
  }

  profileSaving.value = true;
  try {
    const response = await usersClient.updateProfile(parsed.data);
    if (!response.success) {
      profileErrors.value = response.errors ?? {};
      profileError.value = response.message;
      return;
    }

    setSessionUser(response.data.user);
    profileNotice.value = 'Profile changes saved.';
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : 'Unable to save your profile';
  } finally {
    profileSaving.value = false;
  }
}

async function changePassword(): Promise<void> {
  passwordError.value = '';
  passwordNotice.value = '';
  passwordErrors.value = {};

  const input: ChangePasswordInput = {
    current_password: currentPassword.value,
    new_password: newPassword.value,
  };
  const parsed = changePasswordInputSchema.safeParse(input);
  if (!parsed.success) {
    passwordErrors.value = errorsFromIssues(parsed.error.issues);
    passwordError.value = 'Please correct the highlighted password fields.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordErrors.value = { confirm_password: ['Passwords do not match'] };
    passwordError.value = 'Please correct the highlighted password fields.';
    return;
  }

  passwordSaving.value = true;
  try {
    const response = await authClient.changePassword(parsed.data);
    if (!response.success) {
      passwordErrors.value = response.errors ?? {};
      passwordError.value = response.message;
      return;
    }

    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    passwordNotice.value = response.message;
  } catch (error) {
    passwordError.value = error instanceof Error ? error.message : 'Unable to change your password';
  } finally {
    passwordSaving.value = false;
  }
}

async function handleAvatarChange(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const file = input.files?.[0];
  if (!file) return;

  avatarError.value = '';
  avatarNotice.value = '';
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    avatarError.value = 'Choose a JPEG, PNG, GIF, or WebP image.';
    input.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarError.value = 'Choose an image smaller than 5MB.';
    input.value = '';
    return;
  }

  avatarSaving.value = true;
  try {
    const response = await usersClient.uploadAvatar(file);
    if (!response.success) {
      avatarError.value = response.message;
      return;
    }

    const currentUser = profile.value ?? authSession.user.value;
    if (currentUser) {
      setSessionUser({ ...currentUser, avatar: response.data.url });
    }
    avatarNotice.value = 'Profile photo updated.';
  } catch (error) {
    avatarError.value = error instanceof Error ? error.message : 'Unable to update your profile photo';
  } finally {
    avatarSaving.value = false;
    input.value = '';
  }
}

onMounted(() => {
  void loadProfile();
});
</script>

<template>
  <main class="relative overflow-hidden px-6 py-12 sm:px-10 lg:px-16 lg:py-16">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] text-foreground opacity-[0.03] [background-size:22px_22px] dark:opacity-[0.05]"></div>

    <section class="relative mx-auto max-w-[1100px]">
      <div class="flex flex-col gap-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="font-heading text-xs uppercase tracking-[0.25em] text-primary">Account</p>
            <h1 class="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Your profile</h1>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Keep your personal details, profile photo, and sign-in access up to date.
            </p>
          </div>
          <RouterLink to="/dashboard" class="text-sm text-muted-foreground transition-colors hover:text-foreground">Back to dashboard</RouterLink>
        </div>

        <p v-if="profileLoading" role="status" class="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Loading profile…</p>
        <p v-if="profileLoadError" role="alert" class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ profileLoadError }}</p>

        <template v-if="profile">
          <section class="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" aria-labelledby="identity-title">
            <article class="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-4">
                  <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted font-heading text-xl font-semibold">
                    <img v-if="avatarUrl" data-testid="profile-avatar" :src="avatarUrl" :alt="`${displayName} avatar`" class="h-full w-full object-cover" />
                    <span v-else data-testid="profile-avatar-fallback">{{ initials }}</span>
                  </div>
                  <div class="min-w-0">
                    <h2 id="identity-title" class="truncate font-heading text-lg font-semibold tracking-tight">{{ displayName }}</h2>
                    <p class="mt-1 truncate text-sm text-muted-foreground">{{ profile.email }}</p>
                  </div>
                </div>
                <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Account</span>
              </div>

              <label for="avatar-file" class="mt-6 inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground" :class="avatarSaving ? 'pointer-events-none opacity-60' : ''">
                {{ avatarSaving ? 'Uploading…' : 'Change profile photo' }}
              </label>
              <input id="avatar-file" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="sr-only" :disabled="avatarSaving" @change="handleAvatarChange" />
              <p class="mt-2 text-xs text-muted-foreground">JPEG, PNG, GIF, or WebP up to 5MB.</p>
              <p v-if="avatarError" role="alert" class="mt-3 text-sm text-destructive">{{ avatarError }}</p>
              <p v-if="avatarNotice" role="status" class="mt-3 text-sm text-primary">{{ avatarNotice }}</p>
            </article>

            <article class="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8" aria-labelledby="personal-title">
              <div>
                <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Personal information</p>
                <h2 id="personal-title" class="mt-2 font-heading text-2xl font-semibold tracking-tight">Make it yours</h2>
                <p class="mt-2 text-sm leading-relaxed text-muted-foreground">Use a name and email address that make it easy to recognize your account.</p>
              </div>

              <form class="mt-6 flex flex-col gap-5" data-testid="profile-form" @submit.prevent="saveProfile">
                <div>
                  <label for="name" class="mb-2 block text-sm font-medium">Full name</label>
                  <input id="name" v-model="name" name="name" type="text" autocomplete="name" class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" :aria-invalid="Boolean(profileErrors.name)" :aria-describedby="profileErrors.name ? 'name-error' : undefined" />
                  <p v-if="profileErrors.name" id="name-error" class="mt-1 text-sm text-destructive">{{ profileErrors.name[0] }}</p>
                </div>
                <div>
                  <label for="email" class="mb-2 block text-sm font-medium">Email address</label>
                  <input id="email" v-model="email" name="email" type="email" autocomplete="email" class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" :aria-invalid="Boolean(profileErrors.email)" :aria-describedby="profileErrors.email ? 'email-error' : undefined" />
                  <p v-if="profileErrors.email" id="email-error" class="mt-1 text-sm text-destructive">{{ profileErrors.email[0] }}</p>
                </div>
                <p v-if="profileError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{{ profileError }}</p>
                <p v-if="profileNotice" role="status" class="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{{ profileNotice }}</p>
                <div class="flex justify-end border-t border-border pt-5">
                  <button type="submit" :disabled="profileSaving" class="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                    {{ profileSaving ? 'Saving…' : 'Save profile' }}
                  </button>
                </div>
              </form>
            </article>
          </section>

          <section id="security" class="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8" aria-labelledby="security-title">
            <div>
              <p class="font-heading text-xs uppercase tracking-[0.2em] text-muted-foreground">Security</p>
              <h2 id="security-title" class="mt-2 font-heading text-2xl font-semibold tracking-tight">Change password</h2>
              <p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Confirm your current password before choosing a new one. Your session stays active after the change.</p>
            </div>

            <form class="mt-6 grid gap-5 sm:grid-cols-3" data-testid="password-form" @submit.prevent="changePassword">
              <div class="sm:col-span-3">
                <label for="current_password" class="mb-2 block text-sm font-medium">Current password</label>
                <input id="current_password" v-model="currentPassword" name="current_password" type="password" autocomplete="current-password" class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" :aria-invalid="Boolean(passwordErrors.current_password)" />
                <p v-if="passwordErrors.current_password" class="mt-1 text-sm text-destructive">{{ passwordErrors.current_password[0] }}</p>
              </div>
              <div>
                <label for="new_password" class="mb-2 block text-sm font-medium">New password</label>
                <input id="new_password" v-model="newPassword" name="new_password" type="password" autocomplete="new-password" class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" :aria-invalid="Boolean(passwordErrors.new_password)" />
                <p v-if="passwordErrors.new_password" class="mt-1 text-sm text-destructive">{{ passwordErrors.new_password[0] }}</p>
              </div>
              <div>
                <label for="confirm_password" class="mb-2 block text-sm font-medium">Confirm new password</label>
                <input id="confirm_password" v-model="confirmPassword" name="confirm_password" type="password" autocomplete="new-password" class="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20" :aria-invalid="Boolean(passwordErrors.confirm_password)" />
                <p v-if="passwordErrors.confirm_password" class="mt-1 text-sm text-destructive">{{ passwordErrors.confirm_password[0] }}</p>
              </div>
              <div class="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p v-if="passwordError" role="alert" class="text-sm text-destructive">{{ passwordError }}</p>
                  <p v-if="passwordNotice" role="status" class="text-sm text-primary">{{ passwordNotice }}</p>
                </div>
                <button type="submit" :disabled="passwordSaving" class="rounded-md border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60">
                  {{ passwordSaving ? 'Updating…' : 'Update password' }}
                </button>
              </div>
            </form>
          </section>
        </template>
      </div>
    </section>
  </main>
</template>
