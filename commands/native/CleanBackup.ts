/**
 * Clean Backup Command
 * 
 * Removes old backup files based on retention policy.
 * Usage: node nara clean:backup [--days <number>]
 */
import { printSuccess, printError, printInfo, colors } from "../index";
import dayjs from "dayjs";
import { join } from "path";
import { existsSync, readdirSync, statSync, unlinkSync } from "fs";

const c = colors;

class CleanBackup {
  public args: string[] = [];
  public commandName = "clean:backup";
  public description = "Remove old backup files based on retention policy";

  public async run() {
    // Parse --days argument or use env/default
    const argDaysIdx = this.args.indexOf('--days');
    const retentionDays = argDaysIdx !== -1 
      ? Number(this.args[argDaysIdx + 1]) 
      : Number(process.env.BACKUP_RETENTION_DAYS || 30);

    const backupsDir = join(process.cwd(), 'backups');
    
    if (!existsSync(backupsDir)) {
      printInfo("Backup directory not found. Nothing to clean.");
      return;
    }

    const now = Date.now();
    const thresholdMs = now - retentionDays * 24 * 60 * 60 * 1000;
    const thresholdStr = dayjs(thresholdMs).format("YYYY-MM-DDTHH:mm");

    printInfo(`Cleaning backups older than ${c.cyan}${thresholdStr}${c.reset} (>${retentionDays} days)`);

    // Get backup files older than threshold
    const files = readdirSync(backupsDir)
      .filter(f => f.endsWith('.db.gz.enc'))
      .map(f => {
        const filePath = join(backupsDir, f);
        const stats = statSync(filePath);
        return {
          name: f,
          path: filePath,
          mtime: stats.mtime.getTime()
        };
      })
      .filter(f => f.mtime < thresholdMs);

    if (files.length === 0) {
      printInfo("No backups to clean.");
      return;
    }

    let success = 0;
    let failed = 0;

    for (const file of files) {
      const ts = dayjs(file.mtime).format("YYYY-MM-DDTHH:mm");
      try {
        unlinkSync(file.path);
        console.log(`  ${c.green}✔${c.reset} Deleted: ${file.name} ${c.dim}(${ts})${c.reset}`);
        success++;
      } catch (err) {
        console.log(`  ${c.red}✖${c.reset} Failed: ${file.name}`);
        failed++;
      }
    }

    if (failed === 0) {
      printSuccess(`Cleaned ${success} backup(s)`);
    } else {
      printError(`Cleaned ${success}, failed ${failed}`);
    }
    console.log();
  }
}

export default new CleanBackup();
