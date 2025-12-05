# Database Schema Documentation

## Overview

Nara menggunakan **Knex.js** sebagai query builder dengan **SQLite** (better-sqlite3) sebagai default database.

## Tables

### users

Tabel utama untuk data pengguna.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | - | Primary key |
| `name` | VARCHAR(255) | Yes | - | Display name |
| `email` | VARCHAR(255) | No | - | Unique email |
| `phone` | VARCHAR(255) | Yes | - | Phone number |
| `avatar` | VARCHAR(255) | Yes | - | Avatar URL |
| `is_verified` | BOOLEAN | No | false | Email verified |
| `is_admin` | BOOLEAN | No | false | Admin flag |
| `password` | VARCHAR(180) | No | - | Hashed password |
| `remember_me_token` | VARCHAR | Yes | - | Remember token |
| `membership_date` | DATETIME | Yes | - | Membership date |
| `created_at` | BIGINT | Yes | - | Unix timestamp |
| `updated_at` | BIGINT | Yes | - | Unix timestamp |

**Indexes:**
- `email` (unique)

---

### sessions

Tabel untuk session management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR | No | - | Primary key (session ID) |
| `user_id` | VARCHAR | Yes | - | Foreign key to users |
| `user_agent` | TEXT | Yes | - | Browser user agent |

**Indexes:**
- `user_id`

---

### password_reset_tokens

Tabel untuk token reset password.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | Auto | Primary key |
| `email` | VARCHAR | No | - | User email |
| `token` | VARCHAR | No | - | Reset token (unique) |
| `created_at` | TIMESTAMP | No | now() | Created time |
| `expires_at` | TIMESTAMP | No | - | Expiry time |

**Indexes:**
- `email`
- `token` (unique)

---

### email_verification_tokens

Tabel untuk token verifikasi email.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | Auto | Primary key |
| `user_id` | INTEGER | No | - | Foreign key to users |
| `token` | VARCHAR | No | - | Verification token (unique) |
| `created_at` | TIMESTAMP | No | now() | Created time |
| `expires_at` | TIMESTAMP | No | - | Expiry time |

**Indexes:**
- `user_id`
- `token` (unique)

**Foreign Keys:**
- `user_id` → `users.id` (ON DELETE CASCADE)

---

### assets

Tabel untuk file/media assets.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | VARCHAR | No | - | Primary key |
| `name` | VARCHAR | Yes | - | Asset name |
| `type` | VARCHAR | No | - | Type (image, video, document) |
| `url` | VARCHAR | No | - | Asset URL |
| `mime_type` | VARCHAR | Yes | - | MIME type |
| `size` | INTEGER | Yes | - | File size in bytes |
| `s3_key` | VARCHAR | Yes | - | S3/Wasabi object key |
| `user_id` | VARCHAR | Yes | - | Owner user ID |
| `created_at` | TIMESTAMP | No | now() | Created time |
| `updated_at` | TIMESTAMP | No | now() | Updated time |

**Indexes:**
- `s3_key`
- `user_id`

---

### backup_files

Tabel untuk tracking backup files.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | UUID | No | - | Primary key |
| `key` | VARCHAR(500) | No | - | S3/Wasabi object key (unique) |
| `file_name` | VARCHAR(255) | No | - | Original filename |
| `file_size` | BIGINT | Yes | - | File size in bytes |
| `compression` | VARCHAR(50) | No | gzip | Compression type |
| `storage` | VARCHAR(50) | No | s3 | Storage provider |
| `checksum` | VARCHAR(128) | Yes | - | File checksum |
| `uploaded_at` | BIGINT | No | - | Upload timestamp |
| `deleted_at` | BIGINT | Yes | - | Soft delete timestamp |
| `encryption` | VARCHAR | Yes | - | Encryption algorithm |
| `enc_iv` | VARCHAR | Yes | - | Encryption IV (base64) |
| `enc_tag` | VARCHAR | Yes | - | Encryption auth tag |

**Indexes:**
- `key` (unique)
- `uploaded_at`
- `deleted_at`

---

## Migrations

Migrations berada di folder `migrations/`.

### Commands

```bash
# Run all pending migrations
node nara db:migrate

# Rollback last batch
node nara db:rollback

# Fresh database (drop all + migrate)
node nara db:fresh

# Create new migration
node nara make:migration create_posts_table
```

### Migration Template

```typescript
import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('posts', (table) => {
    table.uuid('id').primary().notNullable();
    table.string('title', 255).notNullable();
    table.text('content');
    table.string('user_id').index();
    table.bigInteger('created_at');
    table.bigInteger('updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('posts');
}
```

---

## Timestamps

**WAJIB** gunakan `dayjs().valueOf()` untuk timestamps:

```typescript
import dayjs from "dayjs";

const now = dayjs().valueOf();
const record = {
  id: randomUUID(),
  name: "Test",
  created_at: now,
  updated_at: now,
};
```

---

## Query Examples

```typescript
import DB from "@services/DB";

// Select
const user = await DB.from("users").where("id", id).first();
const users = await DB.from("users").select("*");

// Insert
await DB.table("users").insert({ id, name, email, created_at: dayjs().valueOf() });

// Update
await DB.from("users").where("id", id).update({ name, updated_at: dayjs().valueOf() });

// Delete
await DB.from("users").where("id", id).delete();

// Bulk delete
await DB.from("users").whereIn("id", ids).delete();

// Count
const result = await DB.from("users").count("* as count").first();
const total = Number(result?.count) || 0;

// Search
const users = await DB.from("users")
  .where(function() {
    this.where("name", "like", `%${search}%`)
        .orWhere("email", "like", `%${search}%`);
  });

// Pagination with helper
import { paginate } from "@services/Paginator";

const query = DB.from("users").select("*").orderBy("created_at", "desc");
const result = await paginate(query, { page: 1, limit: 10 });
// result.data = User[]
// result.meta = { total, page, limit, totalPages, hasNext, hasPrev }
```

---

## Database Configuration

Konfigurasi di `knexfile.ts`:

```typescript
const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: { filename: './database/dev.sqlite3' },
    useNullAsDefault: true,
  },
  production: {
    client: 'better-sqlite3',
    connection: { filename: './database/prod.sqlite3' },
    useNullAsDefault: true,
  },
};
```

Environment variable `DB_CONNECTION` menentukan config yang digunakan.
