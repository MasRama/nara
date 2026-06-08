/**
 * Web Routes
 * 
 * All application routes are defined here using the type-safe NaraRouter.
 * Routes can use middleware arrays for authentication and authorization.
 */
import { createRouter } from "@core";
import AuthController from "@controllers/AuthController";
import UserController from "@controllers/UserController";
import OAuthController from "@controllers/OAuthController";
import HomeController from "@controllers/HomeController";
import AssetController from "@controllers/AssetController";
import RoleController from "@controllers/RoleController";
import Auth from "@middlewares/auth";
import { strictRateLimit } from "@middlewares/rateLimit";

const Route = createRouter();

/**
 * Public Routes
 * These routes are accessible without authentication
 * ------------------------------------------------
 * GET  / - Home page
 */
Route.get("/", HomeController.index);

/**
 * Authentication Routes
 * Routes for handling user authentication
 * ------------------------------------------------
 * GET   /login - Login page
 * POST  /login - Process login
 * GET   /register - Registration page
 * POST  /register - Process registration
 * POST  /logout - Logout user
 */
Route.get("/login", AuthController.loginPage);
Route.post("/login", strictRateLimit(), AuthController.processLogin);
Route.get("/register", AuthController.registerPage);
Route.post("/register", strictRateLimit(), AuthController.processRegister);
Route.post("/logout", AuthController.logout);

/**
 * OAuth Routes
 * Routes for third-party authentication
 * ------------------------------------------------
 * GET   /google/redirect - Google OAuth redirect
 * GET   /google/callback - Google OAuth callback
 */
Route.get("/google/redirect", OAuthController.googleRedirect);
Route.get("/google/callback", OAuthController.googleCallback);

/**
 * Protected Routes
 * These routes require authentication
 * ------------------------------------------------
 * GET    /dashboard       - User dashboard
 * GET    /users           - Users management page
 * GET    /profile         - User profile
 * POST   /change-profile  - Update profile
 * POST   /change-password - Change password
 * POST   /users           - Create user (admin only)
 * PUT    /users/:id       - Update user (admin only)
 * DELETE /users           - Delete users (admin only)
 */
Route.get("/dashboard", [Auth], UserController.homePage);
Route.get("/users", [Auth], UserController.usersPage);
Route.get("/profile", [Auth], UserController.profilePage);
Route.post("/change-profile", [Auth], UserController.changeProfile);
Route.post("/change-password", [Auth], AuthController.changePassword);
Route.post("/users", [Auth], UserController.createUser);
Route.put("/users/:id", [Auth], UserController.updateUser);
Route.delete("/users", [Auth], UserController.deleteUsers);

/**
 * Role Management Routes (Admin only)
 * ------------------------------------------------
 * GET    /roles              - Roles management page (Inertia)
 * GET    /roles/data         - Get all roles with permissions (JSON)
 * GET    /roles/permissions  - Get all permissions grouped by resource (JSON)
 * POST   /roles              - Create a new role (JSON)
 * PUT    /roles/:id          - Update a role (JSON)
 * DELETE /roles/:id          - Delete a role (JSON)
 */
Route.get("/roles", [Auth], RoleController.rolesPage);
Route.get("/roles/data", [Auth], RoleController.index);
Route.get("/roles/permissions", [Auth], RoleController.permissionsData);
Route.post("/roles", [Auth], RoleController.store);
Route.put("/roles/:id", [Auth], RoleController.update);
Route.delete("/roles/:id", [Auth], RoleController.destroy);

// Avatar upload endpoint (local storage) - rate limited to prevent abuse
// multer middleware parses file upload before controller
Route.post("/assets/avatar", [Auth, strictRateLimit(), AssetController.avatarMiddleware as any], AssetController.uploadAsset);

/**
 * Static Asset Handling Routes
 * 
 * 1. Dist Assets (/assets/:file)
 * Serves compiled and bundled assets from the dist/assets directory
 * - Handles JavaScript files (*.js) with proper content type
 * - Handles CSS files (*.css) with proper content type
 * - Implements in-memory caching for better performance
 * - Sets long-term browser cache headers (1 year)
 * Example URLs:
 * - /assets/app.1234abc.js
 * - /assets/main.5678def.css
 */
Route.get("/assets/:file", AssetController.distFolder);

/**
 * 2. Public & Storage Assets (/*) - Catch-all Route
 * Serves static files from public and storage directories
 * - Must be the LAST route in the file
 * - Only serves files with allowed extensions
 * - Returns 404 for paths without extensions
 * - Implements security checks against unauthorized access
 *
 * Allowed file types:
 * - Images: .ico, .png, .jpeg, .jpg, .gif, .svg, .webp
 * - Documents: .txt, .pdf
 * - Fonts: .woff, .woff2, .ttf, .eot
 * - Media: .mp4, .webm, .mp3, .wav
 * - Web: .css, .js
 *
 * Example URLs:
 * - /public/images/logo.png
 * - /storage/avatars/user-1.webp
 */
Route.get("/public/*", AssetController.publicFolder);
Route.get("/storage/*", AssetController.publicFolder);

// Export the underlying Express router for mounting to the server
export default Route.getRouter();