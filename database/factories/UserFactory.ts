/**
 * User Factory
 *
 * Factory for creating User model instances with fake data.
 */
import { faker } from "@faker-js/faker";
import { Factory } from "./Factory";
import { User, UserRecord } from "@models/User";
import Authenticate from "@services/Authenticate";

/**
 * User factory with predefined states
 */
export const UserFactory = Factory.define(User, (faker) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  phone: `+62${faker.string.numeric(11)}`,
  avatar: faker.image.avatar(),
  is_verified: faker.datatype.boolean(),
  membership_date: null,
  password: "password",
  remember_me_token: null,
  created_at: Date.now(),
  updated_at: Date.now(),
}));

// Register states
UserFactory
  .state("verified", (data) => ({
    ...data,
    is_verified: true,
  }))
  .state("unverified", (data) => ({
    ...data,
    is_verified: false,
  }))
  .state("admin", (data) => ({
    ...data,
    name: `Admin ${faker.person.lastName()}`,
    email: `admin.${faker.internet.userName()}@example.com`,
    is_verified: true,
  }))
  .state("withPhone", (data) => ({
    ...data,
    phone: `+62${faker.string.numeric(11)}`,
  }))
  .state("withAvatar", (data) => ({
    ...data,
    avatar: faker.image.avatar(),
  }));

/**
 * Create a user with hashed password
 */
export async function createUserWithHashedPassword(
  password: string = "password",
  overrides?: Partial<UserRecord>
): Promise<UserRecord> {
  const hashedPassword = await Authenticate.hash(password);

  return UserFactory
    .merge({
      password: hashedPassword,
      ...overrides,
    })
    .create() as Promise<UserRecord>;
}

/**
 * Create an admin user
 */
export async function createAdminUser(
  overrides?: Partial<UserRecord>
): Promise<UserRecord> {
  return UserFactory
    .applyState("admin")
    .merge(overrides || {})
    .create() as Promise<UserRecord>;
}

/**
 * Create multiple verified users
 */
export async function createVerifiedUsers(
  count: number,
  overrides?: Partial<UserRecord>
): Promise<UserRecord[]> {
  const result = await UserFactory
    .count(count)
    .applyState("verified")
    .merge(overrides || {})
    .create();

  return Array.isArray(result) ? result : [result];
}

export default UserFactory;
