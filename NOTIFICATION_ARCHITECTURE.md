# Private Messages & Notifications — Complete Architecture Reference

> **Scope:** Every layer of the feature — identity registration, seamless continue authentication, Text Channel privacy gate, message sending rules & constraints, inbox dashboard, view-once self-destruction, session management, account wipe, API surface, database schema, rate limits, and security design — documented in exhaustive detail in accordance with the latest codebase and UI refactor.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Identity & Account System](#2-identity--account-system)
3. [Authentication & Session System](#3-authentication--session-system)
4. [Text Channel — Privacy Gate](#4-text-channel--privacy-gate)
5. [Who Can Send Messages — To Whom — When](#5-who-can-send-messages--to-whom--when)
6. [Message Sending — Full Constraints & Rules](#6-message-sending--full-constraints--rules)
7. [Message Types: Normal vs View-Once](#7-message-types-normal-vs-view-once)
8. [Who Can View Messages — And How](#8-who-can-view-messages--and-how)
9. [View-Once Message — Open & Destroy Flow](#9-view-once-message--open--destroy-flow)
10. [Message Deletion — Manual Purge](#10-message-deletion--manual-purge)
11. [Account Wipe — Full Data Purge](#11-account-wipe--full-data-purge)
12. [API Endpoints Reference](#12-api-endpoints-reference)
13. [Database Schema — MongoDB Models](#13-database-schema--mongodb-models)
14. [In-Memory Fallback Store](#14-in-memory-fallback-store)
15. [Rate Limiting](#15-rate-limiting)
16. [Security Design](#16-security-design)
17. [UI Component Architecture & Map](#17-ui-component-architecture--map)
18. [Complete Data Flow Diagrams](#18-complete-data-flow-diagrams)
19. [All Constraints — Quick Reference](#19-all-constraints--quick-reference)

---

## 1. Feature Overview

The **Private Messages** (internally and historically referenced as **Notifications & Text Channel**) system is a **persistent, authentication-gated, asynchronous messaging channel** fully **independent from the ephemeral real-time chat sessions** of the main Plutus app.

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
| **Receiver-controlled gate** | The receiver explicitly enables/disables their Text Channel via Privacy Settings. If disabled, no messages are accepted. |
| **Both parties must be registered** | Sender must have an account AND be authenticated. Receiver must have an account AND have their channel enabled. |
| **No real-time push** | Messages are stored server-side and pulled on demand via HTTP polling/refresh — no WebSocket or push notification involved. |
| **View-once self-destruction** | Sender can mark a message as "view-once"; the server permanently deletes it the instant the receiver confirms and opens it. |
| **Email as identity** | Email addresses (normalized to lowercase) serve as the sole identifier — no public directory, no usernames, no avatars. |
| **Zero plaintext passkey storage** | Passkeys are bcrypt-hashed (10 salt rounds) before persistence. Never logged or stored raw. |
| **Brute-force protection** | 5 consecutive failed auth attempts → 15-minute lockout per email, tracked server-side in memory. |
| **Unified "Continue" onboarding** | Smart authentication endpoint (`POST /auth/continue`) automatically signs in existing users or provisions new accounts in a single step. |
| **Independent from chat sessions** | Creating or destroying ephemeral WebRTC chat lines has zero effect on private message accounts or inboxes. |

### Terminology & Routing Modernization

- **UI Refactor ("Notifications" → "Messages"):** The user-facing terminology and navigation were refactored to **Messages** (with subtitle *Private Inbox* and button *MESSAGES*) to reflect real-world user intent.
- **Client Route URLs:** The browser URL uses `/messages` (and hash `#messages`), while maintaining backward compatibility with `/notifications` (and hash `#notifications`).
- **Backend API Prefix:** Server routes remain mounted under `/api/notifications/*` for API contract stability and compatibility.

---

## 2. Identity & Account System

### 2.1 Registration & Onboarding Flows

Accounts can be provisioned in two ways:

1. **Smart Continue Flow (`POST /api/notifications/auth/continue`):**  
   The primary onboarding path in the UI (`MessagesAuthScreen.jsx`). If the email does not exist, the server automatically creates the account, optionally initializes `channelEnabled = allowMessages` (default: `true`), generates an authenticated session token, sets the session cookie, and returns HTTP 201 `{ isNewUser: true }`.
2. **Explicit Registration (`POST /api/notifications/register`):**  
   Direct account creation. Account is created with `channelEnabled = false` by default until explicitly enabled or auto-logged in.

**What is stored:**

| Field | Type | Details |
|-------|------|---------|
| `email` | `String` | Normalized to lowercase, trimmed, unique, indexed |
| `passkeyHash` | `String` | bcrypt hash (10 rounds) of the user-chosen passkey |
| `channelEnabled` | `Boolean` | Default: `false` (or `true` if registered via `/continue` with `allowMessages: true`) |
| `lastAuthenticatedAt` | `Date` | Updated on every successful login/session establishment |
| `channelCreatedAt` | `Date` | Timestamp of most recent channel enable |
| `channelDisabledAt` | `Date` | Timestamp of most recent channel disable |
| `createdAt` | `Date` | Account creation timestamp |
| `updatedAt` | `Date` | Last modification timestamp |

**Registration constraints:**
- Email must contain `@` and pass standard RFC regex validation.
- Email is unique — duplicate registration on `/register` returns: `"This email is already registered."`
- Passkey must be **at least 4 characters** long.
- Rate limit: **10 registration attempts / 60 seconds / IP**.

### 2.2 Email Normalization

All emails pass through `normalizeEmail()` before lookup or persistence:
```
"  Alice@Gmail.COM  " → "alice@gmail.com"
```
`Alice@Gmail.com`, `alice@gmail.com`, and `  ALICE@GMAIL.COM  ` all resolve to the exact same account record.

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

- The raw passkey is **never stored anywhere** — not in logs, not in session records, not in memory.
- Verification uses `bcrypt.compare(candidatePasskey, storedHash)`.

---

## 3. Authentication & Session System

This feature uses its **own dedicated HTTP session system**, separate from the WebSocket signaling ephemeral chat sessions.

### 3.1 Combined Seamless Authentication ("Continue")

**Endpoint:** `POST /api/notifications/auth/continue`  
**Body:** `{ email, passkey, allowMessages = true }`

**Workflow:**
```
Client sends { email, passkey, allowMessages }
      │
      ▼
Normalize email & validate inputs (email format, passkey >= 4 chars)
      │
      ▼
Brute-force check: isAuthLockedOut(email)?
  YES → 429: "Too many failed authentication attempts. Please try again later."
  NO  → continue
      │
      ▼
findUserByEmail(email)
      │
      ├─────────────────────────────────────────┐
      │ [User Exists]                           │ [User Not Found]
      ▼                                         ▼
authenticateUser(email, passkey)          registerNotificationUser({ email, passkey })
  FAIL → 401 "Incorrect email or passkey"      │
  PASS → continue                               ▼
      │                                   allowMessages === true ?
      ▼                                     YES → setChannelStatus(email, null, true, true)
createNotificationSession(email)            NO  → channelEnabled = false
      │                                         │
      ▼                                         ▼
Set HttpOnly cookie & return 200:         createNotificationSession(email)
{ success: true, isNewUser: false,              │
  email, channelEnabled, token,                 ▼
  expiresInMs, message }                  Set HttpOnly cookie & return 201:
                                          { success: true, isNewUser: true,
                                            email, channelEnabled, token,
                                            expiresInMs, message }
```

### 3.2 Explicit Login Flow

**Endpoint:** `POST /api/notifications/auth/login`  
**Body:** `{ email, passkey }`

- Verifies credentials via `authenticateUser(email, passkey)`.
- Updates `lastAuthenticatedAt`.
- Creates session token (32 random bytes → 64 hex chars).
- Sets HttpOnly cookie: `notification_session=<token>; Max-Age=1800; SameSite=Lax; Path=/`.
- Returns `{ success: true, email, channelEnabled, token, expiresInMs }`.

### 3.3 Session Verification

**Endpoint:** `GET /api/notifications/auth/session`  
- Validates the token sent in `Authorization: Bearer <token>`, `X-Notification-Token`, or the `notification_session` cookie.
- If valid: refreshes `lastActivityAt` and returns `{ success: true, authenticated: true, email, channelEnabled }`.
- If invalid/expired: returns `{ success: false, authenticated: false }`.

### 3.4 Session Lifecycle

| Property | Value |
|----------|-------|
| **Idle timeout** | 30 minutes from last activity (`lastActivityAt`) |
| **Absolute max lifetime** | 12 hours from session creation (`createdAt`) |
| **Activity refresh** | Every authenticated API request refreshes `lastActivityAt` |
| **Cleanup interval** | Background timer sweeps expired sessions every 5 minutes |

### 3.5 Session Token Transport

Tokens are accepted in any of the following (inspected in order):
1. `Authorization: Bearer <token>` header
2. `X-Notification-Token: <token>` header
3. `notification_session=<token>` HttpOnly cookie

### 3.6 Brute-Force Lockout

- **5 consecutive failed attempts** for a given email → 15-minute lockout.
- Tracked in-memory; resets automatically on successful authentication.

### 3.7 Sign Out

**Endpoint:** `POST /api/notifications/auth/logout`  
- Invalides and deletes session token from in-memory session index.
- Clears the `notification_session` cookie (`Max-Age=0`).

---

## 4. Text Channel — Privacy Gate

Every registered user controls an inbound privacy gate ("Text Channel").

### 4.1 Channel States

| State | `channelEnabled` | Meaning |
|-------|------------------|---------|
| **Disabled / Paused** | `false` | Inbound messages blocked. Senders receive: `"This user is currently not accepting notifications."` |
| **Active / Receiving** | `true` | Inbound messages accepted from any registered and authenticated sender. |

### 4.2 Managing Channel Status

- **Initial Setup:** Configured via the `allowMessages` checkbox during Continue authentication on `MessagesAuthScreen`.
- **In-App Toggle:** Configured in `SettingsModal.jsx` using the "Receiving Messages" toggle:
  - Enabling: `POST /api/notifications/channel/create` (`channelEnabled = true`, `channelCreatedAt = now`).
  - Disabling: `POST /api/notifications/channel/disable` (`channelEnabled = false`, `channelDisabledAt = now`).
- **Inspection:** `POST /api/notifications/channel/status`.
- **Dashboard Alert:** If `channelEnabled === false`, `MessagesDashboard` renders an amber notice informing the user that incoming messages are currently paused.

> **Important:** Disabling or pausing the Text Channel does **not** delete any existing messages in the user's inbox.

### 4.3 Anti-Enumeration Protection

To prevent attackers from discovering registered email addresses:
- If the receiver **does not exist**: `"This user is currently not accepting notifications."` (HTTP 403)
- If the receiver **exists but channel is disabled**: identical `"This user is currently not accepting notifications."` (HTTP 403)

---

## 5. Who Can Send Messages — To Whom — When

### WHO CAN SEND
A user can send a message only if ALL of the following are met:
1. **Registered Notification Account** exists.
2. **Authenticated** via valid session token (Bearer header or cookie) or inline credentials (`senderEmail` + `passkey`).
3. Passkey verification succeeds (or pre-authenticated via session token).

### TO WHOM CAN THEY SEND
1. Recipient has a registered Notification Account.
2. Recipient's Text Channel is actively enabled (`channelEnabled === true`).

### SENDER / RECEIVER ERROR MATRIX

| Condition | Response |
|-----------|----------|
| Sender unauthenticated / invalid passkey | 401 `"Authentication failed. Please verify your email and passkey."` |
| Sender brute-force locked out | 429 `"Too many failed authentication attempts. Please try again later."` |
| Recipient not registered | 403 `"This user is currently not accepting notifications."` |
| Recipient channel disabled | 403 `"This user is currently not accepting notifications."` |
| Message content empty or > 5000 chars | 400 `"Message cannot be empty."` or 400 `"Message exceeds 5000 character limit."` |

### WHEN CAN THEY SEND
- Anytime, within rate limits (**30 sends / 60 seconds / IP**).

---

## 6. Message Sending — Full Constraints & Rules

### 6.1 Modal Composition Flow (`NewMessageModal.jsx`)

1. User clicks **+ New Message** on the `MessagesDashboard`.
2. Enters recipient email (`receiverEmail`).
3. Writes message content (`content`, maximum 5,000 characters; live counter displayed).
4. Optionally toggles **View once** (`viewOnce = true`).
5. Clicks **SEND MESSAGE** → issues `POST /api/notifications/send`.
6. On success:
   - Displays toast confirmation (`"Message delivered to recipient."` or `"View-Once message delivered! It will self-destruct when opened."`).
   - Resets form state and triggers inbox refresh callback.
   - Automatically closes modal after 1.2s.

```
POST /api/notifications/send
{ senderEmail, receiverEmail, content, viewOnce }
      │
      ▼
Rate limit check (30 sends/min/IP)
      │
      ▼
Validate email formats & content length (1 - 5000 chars)
      │
      ▼
Verify sender identity (session token or passkey)
      │
      ▼
Find receiver: exist AND channelEnabled === true?
  NO  → 403: "This user is currently not accepting notifications."
  YES → continue
      │
      ▼
NotificationMessage.create({
  senderEmail, receiverEmail, content: content.trim(),
  viewOnce, viewed: false, viewedAt: null, createdAt: now
})
      │
      ▼
Return 201: { success, data: { id, senderEmail, receiverEmail, viewOnce, createdAt } }
```

> **Note:** The message content is never echoed back in the send response for privacy.

---

## 7. Message Types: Normal vs View-Once

### 7.1 Normal Messages (`viewOnce = false`)

- **Inbox Display:** Previewed directly in the inbox card.
- **Expandable:** If content exceeds 120 characters, an expandable toggle ("Read more" / "Show less") allows inline reading.
- **Persistence:** Stored in database until the recipient manually deletes it.
- **Manual Deletion:** Recipient can click the Trash icon (`handleDeleteMessage`) to permanently purge the message document (`DELETE /api/notifications/messages/:id`).

### 7.2 View-Once Messages (`viewOnce = true`)

- **Inbox Display:** Content is strictly masked (`null`) from the list response.
- **Visual Pill:** Distinct amber styling with badge `🔐 View once` and explanation: `"Permanently deleted when opened."`
- **Action Button:** "Open" button triggers `ViewOnceModal`.
- **Atomic Deletion:** The server executes `findOneAndDelete` the instant it is requested, returning the plaintext payload once before deleting the document permanently.
- **No Trash Button:** Manual delete is hidden because opening executes automatic self-destruction.

### 7.3 Comparison

| Feature | Normal Message | View-Once Message |
|---------|----------------|-------------------|
| Inbox list payload | Full content | Masked (`null`) |
| UI appearance | Clean card with expandable text | Amber highlighted card with `🔐 View once` badge |
| Re-readable | Unlimited times | Exactly once |
| Server deletion | When recipient clicks Trash | Instantly upon opening |
| Read receipt (`viewedAt`) | Recorded | Not stored (document deleted) |

---

## 8. Who Can View Messages — And How

### 8.1 Authorization
**Only the recipient** can view their inbox or open individual messages. The server enforces `receiverEmail = normEmail` on all queries.

### 8.2 Fetching Inbox (`POST /api/notifications/messages`)

- Authenticated via session Bearer token or cookie.
- Returns all received messages sorted by `createdAt` descending (newest first).
- Normal messages include `content`.
- View-once messages include `content: null` and `viewOnce: true`.

### 8.3 Messages Dashboard Features

- **Relative Timestamping:** Formatted human-friendly timestamps (e.g. `Just now`, `5 min ago`, `2 hr ago`, `Yesterday`, `3d ago`).
- **Live Counter:** Header displays total message count with quick "Refresh" button.
- **Empty State:** Clean placeholder with a "+ Send a Message" button.

---

## 9. View-Once Message — Open & Destroy Flow

```
Recipient clicks "Open" in MessagesDashboard
      │
      ▼
ViewOnceModal opens in CONFIRM step
Displays warning:
  "This message will be permanently deleted when opened."
  "You cannot view it again once opened."
      │
      ▼
Recipient clicks "Open Once" (#confirm_open_view_once_button)
      │
      ▼
Modal switches to LOADING step ("Opening message...")
      │
      ▼
Client calls: POST /api/notifications/messages/:id { email }
      │
      ▼ [SERVER]
Verify recipient session / passkey
      │
      ▼
NotificationMessage.findOneAndDelete({
  _id: messageId,
  receiverEmail: normEmail,
  viewOnce: true
})
  If null → 404: "Message not found or already consumed."
  If found → return 200: { success: true, content, consumed: true }
      │
      ▼ [CLIENT]
Modal switches to VIEWING step:
  - Plaintext message content displayed in readable card
  - One-click "Copy" button
  - Confirmation badge: "✓ Deleted from server"
  - Modal notifies parent dashboard: onMessageConsumed(id)
  - Message is immediately removed from inbox state
```

### Race-Condition Protection
Because `findOneAndDelete` is an atomic MongoDB operation:
- If concurrent requests are sent for the same view-once message, only one will match and delete the document.
- All subsequent calls receive `null` and return HTTP 404.

---

## 10. Message Deletion — Manual Purge

Normal messages can be permanently deleted by the recipient at any time.

- **Endpoint:** `DELETE /api/notifications/messages/:id`
- **Body:** `{ email }`
- **Ownership Verification:** Server verifies `receiverEmail: normEmail`. Senders cannot delete messages once sent.
- **Feedback:** Dashboard immediately drops the deleted item from React state and displays `"Message deleted."` confirmation.

---

## 11. Account Wipe — Full Data Purge

Located in the **Danger Zone** of `SettingsModal.jsx`.

### 11.1 Deletion Scope
Executing account wipe runs a complete cascade deletion:
1. `NotificationUser` document is deleted from MongoDB (`deleteOne({ email })`).
2. All received messages are deleted (`deleteMany({ receiverEmail: email })`).
3. All sent messages sent by this user are deleted (`deleteMany({ senderEmail: email })`).
4. In-memory session registry is wiped for this email (`destroyAllUserSessions(email)`).
5. Session cookie is cleared (`Max-Age=0`).

### 11.2 Passkey Re-Verification Requirement
Even when authenticated via an active session, **the user must re-enter their passkey** into the confirmation form before account deletion executes.

### 11.3 UI Flow
1. Open `SettingsModal` via gear icon in dashboard.
2. Under "Danger Zone", click **Delete Account**.
3. Form expands requiring passkey entry.
4. User enters passkey and clicks **Permanently Delete**.
5. Server verifies passkey and executes full wipe.
6. Client resets session state and returns to `MessagesAuthScreen`.

---

## 12. API Endpoints Reference

All endpoints are mounted under `/api/notifications`.

### Authentication Routes

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| `POST` | `/auth/continue` | No (credentials in body) | 20/min/IP | Smart onboarding: login if user exists, auto-register if new |
| `POST` | `/auth/login` | No (credentials in body) | 20/min/IP | Explicit login; generates session token and cookie |
| `GET` | `/auth/session` | Optional (Bearer / Cookie) | None | Checks whether active session is valid |
| `POST` | `/auth/logout` | Optional (Bearer / Cookie) | None | Destroys active session token and clears cookie |

### Account & Identity Routes

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| `POST` | `/register` | No | 10/min/IP | Explicit registration endpoint |
| `DELETE` | `/account` | Session + Passkey | 20/min/IP | Full account, message, and session wipe |

### Channel (Privacy Gate) Routes

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| `POST` | `/channel/create` | Session OR Passkey | 20/min/IP | Enable incoming messages |
| `POST` | `/channel/disable` | Session OR Passkey | 20/min/IP | Pause incoming messages |
| `POST` | `/channel/status` | Session OR Passkey | 20/min/IP | Inspect channel status |

### Message Routes

| Method | Path | Auth Required | Rate Limit | Description |
|--------|------|---------------|------------|-------------|
| `POST` | `/send` | Session OR Passkey | **30/min/IP** | Send a private message (normal or view-once) |
| `POST` | `/messages` | Session OR Passkey | 20/min/IP | Fetch received inbox messages |
| `POST` | `/messages/:id` | Session OR Passkey | 20/min/IP | Open single message (consumes & destroys view-once) |
| `DELETE` | `/messages/:id` | Session OR Passkey | 20/min/IP | Manually delete a received normal message |

---

## 13. Database Schema — MongoDB Models

### 13.1 NotificationUser (`notificationusers`)

```js
{
  email:               String,   // required, unique, indexed, lowercase
  passkeyHash:         String,   // required, bcrypt hash (10 salt rounds)
  channelEnabled:      Boolean,  // default: false
  lastAuthenticatedAt: Date,     // updated on login/continue
  channelCreatedAt:    Date,     // timestamp when channel enabled
  channelDisabledAt:   Date,     // timestamp when channel disabled
  createdAt:           Date,     // document creation
  updatedAt:           Date      // last update
}
```

- **Unique Index:** `{ email: 1 }`

### 13.2 NotificationMessage (`notificationmessages`)

```js
{
  senderEmail:   String,   // required, indexed, lowercase
  receiverEmail: String,   // required, indexed, lowercase
  content:       String,   // required, maxlength: 5000
  viewOnce:      Boolean,  // default: false
  viewed:        Boolean,  // default: false
  viewedAt:      Date,     // set when normal message read
  readAt:        Date,     // reserved
  expiresAt:     Date,     // indexed, reserved for future TTL expiration
  createdAt:     Date      // indexed
}
```

- **Compound Index:** `{ receiverEmail: 1, createdAt: -1 }` (optimizes inbox query sorted by newest).
- **Index:** `{ senderEmail: 1 }`

---

## 14. In-Memory Fallback Store

When MongoDB is unavailable or disconnected, the service falls back automatically to RAM:

```js
const inMemoryUsers    = new Map(); // email     → user document object
const inMemoryMessages = new Map(); // messageId → message document object
```

- All registration, authentication, sending, view-once atomic destruction, and inbox retrieval operations remain functional in memory.
- Sessions are **always stored in-memory** (`notificationSessions` Map) by architecture design.

---

## 15. Rate Limiting

IP-based in-memory sliding window:

| Limiter | Maximum Requests | Window | Monitored Endpoints |
|---------|------------------|--------|---------------------|
| `authLimiter` | 20 | 60 seconds | `/auth/login`, `/auth/continue`, `/channel/*`, `/messages*`, `/account` |
| `sendLimiter` | 30 | 60 seconds | `/send` |
| `registerLimiter` | 10 | 60 seconds | `/register` |

---

## 16. Security Design

1. **Passkey Security:** bcrypt hashing with 10 salt rounds. Raw passkeys are never persisted or recorded in logs.
2. **Anti-Enumeration:** Identical HTTP 403 error for non-existent users and disabled channels.
3. **Session Tokens:** 32 cryptographically random bytes (256-bit entropy) generated via `crypto.randomBytes()`.
4. **Cookie Security:** `HttpOnly`, `SameSite=Lax`, and `Secure` (in production mode).
5. **Atomic View-Once Destruction:** Single `findOneAndDelete` call ensures zero window for concurrent extraction.
6. **Receiver Ownership:** All message queries and deletions strictly enforce receiver email ownership on the backend.
7. **Brute-Force Lockout:** 5 failed login attempts → 15-minute lockout per email.
8. **Size Constraints:** Message bodies capped at 5,000 characters; Express JSON body parser limited to 2MB.

---

## 17. UI Component Architecture & Map

```
src/App.jsx
  │  Handles route URLs (/messages, #messages, /notifications, #notifications)
  │  Renders NotificationsView (MessagesView)
  │
  └── NotificationsView.jsx (MessagesView)  [Session & Route Controller]
        │  Verifies session via GET /api/notifications/auth/session on mount
        │  Renders MessagesAuthScreen (if unauthenticated) or MessagesDashboard (if authenticated)
        │
        ├── MessagesAuthScreen.jsx         [Authentication View]
        │     - Modes: 'continue' (smart auto-detect), 'login', 'register'
        │     - Email input & Passkey input (with show/hide toggle)
        │     - "Allow incoming messages" toggle (default: true)
        │     - Calls POST /api/notifications/auth/continue
        │
        └── MessagesDashboard.jsx          [Authenticated Inbox Cockpit]
              - Top bar: "Plutus" back link, active email, Settings gear button
              - Primary Action: "+ New Message" card
              - Incoming messages paused warning banner (if channelEnabled === false)
              - Inbox list:
                  - Relative timestamps (e.g. "Just now", "5 min ago")
                  - Expandable regular messages ("Read more" / "Show less")
                  - View-once message pill: 🔐 View once (Permanently deleted when opened)
                  - Trash button (normal messages)
                  - "Open" button (view-once messages)
              - Refresh inbox button
              │
              ├── NewMessageModal.jsx      [Compose Message Modal]
              │     - Recipient email input
              │     - Content textarea with character counter (0 / 5000)
              │     - View Once toggle switch
              │     - Calls POST /api/notifications/send
              │
              ├── ViewOnceModal.jsx        [View Once Open & Destroy Modal]
              │     - Step 1 (CONFIRM): Warning dialog with "Open Once" button (#confirm_open_view_once_button)
              │     - Step 2 (LOADING): Progress spinner
              │     - Step 3 (VIEWING): Content display, Copy button, "✓ Deleted from server" badge
              │     - Step 4 (ERROR): Error handling view
              │     - Calls POST /api/notifications/messages/:id
              │
              └── SettingsModal.jsx        [Privacy & Account Settings Modal]
                    - Privacy: "Receiving Messages" toggle (POST /channel/create or /channel/disable)
                    - Account: Email display, Active Session indicator, "Sign Out" button (POST /auth/logout)
                    - Danger Zone: "Delete Account" button → inline passkey confirmation → DELETE /account
```

*(Note: Legacy individual card components `SendMessageCard.jsx`, `ViewMessagesCard.jsx`, `TextChannelCard.jsx`, and `AccountCard.jsx` remain in the codebase as modular references, while `MessagesDashboard` + `MessagesAuthScreen` serve as the active unified UI).*

---

## 18. Complete Data Flow Diagrams

### 18.1 Seamless Onboarding & Authentication ("Continue")

```
Browser (User)                 Server                      MongoDB
      │                          │                              │
      │── POST /auth/continue ──►│                              │
      │   { email, passkey,      │── findUserByEmail(email) ───►│
      │     allowMessages }      │◄── user doc (or null) ───────│
      │                          │                              │
      │                          │ [If user does not exist]     │
      │                          │── registerNotificationUser ─►│
      │                          │── setChannelStatus ─────────►│
      │                          │                              │
      │                          │ [If user exists]             │
      │                          │── authenticateUser(passkey)  │
      │                          │                              │
      │                          │── createNotificationSession  │
      │                          │   (stores in RAM index)      │
      │◄── Set-Cookie & JSON ────│                              │
      │    { token, isNewUser }  │                              │
```

### 18.2 Sending a Message via NewMessageModal

```
Browser (Sender)              Server                      MongoDB
      │                          │                              │
      │── POST /send ───────────►│                              │
      │   Bearer <token>         │── verifyNotificationSession  │
      │   { receiverEmail,       │── findUserByEmail(receiver) ─►│
      │     content, viewOnce }  │◄── receiver doc ─────────────│
      │                          │   channelEnabled? YES        │
      │                          │── NotificationMessage.create►│
      │                          │◄── saved doc ────────────────│
      │◄── 201 { success, data }─│                              │
```

### 18.3 Opening & Destroying a View-Once Message

```
Browser (Receiver)            Server                      MongoDB
      │                          │                              │
      │  [Click "Open"]          │                              │
      │  [Warning displayed]     │                              │
      │  [Click "Open Once"]     │                              │
      │── POST /messages/:id ───►│                              │
      │   Bearer <token>         │── verifyNotificationSession  │
      │                          │── findOneAndDelete({         │
      │                          │     _id, receiverEmail,      │
      │                          │     viewOnce: true           │
      │                          │   }) ───────────────────────►│
      │                          │◄── deletedDoc (atomic) ──────│
      │◄── 200 { content,        │                              │
      │         consumed: true } │                              │
      │  [Displays content]      │                              │
      │  [✓ Deleted from server] │                              │
      │  [Drops from UI state]   │                              │
```

---

## 19. All Constraints — Quick Reference

### Registration & Continue
- Email format validated with `@` and RFC format.
- Passkey minimum **4 characters**.
- `allowMessages` defaults to `true` on continue registration.
- Rate limit: **10 registrations / 60s / IP**.

### Authentication & Sessions
- Bearer header, custom header, or HttpOnly cookie.
- Idle timeout: **30 minutes**.
- Absolute session lifetime: **12 hours**.
- Brute-force lockout: **5 failures = 15-minute lockout per email**.
- Rate limit: **20 auth attempts / 60s / IP**.

### Text Channel (Privacy Gate)
- Controlled via `SettingsModal` toggle ("Receiving Messages").
- Disabling the channel pauses new incoming messages without deleting inbox messages.
- Anti-enumeration: Identical 403 error for non-existent users and disabled channels.

### Message Sending
- Sender must be authenticated.
- Recipient must exist and have channel enabled.
- Content: 1 to 5,000 characters.
- Rate limit: **30 sends / 60s / IP**.

### View-Once Messages
- Content masked (`null`) in inbox listing.
- Two-step open confirmation modal with "Open Once" trigger.
- Atomic delete on open via `findOneAndDelete` — race-condition safe.
- Displays "✓ Deleted from server" badge upon consumption.

### Message Deletion & Account Wipe
- Recipients can manually delete received normal messages.
- Full account wipe permanently deletes user record, all sent/received messages, and active sessions.
- Account wipe requires passkey re-entry even with an active session.

---

*File: NOTIFICATION_ARCHITECTURE.md — Updated in accordance with latest commits and changes*  
*Source references: NotificationUser.js, NotificationMessage.js, notificationService.js, notificationSessionService.js, notificationRoutes.js, NotificationsView.jsx, MessagesAuthScreen.jsx, MessagesDashboard.jsx, NewMessageModal.jsx, SettingsModal.jsx, ViewOnceModal.jsx, HomeView.jsx, App.jsx*
