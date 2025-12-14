import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { db } from '../db';
import logger from '../utils/logger';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const workspaceSchema = Joi.object({
    name: Joi.string().required(),
});

// List workspaces
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            'SELECT * FROM workspaces WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user!.userId]
        );
        res.json(result.rows);
    } catch (err) {
        logger.error('Get workspaces error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create workspace
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = workspaceSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const result = await db.query(
            'INSERT INTO workspaces (user_id, name) VALUES ($1, $2) RETURNING *',
            [req.user!.userId, value.name]
        );

        res.json(result.rows[0]);
    } catch (err) {
        logger.error('Create workspace error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update workspace
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { error, value } = workspaceSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const result = await db.query(
            'UPDATE workspaces SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
            [value.name, req.params.id, req.user!.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Workspace not found or unauthorized' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        logger.error('Update workspace error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete workspace
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            'DELETE FROM workspaces WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user!.userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Workspace not found or unauthorized' });
        }

        // Also delete related OAuth tokens and tasks (Table CASCADE handles this ideally, but good to be aware)
        // PostgreSQL ON DELETE CASCADE on schema handles it.

        res.json({ success: true, message: 'Workspace deleted' });
    } catch (err) {
        logger.error('Delete workspace error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
