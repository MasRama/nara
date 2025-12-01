/**
 * Restore Command
 * 
 * Restores encrypted backup of SQLite database.
 * Usage: node nara restore --iv <base64> --tag <base64> [--file <filename>]
 */
import { printSuccess, printError, printInfo, colors } from "../index";
import dayjs from "dayjs";
import { join, basename } from "path";
import { existsSync, createWriteStream, createReadStream, readdirSync, statSync } from "fs";
import { createGunzip } from "zlib";
import { pipeline } from "stream";
import { promisify } from "util";
import { createDecipheriv } from "crypto";

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

class Restore {
  public args: string[] = [];
  public commandName = "restore";
  public description = "Restore encrypted backup of SQLite database";

  public async run() {
    const backupsDir = join(process.cwd(), 'backups');

    if (!existsSync(backupsDir)) {
      printError(`Backup directory not found: ${backupsDir}`);
      process.exit(1);
    }

    // Parse arguments
    const argFileIdx = this.args.indexOf('--file');
    const providedFile = argFileIdx !== -1 ? this.args[argFileIdx + 1] : undefined;

    const argIvIdx = this.args.indexOf('--iv');
    const argTagIdx = this.args.indexOf('--tag');
    
    const ivBase64 = argIvIdx !== -1 ? this.args[argIvIdx + 1] : process.env.BACKUP_IV;
    const tagBase64 = argTagIdx !== -1 ? this.args[argTagIdx + 1] : process.env.BACKUP_TAG;

    if (!ivBase64 || !tagBase64) {
      printError('IV and auth tag are required.');
      console.log(`\n  ${c.dim}Usage:${c.reset} node nara restore --iv <base64> --tag <base64> [--file <filename>]`);
      console.log(`  ${c.dim}Or set BACKUP_IV and BACKUP_TAG environment variables${c.reset}\n`);
      process.exit(1);
    }

    let encryptedFilePath: string;

    if (providedFile) {
      encryptedFilePath = join(backupsDir, providedFile);
      if (!existsSync(encryptedFilePath)) {
        printError(`Backup file not found: ${encryptedFilePath}`);
        process.exit(1);
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
        printError('No encrypted backup files found in backups directory');
        process.exit(1);
      }

      encryptedFilePath = files[0].path;
      printInfo(`Using most recent backup: ${c.cyan}${files[0].name}${c.reset}`);
    }

    try {
      const keyBuf = getEncryptionKey();
      const ivBuf = Buffer.from(ivBase64, 'base64');
      const tagBuf = Buffer.from(tagBase64, 'base64');

      const timestamp = dayjs().format('YYYY-MM-DDTHH:mm');
      const outFile = join(backupsDir, `restored-${timestamp}.db`);

      printInfo(`Restoring backup from: ${c.cyan}${basename(encryptedFilePath)}${c.reset}`);

      const decipher = createDecipheriv('aes-256-gcm', keyBuf, ivBuf);
      decipher.setAuthTag(tagBuf);
      const gunzip = createGunzip();

      await pipe(createReadStream(encryptedFilePath), decipher, gunzip, createWriteStream(outFile));
      
      printSuccess(`Restore completed!`);
      console.log(`\n  ${c.dim}Restored to:${c.reset} ${outFile}`);
      console.log(`\n  ${c.yellow}To activate: stop app and replace current SQLite file with restored .db${c.reset}\n`);
    } catch (err) {
      printError(`Restore failed: ${(err as Error).message}`);
      process.exit(1);
    }
  }
}

export default new Restore();
