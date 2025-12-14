import { Pool, PoolClient, QueryResult } from 'pg';
import config from '../config';
import logger from '../utils/logger';

class Database {
    private pool: Pool;

    constructor() {
        this.pool = new Pool({
            connectionString: config.database.url,
            ssl: config.env === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('connect', () => {
            logger.debug('Database connection established');
        });

        this.pool.on('error', (err) => {
            logger.error('Unexpected database error', { error: err.message });
        });
    }

    async query<T extends import('pg').QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const start = Date.now();
        try {
            const result = await this.pool.query<T>(text, params);
            const duration = Date.now() - start;

            if (duration > 1000) {
                logger.warn('Slow query detected', {
                    query: text.substring(0, 100),
                    duration
                });
            }

            return result;
        } catch (error) {
            logger.error('Database query error', {
                query: text.substring(0, 100),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }

    async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.getClient();

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        logger.info('Database pool closed');
    }
}

export const db = new Database();
export default db;
