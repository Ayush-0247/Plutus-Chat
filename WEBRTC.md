# 🌐 WebRTC Visual Architecture Guide
**Plutus Ephemeral Secure Communication Line — Visual Cheat-Sheet**

---

## ⚡ 1. The Core Concept in 10 Seconds

> 💡 **Analogy:** The **Signaling Server** is like a matchmaker who introduces two people. Once they exchange phone numbers, the matchmaker leaves the room—all communication is **100% direct (Peer-to-Peer)**.

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

| ❌ What the Server Sees | ✅ What Peers See (Direct P2P) |
| :--- | :--- |
| • Connection metadata (SDP) | • Live HD Video & Voice audio |
| • IP/Port candidates (ICE) | • File contents (Images, PDFs, Docs) |
| • **Zero bytes of media or files** | • Encrypted via DTLS-SRTP & SCTP |

---

## 🗺️ 2. Master System Flowchart

```mermaid
flowchart TD
    subgraph S1 ["1. CONNECT & DISCOVERY"]
        A1["User Enters Session"] --> A2["Join Socket.IO Room"]
        A2 --> A3["syncParticipants()"]
    end

    subgraph S2 ["2. BUILD DATA MESH (Files)"]
        A3 --> B1{"ID Check:\nmyId < peerId?"}
        B1 -- YES --> B2["Create Offer & DataChannel\n('plutus-files')"]
        B1 -- NO --> B3["Wait for Offer & ondatachannel"]
        B2 & B3 --> B4["Exchange SDP + ICE"]
        B4 --> B5["DataChannel READY (P2P)"]
    end

    subgraph S3 ["3. IN-SESSION ACTIONS"]
        B5 --> C1["📁 Share File (<= 25MB)"]
        C1 --> C2["Slice 16KB Chunks\nBackpressure Check\nSend via DataChannel"]
        C2 --> C3["Receiver Assembles in RAM\nCreate blob: URL"]

        B5 --> D1["📞 Start Video/Audio Call"]
        D1 --> D2["Owner: acquireMediaStream()\nSocket: 'start-call'"]
        D2 --> D3["Joiner Ring Modal\nAccept -> acquireMediaStream()"]
        D3 --> D4["Setup Call Mesh\nStream Direct SRTP Audio/Video"]
    end

    subgraph S4 ["4. EPHEMERAL PURGE"]
        C3 & D4 --> E1["Session End / Leave / Kick"]
        E1 --> E2["1. Stop Mic & Cam Tracks (LED OFF)\n2. Close All PeerConnections\n3. Revoke All blob: URLs (Wipe RAM)\n4. Zero State Buffers"]
    end

    style S1 fill:#1e293b,stroke:#475569,color:#fff
    style S2 fill:#064e3b,stroke:#059669,color:#fff
    style S3 fill:#0c4a6e,stroke:#0284c7,color:#fff
    style S4 fill:#881337,stroke:#e11d48,color:#fff
```

---

## 🏗️ 3. Architecture: The Dual-Mesh System

Plutus runs **two completely separate P2P meshes** so calls and files never interfere with each other:

```mermaid
graph TB
    subgraph Browser_A ["Peer A (Browser)"]
        UI_A["React UI (ActiveSessionView)"]
        Mesh_A["WebRTCMeshManager"]
        Data_A["🟢 Data Mesh\n('plutus-files' RTCDataChannel)"]
        Call_A["🔵 Call Mesh\n(RTCPeerConnection MediaStream)"]
    end

    subgraph Signaling ["Node.js Signaling (server.js)"]
        Sig["Socket.IO Relay\n(Only forwards SDP & ICE)"]
    end

    subgraph Browser_B ["Peer B (Browser)"]
        UI_B["React UI (ActiveSessionView)"]
        Mesh_B["WebRTCMeshManager"]
        Data_B["🟢 Data Mesh\n('plutus-files' RTCDataChannel)"]
        Call_B["🔵 Call Mesh\n(RTCPeerConnection MediaStream)"]
    end

    UI_A <--> Mesh_A
    Mesh_A --> Data_A
    Mesh_A --> Call_A

    UI_B <--> Mesh_B
    Mesh_B --> Data_B
    Mesh_B --> Call_B

    Mesh_A -. "Signaling Only (No Media)" .-> Sig
    Sig -. "Signaling Only (No Media)" .-> Mesh_B

    Data_A <══ "Direct P2P File Chunks (SCTP)" ══> Data_B
    Call_A <══ "Direct P2P Audio/Video (SRTP)" ══> Call_B

    style Data_A fill:#00a884,stroke:#fff,color:#fff
    style Data_B fill:#00a884,stroke:#fff,color:#fff
    style Call_A fill:#0284c7,stroke:#fff,color:#fff
    style Call_B fill:#0284c7,stroke:#fff,color:#fff
    style Sig fill:#202c33,stroke:#8696a0,color:#fff
```

| Mesh Domain | Protocol | Lifespan | Purpose |
| :--- | :--- | :--- | :--- |
| **🟢 Data Mesh** | SCTP over DTLS | Entire chat session | High-speed, instant file/image/PDF transfer |
| **🔵 Call Mesh** | SRTP (VP8 / Opus) | Only while call is active | Low-latency bi-directional video & voice |

---

## 🤝 4. Signaling Handshake (The 4-Step Connection Dance)

```mermaid
sequenceDiagram
    autonumber
    participant A as Peer A (Initiator)
    participant S as Server (Socket.IO)
    participant B as Peer B (Receiver)

    Note over A, B: STEP 1: Offer
    A->>A: Create Offer (SDP)
    A->>S: emit('webrtc-offer', offer)
    S->>B: emit('webrtc-offer', offer)

    Note over A, B: STEP 2: Answer
    B->>B: setRemoteDescription(offer) & Create Answer
    B->>S: emit('webrtc-answer', answer)
    S->>A: emit('webrtc-answer', answer)
    A->>A: setRemoteDescription(answer)

    Note over A, B: STEP 3: ICE Candidate Exchange (Finding Network Route)
    par Candidate Exchange
        A->>S: emit('webrtc-ice-candidate', candA)
        S->>B: emit('webrtc-ice-candidate', candA)
        B->>B: addIceCandidate(candA)
    and
        B->>S: emit('webrtc-ice-candidate', candB)
        S->>A: emit('webrtc-ice-candidate', candB)
        A->>A: addIceCandidate(candB)
    end

    Note over A, B: STEP 4: Direct P2P Connected!
    A<<-->>B: Direct P2P Encrypted Stream
```

---

## 🛑 5. Glare Prevention & Candidate Queue (Visual Logic)

### Who Initiates? The Deterministic Rule
Prevents "offer collision" (both calling each other at the exact same millisecond):

```mermaid
flowchart LR
    Start["Two Peers Meet"] --> Check{"Compare IDs\n(String comparison)"}
    Check -- "Alice (001) < Bob (002)" --> Alice["Alice is INITIATOR\nSends Offer"]
    Check -- "Bob (002) > Alice (001)" --> Bob["Bob is RECEIVER\nWaits for Offer"]
    
    style Alice fill:#064e3b,stroke:#059669,color:#fff
    style Bob fill:#0c4a6e,stroke:#0284c7,color:#fff
```

### ICE Candidate Buffering (Race Condition Prevention)
Candidates might arrive before the SDP answer is processed. Plutus buffers them:

```mermaid
flowchart TD
    CandIn["Candidate Arrives from Socket"] --> CheckReady{"Remote Description Set?"}
    CheckReady -- YES --> Apply["pc.addIceCandidate()\n(Connected immediately)"]
    CheckReady -- NO --> Queue["Push into pendingCandidates Queue ⏳"]
    Queue --> SetDesc["... Later: setRemoteDescription() Completes ..."]
    SetDesc --> Drain["Drain & Apply all queued candidates! ✅"]

    style Apply fill:#064e3b,stroke:#059669,color:#fff
    style Queue fill:#854d0e,stroke:#eab308,color:#fff
    style Drain fill:#0c4a6e,stroke:#0284c7,color:#fff
```

---

## 🎥 6. Audio / Video Calling Visual Guide

### Media Acquisition & Automatic Camera Fallback

```mermaid
flowchart TD
    Start["User starts or joins call"] --> TryHD["Try Video + Audio (720p HD)\nechoCancellation, noiseSuppression"]
    TryHD -- "Success" --> HDReady["Full HD Video Call 🎥 + 🎙️"]
    TryHD -- "Permission Denied / No Cam" --> Fallback["Automatic Fallback:\nRequest Audio-Only 🎙️"]
    Fallback -- "Success" --> AudioReady["Joined Audio-Only (Warning banner displayed) 🎙️"]
    Fallback -- "Failed" --> Denied["Microphone Required Error ❌"]

    style HDReady fill:#064e3b,stroke:#059669,color:#fff
    style AudioReady fill:#854d0e,stroke:#eab308,color:#fff
    style Denied fill:#881337,stroke:#e11d48,color:#fff
```

### Call Lifecycle & Roles

```mermaid
stateDiagram-v2
    [*] --> IDLE : In Chat Room
    
    IDLE --> INVITING : Owner starts Call
    IDLE --> RINGING : Joiner gets 'call-invite'
    
    RINGING --> ACTIVE : Joiner clicks 'Accept'
    RINGING --> IDLE : Joiner clicks 'Decline'
    INVITING --> ACTIVE : First peer joins
    
    state ACTIVE {
        [*] --> Streaming
        Streaming --> Muted : Click Mute (track.enabled = false)
        Muted --> Streaming : Click Unmute (track.enabled = true)
        Streaming --> CamOff : Click Cam Off (track.enabled = false)
        CamOff --> Streaming : Click Cam On (track.enabled = true)
    }

    ACTIVE --> IDLE : Joiner leaves ('leave-call')
    ACTIVE --> ENDED : Owner clicks 'End for Everyone'
    ENDED --> IDLE : Hardware Released (LED OFF)
```

### How Mute Works (Zero Renegotiation!)
```
Microphone Button Clicked
          │
          ▼
audioTrack.enabled = false
          │
          ├─► Browser sends silence RTP packets
          ├─► Zero connection renegotiation
          └─► Call stays 100% stable & glitch-free!
```

---

## 📦 7. P2P File Sharing (Chunking & Flow Control)

Files are transferred directly between browsers through a **16 KB streaming pipe with backpressure**:

```mermaid
flowchart TD
    SelectFile["User Selects File (<= 25MB)"] --> SendHeader["1. Send JSON Header:\n{ type: 'file-start', fileName, fileSize, category }"]
    
    SendHeader --> LoopSlice["2. Slice next 16 KB Chunk"]
    LoopSlice --> CheckBuffer{"DataChannel Buffer > 64 KB?\n(bufferedAmount > 64KB)"}
    
    CheckBuffer -- "YES (Pipe Full!)" --> Pause["PAUSE ⏸️\nWait for 'bufferedamountlow' event"]
    Pause --> SliceSend
    
    CheckBuffer -- "NO (Pipe Clear)" --> SliceSend["Send ArrayBuffer (16 KB) 🚀"]
    
    SliceSend --> CheckEOF{"All bytes sent?"}
    CheckEOF -- NO --> LoopSlice
    CheckEOF -- YES --> SendEnd["3. Send JSON Header:\n{ type: 'file-end', fileId }"]
    
    SendEnd --> Reconstruct["Receiver Assembles Chunks\nnew Blob(chunks) -> URL.createObjectURL()"]
    Reconstruct --> Display["File Ready for View & Download! 🎉"]

    style SendHeader fill:#0c4a6e,stroke:#0284c7,color:#fff
    style Pause fill:#854d0e,stroke:#eab308,color:#fff
    style SliceSend fill:#064e3b,stroke:#059669,color:#fff
    style Display fill:#064e3b,stroke:#059669,color:#fff
```

### Backpressure Analogy
```
[File on NVMe Disk] ──(Fast Pour)──► ┌───────────────┐
                                     │  64 KB Buffer │  ◄── Throttles sender if network is slow
                                     └───────┬───────┘
                                             │ (Safe 16 KB Drops)
                                             ▼
                                     [Receiver Browser]
```

---

## 🧹 8. The Ephemeral Purge (Visual Cleanup Cascade)

When the session ends, a 4-stage cascade wipes hardware and RAM:

```mermaid
flowchart TD
    Trigger["Session Destroyed / Leave / Kick"] --> S1["1. HARDWARE RELEASE"]
    S1 --> S1_Action["track.stop() on local audio & video\nCamera & Mic LEDs turn OFF immediately"]

    Trigger --> S2["2. NETWORK CLOSE"]
    S2 --> S2_Action["Close all RTCPeerConnections\nClose all RTCDataChannels\nRemove all Socket.IO listeners"]

    Trigger --> S3["3. RAM SANITATION"]
    S3 --> S3_Action["URL.revokeObjectURL() on all Blob URLs\nBrowser frees all binary file buffers from RAM"]

    Trigger --> S4["4. STATE ZEROING"]
    S4 --> S4_Action["Clear messages: []\nClear transfers: []\nRedirect to DestroyedScreen"]

    style S1 fill:#1e293b,stroke:#475569,color:#fff
    style S2 fill:#064e3b,stroke:#059669,color:#fff
    style S3 fill:#881337,stroke:#e11d48,color:#fff
    style S4 fill:#0c4a6e,stroke:#0284c7,color:#fff
```

---

## 🗂️ 9. Quick Visual Code Reference

```
src/
├── webrtc/
│   ├── config.js         ⚙️ STUN servers (Google), 25MB limit, 16KB chunks
│   ├── mediaManager.js   🎥 Camera/Mic capture, auto-fallback, track muting
│   ├── fileTransfer.js   📦 16KB chunking, backpressure loop, Blob reconstruction
│   └── meshManager.js    🕸️ Dual-mesh coordinator (Data Mesh + Call Mesh)
│
├── components/
│   ├── Call/
│   │   ├── CallWindow.jsx          🖥️ Video grid UI, timer, call controls
│   │   ├── VideoTile.jsx           👤 Individual video/avatar tile
│   │   └── CallInvitationModal.jsx 🔔 Incoming call prompt (Accept/Decline)
│   └── File/
│       ├── FileUploadButton.jsx    📎 Drag & drop file picker (25MB limit)
│       └── FileMessage.jsx         🖼️ In-chat image/PDF preview card
│
└── server.js             📡 Socket.IO signaling relay (SDP Offer/Answer & ICE)
```

---

## ⚡ 10. Summary Cheat Sheet

| Question | Visual Answer |
| :--- | :--- |
| **Where do files & videos go?** | **Directly between browsers** (P2P). Never saved to any server disk or database. |
| **How do peers find each other?** | Via **Socket.IO signaling** (`webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`). |
| **How does glare get prevented?** | **Lower ID initiates**, higher ID waits. Polite peer rolls back if collision occurs. |
| **How does mute work?** | `track.enabled = false` (silence/black frames sent, connection never breaks). |
| **How are large files sent?** | Sliced into **16 KB chunks** with a **64 KB backpressure pause** when buffer is full. |
| **How is memory cleaned?** | `revokeAllBlobUrls()` frees RAM; `track.stop()` turns off camera/mic hardware LEDs. |
