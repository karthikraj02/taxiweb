require('dotenv').config();
const http = require('http');
const env = require('./config/env');
const logger = require('./utils/logger');
const connectDB = require('./config/db');
const createApp = require('./app');
const { initSocket } = require('./socket');

/**
 * Process entry point.
 *
 * Note the ordering: the database must be reachable BEFORE the server accepts
 * traffic. The previous implementation logged "App will continue without DB"
 * and started listening anyway, so the service answered health checks while
 * every real request failed.
 */
async function start() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);

  server.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port}`, {
      env: env.nodeEnv,
      demoMode: env.demoMode,
      routingProvider: env.routing.provider,
      paymentsConfigured: env.razorpay.enabled,
    });
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down`);
    server.close(() => {
      require('mongoose').connection.close(false).then(() => process.exit(0));
    });
    // Do not hang forever on in-flight sockets.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
