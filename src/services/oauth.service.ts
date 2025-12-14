
import { google } from 'googleapis';
import axios from 'axios';
import config from '../config';
import { db } from '../db';
import { encrypt } from '../utils/encryption';
import logger from '../utils/logger';

export class OAuthService {
    async getAuthUrl(provider: 'google' | 'notion' | 'zoom', workspaceId: string): Promise<string> {
        const state = workspaceId; // Simple state for now

        switch (provider) {
            case 'google':
                const oauth2Client = new google.auth.OAuth2(
                    config.oauth.google.clientId,
                    config.oauth.google.clientSecret,
                    config.oauth.google.redirectUri
                );
                return oauth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: [
                        'https://www.googleapis.com/auth/userinfo.email',
                        'https://www.googleapis.com/auth/userinfo.profile',
                        'https://www.googleapis.com/auth/drive.file',
                        'https://www.googleapis.com/auth/drive.readonly',
                        'https://www.googleapis.com/auth/gmail.readonly',
                        'https://www.googleapis.com/auth/gmail.send'
                    ],
                    state
                });

            case 'notion':
                return `https://api.notion.com/v1/oauth/authorize?client_id=${config.oauth.notion.clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(config.oauth.notion.redirectUri)}&state=${state}`;

            case 'zoom':
                return `https://zoom.us/oauth/authorize?response_type=code&client_id=${config.oauth.zoom.clientId}&redirect_uri=${encodeURIComponent(config.oauth.zoom.redirectUri)}&state=${state}`;

            default:
                throw new Error('Invalid provider');
        }
    }

    async handleCallback(provider: 'google' | 'notion' | 'zoom', code: string, workspaceId: string) {
        let accessToken = '';
        let refreshToken = '';
        let expiresAt: Date | null = null; // approximate

        try {
            switch (provider) {
                case 'google':
                    const oauth2Client = new google.auth.OAuth2(
                        config.oauth.google.clientId,
                        config.oauth.google.clientSecret,
                        config.oauth.google.redirectUri
                    );
                    const { tokens } = await oauth2Client.getToken(code);
                    accessToken = tokens.access_token!;
                    refreshToken = tokens.refresh_token || ''; // Google only sends refresh token on first consent
                    if (tokens.expiry_date) {
                        expiresAt = new Date(tokens.expiry_date);
                    }
                    break;

                case 'notion':
                    const encoded = Buffer.from(`${config.oauth.notion.clientId}:${config.oauth.notion.clientSecret}`).toString('base64');
                    const notionRes = await axios.post('https://api.notion.com/v1/oauth/token', {
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: config.oauth.notion.redirectUri
                    }, {
                        headers: {
                            'Authorization': `Basic ${encoded}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    accessToken = notionRes.data.access_token;
                    // Notion access tokens don't expire usually, no refresh token in same way
                    break;

                case 'zoom':
                    const zoomParams = new URLSearchParams();
                    zoomParams.append('grant_type', 'authorization_code');
                    zoomParams.append('code', code);
                    zoomParams.append('redirect_uri', config.oauth.zoom.redirectUri);

                    const zoomRes = await axios.post('https://zoom.us/oauth/token', zoomParams, {
                        headers: {
                            'Authorization': `Basic ${Buffer.from(`${config.oauth.zoom.clientId}:${config.oauth.zoom.clientSecret}`).toString('base64')}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    });
                    accessToken = zoomRes.data.access_token;
                    refreshToken = zoomRes.data.refresh_token;
                    // expires_in is seconds
                    if (zoomRes.data.expires_in) {
                        expiresAt = new Date(Date.now() + zoomRes.data.expires_in * 1000);
                    }
                    break;
            }

            // Encrypt tokens
            const encryptedAccess = encrypt(accessToken);
            const encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;

            // Save to DB
            await db.query(`
                INSERT INTO oauth_tokens (workspace_id, provider, access_token, refresh_token, expires_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (workspace_id, provider) 
                DO UPDATE SET 
                    access_token = EXCLUDED.access_token,
                    refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
                    expires_at = EXCLUDED.expires_at,
                    updated_at = NOW()
            `, [workspaceId, provider, encryptedAccess, encryptedRefresh, expiresAt]);

            logger.info('OAuth token saved', { workspaceId, provider });

        } catch (error: any) {
            logger.error('OAuth token exchange failed', { provider, error: error.message || error });
            throw error;
        }
    }
}
