/**
 * Backup Command
 * 
 * Creates encrypted backup of SQLite database.
 * Usage: node nara backup
 */
import { printSuccess, printError, printInfo, colors } from "../index";
import SQLiteService from '../../app/services/SQLite';
import dayjs from "dayjs";
import { basename, join } from "path";
import { existsSync, mkdirSync, createReadStream, createWriteStream, statSync } from "fs";
import { unlink } from "fs/promises";
import { createGzip } from "zlib";
import { pipeline } from "stream";
import { promisify } from "util";
import { randomBytes, createCipheriv, createHash, randomUUID } from "crypto";

const c = colors;
const pipe = promisify(pipeline);

function getEncryptionKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is not set');
  const tryBase64 = Buffer.from(raw, 'base64');
  if (tryBase64.length === 32) return tryBase64;
  const tryHex = Buffer.from(raw, 'hex');
  if (tryHex.length === 32) return tryHex;
  const asUtf8 = Buffer.from(raw, 'utf8');
  if (asUtf8.length === 32) return asUtf8;
  throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes (base64/hex/utf8)');
}

async function md5File(filePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

class Backup {
  public args: string[] = [];
  public commandName = "backup";
  public description = "Create encrypted backup of SQLite database";

  public async run() {
    const backupDir = join(process.cwd(), 'backups');
    
    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
      printInfo(`Created backup directory: ${backupDir}`);
    }

    try {
      const db = SQLiteService.getDatabase();
      const dbFilename = basename(db.name);
      const timestamp = dayjs().format('YYYY-MM-DDTHH:mm');

      printInfo(`Starting backup of ${c.cyan}${dbFilename}${c.reset}...`);

      // Create raw backup file first
      const rawBackupFilename = `${dbFilename}-${timestamp}.db`;
      const rawBackupPath = join(backupDir, rawBackupFilename);
      await db.backup(rawBackupPath);
      printInfo(`Raw backup created`);

      // Compress the backup to reduce transfer size
      const compressedFilename = `${dbFilename}-${timestamp}.db.gz`;
      const compressedPath = join(backupDir, compressedFilename);
      const gzip = createGzip();
      await pipe(createReadStream(rawBackupPath), gzip, createWriteStream(compressedPath));
      printInfo(`Compressed backup`);

      // Encrypt compressed backup with AES-256-GCM
      const encryptedFilename = `${dbFilename}-${timestamp}-${randomUUID()}.db.gz.enc`;
      const encryptedPath = join(backupDir, encryptedFilename);
      const encKey = getEncryptionKey();
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', encKey, iv);
      await pipe(createReadStream(compressedPath), cipher, createWriteStream(encryptedPath));
      const authTag = cipher.getAuthTag();
      printInfo(`Encrypted backup`);

      // Compute checksum for verification
      const checksum = await md5File(encryptedPath);
      const stats = statSync(encryptedPath);

      // Clean up intermediate files (keep only encrypted backup)
      await unlink(rawBackupPath).catch(() => {});
      await unlink(compressedPath).catch(() => {});

      printSuccess(`Backup completed successfully!`);
      console.log(`\n  ${c.dim}File:${c.reset}       ${encryptedPath}`);
      console.log(`  ${c.dim}Size:${c.reset}       ${stats.size} bytes`);
      console.log(`  ${c.dim}Checksum:${c.reset}   ${checksum}`);
      console.log(`  ${c.dim}Encryption:${c.reset} AES-256-GCM`);
      console.log(`  ${c.dim}IV:${c.reset}         ${iv.toString('base64')}`);
      console.log(`  ${c.dim}Auth Tag:${c.reset}   ${authTag.toString('base64')}`);
      console.log(`\n  ${c.yellow}Save IV and Auth Tag for restore!${c.reset}\n`);
    } catch (err) {
      printError(`Backup failed: ${(err as Error).message}`);
      process.exit(1);
    }
  }
}

export default new Backup();
