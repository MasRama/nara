import { Session } from "@models";
import type { NaraRequest as Request, NaraResponse as Response } from "@core";

/**
 * Authentication Middleware
 * 
 * Validates session cookie and attaches user to request.
 * Optimized: Uses single JOIN query instead of 2 separate queries.
 */
export default async (request: Request, response: Response) => {
   const authId = request.cookies.auth_id;

   if (!authId) {
      return response.cookie("auth_id", "", 0).redirect("/login");
   }

   // Single query with JOIN - eliminates N+1 query problem
   // Previously: 2 queries (session + user) per authenticated request
   // Now: 1 query with JOIN
   const user = await Session.getUserBySessionId(authId);

   if (!user) {
      // Session not found or user deleted - clear cookie and redirect
      return response.cookie("auth_id", "", 0).redirect("/login");
   }

   request.user = user;
   request.share = {
      user: request.user,
   };
}