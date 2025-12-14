import app from './app';
import config from './config';
import logger from './utils/logger';
import { db } from './db';

async function startServer() {
    try {
        // Test database connection
        const dbHealthy = await db.healthCheck();
        if (!dbHealthy) {
            throw new Error('Database connection failed');
        }
        logger.info('Database connection established');

        // Start HTTP server
        const server = app.listen(config.port, () => {
            logger.info(`🚀 Cleo Backend running on port ${config.port}`, {
                environment: config.env,
                port: config.port,
            });
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`${signal} received, shutting down gracefully...`);

            server.close(async () => {
                logger.info('HTTP server closed');

                try {
                    await db.close();
                    logger.info('Database connections closed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown', { error });
                    process.exit(1);
                }
            });

            // Force shutdown after 30 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error('Failed to start server', { error });
        process.exit(1);
    }
}

startServer();
