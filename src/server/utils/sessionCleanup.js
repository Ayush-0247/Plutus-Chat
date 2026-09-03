import { cleanupExpiredSessions } from '../services/sessionService.js';

let cleanupInterval = null;

/**
 * Initializes automatic background session cleanup.
 */
export function initSessionCleanup() {
    // Run immediate startup cleanup
    runCleanup();

    // Run periodic cleanup every 10 minutes
    if (!cleanupInterval) {
        cleanupInterval = setInterval(() => {
            runCleanup();
        }, 10 * 60 * 1000);
    }
}

export async function runCleanup() {
    try {
        // Cleanup expired sessions in DB
        await cleanupExpiredSessions();
    } catch (error) {
        console.error('[Cleanup] Error during automated cleanup:', error.message);
    }
}
