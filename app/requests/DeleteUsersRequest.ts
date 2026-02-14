/**
 * Delete Users Form Request
 *
 * Example implementation of FormRequest for deleting multiple users.
 * Demonstrates authorization checks and validation rules.
 *
 * @example
 * // In controller
 * async deleteMany(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await DeleteUsersRequest.from(req);
 *   const data = formRequest.validated();
 *
 *   const deleted = await User.deleteMany(data.ids);
 *   return jsonSuccess(res, 'Users deleted successfully', { deleted });
 * }
 *
 * @example
 * // Using BaseController helper
 * async deleteMany(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await this.getValidated(req, DeleteUsersRequest);
 *   const data = formRequest.validated();
 *
 *   const deleted = await User.deleteMany(data.ids);
 *   return jsonSuccess(res, 'Users deleted successfully', { deleted });
 * }
 */

import { FormRequest } from '@core';
import { DeleteUsersSchema } from '@validators/schemas';
import type { DeleteUsersInput } from '@validators/schemas';
import type { Validator } from '@validators/validate';
import { User } from '@models';

/**
 * Form request for deleting multiple users
 *
 * Authorization: Only admins can delete users
 * Validation: Uses DeleteUsersSchema from validators
 */
export class DeleteUsersRequest extends FormRequest<DeleteUsersInput> {
  /**
   * Determine if the user is authorized to delete users
   *
   * Only authenticated admins can delete users.
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
   * Get the validation rules for deleting users
   *
   * @returns Validator<DeleteUsersInput>
   */
  rules(): Validator<DeleteUsersInput> {
    return DeleteUsersSchema;
  }

  /**
   * Get the validated IDs
   *
   * Convenience method for accessing validated data
   */
  get ids(): string[] {
    return this.validated().ids;
  }
}

export default DeleteUsersRequest;
