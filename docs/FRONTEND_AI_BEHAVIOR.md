# Frontend AI Behavior Guidelines - Nara Project

Konvensi **WAJIB** untuk menjaga konsistensi kode Svelte/Inertia.

---

## 🔗 Import Conventions

**WAJIB** gunakan relative imports untuk frontend resources.

```typescript
// ✅ Correct - Components
import Header from '../Components/Header.svelte';
import UserModal from '../Components/UserModal.svelte';
import Pagination from '../Components/Pagination.svelte';

// ✅ Correct - Types
import type { User, UserForm, PaginationMeta } from '../types/user';
import { createEmptyUserForm, userToForm } from '../types/user';

// ✅ Correct - Helpers
import { api, Toast } from '../Components/helper';
```

---

## 📦 Shared Types

**WAJIB** gunakan shared types dari `resources/js/types/`.

```typescript
// resources/js/types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  is_admin: boolean;
  is_verified: boolean;
}

export interface UserForm {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  is_verified: boolean;
  password: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

---

## 🌐 API Calls

**WAJIB** gunakan `api()` helper untuk semua API calls.

```typescript
import axios from 'axios';
import { api, Toast } from '../Components/helper';

// ✅ Correct - Using api() wrapper
const result = await api(() => axios.post('/users', payload));
if (result.success) {
  // Handle success
}

// ✅ Correct - With options
const result = await api(
  () => axios.get('/users'),
  { showSuccessToast: false }
);

// ❌ Wrong - Direct axios without wrapper
const response = await axios.post('/users', payload);
```

**ApiResponse Structure:**
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;
}
```

---

## 🔔 Toast Notifications

**WAJIB** gunakan `Toast()` untuk notifikasi.

```typescript
import { Toast } from '../Components/helper';

// Success
Toast('Data berhasil disimpan', 'success');

// Error
Toast('Gagal menyimpan data', 'error');

// Warning
Toast('Peringatan: Data akan dihapus', 'warning');

// Info
Toast('Informasi penting', 'info');
```

**Note:** `api()` helper otomatis menampilkan toast untuk success/error responses.

---

## 📄 Page Component Pattern

```svelte
<script lang="ts">
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import type { User, PaginationMeta } from '../types/user';

  // Props from backend (Inertia)
  export let users: User[] = [];
  export let total: number = 0;
  export let page: number = 1;
  export let limit: number = 10;
  export let totalPages: number = 1;
  export let hasNext: boolean = false;
  export let hasPrev: boolean = false;

  // Access global props
  const currentUser = $inertiaPage.props.user as User | undefined;

  // Build pagination meta
  $: paginationMeta = { total, page, limit, totalPages, hasNext, hasPrev } as PaginationMeta;
</script>

<Header group="dashboard" />

<!-- Page content -->
```

---

## 🔄 Navigation

**WAJIB** gunakan Inertia router untuk navigasi.

```typescript
import { router } from '@inertiajs/svelte';

// Programmatic navigation
router.visit('/dashboard', { 
  preserveScroll: true, 
  preserveState: true 
});

// With query params
const url = new URL(window.location.href);
url.searchParams.set('page', String(page));
router.visit(url.pathname + url.search, { preserveScroll: true });
```

```svelte
<!-- Template navigation -->
<script>
  import { inertia } from '@inertiajs/svelte';
</script>

<a href="/dashboard" use:inertia>Dashboard</a>
```

---

## 🎨 Styling Conventions

**WAJIB** gunakan Tailwind CSS dengan design system yang konsisten.

```svelte
<!-- Buttons -->
<button class="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-medium shadow-sm hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
  Primary Button
</button>

<button class="inline-flex items-center px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
  Secondary Button
</button>

<!-- Cards -->
<div class="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.8)]">
  <!-- Card content -->
</div>

<!-- Form inputs -->
<input class="w-full px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-slate-50 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 outline-none" />
```

---

## 📋 Form Handling

```svelte
<script lang="ts">
  import type { UserForm } from '../types/user';
  import { createEmptyUserForm } from '../types/user';

  let form: UserForm = createEmptyUserForm();
  let isSubmitting = false;

  async function handleSubmit(): Promise<void> {
    if (!form.name || !form.email) {
      Toast('Nama dan email wajib diisi', 'error');
      return;
    }

    isSubmitting = true;

    const result = await api(() => axios.post('/users', {
      name: form.name,
      email: form.email,
      phone: form.phone || null,
    }));

    if (result.success) {
      form = createEmptyUserForm();
      router.visit('/users', { preserveScroll: true });
    }

    isSubmitting = false;
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <!-- Form fields -->
</form>
```

---

## 🔐 Auth Checks

```svelte
<script lang="ts">
  import { page as inertiaPage } from '@inertiajs/svelte';
  import type { User } from '../types/user';

  const currentUser = $inertiaPage.props.user as User | undefined;
</script>

{#if currentUser && currentUser.is_admin}
  <button>Admin Only Action</button>
{/if}

{#if currentUser}
  <p>Welcome, {currentUser.name}</p>
{:else}
  <a href="/login" use:inertia>Login</a>
{/if}
```

---

## 📊 Pagination Component

```svelte
<script lang="ts">
  import Pagination from '../Components/Pagination.svelte';
  import type { PaginationMeta } from '../types/user';

  export let total: number = 0;
  export let page: number = 1;
  export let limit: number = 10;
  export let totalPages: number = 1;
  export let hasNext: boolean = false;
  export let hasPrev: boolean = false;

  $: paginationMeta = { total, page, limit, totalPages, hasNext, hasPrev } as PaginationMeta;
</script>

<Pagination meta={paginationMeta} />
```

---

## ⚠️ Common Pitfalls

1. **Naming conflicts:** Jangan gunakan `page` sebagai nama prop jika import `page` dari Inertia. Gunakan alias:
   ```typescript
   import { page as inertiaPage } from '@inertiajs/svelte';
   export let page: number = 1; // OK, no conflict
   ```

2. **Backend alignment:** Pastikan payload frontend sesuai dengan schema backend:
   ```typescript
   // Backend expects: { current_password, new_password }
   // Frontend should NOT send: confirm_password
   ```

3. **Type safety:** Selalu gunakan TypeScript types untuk props dan data.

---
