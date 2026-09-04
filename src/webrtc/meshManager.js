// WebRTC Mesh Manager for Plutus Chat Phase 3
// Coordinates P2P DataChannels for file/image/PDF sharing and P2P MediaStreams for audio/video calling

import { RTC_CONFIG } from './config.js';
import { sendFileChunked, FileReceiverManager, registerBlobUrl, revokeAllBlobUrls } from './fileTransfer.js';
import { stopAllMediaTracks } from './mediaManager.js';

export class WebRTCMeshManager {
  constructor({
    sessionId,
    participantId,
    username,
    isOwner,
    socket,
    onRemoteStream,
    onRemoteStreamRemoved,
    onFileProgress,
    onFileReceived,
    onFileTransferFailed,
    onConnectionStatusChange,
  }) {
    this.sessionId = sessionId;
    this.participantId = participantId;
    this.username = username;
    this.isOwner = isOwner;
    this.socket = socket;

    this.onRemoteStream = onRemoteStream;
    this.onRemoteStreamRemoved = onRemoteStreamRemoved;
    this.onFileProgress = onFileProgress;
    this.onFileReceived = onFileReceived;
    this.onFileTransferFailed = onFileTransferFailed;
    this.onConnectionStatusChange = onConnectionStatusChange;

    // DataChannel Peer Connections: Map<peerId, RTCPeerConnection>
    this.dataPeerConnections = new Map();
    // DataChannels: Map<peerId, RTCDataChannel>
    this.dataChannels = new Map();
    // File Receivers per peer: Map<peerId, FileReceiverManager>
    this.fileReceivers = new Map();

    // Call Peer Connections: Map<peerId, RTCPeerConnection>
    this.callPeerConnections = new Map();
    // Current Local Call MediaStream
    this.localCallStream = null;
    this.currentCallId = null;

    // Candidate queues if remote description isn't set yet
    this.pendingDataCandidates = new Map(); // peerId -> candidate[]
    this.pendingCallCandidates = new Map(); // peerId -> candidate[]

    this.setupSignalingListeners();
  }

  // --- Signaling Socket Listeners ---
  setupSignalingListeners() {
    this.handleOffer = async (payload) => {
      const { senderId, offer, scope, callId } = payload;
      if (scope === 'call') {
        await this.handleCallOffer(senderId, offer, callId);
      } else {
        await this.handleDataOffer(senderId, offer);
      }
    };

    this.handleAnswer = async (payload) => {
      const { senderId, answer, scope, callId } = payload;
      if (scope === 'call') {
        await this.handleCallAnswer(senderId, answer, callId);
      } else {
        await this.handleDataAnswer(senderId, answer);
      }
    };

    this.handleIceCandidate = async (payload) => {
      const { senderId, candidate, scope } = payload;
      if (scope === 'call') {
        await this.handleCallIceCandidate(senderId, candidate);
      } else {
        await this.handleDataIceCandidate(senderId, candidate);
      }
    };

    this.socket.on('webrtc-offer', this.handleOffer);
    this.socket.on('webrtc-answer', this.handleAnswer);
    this.socket.on('webrtc-ice-candidate', this.handleIceCandidate);
  }

  // ==========================================
  // SECTION 1: DATACHANNEL P2P MESH (Files)
  // ==========================================

  /**
   * Synchronizes data connections with current participants list.
   * Deterministic initiator rule:
   * Participant with lexicographically smaller ID initiates offer & data channel.
   */
  syncParticipants(participantsList = []) {
    const activePeerIds = new Set();

    participantsList.forEach((p) => {
      if (p.participantId === this.participantId) return;
      activePeerIds.add(p.participantId);

      // If we don't have a peer connection yet, establish one
      if (!this.dataPeerConnections.has(p.participantId)) {
        this.initiateDataConnection(p.participantId);
      }
    });

    // Remove stale peer connections
    for (const [peerId, pc] of this.dataPeerConnections.entries()) {
      if (!activePeerIds.has(peerId)) {
        this.closeDataPeer(peerId);
      }
    }
  }

  initiateDataConnection(peerId) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.dataPeerConnections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-ice-candidate', {
          sessionId: this.sessionId,
          senderId: this.participantId,
          targetId: peerId,
          candidate: event.candidate,
          scope: 'data',
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(peerId, pc.connectionState);
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.dataChannels.delete(peerId);
      }
    };

    // Receiver manager for incoming file chunks
    const receiver = new FileReceiverManager({
      onProgress: (prog) => {
        if (this.onFileProgress) this.onFileProgress(prog);
      },
      onComplete: (fileMessage) => {
        if (this.onFileReceived) this.onFileReceived(fileMessage);
      },
      onCancel: (fileId) => {
        if (this.onFileProgress) {
          this.onFileProgress({ fileId, status: 'CANCELLED' });
        }
      },
    });
    this.fileReceivers.set(peerId, receiver);

    // If myParticipantId < peerId, create the DataChannel and send Offer
    if (this.participantId < peerId) {
      const dc = pc.createDataChannel('plutus-files', { ordered: true });
      this.setupDataChannel(peerId, dc, receiver);

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.socket.emit('webrtc-offer', {
            sessionId: this.sessionId,
            senderId: this.participantId,
            targetId: peerId,
            offer: pc.localDescription,
            scope: 'data',
          });
        })
        .catch((err) => console.error(`[WebRTC Data] Offer error to ${peerId}:`, err));
    } else {
      // Wait for remote DataChannel via ondatachannel
      pc.ondatachannel = (event) => {
        this.setupDataChannel(peerId, event.channel, receiver);
      };
    }
  }

  setupDataChannel(peerId, dc, receiver) {
    dc.binaryType = 'arraybuffer';
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      console.log(`[WebRTC DataChannel] Connected with peer ${peerId}`);
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
    };

    dc.onerror = (err) => {
      console.error(`[WebRTC DataChannel] Error on peer ${peerId}:`, err);
    };

    dc.onmessage = (event) => {
      receiver.handleMessage(event);
    };
  }

  async handleDataOffer(senderId, offer) {
    let pc = this.dataPeerConnections.get(senderId);
    if (!pc) {
      pc = new RTCPeerConnection(RTC_CONFIG);
      this.dataPeerConnections.set(senderId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('webrtc-ice-candidate', {
            sessionId: this.sessionId,
            senderId: this.participantId,
            targetId: senderId,
            candidate: event.candidate,
            scope: 'data',
          });
        }
      };

      const receiver = new FileReceiverManager({
        onProgress: (prog) => {
          if (this.onFileProgress) this.onFileProgress(prog);
        },
        onComplete: (fileMessage) => {
          if (this.onFileReceived) this.onFileReceived(fileMessage);
        },
        onCancel: (fileId) => {
          if (this.onFileProgress) this.onFileProgress({ fileId, status: 'CANCELLED' });
        },
      });
      this.fileReceivers.set(senderId, receiver);

      pc.ondatachannel = (event) => {
        this.setupDataChannel(senderId, event.channel, receiver);
      };
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Drain pending candidates
      if (this.pendingDataCandidates.has(senderId)) {
        for (const cand of this.pendingDataCandidates.get(senderId)) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        this.pendingDataCandidates.delete(senderId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('webrtc-answer', {
        sessionId: this.sessionId,
        senderId: this.participantId,
        targetId: senderId,
        answer: pc.localDescription,
        scope: 'data',
      });
    } catch (err) {
      console.error(`[WebRTC Data] Error handling offer from ${senderId}:`, err);
    }
  }

  async handleDataAnswer(senderId, answer) {
    const pc = this.dataPeerConnections.get(senderId);
    if (pc && pc.signalingState !== 'stable') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        if (this.pendingDataCandidates.has(senderId)) {
          for (const cand of this.pendingDataCandidates.get(senderId)) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          this.pendingDataCandidates.delete(senderId);
        }
      } catch (err) {
        console.error(`[WebRTC Data] Error setting remote answer from ${senderId}:`, err);
      }
    }
  }

  async handleDataIceCandidate(senderId, candidate) {
    const pc = this.dataPeerConnections.get(senderId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC Data] Candidate add failed:', err);
      }
    } else {
      if (!this.pendingDataCandidates.has(senderId)) {
        this.pendingDataCandidates.set(senderId, []);
      }
      this.pendingDataCandidates.get(senderId).push(candidate);
    }
  }

  closeDataPeer(peerId) {
    if (this.dataChannels.has(peerId)) {
      try {
        this.dataChannels.get(peerId).close();
      } catch (e) {}
      this.dataChannels.delete(peerId);
    }
    if (this.dataPeerConnections.has(peerId)) {
      try {
        this.dataPeerConnections.get(peerId).close();
      } catch (e) {}
      this.dataPeerConnections.delete(peerId);
    }
    this.fileReceivers.delete(peerId);
    this.pendingDataCandidates.delete(peerId);
  }

  /**
   * Broadcasts a file to all connected participants over DataChannels.
   * Returns a promise that resolves when chunks have been dispatched.
   */
  async broadcastFile(file, { onProgress, abortSignal }) {
    const openChannels = Array.from(this.dataChannels.entries()).filter(
      ([, dc]) => dc.readyState === 'open'
    );

    if (openChannels.length === 0) {
      throw new Error('No peer connections currently open to receive files.');
    }

    const fileId = crypto.randomUUID();

    // Send in parallel to all open channels
    const sendPromises = openChannels.map(([peerId, dc]) =>
      sendFileChunked({
        dataChannel: dc,
        file,
        fileId,
        senderId: this.participantId,
        senderName: this.username,
        isOwner: this.isOwner,
        onProgress: (prog) => {
          if (onProgress) onProgress(prog);
        },
        abortSignal,
      })
    );

    await Promise.all(sendPromises);

    // Create local object URL so sender can preview their own sent file
    const localBlob = new Blob([file], { type: file.type });
    const localUrl = registerBlobUrl(URL.createObjectURL(localBlob));

    return {
      messageId: `file-${fileId}`,
      fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      senderId: this.participantId,
      senderName: 'You',
      isOwner: this.isOwner,
      timestamp: Date.now(),
      objectUrl: localUrl,
      isLocal: true,
    };
  }

  // ==========================================
  // SECTION 2: AUDIO / VIDEO CALLING MESH
  // ==========================================

  /**
   * Joins or starts the call with a local MediaStream.
   * Connects to all other call participants in the call.
   */
  async setupCallConnections(callId, localStream, callParticipants = []) {
    this.currentCallId = callId;
    this.localCallStream = localStream;

    // Filter out self
    const remoteParticipants = callParticipants.filter((id) => id !== this.participantId);

    for (const peerId of remoteParticipants) {
      if (!this.callPeerConnections.has(peerId)) {
        await this.initiateCallPeerConnection(peerId, callId);
      }
    }
  }

  async initiateCallPeerConnection(peerId, callId) {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.callPeerConnections.set(peerId, pc);

    // Add local tracks to peer connection
    if (this.localCallStream) {
      this.localCallStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localCallStream);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        if (this.onRemoteStream) {
          this.onRemoteStream(peerId, event.streams[0]);
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc-ice-candidate', {
          sessionId: this.sessionId,
          senderId: this.participantId,
          targetId: peerId,
          candidate: event.candidate,
          callId,
          scope: 'call',
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (this.onRemoteStreamRemoved) {
          this.onRemoteStreamRemoved(peerId);
        }
      }
    };

    // Deterministic offer creation: newly joined participant or lexicographically lower ID initiates
    // To ensure negotiation happens cleanly:
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.socket.emit('webrtc-offer', {
      sessionId: this.sessionId,
      senderId: this.participantId,
      targetId: peerId,
      offer: pc.localDescription,
      callId,
      scope: 'call',
    });
  }

  async handleCallOffer(senderId, offer, callId) {
    let pc = this.callPeerConnections.get(senderId);
    if (!pc) {
      pc = new RTCPeerConnection(RTC_CONFIG);
      this.callPeerConnections.set(senderId, pc);

      if (this.localCallStream) {
        this.localCallStream.getTracks().forEach((track) => {
          pc.addTrack(track, this.localCallStream);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          if (this.onRemoteStream) {
            this.onRemoteStream(senderId, event.streams[0]);
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('webrtc-ice-candidate', {
            sessionId: this.sessionId,
            senderId: this.participantId,
            targetId: senderId,
            candidate: event.candidate,
            callId,
            scope: 'call',
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          if (this.onRemoteStreamRemoved) {
            this.onRemoteStreamRemoved(senderId);
          }
        }
      };
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Drain queued candidates
      if (this.pendingCallCandidates.has(senderId)) {
        for (const cand of this.pendingCallCandidates.get(senderId)) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        this.pendingCallCandidates.delete(senderId);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('webrtc-answer', {
        sessionId: this.sessionId,
        senderId: this.participantId,
        targetId: senderId,
        answer: pc.localDescription,
        callId,
        scope: 'call',
      });
    } catch (err) {
      console.error(`[WebRTC Call] Error answering offer from ${senderId}:`, err);
    }
  }

  async handleCallAnswer(senderId, answer, callId) {
    const pc = this.callPeerConnections.get(senderId);
    if (pc && pc.signalingState !== 'stable') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        if (this.pendingCallCandidates.has(senderId)) {
          for (const cand of this.pendingCallCandidates.get(senderId)) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          this.pendingCallCandidates.delete(senderId);
        }
      } catch (err) {
        console.error(`[WebRTC Call] Error setting remote answer from ${senderId}:`, err);
      }
    }
  }

  async handleCallIceCandidate(senderId, candidate) {
    const pc = this.callPeerConnections.get(senderId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WebRTC Call] Candidate add failed:', err);
      }
    } else {
      if (!this.pendingCallCandidates.has(senderId)) {
        this.pendingCallCandidates.set(senderId, []);
      }
      this.pendingCallCandidates.get(senderId).push(candidate);
    }
  }

  removeCallParticipant(peerId) {
    if (this.callPeerConnections.has(peerId)) {
      try {
        this.callPeerConnections.get(peerId).close();
      } catch (e) {}
      this.callPeerConnections.delete(peerId);
    }
    this.pendingCallCandidates.delete(peerId);
    if (this.onRemoteStreamRemoved) {
      this.onRemoteStreamRemoved(peerId);
    }
  }

  /**
   * Leaves or stops the active call, releasing all media tracks and peer connections
   */
  cleanupCall() {
    this.callPeerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.callPeerConnections.clear();
    this.pendingCallCandidates.clear();

    if (this.localCallStream) {
      stopAllMediaTracks(this.localCallStream);
      this.localCallStream = null;
    }
    this.currentCallId = null;
  }

  // ==========================================
  // SECTION 3: COMPLETE LIFECYCLE DESTRUCTION
  // ==========================================

  /**
   * Final teardown when leaving session or session is destroyed.
   * Stops media, closes all peer connections, revokes all Blob URLs.
   */
  destroy() {
    // 1. Remove socket listeners
    this.socket.off('webrtc-offer', this.handleOffer);
    this.socket.off('webrtc-answer', this.handleAnswer);
    this.socket.off('webrtc-ice-candidate', this.handleIceCandidate);

    // 2. Teardown Call
    this.cleanupCall();

    // 3. Teardown DataChannels
    this.dataChannels.forEach((dc) => {
      try {
        dc.close();
      } catch (e) {}
    });
    this.dataChannels.clear();

    this.dataPeerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.dataPeerConnections.clear();

    this.fileReceivers.forEach((receiver) => receiver.clear());
    this.fileReceivers.clear();
    this.pendingDataCandidates.clear();

    // 4. Memory Purge: Revoke all temporary object URLs
    revokeAllBlobUrls();
  }
}
