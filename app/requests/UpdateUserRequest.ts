/**
 * Update User Form Request
 *
 * Example implementation of FormRequest for updating users.
 * Demonstrates authorization checks and validation rules.
 *
 * @example
 * // In controller
 * async update(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await UpdateUserRequest.from(req);
 *   const data = formRequest.validated();
 *
 *   const user = await User.update(id, data);
 *   return jsonSuccess(res, 'User updated successfully', { user });
 * }
 *
 * @example
 * // Using BaseController helper
 * async update(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await this.getValidated(req, UpdateUserRequest);
 *   const data = formRequest.validated();
 *
 *   const user = await User.update(id, data);
 *   return jsonSuccess(res, 'User updated successfully', { user });
 * }
 */

import { FormRequest } from '@core';
import { UpdateUserSchema } from '@validators/schemas';
import type { UpdateUserInput } from '@validators/schemas';
import type { Validator } from '@validators/validate';
import { User } from '@models';

/**
 * Form request for updating existing users
 *
 * Authorization: Users with 'users.edit' permission (or admin)
 * Validation: Uses UpdateUserSchema from validators
 */
export class UpdateUserRequest extends FormRequest<UpdateUserInput> {
  /**
   * Determine if the user is authorized to update users
   *
   * Admin users bypass all checks. Others need 'users.edit' permission.
   *
   * @returns Promise<boolean>
   */
  async authorize(): Promise<boolean> {
    if (!this.user) {
      return false;
    }

    const isAdmin = await User.isAdmin(this.user.id);
    if (isAdmin) return true;

    return User.hasPermission(this.user.id, "users.edit");
  }

  /**
   * Get the validation rules for updating a user
   *
   * @returns Validator<UpdateUserInput>
   */
  rules(): Validator<UpdateUserInput> {
    return UpdateUserSchema;
  }

  /**
   * Get the validated name
   *
   * Convenience method for accessing validated data
   */
  get name(): string | undefined {
    return this.validated().name;
  }

  /**
   * Get the validated email
   *
   * Convenience method for accessing validated data
   */
  get email(): string | undefined {
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
  get isVerified(): boolean | undefined {
    return this.validated().is_verified;
  }
}

export default UpdateUserRequest;
