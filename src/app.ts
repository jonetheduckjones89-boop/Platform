import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from './utils/logger';

// Controllers
import landingController from './controllers/landing.controller';
import authController from './controllers/auth.controller';
import workspaceController from './controllers/workspace.controller';
import oauthController from './controllers/oauth.controller';
import aiController from './controllers/ai.controller';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
    origin: config.env === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : '*',
    credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.env === 'production' ? 100 : 1000,
    message: 'Too many requests from this IP',
});

app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.http(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// Health check
app.get('/health', async (req: Request, res: Response) => {
    const { db } = await import('./db');
    const dbHealthy = await db.healthCheck();

    res.json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.env,
    });
});

// API Routes
// API Routes
app.use('/api/landing', landingController);
app.use('/api/auth', authController);
app.use('/api/workspaces', workspaceController);
app.use('/api/oauth', oauthController);
app.use('/api/ai', aiController);

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
    });

    res.status(500).json({
        error: config.env === 'production'
            ? 'Internal server error'
            : err.message
    });
});

export default app;
