/**
 * Web Routes
 * 
 * All application routes are defined here using the type-safe NaraRouter.
 * Routes can use middleware arrays for authentication and authorization.
 */
import { createRouter } from "@core";
import AuthController from "@controllers/AuthController"; 
import Auth from "@middlewares/auth"
import HomeController from "@controllers/HomeController";
import AssetController from "@controllers/AssetController";
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
 * GET   /google/redirect - Google OAuth redirect
 * GET   /google/callback - Google OAuth callback
 */
Route.get("/login", AuthController.loginPage);
Route.post("/login", strictRateLimit(), AuthController.processLogin);
Route.get("/register", AuthController.registerPage);
Route.post("/register", strictRateLimit(), AuthController.processRegister);
Route.post("/logout", AuthController.logout);
Route.get("/google/redirect", AuthController.redirect);
Route.get("/google/callback", AuthController.googleCallback);

/**
 * Password Reset Routes
 * Routes for handling password reset
 * ------------------------------------------------
 * GET   /forgot-password - Forgot password page
 * POST  /forgot-password - Send reset password link
 * GET   /reset-password/:id - Reset password page
 * POST  /reset-password - Process password reset
 */
Route.get("/forgot-password", AuthController.forgotPasswordPage);
Route.post("/forgot-password", strictRateLimit(), AuthController.sendResetPassword);
Route.get("/reset-password/:id", AuthController.resetPasswordPage);
Route.post("/reset-password", strictRateLimit(), AuthController.resetPassword);

/**
 * Protected Routes
 * These routes require authentication
 * ------------------------------------------------
 * GET    /dashboard       - User dashboard
 * GET    /profile         - User profile
 * POST   /change-profile  - Update profile
 * POST   /change-password - Change password
 * POST   /users           - Create user (admin only)
 * PUT    /users/:id       - Update user (admin only)
 * DELETE /users           - Delete users (admin only)
 */
Route.get("/dashboard", [Auth], AuthController.homePage);
Route.get("/users", [Auth], AuthController.usersPage);
Route.get("/profile", [Auth], AuthController.profilePage);
Route.post("/change-profile", [Auth], AuthController.changeProfile);
Route.post("/change-password", [Auth], AuthController.changePassword);
Route.post("/users", [Auth], AuthController.createUser);
Route.put("/users/:id", [Auth], AuthController.updateUser);
Route.delete("/users", [Auth], AuthController.deleteUsers);

// Avatar upload endpoint (local storage) - rate limited to prevent abuse
Route.post("/assets/avatar", [Auth, strictRateLimit()], AssetController.uploadAsset);

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
 * 2. Public Assets (/*) - Catch-all Route
 * Serves static files from the public directory
 * - Must be the LAST route in the file
 * - Only serves files with allowed extensions
 * - Returns 404 for paths without extensions
 * - Implements security checks against unauthorized access
 * 
 * Allowed file types:
 * - Images: .ico, .png, .jpeg, .jpg, .gif, .svg
 * - Documents: .txt, .pdf
 * - Fonts: .woff, .woff2, .ttf, .eot
 * - Media: .mp4, .webm, .mp3, .wav
 * - Web: .css, .js
 * 
 * Example URLs:
 * - /images/logo.png
 * - /documents/terms.pdf
 * - /fonts/roboto.woff2
 */
Route.get("/public/*", AssetController.publicFolder);

// Export the underlying HyperExpress router for mounting to the server
export default Route.getRouter();