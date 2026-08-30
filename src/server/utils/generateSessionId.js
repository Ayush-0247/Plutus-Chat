import crypto from 'crypto';

export function generateSessionId() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let id = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        id += chars[bytes[i] % chars.length];
    }
    return id;
}
