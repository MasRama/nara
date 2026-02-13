/**
 * GenerateTypes Command
 * 
 * Generates frontend TypeScript types from backend type definitions.
 * This ensures frontend and backend types stay in sync.
 * 
 * Source: app/core/types.ts
 * Target: resources/js/types/generated.ts
 */
import * as fs from "fs";
import * as path from "path";
import { printSuccess, printError, printInfo, colors } from "../index";

const c = colors;

class GenerateTypes {
  public args: string[] = [];
  public commandName = "generate:types";
  public description = "Generate frontend types from backend definitions";

  public run() {
    const sourceFile = "./app/core/types.ts";
    const targetDir = "./resources/js/types";
    const targetFile = path.join(targetDir, "generated.ts");

    // Check source exists
    if (!fs.existsSync(sourceFile)) {
      printError(`Source file not found: ${sourceFile}`);
      return;
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      printInfo(`Created directory: ${targetDir}`);
    }

    // Read source file
    const sourceContent = fs.readFileSync(sourceFile, "utf-8");

    // Extract User interface
    const userInterface = this.extractInterface(sourceContent, "User");
    
    if (!userInterface) {
      printError("Could not find User interface in source file");
      return;
    }

    // Generate frontend types file
    const generatedContent = this.generateFrontendTypes(userInterface);

    // Write to target
    fs.writeFileSync(targetFile, generatedContent);

    printSuccess(`Types generated: ${c.cyan}resources/js/types/generated.ts${c.reset}`);
    printInfo(`Source: ${c.dim}app/core/types.ts${c.reset}`);
    
    // Update index.ts if it exists
    this.updateIndexFile(targetDir);
    
    console.log();
  }

  /**
   * Extract an interface definition from source code
   */
  private extractInterface(source: string, name: string): string | null {
    // Match only the JSDoc comment directly before the interface and the interface itself
    const regex = new RegExp(
      `(\\/\\*\\*\\s*\\n(?:\\s*\\*[^\\n]*\\n)*\\s*\\*\\/\\s*)?export\\s+interface\\s+${name}\\s*\\{[^}]+\\}`,
      "m"
    );
    const match = source.match(regex);
    if (!match) return null;
    
    // Clean up: only keep the JSDoc for User interface and the interface itself
    let result = match[0];
    
    // If the match includes unrelated content before the User JSDoc, trim it
    const userJsDocStart = result.indexOf('/**\n * User interface');
    if (userJsDocStart > 0) {
      result = result.substring(userJsDocStart);
    }
    
    return result;
  }

  /**
   * Generate frontend types file content
   */
  private generateFrontendTypes(userInterface: string): string {
    const timestamp = new Date().toISOString();
    
    return `/**
 * Generated Frontend Types
 * 
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * 
 * This file is generated from backend type definitions.
 * Run \`node nara generate:types\` to regenerate.
 * 
 * Source: app/core/types.ts
 * Generated: ${timestamp}
 */

// =============================================================================
// User Types (from app/core/types.ts)
// =============================================================================

${userInterface}

// =============================================================================
// Form Types
// =============================================================================

/**
 * Form data for creating/editing users
 */
export interface UserForm {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  is_verified: boolean;
  password: string;
}

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * Pagination metadata from backend
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * Union type for API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create empty user form
 */
export function createEmptyUserForm(): UserForm {
  return {
    id: null,
    name: '',
    email: '',
    phone: '',
    is_admin: false,
    is_verified: false,
    password: ''
  };
}

/**
 * Convert User to UserForm for editing
 */
export function userToForm(user: User): UserForm {
  return {
    id: user.id,
    name: user.name || '',
    email: user.email || '',
    phone: user.phone || '',
    is_admin: !!user.is_admin,
    is_verified: !!user.is_verified,
    password: ''
  };
}

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse): response is ApiErrorResponse {
  return response.success === false;
}
`;
  }

  /**
   * Update or create index.ts barrel export
   */
  private updateIndexFile(targetDir: string): void {
    const indexPath = path.join(targetDir, "index.ts");
    
    const indexContent = `/**
 * Frontend Types Module
 * 
 * Barrel export for all frontend type definitions.
 * 
 * @example
 * import { User, UserForm, PaginationMeta } from './types';
 */

// Generated types from backend
export * from './generated';

// Add custom frontend-only types below
// export * from './custom';
`;

    fs.writeFileSync(indexPath, indexContent);
    printInfo(`Updated: ${c.cyan}resources/js/types/index.ts${c.reset}`);
  }
}

export default new GenerateTypes();
