import { cleanupExpiredSessions } from '../services/sessionService.js';

let cleanupInterval = null;

/**
 * Initializes automatic background session cleanup.
 */
export function initSessionCleanup(ephemeralFilesMap, sessionsMap) {
    // Run immediate startup cleanup
    runCleanup(ephemeralFilesMap, sessionsMap);

    // Run periodic cleanup every 10 minutes
    if (!cleanupInterval) {
        cleanupInterval = setInterval(() => {
            runCleanup(ephemeralFilesMap, sessionsMap);
        }, 10 * 60 * 1000);
    }
}

export async function runCleanup(ephemeralFilesMap, sessionsMap) {
    try {
        // 1. Cleanup expired sessions in DB
        await cleanupExpiredSessions();

        // 2. Cleanup orphaned ephemeral files in RAM
        if (ephemeralFilesMap && sessionsMap) {
            const now = Date.now();
            const MAX_FILE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

            for (const [fileId, fileData] of ephemeralFilesMap) {
                const session = sessionsMap.get(fileData.sessionId);
                const isStale = now - fileData.uploadedAt > MAX_FILE_AGE_MS;

                if (!session || session.status === 'DESTROYED' || isStale) {
                    ephemeralFilesMap.delete(fileId);
                }
            }
        }
    } catch (error) {
        console.error('[Cleanup] Error during automated cleanup:', error.message);
    }
}
