# Routes Documentation

Dokumentasi mapping antara routes, controllers, dan Inertia pages.

---

## Route → Controller → Page Mapping

| Route | Method | Controller | Inertia Page | Auth Required |
|-------|--------|------------|--------------|---------------|
| `/` | GET | `HomeController.index` | `landing.svelte` | No |
| `/login` | GET | `AuthController.loginPage` | `auth/login.svelte` | No |
| `/login` | POST | `AuthController.processLogin` | - (redirect) | No |
| `/register` | GET | `AuthController.registerPage` | `auth/register.svelte` | No |
| `/register` | POST | `AuthController.processRegister` | - (redirect) | No |
| `/logout` | POST | `AuthController.logout` | - (redirect) | No |
| `/forgot-password` | GET | `AuthController.forgotPasswordPage` | `auth/forgot-password.svelte` | No |
| `/forgot-password` | POST | `AuthController.sendResetPassword` | - (JSON) | No |
| `/reset-password/:id` | GET | `AuthController.resetPasswordPage` | `auth/reset-password.svelte` | No |
| `/reset-password` | POST | `AuthController.resetPassword` | - (redirect) | No |
| `/google/redirect` | GET | `AuthController.redirect` | - (redirect to Google) | No |
| `/google/callback` | GET | `AuthController.googleCallback` | - (redirect) | No |
| `/dashboard` | GET | `AuthController.homePage` | `dashboard.svelte` | Yes |
| `/users` | GET | `AuthController.usersPage` | `users.svelte` | Yes |
| `/users` | POST | `AuthController.createUser` | - (JSON) | Yes (Admin) |
| `/users/:id` | PUT | `AuthController.updateUser` | - (JSON) | Yes (Admin) |
| `/users` | DELETE | `AuthController.deleteUsers` | - (JSON) | Yes (Admin) |
| `/profile` | GET | `AuthController.profilePage` | `profile.svelte` | Yes |
| `/change-profile` | POST | `AuthController.changeProfile` | - (JSON) | Yes |
| `/change-password` | POST | `AuthController.changePassword` | - (JSON) | Yes |
| `/assets/avatar` | POST | `AssetController.uploadAsset` | - (JSON) | Yes |

---

## Static Asset Routes

| Route | Controller | Description |
|-------|------------|-------------|
| `/assets/:file` | `AssetController.distFolder` | Compiled assets (JS/CSS) from `dist/assets/` |
| `/public/*` | `AssetController.publicFolder` | Static files from `public/` directory |

---

## Response Types

### Inertia Pages
Routes yang me-render Inertia page menggunakan:
```typescript
return response.inertia("page-name", { props });
```

### JSON API
Routes yang mengembalikan JSON menggunakan response helpers:
```typescript
return jsonSuccess(res, 'Message', { data });
return jsonCreated(res, 'Created', { data });
return jsonError(res, 'Error message', 400);
```

### Redirects
Routes yang melakukan redirect:
```typescript
return response.redirect("/path");
```

---

## Frontend Integration

### Inertia Pages Location
Semua Inertia pages berada di `resources/js/Pages/`:
```
resources/js/Pages/
├── auth/
│   ├── forgot-password.svelte
│   ├── login.svelte
│   ├── register.svelte
│   └── reset-password.svelte
├── dashboard.svelte
├── landing.svelte
├── profile.svelte
└── users.svelte
```

### API Calls dari Frontend
Frontend menggunakan helper `api()` untuk API calls:
```typescript
import { api } from '$lib/helper';
import axios from 'axios';

// Dengan toast otomatis
const result = await api(() => axios.post('/change-profile', data));

// Tanpa toast
const result = await api(() => axios.post('/users', data), { 
  showSuccessToast: false 
});
```

---

## Rate Limiting

Beberapa routes menggunakan `strictRateLimit()`:
- `POST /login` - Mencegah brute force
- `POST /register` - Mencegah spam registrasi
- `POST /forgot-password` - Mencegah abuse
- `POST /reset-password` - Mencegah abuse
- `POST /assets/avatar` - Mencegah upload spam

---

## Adding New Routes

Saat menambahkan route baru, ikuti pola ini:

### 1. Tambahkan route di `routes/web.ts`:
```typescript
// Public route
Route.get("/new-page", Controller.newPage);

// Protected route
Route.get("/protected", [Auth], Controller.protectedPage);

// Admin only
Route.post("/admin-action", [Auth], Controller.adminAction);
```

### 2. Buat controller method:
```typescript
public async newPage(request: NaraRequest, response: NaraResponse) {
  // Untuk Inertia page
  return response.inertia("new-page", { props });
  
  // Untuk JSON API
  return jsonSuccess(response, "Success", { data });
}
```

### 3. Buat Inertia page (jika diperlukan):
```
resources/js/Pages/new-page.svelte
```

### 4. Update dokumentasi ini!
