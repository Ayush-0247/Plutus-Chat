# 🌐 Comprehensive WebRTC Master Guide: Architecture, Protocols & Flows
**Project: Plutus Ephemeral Secure Communication Line**

---

## 📑 Table of Contents
1. [The 10-Second Mental Model & Architecture Comparison](#1-the-10-second-mental-model--architecture-comparison)
2. [Dual-Mesh Architecture (Data Mesh vs. Call Mesh)](#2-dual-mesh-architecture-data-mesh-vs-call-mesh)
3. [Internal Data Structures & Memory State](#3-internal-data-structures--memory-state)
4. [Master End-to-End System Flowchart](#4-master-end-to-end-system-flowchart)
5. [Network & NAT Traversal (STUN, ICE, and Candidate Gathering)](#5-network--nat-traversal-stun-ice-and-candidate-gathering)
6. [Signaling Engine & SDP Negotiation Sequence](#6-signaling-engine--sdp-negotiation-sequence)
7. [Deterministic Initiator & Perfect Negotiation (Glare Prevention)](#7-deterministic-initiator--perfect-negotiation-glare-prevention)
8. [Audio & Video Calling Subsystem](#8-audio--video-calling-subsystem)
   - [Media Engine & DSP Pipeline](#media-engine--dsp-pipeline)
   - [Automatic Audio-Only Fallback Flowchart](#automatic-audio-only-fallback-flowchart)
   - [Complete Call Lifecycle Sequence Flowchart](#complete-call-lifecycle-sequence-flowchart)
   - [In-Call Track Muting vs. SDP Renegotiation](#in-call-track-muting-vs-sdp-renegotiation)
   - [Call State Machine & Multi-Party Mesh Coordination](#call-state-machine--multi-party-mesh-coordination)
9. [P2P File Transfer Protocol & Streaming Engine](#9-p2p-file-transfer-protocol--streaming-engine)
   - [SCTP DataChannel Framing & Packet Structure](#sctp-datachannel-framing--packet-structure)
   - [16 KB Chunking & Flow Control (Backpressure)](#16-kb-chunking--flow-control-backpressure)
   - [Receiver Assembly & Blob Reconstruction](#receiver-assembly--blob-reconstruction)
10. [React State Coordination & Stale-Closure Prevention](#10-react-state-coordination--stale-closure-prevention)
11. [Connection State Lifecycle & Failure Recovery](#11-connection-state-lifecycle--failure-recovery)
12. [Ephemeral Security & Zero-Persistence Memory Purge](#12-ephemeral-security--zero-persistence-memory-purge)
13. [Complete Signaling Event & Wire Payload Reference](#13-complete-signaling-event--wire-payload-reference)
14. [Codebase File Tour & Architectural Roles](#14-codebase-file-tour--architectural-roles)

---

## 1. The 10-Second Mental Model & Architecture Comparison

> 💡 **Analogy:** The **Signaling Server** is like a matchmaker who introduces two people. Once they exchange phone numbers, the matchmaker leaves the room—all communication is **100% direct (Peer-to-Peer)**.

```
Traditional Architecture (Server-Centric / SFU / Cloud Storage):
[Browser A] ──(Video / Audio / Files)──► [Cloud Server / S3 Bucket] ──► [Browser B]
                                              ⚠️ Server Man-in-the-Middle Risk
                                              ⚠️ Disk Logging / Cloud Retention

Plutus WebRTC Architecture (Pure P2P Mesh):
                      [Signaling Server (Socket.IO)]
                      /     (Metadata only)        \
            SDP / ICE                                SDP / ICE
                    /                                  \
             [Browser A] ◄════════════════════════════► [Browser B]
                             Direct Encrypted P2P
                           (MediaStreams & DataChannels)
                             🔒 Zero Server Media
                             🔒 Zero Disk Storage
```

### Visual Comparison

```
┌─────────────────────────┬───────────────────────────────┬───────────────────────────────┐
│ Feature                 │ Traditional Server / SFU      │ Plutus WebRTC Mesh            │
├─────────────────────────┼───────────────────────────────┼───────────────────────────────┤
│ Media / Video Traffic   │ Decrypted/relayed on server   │ Direct Browser-to-Browser     │
│ File Upload Storage     │ Stored on S3 / Server Disk    │ Zero Server Disk / In-Memory  │
│ Encryption              │ TLS to server (Hop-by-hop)    │ End-to-End DTLS-SRTP / SCTP   │
│ Persistence             │ Permanent logs / cloud files  │ 100% Ephemeral / Wiped on End │
│ Server Bandwidth        │ O(N) Media Bandwidth (High)   │ O(1) JSON Signaling (Minimal) │
└─────────────────────────┴───────────────────────────────┴───────────────────────────────┘
```

---

## 2. Dual-Mesh Architecture (Data Mesh vs. Call Mesh)

Plutus runs **two independent, parallel WebRTC meshes**. Audio/Video streams and file sharing use distinct connections to guarantee resource isolation and independent lifecycles:

```mermaid
graph TB
    subgraph Browser_A ["Peer A (Browser Instance)"]
        UI_A["React UI Layer (App.jsx / ActiveSessionView)"]
        Mesh_A["WebRTCMeshManager (meshManager.js)"]
        
        subgraph Subsystem_A ["Independent Transport Meshes"]
            Data_A["🟢 Data Mesh\n('plutus-files' RTCDataChannel)\n- Ordered SCTP\n- Persistent for whole chat"]
            Call_A["🔵 Call Mesh\n(RTCPeerConnection MediaStream)\n- SRTP Audio/Video\n- On-demand lifecycle"]
        end
    end

    subgraph Signaling ["Node.js Signaling (server.js)"]
        Sig["Socket.IO Relay\n(Forwards: webrtc-offer, webrtc-answer, webrtc-ice-candidate)"]
    end

    subgraph Browser_B ["Peer B (Browser Instance)"]
        UI_B["React UI Layer (App.jsx / ActiveSessionView)"]
        Mesh_B["WebRTCMeshManager (meshManager.js)"]
        
        subgraph Subsystem_B ["Independent Transport Meshes"]
            Data_B["🟢 Data Mesh\n('plutus-files' RTCDataChannel)\n- Ordered SCTP\n- Persistent for whole chat"]
            Call_B["🔵 Call Mesh\n(RTCPeerConnection MediaStream)\n- SRTP Audio/Video\n- On-demand lifecycle"]
        end
    end

    UI_A <--> Mesh_A
    Mesh_A --> Data_A
    Mesh_A --> Call_A

    UI_B <--> Mesh_B
    Mesh_B --> Data_B
    Mesh_B --> Call_B

    Mesh_A -. "Signaling Only (No Media)" .-> Sig
    Sig -. "Signaling Only (No Media)" .-> Mesh_B

    Data_A <══ "Direct P2P File Chunks (16KB Chunks over SCTP)" ══> Data_B
    Call_A <══ "Direct P2P Audio/Video (VP8 / Opus over SRTP)" ══> Call_B

    style Data_A fill:#00a884,stroke:#fff,color:#fff
    style Data_B fill:#00a884,stroke:#fff,color:#fff
    style Call_A fill:#0284c7,stroke:#fff,color:#fff
    style Call_B fill:#0284c7,stroke:#fff,color:#fff
    style Sig fill:#202c33,stroke:#8696a0,color:#fff
```

### Why Decouple the Meshes?
1. **Independent Lifecycles:** Files can be transferred throughout the chat session. If a video call starts and ends, closing the call's peer connections does **not** terminate or disrupt ongoing file transfers.
2. **Resource Isolation:** High CPU video decoding/encoding never starves the DataChannel thread of network buffer execution.
3. **Hardware Permission Independence:** If a user denies camera/mic access, their file sharing capability remains 100% operational.

---

## 3. Internal Data Structures & Memory State

Inside `WebRTCMeshManager` (`src/webrtc/meshManager.js`), the state of all connections is tracked in dedicated JavaScript `Map` instances:

```
WebRTCMeshManager Instance
├── Data Mesh State:
│   ├── dataPeerConnections:    Map<peerId, RTCPeerConnection>
│   ├── dataChannels:           Map<peerId, RTCDataChannel>
│   ├── fileReceivers:          Map<peerId, FileReceiverManager>
│   └── pendingDataCandidates:  Map<peerId, Array<RTCIceCandidate>>
│
├── Call Mesh State:
│   ├── callPeerConnections:    Map<peerId, RTCPeerConnection>
│   ├── localCallStream:        MediaStream (Camera + Mic tracks)
│   ├── currentCallId:          String (UUID of active call)
│   └── pendingCallCandidates:  Map<peerId, Array<RTCIceCandidate>>
│
└── Signaling / Session Context:
    ├── sessionId:              String
    ├── participantId:          String
    ├── username:               String
    ├── isOwner:                Boolean
    └── socket:                 Socket.IO Client Instance
```

```mermaid
classDiagram
    class WebRTCMeshManager {
        +sessionId: String
        +participantId: String
        +username: String
        +isOwner: Boolean
        +socket: Socket
        +dataPeerConnections: Map~peerId, RTCPeerConnection~
        +dataChannels: Map~peerId, RTCDataChannel~
        +fileReceivers: Map~peerId, FileReceiverManager~
        +callPeerConnections: Map~peerId, RTCPeerConnection~
        +localCallStream: MediaStream
        +currentCallId: String
        +pendingDataCandidates: Map~peerId, Candidate[]~
        +pendingCallCandidates: Map~peerId, Candidate[]~
        +syncParticipants(participantsList)
        +broadcastFile(file, options)
        +setupCallConnections(callId, stream, participants)
        +cleanupCall()
        +destroy()
    }

    class FileReceiverManager {
        +transfers: Map~fileId, TransferBuffer~
        +onProgress: Function
        +onComplete: Function
        +onCancel: Function
        +handleMessage(event)
        +cancelTransfer(fileId)
        +clear()
    }

    class RTCPeerConnection {
        +signalingState: String
        +connectionState: String
        +iceConnectionState: String
        +createOffer()
        +createAnswer()
        +setLocalDescription()
        +setRemoteDescription()
        +addIceCandidate()
        +addTrack()
        +createDataChannel()
    }

    WebRTCMeshManager *-- FileReceiverManager
    WebRTCMeshManager *-- RTCPeerConnection
```

---

## 4. Master End-to-End System Flowchart

```mermaid
flowchart TD
    subgraph S1 ["1. CONNECT & DISCOVERY"]
        A1["User Enters Session"] --> A2["Join Socket.IO Room"]
        A2 --> A3["syncParticipants() Called"]
    end

    subgraph S2 ["2. BUILD DATA MESH (Files)"]
        A3 --> B1{"ID Check:\nmyId < peerId?"}
        B1 -- YES --> B2["Create Offer & DataChannel\n('plutus-files', { ordered: true })"]
        B1 -- NO --> B3["Wait for Offer & ondatachannel"]
        B2 & B3 --> B4["Exchange SDP + ICE"]
        B4 --> B5["DataChannel READY (P2P)"]
    end

    subgraph S3 ["3. IN-SESSION ACTIONS"]
        B5 --> C1["📁 Share File (<= 25MB)"]
        C1 --> C2["Slice 16KB Chunks\nBackpressure Check (bufferedAmount > 64KB)\nSend via DataChannel"]
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

## 5. Network & NAT Traversal (STUN, ICE, and Candidate Gathering)

### What is NAT & Why STUN is Required
Devices on home Wi-Fi or cellular data reside behind private NATs (`192.168.x.x`). A STUN (Session Traversal Utilities for NAT) server acts as a public mirror to inform each peer of its public WAN IP and reflexive UDP port.

```mermaid
flowchart LR
    subgraph Local_LAN ["Peer A (Private Subnet)"]
        ClientA["Browser\n192.168.1.15:45201"]
        NAT_A["Router / NAT Gateway"]
    end

    subgraph Public_Internet ["Public Internet"]
        STUN["Google STUN Cluster\nstun.l.google.com:19302\nstun1.l.google.com:19302"]
        SigServer["Plutus Signaling Server\n(server.js)"]
    end

    subgraph Remote_LAN ["Peer B (Private Subnet)"]
        NAT_B["Router / NAT Gateway"]
        ClientB["Browser\n10.0.0.42:51200"]
    end

    ClientA -->|"1. UDP Binding Request"| NAT_A
    NAT_A -->|"2. Outgoing Packet (Public: 203.0.113.88:58421)"| STUN
    STUN -->|"3. Binding Response: 'Your IP is 203.0.113.88:58421'"| NAT_A
    NAT_A -->|"4. Deliver Reflected Address"| ClientA
    ClientA -->|"5. Send ICE Candidate via Socket"| SigServer
    SigServer -->|"6. Relay Candidate"| ClientB
    ClientA <══|"7. Direct P2P Media / Data Link Established"|══> ClientB

    style Local_LAN fill:#1e293b,stroke:#475569,color:#fff
    style Public_Internet fill:#0f172a,stroke:#334155,color:#fff
    style Remote_LAN fill:#1e293b,stroke:#475569,color:#fff
    style STUN fill:#0284c7,stroke:#fff,color:#fff
```

### STUN Configuration in `src/webrtc/config.js`
```javascript
export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};
```
* **`iceCandidatePoolSize: 10`:** Instructs the browser to pre-gather candidate pairs before connection initiation, cutting connection establishment latency to near zero.

---

## 6. Signaling Engine & SDP Negotiation Sequence

WebRTC uses **Session Description Protocol (SDP)** to negotiate media codecs (Opus, VP8), network ports, and cryptographic fingerprints (DTLS certificates).

```mermaid
sequenceDiagram
    autonumber
    participant A as Peer A (Initiator)
    participant S as Server (Socket.IO)
    participant B as Peer B (Receiver)

    Note over A, B: STEP 1: Offer Creation & Local Description
    A->>A: 1. pc.createOffer() -> Returns SDP Offer
    A->>A: 2. pc.setLocalDescription(offer)
    A->>S: 3. emit('webrtc-offer', { targetId: 'B', offer, scope: 'call'|'data' })
    
    Note over S: Server validates membership & relays
    S->>B: 4. emit('webrtc-offer', { senderId: 'A', offer, scope })

    Note over A, B: STEP 2: Answer Creation & Remote Description
    B->>B: 5. pc.setRemoteDescription(new RTCSessionDescription(offer))
    B->>B: 6. Drain any buffered ICE candidates from Peer A
    B->>B: 7. pc.createAnswer() -> Returns SDP Answer
    B->>B: 8. pc.setLocalDescription(answer)
    B->>S: 9. emit('webrtc-answer', { targetId: 'A', answer, scope })
    S->>A: 10. emit('webrtc-answer', { senderId: 'B', answer, scope })
    A->>A: 11. pc.setRemoteDescription(new RTCSessionDescription(answer))
    A->>A: 12. Drain any buffered ICE candidates from Peer B

    Note over A, B: STEP 3: ICE Candidate Exchange (Parallel)
    par Candidate Exchange
        A->>S: 13. emit('webrtc-ice-candidate', { targetId: 'B', candidate: candA })
        S->>B: 14. emit('webrtc-ice-candidate', candA)
        B->>B: 15. pc.addIceCandidate(candA)
    and
        B->>S: 16. emit('webrtc-ice-candidate', { targetId: 'A', candidate: candB })
        S->>A: 17. emit('webrtc-ice-candidate', candB)
        A->>A: 18. pc.addIceCandidate(candB)
    end

    Note over A, B: STEP 4: Direct P2P Connected!
    A<<-->>B: Direct P2P Encrypted DataChannel / MediaStream
```

### Candidate Buffering (Race Condition Prevention)
If an ICE candidate arrives before `setRemoteDescription()` is executed, calling `pc.addIceCandidate()` directly causes an unhandled exception. Plutus buffers candidates in a queue:

```mermaid
flowchart TD
    CandIn["handleDataIceCandidate(senderId, candidate) Triggered"] --> CheckDesc{"pc.remoteDescription &&\npc.remoteDescription.type?"}
    
    CheckDesc -- "YES (Safe to Add)" --> AddNow["await pc.addIceCandidate(candidate)\nSuccess!"]
    
    CheckDesc -- "NO (Race Condition Window)" --> PushQueue["pendingDataCandidates.get(senderId).push(candidate)\nBuffer for later ⏳"]
    
    PushQueue --> DescArrives["... Later: pc.setRemoteDescription(offer/answer) Completes ..."]
    DescArrives --> Drain["Drain Loop:\nfor cand of pendingDataCandidates.get(senderId):\n  await pc.addIceCandidate(cand)\npendingDataCandidates.delete(senderId)"]
    Drain --> Clean["All candidates applied cleanly ✅"]

    style AddNow fill:#064e3b,stroke:#059669,color:#fff
    style PushQueue fill:#854d0e,stroke:#eab308,color:#fff
    style Drain fill:#0c4a6e,stroke:#0284c7,color:#fff
```

---

## 7. Deterministic Initiator & Perfect Negotiation (Glare Prevention)

### The Glare Problem
When two browsers discover each other simultaneously, both may fire `createOffer()` and transmit an SDP Offer. Both peer connections enter `have-local-offer`, resulting in an unrecoverable **Signaling Collision (Glare)**.

### The Solution: Deterministic Initiator Rule
Plutus Chat mathematically eliminates glare using lexicographical string comparison on unique participant IDs:

$$\text{Initiator} = (\text{myParticipantId} < \text{peerId})$$

```mermaid
flowchart LR
    Start["Two Peers Connect"] --> Check{"Compare IDs:\nmyParticipantId < peerId"}
    Check -- "True (Alice '001' < Bob '002')" --> Alice["Alice = INITIATOR\n- Creates RTCDataChannel\n- Creates & sends SDP Offer"]
    Check -- "False (Bob '002' > Alice '001')" --> Bob["Bob = RECEIVER\n- Listens for ondatachannel\n- Awaits SDP Offer passively"]
    
    style Alice fill:#064e3b,stroke:#059669,color:#fff
    style Bob fill:#0c4a6e,stroke:#0284c7,color:#fff
```

### The Polite Peer Pattern (W3C Standard)
For dynamic call connections where collisions could still theoretically happen, `meshManager.js` implements the **Polite Peer Pattern**:

```mermaid
flowchart TD
    OfferIn["Incoming Offer Arrives from senderId"] --> CheckStable{"pc.signalingState !== 'stable'?"}
    
    CheckStable -- "No (State is Stable)" --> Normal["Set Remote Description & Send Answer"]
    
    CheckStable -- "Yes (Collision Detected!)" --> CheckPolite{"Am I Polite?\n(myParticipantId > senderId)"}
    
    CheckPolite -- "NO (Impolite Peer)" --> Ignore["Impolite Peer Ignores Remote Offer:\nRetains local offer in flight\nRemote peer will yield"]
    
    CheckPolite -- "YES (Polite Peer)" --> Rollback["Polite Peer Yields:\nawait pc.setLocalDescription({ type: 'rollback' })"]
    Rollback --> AcceptRemote["Set Remote Description to Incoming Offer\nGenerate & Send Answer"]

    style Normal fill:#064e3b,stroke:#059669,color:#fff
    style Ignore fill:#854d0e,stroke:#eab308,color:#fff
    style Rollback fill:#881337,stroke:#e11d48,color:#fff
    style AcceptRemote fill:#064e3b,stroke:#059669,color:#fff
```

---

## 8. Audio & Video Calling Subsystem

### Media Engine & DSP Pipeline
Voice calls are acquired with hardware and browser Digital Signal Processing (DSP) enabled:
* `echoCancellation: true`: Cancels audio loops from speakers back into the microphone.
* `noiseSuppression: true`: Suppresses background hum, fan noise, and clicks.
* `autoGainControl: true`: Dynamically evens out microphone input levels.

### Automatic Audio-Only Fallback Flowchart

```mermaid
flowchart TD
    Start["acquireMediaStream({ video, audio })"] --> CheckSupport{"navigator.mediaDevices &&\ngetUserMedia available?"}
    
    CheckSupport -- No --> ErrNotSupported["Throw Error: Browser does not support WebRTC"]
    CheckSupport -- Yes --> CheckType{"video == true?"}
    
    CheckType -- "Video Call" --> TryVideo["Try getUserMedia({\n  video: { width: 1280, height: 720, facingMode: 'user' },\n  audio: { echoCancellation, noiseSuppression, autoGainControl }\n})"]
    
    TryVideo -- "Success" --> FullHD["Return stream\nisAudioOnlyFallback: false\nhasVideo: true\nhasAudio: true"]
    
    TryVideo -- "Permission Denied / No Cam" --> TryAudioFallback["Fallback Attempt:\nTry getUserMedia({\n  video: false,\n  audio: { echoCancellation, noiseSuppression, autoGainControl }\n})"]
    
    TryAudioFallback -- "Success" --> AudioFallback["Return stream\nisAudioOnlyFallback: true\nhasVideo: false\nwarning: 'Camera denied. Joined audio only.'"]
    
    TryAudioFallback -- "Failed" --> ErrMic["Throw Error: Microphone access is required"]
    
    CheckType -- "Audio Call" --> TryAudio["Try getUserMedia({ video: false, audio: true })"]
    TryAudio -- "Success" --> AudioOnly["Return stream (Audio Only)"]
    TryAudio -- "Failed" --> ErrMic

    style FullHD fill:#064e3b,stroke:#059669,color:#fff
    style AudioFallback fill:#854d0e,stroke:#eab308,color:#fff
    style AudioOnly fill:#0c4a6e,stroke:#0284c7,color:#fff
    style ErrMic fill:#881337,stroke:#e11d48,color:#fff
```

---

### Complete Call Lifecycle Sequence Flowchart

```mermaid
sequenceDiagram
    autonumber
    participant Owner as Session Owner
    participant Server as Socket.IO Server
    participant Joiner as Session Joiner

    Note over Owner: Step 1: Owner Starts Call
    Owner->>Owner: acquireMediaStream({ video, audio })
    Owner->>Server: emit('start-call', { sessionId, participantId, callType })
    
    Note over Server: Step 2: Server broadcasts invite
    Server->>Joiner: emit('call-invite', { callId, callerName, callType })
    Joiner->>Joiner: playCallIncomingSound() & Display CallInvitationModal
    
    alt Joiner Declines
        Joiner->>Server: emit('call-response', { callId, accept: false })
        Server->>Owner: emit('call-user-declined', { username })
        Owner->>Owner: Display in chat: '[User] declined call'
    else Joiner Accepts
        Note over Joiner: Step 3: Joiner Accepts & Acquires Hardware
        Joiner->>Joiner: acquireMediaStream({ video, audio })
        Joiner->>Server: emit('call-response', { callId, accept: true })
        Server->>Owner: emit('call-user-joined', { callId, participantId, callParticipants })
        Server->>Joiner: callback({ success: true, callParticipants })
        
        Note over Owner, Joiner: Step 4: P2P Call Mesh Connected
        Owner->>Owner: meshManager.setupCallConnections()
        Joiner->>Joiner: meshManager.setupCallConnections()
        Owner<<-->>Joiner: Direct P2P Encrypted SRTP (Audio & Video)
        Owner->>Owner: Render <VideoTile /> & playCallConnectedSound()
        Joiner->>Joiner: Render <VideoTile /> & playCallConnectedSound()
    end

    Note over Owner, Joiner: Step 5: Termination
    alt Non-Owner Leaves
        Joiner->>Server: emit('leave-call', { callId })
        Server->>Owner: emit('call-user-left', { participantId })
        Joiner->>Joiner: teardownCallState() -> Other callers remain active
    else Owner Ends Call for Everyone
        Owner->>Server: emit('end-call', { callId })
        Server->>Owner: emit('call-ended', { reason })
        Server->>Joiner: emit('call-ended', { reason })
        Owner->>Owner: teardownCallState() & stopAllMediaTracks()
        Joiner->>Joiner: teardownCallState() & stopAllMediaTracks()
    end
```

---

### In-Call Track Muting vs. SDP Renegotiation

```
Anti-Pattern (Slow & Fragile):
Mute Clicked ──► pc.removeTrack() ──► Create Offer ──► Renegotiate SDP ──► Audio Glitch / Lag

Plutus Pattern (Instant & Seamless):
Mute Clicked ──► track.enabled = false ──► Browser outputs silence packets ──► Zero connection lag!
```

```javascript
// src/webrtc/mediaManager.js
export function setAudioEnabled(stream, enabled) {
  if (!stream) return false;
  stream.getAudioTracks().forEach((track) => {
    track.enabled = Boolean(enabled); // Instant hardware silence toggle
  });
  return audioTracks.some((t) => t.enabled);
}
```

---

### Call State Machine & Multi-Party Mesh Coordination

```mermaid
stateDiagram-v2
    [*] --> IDLE : In Chat Session
    
    IDLE --> INVITING : Owner clicks 'Start Call'
    IDLE --> RINGING : Joiner receives 'call-invite'
    
    RINGING --> ACTIVE : Joiner clicks 'Accept'
    RINGING --> IDLE : Joiner clicks 'Decline'
    INVITING --> ACTIVE : First peer joins
    
    state ACTIVE {
        [*] --> Streaming
        Streaming --> Muted : Click Mute (audioTrack.enabled = false)
        Muted --> Streaming : Click Unmute (audioTrack.enabled = true)
        Streaming --> CamOff : Click Cam Off (videoTrack.enabled = false)
        CamOff --> Streaming : Click Cam On (videoTrack.enabled = true)
    }

    ACTIVE --> IDLE : Non-owner clicks 'Leave Call'
    ACTIVE --> ENDED : Owner clicks 'End for Everyone'
    ENDED --> IDLE : stopAllMediaTracks() (Hardware LED turns OFF)
```

---

## 9. P2P File Transfer Protocol & Streaming Engine

### SCTP DataChannel Framing & Packet Structure
Plutus streams files directly browser-to-browser over `RTCDataChannel` (`{ ordered: true }`):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Header Frame (JSON String)                                               │
│ { "type": "file-start", "fileId": "uuid", "fileName": "doc.pdf", ... }      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Binary Chunk 1 (ArrayBuffer - 16 KB)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Binary Chunk 2 (ArrayBuffer - 16 KB)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ... Binary Chunks N (ArrayBuffer - 16 KB)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Completion Frame (JSON String)                                           │
│ { "type": "file-end", "fileId": "uuid" }                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 16 KB Chunking & Flow Control (Backpressure)

```mermaid
flowchart TD
    Start["broadcastFile(file) Triggered"] --> CheckSize{"file.size <= 25 MB?"}
    CheckSize -- No --> ErrSize["Throw Error: File exceeds 25 MB limit"]
    CheckSize -- Yes --> SendStart["Send JSON Header: { type: 'file-start', metadata... }"]
    
    SendStart --> InitLoop["offset = 0\nCHUNK_SIZE = 16384 (16 KB)"]
    InitLoop --> CheckEOF{"offset < totalBytes?"}
    
    CheckEOF -- "YES (More Chunks)" --> CheckBuffer{"dataChannel.bufferedAmount > 64 KB?\n(BUFFERED_AMOUNT_HIGH_THRESHOLD)"}
    
    CheckBuffer -- "YES (Backpressure Warning)" --> AwaitLow["PAUSE LOOP ⏸️\nawait 'bufferedamountlow' event listener"]
    AwaitLow --> SliceChunk
    
    CheckBuffer -- "NO (Buffer Clear)" --> SliceChunk["chunk = file.slice(offset, offset + CHUNK_SIZE)\narrayBuffer = await chunk.arrayBuffer()"]
    
    SliceChunk --> SendChunk["dataChannel.send(arrayBuffer)"]
    SendChunk --> UpdateProg["offset += arrayBuffer.byteLength\nonProgress({ fileId, percentage, bytesSent })"]
    UpdateProg --> CheckEOF
    
    CheckEOF -- "NO (Transfer Complete)" --> SendEnd["Send JSON Header: { type: 'file-end', fileId }"]
    SendEnd --> LocalPreview["Create Local Blob URL\nregisterBlobUrl(URL.createObjectURL(blob))"]
    LocalPreview --> Done["Transfer Complete! Display in Chat 🎉"]

    style SendStart fill:#0c4a6e,stroke:#0284c7,color:#fff
    style AwaitLow fill:#854d0e,stroke:#eab308,color:#fff
    style SendChunk fill:#064e3b,stroke:#059669,color:#fff
    style Done fill:#064e3b,stroke:#059669,color:#fff
    style ErrSize fill:#881337,stroke:#e11d48,color:#fff
```

### Backpressure Analogy
```
[File on NVMe Disk] ──(Fast Pour: 500 MB/s)──► ┌────────────────┐
                                                │  64 KB Buffer  │ ◄── Throttles disk read if network is slow
                                                └───────┬────────┘
                                                        │ (Safe 16 KB Drops: 5 MB/s)
                                                        ▼
                                                [Receiver Browser]
```

---

### Receiver Assembly & Blob Reconstruction

```mermaid
flowchart TD
    RecvMsg["dataChannel.onmessage(event) Fires"] --> CheckType{"typeof event.data?"}
    
    CheckType -- "String (JSON Control)" --> ParseJSON["payload = JSON.parse(event.data)"]
    ParseJSON --> SwitchType{"payload.type?"}
    
    SwitchType -- "'file-start'" --> InitTrans["transfers.set(fileId, {\n  ...payload,\n  chunks: [],\n  receivedBytes: 0\n})\nonProgress({ status: 'RECEIVING', percentage: 0 })"]
    
    SwitchType -- "'file-end'" --> AssembleBlob["transfer = transfers.get(fileId)\nblob = new Blob(transfer.chunks, { type: transfer.fileType })\nobjectUrl = registerBlobUrl(URL.createObjectURL(blob))"]
    AssembleBlob --> NotifyComplete["onComplete({\n  messageId: 'file-' + fileId,\n  fileId, fileName, objectUrl, isLocal: false\n})\ntransfers.delete(fileId)"]
    
    SwitchType -- "'file-cancel'" --> CancelTrans["transfers.delete(fileId)\nonCancel(fileId)"]
    
    CheckType -- "ArrayBuffer (Binary Chunk)" --> PushChunk["transfer.chunks.push(event.data)\ntransfer.receivedBytes += event.data.byteLength"]
    PushChunk --> CalcProgress["percentage = Math.round((receivedBytes / fileSize) * 100)\nonProgress({ fileId, percentage, status: 'RECEIVING' })"]

    style InitTrans fill:#0c4a6e,stroke:#0284c7,color:#fff
    style AssembleBlob fill:#064e3b,stroke:#059669,color:#fff
    style PushChunk fill:#064e3b,stroke:#059669,color:#fff
    style CancelTrans fill:#881337,stroke:#e11d48,color:#fff
```

---

## 10. React State Coordination & Stale-Closure Prevention

Socket.IO listeners in React can easily suffer from **stale closures** (referencing old state values from initial render).

`App.jsx` uses a **Dual State + Ref Pattern**:

```javascript
// src/App.jsx
const [callState, setCallState] = useState('IDLE');
const callStateRef = useRef('IDLE');

// Synchronize ref whenever state updates
useEffect(() => {
  callStateRef.current = callState;
}, [callState]);

// Socket callback always accesses fresh ref without re-binding listener:
const handleCallUserJoined = (data) => {
  if (callStateRef.current === 'ACTIVE') {
    meshManagerRef.current.initiateCallPeerConnection(data.participantId, data.callId);
  }
};
```

---

## 11. Connection State Lifecycle & Failure Recovery

```mermaid
stateDiagram-v2
    [*] --> new : RTCPeerConnection instantiated
    new --> checking : ICE gathering started
    checking --> connected : Candidate pair validated (P2P Connected)
    connected --> disconnected : Temporary network glitch (Wi-Fi hop)
    disconnected --> connected : Network recovers automatically
    disconnected --> failed : Recovery timeout expired
    failed --> closed : pc.close() invoked
    connected --> closed : Call ends / Session destroyed
    closed --> [*]
```

When `connectionState` transitions to `failed` or `closed`, `meshManager.js` removes the peer connection and cleans up all associated data channels and queues.

---

## 12. Ephemeral Security & Zero-Persistence Memory Purge

Plutus provides strict ephemerality. Closing a session triggers a 4-stage cleanup:

```mermaid
flowchart TD
    Trigger["Session Ends (Countdown Zero / Owner Destroys / User Kicked)"] --> Cascade["purgeAllSessionState() Called in App.jsx"]
    
    Cascade --> S1["1. HARDWARE RELEASE"]
    S1 --> S1_Action["stopAllTracks(localStream)\nReleases Camera & Mic hardware locks\nLED indicators turn OFF immediately"]

    Cascade --> S2["2. WEBRTC DESTRUCTION"]
    S2 --> S2_Action["meshManager.destroy()\n- Close all RTCPeerConnections\n- Close all RTCDataChannels\n- Unsubscribe all Socket.IO listeners"]

    Cascade --> S3["3. RAM SANITATION"]
    S3 --> S3_Action["revokeAllBlobUrls()\nURL.revokeObjectURL(url) on all registered blobs\nBrowser frees all binary file buffers from RAM"]

    Cascade --> S4["4. STATE BUFFER ZEROING"]
    S4 --> S4_Action["setMessages([])\nsetFileTransfers([])\nsetActiveSession(null)\nRedirect to DestroyedScreen.jsx"]

    style S1 fill:#1e293b,stroke:#475569,color:#fff
    style S2 fill:#064e3b,stroke:#059669,color:#fff
    style S3 fill:#881337,stroke:#e11d48,color:#fff
    style S4 fill:#0c4a6e,stroke:#0284c7,color:#fff
```

---

## 13. Complete Signaling Event & Wire Payload Reference

| Socket Event | Sender | Receiver | Scope | Payload Schema |
| :--- | :--- | :--- | :--- | :--- |
| `start-call` | Owner | Server | Session | `{ sessionId, participantId, callType: 'video'\|'audio' }` |
| `call-invite` | Server | Joiners | Session | `{ callId, callerName, callType }` |
| `call-response` | Joiner | Server | Session | `{ sessionId, participantId, callId, accept: Boolean }` |
| `call-user-joined` | Server | Call Peers | Call | `{ callId, participantId, username, callParticipants: [] }` |
| `call-user-declined`| Server | Owner | Session | `{ callId, participantId, username }` |
| `leave-call` | Joiner | Server | Call | `{ sessionId, participantId, callId }` |
| `end-call` | Owner | Server | Call | `{ sessionId, participantId, callId }` |
| `call-ended` | Server | All Peers | Call | `{ callId, reason }` |
| `webrtc-offer` | Peer A | Peer B | Direct | `{ sessionId, senderId, targetId, offer, callId, scope: 'call'\|'data' }` |
| `webrtc-answer` | Peer B | Peer A | Direct | `{ sessionId, senderId, targetId, answer, callId, scope: 'call'\|'data' }` |
| `webrtc-ice-candidate`| Peer | Peer | Direct | `{ sessionId, senderId, targetId, candidate, callId, scope: 'call'\|'data' }` |

---

## 14. Codebase File Tour & Architectural Roles

```
src/
├── webrtc/
│   ├── config.js         ⚙️ STUN list, 25MB MAX_FILE_SIZE, 16KB CHUNK_SIZE, 64KB buffer threshold
│   ├── mediaManager.js   🎥 getUserMedia, auto-fallback, setAudioEnabled, stopAllMediaTracks
│   ├── fileTransfer.js   📦 16KB chunk streaming, backpressure flow loop, Blob URL memory registry
│   └── meshManager.js    🕸️ Dual-mesh coordinator (syncParticipants, broadcastFile, setupCallConnections)
│
├── components/
│   ├── Call/
│   │   ├── CallWindow.jsx          🖥️ Grid UI layout, call duration timer, Mute/Cam toggle buttons
│   │   ├── VideoTile.jsx           👤 Individual video/audio tile with avatar & status badges
│   │   └── CallInvitationModal.jsx 🔔 Incoming call prompt with audio ringtone (Accept/Decline)
│   └── File/
│       ├── FileUploadButton.jsx    📎 File picker with 25MB validation and progress wheel
│       └── FileMessage.jsx         🖼️ In-chat image lightbox, PDF viewer, download anchor
│
└── server.js             📡 Socket.IO signaling relays (webrtc-offer, webrtc-answer, webrtc-ice-candidate)
```

---

## 🏁 Developer Rules of Thumb

1. **Zero Media on Server:** Never relay or buffer audio/video/file buffers through server memory or database.
2. **Deterministic Initiator:** Maintain the `participantId_A < participantId_B` rule in any signaling modification to prevent offer collision.
3. **Respect Backpressure:** Always verify `dataChannel.bufferedAmount > 64KB` before dispatching subsequent binary chunks.
4. **Always Revoke Object URLs:** Any call to `URL.createObjectURL()` must register the URL with `registerBlobUrl()` for session-destruction RAM purge.
5. **Always Stop Tracks:** Never just nullify a `MediaStream`; always call `track.stop()` to release user hardware cameras and microphones.
