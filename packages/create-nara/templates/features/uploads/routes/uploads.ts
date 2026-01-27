import type { NaraApp } from '@nara-web/core';
import { UploadController } from '../app/controllers/UploadController.js';

export function registerUploadRoutes(app: NaraApp) {
  const upload = new UploadController();

  app.post('/api/uploads', (req, res) => upload.upload(req, res));
  app.delete('/api/uploads/:filename', (req, res) => upload.delete(req, res));
}
