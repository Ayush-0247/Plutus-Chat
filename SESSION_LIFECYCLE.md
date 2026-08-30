# Session Lifecycle — Create & Join

> **Scope:** Everything that happens from the moment a user clicks **"Create Session"** or **"Join Session"** to the moment they are inside an active chat room. Every layer — UI, socket, server logic, database, RAM state — is explained in detail.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Socket Connection — How the Browser Connects](#2-socket-connection--how-the-browser-connects)
3. [UI State Machine](#3-ui-state-machine)
4. [SESSION CREATION — Full Flow](#4-session-creation--full-flow)
5. [SESSION JOINING — Full Flow](#5-session-joining--full-flow)
6. [Error Paths — What Can Go Wrong Joining](#6-error-paths--what-can-go-wrong-joining)
7. [Invite Link Deep Dive](#7-invite-link-deep-dive)
8. [The Active Session State Object](#8-the-active-session-state-object)
9. [RAM vs MongoDB — What Lives Where](#9-ram-vs-mongodb--what-lives-where)
10. [Sequence Diagrams](#10-sequence-diagrams)
11. [Key Data Structures Reference](#11-key-data-structures-reference)

---

## 1. Architecture Overview

```
Browser (React)                    Render Server (Node.js)             MongoDB Atlas
──────────────────                 ───────────────────────             ──────────────
CreateSessionView  ─── Socket.IO ──► 'create-session' handler ──────► Session.create()
JoinSessionView    ─── Socket.IO ──► 'join-session' handler   ──────► Session.findOne()
                                                               ──────► SessionBan.exists()
App.jsx (state)    ◄── Socket.IO ── session-created / join-success
                                    RAM Maps:
                                      sessions{}
                                      socketToParticipant{}
                                      ephemeralFiles{}
```

The server holds **two parallel state stores**:

| Store | Technology | Survives Restart? | What it Holds |
|---|---|---|---|
| **RAM** | JS `Map` objects | No | Live participants, socket IDs, timers, file buffers |
| **MongoDB** | Mongoose models | Yes | Session ID, passkey hash, status, bans |

---

## 2. Socket Connection — How the Browser Connects

Before any session action can happen, the browser must have an active Socket.IO connection to the server. This is managed by `src/services/socket.js` using a **singleton pattern**:

```js
// socket.js — singleton
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}
```

### Key behaviours

- **Singleton** — `getSocket()` always returns the same socket instance. Never recreated unless `disconnectSocket()` is called explicitly.
- **Auto-connect** — The socket connects as soon as `getSocket()` is first called (when `App.jsx` mounts its `useEffect`).
- **Auto-reconnect** — If connection drops, retries up to **10 times** with a **1-second delay** between attempts.
- **URL resolution:**
  - `VITE_SERVER_URL` env var → use that (staging/custom deployments)
  - Production build (`PROD = true`) → `window.location.origin` (same domain, no CORS issues)
  - Development → `http://localhost:3000`

### Connection tracking in App.jsx

```js
socket.on('connect',    () => setIsConnected(true));
socket.on('disconnect', () => setIsConnected(false));
```

The `isConnected` boolean is passed to `<Navbar>`, which shows a live green/red indicator dot.

---

## 3. UI State Machine

`App.jsx` drives the entire UI through a single `uiState` string:

```
HOME ──► CREATING ──► (server 'session-created') ──► ACTIVE
     └─► JOINING  ──► (server 'join-success')    ──► ACTIVE
                  └─► (server 'join-error')       ──► stays on JOINING (error shown)
```

| `uiState` | Component Rendered | How to Enter |
|---|---|---|
| `'HOME'` | `<HomeView>` | Default on load, or after reset |
| `'CREATING'` | `<CreateSessionView>` | Click "Create Session" on Home |
| `'JOINING'` | `<JoinSessionView>` | Click "Join Session" on Home, or open invite link |
| `'ACTIVE'` | `<ActiveSessionView>` | Server responds with `session-created` or `join-success` |
| `'DESTROYED'` | `<DestroyedScreen>` | Server broadcasts `session-destroyed` |
| `'KICKED'` | `<KickedScreen>` | Server sends `participant-kicked-self` to this socket |

> **Important:** `'ENDING'` is NOT a separate `uiState` value. During the destruction countdown, `uiState` stays `'ACTIVE'` and `<EndingCountdownModal>` overlays on top, driven by the `endingData` React state variable.

---

## 4. SESSION CREATION — Full Flow

### Step 1 — UI: CreateSessionView

**File:** `src/components/CreateSessionView.jsx`

The create form has only **one field**:

| Field | HTML Element | Max Length | Default if empty |
|---|---|---|---|
| Codename / Handle | `<input id="create_username_input">` | 32 chars | `'Session Creator'` |

```js
const handleSubmit = (e) => {
  e.preventDefault();
  onCreateSession(username.trim() || 'Session Creator');
};
```

The submit button reads **"Generating Line..."** and is `disabled` while `isLoading` is `true`, preventing double-submissions.

---

### Step 2 — App.jsx: handleCreateSession

```js
const handleCreateSession = (username) => {
  setIsLoading(true);
  const socket = getSocket();
  socket.emit('create-session', { username });
};
```

- No HTTP request is made. Session creation is **entirely via WebSocket**.
- `isLoading = true` locks the UI while waiting for the server response.

---

### Step 3 — Socket Emit: `create-session`

```js
// Payload sent from browser:
{ username: "Ayush" }
```

The server receives this in `server.js` inside `socket.on('create-session', async (payload, callback))`.

---

### Step 4 — Server: Session ID Generation

**File:** `src/server/utils/generateSessionId.js`

```js
const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 chars — no 0/O/1/I ambiguity
const bytes = crypto.randomBytes(6);
for (let i = 0; i < 6; i++) {
  id += chars[bytes[i] % chars.length];
}
// Result: e.g. "AB3K7M"
```

**Why this custom alphabet?**
The characters `0`, `O`, `1`, and `I` are removed because they look identical in most fonts and cause user confusion when reading/typing session IDs.

**Collision prevention** — before using the ID, the server loops:

```js
let sessionId = generateSessionId();
while ((await isSessionIdTaken(sessionId)) || sessions.has(sessionId)) {
  sessionId = generateSessionId();
}
```

`isSessionIdTaken()` checks **MongoDB first** (so IDs from before a server restart are also avoided), then falls back to the in-memory map.

---

### Step 5 — Server: Passkey Generation & bcrypt Hashing

**File:** `src/server/utils/generatePasskey.js`

```js
const WORDS = [
  'ALPHA', 'BRAVO', 'COBALT', 'DELTA', 'ECHO', 'FALCON', 'GHOST', 'HAVEN',
  'IRON', 'JADE', 'KRYPTO', 'LUNAR', 'NEO', 'ORION', 'PRISM', 'QUANTUM',
  'RAVEN', 'SOLAR', 'TITAN', 'VORTEX', 'ZENITH'  // 21 words total
];
const word = WORDS[crypto.randomInt(0, WORDS.length)];
const num  = crypto.randomInt(100, 999);
return `${word}-${num}`;  // e.g. "TITAN-482"
```

**Entropy:** 21 words × 899 numbers (100–998) = **18,879 unique passkeys**. Combined with the session ID requirement, brute-forcing is impractical.

**Hashing** — `src/server/services/authenticationService.js`:

```js
const SALT_ROUNDS = 10;

export async function hashPasskey(passkey) {
  const normalized = passkey.trim().toUpperCase();
  return bcrypt.hash(normalized, SALT_ROUNDS);  // ~100ms by design
}
```

- The passkey is **always normalized to UPPERCASE** before hashing.
  `titan-482`, `Titan-482`, and `TITAN-482` all hash the same way.
- 10 bcrypt rounds makes each hash attempt ~100ms — intentionally slow for security.
- **The raw passkey is NEVER stored anywhere.** Only the bcrypt hash goes to MongoDB.

---

### Step 6 — Server: MongoDB Write

**File:** `src/server/services/sessionService.js`

```js
await createSessionRecord({
  sessionId,
  ownerParticipantId,  // crypto.randomUUID()
  passkeyHash,
  status: 'ACTIVE',
});
```

**Document written to the `sessions` MongoDB collection:**

```json
{
  "sessionId":          "AB3K7M",
  "ownerParticipantId": "uuid-v4",
  "passkeyHash":        "$2b$10$...bcrypt...",
  "status":             "ACTIVE",
  "createdAt":          "2026-08-30T...",
  "expiresAt":          null,
  "endingReason":       null
}
```

**Graceful fallback:** If MongoDB is unavailable, the record is stored in `inMemorySessionMeta` (a `Map` inside `sessionService.js`). The app keeps working — just without cross-restart persistence.

---

### Step 7 — Server: RAM State Initialization

After the DB write, the server creates the **live session object in the `sessions` RAM Map**:

```js
const session = {
  sessionId,
  ownerParticipantId,
  ownerSocketId:        socket.id,
  participants:         new Map(),        // participantId -> participant object
  bannedParticipantIds: new Set(),        // set of banned participantIds
  status:               'ACTIVE',
  createdAt:            Date.now(),
  destroyAt:            null,
  endingReason:         null,
  warningDurationMs:    5000,             // 5s warning phase
  countdownDurationMs:  10000,            // 10s countdown phase
  destroyTimeoutId:     null,             // setTimeout handle
};

const ownerParticipant = {
  participantId: ownerParticipantId,
  username,                               // "Ayush"
  socketId:      socket.id,
  joinedAt:      Date.now(),
  isOwner:       true,
};

session.participants.set(ownerParticipantId, ownerParticipant);
sessions.set(sessionId, session);
socketToParticipant.set(socket.id, { sessionId, participantId: ownerParticipantId });
```

After this step, the session exists in **two places**:
- **MongoDB** — persistent metadata (passkey hash, status)
- **RAM `sessions` Map** — live state (participants, socket IDs, timers)

---

### Step 8 — Server: Socket Room Join & Response

```js
const room = `ephemeral_session_${sessionId.toUpperCase()}`;
socket.join(room);

const response = {
  success:      true,
  sessionId,
  passkey,          // ONLY time the plain passkey is ever sent anywhere
  participantId: ownerParticipantId,
  username,
  isOwner:       true,
  participants:  getParticipantsArray(session),
};

if (typeof callback === 'function') callback(response);
else socket.emit('session-created', response);
```

> **The plain passkey is sent to the owner exactly once** — in this response — so they can display it and share the invite link. After this point, the passkey exists only as a bcrypt hash in MongoDB.

---

### Step 9 — Client: handleSessionCreated

```js
const handleSessionCreated = (data) => {
  setIsLoading(false);
  setActiveSessionAndRef(data);  // stores response in React state AND a ref
  setMessages([]);               // start with empty chat
  setUiState('ACTIVE');          // render <ActiveSessionView>
};
```

`setActiveSessionAndRef` updates both `activeSession` (React state) and `activeSessionRef.current` (a ref used inside socket handlers to avoid stale closure reads).

---

### Step 10 — What the Owner Has After Creation

`activeSession` in React state:

```js
{
  success:       true,
  sessionId:     "AB3K7M",
  passkey:       "TITAN-482",       // shown in the credentials panel
  participantId: "uuid-of-owner",
  username:      "Ayush",
  isOwner:       true,
  participants: [
    { participantId: "uuid-of-owner", username: "Ayush", isOwner: true, joinedAt: 1234567890 }
  ]
}
```

This object is passed as the `sessionData` prop to `<ActiveSessionView>`, which uses it to:
- Display session ID and passkey
- Build the invite link URL: `?join=AB3K7M&key=TITAN-482`
- Show/hide owner-only controls (Kick button, End Session button)

---

## 5. SESSION JOINING — Full Flow

### Step 1 — Two Entry Points

#### Entry Point A: Manual

User clicks "Join Session" → `uiState = 'JOINING'` → `<JoinSessionView>` renders with all fields empty.

#### Entry Point B: Invite Link

Owner copies the invite link and shares it:

```
https://plutus-chat.onrender.com/?join=AB3K7M&key=TITAN-482
```

When the recipient opens it, `App.jsx` reads query params on mount:

```js
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const joinId  = searchParams.get('join');
  const passkey = searchParams.get('key');

  if (joinId) {
    setUrlSessionId(joinId.toUpperCase());
    if (passkey) setUrlPasskey(passkey.toUpperCase());
    setUiState('JOINING');  // auto-navigate to join form
  }
}, []);
```

`urlSessionId` and `urlPasskey` are passed as `initialSessionId`/`initialPasskey` props to `<JoinSessionView>`, which pre-fills the fields via `useEffect`:

```js
useEffect(() => {
  if (initialSessionId) setSessionId(initialSessionId);
  if (initialPasskey)   setPasskey(initialPasskey);
}, [initialSessionId, initialPasskey]);
```

The user only needs to enter their username.

> **Security note:** The plain passkey is in the URL. If this URL is logged by browser history, forwarded via email, or intercepted in an HTTP log, the passkey is exposed. This is a deliberate usability tradeoff.

---

### Step 2 — UI: JoinSessionView

**File:** `src/components/JoinSessionView.jsx`

| Field | Input ID | Required | Max Length | Auto-UPPERCASE |
|---|---|---|---|---|
| Session ID | `join_session_id_input` | Yes | 12 | Yes (on change) |
| Session Passkey | `join_passkey_input` | Yes | 20 | Yes (on change) |
| Codename / Handle | `join_username_input` | No | 32 | No |

Submit button is disabled until both required fields have content:

```jsx
disabled={isLoading || !sessionId.trim() || !passkey.trim()}
```

On submit:

```js
const handleSubmit = (e) => {
  e.preventDefault();
  if (!sessionId.trim() || !passkey.trim()) return;
  onJoinSession(
    sessionId.trim().toUpperCase(),
    passkey.trim().toUpperCase(),
    username.trim() || 'Participant'  // fallback if no username
  );
};
```

Error messages from the server are displayed in a red alert banner inside the form, and `uiState` stays `'JOINING'` so the user can retry.

---

### Step 3 — App.jsx: handleJoinSession

```js
const handleJoinSession = (sessionId, passkey, username) => {
  setIsLoading(true);
  setJoinErrorMessage(null);   // clear previous error
  const socket = getSocket();
  socket.emit('join-session', { sessionId, passkey, username });
};
```

---

### Step 4 — Socket Emit: `join-session`

```js
// Payload sent from browser (fresh join):
{
  sessionId:     "AB3K7M",
  passkey:       "TITAN-482",
  username:      "Rahul",
  participantId: undefined    // omitted on first join; present on rejoin
}
```

The server receives this in `socket.on('join-session', async (payload, callback))`.

---

### Step 5 — Server Validation #1: DB Lookup

```js
const dbRecord = await findSessionRecord(reqSessionId);

if (!dbRecord) {
  return callback({
    success: false,
    code: 'SESSION_NOT_FOUND',
    message: 'Session does not exist or was destroyed.'
  });
}
```

`findSessionRecord()` priority:
1. `Session.findOne({ sessionId: normId })` in MongoDB
2. `inMemorySessionMeta.get(normId)` (fallback if DB is down)
3. Returns `null` if not found in either

**Why MongoDB first?** The session may have survived a server restart in the DB but not in RAM. The DB is the authoritative source of session existence.

---

### Step 6 — Server Validation #2: Status Check

```js
if (dbRecord.status !== 'ACTIVE') {
  return callback({
    success: false,
    code: 'SESSION_ENDING',
    message: 'Session is ending or destroyed and cannot accept new joiners.'
  });
}
```

Sessions in `'ENDING'` or `'DESTROYED'` state reject all new joiners — even with valid passkeys.

---

### Step 7 — Server Validation #3: Passkey Verification (bcrypt)

```js
const isPasskeyValid = await verifyPasskey(reqPasskey, dbRecord.passkeyHash);

if (!isPasskeyValid) {
  return callback({
    success: false,
    code: 'INVALID_PASSKEY',
    message: 'Invalid session passkey. Verification failed.'
  });
}
```

```js
// authenticationService.js
export async function verifyPasskey(candidatePasskey, passkeyHash) {
  if (!candidatePasskey || !passkeyHash) return false;
  const normalized = candidatePasskey.trim().toUpperCase();
  return bcrypt.compare(normalized, passkeyHash);  // ~100ms
}
```

- Candidate passkey is normalized the same way as during hashing (uppercase + trim).
- `bcrypt.compare()` is timing-safe — takes ~100ms regardless of match/mismatch, preventing timing attacks.
- This is the most compute-intensive step, but it runs only once per join attempt.

---

### Step 8 — Server Validation #4: Ban Check

```js
if (existingParticipantId) {
  const isBanned = await isParticipantBanned(reqSessionId, existingParticipantId);
  if (isBanned) {
    return callback({
      success: false,
      code: 'PARTICIPANT_BANNED',
      message: 'You have been removed by the owner and are banned from this session.'
    });
  }
}
```

This only runs if the joiner provides an `existingParticipantId` (a rejoin attempt).

`isParticipantBanned()`:
1. `SessionBan.exists({ sessionId, participantId })` in MongoDB
2. Falls back to `inMemorySessionBans.has(...)` if DB is down

**Limitation:** A fresh browser (no stored participantId) gets a brand-new UUID → not in the ban set → can rejoin. Bans are per-participantId, not per-IP.

---

### Step 9 — Server: RAM Session Reconstruction (post-restart)

If the server restarted, RAM is empty but MongoDB records survived. The server rebuilds the RAM session on first access:

```js
let session = sessions.get(reqSessionId);

if (!session) {
  // Reconstruct from DB record
  session = {
    sessionId:            reqSessionId,
    ownerParticipantId:   dbRecord.ownerParticipantId,
    ownerSocketId:        null,           // owner hasn't reconnected yet
    participants:         new Map(),
    bannedParticipantIds: new Set(),
    status:               dbRecord.status,
    createdAt:            new Date(dbRecord.createdAt).getTime(),
    destroyAt:            null,
    endingReason:         null,
    warningDurationMs:    5000,
    countdownDurationMs:  10000,
    destroyTimeoutId:     null,
  };
  sessions.set(reqSessionId, session);
}
```

After reconstruction:
- Bans from MongoDB are still enforced (checked on each join)
- Message history is NOT restored (was never stored)
- File buffers are NOT restored (were in RAM, now gone)

---

### Step 10 — Server: Participant Registration & Room Join

```js
const participantId = existingParticipantId || crypto.randomUUID();
const isOwner       = participantId === dbRecord.ownerParticipantId;

const participant = {
  participantId,
  username:  reqUsername,
  socketId:  socket.id,
  joinedAt:  Date.now(),
  isOwner,
};

session.participants.set(participantId, participant);

if (isOwner) session.ownerSocketId = socket.id;

socketToParticipant.set(socket.id, { sessionId: reqSessionId, participantId });
socket.join(`ephemeral_session_${reqSessionId}`);
```

**Owner detection:** `participantId === dbRecord.ownerParticipantId` — no separate auth token needed. If someone rejoins with the original owner's participantId, they get owner privileges back.

---

### Step 11 — Server: Broadcasting to Existing Participants

```js
socket.to(room).emit('participant-joined', {
  participant: {
    participantId,
    username: reqUsername,
    isOwner,
    joinedAt: participant.joinedAt,
  },
  participants: participantsList,   // full updated list
});
```

`socket.to(room)` — sends to everyone in the room **except** the socket that just joined.

In `App.jsx`, `handleParticipantJoined` on the existing participants' side:
1. Updates `activeSession.participants` in React state (sidebar refreshes)
2. Adds system message: `"Rahul joined the session."`
3. Calls `playUserJoinedSound()` — ascending sine tone

---

### Step 12 — Client: handleJoinSuccess

```js
const handleJoinSuccess = (data) => {
  setIsLoading(false);
  setJoinErrorMessage(null);
  setActiveSessionAndRef(data);
  setMessages([
    {
      messageId:  'sys-join',
      senderId:   'SYSTEM',
      senderName: 'SYSTEM',
      isOwner:    false,
      text: `Authenticated to secure line [${data.sessionId}]. Welcome, ${data.username}.`,
      timestamp:  Date.now(),
      isSystem:   true,
    },
  ]);
  setUiState('ACTIVE');
};
```

The messages array starts with **one system welcome message**. No prior history is fetched — there is none. The joiner only sees messages sent after they joined.

---

### Step 13 — What the Joining Participant Has

```js
// data received by joiner:
{
  success:      true,
  sessionId:    "AB3K7M",
  participantId: "new-uuid",   // or existing ID if rejoining
  username:     "Rahul",
  isOwner:      false,
  participants: [
    { participantId: "owner-uuid", username: "Ayush", isOwner: true,  joinedAt: ... },
    { participantId: "new-uuid",   username: "Rahul", isOwner: false, joinedAt: ... }
  ]
}
```

**The joiner does NOT receive the passkey.** The plain passkey no longer exists on the server after the creation response was sent to the owner.

---

## 6. Error Paths — What Can Go Wrong Joining

| Error Code | When It Fires | Message Shown to User |
|---|---|---|
| `SESSION_NOT_FOUND` | `findSessionRecord()` returns null | "Session does not exist or was destroyed." |
| `SESSION_ENDING` | `dbRecord.status !== 'ACTIVE'` | "Session is ending or destroyed and cannot accept new joiners." |
| `INVALID_PASSKEY` | `bcrypt.compare()` returns false | "Invalid session passkey. Verification failed." |
| `PARTICIPANT_BANNED` | `isParticipantBanned()` returns true | "You have been removed by the owner and are banned from this session." |
| `SERVER_ERROR` | Unhandled exception in handler | "Unexpected server error during join." |

All errors flow into `handleJoinError` in `App.jsx`:

```js
const handleJoinError = (err) => {
  setIsLoading(false);
  setJoinErrorMessage(err.message || 'Failed to authenticate to session.');
};
```

`uiState` stays `'JOINING'` — the form remains visible so the user can correct and retry.

---

## 7. Invite Link Deep Dive

### Structure

```
https://plutus-chat.onrender.com/?join=AB3K7M&key=TITAN-482
                                       ──────      ─────────
                                       Session ID  Plain passkey
```

### How it's built (client-side)

```js
// Inside <ActiveSessionView>
const inviteUrl = `${window.location.origin}/?join=${sessionData.sessionId}&key=${sessionData.passkey}`;
```

`sessionData.passkey` was received from the server during session creation and stored in React state. It is not fetched from anywhere — it lives in the owner's browser.

### What happens on link open

1. Browser loads the React SPA.
2. `App.jsx` `useEffect` reads `?join` and `?key` params.
3. Sets `urlSessionId` and `urlPasskey` in state.
4. Sets `uiState = 'JOINING'`.
5. `<JoinSessionView>` renders with both fields pre-filled.
6. User types their username and submits.

### "TEST IN TAB" button

`<ActiveSessionView>` includes a "Test in Tab" button that calls:

```js
window.open(inviteUrl, '_blank');
```

This opens a new browser tab with the invite URL — useful for developers testing two participants in the same browser without a second device.

### Security implications

- The passkey is in the URL → browser history, server access logs, and referrer headers can expose it.
- HTTPS mitigates the referrer/wire exposure, but browser history remains.
- If the link is shared through a logged channel (email, Slack, WhatsApp), the passkey is exposed in that system's logs.
- This is a deliberate **usability-over-security tradeoff** in the current design.

---

## 8. The Active Session State Object

Once inside a session, `activeSession` React state (and `activeSessionRef.current`) holds:

```ts
interface ActiveSession {
  success:       boolean;
  sessionId:     string;        // "AB3K7M"
  participantId: string;        // UUID v4 — YOUR identity
  username:      string;        // YOUR display name
  isOwner:       boolean;

  passkey?:      string;        // ONLY present for session creator

  participants:  Array<{
    participantId: string;
    username:      string;
    isOwner:       boolean;
    joinedAt:      number;      // Unix ms
  }>;
}
```

This object:
- Is **never stored in MongoDB** — only in browser React state
- Is **cleared** when the session ends (`setActiveSessionAndRef(null)`)
- Is passed as the `sessionData` prop to `<ActiveSessionView>`
- Has its `participants` array updated in real-time by socket events (`participant-joined`, `participant-left`, `participant-kicked`)

---

## 9. RAM vs MongoDB — What Lives Where

### At Session Creation

| Data | RAM `sessions` Map | MongoDB `sessions` collection |
|---|---|---|
| Session ID | Yes — map key | Yes — `sessionId` field |
| Owner participant ID | Yes — `ownerParticipantId` | Yes — `ownerParticipantId` |
| Plain passkey | **Never stored** | **Never stored** |
| Passkey bcrypt hash | No — not needed in RAM | Yes — `passkeyHash` |
| Status | Yes — `session.status` | Yes — `status` |
| Owner socket ID | Yes — `ownerSocketId` | No — socket IDs are transient |
| Participants Map | Yes — `session.participants` | No |
| Bans Set | Yes — `bannedParticipantIds` | Yes — `SessionBan` collection |
| File buffers | Yes — `ephemeralFiles` Map | Never |
| Destroy timer | Yes — `destroyTimeoutId` | No |

### On Server Restart

| Survives | Lost |
|---|---|
| Session metadata (ID, owner, passkey hash, status) | All live participants (RAM wiped) |
| Ban records (`SessionBan` documents) | All socket room memberships |
| Session status (`ACTIVE` / `ENDING`) | All ephemeral file buffers |
| | All in-progress destroy timers |
| | All message history (was never stored anywhere) |

---

## 10. Sequence Diagrams

### Session Creation

```
Owner Browser              App.jsx             socket.js          server.js           MongoDB
─────────────────          ──────────          ─────────          ─────────           ───────
Click "Create Session"
  │
  ├─► setUiState('CREATING')
  │   <CreateSessionView renders>
  │
Enter username → Click submit
  │
  ├─► handleCreateSession(username)
  │       setIsLoading(true)
  │         │
  │         ├─► emit('create-session', {username}) ─────────────────────────────────►
  │                                                              │
  │                                                      generateSessionId()
  │                                                      [DB + RAM collision loop]
  │                                                      generatePasskey()
  │                                                      hashPasskey() ──────────────► bcrypt.hash()
  │                                                              │◄─────────────────── passkeyHash
  │                                                      createSessionRecord() ───────► Session.create()
  │                                                      init RAM session object
  │                                                      socket.join(room)
  │                                                              │
  │◄───────── callback({success, sessionId, passkey, participantId, isOwner, participants}) ◄──
  │
  ├─► handleSessionCreated(data)
  │       setIsLoading(false)
  │       setActiveSessionAndRef(data)
  │       setMessages([])
  │       setUiState('ACTIVE')
  │
<ActiveSessionView renders — session credentials + chat>
```

### Session Join (via Invite Link)

```
Joiner Browser             App.jsx             socket.js          server.js           MongoDB
─────────────────          ──────────          ─────────          ─────────           ───────
Open ?join=AB3K7M&key=TITAN-482
  │
  ├─► useEffect reads params
  │       setUrlSessionId("AB3K7M")
  │       setUrlPasskey("TITAN-482")
  │       setUiState('JOINING')
  │   <JoinSessionView renders — fields pre-filled>
  │
Enter username → Click submit
  │
  ├─► handleJoinSession(sessionId, passkey, username)
  │       setIsLoading(true)
  │       setJoinErrorMessage(null)
  │         │
  │         ├─► emit('join-session', {sessionId, passkey, username}) ──────────────►
  │                                                              │
  │                                                      findSessionRecord() ─────────► Session.findOne()
  │                                                      [status === ACTIVE?]
  │                                                      verifyPasskey() ─────────────► bcrypt.compare()
  │                                                      isParticipantBanned() ────────► SessionBan.exists()
  │                                                      [reconstruct RAM if server restarted]
  │                                                      session.participants.set()
  │                                                      socket.join(room)
  │                                                              │
  │                                       socket.to(room).emit('participant-joined') ──► Owner Browser
  │                                                              │                           │
  │◄────────── callback({success, sessionId, participantId, username, isOwner, participants}) ◄
  │                                                                               handleParticipantJoined(data)
  ├─► handleJoinSuccess(data)                                                     update participants list
  │       setIsLoading(false)                                                     add system message
  │       setActiveSessionAndRef(data)                                            playUserJoinedSound()
  │       setMessages([sys-welcome])
  │       setUiState('ACTIVE')
  │
<ActiveSessionView renders>
```

---

## 11. Key Data Structures Reference

### `sessions` Map — Server RAM

```js
// Map<sessionId, SessionObject>
{
  sessionId:            "AB3K7M",
  ownerParticipantId:   "uuid-v4",
  ownerSocketId:        "socket-id" | null,
  participants: Map<participantId, {
    participantId: "uuid-v4",
    username:      "Ayush",
    socketId:      "socket-id",
    joinedAt:      1234567890,
    isOwner:       true,
  }>,
  bannedParticipantIds: Set<"uuid-v4">,
  status:               "ACTIVE" | "ENDING" | "DESTROYED",
  createdAt:            1234567890,
  destroyAt:            null | number,
  endingReason:         null | "OWNER_LEFT" | "OWNER_ENDED",
  warningDurationMs:    5000,
  countdownDurationMs:  10000,
  destroyTimeoutId:     null | TimeoutId,
}
```

### `socketToParticipant` Map — Server RAM

```js
// Map<socket.id, { sessionId, participantId }>
{ sessionId: "AB3K7M", participantId: "uuid-v4" }
```

### `Session` — MongoDB Document

```js
{
  _id:                ObjectId,
  sessionId:          "AB3K7M",   // unique, indexed
  ownerParticipantId: "uuid-v4",
  passkeyHash:        "$2b$10$...",  // bcrypt hash only — never plain passkey
  status:             "ACTIVE" | "ENDING" | "EXPIRED" | "DESTROYED",
  createdAt:          ISODate,
  expiresAt:          null | ISODate,
  endingReason:       null | string,
}
```

### `SessionBan` — MongoDB Document

```js
{
  _id:           ObjectId,
  sessionId:     "AB3K7M",   // indexed
  participantId: "uuid-v4",
  bannedAt:      ISODate,
  // Composite unique index on (sessionId, participantId)
}
```

### Socket Events — Create & Join

| Event | Direction | When |
|---|---|---|
| `create-session` | Browser → Server | Owner submits create form |
| `session-created` | Server → Browser | Session created (via callback) |
| `join-session` | Browser → Server | Participant submits join form |
| `join-success` | Server → Browser | All 4 validations pass (via callback) |
| `join-error` | Server → Browser | Any validation fails (via callback) |
| `participant-joined` | Server → All Others in Room | New participant added |

---

*Document generated: 2026-08-30*
*Source files analysed: `server.js`, `App.jsx`, `CreateSessionView.jsx`, `JoinSessionView.jsx`, `socket.js`, `sessionService.js`, `authenticationService.js`, `generateSessionId.js`, `generatePasskey.js`, `Session.js`, `SessionBan.js`, `database.js`*
