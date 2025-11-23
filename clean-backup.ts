import dayjs from "dayjs";
import { join } from "path";
import { existsSync, readdirSync, statSync, unlinkSync } from "fs";

require("dotenv").config();

// Konfigurasi retensi di file (default 30 hari). Bisa dioverride via env BACKUP_RETENTION_DAYS.
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);

async function main() {
  const backupsDir = join(__dirname, 'backups');
  
  if (!existsSync(backupsDir)) {
    console.log("Backup directory tidak ditemukan.");
    return;
  }

  const now = Date.now();
  const thresholdMs = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const thresholdStr = dayjs(thresholdMs).format("YYYY-MM-DDTHH:mm");

  console.log(`Menjalankan clean-backup: hapus backup sebelum ${thresholdStr} (>${RETENTION_DAYS} hari)`);

  // Ambil daftar file backup yang lebih tua dari threshold
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
    console.log("Tidak ada backup yang perlu dihapus.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const ts = dayjs(file.mtime).format("YYYY-MM-DDTHH:mm");
    try {
      unlinkSync(file.path);
      console.log(`Berhasil menghapus backup: ${file.name} (created: ${ts})`);
      success++;
    } catch (err) {
      console.error(`Gagal menghapus backup ${file.name}:`, err);
      failed++;
    }
  }

  console.log(`Clean-backup selesai. Berhasil: ${success}, Gagal: ${failed}`);
}

main().catch((err) => {
  console.error("Clean-backup gagal:", err);
  process.exit(1);
});