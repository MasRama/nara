import { createRouter } from '@core';
import * as home from '@handlers/home';
import * as auth from '@handlers/auth';
import * as users from '@handlers/users';
import * as roles from '@handlers/roles';
import * as oauth from '@handlers/oauth';
import * as assets from '@handlers/assets';
import Auth from '@middlewares/auth';
import { strictRateLimit } from '@middlewares/rateLimit';

const Route = createRouter();

// Public
Route.get('/', home.index);

// Auth
Route.get('/login', auth.loginPage);
Route.post('/login', strictRateLimit(), auth.processLogin);
Route.get('/register', auth.registerPage);
Route.post('/register', strictRateLimit(), auth.processRegister);
Route.post('/logout', auth.logout);
Route.post('/change-password', [Auth], auth.changePassword);

// OAuth
Route.get('/google/redirect', oauth.googleRedirect);
Route.get('/google/callback', oauth.googleCallback);

// Protected - Users
Route.get('/dashboard', [Auth], users.dashboardPage);
Route.get('/users', [Auth], users.usersPage);
Route.get('/profile', [Auth], users.profilePage);
Route.post('/change-profile', [Auth], users.changeProfile);
Route.post('/users', [Auth], users.create);
Route.put('/users/:id', [Auth], users.update);
Route.delete('/users', [Auth], users.remove);

// Roles
Route.get('/roles', [Auth], roles.rolesPage);
Route.get('/roles/data', [Auth], roles.index);
Route.get('/roles/permissions', [Auth], roles.permissionsData);
Route.post('/roles', [Auth], roles.store);
Route.put('/roles/:id', [Auth], roles.update);
Route.delete('/roles/:id', [Auth], roles.destroy);

// Assets
Route.post('/assets/avatar', [Auth, strictRateLimit(), assets.avatarMiddleware as any], assets.uploadAsset);
Route.get('/assets/:file', assets.distFolder);
Route.get('/public/*', assets.publicFolder);
Route.get('/storage/*', assets.publicFolder);

export default Route.getRouter();