import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from './services/socket.js';
import { Navbar } from './components/Navbar.jsx';
import { HomeView } from './components/HomeView.jsx';
import { CreateSessionView } from './components/CreateSessionView.jsx';
import { JoinSessionView } from './components/JoinSessionView.jsx';
import { ActiveSessionView } from './components/ActiveSessionView.jsx';
import { EndingCountdownModal } from './components/EndingCountdownModal.jsx';
import { DestroyedScreen } from './components/DestroyedScreen.jsx';
import { KickedScreen } from './components/KickedScreen.jsx';
import { ArchitectureModal } from './components/ArchitectureModal.jsx';
import { CallInvitationModal } from './components/Call/CallInvitationModal.jsx';
import {
  playMessageReceivedSound,
  playUserJoinedSound,
  playUserLeftSound,
  playCallIncomingSound,
  playCallConnectedSound,
  playCallEndedSound,
  playFileCompleteSound,
} from './services/soundEffects.js';
import { WebRTCMeshManager } from './webrtc/meshManager.js';
import {
  acquireMediaStream,
  toggleTrackEnabled,
  stopAllTracks,
} from './webrtc/mediaManager.js';
import { revokeAllBlobUrls, getFileCategory } from './webrtc/fileTransfer.js';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [uiState, setUiState] = useState('HOME');
  const [activeSession, setActiveSession] = useState(null);
  const activeSessionRef = useRef(null);

  const setActiveSessionAndRef = (val) => {
    const resolved = typeof val === 'function' ? val(activeSessionRef.current) : val;
    activeSessionRef.current = resolved;
    setActiveSession(resolved);
  };

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [endingData, setEndingData] = useState(null);
  const [kickedReason, setKickedReason] = useState('');
  const [joinErrorMessage, setJoinErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);

  // WebRTC Calling & Media State
  const [callState, setCallState] = useState('IDLE'); // 'IDLE' | 'INVITING' | 'ACTIVE' | 'ENDED'
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [activeCallId, setActiveCallId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [callWarning, setCallWarning] = useState(null);

  // P2P File Transfers State
  const [fileTransfers, setFileTransfers] = useState([]);

  // URL query params for auto-fill on invite links
  const [urlSessionId, setUrlSessionId] = useState('');
  const [urlPasskey, setUrlPasskey] = useState('');

  const typingMapRef = useRef(new Map());
  const meshManagerRef = useRef(null);
  const localStreamRef = useRef(null);
  const callStateRef = useRef('IDLE');
  const activeCallIdRef = useRef(null);

  // Synchronize localStreamRef and callStateRef
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    activeCallIdRef.current = activeCallId;
  }, [activeCallId]);

  // Teardown calling & media helper
  const teardownCallState = useCallback(() => {
    callStateRef.current = 'IDLE';
    activeCallIdRef.current = null;
    if (localStreamRef.current) {
      stopAllTracks(localStreamRef.current);
      setLocalStream(null);
      localStreamRef.current = null;
    }
    if (meshManagerRef.current) {
      meshManagerRef.current.cleanupCall();
    }
    setCallState('IDLE');
    setActiveCallId(null);
    setIncomingCall(null);
    setRemoteStreams(new Map());
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setCallWarning(null);
  }, []);

  // Full session destruction & cleanup helper
  const purgeAllSessionState = useCallback(() => {
    teardownCallState();
    if (meshManagerRef.current) {
      meshManagerRef.current.destroy();
      meshManagerRef.current = null;
    }
    revokeAllBlobUrls();
    setFileTransfers([]);
    setMessages([]);
    setTypingUsers([]);
    setActiveSessionAndRef(null);
  }, [teardownCallState]);

  // Check URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const joinId = searchParams.get('join');
      const passkey = searchParams.get('key');
      if (joinId) {
        setUrlSessionId(joinId.toUpperCase());
        if (passkey) setUrlPasskey(passkey.toUpperCase());
        setUiState('JOINING');
      }
    }
  }, []);

  // Initialize and synchronize WebRTCMeshManager when session is active
  useEffect(() => {
    if (!activeSession || uiState !== 'ACTIVE') return;

    const socket = getSocket();

    if (!meshManagerRef.current) {
      meshManagerRef.current = new WebRTCMeshManager({
        socket,
        sessionId: activeSession.sessionId,
        participantId: activeSession.participantId,
        username: activeSession.username,
        isOwner: Boolean(activeSession.isOwner),
        onRemoteStream: (peerId, stream) => {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(peerId, stream);
            return next;
          });
        },
        onRemoteStreamRemoved: (peerId) => {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        },
        onFileReceived: (fileMessage) => {
          playFileCompleteSound();
          setMessages((prev) => [...prev, fileMessage]);
        },
        onFileProgress: ({ fileId, progress, isReceiver }) => {
          setFileTransfers((prev) => {
            const existingIdx = prev.findIndex((t) => t.fileId === fileId);
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = {
                ...updated[existingIdx],
                progress,
              };
              return updated;
            }
            return prev;
          });
        },
        onPeerDataChannelOpen: (peerId) => {
          // Connected peer data channel
        },
        onPeerDisconnected: (peerId) => {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        },
      });
    }

    // Synchronize peer mesh connections for file transfer channels
    if (meshManagerRef.current && activeSession.participants) {
      meshManagerRef.current.syncParticipants(activeSession.participants);
    }
  }, [activeSession, uiState]);

  // Socket connection & event listeners setup
  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // 1. Session created
    const handleSessionCreated = (data) => {
      setIsLoading(false);
      setActiveSessionAndRef(data);
      setMessages([]);
      setUiState('ACTIVE');
    };

    // 2. Join success
    const handleJoinSuccess = (data) => {
      setIsLoading(false);
      setJoinErrorMessage(null);
      setActiveSessionAndRef(data);
      setMessages([
        {
          messageId: 'sys-join',
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          isOwner: false,
          text: `Authenticated to secure line [${data.sessionId}]. Welcome, ${data.username}.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
      setUiState('ACTIVE');

      // If a call is already active on the session when joiner enters, prompt them to join
      if (data.activeCall && !data.isOwner) {
        setIncomingCall(data.activeCall);
        try {
          playCallIncomingSound();
        } catch (e) {}
      }
    };

    // 3. Join error
    const handleJoinError = (err) => {
      setIsLoading(false);
      setJoinErrorMessage(err.message || 'Failed to authenticate to session.');
    };

    // 4. Another participant joined
    const handleParticipantJoined = (data) => {
      setActiveSessionAndRef((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: data.participants,
        };
      });

      setMessages((prev) => [
        ...prev,
        {
          messageId: `join-${Date.now()}-${Math.random()}`,
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          isOwner: false,
          text: `${data.participant.username} joined the session.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);

      playUserJoinedSound();
    };

    // 5. Participant left voluntarily
    const handleParticipantLeft = (data) => {
      setActiveSessionAndRef((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: data.participants,
        };
      });

      setMessages((prev) => [
        ...prev,
        {
          messageId: `left-${Date.now()}-${Math.random()}`,
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          isOwner: false,
          text: `${data.username} left the session voluntarily.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);

      playUserLeftSound();
    };

    // 6. Participant kicked by owner
    const handleParticipantKicked = (data) => {
      setActiveSessionAndRef((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: data.participants,
        };
      });

      setMessages((prev) => [
        ...prev,
        {
          messageId: `kicked-${Date.now()}-${Math.random()}`,
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          isOwner: false,
          text: `${data.username} was kicked and permanently barred by the owner.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);

      playUserLeftSound();
    };

    // 7. You were kicked
    const handleKickedSelf = (data) => {
      setKickedReason(data.reason);
      purgeAllSessionState();
      setUiState('KICKED');
    };

    // 8. Receive chat message
    const handleReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (activeSessionRef.current && msg.senderId !== activeSessionRef.current.participantId) {
        playMessageReceivedSound();
      }
    };

    // 9. User typing event
    const handleUserTyping = (data) => {
      const { participantId, username, isTyping } = data;

      if (isTyping) {
        if (typingMapRef.current.has(participantId)) {
          clearTimeout(typingMapRef.current.get(participantId).timer);
        }
        const timer = setTimeout(() => {
          typingMapRef.current.delete(participantId);
          updateTypingUsers();
        }, 2500);

        typingMapRef.current.set(participantId, { username, timer });
      } else {
        if (typingMapRef.current.has(participantId)) {
          clearTimeout(typingMapRef.current.get(participantId).timer);
          typingMapRef.current.delete(participantId);
        }
      }
      updateTypingUsers();
    };

    const updateTypingUsers = () => {
      const names = [];
      typingMapRef.current.forEach((val) => {
        if (val?.username) names.push(val.username);
      });
      setTypingUsers(names);
    };

    // 10. WebRTC Call Invitation
    const handleCallInvite = (inviteData) => {
      console.log('[WebRTC Call] Received incoming call-invite:', inviteData);
      // If user is already in call, ignore
      if (callState === 'ACTIVE') return;

      setIncomingCall(inviteData);
      try {
        playCallIncomingSound();
      } catch (e) {}

      // Add prominent system notification in chat feed
      setMessages((prev) => [
        ...prev,
        {
          messageId: `call-invite-${Date.now()}`,
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          isOwner: false,
          text: `Incoming ${inviteData.callType === 'video' ? 'Video' : 'Audio'} Call initiated by ${inviteData.callerName || 'Session Owner'}.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    };

    // 11. WebRTC Remote User Joined Call
    const handleCallUserJoined = (data) => {
      console.log('[WebRTC Call] Remote user joined call:', data);
      const isCallActive = callStateRef.current === 'ACTIVE' || callStateRef.current === 'INVITING';
      if (isCallActive && meshManagerRef.current) {
        if (callStateRef.current === 'INVITING') {
          setCallState('ACTIVE');
          callStateRef.current = 'ACTIVE';
        }
        meshManagerRef.current.initiateCallPeerConnection(data.participantId, data.callId);
      }
    };

    // 12. WebRTC Remote User Left Call
    const handleCallUserLeft = (data) => {
      if (meshManagerRef.current) {
        meshManagerRef.current.removeCallParticipant(data.participantId);
      }
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(data.participantId);
        return next;
      });
    };

    // 13. WebRTC Call Declined by Joiner
    const handleCallUserDeclined = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          messageId: `call-declined-${Date.now()}`,
          senderId: 'SYSTEM',
          senderName: 'SYSTEM',
          isOwner: false,
          text: `${data.username} declined the call invitation.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    };

    // 14. WebRTC Call Ended
    const handleCallEnded = (data) => {
      teardownCallState();
      playCallEndedSound();
      if (data?.reason) {
        setMessages((prev) => [
          ...prev,
          {
            messageId: `call-ended-${Date.now()}`,
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            isOwner: false,
            text: `Call ended: ${data.reason}`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
      }
    };

    // 15. Session ending countdown initiated by server
    const handleSessionEnding = (data) => {
      setEndingData(data);
    };

    // 16. Final Session Destroyed
    const handleSessionDestroyed = () => {
      purgeAllSessionState();
      setEndingData(null);
      setUiState('DESTROYED');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('session-created', handleSessionCreated);
    socket.on('join-success', handleJoinSuccess);
    socket.on('join-error', handleJoinError);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-kicked', handleParticipantKicked);
    socket.on('participant-kicked-self', handleKickedSelf);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('call-invite', handleCallInvite);
    socket.on('call-user-joined', handleCallUserJoined);
    socket.on('call-user-left', handleCallUserLeft);
    socket.on('call-user-declined', handleCallUserDeclined);
    socket.on('call-ended', handleCallEnded);
    socket.on('session-ending', handleSessionEnding);
    socket.on('session-destroyed', handleSessionDestroyed);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('session-created', handleSessionCreated);
      socket.off('join-success', handleJoinSuccess);
      socket.off('join-error', handleJoinError);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('participant-kicked', handleParticipantKicked);
      socket.off('participant-kicked-self', handleKickedSelf);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('call-invite', handleCallInvite);
      socket.off('call-user-joined', handleCallUserJoined);
      socket.off('call-user-left', handleCallUserLeft);
      socket.off('call-user-declined', handleCallUserDeclined);
      socket.off('call-ended', handleCallEnded);
      socket.off('session-ending', handleSessionEnding);
      socket.off('session-destroyed', handleSessionDestroyed);
    };
  }, [purgeAllSessionState, teardownCallState, callState]);

  // Actions
  const handleCreateSession = (username) => {
    setIsLoading(true);
    const socket = getSocket();
    socket.emit('create-session', { username });
  };

  const handleJoinSession = (sessionId, passkey, username) => {
    setIsLoading(true);
    setJoinErrorMessage(null);
    const socket = getSocket();
    socket.emit('join-session', { sessionId, passkey, username });
  };

  const handleSendMessage = (text) => {
    if (!activeSession) return;
    const socket = getSocket();
    socket.emit('send-message', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
      text,
      type: 'text',
    });
  };

  const handleTyping = (isTyping) => {
    if (!activeSession) return;
    const socket = getSocket();
    socket.emit('typing', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
      isTyping,
    });
  };

  const handleKickParticipant = (targetParticipantId) => {
    if (!activeSession) return;
    const socket = getSocket();
    socket.emit('kick-participant', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
      targetParticipantId,
    });
  };

  const handleLeaveSession = () => {
    if (!activeSession) return;
    const socket = getSocket();
    socket.emit('leave-session', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
    });
    purgeAllSessionState();
    setUiState('HOME');
  };

  const handleEndSession = () => {
    if (!activeSession) return;
    const socket = getSocket();
    socket.emit('end-session', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
    });
  };

  const handleResetToHome = () => {
    purgeAllSessionState();
    setEndingData(null);
    setJoinErrorMessage(null);
    setUiState('HOME');
  };

  // Phase 3: WebRTC Call Initiation (Owner Only)
  const handleStartCall = async (type = 'video') => {
    if (!activeSession || !activeSession.isOwner) return;

    try {
      setCallState('INVITING');
      callStateRef.current = 'INVITING';
      setCallType(type);

      const { stream, fallbackToAudio } = await acquireMediaStream({
        video: type === 'video',
        audio: true,
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (fallbackToAudio) {
        setCallWarning('Camera permission denied or unavailable. Fallback to audio call active.');
      } else {
        setCallWarning(null);
      }

      const socket = getSocket();
      socket.emit(
        'start-call',
        {
          sessionId: activeSession.sessionId,
          participantId: activeSession.participantId,
          callType: type,
        },
        (res) => {
          if (res?.success) {
            setActiveCallId(res.callId);
            activeCallIdRef.current = res.callId;
            setCallState('ACTIVE');
            callStateRef.current = 'ACTIVE';
            if (meshManagerRef.current) {
              meshManagerRef.current.setupCallConnections(res.callId, stream, res.callParticipants || []);
            }
            playCallConnectedSound();
          } else {
            alert(res?.message || 'Failed to initiate call');
            teardownCallState();
          }
        }
      );
    } catch (err) {
      alert(`Could not start call: ${err.message}`);
      teardownCallState();
    }
  };

  // Phase 3: WebRTC Accept Incoming Call (Joiner)
  const handleAcceptCall = async () => {
    if (!incomingCall || !activeSession) return;

    try {
      const type = incomingCall.callType || 'video';
      setCallType(type);

      const { stream, fallbackToAudio } = await acquireMediaStream({
        video: type === 'video',
        audio: true,
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      if (fallbackToAudio) {
        setCallWarning('Camera permission denied. Joined with audio only.');
      }

      const targetCallId = incomingCall.callId;
      setIncomingCall(null);
      setActiveCallId(targetCallId);
      activeCallIdRef.current = targetCallId;
      setCallState('ACTIVE');
      callStateRef.current = 'ACTIVE';

      const socket = getSocket();
      socket.emit(
        'call-response',
        {
          sessionId: activeSession.sessionId,
          participantId: activeSession.participantId,
          callId: targetCallId,
          accept: true,
        },
        (res) => {
          if (res?.success && meshManagerRef.current) {
            meshManagerRef.current.setupCallConnections(
              targetCallId,
              stream,
              res.callParticipants || []
            );
            playCallConnectedSound();
          }
        }
      );
    } catch (err) {
      alert(`Could not join call: ${err.message}`);
      handleDeclineCall();
    }
  };

  // Phase 3: WebRTC Decline Incoming Call
  const handleDeclineCall = () => {
    if (!incomingCall || !activeSession) return;
    const socket = getSocket();
    socket.emit('call-response', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
      callId: incomingCall.callId,
      accept: false,
    });
    setIncomingCall(null);
  };

  // Phase 3: Leave Current Call (Voluntary)
  const handleLeaveCall = () => {
    if (!activeCallId || !activeSession) return;
    const socket = getSocket();
    socket.emit('leave-call', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
      callId: activeCallId,
    });
    teardownCallState();
    playCallEndedSound();
  };

  // Phase 3: End Call For Everyone (Owner Only)
  const handleEndCallForEveryone = () => {
    if (!activeCallId || !activeSession || !activeSession.isOwner) return;
    const socket = getSocket();
    socket.emit('end-call', {
      sessionId: activeSession.sessionId,
      participantId: activeSession.participantId,
      callId: activeCallId,
    });
    teardownCallState();
    playCallEndedSound();
  };

  // Audio / Video Mute Toggles
  const handleToggleAudio = () => {
    if (!localStream) return;
    const nextMuted = !isAudioMuted;
    toggleTrackEnabled(localStream, 'audio', isAudioMuted);
    setIsAudioMuted(nextMuted);
  };

  const handleToggleVideo = () => {
    if (!localStream) return;
    const nextMuted = !isVideoMuted;
    toggleTrackEnabled(localStream, 'video', isVideoMuted);
    setIsVideoMuted(nextMuted);
  };

  // Phase 3: P2P File Upload & Transfer
  const handleSendFile = async (file) => {
    if (!activeSession || !meshManagerRef.current) return;

    const fileId = crypto.randomUUID();
    const category = getFileCategory(file.type, file.name);

    // Add in-progress item to transfers state
    const transferEntry = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      category,
      progress: 0,
      status: 'transferring',
      isTransferring: true,
      isLocal: true,
      senderName: activeSession.username,
      timestamp: Date.now(),
    };

    setFileTransfers((prev) => [...prev, transferEntry]);

    try {
      await meshManagerRef.current.broadcastFile(file, {
        onProgress: (progress) => {
          setFileTransfers((prev) =>
            prev.map((t) => (t.fileId === fileId ? { ...t, progress } : t))
          );
        },
      });

      // Transfer completed: Remove from in-progress transfers, append to messages
      setFileTransfers((prev) => prev.filter((t) => t.fileId !== fileId));

      const objectUrl = URL.createObjectURL(file);
      const localFileMessage = {
        messageId: fileId,
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category,
        objectUrl,
        senderId: activeSession.participantId,
        senderName: activeSession.username,
        isOwner: activeSession.isOwner,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, localFileMessage]);
    } catch (err) {
      alert(`File transfer failed: ${err.message}`);
      setFileTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
    }
  };

  const handleCancelFileTransfer = (fileId) => {
    setFileTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        isConnected={isConnected}
        activeSessionId={activeSession?.sessionId}
        onOpenArchitecture={() => setShowArchitecture(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 flex flex-col">
        {uiState === 'HOME' && (
          <HomeView
            onCreateClick={() => setUiState('CREATING')}
            onJoinClick={() => setUiState('JOINING')}
            onOpenArchitecture={() => setShowArchitecture(true)}
          />
        )}

        {uiState === 'CREATING' && (
          <CreateSessionView
            onCreateSession={handleCreateSession}
            onCancel={() => setUiState('HOME')}
            isLoading={isLoading}
          />
        )}

        {uiState === 'JOINING' && (
          <JoinSessionView
            initialSessionId={urlSessionId}
            initialPasskey={urlPasskey}
            onJoinSession={handleJoinSession}
            onCancel={() => setUiState('HOME')}
            isLoading={isLoading}
            errorMessage={joinErrorMessage}
          />
        )}

        {uiState === 'ACTIVE' && activeSession && (
          <ActiveSessionView
            sessionData={activeSession}
            messages={messages}
            typingUsers={typingUsers}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            onKickParticipant={handleKickParticipant}
            onLeaveSession={handleLeaveSession}
            onEndSession={handleEndSession}
            // Phase 3 WebRTC calling & P2P file transfers
            callState={callState}
            callType={callType}
            localStream={localStream}
            remoteStreams={remoteStreams}
            isAudioMuted={isAudioMuted}
            isVideoMuted={isVideoMuted}
            callWarning={callWarning}
            onStartCall={handleStartCall}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onLeaveCall={handleLeaveCall}
            onEndCallForEveryone={handleEndCallForEveryone}
            onSendFile={handleSendFile}
            onCancelFileTransfer={handleCancelFileTransfer}
            fileTransfers={fileTransfers}
            incomingCall={incomingCall}
            onAcceptCall={handleAcceptCall}
            onDeclineCall={handleDeclineCall}
          />
        )}

        {uiState === 'DESTROYED' && (
          <DestroyedScreen
            sessionId={endingData?.sessionId || activeSession?.sessionId}
            onReset={handleResetToHome}
          />
        )}

        {uiState === 'KICKED' && (
          <KickedScreen
            sessionId={activeSession?.sessionId}
            reason={kickedReason}
            onReset={handleResetToHome}
          />
        )}
      </main>

      {/* Incoming Call Invitation Modal */}
      {incomingCall && (
        <CallInvitationModal
          isOpen={Boolean(incomingCall)}
          invitation={incomingCall}
          callerName={incomingCall.callerName}
          callType={incomingCall.callType}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Server-Authoritative Countdown Overlay */}
      {endingData && (
        <EndingCountdownModal
          endingData={endingData}
          isOwner={Boolean(activeSession?.isOwner)}
        />
      )}

      {/* Architecture & PRD Modal */}
      <ArchitectureModal
        isOpen={showArchitecture}
        onClose={() => setShowArchitecture(false)}
      />
    </div>
  );
}
