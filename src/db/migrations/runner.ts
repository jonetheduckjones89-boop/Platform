import fs from 'fs';
import path from 'path';
import { db } from '../index';
import logger from '../../utils/logger';

interface Migration {
    filename: string;
    sql: string;
}

async function runMigrations() {
    try {
        // Create migrations table if not exists
        await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // Get executed migrations
        const executedResult = await db.query('SELECT filename FROM migrations');
        const executed = new Set(executedResult.rows.map(r => r.filename));

        // Read migration files
        const migrationsDir = __dirname;
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        const migrations: Migration[] = files.map(filename => ({
            filename,
            sql: fs.readFileSync(path.join(migrationsDir, filename), 'utf-8'),
        }));

        // Run pending migrations
        for (const migration of migrations) {
            if (executed.has(migration.filename)) {
                logger.info(`Migration ${migration.filename} already executed`);
                continue;
            }

            logger.info(`Running migration: ${migration.filename}`);

            await db.transaction(async (client) => {
                await client.query(migration.sql);
                await client.query(
                    'INSERT INTO migrations (filename) VALUES ($1)',
                    [migration.filename]
                );
            });

            logger.info(`Migration ${migration.filename} completed`);
        }

        logger.info('All migrations completed successfully');
    } catch (error) {
        logger.error('Migration failed', { error });
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

export default runMigrations;
