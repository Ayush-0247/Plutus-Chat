<div align="center">

# 🔒 Plutus Chat

### Ephemeral • Secure • Zero-Persistence

**A RAM-only secure communication platform built for conversations that leave no trace.**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![MongoDB](https://img.shields.io/badge/MongoDB-Optional-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## 📖 Overview

Plutus Chat is a **browser-based ephemeral secure messaging platform**. Every session lives entirely in Node.js RAM, messages are relayed via Socket.IO without any database persistence, and when a session ends the entire state — messages, files, metadata — is completely purged.

Key design principles:

- ✅ **Zero message persistence** — messages are never written to disk or database
- ✅ **Ephemeral file sharing** — images and PDFs live in server RAM only, purged on session end
- ✅ **Cryptographic passkeys** — bcrypt-hashed before storage; plain text is never persisted
- ✅ **Owner-controlled lifecycle** — owner departure triggers a graceful 15-second destruction countdown
- ✅ **Invite links** — share `?join=SESSIONID&key=PASSKEY` URLs for one-click joining
- ✅ **Works without MongoDB** — falls back to in-memory metadata store automatically

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│  HomeView → CreateSession / JoinSession → ActiveSession  │
│         Socket.IO Client  +  XHR File Upload            │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket + HTTP
┌──────────────────────▼──────────────────────────────────┐
│                  server.js  (Express + Socket.IO)        │
│                                                          │
│  RAM State                    REST Endpoints             │
│  ┌─────────────────┐   GET  /api/health                  │
│  │ sessions Map     │   GET  /api/db-status              │
│  │  ├─ participants │   GET  /api/session/:id/check      │
│  │  ├─ bannedIds    │   POST /api/files/upload           │
│  │  └─ destroyTimer │   GET  /api/files/:fileId          │
│  └─────────────────┘                                     │
│  ephemeralFiles Map (buffer, mimetype, sessionId)        │
│  socketToParticipant Map                                 │
└──────────────────────┬──────────────────────────────────┘
                       │ Mongoose (optional)
┌──────────────────────▼──────────────────────────────────┐
│  MongoDB Atlas  (session metadata + ban records only)    │
│   Collection: sessions    Collection: sessionbans        │
│   ─ sessionId             ─ sessionId                    │
│   ─ ownerParticipantId    ─ participantId                │
│   ─ passkeyHash           ─ bannedAt                     │
│   ─ status / createdAt / expiresAt / endingReason        │
└─────────────────────────────────────────────────────────┘
```

> **What is NEVER stored:** message content, file data on disk, plaintext passkeys, or any participant PII.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (22+ recommended)
- **MongoDB Atlas URI** *(optional — falls back to in-memory store)*

### 1. Clone & Install

```bash
git clone <repo-url>
cd ephemeral-secure-communication-line
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/plutus

# File size limits (bytes)
MAX_IMAGE_SIZE=10485760    # 10 MB
MAX_PDF_SIZE=26214400      # 25 MB
```

> If `MONGODB_URI` is not set, the server operates in fully in-memory mode — functional but metadata does not survive restarts.

### 3. Start the Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (Express + Vite HMR middleware) |
| `npm run build` | Build React SPA with Vite + bundle server.js with esbuild |
| `npm start` | Serve production build from `dist/` |
| `npm run preview` | Preview the Vite production build locally |
| `npm run clean` | Delete the `dist/` directory |

---

## 🔐 Session Lifecycle

```
[Owner creates session]
        │
        ▼
  RAM:  session object initialized
  DB:   metadata record persisted (passkeyHash only, no plain passkey)
  ← Owner receives: sessionId + plaintext passkey (to share out-of-band)
        │
        ▼
  [Participants join — sessionId + passkey]
  Passkey verified via bcrypt compare against stored hash
  Ban check: DB SessionBan collection + RAM Set
        │
        ▼
  [Active session]
  Text messages: Socket.IO relay only, never stored anywhere
  Files: HTTP upload → Multer memoryStorage → RAM Map → Socket.IO broadcast
        │
        ▼
  [Trigger: owner disconnects / voluntarily leaves / calls end-session]
        │
        ▼
  ⚡ session-ending broadcast (5 s warning + 10 s countdown = 15 s total)
        │
        ▼
  ⚡ session-destroyed broadcast
  RAM:  participants Map, bannedIds Set, ephemeral files — all cleared
  DB:   Session document + SessionBan documents deleted (hard delete)
```

---

## 🌐 REST API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | None | Server health, DB connection state, active session count |
| `GET` | `/api/db-status` | None | Full DB document dump (debug endpoint) |
| `GET` | `/api/session/:sessionId/check` | None | Check session existence and status |
| `POST` | `/api/files/upload` | Headers | Upload image or PDF (multipart/form-data) |
| `GET` | `/api/files/:fileId` | Query params | Stream or force-download an ephemeral file |

### File Upload (`POST /api/files/upload`)

**Required headers:**
```
x-session-id: <SESSION_ID>
x-participant-id: <PARTICIPANT_UUID>
Content-Type: multipart/form-data
```

**Form fields:**
- `file` — the file to upload
- `caption` *(optional)* — up to 500 characters

**Supported MIME types:**
- `image/jpeg`, `image/png`, `image/gif`, `image/webp` (≤ `MAX_IMAGE_SIZE`)
- `application/pdf` (≤ `MAX_PDF_SIZE`)

### File Retrieval (`GET /api/files/:fileId`)

**Query parameters:**
- `sessionId` — required
- `participantId` — required (must be active participant in that session)
- `download=true` — triggers `Content-Disposition: attachment` instead of inline

---

## ⚡ Socket.IO Event Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create-session` | `{ username }` | Create a new ephemeral session; owner receives passkey in callback |
| `join-session` | `{ sessionId, passkey, username, participantId? }` | Join an existing session with passkey verification |
| `send-message` | `{ sessionId, participantId, text }` | Relay a text message to all participants |
| `typing` | `{ sessionId, participantId, isTyping }` | Broadcast typing indicator state |
| `kick-participant` | `{ sessionId, participantId, targetParticipantId }` | Owner permanently bans + removes a participant |
| `leave-session` | `{ sessionId, participantId }` | Participant voluntarily leaves |
| `end-session` | `{ sessionId, participantId }` | Owner initiates destruction countdown |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `session-created` | `{ sessionId, passkey, participantId, username, isOwner, participants }` | Session created; passkey visible only here |
| `join-success` | `{ sessionId, participantId, username, isOwner, participants }` | Successfully joined |
| `join-error` | `{ code, message }` | Join failure (`SESSION_NOT_FOUND`, `INVALID_PASSKEY`, `PARTICIPANT_BANNED`, `SESSION_ENDING`) |
| `participant-joined` | `{ participant, participants }` | Another user joined |
| `participant-left` | `{ participantId, username, participants }` | Participant left voluntarily |
| `participant-kicked` | `{ kickedParticipantId, username, participants }` | Participant was kicked (broadcast to room) |
| `participant-kicked-self` | `{ reason, sessionId }` | Sent privately to the kicked participant |
| `receive-message` | `{ messageId, senderId, senderName, isOwner, text, timestamp }` | Incoming text message |
| `receive-file` | `{ messageId, fileId, senderId, senderName, fileName, fileSize, mimeType, fileType, text, timestamp }` | Incoming file announcement |
| `user-typing` | `{ participantId, username, isTyping }` | Typing indicator from another user |
| `session-ending` | `{ sessionId, reason, destroyAt, warningDurationMs, countdownDurationMs, totalDurationMs }` | Countdown started |
| `session-destroyed` | `{ sessionId, message, timestamp }` | Session fully purged — clients should redirect |

### Destruction Reason Codes

| Code | Trigger |
|------|---------|
| `OWNER_LEFT` | Owner socket disconnected or called `leave-session` |
| `OWNER_ENDED` | Owner explicitly emitted `end-session` |

---

## 🗂️ Project Structure

```
plutus-chat/
├── server.js                          # Main Express + Socket.IO server
├── vite.config.js                     # Vite (React + Tailwind CSS v4)
├── render.yaml                        # Render.com deployment spec
├── .env.example                       # Environment variable template
│
├── src/
│   ├── main.jsx                       # React entry point
│   ├── App.jsx                        # Root — Socket.IO event wiring + UI state machine
│   ├── index.css                      # Global stylesheet
│   │
│   ├── components/
│   │   ├── Navbar.jsx                 # Navigation bar + WebSocket connection badge
│   │   ├── HomeView.jsx               # Landing page (Create / Join CTAs)
│   │   ├── CreateSessionView.jsx      # Session creation form
│   │   ├── JoinSessionView.jsx        # Session join form (invite-link auto-fill)
│   │   ├── ActiveSessionView.jsx      # Main chat interface (messages, participants)
│   │   ├── EndingCountdownModal.jsx   # Destruction countdown overlay
│   │   ├── DestroyedScreen.jsx        # Shown after session is purged
│   │   ├── KickedScreen.jsx           # Shown to kicked participant
│   │   ├── AttachmentModal.jsx        # File/image upload UI with progress
│   │   ├── ImageLightboxModal.jsx     # Fullscreen image lightbox
│   │   ├── PdfViewerModal.jsx         # In-browser PDF viewer
│   │   └── ArchitectureModal.jsx      # Architecture diagram + info modal
│   │
│   ├── services/
│   │   ├── socket.js                  # Socket.IO client singleton + reconnect config
│   │   ├── api.js                     # XHR file upload with progress + URL helpers
│   │   └── soundEffects.js            # Web Audio API synthesized notification sounds
│   │
│   └── server/
│       ├── config/
│       │   └── database.js            # Mongoose connect + connection state helpers
│       ├── models/
│       │   ├── Session.js             # Session metadata schema
│       │   └── SessionBan.js          # Participant ban schema (composite index)
│       ├── services/
│       │   ├── sessionService.js      # Session/ban CRUD with in-memory fallback
│       │   └── authenticationService.js  # bcrypt passkey hash + verify
│       └── utils/
│           ├── generateSessionId.js   # 6-char unambiguous crypto-random IDs
│           ├── generatePasskey.js     # Word-number passkey (e.g. RAVEN-742)
│           └── sessionCleanup.js      # Background cleanup (every 10 min)
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server listen port |
| `NODE_ENV` | `development` | `development` uses Vite middleware; `production` serves `dist/` |
| `MONGODB_URI` | _(none)_ | MongoDB connection URI. Omit to use in-memory fallback |
| `VITE_SERVER_URL` | _(auto)_ | Override Socket.IO server URL (useful behind reverse proxies) |
| `MAX_IMAGE_SIZE` | `10485760` | Max image upload size in bytes (10 MB) |
| `MAX_PDF_SIZE` | `26214400` | Max PDF upload size in bytes (25 MB) |

---

## 🚢 Deployment

### Render.com (Recommended)

The project includes `render.yaml` for one-click deployment:

1. Push repository to GitHub
2. In Render dashboard: **New → Web Service → Connect repo**
3. Render auto-detects `render.yaml` build/start commands
4. Add environment variables:
   - `MONGODB_URI` — MongoDB Atlas connection string
   - `NODE_ENV=production`
5. Deploy

### Production Build (Manual)

```bash
npm run build
NODE_ENV=production node dist/server.cjs
```

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

---

## 🔊 Sound Effects

Plutus Chat synthesizes all sounds via the **Web Audio API** — no audio files required:

| Event | Sound |
|-------|-------|
| Message received | Two-step ascending chime (D5 → A5) |
| File received | Three-step ascending chord (E5 → A5 → C6) |
| User joined | Rising sweep (C5 → E5) |
| User left / kicked | Descending sweep (E5 → A4) |
| Countdown tick (normal) | Single 440 Hz sine pulse |
| Countdown tick (urgent) | Single 880 Hz sawtooth pulse |
| Session purged | Descending tone (220 Hz → 110 Hz) |

---

## 🛡️ Security Notes

- **Passkeys** are bcrypt-hashed (10 rounds) before DB storage — raw passkey never persisted
- **Messages** are never stored — relay-only via Socket.IO `io.to(room).emit`
- **Files** use Multer `memoryStorage()` — zero disk writes at any point
- **Session destruction** hard-deletes both the `Session` document and all `SessionBan` documents
- **Ban enforcement** is dual-layer: RAM `Set` (fast O(1)) + MongoDB `SessionBan` (survives server restart)
- **Invite link passkeys** appear in URL query string — share only via secure, trusted channels

---

## 📄 License

MIT © Ayush — Plutus Chat
