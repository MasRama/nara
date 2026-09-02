import { getDatabase } from '@/shared/database';
import fs from 'node:fs';

export const reportClientDependencies = { getDatabase, fs };
