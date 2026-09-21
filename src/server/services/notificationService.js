import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NotificationUser } from '../models/NotificationUser.js';
import { NotificationMessage } from '../models/NotificationMessage.js';
import { isDatabaseConnected } from '../config/database.js';
import { isAuthLockedOut, recordFailedAuth, clearFailedAuth } from '../middleware/rateLimiter.js';
import { destroyAllUserSessions, hasActiveSession } from './notificationSessionService.js';

const SALT_ROUNDS = 10;

// In-memory fallback stores when database is not connected
const inMemoryUsers = new Map(); // email -> { _id, email, passkeyHash, channelEnabled, createdAt, updatedAt }
const inMemoryMessages = new Map(); // messageId -> { _id, senderEmail, receiverEmail, content, viewOnce, viewed, viewedAt, createdAt }

export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export async function hashPasskey(passkey) {
  if (!passkey || typeof passkey !== 'string') {
    throw new Error('Passkey is required');
  }
  return bcrypt.hash(passkey.trim(), SALT_ROUNDS);
}

export async function verifyPasskey(candidatePasskey, passkeyHash) {
  if (!candidatePasskey || !passkeyHash) return false;
  return bcrypt.compare(candidatePasskey.trim(), passkeyHash);
}

/**
 * Registers a new notification user with email and hashed passkey.
 * By default, channelEnabled is true so registered users can receive messages immediately.
 */
export async function registerNotificationUser({ email, passkey, channelEnabled = true }) {
  const normEmail = normalizeEmail(email);

  if (!isValidEmail(normEmail)) {
    throw new Error('Please enter a valid email address.');
  }

  if (!passkey || typeof passkey !== 'string' || passkey.trim().length < 4) {
    throw new Error('Passkey must be at least 4 characters long.');
  }

  // Check duplicate
  const existing = await findUserByEmail(normEmail);
  if (existing) {
    throw new Error('This email is already registered.');
  }

  const passkeyHash = await hashPasskey(passkey);
  const now = new Date();
  const isEnabled = channelEnabled !== false;

  if (isDatabaseConnected()) {
    try {
      const user = await NotificationUser.create({
        email: normEmail,
        passkeyHash,
        channelEnabled: isEnabled,
        channelCreatedAt: isEnabled ? now : null,
        channelDisabledAt: isEnabled ? null : now,
        createdAt: now,
        updatedAt: now,
      });
      return {
        id: user._id.toString(),
        email: user.email,
        channelEnabled: user.channelEnabled,
        createdAt: user.createdAt,
      };
    } catch (err) {
      if (err.code === 11000) {
        throw new Error('This email is already registered.');
      }
      console.warn('[NotificationService] DB create failed, falling back to memory:', err.message);
    }
  }

  // Fallback in-memory
  const id = crypto.randomUUID();
  const user = {
    _id: id,
    id,
    email: normEmail,
    passkeyHash,
    channelEnabled: isEnabled,
    channelCreatedAt: isEnabled ? now : null,
    channelDisabledAt: isEnabled ? null : now,
    createdAt: now,
    updatedAt: now,
  };
  inMemoryUsers.set(normEmail, user);

  return {
    id,
    email: normEmail,
    channelEnabled: isEnabled,
    createdAt: now,
  };
}

/**
 * Finds user by normalized email
 */
export async function findUserByEmail(email) {
  const normEmail = normalizeEmail(email);
  if (!normEmail) return null;

  if (isDatabaseConnected()) {
    try {
      const user = await NotificationUser.findOne({ email: normEmail }).lean();
      if (user) return user;
    } catch (err) {
      console.warn('[NotificationService] DB findUser error:', err.message);
    }
  }

  return inMemoryUsers.get(normEmail) || null;
}

/**
 * Authenticates user credentials. Returns user if valid, throws/returns null if invalid.
 * Protects against brute-force passkey guessing.
 */
export async function authenticateUser(email, passkey) {
  const normEmail = normalizeEmail(email);
  if (!normEmail || !passkey) return null;

  if (isAuthLockedOut(normEmail)) {
    throw new Error('Too many failed authentication attempts. Please try again later.');
  }

  const user = await findUserByEmail(normEmail);
  if (!user) {
    recordFailedAuth(normEmail);
    return null;
  }

  const valid = await verifyPasskey(passkey, user.passkeyHash);
  if (!valid) {
    recordFailedAuth(normEmail);
    return null;
  }

  clearFailedAuth(normEmail);

  // Update lastAuthenticatedAt
  const now = new Date();
  if (isDatabaseConnected()) {
    try {
      await NotificationUser.updateOne({ email: normEmail }, { lastAuthenticatedAt: now });
    } catch (e) {}
  } else {
    user.lastAuthenticatedAt = now;
  }

  return user;
}

/**
 * Updates text channel enabled status (true or false)
 */
export async function setChannelStatus(email, passkey, enabled, isPreAuthenticated = false) {
  const normEmail = normalizeEmail(email);
  let user;
  if (isPreAuthenticated) {
    user = await findUserByEmail(normEmail);
  } else {
    user = await authenticateUser(normEmail, passkey);
  }

  if (!user) {
    throw new Error('Unable to authenticate. Please check your email and passkey.');
  }

  const now = new Date();
  const updatePayload = {
    channelEnabled: Boolean(enabled),
    updatedAt: now,
    ...(enabled ? { channelCreatedAt: now, channelDisabledAt: null } : { channelDisabledAt: now }),
  };

  if (isDatabaseConnected()) {
    try {
      const updated = await NotificationUser.findOneAndUpdate(
        { email: normEmail },
        updatePayload,
        { new: true }
      ).lean();
      if (updated) {
        return {
          email: updated.email,
          channelEnabled: updated.channelEnabled,
          updatedAt: updated.updatedAt,
        };
      }
    } catch (err) {
      console.warn('[NotificationService] DB update channel error:', err.message);
    }
  }

  // Memory fallback
  const memUser = inMemoryUsers.get(normEmail);
  if (memUser) {
    memUser.channelEnabled = Boolean(enabled);
    memUser.updatedAt = now;
    if (enabled) {
      memUser.channelCreatedAt = now;
      memUser.channelDisabledAt = null;
    } else {
      memUser.channelDisabledAt = now;
    }
  }

  return {
    email: normEmail,
    channelEnabled: Boolean(enabled),
    updatedAt: now,
  };
}

/**
 * Sends a notification message after authenticating sender and validating receiver channel status.
 */
export async function sendNotificationMessage({
  senderEmail,
  passkey,
  receiverEmail,
  content,
  viewOnce = false,
  isPreAuthenticated = false,
}) {
  const normSender = normalizeEmail(senderEmail);
  const normReceiver = normalizeEmail(receiverEmail);

  if (!isValidEmail(normSender)) {
    throw new Error('Please provide a valid sender email.');
  }
  if (!isValidEmail(normReceiver)) {
    throw new Error('Please provide a valid receiver email.');
  }

  // 1. Authenticate sender
  let sender;
  if (isPreAuthenticated) {
    sender = await findUserByEmail(normSender);
  } else {
    sender = await authenticateUser(normSender, passkey);
  }

  if (!sender) {
    throw new Error('Authentication failed. Please verify your email and passkey.');
  }

  // 2. Validate receiver exists and channel is active.
  // We use the same error message for both cases to prevent email enumeration attacks.
  const receiver = await findUserByEmail(normReceiver);
  if (!receiver) {
    throw new Error('This user is currently not accepting messages.');
  }

  // Check if receiver is accepting messages:
  // A receiver accepts messages if:
  // 1) channelEnabled is true, OR
  // 2) receiver is currently logged in with an active session, OR
  // 3) receiver never explicitly disabled incoming messages (legacy registration or missing channelDisabledAt)
  const isExplicitlyDisabled =
    receiver.channelEnabled === false &&
    Boolean(receiver.channelDisabledAt) &&
    (!receiver.channelCreatedAt || new Date(receiver.channelDisabledAt) > new Date(receiver.channelCreatedAt));

  const hasActive = hasActiveSession(normReceiver);
  const isAccepting = receiver.channelEnabled || hasActive || !isExplicitlyDisabled;

  if (!isAccepting) {
    throw new Error('This user is currently not accepting messages.');
  }

  // Auto-heal receiver's channel state in database if it was previously false
  if (!receiver.channelEnabled && isAccepting) {
    setChannelStatus(normReceiver, null, true, true).catch((e) => {
      console.warn('[sendNotificationMessage] auto-heal receiver error:', e.message);
    });
  }

  // 4. Validate content
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Message cannot be empty.');
  }

  if (content.length > 5000) {
    throw new Error('Message exceeds the maximum allowed length (5000 characters).');
  }

  const now = new Date();
  const trimmedContent = content.trim();
  const isViewOnce = Boolean(viewOnce);

  if (isDatabaseConnected()) {
    try {
      const message = await NotificationMessage.create({
        senderEmail: normSender,
        receiverEmail: normReceiver,
        content: trimmedContent,
        viewOnce: isViewOnce,
        viewed: false,
        viewedAt: null,
        createdAt: now,
      });

      return {
        id: message._id.toString(),
        senderEmail: normSender,
        receiverEmail: normReceiver,
        viewOnce: isViewOnce,
        createdAt: now,
      };
    } catch (err) {
      console.warn('[NotificationService] DB create message error:', err.message);
    }
  }

  // Memory fallback
  const id = crypto.randomUUID();
  const msgRecord = {
    _id: id,
    id,
    senderEmail: normSender,
    receiverEmail: normReceiver,
    content: trimmedContent,
    viewOnce: isViewOnce,
    viewed: false,
    viewedAt: null,
    createdAt: now,
  };
  inMemoryMessages.set(id, msgRecord);

  return {
    id,
    senderEmail: normSender,
    receiverEmail: normReceiver,
    viewOnce: isViewOnce,
    createdAt: now,
  };
}

/**
 * Lists received messages for an authenticated user.
 * For view-once messages, content is masked until explicitly opened via getMessageById.
 */
export async function getReceivedMessages(email, passkey, isPreAuthenticated = false) {
  const normEmail = normalizeEmail(email);
  let user;
  if (isPreAuthenticated) {
    user = await findUserByEmail(normEmail);
  } else {
    user = await authenticateUser(normEmail, passkey);
  }

  if (!user) {
    throw new Error('Unable to authenticate. Please check your email and passkey.');
  }

  if (isDatabaseConnected()) {
    try {
      const docs = await NotificationMessage.find({ receiverEmail: normEmail })
        .sort({ createdAt: -1 })
        .lean();

      return docs.map((doc) => ({
        id: doc._id.toString(),
        senderEmail: doc.senderEmail,
        receiverEmail: doc.receiverEmail,
        // If view-once and not yet opened, hide content in preview listing
        content: doc.viewOnce ? null : doc.content,
        viewOnce: doc.viewOnce,
        viewed: doc.viewed,
        viewedAt: doc.viewedAt,
        createdAt: doc.createdAt,
      }));
    } catch (err) {
      console.warn('[NotificationService] DB list messages error:', err.message);
    }
  }

  // Memory fallback
  const results = [];
  for (const msg of inMemoryMessages.values()) {
    if (msg.receiverEmail === normEmail) {
      results.push({
        id: msg._id.toString(),
        senderEmail: msg.senderEmail,
        receiverEmail: msg.receiverEmail,
        content: msg.viewOnce ? null : msg.content,
        viewOnce: msg.viewOnce,
        viewed: msg.viewed,
        viewedAt: msg.viewedAt,
        createdAt: msg.createdAt,
      });
    }
  }

  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return results;
}

/**
 * Atomically retrieves a single message by ID.
 * If view-once: returns content and immediately deletes it from database & memory.
 */
export async function getMessageById(messageId, email, passkey, isPreAuthenticated = false) {
  const normEmail = normalizeEmail(email);
  let user;
  if (isPreAuthenticated) {
    user = await findUserByEmail(normEmail);
  } else {
    user = await authenticateUser(normEmail, passkey);
  }

  if (!user) {
    throw new Error('Unable to authenticate. Please check your email and passkey.');
  }

  if (isDatabaseConnected()) {
    try {
      const doc = await NotificationMessage.findOne({
        _id: messageId,
        receiverEmail: normEmail,
      });

      if (!doc) {
        throw new Error('Message not found or already consumed.');
      }

      const content = doc.content;
      const isViewOnce = doc.viewOnce;
      const sender = doc.senderEmail;
      const createdAt = doc.createdAt;

      if (isViewOnce) {
        // Atomic consumption and deletion for self-destructing view-once message (Addendum #17 & #18)
        const deletedDoc = await NotificationMessage.findOneAndDelete({
          _id: messageId,
          receiverEmail: normEmail,
          viewOnce: true,
        });

        if (!deletedDoc) {
          throw new Error('Message not found or already consumed.');
        }

        return {
          id: messageId,
          senderEmail: deletedDoc.senderEmail,
          receiverEmail: normEmail,
          content: deletedDoc.content,
          viewOnce: true,
          consumed: true,
          createdAt: deletedDoc.createdAt,
        };
      }

      // Normal message: mark viewed if not viewed yet
      if (!doc.viewed) {
        doc.viewed = true;
        doc.viewedAt = new Date();
        await doc.save();
      }

      return {
        id: messageId,
        senderEmail: sender,
        receiverEmail: normEmail,
        content,
        viewOnce: false,
        viewed: true,
        createdAt,
      };
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('consumed')) {
        throw err;
      }
      console.warn('[NotificationService] DB getMessage error:', err.message);
    }
  }

  // Memory fallback
  const msg = inMemoryMessages.get(messageId);
  if (!msg || msg.receiverEmail !== normEmail) {
    throw new Error('Message not found or already consumed.');
  }

  const content = msg.content;
  const isViewOnce = msg.viewOnce;
  const sender = msg.senderEmail;
  const createdAt = msg.createdAt;

  if (isViewOnce) {
    inMemoryMessages.delete(messageId);
    return {
      id: messageId,
      senderEmail: sender,
      receiverEmail: normEmail,
      content,
      viewOnce: true,
      consumed: true,
      createdAt,
    };
  }

  msg.viewed = true;
  msg.viewedAt = new Date();

  return {
    id: messageId,
    senderEmail: sender,
    receiverEmail: normEmail,
    content,
    viewOnce: false,
    viewed: true,
    createdAt,
  };
}

/**
 * Deletes a single received message. Must be authenticated as the recipient.
 */
export async function deleteMessage(messageId, email, passkey, isPreAuthenticated = false) {
  const normEmail = normalizeEmail(email);
  let user;
  if (isPreAuthenticated) {
    user = await findUserByEmail(normEmail);
  } else {
    user = await authenticateUser(normEmail, passkey);
  }

  if (!user) {
    throw new Error('Unable to authenticate. Please check your email and passkey.');
  }

  if (isDatabaseConnected()) {
    try {
      const res = await NotificationMessage.deleteOne({
        _id: messageId,
        receiverEmail: normEmail,
      });

      if (res.deletedCount === 0) {
        throw new Error('Message not found or unauthorized.');
      }
      return true;
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('unauthorized')) {
        throw err;
      }
      console.warn('[NotificationService] DB deleteMessage error:', err.message);
    }
  }

  // Memory fallback
  const msg = inMemoryMessages.get(messageId);
  if (!msg || msg.receiverEmail !== normEmail) {
    throw new Error('Message not found or unauthorized.');
  }

  inMemoryMessages.delete(messageId);
  return true;
}

/**
 * Permanently deletes user account and purges all sent & received messages (PRD Section 22-23).
 */
export async function deleteNotificationAccount(email, passkey, isPreAuthenticated = false) {
  const normEmail = normalizeEmail(email);
  let user;
  if (isPreAuthenticated) {
    user = await findUserByEmail(normEmail);
  } else {
    user = await authenticateUser(normEmail, passkey);
  }
  if (!user) {
    throw new Error('Unable to authenticate. Please check your email and passkey.');
  }

  // Invalidate all active session tokens immediately (Addendum #24)
  destroyAllUserSessions(normEmail);

  if (isDatabaseConnected()) {
    try {
      // 1. Delete user record
      await NotificationUser.deleteOne({ email: normEmail });

      // 2. Delete all received and sent messages
      await NotificationMessage.deleteMany({
        $or: [{ receiverEmail: normEmail }, { senderEmail: normEmail }],
      });

      return true;
    } catch (err) {
      console.warn('[NotificationService] DB deleteAccount error:', err.message);
    }
  }

  // Memory fallback
  inMemoryUsers.delete(normEmail);
  for (const [id, msg] of inMemoryMessages.entries()) {
    if (msg.receiverEmail === normEmail || msg.senderEmail === normEmail) {
      inMemoryMessages.delete(id);
    }
  }

  return true;
}
