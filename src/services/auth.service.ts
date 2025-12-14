import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { db } from '../db';
import logger from '../utils/logger';

export interface TokenPayload {
    userId: string;
    email: string;
}

export interface Tokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}

export function generateAccessToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload }, config.jwt.secret as any, {
        expiresIn: config.jwt.expiresIn as any,
    });
}

export function generateRefreshToken(): string {
    return uuidv4();
}

export async function generateTokenPair(payload: TokenPayload): Promise<Tokens> {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days as per env

    await db.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
        [payload.userId, refreshToken, expiresAt]
    );

    return {
        accessToken,
        refreshToken,
        expiresIn: config.jwt.expiresIn,
    };
}

export function verifyAccessToken(token: string): TokenPayload | null {
    try {
        const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;
        return decoded;
    } catch (error) {
        // logger.debug('Access token verification failed', { error });
        return null;
    }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
    try {
        const result = await db.query(
            `SELECT rt.*, u.email
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 
         AND rt.revoked_at IS NULL 
         AND rt.expires_at > NOW()`,
            [token]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            userId: row.user_id,
            email: row.email,
        };
    } catch (error) {
        logger.error('Refresh token verification failed', { error });
        return null;
    }
}

export async function revokeRefreshToken(token: string): Promise<void> {
    await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1',
        [token]
    );
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
    await db.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
    );
}

