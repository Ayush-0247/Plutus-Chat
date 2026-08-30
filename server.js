import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true }); // .env.local takes priority
import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

import { connectDatabase, isDatabaseConnected, getConnectionStatus } from './src/server/config/database.js';
import { generateSessionId } from './src/server/utils/generateSessionId.js';
import { generatePasskey } from './src/server/utils/generatePasskey.js';
import { hashPasskey, verifyPasskey } from './src/server/services/authenticationService.js';
import {
  createSessionRecord,
  findSessionRecord,
  isSessionIdTaken,
  updateSessionStatus,
  deleteSessionRecord,
  addSessionBan,
  isParticipantBanned,
} from './src/server/services/sessionService.js';
import { initSessionCleanup } from './src/server/utils/sessionCleanup.js';

import { Session } from './src/server/models/Session.js';
import { SessionBan } from './src/server/models/SessionBan.js';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

// RAM-Only Ephemeral State
// Map sessionId -> { ownerSocketId, participants: Map, bannedParticipantIds: Set, destroyAt, warningDurationMs, countdownDurationMs, destroyTimeoutId, status, endingReason }
const sessions = new Map();

// Map socketId -> { sessionId, participantId }
const socketToParticipant = new Map();

// In-memory ephemeral file store: fileId -> { buffer, mimetype, originalname, size, sessionId, uploadedBy, uploadedAt }
const ephemeralFiles = new Map();

// Multer configured strictly for in-memory storage (zero disk writes)
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760', 10);
const MAX_PDF_SIZE = parseInt(process.env.MAX_PDF_SIZE || '26214400', 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_IMAGE_SIZE, MAX_PDF_SIZE) },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  },
});

function getSessionRoom(sessionId) {
  return `ephemeral_session_${sessionId.toUpperCase()}`;
}

function getParticipantsArray(session) {
  if (!session || !session.participants) return [];
  return Array.from(session.participants.values()).map((p) => ({
    participantId: p.participantId,
    username: p.username,
    isOwner: p.isOwner,
    joinedAt: p.joinedAt,
  }));
}

/**
 * Initiates graceful multi-stage destruction countdown (5s warning + 10s countdown)
 */
async function initiateSessionDestruction(sessionId, reason) {
  const normId = sessionId.toUpperCase();
  const session = sessions.get(normId);
  if (!session) return;

  if (session.status === 'ENDING' || session.status === 'DESTROYED') {
    return;
  }

  session.status = 'ENDING';
  session.endingReason = reason;
  session.warningDurationMs = 5000;
  session.countdownDurationMs = 10000;
  const totalDuration = session.warningDurationMs + session.countdownDurationMs; // 15s total
  session.destroyAt = Date.now() + totalDuration;

  // Persist status change to database
  await updateSessionStatus(normId, 'ENDING', reason);

  const room = getSessionRoom(normId);
  io.to(room).emit('session-ending', {
    sessionId: normId,
    reason,
    destroyAt: session.destroyAt,
    warningDurationMs: session.warningDurationMs,
    countdownDurationMs: session.countdownDurationMs,
    totalDurationMs: totalDuration,
  });

  // Schedule hard destruction and memory/DB metadata purge
  session.destroyTimeoutId = setTimeout(async () => {
    await executeHardDestruction(normId);
  }, totalDuration);
}

/**
 * Executes hard destruction of session: purges RAM state, deletes DB metadata, and purges all temporary files
 */
async function executeHardDestruction(sessionId) {
  const normId = sessionId.toUpperCase();
  const session = sessions.get(normId);
  const room = getSessionRoom(normId);

  // 1. Broadcast terminal destruction event to connected clients
  io.to(room).emit('session-destroyed', {
    sessionId: normId,
    message: 'Session destroyed. All state and metadata have been completely purged.',
    timestamp: Date.now(),
  });

  // 2. Disconnect all sockets from room
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

  // 3. Clear timers and purge RAM session state
  if (session) {
    if (session.destroyTimeoutId) {
      clearTimeout(session.destroyTimeoutId);
    }
    session.participants.clear();
    session.bannedParticipantIds.clear();
    sessions.delete(normId);
  }

  // 4. Purge all ephemeral files belonging to this session from RAM
  for (const [fileId, meta] of ephemeralFiles) {
    if (meta.sessionId === normId) {
      ephemeralFiles.delete(fileId);
    }
  }

  // 5. Delete persistent session metadata and bans from database (Section 40)
  await deleteSessionRecord(normId);

  console.log({ event: 'session-destroyed', sessionId: normId });
}

// REST endpoints
app.use(express.json());

app.get('/api/health', async (req, res) => {
  const dbStatus = getConnectionStatus();
  let dbSessionsCount = 0;
  let dbBansCount = 0;

  if (dbStatus.connected) {
    try {
      dbSessionsCount = await Session.countDocuments();
      dbBansCount = await SessionBan.countDocuments();
    } catch (e) {
      // ignore
    }
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    activeRAMSessionsCount: sessions.size,
    dbSessionsCount,
    dbBansCount,
    timestamp: Date.now(),
  });
});

app.get('/api/db-status', async (req, res) => {
  try {
    const dbStatus = getConnectionStatus();
    let sessionsInDb = [];
    let bansInDb = [];

    if (dbStatus.connected) {
      sessionsInDb = await Session.find().lean();
      bansInDb = await SessionBan.find().lean();
    }

    res.json({
      status: 'ok',
      database: dbStatus,
      documentsInSessions: sessionsInDb,
      documentsInBans: bansInDb,
      inMemoryActiveSessions: Array.from(sessions.keys()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/session/:sessionId/check', async (req, res) => {
  try {
    const sessionId = (req.params.sessionId || '').toUpperCase();
    const dbRecord = await findSessionRecord(sessionId);

    if (!dbRecord) {
      return res.json({ exists: false, status: 'NOT_FOUND' });
    }

    const ramSession = sessions.get(sessionId);

    return res.json({
      exists: true,
      status: dbRecord.status,
      createdAt: dbRecord.createdAt,
      participantCount: ramSession ? ramSession.participants.size : 0,
    });
  } catch (err) {
    return res.status(500).json({ exists: false, status: 'ERROR' });
  }
});

// --- File Transfer Routes (Phase 2 Ephemeral Media) ---

// POST /api/files/upload
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
      if (err.message === 'INVALID_FILE_TYPE') {
        return res.status(415).json({ success: false, code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, GIF, WebP images and PDFs are allowed.' });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, code: 'FILE_TOO_LARGE', message: 'File exceeds the maximum allowed size.' });
      }
      return res.status(500).json({ success: false, code: 'UPLOAD_ERROR', message: 'Upload failed.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, code: 'NO_FILE', message: 'No file was provided.' });
    }

    const { mimetype, originalname, size, buffer } = req.file;
    const isPdf = mimetype === 'application/pdf';
    const sizeLimit = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;

    if (size > sizeLimit) {
      return res.status(413).json({
        success: false,
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the ${isPdf ? 'PDF' : 'image'} size limit of ${Math.round(sizeLimit / 1048576)} MB.`,
      });
    }

    const fileId = crypto.randomUUID();
    ephemeralFiles.set(fileId, {
      buffer,
      mimetype,
      originalname,
      size,
      sessionId,
      uploadedBy: participantId,
      uploadedAt: Date.now(),
    });

    const participant = session.participants.get(participantId);
    const room = getSessionRoom(sessionId);
    const caption = (req.body.caption || '').trim().slice(0, 500);

    // Broadcast file message to all session participants via Socket.IO
    io.to(room).emit('receive-file', {
      messageId: crypto.randomUUID(),
      fileId,
      senderId: participantId,
      senderName: participant?.username || 'Unknown',
      isOwner: participant?.isOwner || false,
      fileName: originalname,
      fileSize: size,
      mimeType: mimetype,
      fileType: isPdf ? 'pdf' : 'image',
      text: caption,
      timestamp: Date.now(),
    });

    return res.json({ success: true, fileId, fileName: originalname, fileSize: size, mimeType: mimetype });
  });
});

// GET /api/files/:fileId — serve or download the ephemeral file
app.get('/api/files/:fileId', (req, res) => {
  const { fileId } = req.params;
  const sessionId = (req.query.sessionId || '').toUpperCase();
  const participantId = req.query.participantId || '';
  const forceDownload = req.query.download === 'true';

  const file = ephemeralFiles.get(fileId);
  if (!file) {
    return res.status(404).json({ success: false, code: 'FILE_NOT_FOUND', message: 'File not found or session has ended.' });
  }

  // Validate requester is in the same session
  const session = sessions.get(sessionId);
  if (!session || file.sessionId !== sessionId || !session.participants.has(participantId)) {
    return res.status(403).json({ success: false, code: 'UNAUTHORIZED', message: 'Access denied.' });
  }

  res.set('Content-Type', file.mimetype);
  res.set('Content-Length', file.size);
  if (forceDownload) {
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalname)}"`);
  } else {
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalname)}"`);
  }
  return res.send(file.buffer);
});

// --- Socket.IO Event Handlers ---
io.on('connection', (socket) => {
  // 1. Create Session (Owner)
  socket.on('create-session', async (payload = {}, callback) => {
    try {
      const username = (payload.username || 'Session Creator').trim().slice(0, 32);

      // Unique Session ID generation with database and RAM collision check
      let sessionId = generateSessionId();
      while ((await isSessionIdTaken(sessionId)) || sessions.has(sessionId)) {
        sessionId = generateSessionId();
      }

      // Generate high-entropy passkey and compute secure hash
      const passkey = generatePasskey();
      const passkeyHash = await hashPasskey(passkey);
      const ownerParticipantId = crypto.randomUUID();

      // 1. Persist minimal session metadata to Database (Passkey hash only, no plain passkey)
      await createSessionRecord({
        sessionId,
        ownerParticipantId,
        passkeyHash,
        status: 'ACTIVE',
      });

      // 2. Initialize RAM-Only Ephemeral State
      const session = {
        sessionId,
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
        destroyTimeoutId: null,
      };

      const ownerParticipant = {
        participantId: ownerParticipantId,
        username,
        socketId: socket.id,
        joinedAt: Date.now(),
        isOwner: true,
      };

      session.participants.set(ownerParticipantId, ownerParticipant);
      sessions.set(sessionId, session);
      socketToParticipant.set(socket.id, { sessionId, participantId: ownerParticipantId });

      const room = getSessionRoom(sessionId);
      socket.join(room);

      console.log({ event: 'session-created', sessionId });

      const response = {
        success: true,
        sessionId,
        passkey, // returned to owner only so they can share it
        participantId: ownerParticipantId,
        username,
        isOwner: true,
        participants: getParticipantsArray(session),
      };

      if (typeof callback === 'function') callback(response);
      else socket.emit('session-created', response);
    } catch (err) {
      console.error('[Socket] create-session error:', err.message);
      const errRes = { success: false, message: 'Unable to create session' };
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // 2. Join Session
  socket.on('join-session', async (payload = {}, callback) => {
    try {
      const reqSessionId = (payload.sessionId || '').trim().toUpperCase();
      const reqPasskey = (payload.passkey || '').trim().toUpperCase();
      const reqUsername = (payload.username || 'Anonymous').trim().slice(0, 32) || 'Participant';
      const existingParticipantId = payload.participantId;

      // 1. Authoritative lookup in Database metadata
      const dbRecord = await findSessionRecord(reqSessionId);

      if (!dbRecord) {
        const errorRes = { success: false, code: 'SESSION_NOT_FOUND', message: 'Session does not exist or was destroyed.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 2. Session Status validation
      if (dbRecord.status !== 'ACTIVE') {
        const errorRes = { success: false, code: 'SESSION_ENDING', message: 'Session is ending or destroyed and cannot accept new joiners.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 3. Cryptographic Passkey Verification against secure hash
      const isPasskeyValid = await verifyPasskey(reqPasskey, dbRecord.passkeyHash);
      if (!isPasskeyValid) {
        const errorRes = { success: false, code: 'INVALID_PASSKEY', message: 'Invalid session passkey. Verification failed.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 4. Session Ban validation (Database & RAM)
      if (existingParticipantId) {
        const isBanned = await isParticipantBanned(reqSessionId, existingParticipantId);
        if (isBanned) {
          const errorRes = { success: false, code: 'PARTICIPANT_BANNED', message: 'You have been removed by the owner and are banned from this session.' };
          if (typeof callback === 'function') return callback(errorRes);
          return socket.emit('join-error', errorRes);
        }
      }

      // 5. Establish/Attach RAM Session State
      let session = sessions.get(reqSessionId);
      if (!session) {
        session = {
          sessionId: reqSessionId,
          ownerParticipantId: dbRecord.ownerParticipantId,
          ownerSocketId: null,
          participants: new Map(),
          bannedParticipantIds: new Set(),
          status: dbRecord.status,
          createdAt: dbRecord.createdAt ? new Date(dbRecord.createdAt).getTime() : Date.now(),
          destroyAt: null,
          endingReason: null,
          warningDurationMs: 5000,
          countdownDurationMs: 10000,
          destroyTimeoutId: null,
        };
        sessions.set(reqSessionId, session);
      }

      const participantId = existingParticipantId || crypto.randomUUID();
      const isOwner = participantId === dbRecord.ownerParticipantId;

      const participant = {
        participantId,
        username: reqUsername,
        socketId: socket.id,
        joinedAt: Date.now(),
        isOwner,
      };

      session.participants.set(participantId, participant);
      if (isOwner) {
        session.ownerSocketId = socket.id;
      }
      socketToParticipant.set(socket.id, { sessionId: reqSessionId, participantId });

      const room = getSessionRoom(reqSessionId);
      socket.join(room);

      const participantsList = getParticipantsArray(session);

      const successRes = {
        success: true,
        sessionId: reqSessionId,
        participantId,
        username: reqUsername,
        isOwner,
        participants: participantsList,
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
        },
        participants: participantsList,
      });
    } catch (err) {
      console.error('[Socket] join-session error:', err.message);
      const errRes = { success: false, code: 'SERVER_ERROR', message: 'Unexpected server error during join.' };
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // 3. Send Message (Strictly Ephemeral Socket.IO Relay Only — Never Persisted in DB or Disk)
  socket.on('send-message', (payload = {}, callback) => {
    try {
      const { sessionId, participantId, text } = payload;
      const normId = sessionId?.toUpperCase();
      const session = sessions.get(normId);

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

      const room = getSessionRoom(normId);
      // Immediately broadcast to all in room without saving to any collection or log
      io.to(room).emit('receive-message', messageObject);

      if (typeof callback === 'function') callback({ success: true, messageId: messageObject.messageId });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: 'Failed to relay message' });
    }
  });

  // 4. Typing Indicator
  socket.on('typing', (payload = {}) => {
    const { sessionId, participantId, isTyping } = payload;
    const normId = sessionId?.toUpperCase();
    const session = sessions.get(normId);
    if (!session || session.status !== 'ACTIVE') return;

    const participant = session.participants.get(participantId);
    if (!participant) return;

    const room = getSessionRoom(normId);
    socket.to(room).emit('user-typing', {
      participantId,
      username: participant.username,
      isTyping: Boolean(isTyping),
    });
  });

  // 5. Owner Kicks Participant
  socket.on('kick-participant', async (payload = {}, callback) => {
    try {
      const { sessionId, participantId, targetParticipantId } = payload;
      const normId = sessionId?.toUpperCase();
      const session = sessions.get(normId);

      if (!session) {
        if (typeof callback === 'function') callback({ success: false, message: 'Session not found' });
        return;
      }

      // Check requester is owner
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

      // 1. Mark as permanently banned in this session in RAM and DB
      session.bannedParticipantIds.add(targetParticipantId);
      await addSessionBan(normId, targetParticipantId);

      // 2. Disconnect target socket and notify them
      const targetSocket = io.sockets.sockets.get(target.socketId);
      const room = getSessionRoom(normId);

      if (targetSocket) {
        targetSocket.emit('participant-kicked-self', {
          reason: 'You were kicked from this session by the owner.',
          sessionId: normId,
        });
        targetSocket.leave(room);
        socketToParticipant.delete(target.socketId);
      }

      // 3. Remove from active participants
      session.participants.delete(targetParticipantId);
      const updatedList = getParticipantsArray(session);

      // 4. Notify remaining participants
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

  // 6. Voluntary Participant Leave
  socket.on('leave-session', async (payload = {}, callback) => {
    try {
      const { sessionId, participantId } = payload;
      const normId = sessionId?.toUpperCase();
      const session = sessions.get(normId);

      if (session) {
        const participant = session.participants.get(participantId);
        if (participant) {
          // If owner leaves voluntarily, initiate session termination!
          if (participant.isOwner) {
            await initiateSessionDestruction(normId, 'OWNER_LEFT');
          } else {
            session.participants.delete(participantId);
            const room = getSessionRoom(normId);
            socket.leave(room);
            socketToParticipant.delete(socket.id);

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

  // 7. Owner Explicitly Ends Session
  socket.on('end-session', async (payload = {}, callback) => {
    try {
      const { sessionId, participantId } = payload;
      const normId = sessionId?.toUpperCase();
      const session = sessions.get(normId);

      if (!session) {
        if (typeof callback === 'function') callback({ success: false, message: 'Session not found' });
        return;
      }

      if (participantId !== session.ownerParticipantId) {
        if (typeof callback === 'function') callback({ success: false, message: 'Only session owner can end the session.' });
        return;
      }

      await initiateSessionDestruction(normId, 'OWNER_ENDED');
      if (typeof callback === 'function') callback({ success: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: 'Error ending session' });
    }
  });

  // 8. Socket Disconnection Handler
  socket.on('disconnect', async () => {
    const record = socketToParticipant.get(socket.id);
    if (!record) return;

    socketToParticipant.delete(socket.id);
    const { sessionId, participantId } = record;
    const normId = sessionId.toUpperCase();
    const session = sessions.get(normId);
    if (!session) return;

    const participant = session.participants.get(participantId);
    if (!participant) return;

    // Check if the disconnected user is the Owner of an ACTIVE session
    if (participant.isOwner && session.status === 'ACTIVE') {
      await initiateSessionDestruction(normId, 'OWNER_LEFT');
    } else if (!participant.isOwner && session.status === 'ACTIVE') {
      session.participants.delete(participantId);
      const room = getSessionRoom(normId);
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
  // Connect to MongoDB
  await connectDatabase();

  // Initialize automated cleanup for expired sessions and abandoned files
  initSessionCleanup(ephemeralFiles, sessions);

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
    console.log(`Plutus Chat server running on http://localhost:${PORT}`);
  });
}

startServer();