import crypto from 'crypto';

// In-memory authentication session registry for notification channels
// Key: session token (string), Value: Session Object
const notificationSessions = new Map();

// Map email to Set of active session tokens for fast bulk invalidation
const userSessionIndex = new Map();

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
const MAX_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours max lifetime

/**
 * Creates a new authenticated server session for a notification user.
 * @param {string} email
 * @returns {Object} Session metadata and token
 */
export function createNotificationSession(email) {
  const normEmail = email.trim().toLowerCase();
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const session = {
    token,
    email: normEmail,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + IDLE_TIMEOUT_MS,
  };

  notificationSessions.set(token, session);

  let userTokens = userSessionIndex.get(normEmail);
  if (!userTokens) {
    userTokens = new Set();
    userSessionIndex.set(normEmail, userTokens);
  }
  userTokens.add(token);

  return {
    token,
    email: normEmail,
    expiresInMs: IDLE_TIMEOUT_MS,
  };
}

/**
 * Validates a session token and refreshes idle timer if valid.
 * @param {string} token
 * @returns {{ valid: boolean, email?: string, error?: string }}
 */
export function verifyNotificationSession(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Session token required.' };
  }

  const session = notificationSessions.get(token);
  if (!session) {
    return { valid: false, error: 'Invalid or expired session. Please authenticate again.' };
  }

  const now = Date.now();

  // Check absolute max lifetime
  if (now - session.createdAt > MAX_LIFETIME_MS) {
    destroyNotificationSession(token);
    return { valid: false, error: 'Session lifetime exceeded. Please log in again.' };
  }

  // Check idle timeout
  if (now - session.lastActivityAt > IDLE_TIMEOUT_MS) {
    destroyNotificationSession(token);
    return { valid: false, error: 'Session expired due to inactivity. Please log in again.' };
  }

  // Refresh idle activity timestamp
  session.lastActivityAt = now;
  session.expiresAt = now + IDLE_TIMEOUT_MS;

  return {
    valid: true,
    email: session.email,
  };
}

/**
 * Destroys a single session token (logout).
 * @param {string} token
 */
export function destroyNotificationSession(token) {
  if (!token) return;
  const session = notificationSessions.get(token);
  if (session) {
    const userTokens = userSessionIndex.get(session.email);
    if (userTokens) {
      userTokens.delete(token);
      if (userTokens.size === 0) {
        userSessionIndex.delete(session.email);
      }
    }
    notificationSessions.delete(token);
  }
}

/**
 * Destroys all sessions for an email (used on account wipe or passkey change).
 * @param {string} email
 */
export function destroyAllUserSessions(email) {
  const normEmail = email.trim().toLowerCase();
  const tokens = userSessionIndex.get(normEmail);
  if (tokens) {
    for (const t of tokens) {
      notificationSessions.delete(t);
    }
    userSessionIndex.delete(normEmail);
  }
}

// Periodic cleanup every 5 minutes for expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of notificationSessions.entries()) {
    if (now - session.lastActivityAt > IDLE_TIMEOUT_MS || now - session.createdAt > MAX_LIFETIME_MS) {
      destroyNotificationSession(token);
    }
  }
}, 5 * 60 * 1000);
