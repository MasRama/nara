import { getUserBySessionId, getUserRoles, getUserPermissions } from '@queries';
import type { NaraRequest as Request, NaraResponse as Response } from '@core';

export default (request: Request, response: Response, next: () => void) => {
   const authId = request.cookies.auth_id;
   const isInertia = request.headers['x-inertia'];

   if (!authId) {
      if (isInertia) {
         return response.clearCookie('auth_id').setHeader('X-Inertia-Location', '/login').redirect('/login');
      }
      return response.clearCookie('auth_id').redirect('/login');
   }

   const user = getUserBySessionId(authId);

   if (!user) {
      if (isInertia) {
         return response.clearCookie('auth_id').setHeader('X-Inertia-Location', '/login').redirect('/login');
      }
      return response.clearCookie('auth_id').redirect('/login');
   }

   const roles = getUserRoles(user.id);
   const permissions = getUserPermissions(user.id);

   request.user = {
      ...user,
      roles: roles.map(r => r.slug),
      permissions: permissions.map(p => p.slug),
   };

   request.share = {
      user: request.user,
   };

   next();
};