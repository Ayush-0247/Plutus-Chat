import { Session } from '../models/Session.js';
import { SessionBan } from '../models/SessionBan.js';
import { isDatabaseConnected } from '../config/database.js';

// Fallback in-memory metadata store when database is detached or in local test mode
const inMemorySessionMeta = new Map();
const inMemorySessionBans = new Set(); // format: `${sessionId}:${participantId}`

/**
 * Creates a persistent session metadata record.
 * Storing only: sessionId, ownerParticipantId, passkeyHash, status, createdAt, expiresAt, endingReason.
 */
export async function createSessionRecord({
    sessionId,
    ownerParticipantId,
    passkeyHash,
    expiresAt = null,
    status = 'ACTIVE',
}) {
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            const doc = await Session.create({
                sessionId: normId,
                ownerParticipantId,
                passkeyHash,
                status,
                expiresAt,
                createdAt: new Date(),
                endingReason: null,
            });
            return doc.toObject();
        } catch (error) {
            console.error('[SessionService] Database write error:', error.message);
            // Fallback to memory if DB write encountered unexpected error
        }
    }

    // Fallback storage
    const record = {
        sessionId: normId,
        ownerParticipantId,
        passkeyHash,
        status,
        createdAt: new Date(),
        expiresAt,
        endingReason: null,
    };
    inMemorySessionMeta.set(normId, record);
    return record;
}

/**
 * Authoritative check if session ID is already taken.
 */
export async function isSessionIdTaken(sessionId) {
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            const exists = await Session.exists({ sessionId: normId });
            if (exists) return true;
        } catch (error) {
            console.error('[SessionService] Database lookup error:', error.message);
        }
    }

    return inMemorySessionMeta.has(normId);
}

/**
 * Finds persistent session metadata by session ID.
 */
export async function findSessionRecord(sessionId) {
    if (!sessionId) return null;
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            const doc = await Session.findOne({ sessionId: normId }).lean();
            if (doc) return doc;
        } catch (error) {
            console.error('[SessionService] Database lookup error:', error.message);
        }
    }

    return inMemorySessionMeta.get(normId) || null;
}

/**
 * Updates session status in the database (e.g., ACTIVE -> ENDING -> DESTROYED).
 */
export async function updateSessionStatus(sessionId, status, endingReason = null) {
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            await Session.updateOne(
                { sessionId: normId },
                { $set: { status, endingReason } }
            );
        } catch (error) {
            console.error('[SessionService] Database status update error:', error.message);
        }
    }

    const mem = inMemorySessionMeta.get(normId);
    if (mem) {
        mem.status = status;
        mem.endingReason = endingReason;
    }
}

/**
 * Deletes persistent session metadata and associated ban records upon hard destruction.
 * Implements PRD Section 40: "Once a session is destroyed, its persistent session metadata should also be deleted."
 */
export async function deleteSessionRecord(sessionId) {
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            await Promise.all([
                Session.deleteOne({ sessionId: normId }),
                SessionBan.deleteMany({ sessionId: normId }),
            ]);
        } catch (error) {
            console.error('[SessionService] Database deletion error:', error.message);
        }
    }

    inMemorySessionMeta.delete(normId);
    for (const key of Array.from(inMemorySessionBans)) {
        if (key.startsWith(`${normId}:`)) {
            inMemorySessionBans.delete(key);
        }
    }
}

/**
 * Records a session-specific ban.
 */
export async function addSessionBan(sessionId, participantId) {
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            await SessionBan.updateOne(
                { sessionId: normId, participantId },
                { $setOnInsert: { sessionId: normId, participantId, bannedAt: new Date() } },
                { upsert: true }
            );
        } catch (error) {
            console.error('[SessionService] Database ban update error:', error.message);
        }
    }

    inMemorySessionBans.add(`${normId}:${participantId}`);
}

/**
 * Checks if a participant is banned from this session.
 */
export async function isParticipantBanned(sessionId, participantId) {
    const normId = sessionId.toUpperCase();

    if (isDatabaseConnected()) {
        try {
            const isBanned = await SessionBan.exists({ sessionId: normId, participantId });
            if (isBanned) return true;
        } catch (error) {
            console.error('[SessionService] Database ban lookup error:', error.message);
        }
    }

    return inMemorySessionBans.has(`${normId}:${participantId}`);
}

/**
 * Cleans up expired sessions.
 */
export async function cleanupExpiredSessions() {
    const now = new Date();

    if (isDatabaseConnected()) {
        try {
            const expiredSessions = await Session.find({
                $or: [
                    { status: 'DESTROYED' },
                    { expiresAt: { $ne: null, $lt: now } },
                ],
            }).select('sessionId').lean();

            for (const s of expiredSessions) {
                await deleteSessionRecord(s.sessionId);
            }
        } catch (error) {
            console.error('[SessionService] Database cleanup error:', error.message);
        }
    }

    for (const [id, s] of inMemorySessionMeta) {
        if (s.status === 'DESTROYED' || (s.expiresAt && new Date(s.expiresAt) < now)) {
            inMemorySessionMeta.delete(id);
        }
    }
}
