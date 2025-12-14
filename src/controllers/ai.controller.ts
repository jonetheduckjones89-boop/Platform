
import { Request, Response, Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { AIService } from '../services/ai.service';
import { db } from '../db';
import logger from '../utils/logger';

const router = Router();
const aiService = new AIService();

// Trigger Task
router.post('/task', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { workspaceId, type, payload } = req.body;

        // Verify workspace ownership
        const workspace = await db.query(
            'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
            [workspaceId, req.user!.userId]
        );

        if (workspace.rowCount === 0) {
            return res.status(403).json({ error: 'Unauthorized access to workspace' });
        }

        const task = await aiService.createTask(workspaceId, type, payload);
        res.json(task);
    } catch (err) {
        logger.error('Create task error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Task Result
router.get('/task/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            `SELECT t.* FROM tasks t
             JOIN workspaces w ON t.workspace_id = w.id
             WHERE t.id = $1 AND w.user_id = $2`,
            [req.params.id, req.user!.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        logger.error('Get task error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
