export const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error as any).code === 'SQLITE_CONSTRAINT_UNIQUE';
