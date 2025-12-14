
import { Queue, Worker } from 'bullmq';
import config from '../config';
import { db } from '../db';
import logger from '../utils/logger';
import { decrypt } from '../utils/encryption';
import OpenAI from 'openai';
import { Client as NotionClient } from '@notionhq/client';
import axios from 'axios';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: config.ai.openai,
});

// Task Queue
const taskQueue = new Queue('ai-tasks', {
    connection: {
        url: config.redis.url
    }
});

export class AIService {
    constructor() {
        // Start worker
        // In a real app, you might run workers in a separate process
        this.startWorker();
    }

    async createTask(workspaceId: string, type: string, payload: any) {
        // Create DB entry
        const result = await db.query(
            'INSERT INTO tasks (workspace_id, type, payload, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [workspaceId, type, payload, 'pending']
        );
        const task = result.rows[0];

        // Add to Queue
        await taskQueue.add('process-task', { taskId: task.id, workspaceId, type, payload });

        return task;
    }

    private startWorker() {
        const worker = new Worker('ai-tasks', async job => {
            const { taskId, workspaceId, type, payload } = job.data;

            logger.info('Processing task', { taskId, type });

            await db.query('UPDATE tasks SET status = $1 WHERE id = $2', ['processing', taskId]);

            try {
                // Fetch tokens
                const tokensRes = await db.query(
                    'SELECT provider, access_token FROM oauth_tokens WHERE workspace_id = $1',
                    [workspaceId]
                );

                const tokens: Record<string, string> = {};
                tokensRes.rows.forEach(row => {
                    tokens[row.provider] = decrypt(row.access_token);
                });

                let contextData = '';

                // Fetch context based on task type
                // This is a simplified logic. In real world, we would have detailed logic per type.
                if (type === 'gmail_read' && tokens['google']) {
                    // Fetch recent emails
                    const gmailRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
                        headers: { Authorization: `Bearer ${tokens['google']}` }
                    });
                    contextData = JSON.stringify(gmailRes.data);
                } else if (type === 'notion_sync' && tokens['notion']) {
                    const notion = new NotionClient({ auth: tokens['notion'] });
                    const users = await notion.users.list({});
                    contextData = JSON.stringify(users);
                }

                // Call OpenAI
                const completion = await openai.chat.completions.create({
                    model: config.ai.model || 'gpt-4.1-mini', // Fallback if model not set correctly. Note: gpt-4.1-mini might not exist, using user provided model name or gpt-4o-mini
                    messages: [
                        { role: 'system', content: 'You are an AI assistant processing a task.' },
                        { role: 'user', content: `Task: ${type}\nPayload: ${JSON.stringify(payload)}\nContext Data: ${contextData}` }
                    ],
                    temperature: config.ai.temperature,
                });

                const result = completion.choices[0].message.content;

                // Update task
                await db.query(
                    'UPDATE tasks SET status = $1, result = $2, updated_at = NOW() WHERE id = $3',
                    ['done', JSON.stringify({ result }), taskId]
                );

                logger.info('Task completed', { taskId });

            } catch (error: any) {
                logger.error('Task failed', { taskId, error: error.message });
                await db.query(
                    'UPDATE tasks SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3',
                    ['error', error.message, taskId]
                );
            }

        }, {
            connection: {
                url: config.redis.url
            }
        });

        worker.on('error', err => logger.error('Worker error', { error: err }));
    }
}
