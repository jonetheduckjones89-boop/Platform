
import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { db } from '../db';
import logger from '../utils/logger';

const router = Router();

// Validation schema
const submissionSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    website: Joi.string().uri().allow('').optional(),
});

// POST /landing/submit
router.post('/submit', async (req: Request, res: Response) => {
    try {
        const { error, value } = submissionSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { name, email, website } = value;

        await db.query(
            'INSERT INTO landing_page_submissions (name, email, website) VALUES ($1, $2, $3)',
            [name, email, website]
        );

        logger.info('New landing page submission', { email });

        res.json({ success: true, message: 'Submission received' });
    } catch (err) {
        logger.error('Landing submission error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /landing/submissions (Admin only - basic protection for now)
router.get('/submissions', async (req: Request, res: Response) => {
    try {
        // TODO: Add admin auth middleware
        const result = await db.query('SELECT * FROM landing_page_submissions ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        logger.error('Get submissions error', { error: err });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
