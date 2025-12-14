
import crypto from 'crypto';
import config from '../config';

const ALGORITHM = 'aes-256-cbc';
// Ensure key is 32 bytes. If config.encryption.key is string, we might need to handle it.
// Assuming the user provides a 32-char string which satisfies 32 bytes if ascii, or hex.
// Safe way: use crypto.scryptSync or just Buffer.from if it's hex.
// The user said "32_character_secret_key_here", which implies raw string of length 32 = 32 bytes (utf8).
// We'll use Buffer.from(key) and ensure it's 32 bytes.

const KEY = Buffer.from(config.encryption.key);
const IV_LENGTH = 16;

export function encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        // If decryption fails, return original text or throw
        return text;
    }
}
