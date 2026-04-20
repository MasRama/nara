# Factories

## Overview

Generate fake model data for seeders and tests using `@faker-js/faker`. Each factory has a base definition and optional states.

## Structure

| File | Purpose |
|------|---------|
| `Factory.ts` | Abstract base class |
| `UserFactory.ts` | User model factory with states |
| `index.ts` | Barrel export |

## Golden Pattern

```typescript
import { faker } from "@faker-js/faker";
import { Factory } from "./Factory";
import { User, type UserRecord } from "@models/User";
import Authenticate from "@services/Authenticate";

export const UserFactory = Factory.define(User, () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: "hashed_placeholder", // replace in helpers
  phone: null,
  avatar: null,
  is_verified: false,
  created_at: Date.now(),
  updated_at: Date.now(),
}));

// States — transformations on base data
UserFactory
  .state("verified", (data) => ({ ...data, is_verified: true }))
  .state("withPhone", (data) => ({ ...data, phone: faker.phone.number() }));

// Helper functions for complex creation
export async function createUserWithHashedPassword(overrides = {}) {
  return UserFactory.create({
    password: await Authenticate.hash("password123"),
    ...overrides,
  });
}

export default UserFactory;
```

## API

```typescript
// Create one record (inserts to DB)
const user = await UserFactory.create();

// Create with overrides
const admin = await UserFactory.create({ name: "Admin User" });

// Apply a state
const verified = await UserFactory.state("verified").create();

// Create multiple
const users = await UserFactory.count(5).create();

// Build only (no DB insert)
const data = UserFactory.build();
```

## Conventions

- Timestamps: always `Date.now()` (unix milliseconds as number)
- Passwords: use helper functions that call `Authenticate.hash()` — never store plaintext
- IDs: always `faker.string.uuid()`
- Export factory as named export AND default
- Add to `index.ts` barrel
- States cover common variations: `verified`, `admin`, `withPhone`, `withAvatar`
