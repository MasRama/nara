/**
 * AuthController — Overview & Guide for New Contributors
 *
 * This controller centralizes authentication and account-related flows, including:
 * - Rendering auth pages (register, login, forgot/reset password, verify)
 * - Managing sessions (login, logout) via Authenticate service
 * - User profile updates (name, email, phone, password)
 * - Password reset via token with 24-hour expiry (email/SMS)
 * - Email verification via token with 24-hour expiry
 * - Google OAuth (redirect to Google, handle callback, auto-create user)
 * - Admin utilities: user listing with search/filter/pagination and bulk delete
 *
 * Key methods:
 * - registerPage: If already authenticated, redirects to "/home"; else renders register page.
 * - homePage: Lists users with search, filter (verified/unverified), and pagination. Returns data to Inertia.
 *   Note: The response currently sets `total: 0`. Consider wiring `total.count` from the DB query.
 * - deleteUsers: Admin-only bulk delete by array of user IDs; validates input and authorization.
 * - profilePage: Renders the profile page for the current user.
 * - changeProfile: Updates the current user's name, email (normalized to lowercase), and phone.
 * - changePassword: Verifies current password, then stores the new hashed password; returns 400 if mismatch.
 * - forgotPasswordPage: Renders the page to request a password reset link.
 * - resetPasswordPage: Validates the reset token and expiry; renders the reset form if valid, 404 otherwise.
 * - resetPassword: Validates token, updates the user's password (hashed), deletes token, then logs the user in.
 * - sendResetPassword: Generates a UUID token, stores it with 24h expiry, emails/SMS the reset link.
 * - loginPage: Renders the login page.
 * - redirect: Builds Google OAuth URL from env vars and redirects the browser to Google.
 * - googleCallback: Exchanges `code` for tokens, fetches Google profile, creates user if needed, then logs in.
 * - processLogin: Supports login via email or phone; compares hashed password; sets error cookies on failure.
 * - processRegister: Creates a new user with hashed password; handles duplicate email via DB constraint.
 * - verify: Generates email verification token (24h), sends email, and redirects to "/home".
 * - verifyPage: Confirms token ownership and expiry, marks user as verified, cleans up token, redirects.
 * - logout: Clears the auth session if present.
 *
 * Services & dependencies:
 * - DB (Knex): All database access for users and token tables.
 * - Authenticate: Hash/compare utilities and session/cookie management (`process`, `logout`).
 * - Mailer: Sends emails (uses `USER_MAILER`).
 * - GoogleAuth.redirectParamsURL: Builds OAuth querystring from `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, etc.
 * - axios: HTTP calls (Google APIs and SMS provider).
 * - dayjs: Time utilities for timestamps and token expiry.
 *
 * Security & correctness notes:
 * - deleteUsers requires `request.user.is_admin`; ensure auth middleware populates `request.user`.
 * - Email/phone login paths sanitize inputs and normalize emails to lowercase.
 * - Tokens are stored in `password_reset_tokens` and `email_verification_tokens` with expiry; values are UUIDs.
 * - Passwords are always hashed via `Authenticate.hash`; never store plaintext.
 * - Replace `DRIPSENDER_API_KEY` with a real secret from environment before production.
 *
 * Routing expectations (typical):
 * - Pages: /register, /login, /home, /profile, /forgot-password, /reset-password/:id, /verify/:id
 * - Actions: POST /register, POST /login, POST /profile, POST /password, POST /reset-password,
 *            POST /verify, GET /auth/google, GET /auth/google/callback, POST /users/delete
 *
 * Frontend integration:
 * - `response.inertia(view, props)` renders views in `resources/js/Pages` using Inertia.
 * - `Authenticate.process(user, request, response)` should set cookies/session and perform appropriate redirect.
 */
import DB from "../services/DB";
import Authenticate from "../services/Authenticate";
import { redirectParamsURL } from "../services/GoogleAuth";
import axios from "axios"; 
import dayjs from "dayjs";
import Mailer from "../services/Mailer";
import Logger from "../services/Logger";
import { Response, Request } from "../../type"; 
import { randomUUID } from "crypto";

class AuthController {
   public async registerPage(request : Request, response: Response) {
      if (request.cookies.auth_id) {
         return response.redirect("/dashboard");
      }

      return response.inertia("auth/register");
   }

   public async homePage(request : Request, response: Response) {
      const page = parseInt(request.query.page as string) || 1;
      const search = request.query.search as string || "";
      const filter = request.query.filter as string || "all";
      
      let query = DB.from("users").select("*");
      
      // Apply search
      if (search) {
         query = query.where(function() {
            this.where('name', 'like', `%${search}%`)
                .orWhere('email', 'like', `%${search}%`)
                .orWhere('phone', 'like', `%${search}%`);
         });
      }
      
      // Apply filters
      if (filter === 'verified') {
         query = query.where('is_verified', true);
      } else if (filter === 'unverified') {
         query = query.where('is_verified', false);
      }
      
      // Get total count
      const countQuery = query.clone();
      const total = await countQuery.count('* as count').first();
      
      // Get paginated results
      const users = await query
         .orderBy('created_at', 'desc')
         .offset((page - 1) * 10)
         .limit(10);
      
      return response.inertia("dashboard", { 
         users, 
         total:   0,
         page,
         search,
         filter
      });
   }

   public async usersPage(request : Request, response: Response) {
      const page = parseInt(request.query.page as string) || 1;
      const search = request.query.search as string || "";
      const filter = request.query.filter as string || "all";

      let query = DB.from("users").select("*");

      if (search) {
         query = query.where(function() {
            this.where('name', 'like', `%${search}%`)
                .orWhere('email', 'like', `%${search}%`)
                .orWhere('phone', 'like', `%${search}%`);
         });
      }

      if (filter === 'verified') {
         query = query.where('is_verified', true);
      } else if (filter === 'unverified') {
         query = query.where('is_verified', false);
      }

      const countQuery = query.clone();
      const total = await countQuery.count('* as count').first();

      const users = await query
         .orderBy('created_at', 'desc')
         .offset((page - 1) * 10)
         .limit(10);

      return response.inertia("users", {
         users,
         total: 0,
         page,
         search,
         filter,
      });
   }

   public async createUser(request : Request, response: Response) {
      if (!request.user.is_admin) {
         return response.status(403).json({ message: "Unauthorized" });
      }

      const data = await request.json();

      if (!data.name || !data.email) {
         return response.status(400).json({ message: "Name and email are required" });
      }

      const now = dayjs().valueOf();

      const user = {
         id: randomUUID(),
         name: data.name,
         email: (data.email as string).toLowerCase(),
         phone: data.phone || null,
         is_admin: !!data.is_admin,
         is_verified: !!data.is_verified,
         password: await Authenticate.hash(data.password || data.email),
         created_at: now,
         updated_at: now,
      };

      try {
         await DB.table("users").insert(user);
         return response.json({ message: "User created", user });
      } catch (error: any) {
         if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return response.status(400).json({ message: "Email already used" });
         }
         return response.status(500).json({ message: "Failed to create user" });
      }
   }

   public async updateUser(request : Request, response: Response) {
      if (!request.user.is_admin) {
         return response.status(403).json({ message: "Unauthorized" });
      }

      const id = request.params.id;
      const data = await request.json();

      if (!id) {
         return response.status(400).json({ message: "User id is required" });
      }

      const payload: any = {
         name: data.name,
         email: data.email ? (data.email as string).toLowerCase() : undefined,
         phone: data.phone ?? null,
         is_admin: !!data.is_admin,
         is_verified: !!data.is_verified,
      };

      if (data.password) {
         payload.password = await Authenticate.hash(data.password);
      }

      Object.keys(payload).forEach((key) => {
         if (payload[key] === undefined) {
            delete payload[key];
         }
      });

      if (Object.keys(payload).length === 0) {
         return response.status(400).json({ message: "No data to update" });
      }

      payload.updated_at = dayjs().valueOf();

      try {
         await DB.from("users").where("id", id).update(payload);
         const user = await DB.from("users").where("id", id).first();
         return response.json({ message: "User updated", user });
      } catch (error: any) {
         if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return response.status(400).json({ message: "Email already used" });
         }
         return response.status(500).json({ message: "Failed to update user" });
      }
   }

   public async deleteUsers(request : Request, response: Response) {
      const { ids } = await request.json();
      
      if (!Array.isArray(ids) || ids.length === 0) {
         return response.status(400).json({ message: "Invalid request format" });
      }
      
      if (!request.user.is_admin) {
         Logger.logSecurity('Unauthorized delete attempt', {
            userId: request.user.id,
            attemptedIds: ids,
            ip: request.ip
         });
         return response.status(403).json({ message: "Unauthorized" });
      }
      
      const deleted = await DB.from("users")
         .whereIn("id", ids)
         .delete();
      
      Logger.warn('Users deleted by admin', {
         adminId: request.user.id,
         deletedIds: ids,
         count: deleted,
         ip: request.ip
      });
      
      return response.json({ message: "Users deleted", deleted });
   }

   public async profilePage(request : Request, response: Response) { 
      return response.inertia("profile");
   }

   public async changeProfile(request : Request, response: Response) {
      const data = await request.json();

      await DB.from("users").where("id", request.user.id).update({
         name: data.name,
         email: data.email.toLowerCase(),
         phone: data.phone,
      });

      return response.json({ message: "Your profile has been updated" });
   }

   public async changePassword(request : Request, response: Response) {
      const data = await request.json();

      const user = await DB.from("users")
         .where("id", request.user.id)
         .first();

      const password_match = await Authenticate.compare(
         data.current_password,
         user.password
      );

      if (password_match) {
         await DB.from("users")
            .where("id", request.user.id)
            .update({
               password: await Authenticate.hash(data.new_password),
            });
         
         Logger.logAuth('password_changed', {
            userId: request.user.id,
            email: request.user.email,
            ip: request.ip
         });

         return response.json({ message: "Password berhasil diubah" });
      } else {
         Logger.logSecurity('Password change failed - invalid current password', {
            userId: request.user.id,
            ip: request.ip
         });
         return response
            .status(400)
            .json({ message: "Password lama tidak cocok" });
      }
   }

   public async forgotPasswordPage(request : Request, response: Response) {
      return response.inertia("auth/forgot-password");
   }
   public async resetPasswordPage(request : Request, response: Response) {
      const id = request.params.id;

      const token = await DB.from("password_reset_tokens")
         .where("token", id)
         .where("expires_at", ">", new Date())
         .first();

      if (!token) {
         return response.status(404).send("Link tidak valid atau sudah kadaluarsa");
      }

      return response.inertia("auth/reset-password", { id: request.params.id });
   }

   public async resetPassword(request : Request, response: Response) {
      const { id, password } = await request.json();

      const token = await DB.from("password_reset_tokens")
         .where("token", id)
         .where("expires_at", ">", new Date())
         .first();

      if (!token) {
         return response.status(404).send("Link tidak valid atau sudah kadaluarsa");
      }

      const user = await DB.from("users")
         .where("email", token.email)
         .first();

      await DB.from("users")
         .where("id", user.id)
         .update({ password: await Authenticate.hash(password) });

      // Delete the used token
      await DB.from("password_reset_tokens")
         .where("token", id)
         .delete();

      return Authenticate.process(user, request, response);
   }

   public async sendResetPassword(request : Request, response: Response) {
      let { email, phone } = await request.json();
 
      let user;

      if (email && email.includes("@")) {
         user = await DB.from("users").where("email", email).first();
      } else if (phone) {
         user = await DB.from("users").where("phone", phone).first();
      }

      if (!user) {
         return response.status(404).send("Email tidak terdaftar");
      }

      const token = randomUUID();
      
      // Store token in database with 24-hour expiration
      await DB.from("password_reset_tokens").insert({
         email: user.email,
         token: token,
         expires_at: dayjs().add(24, 'hours').toDate()
      });

      try {
         await Mailer.sendMail({
            from: process.env.USER_MAILER,
            to: email,
            subject: "Reset Password",
            text: `You have requested a password reset. If this was you, please click the following link:
      
        ${process.env.APP_URL}/reset-password/${token}
        
        If you did not request a password reset, please ignore this email.
        
        This link will expire in 24 hours.
              `,
         });
      } catch (error) {}

      try {
         if (user.phone)
            await axios.post("https://api.dripsender.id/send", {
               api_key: "DRIPSENDER_API_KEY",
               phone: user.phone,
               text: `You have requested a password reset. If this was you, please click the following link:
      
${process.env.APP_URL}/reset-password/${token}
          
If you did not request a password reset, please ignore this message.

This link will expire in 24 hours.
                `,
            });
      } catch (error) {}

      return response.send("OK")
   }

   public async loginPage(request : Request, response: Response) {
      return response.inertia("auth/login");
   }

   public async redirect(request : Request, response) {
      const params = redirectParamsURL();

      const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

      return response.redirect(googleLoginUrl);
   }

   public async googleCallback(request : Request, response: Response) {
      const { code } = request.query;

      const { data } = await axios({
         url: `https://oauth2.googleapis.com/token`,
         method: "post",
         data: {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
            code,
         },
      });

      const result = await axios({
         url: "https://www.googleapis.com/oauth2/v2/userinfo",
         method: "get",
         headers: {
            Authorization: `Bearer ${data.access_token}`,
         },
      });

      let { email, name, verified_email } = result.data;

      email = email.toLowerCase();

      const check = await DB.from("users").where("email", email).first();

      if (check) {
         //
         return Authenticate.process(check, request, response);
      } else {
         const user = {
            id: randomUUID(),
            email: email,
            password: await Authenticate.hash(email),
            name: name,
            is_verified: verified_email,
            created_at: dayjs().valueOf(),
            updated_at: dayjs().valueOf(),
         };

         await DB.table("users").insert(user);

         Logger.logAuth('google_registration_success', {
            userId: user.id,
            email: user.email,
            ip: request.ip
         });

         return Authenticate.process(user, request, response);
      }
   }

   public async processLogin(request : Request, response: Response) {
      const data = await request.json();
      const identifier = data.email || data.phone;

      Logger.info('Login attempt', { 
         identifier: data.email ? data.email.toLowerCase() : data.phone,
         type: data.email ? 'email' : 'phone',
         ip: request.ip,
         userAgent: request.headers['user-agent']
      });

      let user;

      if (data.email) {
         user = await DB.from("users")
            .where("email", data.email.toLowerCase())
            .first();
      } else if (data.phone) {
         user = await DB.from("users").where("phone", data.phone).first();
      }

      if (!user) {
         Logger.logSecurity('Login failed - user not found', {
            identifier,
            ip: request.ip
         });
         return response
            .cookie("error", "Email atau password salah", 1000 * 60 * 5)
            .redirect("/login");
      }

      const password_match = await Authenticate.compare(
         data.password,
         user.password
      );

      if (password_match) {
         Logger.logAuth('login_success', {
            userId: user.id,
            email: user.email,
            ip: request.ip
         });
         return Authenticate.process(user, request, response);
      } else {
         Logger.logSecurity('Login failed - invalid password', {
            userId: user.id,
            email: user.email,
            ip: request.ip
         });
         return response
            .cookie("error", "Email atau password salah", 1000 * 60 * 5)
            .redirect("/login");
      }
   }

   public async processRegister(request : Request, response: Response) {
      const data = await request.json();

      Logger.info('Registration attempt', {
         email: data.email.toLowerCase(),
         name: data.name,
         ip: request.ip
      });

      const id = randomUUID();

      try {
         await DB.table("users").insert({
            id: id,
            name: data.name,
            email: data.email.toLowerCase(),
            phone: data.phone,
            password: await Authenticate.hash(data.password),
            created_at: dayjs().valueOf(),
            updated_at: dayjs().valueOf(),
         });

         const user = await DB.from("users").where("id", id).first();

         Logger.logAuth('registration_success', {
            userId: user.id,
            email: user.email,
            ip: request.ip
         });

         return Authenticate.process(user, request, response);
      } catch (error: any) {
         if (error.code == "SQLITE_CONSTRAINT_UNIQUE") {
            Logger.logSecurity('Registration failed - duplicate email', {
               email: data.email.toLowerCase(),
               ip: request.ip
            });
            return response
               .cookie("error", "Email sudah terdaftar", 1000 * 60 * 5)
               .redirect("/register");
         }
         Logger.error('Registration failed', error);
         throw error;
      }
   }

   public async verify(request : Request, response: Response) {
      const token = randomUUID();

      // Delete any existing verification tokens for this user
      await DB.from("email_verification_tokens")
         .where("user_id", request.user.id)
         .delete();

      // Create new verification token
      await DB.from("email_verification_tokens").insert({
         user_id: request.user.id,
         token: token,
         expires_at: dayjs().add(24, 'hours').toDate()
      });

      try {
         await Mailer.sendMail({
            from: process.env.USER_MAILER,
            to: request.user.email,
            subject: "Verifikasi Akun",
            text: `Klik link berikut untuk verifikasi email anda:
${process.env.APP_URL}/verify/${token}

Link ini akan kadaluarsa dalam 24 jam.`,
         });
      } catch (error) {
         console.log(error);
         return response.redirect("/dashboard");
      }

      return response.redirect("/dashboard");
   }

   public async verifyPage(request : Request, response: Response) {
      const { id } = request.params;

      const verificationToken = await DB.from("email_verification_tokens")
         .where({
            user_id: request.user.id,
            token: id
         })
         .where("expires_at", ">", new Date())
         .first();

      if (verificationToken) {
         await DB.from("users")
            .where("id", request.user.id)
            .update({ is_verified: true });

         // Delete the used token
         await DB.from("email_verification_tokens")
            .where("id", verificationToken.id)
            .delete();
      }

      return response.redirect("/dashboard?verified=true");
   }

   public async logout(request : Request, response: Response) {
      if (request.cookies.auth_id) {
         await Authenticate.logout(request, response);
      }
   }
}

export default new AuthController();
