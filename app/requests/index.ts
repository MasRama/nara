/**
 * Form Requests
 *
 * This directory contains Form Request classes for validation and authorization.
 * Each Form Request encapsulates validation rules and authorization logic
 * for a specific action.
 *
 * @example
 * import { CreateUserRequest } from '@requests';
 *
 * async store(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await CreateUserRequest.from(req);
 *   const data = formRequest.validated();
 *   // Proceed with validated data
 * }
 */

export { CreateUserRequest } from './CreateUserRequest';
export { UpdateUserRequest } from './UpdateUserRequest';
export { DeleteUsersRequest } from './DeleteUsersRequest';
