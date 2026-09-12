# 🌐 WebRTC Complete Architecture & Implementation Guide
**Plutus Secure Communication Line — WebRTC Subsystem**

---

## ⚡ 1. WebRTC in 60 Seconds (The Big Picture)

**WebRTC (Web Real-Time Communication)** allows web browsers to talk **directly to each other (Peer-to-Peer / P2P)** without passing audio, video, or files through a central server.

```
       ┌────────────────────────────────────────────────────────┐
       │             Socket.IO Signaling Server                 │
       │    (Only introduces peers; never touches media/files)  │
       └──────────────┬──────────────────────────┬──────────────┘
         Signaling:   │ Offers / Answers / ICE   │  Signaling:
         SDP & ICE    ▼                          ▼  SDP & ICE
                 ┌──────────┐              ┌──────────┐
                 │ Client A │◄────────────►│ Client B │
                 │ (Browser)│  Direct P2P  │ (Browser)│
                 └──────────┘  Encrypted   └──────────┘
                               Media & Files
```

### 🔒 Core Ephemeral Guarantee
* **Zero Server Storage:** No audio, video frames, or file data ever pass through or touch the Node.js backend.
* **Direct Encryption:** Media streams use DTLS-SRTP encryption, and data channels use SCTP over DTLS.
* **Instant In-Memory Cleanup:** When a call ends or a session is destroyed, all media tracks stop immediately and temporary object memory URLs (`blob:`) are completely revoked.

---

## 🚀 2. Key Features

| Feature | Description | Technical Implementation |
| :--- | :--- | :--- |
| **P2P Video Calling** | HD (720p @ 1280x720) bidirectional video calls between session members. | `RTCPeerConnection` + `MediaStream` + `navigator.mediaDevices.getUserMedia` |
| **P2P Audio Calling** | Crisp voice calls with noise suppression, echo cancellation, and auto-gain. | `audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }` |
| **Camera Fallback** | If a user lacks a camera or denies permission, automatically drops to audio-only. | Automatic fallback in `acquireMediaStream()` |
| **Live Call Controls** | Mute/unmute microphone, toggle camera on/off, call duration timer. | `track.enabled = false/true` (preserves connection without renegotiation) |
| **Call Management** | Owner can initiate or end calls for everyone; joiners can leave anytime. | Role-enforced Socket.IO signaling events |
| **P2P File Transfer** | Share images, PDFs, and files up to **25 MB** directly browser-to-browser. | `RTCDataChannel` (`plutus-files`, `{ ordered: true }`) |
| **Chunking & Flow Control** | Splits files into 16 KB chunks with 64 KB backpressure buffer control. | `bufferedAmount` & `bufferedamountlow` event loop |
| **Memory Purge** | Blob URLs created for files/previews are tracked and revoked upon cleanup. | `URL.revokeObjectURL()` via `FileReceiverManager` & `meshManager.destroy()` |

---

## 🏗️ 3. Architecture & The Dual-Mesh System

Plutus Chat runs **two distinct, parallel WebRTC meshes**:

```mermaid
graph TB
    subgraph "Session Participant A"
        A_UI["UI Layer (App.jsx / CallWindow / FileMessage)"]
        A_Mesh["WebRTCMeshManager"]
        A_Data["Data Mesh (RTCDataChannel)"]
        A_Call["Call Mesh (RTCPeerConnection Media)"]
    end

    subgraph "Signaling Relay (Server - server.js)"
        SigServer["Socket.IO Server\n(Relays: webrtc-offer, webrtc-answer, webrtc-ice-candidate)"]
    end

    subgraph "Session Participant B"
        B_Mesh["WebRTCMeshManager"]
        B_Data["Data Mesh (RTCDataChannel)"]
        B_Call["Call Mesh (RTCPeerConnection Media)"]
        B_UI["UI Layer (App.jsx / CallWindow / FileMessage)"]
    end

    A_UI --> A_Mesh
    B_UI --> B_Mesh

    A_Mesh --> A_Data
    A_Mesh --> A_Call
    B_Mesh --> B_Data
    B_Mesh --> B_Call

    A_Mesh -. Signaling via Socket .-> SigServer
    SigServer -. Signaling via Socket .-> B_Mesh

    A_Data <== "Direct P2P DataChannel (16KB Chunks)" ==> B_Data
    A_Call <== "Direct P2P MediaStream (Audio/Video)" ==> B_Call

    style A_Data fill:#00a884,stroke:#fff,color:#fff
    style B_Data fill:#00a884,stroke:#fff,color:#fff
    style A_Call fill:#0284c7,stroke:#fff,color:#fff
    style B_Call fill:#0284c7,stroke:#fff,color:#fff
    style SigServer fill:#202c33,stroke:#8696a0,color:#fff
```

### 1. Data Mesh (`plutus-files`)
* **Lifespan:** Starts as soon as two or more users are in the session; stays open while users are chatting.
* **Purpose:** High-speed, peer-to-peer file, image, and PDF transfer.
* **Structure:** A full peer-to-peer mesh between every participant pair.

### 2. Call Mesh (Audio & Video)
* **Lifespan:** Created on-demand when the owner initiates a call, torn down when the call ends.
* **Purpose:** Real-time bi-directional audio/video streaming.
* **Structure:** Multi-peer mesh where each participant creates an `RTCPeerConnection` to every other participant in the call.

---

## 🔄 4. How WebRTC Signaling Works (Step-by-Step)

WebRTC peers need to find each other and negotiate media codecs before they can connect directly. This introduction is called **Signaling**.

### 🧩 Glare Prevention & The Deterministic Initiator Rule
When two peers connect simultaneously, both might try sending an offer at the same time (called **WebRTC Glare / Collision**).

Plutus Chat solves this with a **Deterministic Initiator Pattern**:
> **Rule:** The participant with the **lexicographically smaller ID** (`participantId_A < participantId_B`) creates and sends the Offer. The participant with the larger ID waits and answers.

```mermaid
sequenceDiagram
    autonumber
    participant Alice as Alice (ID: 001 - Initiator)
    participant Server as Socket.IO Signaling Server
    participant Bob as Bob (ID: 002 - Receiver)

    Note over Alice, Bob: Step 1: Alice has smaller ID -> Initiates Connection
    Alice->>Alice: 1. Create RTCPeerConnection & DataChannel
    Alice->>Alice: 2. Create Offer (SDP) & setLocalDescription()
    Alice->>Server: 3. emit('webrtc-offer', { targetId: '002', offer })
    Server->>Bob: 4. Relay 'webrtc-offer' to Bob

    Note over Bob: Step 2: Bob receives Offer & creates Answer
    Bob->>Bob: 5. Create RTCPeerConnection & setRemoteDescription(offer)
    Bob->>Bob: 6. Create Answer (SDP) & setLocalDescription()
    Bob->>Server: 7. emit('webrtc-answer', { targetId: '001', answer })
    Server->>Alice: 8. Relay 'webrtc-answer' to Alice
    Alice->>Alice: 9. setRemoteDescription(answer)

    Note over Alice, Bob: Step 3: ICE Candidate Exchange (Finding Network Route)
    Alice->>Server: 10. emit('webrtc-ice-candidate', candidateA)
    Server->>Bob: 11. Relay candidateA -> Bob.addIceCandidate()
    Bob->>Server: 12. emit('webrtc-ice-candidate', candidateB)
    Server->>Alice: 13. Relay candidateB -> Alice.addIceCandidate()

    Note over Alice, Bob: Step 4: Direct P2P Tunnel Established!
    Alice<<-->>Bob: Direct P2P Encrypted DataChannel / MediaStream
```

---

## 📞 5. Audio / Video Calling Lifecycle

```mermaid
stateDiagram-v2
    [*] --> IDLE : Session Active

    IDLE --> INVITING : Owner clicks 'Start Video/Audio Call'
    INVITING --> ACTIVE : Joiners accept call invitation
    IDLE --> JOINING : Joiner receives 'call-invite' & clicks Accept
    JOINING --> ACTIVE : Local media acquired & P2P connected

    state ACTIVE {
        [*] --> InCall
        InCall --> AudioMuted : Toggle Mic (track.enabled = false)
        AudioMuted --> InCall : Toggle Mic (track.enabled = true)
        InCall --> VideoMuted : Toggle Camera (track.enabled = false)
        VideoMuted --> InCall : Toggle Camera (track.enabled = true)
    }

    ACTIVE --> IDLE : Joiner clicks 'Leave Call' (only joiner leaves)
    ACTIVE --> ENDED : Owner clicks 'End Call for Everyone'
    ENDED --> IDLE : Media tracks stopped & mesh cleaned up
```

### Call Lifecycle Details

1. **Initiation (`App.jsx -> handleStartCall`):**
   * Owner clicks Video or Audio Call.
   * Calls `acquireMediaStream({ video, audio })` to access camera/mic.
   * Emits `start-call` over Socket.IO.
   * Server validates owner status and broadcasts `call-invite` to all participants.

2. **Invitation Modal (`CallInvitationModal.jsx`):**
   * Ringtone audio plays (`playCallIncomingSound()`).
   * Joiner can click **Accept** or **Decline**.
   * If declined, owner receives a notice (`call-user-declined`).

3. **Media Connection (`meshManager.js -> setupCallConnections`):**
   * Local audio/video tracks are attached (`pc.addTrack(track, stream)`).
   * WebRTC Offer/Answer handshake runs across all call participants.
   * Remote tracks arrive via `pc.ontrack` and render in `<VideoTile />` components.

4. **In-Call Track Controls (`mediaManager.js`):**
   * **Mute Mic:** `setAudioEnabled(stream, false)` sets `track.enabled = false`.
   * **Toggle Cam:** `setVideoEnabled(stream, false)` sets `track.enabled = false`.
   * *Why this is fast:* It disables transmission without breaking or renegotiating the `RTCPeerConnection`.

5. **Teardown & Cleanup (`meshManager.js -> cleanupCall`):**
   * Calls `track.stop()` on all local audio and video tracks (releasing the browser hardware lock/LED immediately).
   * Closes all call `RTCPeerConnection` instances and clears remote streams.

---

## 📁 6. P2P File Transfer Protocol & Flow Control

Files are shared directly browser-to-browser over WebRTC DataChannels using a custom binary chunking protocol.

```mermaid
sequenceDiagram
    autonumber
    participant Sender as Sender Browser
    participant Channel as RTCDataChannel ('plutus-files')
    participant Receiver as Receiver Browser

    Note over Sender: Step 1: Send Header Metadata
    Sender->>Channel: JSON { type: 'file-start', fileId, fileName, fileSize, fileType }
    Channel->>Receiver: handleMessage() -> Initializes FileReceiverManager

    Note over Sender, Receiver: Step 2: Stream 16 KB Binary Chunks
    loop For each 16 KB slice
        Sender->>Sender: Check dataChannel.bufferedAmount
        alt bufferedAmount > 64 KB (Backpressure)
            Sender->>Sender: Pause & await 'bufferedamountlow' event
        end
        Sender->>Channel: ArrayBuffer (16 KB binary slice)
        Channel->>Receiver: Push chunk to transfer.chunks[]
        Receiver->>Receiver: Update live progress %
    end

    Note over Sender, Receiver: Step 3: Complete & Reconstruct
    Sender->>Channel: JSON { type: 'file-end', fileId }
    Receiver->>Receiver: new Blob(transfer.chunks, { type: fileType })
    Receiver->>Receiver: registerBlobUrl(URL.createObjectURL(blob))
    Receiver->>Receiver: Display preview / download in chat
```

### ⚙️ File Transfer Specifications

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| **Max File Size** | `25 MB` (`25 * 1024 * 1024` bytes) | Keeps browser memory usage safe while allowing high-res photos and documents. |
| **Chunk Size** | `16 KB` (`16384` bytes) | Optimal MTU size for SCTP data channels, preventing packet fragmentation. |
| **Backpressure Threshold** | `64 KB` (`65536` bytes) | Prevents browser memory overflow if the receiver's network is slower than the sender's disk read. |
| **Channel Mode** | `{ ordered: true }` | Guarantees chunks arrive in exact order so files reconstruct without corruption. |

---

## 🗂️ 7. Codebase File Map & Responsibilities

```
src/webrtc/
├── config.js          # STUN server list, file limits (25MB), chunk size (16KB), call states
├── mediaManager.js    # Camera/Mic acquisition, auto-fallback, track muting, track stop
├── fileTransfer.js    # 16KB chunking protocol, backpressure handling, Blob URL registry
└── meshManager.js     # Dual-mesh orchestrator (DataChannel Mesh & Call Media Mesh)

src/components/
├── Call/
│   ├── CallWindow.jsx          # Collapsible call container, grid layout, call timer, controls
│   ├── VideoTile.jsx           # Individual video/audio tile with avatar & status badges
│   └── CallInvitationModal.jsx # Incoming call ring modal (Accept / Decline)
└── File/
    ├── FileUploadButton.jsx    # File picker with 25MB validation and progress wheel
    └── FileMessage.jsx         # Chat message tile for images, PDFs, files with preview & download

server.js              # Socket.IO signaling relays (webrtc-offer, webrtc-answer, webrtc-ice-candidate)
```

---

## 💡 8. Summary & Quick Reference

1. **Signaling Server:** The server (`server.js`) only matches peers via Socket.IO events (`webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`).
2. **Deterministic Role:** Peer with smaller ID initiates offers to prevent connection collisions.
3. **Audio/Video:** Streams directly peer-to-peer with hardware controls and silent audio fallback.
4. **File Sharing:** Files are split into 16 KB chunks over `RTCDataChannel` with backpressure control and zero server footprint.
5. **Ephemerality:** When the session closes, all hardware tracks stop and in-memory Blob URLs are immediately revoked.
