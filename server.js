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
    methods: ['GET', 'POST'],
  },
});


const PORT = process.env.PORT || 3000;

const sessions = new Map();
// Map socketId -> { sessionId, participantId }
const socketToParticipant = new Map();

// In-memory ephemeral file store: fileId -> { buffer, mimetype, originalname, size, sessionId, uploadedBy, uploadedAt }
const ephemeralFiles = new Map();

// Multer configured for in-memory storage (zero disk writes)
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
    'RAVEN', 'SOLAR', 'TITAN', 'VORTEX', 'ZENITH'
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

  // Broadcast terminal destruction event
  io.to(room).emit('session-destroyed', {
    sessionId,
    message: 'Session destroyed. All state has been completely purged from server RAM.',
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

  // Purge all ephemeral files belonging to this session
  for (const [fileId, meta] of ephemeralFiles) {
    if (meta.sessionId === sessionId) {
      ephemeralFiles.delete(fileId);
    }
  }
}

// REST endpoints for basic diagnostics
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessionsCount: sessions.size,
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

// --- File Transfer Routes (Phase 2) ---

// POST /api/files/upload
app.post('/api/files/upload', (req, res, next) => {
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
      return res.status(500).json({ success: false, code: 'UPLOAD_ERROR', message: err.message || 'Upload failed.' });
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
    const room = `ephemeral_session_${sessionId}`;
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

// GET /api/files/:fileId  — serve or download the file
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

// Socket.IO Event Handlers
io.on('connection', (socket) => {
  // 1. Create Session (Owner)
  socket.on('create-session', (payload = {}, callback) => {
    try {
      const username = (payload.username || 'Session Creator').trim().slice(0, 32);
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

      const response = {
        success: true,
        sessionId,
        passkey,
        participantId: ownerParticipantId,
        username,
        isOwner: true,
        participants: getParticipantsArray(session),
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

      const session = sessions.get(reqSessionId);

      // Decision Tree:
      // 1. Session exists?
      if (!session) {
        const errorRes = { success: false, code: 'SESSION_NOT_FOUND', message: 'Session does not exist or was destroyed.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 2. Session ACTIVE?
      if (session.status !== 'ACTIVE') {
        const errorRes = { success: false, code: 'SESSION_ENDING', message: 'Session is ending or destroyed and cannot accept new joiners.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 3. Passkey valid?
      if (session.passkey.toUpperCase() !== reqPasskey) {
        const errorRes = { success: false, code: 'INVALID_PASSKEY', message: 'Invalid session passkey. Verification failed.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 4. Participant banned?
      if (existingParticipantId && session.bannedParticipantIds.has(existingParticipantId)) {
        const errorRes = { success: false, code: 'PARTICIPANT_BANNED', message: 'You have been removed by the owner and are banned from this session.' };
        if (typeof callback === 'function') return callback(errorRes);
        return socket.emit('join-error', errorRes);
      }

      // 5. Allow Join
      const participantId = existingParticipantId || crypto.randomUUID();
      const isOwner = participantId === session.ownerParticipantId;

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
      const errRes = { success: false, code: 'SERVER_ERROR', message: 'Unexpected server error during join.' };
      if (typeof callback === 'function') callback(errRes);
    }
  });

  // 3. Send Message (Ephemeral Relay Only, No Database)
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
      // Immediately broadcast to all in the room
      io.to(room).emit('receive-message', messageObject);

      if (typeof callback === 'function') callback({ success: true, messageId: messageObject.messageId });
    } catch (err) {
      if (typeof callback === 'function') callback({ success: false, message: 'Failed to relay message' });
    }
  });

  // 4. Typing Indicator
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

  // 5. Owner Kicks Participant
  socket.on('kick-participant', (payload = {}, callback) => {
    try {
      const { sessionId, participantId, targetParticipantId } = payload;
      const session = sessions.get(sessionId?.toUpperCase());

      if (!session) {
        if (typeof callback === 'function') callback({ success: false, message: 'Session not found' });
        return;
      }

      // Check requester is the owner
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

      // 1. Mark as permanently banned in this session
      session.bannedParticipantIds.add(targetParticipantId);

      // 2. Disconnect target socket and notify them
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
  socket.on('leave-session', (payload = {}, callback) => {
    try {
      const { sessionId, participantId } = payload;
      const session = sessions.get(sessionId?.toUpperCase());

      if (session) {
        const participant = session.participants.get(participantId);
        if (participant) {
          // If owner chooses to leave voluntarily, it triggers session termination!
          if (participant.isOwner) {
            initiateSessionDestruction(session, 'OWNER_LEFT');
          } else {
            session.participants.delete(participantId);
            const room = getSessionRoom(session.sessionId);
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

  // 8. Socket Disconnection Handler
  socket.on('disconnect', () => {
    const record = socketToParticipant.get(socket.id);
    if (!record) return;

    socketToParticipant.delete(socket.id);
    const { sessionId, participantId } = record;
    const session = sessions.get(sessionId);
    if (!session) return;

    const participant = session.participants.get(participantId);
    if (!participant) return;

    // Check if the disconnected user is the Owner of an ACTIVE session
    if (participant.isOwner && session.status === 'ACTIVE') {
      // Owner disconnect causes session termination as per PRD Invariant 8
      initiateSessionDestruction(session, 'OWNER_LEFT');
    } else if (!participant.isOwner && session.status === 'ACTIVE') {
      // Regular participant disconnected
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
