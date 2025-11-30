/**
 * Nara Type Definitions
 * 
 * This file provides backward compatibility with existing code.
 * New code should import from '@core' instead.
 * 
 * @deprecated Import from '@core' instead:
 * import type { NaraRequest, NaraResponse, User } from '@core';
 */

// Re-export core types for backward compatibility
export type { User, NaraRequest, NaraResponse } from '../app/core/types';

// Aliases for backward compatibility
import type { NaraRequest, NaraResponse } from '../app/core/types';

/**
 * @deprecated Use NaraRequest from '@core' instead
 */
export type Request = NaraRequest;

/**
 * @deprecated Use NaraResponse from '@core' instead
 */
export type Response = NaraResponse;
