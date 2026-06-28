import { createRouter } from '@core';
import * as home from '@handlers/home';
import * as auth from '@handlers/auth';
import * as users from '@handlers/users';
import * as roles from '@handlers/roles';
import * as assets from '@handlers/assets';
import Auth from '@middlewares/auth';
import { strictRateLimit } from '@middlewares/rateLimit';

const Route = createRouter();

// Public
Route.get('/', home.landingPage);

// Auth
Route.get('/login', auth.loginPage);
Route.post('/login', strictRateLimit(), auth.submitLogin);
Route.get('/register', auth.registerPage);
Route.post('/register', strictRateLimit(), auth.submitRegister);
Route.post('/logout', strictRateLimit(), auth.logout);
Route.post('/change-password', [Auth], auth.changePassword);

// Protected - Users
Route.get('/dashboard', [Auth], users.dashboardPage);
Route.get('/users', [Auth], users.usersPage);
Route.get('/profile', [Auth], users.profilePage);
Route.post('/change-profile', [Auth], users.changeProfile);
Route.post('/users', [Auth], users.addUser);
Route.put('/users/:id', [Auth], users.editUser);
Route.delete('/users', [Auth], users.removeUsers);

// Roles
Route.get('/roles', [Auth], roles.rolesPage);
Route.get('/roles/data', [Auth], roles.listRoles);
Route.get('/roles/permissions', [Auth], roles.permissionsData);
Route.post('/roles', [Auth], roles.addRole);
Route.put('/roles/:id', [Auth], roles.editRole);
Route.delete('/roles/:id', [Auth], roles.removeRole);

// Assets
Route.post('/assets/avatar', [Auth, strictRateLimit(), assets.avatarMiddleware as any], assets.uploadAsset);
Route.get('/assets/:file', assets.serveDistAsset);
Route.get('/public/*', assets.servePublicAsset);
Route.get('/storage/*', assets.servePublicAsset);

export default Route.getRouter();