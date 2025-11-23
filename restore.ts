import dayjs from "dayjs";
import { join, basename } from "path";
import { existsSync, mkdirSync, createWriteStream, createReadStream, readdirSync, statSync } from "fs";
import { createGunzip } from "zlib";
import { pipeline } from "stream";
import { promisify } from "util";
import { createDecipheriv } from "crypto";

require("dotenv").config();

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

async function main() {
  const argv = process.argv.slice(2);
  const argFileIdx = argv.indexOf('--file');
  const providedFile = argFileIdx !== -1 ? argv[argFileIdx + 1] : undefined;

  const backupsDir = join(__dirname, 'backups');
  if (!existsSync(backupsDir)) {
    throw new Error(`Backup directory not found: ${backupsDir}`);
  }

  let encryptedFilePath: string;

  if (providedFile) {
    // Use provided file
    encryptedFilePath = join(backupsDir, providedFile);
    if (!existsSync(encryptedFilePath)) {
      throw new Error(`Backup file not found: ${encryptedFilePath}`);
    }
  } else {
    // Find the most recent .enc file
    const files = readdirSync(backupsDir)
      .filter(f => f.endsWith('.db.gz.enc'))
      .map(f => ({
        name: f,
        path: join(backupsDir, f),
        mtime: statSync(join(backupsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      throw new Error('No encrypted backup files found in backups directory');
    }

    encryptedFilePath = files[0].path;
    console.log(`Using most recent backup: ${files[0].name}`);
  }

  // Extract IV and auth tag from filename metadata
  // Note: This is a simplified approach. In production, you should store IV/tag separately
  // For now, we'll prompt user to provide them via environment or command line
  const argIvIdx = argv.indexOf('--iv');
  const argTagIdx = argv.indexOf('--tag');
  
  const ivBase64 = argIvIdx !== -1 ? argv[argIvIdx + 1] : process.env.BACKUP_IV;
  const tagBase64 = argTagIdx !== -1 ? argv[argTagIdx + 1] : process.env.BACKUP_TAG;

  if (!ivBase64 || !tagBase64) {
    throw new Error('IV and auth tag are required. Provide via --iv and --tag arguments or BACKUP_IV and BACKUP_TAG env vars');
  }

  const keyBuf = getEncryptionKey();
  const ivBuf = Buffer.from(ivBase64, 'base64');
  const tagBuf = Buffer.from(tagBase64, 'base64');

  const timestamp = dayjs().format('YYYY-MM-DDTHH:mm');
  const outFile = join(backupsDir, `restored-${timestamp}.db`);

  console.log(`Restoring backup from: ${basename(encryptedFilePath)}`);

  const decipher = createDecipheriv('aes-256-gcm', keyBuf, ivBuf);
  decipher.setAuthTag(tagBuf);
  const gunzip = createGunzip();

  await pipe(createReadStream(encryptedFilePath), decipher, gunzip, createWriteStream(outFile));
  console.log(`Restored database written to: ${outFile}`);
  console.log('NOTE: To activate restore, stop your app and replace the current SQLite file with the restored .db.');
}

main().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});