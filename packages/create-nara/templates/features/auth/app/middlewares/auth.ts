import type { NaraRequest, NaraResponse } from '@nara-web/core';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function authMiddleware(req: NaraRequest, res: NaraResponse, next: () => void) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    req.user = { id: decoded.userId, email: decoded.email, name: '' };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
