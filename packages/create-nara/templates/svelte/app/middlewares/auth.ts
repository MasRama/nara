import { Session } from "@models";
import type { NaraRequest as Request, NaraResponse as Response } from "@core";

/**
 * Authentication Middleware
 * 
 * Validates session cookie and attaches user to request.
 * Optimized: Uses single JOIN query instead of 2 separate queries.
 */
export async function webAuthMiddleware(request: Request, response: Response) {
   const authId = request.cookies.auth_id;
   const isInertia = request.headers['x-inertia'];

   if (!authId) {
      if (isInertia) {
         return response.cookie("auth_id", "", 0).setHeader('X-Inertia-Location', '/login').redirect("/login");
      }
      return response.cookie("auth_id", "", 0).redirect("/login");
   }

   // Single query with JOIN - eliminates N+1 query problem
   // Previously: 2 queries (session + user) per authenticated request
   // Now: 1 query with JOIN
   const user = await Session.getUserBySessionId(authId);

   if (!user) {
      // Session not found or user deleted - clear cookie and redirect
      if (isInertia) {
         return response.cookie("auth_id", "", 0).setHeader('X-Inertia-Location', '/login').redirect("/login");
      }
      return response.cookie("auth_id", "", 0).redirect("/login");
   }

   request.user = user;
   request.share = {
      user: request.user,
   };
}

// Default export for convenience
export default webAuthMiddleware;
