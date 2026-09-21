import express from 'express';
import {
  registerNotificationUser,
  setChannelStatus,
  sendNotificationMessage,
  getReceivedMessages,
  getMessageById,
  deleteMessage,
  deleteNotificationAccount,
  findUserByEmail,
  verifyPasskey,
  authenticateUser,
  normalizeEmail,
} from '../services/notificationService.js';
import {
  createNotificationSession,
  verifyNotificationSession,
  destroyNotificationSession,
} from '../services/notificationSessionService.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Helper to extract session token from Authorization Bearer, custom header, or cookie
function extractSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-notification-token']) {
    return String(req.headers['x-notification-token']).trim();
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/notification_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]).trim();
  }
  return null;
}

// Middleware to resolve session token if present
function resolveSession(req, res, next) {
  const token = extractSessionToken(req);
  if (token) {
    const sessionRes = verifyNotificationSession(token);
    if (sessionRes.valid && sessionRes.email) {
      req.sessionEmail = sessionRes.email;
      req.sessionToken = token;
    }
  }
  next();
}

router.use(resolveSession);

// Rate limiters
const authLimiter = createRateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
  message: 'Too many authentication attempts. Please wait a moment before trying again.',
});

const sendLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000,
  message: 'Sending rate limit reached. Please slow down.',
});

const registerLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
  message: 'Too many registration attempts from this IP. Please try again later.',
});

/**
 * Session Authentication: Login (Addendum #6)
 * POST /api/notifications/auth/login
 */
router.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    if (!email || !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Email and passkey are required.',
      });
    }

    const normEmail = normalizeEmail(email);
    const user = await authenticateUser(normEmail, passkey);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed. Please verify your email and passkey.',
      });
    }

    const session = createNotificationSession(normEmail);

    // Set secure HttpOnly cookie
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader(
      'Set-Cookie',
      `notification_session=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}; Max-Age=1800`
    );

    return res.json({
      success: true,
      email: normEmail,
      channelEnabled: Boolean(user.channelEnabled),
      token: session.token,
      expiresInMs: session.expiresInMs,
      message: 'Authenticated successfully.',
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Authentication failed.',
    });
  }
});

/**
 * Session Authentication: Verify active session (Addendum #6 & #7)
 * GET /api/notifications/auth/session
 */
router.get('/auth/session', async (req, res) => {
  if (!req.sessionEmail) {
    return res.json({
      success: true,
      authenticated: false,
    });
  }

  const user = await findUserByEmail(req.sessionEmail);
  if (!user) {
    return res.json({
      success: true,
      authenticated: false,
    });
  }

  return res.json({
    success: true,
    authenticated: true,
    email: user.email,
    channelEnabled: Boolean(user.channelEnabled),
  });
});

/**
 * Session Authentication: Logout (Addendum #6)
 * POST /api/notifications/auth/logout
 */
router.post('/auth/logout', async (req, res) => {
  if (req.sessionToken) {
    destroyNotificationSession(req.sessionToken);
  }
  res.setHeader('Set-Cookie', 'notification_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
});

/**
 * 1. Register User (PRD Section 28)
 * POST /api/notifications/register
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    if (!email || !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Email and passkey are required.',
      });
    }

    const result = await registerNotificationUser({ email, passkey });
    return res.status(201).json({
      success: true,
      message: 'Notification account created. You can now create/enable your Text Channel.',
      email: result.email,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Registration failed.',
    });
  }
});

/**
 * 2. Create / Enable Text Channel (PRD Section 29, Addendum #6)
 * POST /api/notifications/channel/create
 */
router.post('/channel/create', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const effectiveEmail = req.sessionEmail || email;

    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Authentication or registered email required.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Passkey is required when not authenticated with an active session.',
      });
    }

    let user;
    if (req.sessionEmail) {
      user = await findUserByEmail(req.sessionEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: 'User session not found.' });
      }
      const updated = await setChannelStatus(user.email, null, true, true);
      return res.json({
        success: true,
        channelEnabled: true,
        message: 'Text Channel active. Other registered users can now send notifications to you.',
        email: updated.email,
      });
    }

    const result = await setChannelStatus(effectiveEmail, passkey, true);
    return res.json({
      success: true,
      channelEnabled: true,
      message: 'Text Channel active. Other registered users can now send notifications to you.',
      email: result.email,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Authentication failed.',
    });
  }
});

/**
 * 3. Disable Text Channel (PRD Section 30, Addendum #6)
 * POST /api/notifications/channel/disable
 */
router.post('/channel/disable', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const effectiveEmail = req.sessionEmail || email;

    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Authentication or registered email required.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Passkey is required when not authenticated with an active session.',
      });
    }

    if (req.sessionEmail) {
      const user = await findUserByEmail(req.sessionEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: 'User session not found.' });
      }
      const updated = await setChannelStatus(user.email, null, false, true);
      return res.json({
        success: true,
        channelEnabled: false,
        message: 'Text Channel disabled. New messages will be rejected.',
        email: updated.email,
      });
    }

    const result = await setChannelStatus(effectiveEmail, passkey, false);
    return res.json({
      success: true,
      channelEnabled: false,
      message: 'Text Channel disabled. New messages will be rejected.',
      email: result.email,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Authentication failed.',
    });
  }
});

/**
 * 4. Get Current Channel Status
 * POST /api/notifications/channel/status
 */
router.post('/channel/status', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const effectiveEmail = req.sessionEmail || email;

    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.',
      });
    }

    const normEmail = normalizeEmail(effectiveEmail);
    const user = await findUserByEmail(normEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unable to authenticate. Please check your credentials.',
      });
    }

    if (!req.sessionEmail) {
      if (!passkey) {
        return res.status(400).json({
          success: false,
          error: 'Passkey is required.',
        });
      }
      const valid = await verifyPasskey(passkey, user.passkeyHash);
      if (!valid) {
        return res.status(401).json({
          success: false,
          error: 'Unable to authenticate. Please check your credentials.',
        });
      }
    }

    return res.json({
      success: true,
      email: user.email,
      channelEnabled: Boolean(user.channelEnabled),
      createdAt: user.createdAt,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * 5. Send Notification Message (PRD Section 31, Addendum #6)
 * POST /api/notifications/send
 */
router.post('/send', sendLimiter, async (req, res) => {
  try {
    const { senderEmail, passkey, receiverEmail, content, viewOnce } = req.body || {};
    const effectiveSender = req.sessionEmail || senderEmail;

    if (!effectiveSender) {
      return res.status(400).json({
        success: false,
        error: 'Sender email is required.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Sender passkey is required.',
      });
    }

    if (!receiverEmail) {
      return res.status(400).json({
        success: false,
        error: 'Receiver email is required.',
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty.',
      });
    }

    const result = await sendNotificationMessage({
      senderEmail: effectiveSender,
      passkey,
      receiverEmail,
      content,
      viewOnce: Boolean(viewOnce),
      isPreAuthenticated: Boolean(req.sessionEmail),
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: result,
    });
  } catch (err) {
    const msg = err.message || 'Failed to send message.';
    let status = 400;
    if (msg.includes('Authentication failed')) status = 401;
    else if (msg.includes('not accepting')) status = 403;

    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});

/**
 * 6. View Received Messages List (PRD Section 32, Addendum #6)
 * POST /api/notifications/messages
 */
router.post('/messages', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const effectiveEmail = req.sessionEmail || email;

    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Passkey is required when not logged in.',
      });
    }

    const messages = await getReceivedMessages(effectiveEmail, passkey, Boolean(req.sessionEmail));
    return res.json({
      success: true,
      messages,
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Authentication failed.',
    });
  }
});

/**
 * 7. Retrieve Single Message Content / Consume View-Once (PRD Section 16, 17, 32)
 * POST /api/notifications/messages/:id
 */
router.post('/messages/:id', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const messageId = req.params.id;
    const effectiveEmail = req.sessionEmail || email;

    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Passkey is required.',
      });
    }

    const message = await getMessageById(messageId, effectiveEmail, passkey, Boolean(req.sessionEmail));
    return res.json({
      success: true,
      message,
    });
  } catch (err) {
    const msg = err.message || 'Message retrieval failed.';
    let status = 400;
    if (msg.includes('authenticate')) status = 401;
    else if (msg.includes('not found') || msg.includes('consumed')) status = 404;

    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});

/**
 * 8. Delete Single Message (PRD Section 33)
 * DELETE /api/notifications/messages/:id
 */
router.delete('/messages/:id', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const messageId = req.params.id;
    const effectiveEmail = req.sessionEmail || email;

    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Passkey is required.',
      });
    }

    await deleteMessage(messageId, effectiveEmail, passkey, Boolean(req.sessionEmail));
    return res.json({
      success: true,
      message: 'Message deleted successfully.',
    });
  } catch (err) {
    const msg = err.message || 'Deletion failed.';
    let status = 400;
    if (msg.includes('authenticate')) status = 401;
    else if (msg.includes('not found') || msg.includes('unauthorized')) status = 404;

    return res.status(status).json({
      success: false,
      error: msg,
    });
  }
});

/**
 * 9. Delete Account and purge all data (PRD Section 20-23, 34)
 * DELETE /api/notifications/account
 */
router.delete('/account', authLimiter, async (req, res) => {
  try {
    const { email, passkey } = req.body || {};
    const effectiveEmail = req.sessionEmail || email;
    if (!effectiveEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required to confirm account deletion.',
      });
    }

    if (!req.sessionEmail && !passkey) {
      return res.status(400).json({
        success: false,
        error: 'Passkey or active authenticated session is required to confirm account deletion.',
      });
    }

    await deleteNotificationAccount(effectiveEmail, passkey, Boolean(req.sessionEmail));
    res.setHeader('Set-Cookie', 'notification_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return res.json({
      success: true,
      message: 'Your notification account, text channel, and all associated messages have been permanently deleted.',
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Authentication failed. Could not delete account.',
    });
  }
});

export default router;
