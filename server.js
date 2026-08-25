import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

const PORT = process.env.PORT || 3000;

// Map sessionId -> Session Object
const sessions = new Map();
// Map socketId -> { sessionId, participantId }
const socketToParticipant = new Map();

// In-memory ephemeral encrypted file store: fileId -> EncryptedFileRecord
// Zero plaintext file storage on server - handles ciphertext bytes only (PRD Phase 3 Section 4, 22)
const ephemeralFiles = new Map();

// Multer configured for in-memory encrypted buffer storage
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760', 10); // 10 MB
const MAX_PDF_SIZE = parseInt(process.env.MAX_PDF_SIZE || '26214400', 10);   // 25 MB
const MAX_CIPHERTEXT_SIZE = Math.max(MAX_IMAGE_SIZE, MAX_PDF_SIZE) + 1024 * 1024; // buffer padding for auth tags/metadata

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CIPHERTEXT_SIZE },
});

// Helper to log safe security events without exposing keys or plaintext (PRD Section 36)
function logSecurityEvent(sessionId, eventType, details = {}) {
  const session = sessions.get(sessionId);
  if (!session) return;

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: eventType,
    details: {
      ...details,
      // Ensure cryptographic keys are NEVER included in logs (PRD Invariant 17, 36)
      privateKey: undefined,
      fileKey: undefined,
      plaintext: undefined,
    },
  };

  session.securityLogs.push(event);
  // Cap in-memory logs per session to 150 events
  if (session.securityLogs.length > 150) {
    session.securityLogs.shift();
  }

  // Broadcast safe audit event to session members
  const room = getSessionRoom(sessionId);
  io.to(room).emit('security-event', event);
}

// Calculate expiration timestamp from duration option (PRD Section 29)
function calculateExpiresAt(option) {
  const now = Date.now();
  switch (option) {
    case '1H':
      return now + 60 * 60 * 1000;
    case '24H':
      return now + 24 * 60 * 60 * 1000;
    case '7D':
      return now + 7 * 24 * 60 * 60 * 1000;
    case '30D':
      return now + 30 * 24 * 60 * 60 * 1000;
    case 'NEVER':
    default:
      return null; // Session Lifetime
  }
}

// Helper to generate cryptographic random room IDs and passkeys
function generateSessionId() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let id = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

function generatePasskey() {
  const words = [
    'ALPHA', 'BRAVO', 'COBALT', 'DELTA', 'ECHO', 'FALCON', 'GHOST', 'HAVEN',
    'IRON', 'JADE', 'KRYPTO', 'LUNAR', 'NEO', 'ORION', 'PRISM', 'QUANTUM',
    'RAVEN', 'SOLAR', 'TITAN', 'VORTEX', 'ZENITH', 'SHIELD', 'CIPHER', 'NEXUS'
  ];
  const word = words[crypto.randomInt(0, words.length)];
  const num = crypto.randomInt(100, 999);
  return `${word}-${num}`;
}

function getSessionRoom(sessionId) {
  return `ephemeral_session_${sessionId}`;
}

function getParticipantsArray(session) {
  return Array.from(session.participants.values()).map((p) => ({
    participantId: p.participantId,
    username: p.username,
    isOwner: p.isOwner,
    joinedAt: p.joinedAt,
    publicKey: p.publicKey || null,
    fingerprint: p.fingerprint || null,
  }));
}

function initiateSessionDestruction(session, reason) {
  if (session.status === 'ENDING' || session.status === 'DESTROYED') {
    return;
  }

  session.status = 'ENDING';
  session.endingReason = reason;
  session.warningDurationMs = 5000;
  session.countdownDurationMs = 10000;
  const totalDuration = session.warningDurationMs + session.countdownDurationMs; // 15s total
  session.destroyAt = Date.now() + totalDuration;

  logSecurityEvent(session.sessionId, 'SESSION_ENDING', { reason, destroyAt: session.destroyAt });

  const room = getSessionRoom(session.sessionId);
  io.to(room).emit('session-ending', {
    sessionId: session.sessionId,
    reason,
    destroyAt: session.destroyAt,
    warningDurationMs: session.warningDurationMs,
    countdownDurationMs: session.countdownDurationMs,
    totalDurationMs: totalDuration,
  });

  // Schedule final hard destruction and memory purge
  session.destroyTimeoutId = setTimeout(() => {
    executeHardDestruction(session.sessionId);
  }, totalDuration);
}

function executeHardDestruction(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  session.status = 'DESTROYED';
  const room = getSessionRoom(sessionId);

  logSecurityEvent(sessionId, 'SESSION_DESTROYED', { message: 'All in-memory state purged.' });

  // Broadcast terminal destruction event
  io.to(room).emit('session-destroyed', {
    sessionId,
    message: 'Session destroyed. All cryptographic state and encrypted files have been permanently purged from server RAM.',
    timestamp: Date.now(),
  });

  // Disconnect all sockets from room
  const socketsInRoom = io.sockets.adapter.rooms.get(room);
  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        s.leave(room);
      }
      socketToParticipant.delete(socketId);
    }
  }

  // Clear timers and completely delete session from memory
  if (session.destroyTimeoutId) {
    clearTimeout(session.destroyTimeoutId);
  }
  session.participants.clear();
  session.bannedParticipantIds.clear();
  sessions.delete(sessionId);

  // Hard purge all ephemeral encrypted files belonging to this session
  for (const [fileId, meta] of ephemeralFiles) {
    if (meta.sessionId === sessionId) {
      ephemeralFiles.delete(fileId);
    }
  }
}

// Background sweep for expired files (PRD Section 29, 30)
setInterval(() => {
  const now = Date.now();
  for (const [fileId, file] of ephemeralFiles.entries()) {
    if (file.expiresAt && now > file.expiresAt) {
      ephemeralFiles.delete(fileId);
      logSecurityEvent(file.sessionId, 'FILE_EXPIRED', {
        fileId,
        fileName: file.originalName,
        uploadedBy: file.uploadedBy,
      });

      const room = getSessionRoom(file.sessionId);
      io.to(room).emit('file-expired', {
        fileId,
        sessionId: file.sessionId,
        expiredAt: now,
      });
    }
  }
}, 15000);

// REST API
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessionsCount: sessions.size,
    encryptedFilesCount: ephemeralFiles.size,
    timestamp: Date.now(),
  });
});

app.get('/api/session/:sessionId/check', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId.toUpperCase());
  if (!session) {
    return res.json({ exists: false, status: 'NOT_FOUND' });
  }
  return res.json({
    exists: true,
    status: session.status,
    createdAt: session.createdAt,
    participantCount: session.participants.size,
  });
});

// --- Encrypted File Transfer Routes (PRD Phase 3) ---

// POST /api/files/upload — Stores encrypted ciphertext blob in memory
app.post('/api/files/upload', (req, res) => {
  const sessionId = (req.headers['x-session-id'] || req.body?.sessionId || '').toUpperCase();
  const participantId = req.headers['x-participant-id'] || req.body?.participantId || '';

  const session = sessions.get(sessionId);
  if (!session || session.status !== 'ACTIVE') {
    return res.status(403).json({ success: false, code: 'SESSION_NOT_ACTIVE', message: 'Session is not active.' });
  }
  if (!session.participants.has(participantId)) {
    return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'You are not a participant of this session.' });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, code: 'FILE_TOO_LARGE', message: 'Encrypted payload exceeds the maximum allowed transfer size.' });
      }
      return res.status(500).json({ success: false, code: 'UPLOAD_ERROR', message: err.message || 'Upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, code: 'NO_FILE', message: 'No encrypted payload was provided.' });
    }

    const { buffer, size } = req.file;
    const originalName = (req.body.originalName || 'encrypted_file.bin').slice(0, 150);
    const originalMimeType = req.body.originalMimeType || 'application/octet-stream';
    const originalSize = parseInt(req.body.originalSize || String(size), 10);
    const encryptionVersion = parseInt(req.body.encryptionVersion || '1', 10);
    const algorithm = req.body.algorithm || 'AES-256-GCM';
    const nonce = req.body.nonce || '';
    let keyEnvelopes = {};
    try {
      keyEnvelopes = typeof req.body.keyEnvelopes === 'string' ? JSON.parse(req.body.keyEnvelopes) : req.body.keyEnvelopes || {};
    } catch {
      keyEnvelopes = {};
    }
    const sha256 = req.body.sha256 || '';
    const expiresInOption = req.body.expiresInOption || 'NEVER';
    const expiresAt = calculateExpiresAt(expiresInOption);

    const isPdf = originalMimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
    const sizeLimit = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;

    if (originalSize > sizeLimit) {
      return res.status(413).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the ${isPdf ? 'PDF' : 'image'} size limit of ${Math.round(sizeLimit / 1048576)} MB.`,
      });
    }

    const fileId = crypto.randomUUID();

    // Store encrypted ciphertext in-memory (zero plaintext storage on server)
    ephemeralFiles.set(fileId, {
      buffer, // CIPHERTEXT
      encryptedSize: size,
      originalSize,
      originalName,
      mimeType: originalMimeType,
      fileType: isPdf ? 'pdf' : 'image',
      sessionId,
      uploadedBy: participantId,
      uploadedAt: Date.now(),
      expiresAt,
      expiresInOption,
      encryptionVersion,
      algorithm,
      nonce,
      keyEnvelopes,
      sha256,
    });

    const participant = session.participants.get(participantId);
    const room = getSessionRoom(sessionId);
    const caption = (req.body.caption || '').trim().slice(0, 500);

    // Record safe security audit event
    logSecurityEvent(sessionId, 'FILE_UPLOADED', {
      fileId,
      fileName: originalName,
      encryptedSize: size,
      algorithm,
      uploaderId: participantId,
      expiresAt,
    });

    // Broadcast file message to all session participants via Socket.IO
    io.to(room).emit('receive-file', {
      messageId: crypto.randomUUID(),
      fileId,
      senderId: participantId,
      senderName: participant?.username || 'Unknown',
      isOwner: participant?.isOwner || false,
      fileName: originalName,
      fileSize: originalSize,
      encryptedSize: size,
      mimeType: originalMimeType,
      fileType: isPdf ? 'pdf' : 'image',
      text: caption,
      timestamp: Date.now(),
      encryptionVersion,
      algorithm,
      nonce,
      keyEnvelopes,
      sha256,
      expiresAt,
      isEncrypted: true,
    });

    return res.json({
      success: true,
      fileId,
      fileName: originalName,
      fileSize: originalSize,
      encryptedSize: size,
      mimeType: originalMimeType,
      expiresAt,
    });
  });
});

// GET /api/files/:fileId — Serves raw ciphertext to authorized participants
app.get('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  const sessionId = (req.headers['x-session-id'] || req.query.sessionId || '').toUpperCase();
  const participantId = req.headers['x-participant-id'] || req.query.participantId || '';
  const forceDownload = req.query.download === 'true';

  const file = ephemeralFiles.get(fileId);
  if (!file) {
    return res.status(404).json({ success: false, code: 'FILE_NOT_FOUND', message: 'File not found or session has ended.' });
  }

  // Validate requester is in the same session
  const session = sessions.get(sessionId);
  if (!session || file.sessionId !== sessionId || !session.participants.has(participantId)) {
    logSecurityEvent(file.sessionId, 'UNAUTHORIZED_FILE_ACCESS', { fileId, attemptedBy: participantId });
    return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Access denied.' });
  }

  // Check file expiration (PRD Section 29, 30)
  if (file.expiresAt && Date.now() > file.expiresAt) {
    ephemeralFiles.delete(fileId);
    logSecurityEvent(file.sessionId, 'FILE_EXPIRED', { fileId, fileName: file.originalName });
    return res.status(410).json({ success: false, code: 'FILE_EXPIRED', message: 'This file has expired and was purged from server memory.' });
  }

  logSecurityEvent(sessionId, 'FILE_DOWNLOADED', {
    fileId,
    downloadedBy: participantId,
  });

  // Serve ciphertext bytes with strict no-cache headers
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', file.encryptedSize);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('X-Encryption-Version', String(file.encryptionVersion));
  res.set('X-Encryption-Algorithm', file.algorithm);
  res.set('X-Encryption-Nonce', file.nonce);
  if (forceDownload) {
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}.enc"`);
  } else {
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}.enc"`);
  }
  return res.send(file.buffer);
});

// DELETE /api/files/:fileId — Secure File Deletion (PRD Section 31)
app.delete('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  const sessionId = (req.headers['x-session-id'] || req.body?.sessionId || '').toUpperCase();
  const participantId = req.headers['x-participant-id'] || req.body?.participantId || '';

  const file = ephemeralFiles.get(fileId);
  if (!file) {
    return res.status(404).json({ success: false, code: 'FILE_NOT_FOUND', message: 'File not found or already deleted.' });
  }

  const session = sessions.get(sessionId);
  if (!session || file.sessionId !== sessionId || !session.participants.has(participantId)) {
    return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Access denied.' });
  }

  const isOwner = session.ownerParticipantId === participantId;
  const isUploader = file.uploadedBy === participantId;

  if (!isOwner && !isUploader) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only the uploader or session owner can delete this file.' });
  }

  // Purge ciphertext from memory
  ephemeralFiles.delete(fileId);

  logSecurityEvent(sessionId, 'FILE_DELETED', {
    fileId,
    fileName: file.originalName,
    deletedBy: participantId,
  });

  const room = getSessionRoom(sessionId);
  io.to(room).emit('file-deleted', {
    fileId,
    sessionId,
    deletedBy: participantId,
    timestamp: Date.now(),
  });

  return res.json({ success: true, fileId, message: 'Encrypted file permanently deleted from server memory.' });
});

// Socket.IO Event Handlers
io.on('connection', (socket) => {
  // 1. Create Session (Owner)
  socket.on('create-session', (payload = {}, callback) => {
    try {
      const username = (payload.username || 'Session Creator').trim().slice(0, 32);
      const publicKey = payload.publicKey || null;
      const fingerprint = payload.fingerprint || null;

      let sessionId = generateSessionId();
      while (sessions.has(sessionId)) {
        sessionId = generateSessionId();
      }

      const passkey = generatePasskey();
      const ownerParticipantId = crypto.randomUUID();

      const session = {
        sessionId,
        passkey,
        ownerParticipantId,
        ownerSocketId: socket.id,
        participants: new Map(),
        bannedParticipantIds: new Set(),
        status: 'ACTIVE',
        createdAt: Date.now(),
        destroyAt: null,
        endingReason: null,
        warningDurationMs: 5000,
        countdownDurationMs: 10000,
        securityLogs: [],
      };

      const ownerParticipant = {
        participantId: ownerParticipantId,
        username,
        socketId: socket.id,
        joinedAt: Date.now(),
        isOwner: true,
        publicKey,
        fingerprint,
      };

      session.participants.set(ownerParticipantId, ownerParticipant);
      sessions.set(sessionId, session);
      socketToParticipant.set(socket.id, { sessionId, participantId: ownerParticipantId });

      logSecurityEvent(sessionId, 'SESSION_CREATED', {
        creator: username,
        ownerId: ownerParticipantId,
        fingerprint,
      });

      const room = getSessionRoom(sessionId);
      socket.join(room);

      const response = {
        success: true,
        sessionId,
        passkey,
        participantId: ownerParticipantId,
        username,
        isOwner: true,
        participants: getParticipantsArray(session),
        securityLogs: session.securityLogs,
      };

      if (typeof callback === 'function') callback(response);
      else socket.emit('session-created', response);
    } catch (err) {
      const errRes = { success: false, message: 'Failed to create ephemeral session' };
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // 2. Join Session
  socket.on('join-session', (payload = {}, callback) => {
    try {
      const reqSessionId = (payload.sessionId || '').trim().toUpperCase();
      const reqPasskey = (payload.passkey || '').trim().toUpperCase();
      const reqUsername = (payload.username || 'Anonymous').trim().slice(0, 32) || 'Participant';
      const existingParticipantId = payload.participantId;
      const publicKey = payload.publicKey || null;
      const fingerprint = payload.fingerprint || null;

      const session = sessions.get(reqSessionId);

      // Decision Tree:
      if (!session) {
        const errorRes = { success: false, code: 'SESSION_NOT_FOUND', message: 'Session does not exist or was destroyed.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      if (session.status !== 'ACTIVE') {
        const errorRes = { success: false, code: 'SESSION_ENDING', message: 'Session is ending or destroyed and cannot accept new joiners.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      if (session.passkey.toUpperCase() !== reqPasskey) {
        logSecurityEvent(reqSessionId, 'AUTHENTICATION_FAILED', { username: reqUsername });
        const errorRes = { success: false, code: 'INVALID_PASSKEY', message: 'Invalid session passkey. Verification failed.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      if (existingParticipantId && session.bannedParticipantIds.has(existingParticipantId)) {
        logSecurityEvent(reqSessionId, 'BANNED_JOIN_ATTEMPT', { participantId: existingParticipantId });
        const errorRes = { success: false, code: 'PARTICIPANT_BANNED', message: 'You have been removed by the owner and are banned from this session.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      const participantId = existingParticipantId || crypto.randomUUID();
      const isOwner = participantId === session.ownerParticipantId;

      const participant = {
        participantId,
        username: reqUsername,
        socketId: socket.id,
        joinedAt: Date.now(),
        isOwner,
        publicKey,
        fingerprint,
      };

      session.participants.set(participantId, participant);
      if (isOwner) {
        session.ownerSocketId = socket.id;
      }
      socketToParticipant.set(socket.id, { sessionId: reqSessionId, participantId });

      const room = getSessionRoom(reqSessionId);
      socket.join(room);

      logSecurityEvent(reqSessionId, 'PARTICIPANT_JOINED', {
        username: reqUsername,
        participantId,
        fingerprint,
      });

      const participantsList = getParticipantsArray(session);

      const successRes = {
        success: true,
        sessionId: reqSessionId,
        participantId,
        username: reqUsername,
        isOwner,
        participants: participantsList,
        securityLogs: session.securityLogs,
      };

      if (typeof callback === 'function') callback(successRes);
      else socket.emit('join-success', successRes);

      // Broadcast to other participants in room
      socket.to(room).emit('participant-joined', {
        participant: {
          participantId,
          username: reqUsername,
          isOwner,
          joinedAt: participant.joinedAt,
          publicKey,
          fingerprint,
        },
        participants: participantsList,
      });
    } catch (err) {
      const errRes = { success: false, code: 'SERVER_ERROR', message: 'Unexpected server error during join.' };
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // 3. Key Exchange & Key Rotation Relay (PRD Section 15, 16, 35)
  socket.on('key-exchange', (payload = {}, callback) => {
    try {
      const { sessionId, participantId, publicKey, fingerprint } = payload;
      const session = sessions.get(sessionId?.toUpperCase());
      if (!session || !session.participants.has(participantId)) return;

      const participant = session.participants.get(participantId);
      participant.publicKey = publicKey;
      participant.fingerprint = fingerprint;

      logSecurityEvent(sessionId, 'KEY_EXCHANGE_COMPLETED', {
        participantId,
        username: participant.username,
        fingerprint,
      });

      const room = getSessionRoom(sessionId);
      socket.to(room).emit('peer-key-updated', {
        participantId,
        username: participant.username,
        publicKey,
        fingerprint,
        participants: getParticipantsArray(session),
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false });
    }
  });

  socket.on('rotate-keys', (payload = {}, callback) => {
    try {
      const { sessionId, participantId, publicKey, fingerprint } = payload;
      const session = sessions.get(sessionId?.toUpperCase());
      if (!session || !session.participants.has(participantId)) return;

      const participant = session.participants.get(participantId);
      participant.publicKey = publicKey;
      participant.fingerprint = fingerprint;

      logSecurityEvent(sessionId, 'KEY_ROTATION', {
        participantId,
        username: participant.username,
        newFingerprint: fingerprint,
      });

      const room = getSessionRoom(sessionId);
      io.to(room).emit('peer-key-updated', {
        participantId,
        username: participant.username,
        publicKey,
        fingerprint,
        isRotation: true,
        participants: getParticipantsArray(session),
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false });
    }
  });

  // 4. Send Message (Ephemeral Relay Only, Zero Database)
  socket.on('send-message', (payload = {}, callback) => {
    try {
      const { sessionId, participantId, text } = payload;
      const session = sessions.get(sessionId?.toUpperCase());

      if (!session || session.status !== 'ACTIVE') {
        if (typeof callback === 'function') callback({ success: false, message: 'Session is not active' });
        return;
      }

      if (session.bannedParticipantIds.has(participantId)) {
        if (typeof callback === 'function') callback({ success: false, message: 'Participant is banned' });
        return;
      }

      const participant = session.participants.get(participantId);
      if (!participant) {
        if (typeof callback === 'function') callback({ success: false, message: 'Unauthorized sender' });
        return;
      }

      const cleanText = (text || '').trim();
      if (!cleanText || cleanText.length > 2000) {
        if (typeof callback === 'function') callback({ success: false, message: 'Invalid message length' });
        return;
      }

      const messageObject = {
        messageId: crypto.randomUUID(),
        senderId: participant.participantId,
        senderName: participant.username,
        isOwner: participant.isOwner,
        text: cleanText,
        timestamp: Date.now(),
      };

      const room = getSessionRoom(session.sessionId);
      io.to(room).emit('receive-message', messageObject);

      if (typeof callback === 'function') callback({ success: true, messageId: messageObject.messageId });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: 'Failed to relay message' });
    }
  });

  // 5. Typing Indicator
  socket.on('typing', (payload = {}) => {
    const { sessionId, participantId, isTyping } = payload;
    const session = sessions.get(sessionId?.toUpperCase());
    if (!session || session.status !== 'ACTIVE') return;

    const participant = session.participants.get(participantId);
    if (!participant) return;

    const room = getSessionRoom(sessionId);
    socket.to(room).emit('user-typing', {
      participantId,
      username: participant.username,
      isTyping: Boolean(isTyping),
    });
  });

  // 6. Owner Kicks Participant
  socket.on('kick-participant', (payload = {}, callback) => {
    try {
      const { sessionId, participantId, targetParticipantId } = payload;
      const session = sessions.get(sessionId?.toUpperCase());

      if (!session) {
        if (typeof callback === 'function') callback({ success: false, message: 'Session not found' });
        return;
      }

      if (participantId !== session.ownerParticipantId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Only session owner can kick participants.' });
        return;
      }

      if (targetParticipantId === session.ownerParticipantId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Owner cannot kick themselves.' });
        return;
      }

      const target = session.participants.get(targetParticipantId);
      if (!target) {
        if (typeof callback === 'function') callback({ success: false, message: 'Participant not found in session.' });
        return;
      }

      session.bannedParticipantIds.add(targetParticipantId);

      const targetSocket = io.sockets.sockets.get(target.socketId);
      const room = getSessionRoom(session.sessionId);

      if (targetSocket) {
        targetSocket.emit('participant-kicked-self', {
          reason: 'You were kicked from this session by the owner.',
          sessionId: session.sessionId,
        });
        targetSocket.leave(room);
        socketToParticipant.delete(target.socketId);
      }

      session.participants.delete(targetParticipantId);
      const updatedList = getParticipantsArray(session);

      logSecurityEvent(sessionId, 'PARTICIPANT_KICKED', {
        kickedId: targetParticipantId,
        username: target.username,
      });

      io.to(room).emit('participant-kicked', {
        kickedParticipantId: targetParticipantId,
        username: target.username,
        participants: updatedList,
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: 'Error processing kick request' });
    }
  });

  // 7. Voluntary Participant Leave
  socket.on('leave-session', (payload = {}, callback) => {
    try {
      const { sessionId, participantId } = payload;
      const session = sessions.get(sessionId?.toUpperCase());

      if (session) {
        const participant = session.participants.get(participantId);
        if (participant) {
          if (participant.isOwner) {
            initiateSessionDestruction(session, 'OWNER_LEFT');
          } else {
            session.participants.delete(participantId);
            const room = getSessionRoom(session.sessionId);
            socket.leave(room);
            socketToParticipant.delete(socket.id);

            logSecurityEvent(sessionId, 'PARTICIPANT_LEFT', {
              participantId,
              username: participant.username,
            });

            io.to(room).emit('participant-left', {
              participantId,
              username: participant.username,
              participants: getParticipantsArray(session),
            });
          }
        }
      }

      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false });
    }
  });

  // 8. Owner Explicitly Ends Session
  socket.on('end-session', (payload = {}, callback) => {
    try {
      const { sessionId, participantId } = payload;
      const session = sessions.get(sessionId?.toUpperCase());

      if (!session) {
        if (typeof callback === 'function') callback({ success: false, message: 'Session not found' });
        return;
      }

      if (participantId !== session.ownerParticipantId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Only session owner can end the session.' });
        return;
      }

      initiateSessionDestruction(session, 'OWNER_ENDED');
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: 'Error ending session' });
    }
  });

  // 9. Socket Disconnection Handler
  socket.on('disconnect', () => {
    const record = socketToParticipant.get(socket.id);
    if (!record) return;

    socketToParticipant.delete(socket.id);
    const { sessionId, participantId } = record;
    const session = sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.get(participantId);
    if (!participant) return;

    if (participant.isOwner && session.status === 'ACTIVE') {
      initiateSessionDestruction(session, 'OWNER_LEFT');
    } else if (!participant.isOwner && session.status === 'ACTIVE') {
      session.participants.delete(participantId);
      const room = getSessionRoom(sessionId);
      io.to(room).emit('participant-left', {
        participantId,
        username: participant.username,
        participants: getParticipantsArray(session),
      });
    }
  });
});

// Vite Middleware for Frontend Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Ephemeral Communication Server running on http://localhost:${PORT}`);
  });
}

startServer();