import { closeDatabase } from './src/shared/database';
import { Logger } from './src/shared/logging';
import { startServer, stopSessionCleanup } from './src/app/server';

const server = startServer();
let shuttingDown = false;
let shutdownFinalized = false;

async function finishShutdown(exitCode: number): Promise<void> {
  if (shutdownFinalized) return;
  shutdownFinalized = true;
  stopSessionCleanup();
  closeDatabase();
  process.exitCode = exitCode;
  try {
    await Logger.flush();
  } catch (error) {
    process.exitCode = 1;
    // stdout/stderr remains the last-resort channel when the logger itself
    // cannot flush during shutdown.
    console.error('Failed to flush logs during shutdown', error);
  }
}

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  Logger.info('Shutting down Nara', { signal });

  const forceTimer = setTimeout(() => {
    Logger.fatal('Graceful shutdown timed out', { signal });
    if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    void finishShutdown(1);
  }, 10_000);
  forceTimer.unref?.();

  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) Logger.error('HTTP server failed to close cleanly', error);
    void finishShutdown(error ? 1 : 0);
  });
}

server.once('error', (error) => {
  // In particular, listen failures such as EADDRINUSE are asynchronous.
  // Merely logging them used to let the process terminate successfully.
  shuttingDown = true;
  Logger.fatal('Nara failed after server startup', error);
  if (server.listening) {
    server.close(() => void finishShutdown(1));
  } else {
    void finishShutdown(1);
  }
});

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
