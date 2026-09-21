# Private Text Channel & Notifications — Complete Architecture Reference

> **Scope:** Every layer of the feature — identity registration, Text Channel privacy gate, message sending rules & constraints, inbox access, view-once self-destruction, session management, account wipe, API surface, database schema, rate limits, and security design — documented in exhaustive detail.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Identity & Account System](#2-identity--account-system)
3. [Authentication & Session System](#3-authentication--session-system)
4. [Text Channel — Privacy Gate](#4-text-channel--privacy-gate)
5. [Who Can Send Messages — To Whom — When](#5-who-can-send-messages--to-whom--when)
6. [Message Sending — Full Constraints & Rules](#6-message-sending--full-constraints--rules)
7. [Message Types: Normal vs View-Once](#7-message-types-normal-vs-view-once)
8. [Who Can View Notifications — And How](#8-who-can-view-notifications--and-how)
9. [View-Once Message — Open & Destroy Flow](#9-view-once-message--open--destroy-flow)
10. [Message Deletion — Manual Purge](#10-message-deletion--manual-purge)
11. [Account Wipe — Full Data Purge](#11-account-wipe--full-data-purge)
12. [API Endpoints Reference](#12-api-endpoints-reference)
13. [Database Schema — MongoDB Models](#13-database-schema--mongodb-models)
14. [In-Memory Fallback Store](#14-in-memory-fallback-store)
15. [Rate Limiting](#15-rate-limiting)
16. [Security Design](#16-security-design)
17. [UI Component Map](#17-ui-component-map)
18. [Complete Data Flow Diagrams](#18-complete-data-flow-diagrams)
19. [All Constraints — Quick Reference](#19-all-constraints--quick-reference)

---

## 1. Feature Overview

The **Private Text Channel & Notifications** system is a **persistent, authentication-gated, asynchronous messaging channel** fully **independent from the ephemeral real-time chat sessions** of the main app.

### Core Concept

```
Sender (registered user) ──── sends message ────► Receiver's Text Channel
                                                       │
                                              (only if channel is OPEN)
                                                       │
                                              Stored in MongoDB / RAM
                                                       │
                         Receiver authenticates and views inbox ◄────┘
```

### Key Design Principles

| Principle | Description |
|-----------|-------------|
| **Receiver-controlled gate** | The receiver explicitly enables/disables their Text Channel. If disabled, no messages are accepted. |
| **Both parties must be registered** | Sender must have an account AND be authenticated. Receiver must have an account AND have their channel enabled. |
| **No real-time push** | Messages are stored server-side and pulled on demand — no WebSocket or push notification involved. |
| **View-once self-destruction** | Sender can mark a message as "view-once"; server permanently deletes it the instant the receiver opens it. |
| **Email as identity** | Email addresses (normalized to lowercase) serve as the sole identifier — no usernames, no display names. |
| **Zero plaintext passkey storage** | Passkeys are bcrypt-hashed (10 salt rounds) before persistence. Never logged or stored raw. |
| **Brute-force protection** | 5 failed auth attempts → 15-minute lockout per email, tracked server-side in RAM. |
| **Independent from chat sessions** | Creating/destroying ephemeral chat sessions has zero effect on notification accounts or messages. |

---

## 2. Identity & Account System

### 2.1 Registration

**Who can register:** Any user who knows the app's URL. No invite required.

**What is stored:**

| Field | Type | Details |
|-------|------|---------|
| `email` | `String` | Normalized to lowercase, trimmed, unique, indexed |
| `passkeyHash` | `String` | bcrypt hash (10 rounds) of the user-chosen passkey |
| `channelEnabled` | `Boolean` | Default: `false` — channel is OFF after registration |
| `lastAuthenticatedAt` | `Date` | Updated on every successful login |
| `channelCreatedAt` | `Date` | Timestamp of most recent channel enable |
| `channelDisabledAt` | `Date` | Timestamp of most recent channel disable |
| `createdAt` | `Date` | Account creation timestamp |
| `updatedAt` | `Date` | Last modification timestamp |

**Registration constraints:**
- Email must pass RFC-style regex: `[^\s@]+@[^\s@]+\.[^\s@]+`
- Email is unique — duplicate registration returns: `"This email is already registered."`
- Passkey must be **at least 4 characters** long
- Passkey must be confirmed (UI enforces match before submission)
- Rate limit: **10 registration attempts / 60 seconds / IP**

**After registration:** Account is created with `channelEnabled = false`. The UI auto-logs the user in and redirects to the Text Channel tab.

### 2.2 Email Normalization

All emails go through `normalizeEmail()`:
```
"  Alice@Gmail.COM  " → "alice@gmail.com"
```
`Alice@Gmail.com`, `alice@gmail.com`, and `  ALICE@GMAIL.COM  ` all resolve to the same account.

### 2.3 Passkey Security

```
User input passkey
      │
      ▼
bcrypt.hash(passkey.trim(), saltRounds=10)
      │
      ▼
Stored as passkeyHash in MongoDB
```

- The raw passkey is **never stored anywhere** — not in logs, not in session records, not in memory
- Verification uses `bcrypt.compare(candidatePasskey, storedHash)`

---

## 3. Authentication & Session System

This feature uses its **own dedicated session system**, entirely separate from the WebSocket-based ephemeral chat session system.

### 3.1 Session Creation (Login)

**Endpoint:** `POST /api/notifications/auth/login`

**Flow:**
```
Client sends { email, passkey }
      │
      ▼
Server normalizes email
      │
      ▼
Brute-force check: isAuthLockedOut(email)?
  YES → 429: "Too many failed authentication attempts"
  NO  → continue
      │
      ▼
findUserByEmail(email)
  NOT FOUND → recordFailedAuth(email); 401
      │
      ▼
bcrypt.compare(passkey, user.passkeyHash)
  FAIL → recordFailedAuth(email); 401
  PASS → clearFailedAuth(email)
      │
      ▼
Update user.lastAuthenticatedAt = now
      │
      ▼
createNotificationSession(email):
  - Generate 32 random bytes → hex token (64 chars)
  - Store: { token, email, createdAt, lastActivityAt, expiresAt }
  - Index in userSessionIndex Map (bulk invalidation support)
      │
      ▼
Set HttpOnly cookie: notification_session=<token>; Max-Age=1800; SameSite=Lax
Return: { success, email, channelEnabled, token, expiresInMs }
```

### 3.2 Session Lifecycle

| Property | Value |
|----------|-------|
| **Idle timeout** | 30 minutes from last activity |
| **Absolute max lifetime** | 12 hours from creation |
| **Activity refresh** | Every authenticated API call refreshes `lastActivityAt` |
| **Cleanup interval** | Server sweeps expired sessions every 5 minutes |

### 3.3 Session Token Transport

Token accepted in any one of three ways (checked in order):

1. `Authorization: Bearer <token>` header
2. `X-Notification-Token: <token>` custom header
3. `notification_session=<token>` HttpOnly cookie

### 3.4 Session Verification (`resolveSession` middleware)

```
Extract token from request
      │
      ▼
verifyNotificationSession(token):
  - Not found → invalid
  - now - createdAt > 12h → destroy → "Session lifetime exceeded"
  - now - lastActivityAt > 30min → destroy → "Session expired due to inactivity"
  - VALID → refresh lastActivityAt; req.sessionEmail = email
```

### 3.5 Pre-Authentication Mode

When a valid session is present, routes set `isPreAuthenticated = true` and skip passkey verification entirely. The session token acts as full auth proof.

### 3.6 Brute-Force Protection

- After **5 consecutive failed attempts** → lockout for **15 minutes** per email
- Lockout tracked in RAM; resets on successful authentication

### 3.7 Logout

**Endpoint:** `POST /api/notifications/auth/logout`

- Destroys specific session token from `notificationSessions` Map and `userSessionIndex`
- Clears the `notification_session` cookie (Max-Age=0)

---

## 4. Text Channel — Privacy Gate

Every registered user has a **Text Channel** — a binary gate controlling whether others can send them messages.

### 4.1 Channel States

| State | `channelEnabled` | What it means |
|-------|------------------|--------------|
| **Disabled** (default) | `false` | No messages accepted. Senders get: `"This user is currently not accepting notifications."` |
| **Active** | `true` | Messages from any other registered + authenticated sender are accepted |

### 4.2 Enabling the Channel

**Endpoint:** `POST /api/notifications/channel/create`  
**Auth:** Active session OR email + passkey  
**Effect:** Sets `channelEnabled = true`, records `channelCreatedAt = now`

### 4.3 Disabling the Channel

**Endpoint:** `POST /api/notifications/channel/disable`  
**Auth:** Active session OR email + passkey  
**Effect:** Sets `channelEnabled = false`, records `channelDisabledAt = now`  
> **Existing inbox messages are NOT deleted** when channel is disabled.

### 4.4 Checking Channel Status

**Endpoint:** `POST /api/notifications/channel/status`  
**Returns:** `{ email, channelEnabled, createdAt }`

### 4.5 Anti-Enumeration Protection

- Receiver **does not exist** → `"This user is currently not accepting notifications."`
- Receiver **exists but channel is disabled** → **same message**

This prevents senders from discovering which emails are registered.

---

## 5. Who Can Send Messages — To Whom — When

### WHO CAN SEND

A user **CAN send** only if ALL of the following are true:

1. **They have a registered Notification Account**
2. **They are authenticated** via:
   - Active valid session token, OR
   - `senderEmail` + `passkey` in the request body
3. **Passkey verification succeeds** (or session is pre-authenticated)

### TO WHOM CAN THEY SEND

1. **Receiver has a registered Notification Account**
2. **Receiver's Text Channel is enabled** (`channelEnabled = true`)

### WHO CANNOT SEND

| Condition | Error Returned |
|-----------|----------------|
| Sender not registered | `"Authentication failed. Please verify your email and passkey."` |
| Sender passkey wrong | `"Authentication failed. Please verify your email and passkey."` |
| Sender brute-force locked | `"Too many failed authentication attempts. Please try again later."` |
| No session + no passkey | `"Sender passkey is required."` |
| Receiver not registered | `"This user is currently not accepting notifications."` |
| Receiver channel disabled | `"This user is currently not accepting notifications."` |

### SELF-MESSAGING

The system does **not explicitly block self-messaging**. A user can message their own email if their channel is enabled.

### WHEN CAN THEY SEND

- **Anytime** — no time-based restriction
- While rate limit is not exceeded: **30 sends / 60 seconds / IP**
- While session is valid (≤30 min idle, ≤12 hours absolute)

---

## 6. Message Sending — Full Constraints & Rules

### 6.1 Sending Flow

```
POST /api/notifications/send
{ senderEmail, passkey?, receiverEmail, content, viewOnce }
      │
      ▼
Rate limit check (30 req/min/IP)
      │
      ▼
Validate senderEmail format
Validate receiverEmail format
      │
      ▼
Authenticate sender:
  Session active → isPreAuthenticated = true, skip passkey
  No session     → authenticateUser(senderEmail, passkey)
      │
      ▼
findUserByEmail(receiverEmail)
  Not found OR channelEnabled = false
    → 403: "This user is currently not accepting notifications."
      │
      ▼
Validate content:
  Empty/whitespace → "Message cannot be empty."
  Length > 5000   → "Message exceeds the maximum allowed length (5000 characters)."
      │
      ▼
Trim content
      │
      ▼
NotificationMessage.create({
  senderEmail, receiverEmail, content,
  viewOnce, viewed: false, viewedAt: null, createdAt: now
})
      │
      ▼
Return 201: { success, data: { id, senderEmail, receiverEmail, viewOnce, createdAt } }
```

> **Note:** Message content is NOT echoed back in the send response. Only metadata is returned.

### 6.2 Message Field Constraints

| Field | Constraint |
|-------|------------|
| `senderEmail` | Valid email; registered account; authentication must pass |
| `passkey` | Required if no session; min 4 chars (set at registration) |
| `receiverEmail` | Valid email; receiver registered AND channel enabled |
| `content` | Cannot be empty/whitespace; max **5,000 characters** |
| `viewOnce` | Boolean, default `false`; immutable after creation |

---

## 7. Message Types: Normal vs View-Once

### 7.1 Normal Message (`viewOnce = false`)

| Aspect | Behavior |
|--------|----------|
| Content in list | Full content visible directly in inbox |
| Read tracking | `viewed = true`, `viewedAt = now` set when opened via `POST /messages/:id` |
| Persistence | Remains in DB until receiver manually deletes it |
| Delete | Receiver can delete; no sender copy stored |

### 7.2 View-Once Message (`viewOnce = true`)

| Aspect | Behavior |
|--------|----------|
| Content in list | **Masked** (`null`) — only sender, timestamp, badge shown |
| Opening | Receiver must click "Open Once" and confirm destruction |
| On open | Atomic `findOneAndDelete` — content fetched AND doc deleted in one DB op |
| After open | Message gone from DB permanently; cannot be re-opened by anyone |
| Delete button | Not shown in UI (auto-destroyed on open) |

### 7.3 Comparison Table

| Aspect | Normal | View-Once |
|--------|--------|-----------|
| Content in inbox list | Full content | `null` (masked) |
| Re-readable | Yes, unlimited | No — deleted on first open |
| Manual delete | Yes (trash icon) | No (auto-destroyed) |
| Send confirmation text | "Message delivered to recipient text channel." | "View-Once message dispatched! ... automatic self-destruction." |
| `viewed` field tracked | Yes | Not applicable (doc deleted) |

---

## 8. Who Can View Notifications — And How

### 8.1 Who Can View

**Only the receiver** can view their own inbox. The `receiverEmail` filter is enforced server-side on every query — there is no way to access another user's messages.

**Required:** Authentication via active session OR correct email + passkey.

### 8.2 How to Access the Inbox

**Endpoint:** `POST /api/notifications/messages`

**Mode A — Session:**
```
Headers: Authorization: Bearer <token>
Body:    { email: "me@example.com" }
```

**Mode B — Inline credentials:**
```
Body: { email: "me@example.com", passkey: "my-passkey" }
```

### 8.3 Inbox Response Shape

```json
{
  "success": true,
  "messages": [
    {
      "id": "64c...",
      "senderEmail": "alice@example.com",
      "receiverEmail": "bob@example.com",
      "content": "Hello Bob!",
      "viewOnce": false,
      "viewed": true,
      "viewedAt": "2026-09-21T13:45:00.000Z",
      "createdAt": "2026-09-21T13:00:00.000Z"
    },
    {
      "id": "64d...",
      "senderEmail": "carol@example.com",
      "receiverEmail": "bob@example.com",
      "content": null,
      "viewOnce": true,
      "viewed": false,
      "viewedAt": null,
      "createdAt": "2026-09-21T14:00:00.000Z"
    }
  ]
}
```

**Sorting:** Messages sorted by `createdAt` descending (newest first).

### 8.4 Opening a Single Message

**Endpoint:** `POST /api/notifications/messages/:id`

- **Normal:** Returns full content; sets `viewed = true`, `viewedAt = now`; doc remains
- **View-once:** Atomic `findOneAndDelete`; returns content once; doc permanently deleted

---

## 9. View-Once Message — Open & Destroy Flow

```
Receiver clicks "Open Once"
      │
      ▼
ViewOnceModal — CONFIRM step
Warning shown:
  - Content displayed on screen
  - Server immediately and irrevocably deletes the message
  - Cannot be opened again by anyone
      │
      ▼
Receiver clicks "Open & Destroy"
      │
      ▼
POST /api/notifications/messages/:id { email }
      │
      ▼ [SERVER]
Authenticate receiver
      │
      ▼
NotificationMessage.findOneAndDelete({
  _id: messageId,
  receiverEmail: normEmail,
  viewOnce: true
})
  Returns null → 404 "Message not found or already consumed."
  Returns doc  → proceed
      │
      ▼
Return { content, consumed: true, ... }
      │
      ▼ [CLIENT]
Modal → VIEWING step
Content shown + Copy button
Banner: "Message has been permanently deleted from server storage."
onMessageConsumed(id) → removed from inbox React state
```

### 9.1 Race Condition Protection

`findOneAndDelete` with `{ viewOnce: true }` condition guarantees atomicity:
- Two simultaneous open requests: only one receives the document
- The second gets `null` → `"Message not found or already consumed."`
- Content revealed exactly **once** regardless of concurrent attempts

---

## 10. Message Deletion — Manual Purge

**Who can delete:** Only the receiver. Senders cannot delete messages after sending.

**Endpoint:** `DELETE /api/notifications/messages/:id`  
**Auth:** Active session OR inline credentials

**Server enforcement:**
```js
NotificationMessage.deleteOne({
  _id: messageId,
  receiverEmail: normEmail  // receiver-only enforcement
})
// deletedCount === 0 → 404 "Message not found or unauthorized."
```

**UI flow:**
1. User clicks trash icon (only on normal messages — view-once has no trash icon)
2. `window.confirm("Delete this message permanently?")`
3. If confirmed → `DELETE /api/notifications/messages/:id`
4. Success → message removed from React state + toast: `"Message deleted."`

---

## 11. Account Wipe — Full Data Purge

### 11.1 What Gets Deleted

| Data | Operation |
|------|----------|
| `NotificationUser` document | `deleteOne({ email })` |
| All received messages | `deleteMany({ receiverEmail: email })` |
| All sent message records | `deleteMany({ senderEmail: email })` |
| All active session tokens | `destroyAllUserSessions(email)` — RAM wipe |
| Session cookie | Set `Max-Age=0` |

### 11.2 Deletion Endpoint

`DELETE /api/notifications/account`

**Even with an active session, the passkey is still required** (extra confirmation layer).

### 11.3 UI — Two-Step Confirmation

1. User enters email + passkey on Delete tab
2. Clicks "CONFIRM PASSKEY & PURGE ACCOUNT"
3. Modal appears listing everything that will be destroyed
4. "This action cannot be undone."
5. User clicks "Permanently Delete" to execute

### 11.4 Constraints

- Requires passkey even if session is active
- Irreversible — no soft delete, no recovery path
- Immediately invalidates ALL active sessions for that email

---

## 12. API Endpoints Reference

All routes mounted at `/api/notifications`.

### Authentication Routes

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/auth/login` | No (credentials in body) | 20/min/IP | Login → create session + set cookie |
| `GET` | `/auth/session` | Optional | None | Check if current session is valid |
| `POST` | `/auth/logout` | Optional | None | Invalidate session + clear cookie |

### Account Routes

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/register` | No | 10/min/IP | Register new notification account |
| `DELETE` | `/account` | Session OR passkey | 20/min/IP | Permanent account + data wipe |

### Channel Routes

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/channel/create` | Session OR passkey | 20/min/IP | Enable text channel |
| `POST` | `/channel/disable` | Session OR passkey | 20/min/IP | Disable text channel |
| `POST` | `/channel/status` | Session OR passkey | 20/min/IP | Get channel state |

### Message Routes

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/send` | Session OR passkey | **30/min/IP** | Send a message |
| `POST` | `/messages` | Session OR passkey | 20/min/IP | List all received messages |
| `POST` | `/messages/:id` | Session OR passkey | 20/min/IP | Open single message (consumes view-once) |
| `DELETE` | `/messages/:id` | Session OR passkey | 20/min/IP | Delete a received message |

> **Why `POST` for reading?** Credentials (email, passkey) are sent in the request body — avoiding leaking sensitive data in URLs or server logs.

---

## 13. Database Schema — MongoDB Models

### 13.1 NotificationUser

```js
// Collection: notificationusers
{
  email:               String,   // required, unique, indexed, lowercase
  passkeyHash:         String,   // required — bcrypt hash (10 rounds)
  channelEnabled:      Boolean,  // default: false
  lastAuthenticatedAt: Date,     // updated on every login
  channelCreatedAt:    Date,     // set when channel enabled
  channelDisabledAt:   Date,     // set when channel disabled
  createdAt:           Date,
  updatedAt:           Date,
}
```

**Index:** `email` — unique index

### 13.2 NotificationMessage

```js
// Collection: notificationmessages
{
  senderEmail:   String,   // required, indexed, lowercase
  receiverEmail: String,   // required, indexed, lowercase
  content:       String,   // required, maxlength: 5000
  viewOnce:      Boolean,  // default: false
  viewed:        Boolean,  // default: false
  viewedAt:      Date,     // set when normal message opened
  readAt:        Date,     // reserved field
  expiresAt:     Date,     // indexed — reserved for future TTL
  createdAt:     Date,     // indexed
}
```

**Compound Index:**
```js
{ receiverEmail: 1, createdAt: -1 }
// Optimizes: "get all messages for receiver, sorted newest first"
```

---

## 14. In-Memory Fallback Store

When MongoDB is disconnected, the system falls back to in-memory Maps:

```js
const inMemoryUsers    = new Map(); // email     → userObject
const inMemoryMessages = new Map(); // messageId → messageObject
```

- Ephemeral — data lost on server restart
- Fully functional for all operations during DB downtime
- View-once atomicity maintained: `inMemoryMessages.delete(messageId)` before returning content
- **Session store is always in-memory** — no DB persistence for sessions by design

---

## 15. Rate Limiting

IP-based, sliding-window in-memory counter.

| Limiter | Max Requests | Window | Applied To |
|---------|-------------|--------|-----------|
| `authLimiter` | 20 | 60 seconds | Login, channel ops, view/open/delete messages, delete account |
| `sendLimiter` | 30 | 60 seconds | Send message only |
| `registerLimiter` | 10 | 60 seconds | Registration only |

HTTP `429` returned when exceeded.

---

## 16. Security Design

### 16.1 Passkey Security
- **bcrypt hash, 10 salt rounds** — computationally expensive, rainbow table resistant
- Raw passkey **never logged, stored, or transmitted** server-side after hashing
- Compromising a session token does NOT reveal the passkey

### 16.2 Anti-Enumeration
- Same error for "receiver not registered" and "channel disabled"
- Prevents using the send endpoint to probe which emails are registered

### 16.3 Session Security
- 32 cryptographically random bytes → hex (256 bits entropy)
- **HttpOnly cookie** — inaccessible to XSS / JavaScript
- `SameSite=Lax` — CSRF mitigation
- `Secure` flag in production
- 30-min idle + 12-hour absolute expiry
- Full session index wiped on account deletion

### 16.4 Message Authorization
```js
// Server enforces receiver ownership on every read/delete
NotificationMessage.findOne({ _id: messageId, receiverEmail: normEmail })
// Mismatch → 404 "not found or unauthorized"
```

### 16.5 Brute-Force Protection
- 5 wrong passwords → 15-minute per-email lockout
- Tracked in RAM, independent from IP rate limiting

### 16.6 Content Limits
- Message max **5,000 characters** (client + server validated)
- JSON body parser limited to **2MB** (Express level)

---

## 17. UI Component Map

```
NotificationsView.jsx             ← Top-level container
│  - Session state management
│  - Tab routing: SEND | MESSAGES | CHANNEL | ACCOUNT
│  - Session status bar + Sign Out button
│  - Auto-verifies session on mount via GET /auth/session
│
├── SendMessageCard.jsx           ← "Send Message" tab
│     - Sender identity (session or manual email+passkey)
│     - Receiver email input
│     - Message textarea (0/5000 counter)
│     - View-Once checkbox
│     - POST /api/notifications/send
│
├── ViewMessagesCard.jsx          ← "View Messages" tab
│     - Auth form or inbox (if session active)
│     - Inbox list: sender, timestamp, content or View-Once badge
│     - Trash button on normal messages
│     - "Open Once" button on view-once messages
│     - Refresh button
│     └── ViewOnceModal.jsx
│           - CONFIRM → LOADING → VIEWING → ERROR steps
│           - POST /api/notifications/messages/:id
│
├── TextChannelCard.jsx           ← "Text Channel" tab
│     - Auth form or identity pill (if session)
│     - Channel status (Active / Disabled)
│     - Enable / Disable toggle
│     - POST /api/notifications/channel/status|create|disable
│
└── AccountCard.jsx               ← "Account" tab
      ├── Sign In → POST /auth/login
      ├── Register → POST /register
      └── Delete → DELETE /account (two-step modal)
```

---

## 18. Complete Data Flow Diagrams

### 18.1 Sending a Message (Session-Authenticated)

```
Browser (Sender)              Server                      MongoDB
     │                          │                              │
     │── POST /send ───────────►│                              │
     │   Bearer <token>         │── verifySession ────────────►│
     │   { receiverEmail,       │◄── { valid, email } ─────────│
     │     content, viewOnce }  │── findUserByEmail(recv) ────►│
     │                          │◄── receiver doc ─────────────│
     │                          │   channelEnabled? YES        │
     │                          │── NotificationMessage.create►│
     │                          │◄── saved message ────────────│
     │◄── 201 { success, data }─│                              │
```

### 18.2 Opening a View-Once Message

```
Browser (Receiver)            Server                      MongoDB
     │                          │                              │
     │  [click "Open Once"]     │                              │
     │  [see warning modal]     │                              │
     │  [click "Open & Destroy"]│                              │
     │── POST /messages/:id ───►│                              │
     │   Bearer <token>         │── verifySession ────────────►│
     │                          │── findOneAndDelete({         │
     │                          │     _id, receiverEmail,      │
     │                          │     viewOnce: true          │
     │                          │   }) ──────────────────────►│
     │                          │◄── deletedDoc (atomic) ──────│
     │◄── 200 { content,        │                              │
     │         consumed: true } │                              │
     [VIEWING step in modal]    │                              │
     ["Permanently deleted"]    │                              │
     [Removed from inbox list]  │                              │
```

---

## 19. All Constraints — Quick Reference

### Registration
- Valid email format required
- Email must be globally unique
- Passkey minimum 4 characters
- 10 registration attempts / 60s / IP

### Authentication
- Email + passkey OR active session token
- 5 failed attempts → 15-min per-email lockout
- Session idle timeout: 30 minutes
- Session max lifetime: 12 hours
- 20 auth attempts / 60s / IP

### Text Channel
- OFF by default on registration
- Owner must explicitly enable it
- Can be toggled anytime
- Disabling does NOT delete existing inbox messages

### Sending Messages
- Sender must be registered AND authenticated
- Receiver must be registered AND have channel enabled
- Content cannot be empty or whitespace-only
- Content max **5,000 characters**
- 30 sends / 60s / IP
- Same error for "not registered" vs "channel disabled" (anti-enumeration)

### View-Once Messages
- Content masked (`null`) in inbox listing
- Receiver must confirm before opening
- Atomic delete on open — race condition safe
- Exactly one consumer guaranteed
- No manual delete button (auto-destroyed on open)

### Inbox Access
- Only the receiver can access their inbox
- `receiverEmail` enforced server-side on every query
- Authentication required on every fetch

### Message Deletion (Manual)
- Only receiver can delete
- `receiverEmail` enforced on delete operation
- Senders cannot delete messages after sending

### Account Wipe
- Passkey required even with active session
- Two-step UI confirmation
- Deletes: user record + all messages (received + sent) + all sessions
- **Irreversible** — no soft delete, no recovery

---

*File: NOTIFICATION_ARCHITECTURE.md — Generated 2026-09-21*  
*Source: NotificationUser.js, NotificationMessage.js, notificationService.js, notificationSessionService.js, notificationRoutes.js, NotificationsView.jsx, SendMessageCard.jsx, ViewMessagesCard.jsx, TextChannelCard.jsx, AccountCard.jsx, ViewOnceModal.jsx*
