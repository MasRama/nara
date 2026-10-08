<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { z } from 'zod';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
  AVATAR_MAX_FILE_SIZE_MB,
  profileInputSchema,
} from '../../contract';
import type { UserProfile } from '../../contract';
import { createUsersClient } from '../client';
import type { UsersWebHost } from '../host';

type FieldErrors = Record<string, string[]>;

const passwordChangeInputSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(1, 'New password is required'),
});

const props = defineProps<{ host: UsersWebHost }>();

const usersClient = createUsersClient({ csrf: props.host.csrf });
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

const displayName = computed(() => profile.value?.name || props.host.currentSessionUser()?.name || 'Your account');
const initials = computed(() => {
  const value = displayName.value.trim();
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'NA';
});
const avatarUrl = computed(() => profile.value?.avatar || props.host.currentSessionUser()?.avatar || '');

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
  props.host.syncSessionUser({ id: user.id, name: user.name, email: user.email, avatar: user.avatar });
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
        authenticated = await props.host.refreshSession();
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

  const parsed = passwordChangeInputSchema.safeParse({
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
  });
  if (!parsed.success) {
    passwordErrors.value = errorsFromIssues(parsed.error.issues);
    passwordError.value = 'Please correct the highlighted password fields.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordErrors.value = { confirmPassword: ['Passwords do not match'] };
    passwordError.value = 'Please correct the highlighted password fields.';
    return;
  }

  passwordSaving.value = true;
  try {
    const response = await props.host.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
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
  if (!AVATAR_ALLOWED_MIME_TYPES.some((type) => type === file.type)) {
    avatarError.value = 'Choose a JPEG, PNG, GIF, or WebP image.';
    input.value = '';
    return;
  }
  if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
    avatarError.value = `Choose an image smaller than ${AVATAR_MAX_FILE_SIZE_MB}MB.`;
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

    const currentUser = profile.value ?? props.host.currentSessionUser();
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
  <main class="nara-page">
    <section class="nara-page-inner">
      <header>
        <h1 class="nara-page-title">Your profile<span class="nara-page-title-accent">.</span></h1>
        <p class="nara-page-lede">Keep your personal details, profile photo, and sign-in access up to date.</p>
      </header>

      <p v-if="profileLoading" role="status" class="prof-alert prof-alert--muted nara-page-body">Loading profile…</p>
      <p v-if="profileLoadError" role="alert" class="prof-alert prof-alert--error nara-page-body">{{ profileLoadError }}</p>

      <template v-if="profile">
        <div class="prof-settings nara-page-body">
          <section class="prof-row" aria-labelledby="photo-title">
            <div class="prof-row-intro">
              <h2 id="photo-title" class="prof-row-title">Profile photo</h2>
              <p class="prof-row-desc">JPEG, PNG, GIF, or WebP up to {{ AVATAR_MAX_FILE_SIZE_MB }}MB.</p>
            </div>
            <div class="prof-row-body">
              <div class="prof-photo">
                <label for="avatar-file" :class="['prof-avatar', { 'prof-avatar--busy': avatarSaving }]" :title="avatarSaving ? 'Uploading…' : 'Change profile photo'">
                  <img v-if="avatarUrl" data-testid="profile-avatar" :src="avatarUrl" :alt="`${displayName} avatar`" />
                  <span v-else data-testid="profile-avatar-fallback">{{ initials }}</span>
                  <span class="prof-avatar-overlay" aria-hidden="true">{{ avatarSaving ? '…' : 'Change' }}</span>
                </label>
                <div class="min-w-0 flex-1">
                  <p class="prof-name font-heading">{{ displayName }}</p>
                  <p class="prof-email">{{ profile.email }}</p>
                </div>
                <label for="avatar-file" :class="['prof-btn', { 'pointer-events-none opacity-60': avatarSaving }]">
                  {{ avatarSaving ? 'Uploading…' : 'Change profile photo' }}
                </label>
                <input id="avatar-file" type="file" :accept="AVATAR_ALLOWED_MIME_TYPES.join(',')" class="sr-only" :disabled="avatarSaving" @change="handleAvatarChange" />
              </div>
              <p v-if="avatarError" role="alert" class="prof-msg prof-msg--error">{{ avatarError }}</p>
              <p v-if="avatarNotice" role="status" class="prof-msg prof-msg--ok"><span class="prof-dot"></span>{{ avatarNotice }}</p>
            </div>
          </section>

          <section class="prof-row" aria-labelledby="personal-title">
            <div class="prof-row-intro">
              <h2 id="personal-title" class="prof-row-title">Personal information</h2>
              <p class="prof-row-desc">How your name and email appear across the app.</p>
            </div>
            <form class="prof-row-body" data-testid="profile-form" @submit.prevent="saveProfile">
              <div class="prof-field">
                <label for="name">Full name</label>
                <input id="name" v-model="name" name="name" type="text" autocomplete="name" class="prof-input" :aria-invalid="Boolean(profileErrors.name)" :aria-describedby="profileErrors.name ? 'name-error' : undefined" />
                <p v-if="profileErrors.name" id="name-error" class="prof-error">{{ profileErrors.name[0] }}</p>
              </div>
              <div class="prof-field">
                <label for="email">Email address</label>
                <input id="email" v-model="email" name="email" type="email" autocomplete="email" class="prof-input" :aria-invalid="Boolean(profileErrors.email)" :aria-describedby="profileErrors.email ? 'email-error' : undefined" />
                <p v-if="profileErrors.email" id="email-error" class="prof-error">{{ profileErrors.email[0] }}</p>
              </div>
              <div class="prof-actions">
                <p v-if="profileError" role="alert" class="prof-msg prof-msg--error">{{ profileError }}</p>
                <p v-if="profileNotice" role="status" class="prof-msg prof-msg--ok"><span class="prof-dot"></span>{{ profileNotice }}</p>
                <button type="submit" :disabled="profileSaving" class="prof-primary">{{ profileSaving ? 'Saving…' : 'Save profile' }}</button>
              </div>
            </form>
          </section>

          <section id="security" class="prof-row" aria-labelledby="security-title">
            <div class="prof-row-intro">
              <h2 id="security-title" class="prof-row-title">Change password</h2>
              <p class="prof-row-desc">Confirm your current password before choosing a new one. Your session stays active after the change.</p>
            </div>
            <form class="prof-row-body" data-testid="password-form" @submit.prevent="changePassword">
              <div class="prof-field">
                <label for="current_password">Current password</label>
                <input id="current_password" v-model="currentPassword" name="current_password" type="password" autocomplete="current-password" class="prof-input" :aria-invalid="Boolean(passwordErrors.currentPassword)" />
                <p v-if="passwordErrors.currentPassword" class="prof-error">{{ passwordErrors.currentPassword[0] }}</p>
              </div>
              <div class="grid gap-5 sm:grid-cols-2">
                <div class="prof-field">
                  <label for="new_password">New password</label>
                  <input id="new_password" v-model="newPassword" name="new_password" type="password" autocomplete="new-password" class="prof-input" :aria-invalid="Boolean(passwordErrors.newPassword)" />
                  <p v-if="passwordErrors.newPassword" class="prof-error">{{ passwordErrors.newPassword[0] }}</p>
                </div>
                <div class="prof-field">
                  <label for="confirm_password">Confirm new password</label>
                  <input id="confirm_password" v-model="confirmPassword" name="confirm_password" type="password" autocomplete="new-password" class="prof-input" :aria-invalid="Boolean(passwordErrors.confirmPassword)" />
                  <p v-if="passwordErrors.confirmPassword" class="prof-error">{{ passwordErrors.confirmPassword[0] }}</p>
                </div>
              </div>
              <div class="prof-actions">
                <p v-if="passwordError" role="alert" class="prof-msg prof-msg--error">{{ passwordError }}</p>
                <p v-if="passwordNotice" role="status" class="prof-msg prof-msg--ok"><span class="prof-dot"></span>{{ passwordNotice }}</p>
                <button type="submit" :disabled="passwordSaving" class="prof-primary">{{ passwordSaving ? 'Updating…' : 'Update password' }}</button>
              </div>
            </form>
          </section>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped>
.prof-alert { padding: 12px 16px; border: 1px solid; border-radius: 14px; font-size: 14px; }
.prof-alert--muted { border-color: var(--border); background: var(--card); color: var(--muted-foreground); }
.prof-alert--error { border-color: color-mix(in srgb, var(--destructive) 30%, transparent); background: color-mix(in srgb, var(--destructive) 8%, transparent); color: var(--nara-danger); }

/* Settings rows */
.prof-settings { border-top: 1px solid var(--border); }
.prof-row { display: grid; gap: 20px; padding: 32px 0; border-bottom: 1px solid var(--border); scroll-margin-top: 96px; }
.prof-row:last-child { border-bottom: 0; }
@media (min-width: 900px) { .prof-row { grid-template-columns: 260px minmax(0, 1fr); gap: 48px; padding: 36px 0; } }
.prof-row-title { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.035em; }
.prof-row-desc { margin-top: 6px; max-width: 260px; color: var(--muted-foreground); font-size: 13.5px; line-height: 1.7; }
.prof-row-body { display: flex; flex-direction: column; gap: 18px; padding: 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--card); box-shadow: var(--nara-shadow); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.prof-row:target .prof-row-body { border-color: color-mix(in srgb, var(--primary) 45%, transparent); box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 8%, transparent), var(--nara-shadow); }

.prof-photo { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; }
.prof-avatar { position: relative; display: grid; width: 72px; height: 72px; flex: none; place-items: center; overflow: hidden; border-radius: 20px; background: var(--nara-avatar); color: var(--nara-avatar-fg); font-size: 24px; font-weight: 800; letter-spacing: -0.06em; box-shadow: inset 0 1px 0 color-mix(in srgb, var(--nara-avatar-fg) 18%, transparent), 0 0 0 5px color-mix(in srgb, var(--primary) 8%, transparent); cursor: pointer; }
.prof-avatar img { width: 100%; height: 100%; object-fit: cover; }
.prof-avatar-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in srgb, var(--nara-ink) 62%, transparent); color: var(--nara-ink-fg); font-size: 12px; font-weight: 700; letter-spacing: 0; opacity: 0; transition: opacity 0.15s ease; }
.prof-avatar:hover .prof-avatar-overlay, .prof-avatar--busy .prof-avatar-overlay { opacity: 1; }
.prof-avatar--busy { pointer-events: none; }
.prof-name { font-size: 1.15rem; font-weight: 800; line-height: 1.2; letter-spacing: -0.035em; overflow-wrap: anywhere; }
.prof-email { margin-top: 3px; color: var(--muted-foreground); font-size: 13.5px; word-break: break-all; }
.prof-btn { display: inline-flex; height: 40px; align-items: center; padding: 0 16px; border: 1px solid var(--border); border-radius: 11px; background: var(--background); font-size: 13.5px; font-weight: 600; cursor: pointer; transition: border-color 0.15s ease, color 0.15s ease; }
.prof-btn:hover { border-color: color-mix(in srgb, var(--primary) 50%, transparent); color: var(--primary); }

.prof-field { display: grid; gap: 8px; }
.prof-field label { font-size: 13.5px; font-weight: 600; }
.prof-input { width: 100%; height: 44px; padding: 0 14px; border: 1px solid var(--input); border-radius: 12px; background: var(--background); font-size: 14px; outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.prof-input:focus { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent); }
.prof-input[aria-invalid='true'] { border-color: color-mix(in srgb, var(--destructive) 60%, transparent); }
.prof-error { color: var(--nara-danger); font-size: 12.5px; }

.prof-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 18px; border-top: 1px solid var(--border); }
.prof-msg { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
.prof-actions .prof-msg { margin-right: auto; }
.prof-msg--error { color: var(--nara-danger); }
.prof-msg--ok { color: var(--primary); }
.prof-dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 16%, transparent); }
.prof-primary { height: 42px; padding: 0 20px; border-radius: 12px; background: var(--nara-ink-raised); color: var(--nara-ink-fg); font-size: 14px; font-weight: 700; box-shadow: inset 0 0 0 1px var(--nara-ink-raised-line), var(--nara-shadow); transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
.prof-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 60%, transparent), var(--nara-shadow); }
.prof-primary:disabled { cursor: not-allowed; opacity: 0.6; }

</style>
