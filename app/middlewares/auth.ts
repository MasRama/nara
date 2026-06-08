import { Session, User } from "@models";
import type { NaraRequest as Request, NaraResponse as Response } from "@core";

/**
 * Authentication Middleware
 * 
 * Validates session cookie and attaches user to request.
 * Also loads user roles and permissions for RBAC.
 * Optimized: Uses single JOIN query for session + user, then loads roles/permissions.
 */
export default async (request: Request, response: Response, next: () => void) => {
   const authId = request.cookies.auth_id;
   const isInertia = request.headers['x-inertia'];

   if (!authId) {
      if (isInertia) {
         return response.clearCookie("auth_id").setHeader('X-Inertia-Location', '/login').redirect("/login");
      }
      return response.clearCookie("auth_id").redirect("/login");
   }

   // Single query with JOIN - eliminates N+1 query problem
   const user = await Session.getUserBySessionId(authId);

   if (!user) {
      // Session not found or user deleted - clear cookie and redirect
      if (isInertia) {
         return response.clearCookie("auth_id").setHeader('X-Inertia-Location', '/login').redirect("/login");
      }
      return response.clearCookie("auth_id").redirect("/login");
   }

   // Load user roles and permissions for RBAC
   const roles = await User.roles(user.id);
   const permissions = await User.permissions(user.id);

   request.user = {
      ...user,
      roles: roles.map((r) => r.slug),
      permissions: permissions.map((p) => p.slug),
   };

   request.share = {
      user: request.user,
   };

   next();
}