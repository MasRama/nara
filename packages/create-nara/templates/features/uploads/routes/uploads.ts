import type { NaraApp } from '@nara-web/core';
import { UploadController } from '../app/controllers/UploadController.js';

export function registerUploadRoutes(app: NaraApp) {
  const upload = new UploadController();

  app.post('/api/uploads', async (req, res) => {
    await upload.upload(req, res);
  });
  app.delete('/api/uploads/:filename', async (req, res) => {
    await upload.delete(req, res);
  });
}
