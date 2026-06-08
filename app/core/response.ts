import type { NaraResponse, NaraResponseWithInertia } from './types';

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export type PaginationMeta = PaginatedMeta;
export type ResponseMeta = PaginationMeta | Record<string, unknown>;

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: ResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export function jsonSuccess<T = unknown>(
  res: NaraResponse,
  message: string,
  data?: T,
  meta?: ResponseMeta,
  statusCode: number = 200
): NaraResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
  return res;
}

export function jsonError(
  res: NaraResponse,
  message: string,
  statusCode: number = 400,
  code?: string,
  errors?: Record<string, string[]>
): NaraResponse {
  const response: ApiErrorResponse = {
    success: false,
    message,
  };

  if (code !== undefined) {
    response.code = code;
  }

  if (errors !== undefined) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
  return res;
}

export function jsonPaginated<T = unknown>(
  res: NaraResponse,
  message: string,
  data: T[],
  meta: PaginatedMeta
): NaraResponse {
  const paginationMeta: PaginatedMeta = {
    ...meta,
    totalPages: meta.totalPages ?? Math.ceil(meta.total / meta.limit),
  };

  return jsonSuccess(res, message, data, paginationMeta);
}

export function jsonCreated<T = unknown>(
  res: NaraResponse,
  message: string,
  data?: T
): NaraResponse {
  return jsonSuccess(res, message, data, undefined, 201);
}

export function jsonNoContent(res: NaraResponse): NaraResponse {
  res.status(204).send('');
  return res;
}

export function jsonUnauthorized(
  res: NaraResponse,
  message: string = 'Unauthorized'
): NaraResponse {
  return jsonError(res, message, 401, 'UNAUTHORIZED');
}

export function jsonForbidden(
  res: NaraResponse,
  message: string = 'Forbidden'
): NaraResponse {
  return jsonError(res, message, 403, 'FORBIDDEN');
}

export function jsonNotFound(
  res: NaraResponse,
  message: string = 'Not Found'
): NaraResponse {
  return jsonError(res, message, 404, 'NOT_FOUND');
}

export function jsonValidationError(
  res: NaraResponse,
  message: string = 'Validation failed',
  errors?: Record<string, string[]>
): NaraResponse {
  return jsonError(res, message, 422, 'VALIDATION_ERROR', errors);
}

export function jsonServerError(
  res: NaraResponse,
  message: string = 'Internal Server Error'
): NaraResponse {
  return jsonError(res, message, 500, 'INTERNAL_ERROR');
}

export const inertia = (res: NaraResponse): NaraResponseWithInertia =>
  res as NaraResponseWithInertia;
