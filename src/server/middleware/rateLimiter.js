// In-memory sliding window rate limiter for security-critical endpoints

const ipRequestCounts = new Map();
const failedAuthAttempts = new Map();

const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Checks if an identifier (IP or email) is locked out from too many failed attempts
 */
export function isAuthLockedOut(identifier) {
  const record = failedAuthAttempts.get(identifier);
  if (!record) return false;

  const now = Date.now();
  if (now - record.firstFailedAt > FAILED_ATTEMPT_LOCKOUT_MS) {
    failedAuthAttempts.delete(identifier);
    return false;
  }

  return record.count >= MAX_FAILED_ATTEMPTS;
}

/**
 * Records a failed authentication attempt
 */
export function recordFailedAuth(identifier) {
  const now = Date.now();
  const record = failedAuthAttempts.get(identifier) || { count: 0, firstFailedAt: now };

  if (now - record.firstFailedAt > FAILED_ATTEMPT_LOCKOUT_MS) {
    record.count = 1;
    record.firstFailedAt = now;
  } else {
    record.count += 1;
  }

  failedAuthAttempts.set(identifier, record);
}

/**
 * Clears failed attempts upon successful authentication
 */
export function clearFailedAuth(identifier) {
  failedAuthAttempts.delete(identifier);
}

/**
 * Creates a rate-limiting middleware
 * @param {number} maxRequests Maximum allowed requests within window
 * @param {number} windowMs Window duration in milliseconds
 * @param {string} message Custom error message when limit exceeded
 */
export function createRateLimiter({ maxRequests = 30, windowMs = 60 * 1000, message = 'Too many requests. Please try again later.' }) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${req.baseUrl || req.path}`;

    let record = ipRequestCounts.get(key);
    if (!record) {
      record = [];
      ipRequestCounts.set(key, record);
    }

    // Filter out timestamps older than the window
    const recent = record.filter((timestamp) => now - timestamp < windowMs);
    recent.push(now);
    ipRequestCounts.set(key, recent);

    if (recent.length > maxRequests) {
      return res.status(429).json({
        success: false,
        error: message,
      });
    }

    next();
  };
}

// Periodic cleanup of stale rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of ipRequestCounts.entries()) {
    const active = timestamps.filter((t) => now - t < 5 * 60 * 1000);
    if (active.length === 0) {
      ipRequestCounts.delete(key);
    } else {
      ipRequestCounts.set(key, active);
    }
  }
}, 5 * 60 * 1000);
