
import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { getUserByEmail, verifyUserPassword, createUser } from '../db/repositories/user.repo';
import { generateTokenPair, verifyRefreshToken, revokeRefreshToken } from '../services/auth.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const router = Router();

// Login
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { error, value } = loginSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const user = await verifyUserPassword(value.email, value.password);

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const tokens = await generateTokenPair({
            userId: user.id,
            email: user.email,
        });

        res.json({
            success: true,
            user,
            tokens,
        });
    } catch (error) {
        logger.error('Login error', { error });
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register
const registerSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    website: Joi.string().uri().allow('').optional(),
});

router.post('/register', async (req: Request, res: Response) => {
    try {
        const { error, value } = registerSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const existingUser = await getUserByEmail(value.email);
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const user = await createUser({
            name: value.name,
            email: value.email,
            password: value.password,
            website: value.website
        });

        const tokens = await generateTokenPair({
            userId: user.id,
            email: user.email,
        });

        res.json({
            success: true,
            user,
            tokens,
        });
    } catch (error) {
        logger.error('Register error', { error });
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

        const payload = await verifyRefreshToken(refresh_token);

        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        // Revoke old token
        await revokeRefreshToken(refresh_token);

        // Generate new tokens
        const tokens = await generateTokenPair(payload);

        res.json({
            success: true,
            tokens,
        });
    } catch (error) {
        logger.error('Token refresh error', { error });
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const refreshToken = req.body.refresh_token;

        if (refreshToken) {
            await revokeRefreshToken(refreshToken);
        }

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        logger.error('Logout error', { error });
        res.status(500).json({ error: 'Logout failed' });
    }
});

// Me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    res.json(req.user);
});

export default router;
