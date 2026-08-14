import SQLite from '@services/SQLite';

export const pingDatabase = (): boolean => {
  try {
    SQLite.one`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};
