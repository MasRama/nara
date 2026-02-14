/**
 * Authorize Middleware
 *
 * Middleware for protecting routes with authorization checks.
 * Use this middleware to restrict access based on defined abilities.
 *
 * @example
 * import { authorize } from '@middlewares/authorize';
 *
 * // Protect a route with an ability
 * Route.get('/posts/:id/edit', [authMiddleware, authorize('edit-post')], PostController.edit);
 *
 * // With additional arguments
 * Route.delete('/posts/:id', [authMiddleware, authorize('delete-post', { ownerOnly: true })], PostController.destroy);
 *
 * // Using policy-based authorization
 * Route.put('/posts/:id', [authMiddleware, authorize('Post:update')], PostController.update);
 */
import { gate } from "@authorization";
import { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";
import { AuthError, ForbiddenError } from "@core/errors";

/**
 * Create an authorization middleware
 *
 * @param ability - Name of the ability to check (or policy ability like "Post:update")
 * @param args - Additional arguments to pass to the ability callback
 * @returns Middleware function
 *
 * @example
 * // Basic usage
 * authorize('edit-post')
 *
 * // With arguments
 * authorize('edit-post', somePost)
 *
 * // Policy-based
 * authorize('Post:update')
 */
export function authorize(ability: string, ...args: unknown[]): NaraMiddleware {
  return async (req: NaraRequest, res: NaraResponse, next: () => void) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
    }

    try {
      const allowed = await gate.check(user, ability, ...args);

      if (!allowed) {
        return res.status(403).json({
          error: "Forbidden",
          message: `You do not have permission to ${ability}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Error checking authorization",
      });
    }
  };
}

/**
 * Create an authorization middleware that throws errors instead of returning JSON
 * Useful for Inertia routes that should redirect with flash messages
 *
 * @param ability - Name of the ability to check
 * @param args - Additional arguments to pass to the ability callback
 * @returns Middleware function
 *
 * @example
 * authorizeOrFail('edit-post')
 */
export function authorizeOrFail(ability: string, ...args: unknown[]): NaraMiddleware {
  return async (req: NaraRequest, res: NaraResponse, next: () => void) => {
    const user = req.user;

    if (!user) {
      throw new AuthError();
    }

    await gate.authorize(user, ability, ...args);
    next();
  };
}

export default authorize;
