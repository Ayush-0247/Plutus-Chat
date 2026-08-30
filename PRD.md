# PRD — Plutus Secure Line

### Product Requirements Document · Version 2.0 · Last Updated: 2026-08-30

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Philosophy & Design Principles](#2-core-philosophy--design-principles)
3. [User Roles](#3-user-roles)
4. [Feature Requirements](#4-feature-requirements)
   - [FR-01 Session Creation](#fr-01-session-creation)
   - [FR-02 Session Joining](#fr-02-session-joining)
   - [FR-03 Real-Time Messaging](#fr-03-real-time-messaging)
   - [FR-04 File Transfer (Images & PDFs)](#fr-04-file-transfer-images--pdfs)
   - [FR-05 Invite Link System](#fr-05-invite-link-system)
   - [FR-06 Participant Management & Kick System](#fr-06-participant-management--kick-system)
   - [FR-07 Session Termination & Destruction](#fr-07-session-termination--destruction)
   - [FR-08 Typing Indicators](#fr-08-typing-indicators)
   - [FR-09 Sound Effects System](#fr-09-sound-effects-system)
   - [FR-10 Image Viewer](#fr-10-image-viewer)
   - [FR-11 PDF Viewer](#fr-11-pdf-viewer)
   - [FR-12 Drag & Drop File Upload](#fr-12-drag--drop-file-upload)
5. [Non-Functional Requirements](#5-non-functional-requirements)
   - [NFR-01 Ephemeral Data Guarantee](#nfr-01-ephemeral-data-guarantee)
   - [NFR-02 Security & Authentication](#nfr-02-security--authentication)
   - [NFR-03 Performance](#nfr-03-performance)
   - [NFR-04 Resilience & Graceful Degradation](#nfr-04-resilience--graceful-degradation)
   - [NFR-05 Deployment & Infrastructure](#nfr-05-deployment--infrastructure)
6. [Architecture Requirements](#6-architecture-requirements)
   - [AR-01 Two-Layer State Model](#ar-01-two-layer-state-model)
   - [AR-02 RAM Layer (Ephemeral)](#ar-02-ram-layer-ephemeral)
   - [AR-03 Database Layer (Minimal Persistent Metadata)](#ar-03-database-layer-minimal-persistent-metadata)
   - [AR-04 WebSocket Transport](#ar-04-websocket-transport)
   - [AR-05 HTTP File Transport](#ar-05-http-file-transport)
   - [AR-06 Module Structure](#ar-06-module-structure)
7. [Data Models](#7-data-models)
8. [API Contracts](#8-api-contracts)
   - [Socket.IO Events](#socketio-events)
   - [HTTP REST Endpoints](#http-rest-endpoints)
9. [Limits & Constraints](#9-limits--constraints)
10. [UI States & Navigation Flow](#10-ui-states--navigation-flow)
11. [Session Lifecycle State Machine](#11-session-lifecycle-state-machine)
12. [Security Model](#12-security-model)
13. [Known Limitations & Out of Scope](#13-known-limitations--out-of-scope)
14. [Tech Stack](#14-tech-stack)
15. [Environment Variables](#15-environment-variables)
16. [Deployment](#16-deployment)

---

## 1. Product Overview

**Plutus Secure Line** is a real-time, owner-controlled, ephemeral communication platform. It allows users to create temporary, passkey-protected chat sessions that exist purely in server RAM and are completely and irreversibly destroyed when the session owner leaves or terminates.

### What it is

- A temporary, invite-only group communication channel
- Protected by cryptographic session IDs and bcrypt-hashed passkeys
- Supports text, images (JPEG/PNG/WEBP/GIF), and PDF file sharing
- Automatically self-destructs on owner departure with a 15-second countdown
- Zero persistent communication content — no messages, files, or participant records stored in any database

### What it is NOT

- A persistent messaging app (no chat history, no user accounts)
- An end-to-end encrypted platform (server relays plaintext over HTTPS/WSS)
- A file storage service (files exist only in RAM for the session duration)
- A multi-tenant platform (no organisations, workspaces, or user profiles)

---

## 2. Core Philosophy & Design Principles

### Principle 1 — Ephemeral by Architecture, Not by Policy

The system does not "delete" messages after the fact. Messages are never stored in the first place. The server relays them through RAM in microseconds and discards them. This is a hard architectural constraint, not a configurable policy.

### Principle 2 — The Database Stores Metadata, Not Communication

The only data in MongoDB is:

- `sessionId`, `ownerParticipantId`, `passkeyHash`, `status`, timestamps
- Participant ban records (per session)

The database does **not** contain: messages, file data, participant names, or typing state.

### Principle 3 — Owner Supremacy

The session creator (owner) has absolute authority:

- Can kick and permanently ban any participant
- Is the only one who can end the session
- Their departure automatically triggers destruction for all participants

### Principle 4 — Complete and Verifiable Destruction

When a session is destroyed:

1. RAM session state is cleared (participants, timers, ban sets)
2. All ephemeral file buffers are deleted from RAM
3. MongoDB session document is deleted
4. MongoDB ban records for that session are deleted
5. All sockets leave the room
6. Each browser receives a destruction event and clears all local React state

### Principle 5 — Graceful Degradation

If MongoDB is unavailable, the system falls back to in-memory metadata maps and continues functioning. No crash, no data loss of in-progress sessions.

---

## 3. User Roles

| Role            | How Acquired          | Capabilities                                                                                   |
| --------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| **Owner**       | Created the session   | Create session, kick participants, end session, copy invite link, leave (triggers destruction) |
| **Participant** | Joined via ID+passkey | Send messages, send files, view files, leave voluntarily                                       |

There is no admin, moderator, or guest role. All participants have identical read/send permissions; only the owner has moderation rights.

**No persistent user accounts.** Identity is scoped entirely to one session via a `participantId` (UUID v4) generated at join time.

---

## 4. Feature Requirements

### FR-01 Session Creation

**Trigger:** Owner clicks "Create Session" on the Home screen.

**Inputs:**

- `username` (string, 1–32 chars, required; defaults to `"Session Creator"` if blank)

**Server actions:**

1. Generate a unique 6-character `sessionId` from the alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (no visually ambiguous chars)
2. Loop until the ID is not already in MongoDB **and** not in RAM (collision-proof)
3. Generate a passkey in the format `WORD-NNN` (21 words × numbers 100–998)
4. Hash the passkey with bcrypt (10 salt rounds, ~100ms)
5. Write minimal metadata to MongoDB: `{ sessionId, ownerParticipantId, passkeyHash, status: 'ACTIVE' }`
6. Initialize RAM session object with `participants Map`, `bannedParticipantIds Set`, timers, etc.
7. Add owner to `sessions[sessionId].participants`
8. Owner socket joins the Socket.IO room `ephemeral_session_{sessionId}`
9. Respond with: `{ sessionId, passkey (plain, once only), participantId, isOwner: true, participants }`

**Client actions:**

- Store response in `activeSession` React state
- Switch `uiState` to `'ACTIVE'`

**Constraints:**

- The plain passkey is returned to the owner **exactly once** and never stored anywhere after that
- All communications are via Socket.IO (no HTTP for creation)

---

### FR-02 Session Joining

**Trigger:** Participant submits the Join form or opens an invite link.

**Inputs:**

- `sessionId` (6 chars, uppercase)
- `passkey` (case-insensitive; normalized to uppercase server-side)
- `username` (1–32 chars; defaults to `"Participant"` if blank)
- `participantId` (optional; provided on rejoin to retain identity)

**Server validation sequence (in order, fail-fast):**

| Step | Check                                                   | Error Code           |
| ---- | ------------------------------------------------------- | -------------------- |
| 1    | Session exists in MongoDB (or in-memory fallback)       | `SESSION_NOT_FOUND`  |
| 2    | `dbRecord.status === 'ACTIVE'`                          | `SESSION_ENDING`     |
| 3    | `bcrypt.compare(passkey, passkeyHash)`                  | `INVALID_PASSKEY`    |
| 4    | `existingParticipantId` not in `SessionBan` (if rejoin) | `PARTICIPANT_BANNED` |

**On success:**

- If no RAM session exists (post-restart), reconstruct from DB record
- Assign `participantId` (new UUID or provided ID)
- Detect if rejoining owner (`participantId === dbRecord.ownerParticipantId`)
- Add to `session.participants` Map
- Socket joins room
- Broadcast `participant-joined` to all others
- Return success payload to joiner

**Client actions:**

- Store response in `activeSession` React state
- Initialize `messages` with a system welcome message
- Switch `uiState` to `'ACTIVE'`

---

### FR-03 Real-Time Messaging

- Text messages are sent via `send-message` Socket.IO event
- Server validates: session is `'ACTIVE'`, sender is in `session.participants`, sender is not banned, text is 1–2,000 characters
- Server builds `messageObject` with `messageId` (UUID), `senderId`, `senderName`, `isOwner`, `text`, `timestamp`
- Server broadcasts immediately to all sockets in the room via `io.to(room).emit('receive-message', ...)`
- **The message is never written to any store — RAM, DB, or disk**
- Each browser appends the message to its local React `messages` array

---

### FR-04 File Transfer (Images & PDFs)

**Upload flow:**

1. Client validates file locally (type + size)
2. Client sends file via `POST /api/files/upload` (multipart/form-data + XHR for progress)
3. Multer receives into `memoryStorage` — file goes to RAM Buffer, **never to disk**
4. Server validates session is ACTIVE and participant is authorized
5. `fileId` (UUID) assigned; file stored in `ephemeralFiles` RAM Map
6. Server emits `receive-file` socket event (metadata only, no binary) to all in room

**Retrieval:**

- `GET /api/files/:fileId?sessionId=...&participantId=...` — served from RAM
- Requires both a valid `sessionId` and `participantId` from the same session
- Optional `?download=true` sets `Content-Disposition: attachment`

**Deletion:**

- All files for a session are deleted from `ephemeralFiles` Map when `executeHardDestruction()` runs
- Background cleanup also removes orphaned files older than 2 hours

**Supported types:**

| Type     | Allowed Formats      | Max Size                                  |
| -------- | -------------------- | ----------------------------------------- |
| Image    | JPEG, PNG, WEBP, GIF | 10 MB (configurable via `MAX_IMAGE_SIZE`) |
| Document | PDF only             | 25 MB (configurable via `MAX_PDF_SIZE`)   |

---

### FR-05 Invite Link System

- Owner gets a copyable invite URL: `https://{domain}/?join={sessionId}&key={passkey}`
- On page load, `App.jsx` checks URL params (`join`, `key`) and auto-fills the Join form
- Recipient only needs to enter a username to join
- A "Test in Tab" button opens the invite URL in a new browser tab

---

### FR-06 Participant Management & Kick System

**Kick flow:**

1. Owner clicks Kick button next to a participant's name
2. Confirmation modal appears
3. Owner confirms → `kick-participant` socket event emitted
4. Server validates requester is owner
5. `targetParticipantId` added to:
   - RAM: `session.bannedParticipantIds` Set
   - MongoDB: `SessionBan` document created (upsert)
6. Kicked user's socket receives `participant-kicked-self` → `uiState = 'KICKED'`
7. Kicked user's socket leaves the room
8. `participant-kicked` broadcast to remaining participants
9. System message shown: `"username was kicked and permanently barred by the owner."`

**Ban persistence:**

- Ban survives server restarts (stored in MongoDB)
- Ban is cleared when session is destroyed (`deleteSessionRecord` deletes all `SessionBan` docs)
- Ban is by `participantId`, not by IP — fresh browser can rejoin

---

### FR-07 Session Termination & Destruction

**Triggers:**

- Owner clicks "Terminate Session" and confirms (`end-session` event)
- Owner closes their browser tab (socket `disconnect` event detected)
- Owner voluntarily leaves (`leave-session` event with `isOwner: true`)

**15-second countdown sequence:**

| Time          | Event                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| T+0s          | `initiateSessionDestruction()` called                                  |
| T+0s          | `session.status = 'ENDING'` in RAM                                     |
| T+0s          | `updateSessionStatus('ENDING')` written to MongoDB                     |
| T+0s          | `session-ending` broadcast: all browsers show `<EndingCountdownModal>` |
| T+0s to T+5s  | Warning phase — "SESSION IS CLOSING"                                   |
| T+5s to T+15s | Countdown phase — "PURGING EPHEMERAL RAM" with live timer              |
| T+15s         | `executeHardDestruction()` fires                                       |

**Hard destruction actions (`executeHardDestruction`):**

1. Broadcast `session-destroyed` to all sockets in room
2. All sockets `leave(room)`
3. All `socketToParticipant` entries deleted
4. `session.participants.clear()` — RAM participants wiped
5. `session.bannedParticipantIds.clear()` — RAM ban set wiped
6. `sessions.delete(sessionId)` — session removed from RAM Map
7. `ephemeralFiles` loop — all files for this session deleted from RAM
8. `deleteSessionRecord(sessionId)` — MongoDB Session doc + all SessionBan docs deleted

**Client reaction to `session-destroyed`:**

- `setMessages([])` — chat cleared
- `setActiveSession(null)` — session identity cleared
- `setTypingUsers([])` — typing state cleared
- `setUiState('DESTROYED')` — shows `<DestroyedScreen>`
- `playPurgedSound()` — descending tone confirms purge

**The countdown is not cancellable.** Once `initiateSessionDestruction()` fires, the `setTimeout` will always execute.

---

### FR-08 Typing Indicators

- Client emits `typing` event with `isTyping: true/false` on keystroke and input clear
- Server relays `user-typing` to all others in room (does not store)
- Client auto-clears a typing indicator after **2,500ms** of no typing (via `setTimeout`)

---

### FR-09 Sound Effects System

All sounds are **synthesized in real-time** using the Web Audio API. No audio files (.mp3, .wav, .ogg) exist anywhere in the project.

| Function                           | Trigger                    | Wave          | Frequency | Duration |
| ---------------------------------- | -------------------------- | ------------- | --------- | -------- |
| `playMessageSentSound()`           | You send a message         | Sine          | 440→880Hz | 80ms     |
| `playMessageReceivedSound()`       | Others send a message      | Triangle      | D5→A5     | 140ms    |
| `playUserJoinedSound()`            | Participant joins          | Sine          | C5→E5     | 150ms    |
| `playUserLeftSound()`              | Participant leaves/kicked  | Sine          | E5→A4     | 150ms    |
| `playCountdownTickSound(isUrgent)` | Destruction countdown tick | Sine/Sawtooth | 440/880Hz | —        |
| `playPurgedSound()`                | Session destroyed screen   | Sine          | 220→110Hz | 300ms    |
| `playFileSentSound()`              | You send a file            | Sine          | G4→C5→G5  | 180ms    |
| `playFileReceivedSound()`          | Others send a file         | Sine          | E5→A5→C6  | 220ms    |

Audio context is lazy-initialized on first use (browser autoplay policy compliance).

---

### FR-10 Image Viewer

- Opens in `<ImageLightboxModal>` fullscreen overlay on image thumbnail click
- Features: zoom (0.5x–4x, keyboard `+`/`-`), rotate (90° CW, keyboard `R`), download
- Powered by CSS `transform` via Framer Motion (`motion` library)
- Fetched fresh from RAM on each open via `GET /api/files/:fileId`
- Closes on Escape key or outside click

---

### FR-11 PDF Viewer

- Opens in `<PdfViewerModal>` fullscreen overlay on "Preview" click
- Uses browser's native `<iframe>` PDF renderer (no external PDF library)
- Buttons: "New Tab" (opens in new browser tab), "Download"
- Footer: "Protected session document — Auto-purged on session termination"
- Closes on Escape key or outside click

---

### FR-12 Drag & Drop File Upload

- Users can drag files directly onto the active chat area
- `dragenter` / `dragover` / `dragleave` / `drop` events handled in `<ActiveSessionView>`
- A fullscreen overlay "Drop to Encrypt & Transfer" appears during an active drag
- On drop, file is staged and `<AttachmentModal>` opens with the file pre-loaded
- Identical upload flow to the click-based attachment button from that point

---

## 5. Non-Functional Requirements

### NFR-01 Ephemeral Data Guarantee

| Invariant                    | Requirement                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| Messages                     | MUST NOT be written to any database, log file, or persistent store  |
| File data                    | MUST NOT be written to disk; must use `multer.memoryStorage()` only |
| Plain passkeys               | MUST NOT be stored anywhere; only bcrypt hash in MongoDB            |
| Participant names/socket IDs | MUST NOT be persisted to database                                   |
| Session destruction          | MUST delete MongoDB records in addition to RAM cleanup              |
| Post-session file access     | MUST return `FILE_NOT_FOUND` after session destruction              |

### NFR-02 Security & Authentication

- Session IDs MUST use `crypto.randomBytes()` (not `Math.random()`)
- Participant IDs MUST use `crypto.randomUUID()` (UUID v4)
- Passkeys MUST use `crypto.randomInt()` for word and number selection
- Passkeys MUST be bcrypt-hashed with ≥10 salt rounds before DB storage
- File access MUST require both a valid `sessionId` AND `participantId` from the same session
- The server MUST validate all socket event payloads before acting on them

### NFR-03 Performance

- Message relay latency MUST be < 5ms server-side (RAM-only hot path)
- File upload MUST show real-time progress via XHR `progress` events
- Socket auto-reconnect MUST attempt up to 10 times with 1s delay
- Session ID generation collision loop MUST resolve in < 3 iterations in practice

### NFR-04 Resilience & Graceful Degradation

- If `MONGODB_URI` is not set, the server MUST start and operate with in-memory fallback maps
- If MongoDB connection fails at runtime, the server MUST NOT crash; it MUST log the error and continue
- If a session exists in MongoDB but not in RAM (post-restart), the `join-session` handler MUST reconstruct the RAM session from the DB record
- Background cleanup MUST run every 10 minutes regardless of DB availability

### NFR-05 Deployment & Infrastructure

- The app MUST run as a single persistent Node.js process (not serverless)
- The server MUST NOT be deployable to Vercel or similar serverless platforms
- `render.yaml` MUST be kept in the repo as the canonical deployment config
- The `uploads/` directory MUST remain empty (multer uses memory storage only)

---

## 6. Architecture Requirements

### AR-01 Two-Layer State Model

The system uses exactly two parallel state stores:

| Layer    | Technology            | Persistence            | Contents                                            |
| -------- | --------------------- | ---------------------- | --------------------------------------------------- |
| RAM      | Node.js `Map` / `Set` | No (dies with process) | Live participants, socket IDs, file buffers, timers |
| Database | MongoDB via Mongoose  | Yes (survives restart) | Session metadata, passkey hashes, ban records       |

These layers are **additive, not replacements**. Every real-time operation (message relay, file serving, typing) touches RAM only. MongoDB is only accessed at session lifecycle events (create, join, kick, status change, destroy).

### AR-02 RAM Layer (Ephemeral)

Three global Maps in `server.js`:

```js
const sessions = new Map(); // sessionId -> session object
const socketToParticipant = new Map(); // socket.id -> { sessionId, participantId }
const ephemeralFiles = new Map(); // fileId -> { buffer, mimetype, size, sessionId, ... }
```

### AR-03 Database Layer (Minimal Persistent Metadata)

Two MongoDB collections via Mongoose:

- **`sessions`** — `Session` model: `sessionId`, `ownerParticipantId`, `passkeyHash`, `status`, `createdAt`, `expiresAt`, `endingReason`
- **`sessionbans`** — `SessionBan` model: `sessionId`, `participantId`, `bannedAt` (composite unique index)

**Fallback maps when DB is unavailable:**

- `inMemorySessionMeta` — `Map` replacing `sessions` collection
- `inMemorySessionBans` — `Set` of `"sessionId:participantId"` strings

### AR-04 WebSocket Transport

- Socket.IO over WebSocket (falls back to HTTP long-polling)
- All real-time events (messaging, typing, participant changes, session events) go through Socket.IO
- Socket.IO rooms named `ephemeral_session_{sessionId}` (uppercase)
- CORS: `origin: '*'` (all origins allowed — production should restrict this)

### AR-05 HTTP File Transport

- File binary data goes via `POST /api/files/upload` (multipart/form-data)
- Multer configured with `memoryStorage()` — zero disk writes
- File retrieval via `GET /api/files/:fileId` — served from RAM buffer
- File metadata sent via Socket.IO (`receive-file` event) after successful upload

### AR-06 Module Structure

```
server.js                         — Main entry point; Express + Socket.IO + startup
src/
├── server/
│   ├── config/
│   │   └── database.js           — MongoDB connection, isDatabaseConnected(), getConnectionStatus()
│   ├── models/
│   │   ├── Session.js            — Mongoose Session schema
│   │   └── SessionBan.js         — Mongoose SessionBan schema
│   ├── services/
│   │   ├── authenticationService.js — hashPasskey(), verifyPasskey() (bcrypt)
│   │   └── sessionService.js     — CRUD for session metadata; in-memory fallback
│   └── utils/
│       ├── generateSessionId.js  — 6-char crypto-random session ID
│       ├── generatePasskey.js    — WORD-NNN passkey generator
│       └── sessionCleanup.js     — Background cleanup every 10 minutes
├── components/                   — React UI components
├── services/
│   ├── api.js                    — HTTP helpers (file upload, URL builders)
│   ├── socket.js                 — Socket.IO singleton + reconnect config
│   └── soundEffects.js           — Web Audio API synthesized sounds
└── App.jsx                       — Root React component; state machine + socket listeners
```

---

## 7. Data Models

### Session (MongoDB)

| Field                | Type           | Description                                  |
| -------------------- | -------------- | -------------------------------------------- |
| `sessionId`          | String         | 6-char uppercase, unique, indexed            |
| `ownerParticipantId` | String         | UUID v4 of the session creator               |
| `passkeyHash`        | String         | bcrypt hash (10 rounds) of the plain passkey |
| `status`             | Enum           | `ACTIVE`, `ENDING`, `EXPIRED`, `DESTROYED`   |
| `createdAt`          | Date           | Session creation timestamp                   |
| `expiresAt`          | Date \| null   | Optional expiry timestamp                    |
| `endingReason`       | String \| null | `OWNER_LEFT`, `OWNER_ENDED`, or null         |

### SessionBan (MongoDB)

| Field           | Type   | Description                       |
| --------------- | ------ | --------------------------------- |
| `sessionId`     | String | Indexed                           |
| `participantId` | String | UUID v4 of the banned participant |
| `bannedAt`      | Date   | When the ban was applied          |

Composite unique index on `(sessionId, participantId)`.

### RAM Session Object

```js
{
  sessionId:            string,
  ownerParticipantId:   string,
  ownerSocketId:        string | null,
  participants:         Map<participantId, { participantId, username, socketId, joinedAt, isOwner }>,
  bannedParticipantIds: Set<participantId>,
  status:               'ACTIVE' | 'ENDING' | 'DESTROYED',
  createdAt:            number,         // Unix ms
  destroyAt:            number | null,
  endingReason:         string | null,
  warningDurationMs:    5000,
  countdownDurationMs:  10000,
  destroyTimeoutId:     TimeoutId | null,
}
```

### RAM Ephemeral File Object

```js
{
  buffer:       Buffer,     // raw file bytes in RAM
  mimetype:     string,
  originalname: string,
  size:         number,     // bytes
  sessionId:    string,
  uploadedBy:   string,     // participantId
  uploadedAt:   number,     // Unix ms
}
```

---

## 8. API Contracts

### Socket.IO Events

#### Client → Server

| Event              | Payload                                             | Description                     |
| ------------------ | --------------------------------------------------- | ------------------------------- |
| `create-session`   | `{ username }`                                      | Create a new session            |
| `join-session`     | `{ sessionId, passkey, username, participantId? }`  | Join existing session           |
| `send-message`     | `{ sessionId, participantId, text, type }`          | Send a chat message             |
| `typing`           | `{ sessionId, participantId, isTyping }`            | Typing indicator                |
| `kick-participant` | `{ sessionId, participantId, targetParticipantId }` | Kick a participant (owner only) |
| `leave-session`    | `{ sessionId, participantId }`                      | Voluntary leave                 |
| `end-session`      | `{ sessionId, participantId }`                      | Terminate session (owner only)  |

#### Server → Client

| Event                     | Payload                                                                                                | Description              |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------ |
| `session-created`         | `{ success, sessionId, passkey, participantId, isOwner, participants }`                                | Session created          |
| `join-success`            | `{ success, sessionId, participantId, username, isOwner, participants }`                               | Join successful          |
| `join-error`              | `{ success: false, code, message }`                                                                    | Join failed              |
| `receive-message`         | `{ messageId, senderId, senderName, isOwner, text, timestamp }`                                        | Chat message broadcast   |
| `receive-file`            | `{ messageId, fileId, senderId, senderName, fileName, fileSize, mimeType, fileType, text, timestamp }` | File broadcast           |
| `user-typing`             | `{ participantId, username, isTyping }`                                                                | Typing indicator relay   |
| `participant-joined`      | `{ participant, participants }`                                                                        | Someone joined           |
| `participant-left`        | `{ participantId, username, participants }`                                                            | Someone left             |
| `participant-kicked`      | `{ kickedParticipantId, username, participants }`                                                      | Someone was kicked (all) |
| `participant-kicked-self` | `{ reason, sessionId }`                                                                                | You were kicked          |
| `session-ending`          | `{ sessionId, reason, destroyAt, warningDurationMs, countdownDurationMs, totalDurationMs }`            | Countdown started        |
| `session-destroyed`       | `{ sessionId, message, timestamp }`                                                                    | Session hard-destroyed   |

### HTTP REST Endpoints

#### `POST /api/files/upload`

**Headers:** `x-session-id`, `x-participant-id`
**Body:** `multipart/form-data` with `file` field + optional `caption`, `sessionId`, `participantId`
**Response:**

```json
{
  "success": true,
  "fileId": "uuid",
  "fileName": "...",
  "fileSize": 12345,
  "mimeType": "image/jpeg"
}
```

#### `GET /api/files/:fileId`

**Query:** `sessionId`, `participantId`, `download` (optional, `"true"`)
**Response:** Raw file bytes with appropriate `Content-Type`
**Error:** `{ "success": false, "code": "FILE_NOT_FOUND" | "UNAUTHORIZED" }`

#### `GET /api/health`

**Response:**

```json
{
  "status": "ok",
  "database": { "connected": true, "state": "connected", "host": "..." },
  "activeRAMSessionsCount": 3,
  "dbSessionsCount": 3,
  "dbBansCount": 1,
  "timestamp": 1234567890
}
```

#### `GET /api/db-status`

**Response:** Full contents of both MongoDB collections + in-memory session keys.

> ⚠️ Unauthenticated — should be protected or removed in production.

#### `GET /api/session/:sessionId/check`

**Response:**

```json
{
  "exists": true,
  "status": "ACTIVE",
  "createdAt": "...",
  "participantCount": 2
}
```

---

## 9. Limits & Constraints

| Item                         | Limit                                   | Where Enforced                                   |
| ---------------------------- | --------------------------------------- | ------------------------------------------------ |
| Username length              | 32 characters                           | Client (`maxLength`) + Server (`.slice(0, 32)`)  |
| Message length               | 2,000 characters                        | Server (`send-message` handler)                  |
| Image file size              | 10 MB (configurable `MAX_IMAGE_SIZE`)   | Client + Server                                  |
| PDF file size                | 25 MB (configurable `MAX_PDF_SIZE`)     | Client + Server                                  |
| File caption length          | 500 characters                          | Client (`maxLength`) + Server (`.slice(0, 500)`) |
| Session ID length            | 6 characters                            | `generateSessionId.js`                           |
| Passkey format               | WORD-NNN (21 words × 100–998)           | `generatePasskey.js`                             |
| Destruction countdown        | 15 seconds (5s warning + 10s countdown) | `server.js`                                      |
| Max sessions                 | Unlimited (RAM-bounded)                 | None in code                                     |
| Max participants per session | Unlimited (RAM-bounded)                 | None in code                                     |
| Max files per session        | Unlimited (RAM-bounded)                 | None in code                                     |
| Session ID input max         | 12 characters                           | JoinSessionView `maxLength`                      |
| Passkey input max            | 20 characters                           | JoinSessionView `maxLength`                      |
| Socket reconnect attempts    | 10                                      | `socket.js`                                      |
| Socket reconnect delay       | 1,000ms                                 | `socket.js`                                      |
| Background cleanup interval  | Every 10 minutes                        | `sessionCleanup.js`                              |
| Orphaned file max age        | 2 hours                                 | `sessionCleanup.js`                              |

---

## 10. UI States & Navigation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         HOME                                │
│           [Create Session]    [Join Session]                │
└──────────┬──────────────────────────────────┬──────────────┘
           │ click Create                     │ click Join / open invite link
           ▼                                  ▼
    ┌─────────────┐                   ┌──────────────────┐
    │  CREATING   │                   │    JOINING       │
    │ (username   │                   │ (sessionId +     │
    │  form)      │                   │  passkey +       │
    └──────┬──────┘                   │  username form)  │
           │ socket: create-session   └────────┬─────────┘
           │                                   │ socket: join-session
           │  ◄── server: session-created      │ ◄── server: join-success
           │                                   │ ◄── server: join-error → stays on JOINING
           └───────────────┬───────────────────┘
                           ▼
                   ┌──────────────┐
                   │    ACTIVE    │◄── socket: session-ending → EndingCountdownModal overlays
                   │  (chat UI)   │
                   └──────┬───────┘
                          │ socket: session-destroyed
                    ┌─────┴──────────────────┐
                    ▼                        ▼
             ┌──────────┐           ┌──────────────┐
             │ DESTROYED │          │   KICKED     │
             │ (purge    │          │  (kicked     │
             │  screen)  │          │   screen)    │
             └──────┬────┘          └──────┬───────┘
                    │ click Reset           │ click Reset
                    └──────────┬────────────┘
                               ▼
                             HOME
```

---

## 11. Session Lifecycle State Machine

```
         create-session
              │
              ▼
         ┌─────────┐     owner leaves / owner ends / owner disconnects
         │ ACTIVE  │ ────────────────────────────────────────────────►
         └─────────┘
                                    ┌──────────┐
                                    │  ENDING  │  (15s countdown)
                                    └────┬─────┘
                                         │ setTimeout fires
                                         ▼
                                   ┌───────────┐
                                   │ DESTROYED │  RAM + DB purged
                                   └───────────┘
```

**Valid status transitions:**

- `ACTIVE` → `ENDING` (via `initiateSessionDestruction`)
- `ENDING` → `DESTROYED` (via `executeHardDestruction`)
- `ACTIVE` → `EXPIRED` (via `cleanupExpiredSessions` background job, if `expiresAt` is set)

**The `ENDING` → `ACTIVE` transition is intentionally impossible.** Once destruction begins it cannot be aborted.

---

## 12. Security Model

### What is Protected

| Threat                           | Mitigation                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Passkey brute-force              | bcrypt (10 rounds, ~100ms per attempt)                                         |
| Passkey database leak            | Only hash stored — raw passkey never persisted                                 |
| Session ID collision             | Crypto-random (not Math.random()); uniqueness checked in both DB and RAM       |
| Cross-session file access        | File access requires valid `sessionId` + `participantId` from same session     |
| Unauthorized message sending     | Sender must be in `session.participants` and not in `bannedParticipantIds`     |
| Unauthorized session termination | Only `session.ownerParticipantId` can call `end-session` or `kick-participant` |
| Data persistence after session   | Hard destruction deletes both RAM state and MongoDB records                    |
| Stale ban bypass                 | Bans persist in MongoDB through server restarts                                |

### Known Security Gaps (Out of Scope for v2)

| Gap                              | Impact                                                   |
| -------------------------------- | -------------------------------------------------------- |
| No end-to-end encryption         | Server reads plaintext messages during relay             |
| No rate limiting                 | Message floods and upload spam possible                  |
| CORS wildcard `origin: '*'`      | Any origin can connect to Socket.IO                      |
| Passkey in invite URL            | Plain passkey exposed in browser history and server logs |
| No IP-based ban                  | Kicked users can rejoin with a fresh browser             |
| `/api/db-status` unauthenticated | Session metadata visible to anyone who knows the URL     |
| No HTTPS enforcement in code     | Relies on platform (Render) for TLS termination          |
| No content moderation            | Any file passing MIME + size checks is accepted          |

---

## 13. Known Limitations & Out of Scope

| Limitation                                  | Notes                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| **No horizontal scaling**                   | `sessions` Map is local to one process; Redis adapter required for multi-instance |
| **No message history**                      | Joiners see no prior messages; there are none to replay                           |
| **No end-to-end encryption**                | Not planned for current version                                                   |
| **No file re-upload after session restart** | Files are RAM-only; they don't survive restarts                                   |
| **No participant limit per session**        | Caps only at available RAM                                                        |
| **No rate limiting**                        | No `express-rate-limit` or socket middleware throttling                           |
| **Ban by participantId only**               | Fresh browser/incognito bypasses kick                                             |
| **No user accounts or profiles**            | Identity is fully session-scoped                                                  |
| **No message editing or deletion**          | Messages are immutable once sent                                                  |
| **No read receipts**                        | Not implemented                                                                   |
| **No video/audio**                          | Only text, images, and PDFs                                                       |
| **No .mp4, .docx, .zip support**            | Only JPEG, PNG, WEBP, GIF, PDF                                                    |

---

## 14. Tech Stack

### Backend

| Technology | Version | Purpose                       |
| ---------- | ------- | ----------------------------- |
| Node.js    | LTS     | Runtime                       |
| Express    | ^4.21.2 | HTTP server + REST API        |
| Socket.IO  | ^4.8.3  | WebSocket real-time transport |
| Mongoose   | ^9.9.4  | MongoDB ODM                   |
| bcryptjs   | ^3.0.3  | Passkey hashing               |
| multer     | ^2.2.0  | File upload (memory storage)  |
| dotenv     | ^17.4.2 | Environment variable loading  |

### Frontend

| Technology             | Version   | Purpose                 |
| ---------------------- | --------- | ----------------------- |
| React                  | ^19.0.1   | UI framework            |
| socket.io-client       | ^4.8.3    | WebSocket client        |
| motion (Framer Motion) | ^12.23.24 | Animations              |
| lucide-react           | ^0.546.0  | Icons                   |
| TailwindCSS            | ^4.1.14   | Styling                 |
| Vite                   | ^6.2.3    | Build tool + dev server |

### Build & Dev

| Technology | Purpose                                                |
| ---------- | ------------------------------------------------------ |
| esbuild    | Bundle `server.js` to `dist/server.cjs` for production |
| tsx        | TypeScript execution for development scripts           |

---

## 15. Environment Variables

| Variable          | Required | Default           | Description                                                      |
| ----------------- | -------- | ----------------- | ---------------------------------------------------------------- |
| `PORT`            | No       | `3000`            | HTTP server port                                                 |
| `NODE_ENV`        | No       | `development`     | `production` enables static file serving from `dist/`            |
| `MONGODB_URI`     | No       | —                 | MongoDB connection string. If absent, in-memory fallback is used |
| `VITE_SERVER_URL` | No       | —                 | Override socket server URL (for custom deployments)              |
| `MAX_IMAGE_SIZE`  | No       | `10485760` (10MB) | Max image upload size in bytes                                   |
| `MAX_PDF_SIZE`    | No       | `26214400` (25MB) | Max PDF upload size in bytes                                     |

**Local development:** Copy `.env.example` to `.env` and set `MONGODB_URI` to a MongoDB Atlas connection string.

---

## 16. Deployment

### Platform: Render.com (canonical)

The project ships with [`render.yaml`](./render.yaml):

```yaml
services:
  - type: web
    name: plutus-chat
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

**Build command:** `npm install && npm run build`

- `vite build` — compiles React app to `dist/`
- `esbuild server.js` — bundles server to `dist/server.cjs`

**Start command:** `npm start` → `node dist/server.cjs`

In `NODE_ENV=production`, the server serves the React SPA from `dist/` as static files and falls back to `dist/index.html` for all non-API routes.

### Why NOT Vercel / Serverless

Vercel is incompatible because:

1. Socket.IO requires a **persistent TCP connection** — serverless functions die after seconds
2. The `sessions` and `ephemeralFiles` Maps require **persistent in-memory state** — each serverless invocation has empty memory
3. The MongoDB connection requires a **persistent process** — cold-starting a connection per-request is unacceptable

### Other Compatible Platforms

Railway, Fly.io, DigitalOcean App Platform, Heroku, any VPS with Node.js.

### Render.com RAM Estimates

| Plan              | RAM                                       | Estimated Capacity                          |
| ----------------- | ----------------------------------------- | ------------------------------------------- |
| Free              | 512 MB, spins down after 15min inactivity | ~100–300 text-only users; ~30–50 with files |
| Starter ($7/mo)   | 512 MB, always-on                         | Same RAM, no cold starts                    |
| Standard ($25/mo) | 1 GB, always-on                           | ~2× file capacity of Starter                |

**RAM exhaustion:** Node.js crashes → Render auto-restarts → all RAM state (sessions, files) lost → MongoDB metadata survives → users can attempt to rejoin.

---

_PRD Version 2.0 — Reflects Phase 2 architecture with MongoDB integration, bcrypt passkey hashing, dual-layer state model, and background cleanup system._
_Document author: Engineering team — Plutus Secure Line_
_Date: 2026-08-30_
