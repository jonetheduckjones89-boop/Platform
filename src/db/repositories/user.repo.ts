import { db } from '../index';
import bcrypt from 'bcryptjs';

export interface User {
    id: string;
    name: string;
    email: string;
    website?: string;
    password_hash?: string;
    created_at: Date;
    updated_at: Date;
}

export async function createUser(data: {
    name: string;
    email: string;
    password?: string;
    website?: string;
}): Promise<User> {
    const password_hash = data.password ? await bcrypt.hash(data.password, 10) : null;

    const result = await db.query<User>(
        `INSERT INTO users (name, email, password_hash, website)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, website, created_at, updated_at`,
        [
            data.name,
            data.email.toLowerCase(),
            password_hash,
            data.website || null,
        ]
    );

    return result.rows[0];
}

export async function getUserById(id: string): Promise<User | null> {
    const result = await db.query<User>(
        `SELECT id, name, email, website, created_at, updated_at
     FROM users WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const result = await db.query<User>(
        `SELECT * FROM users WHERE email = $1`,
        [email.toLowerCase()]
    );
    return result.rows[0] || null;
}

export async function verifyUserPassword(email: string, password: string): Promise<User | null> {
    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
        return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        return null;
    }

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
}

export async function updateUser(id: string, data: Partial<User>): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
    }
    if (data.website !== undefined) {
        updates.push(`website = $${paramIndex++}`);
        values.push(data.website);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query<User>(
        `UPDATE users SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, name, email, website, created_at, updated_at`,
        values
    );

    return result.rows[0];
}

export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
    const password_hash = await bcrypt.hash(newPassword, 10);
    await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [password_hash, userId]
    );
}

