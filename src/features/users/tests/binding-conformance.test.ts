import { describeUsersHost } from './host-conformance';
import { usersServerHost } from '../../../app/bindings/users.server';
import { resetSecurityState } from '../../../app/server';
import { grantPermissions, signIn } from '../../../app/tests/personas';
import { seed } from '../../../shared/database';

// The application's own binding, Auth behind it, held to the contract Users
// relies on. Sign-ins go through Auth's login route, as a browser's would.
describeUsersHost('the Auth-backed application binding', () => {
  // Auth's reference seed provides the admin role, as `npm run setup` does.
  seed();
  return {
    host: usersServerHost,
    signIn: async (email, password) => {
      // Sign-in shares the strict per-client limit with other public routes.
      resetSecurityState();
      const prefix = `${usersServerHost.sessionCookieName}=`;
      const token = (await signIn(email, password))
        .split('; ')
        .find((cookie) => cookie.startsWith(prefix))
        ?.slice(prefix.length);
      if (!token) throw new Error('Sign-in returned no session cookie');
      return token;
    },
    grantPermission: (userId, permission) => grantPermissions(userId, [permission]),
  };
});
