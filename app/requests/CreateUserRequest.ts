/**
 * Create User Form Request
 *
 * Example implementation of FormRequest for creating users.
 * Demonstrates authorization checks and validation rules.
 *
 * @example
 * // In controller
 * async store(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await CreateUserRequest.from(req);
 *   const data = formRequest.validated();
 *
 *   const user = await User.create(data);
 *   return jsonCreated(res, 'User created successfully', user);
 * }
 *
 * @example
 * // Using BaseController helper
 * async store(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await this.getValidated(req, CreateUserRequest);
 *   const data = formRequest.validated();
 *
 *   const user = await User.create(data);
 *   return jsonCreated(res, 'User created successfully', user);
 * }
 */

import { FormRequest } from '@core';
import { CreateUserSchema } from '@validators/schemas';
import type { CreateUserInput } from '@validators/schemas';
import type { Validator } from '@validators/validate';
import { User } from '@models';

/**
 * Form request for creating new users
 *
 * Authorization: Only admins can create users
 * Validation: Uses CreateUserSchema from validators
 */
export class CreateUserRequest extends FormRequest<CreateUserInput> {
  /**
   * Determine if the user is authorized to create users
   *
   * Only authenticated admins can create users.
   * Override this method to customize authorization logic.
   *
   * @returns Promise<boolean>
   */
  async authorize(): Promise<boolean> {
    // Must be authenticated
    if (!this.user) {
      return false;
    }

    // Check if user has admin role
    const isAdmin = await User.isAdmin(this.user.id);
    return isAdmin;
  }

  /**
   * Get the validation rules for creating a user
   *
   * @returns Validator<CreateUserInput>
   */
  rules(): Validator<CreateUserInput> {
    return CreateUserSchema;
  }

  /**
   * Get the validated name
   *
   * Convenience method for accessing validated data
   */
  get name(): string {
    return this.validated().name;
  }

  /**
   * Get the validated email
   *
   * Convenience method for accessing validated data
   */
  get email(): string {
    return this.validated().email;
  }

  /**
   * Get the validated phone
   *
   * Convenience method for accessing validated data
   */
  get phone(): string | null | undefined {
    return this.validated().phone;
  }

  /**
   * Get the validated password
   *
   * Convenience method for accessing validated data
   */
  get password(): string | undefined {
    return this.validated().password;
  }

  /**
   * Get the validated roles
   *
   * Convenience method for accessing validated data
   */
  get roles(): string[] | undefined {
    return this.validated().roles;
  }

  /**
   * Get the verified status
   *
   * Convenience method for accessing validated data
   */
  get isVerified(): boolean {
    return this.validated().is_verified ?? false;
  }
}

export default CreateUserRequest;
