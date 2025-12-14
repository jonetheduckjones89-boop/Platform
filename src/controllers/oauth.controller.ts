
import { Request, Response, Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { OAuthService } from '../services/oauth.service';
import logger from '../utils/logger';

const router = Router();
const oauthService = new OAuthService();

// Get Auth URL
router.get('/:provider', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { provider } = req.params;
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: 'Workspace ID is required' });
        }

        const url = await oauthService.getAuthUrl(provider as any, workspaceId as string);
        res.json({ url });
    } catch (err) {
        logger.error('OAuth URL error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Callback
router.get('/:provider/callback', async (req: Request, res: Response) => {
    try {
        const { provider } = req.params;
        const { code, state } = req.query; // state should contain workspaceId

        if (!code || !state) {
            return res.status(400).json({ error: 'Missing code or state' });
        }

        // Decode state to get workspaceId (assuming state = workspaceId for simplicity, or JSON)
        // In production, sign state to prevent CSRF
        const workspaceId = state as string;

        await oauthService.handleCallback(provider as any, code as string, workspaceId);

        // Redirect to frontend
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?status=success&provider=${provider}`);
    } catch (err) {
        logger.error('OAuth callback error', { error: err });
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?status=error&message=oauth_failed`);
    }
});

export default router;
