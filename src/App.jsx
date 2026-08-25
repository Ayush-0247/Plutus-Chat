import React, { useState, useEffect, useRef } from 'react';
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
import {
  generateIdentityKeyPair,
  importPeerPublicKey,
  deriveSharedWrappingKey,
} from './services/crypto.js';
import {
  playMessageReceivedSound,
  playFileReceivedSound,
  playUserJoinedSound,
  playUserLeftSound,
} from './services/soundEffects.js';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [uiState, setUiState] = useState('HOME');
  const [activeSession, setActiveSession] = useState(null);

  // Cryptographic In-Memory State (PRD Phase 3)
  const [identityKeyPair, setIdentityKeyPair] = useState(null);
  const [derivedSharedKeys, setDerivedSharedKeys] = useState(new Map());
  const [selfWrappingKey, setSelfWrappingKey] = useState(null);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [isRotatingKeys, setIsRotatingKeys] = useState(false);

  // Keep ref in sync so socket handlers (stale closures) can read current value
  const activeSessionRef = useRef(null);
  const identityKeyPairRef = useRef(null);

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

  // URL query params for auto-fill on invite links
  const [urlSessionId, setUrlSessionId] = useState('');
  const [urlPasskey, setUrlPasskey] = useState('');

  const typingMapRef = useRef(new Map());

  // Initialize client-side identity keypair on boot (PRD Section 14, 15)
  useEffect(() => {
    async function initCrypto() {
      try {
        const keyData = await generateIdentityKeyPair();
        setIdentityKeyPair(keyData);
        identityKeyPairRef.current = keyData;

        // Derive self-wrapping key (used to encrypt sender's own copy of file keys)
        const selfKey = await deriveSharedWrappingKey(
          keyData.keyPair.privateKey,
          keyData.keyPair.publicKey
        );
        setSelfWrappingKey(selfKey);
      } catch (err) {
        console.error('Failed to initialize Web Crypto ECDH key pair:', err);
      }
    }
    initCrypto();
  }, []);

  // Check URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const searchParams = new URLSearchParams(window.location.search);

      let joinId = searchParams.get('join') || searchParams.get('session');
      let passkey = searchParams.get('key') || searchParams.get('passkey');

      if (!joinId && hash.includes('join')) {
        const hashParams = new URLSearchParams(hash.replace('#join?', ''));
        joinId = hashParams.get('session');
        passkey = hashParams.get('passkey');
      }

      if (joinId) {
        setUrlSessionId(joinId.toUpperCase());
        if (passkey) setUrlPasskey(passkey.toUpperCase());
        setUiState('JOINING');
      }
    }
  }, []);

  // Compute shared wrapping keys whenever participants list or identity key changes
  const computeDerivedKeys = async (participantsList, currentKeyData) => {
    if (!currentKeyData || !participantsList) return;
    const newMap = new Map();

    for (const p of participantsList) {
      if (p.publicKey && p.participantId !== activeSessionRef.current?.participantId) {
        try {
          const peerKey = await importPeerPublicKey(p.publicKey);
          const sharedKey = await deriveSharedWrappingKey(
            currentKeyData.keyPair.privateKey,
            peerKey
          );
          newMap.set(p.participantId, sharedKey);
        } catch (err) {
          console.warn(`Failed to derive shared key for peer ${p.participantId}:`, err);
        }
      }
    }
    setDerivedSharedKeys(newMap);
  };

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
      if (data.securityLogs) {
        setSecurityLogs(data.securityLogs);
      }
      setMessages([]);
      setUiState('ACTIVE');
      computeDerivedKeys(data.participants, identityKeyPairRef.current);
    };

    // 2. Join success
    const handleJoinSuccess = (data) => {
      setIsLoading(false);
      setJoinErrorMessage(null);
      setActiveSessionAndRef(data);
      if (data.securityLogs) {
        setSecurityLogs(data.securityLogs);
      }
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
      computeDerivedKeys(data.participants, identityKeyPairRef.current);
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

      computeDerivedKeys(data.participants, identityKeyPairRef.current);
      playUserJoinedSound();
    };

    // 4b. Peer Key Updated / Rotated (PRD Section 16, 35)
    const handlePeerKeyUpdated = (data) => {
      setActiveSessionAndRef((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: data.participants,
        };
      });

      computeDerivedKeys(data.participants, identityKeyPairRef.current);

      if (data.isRotation) {
        setMessages((prev) => [
          ...prev,
          {
            messageId: `rotate-${Date.now()}-${Math.random()}`,
            senderId: 'SYSTEM',
            senderName: 'SYSTEM',
            isOwner: false,
            text: `Participant ${data.username} rotated their ECDH cryptographic keypair.`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
      }
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

      computeDerivedKeys(data.participants, identityKeyPairRef.current);
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

      computeDerivedKeys(data.participants, identityKeyPairRef.current);
      playUserLeftSound();
    };

    // 7. You were kicked
    const handleKickedSelf = (data) => {
      setKickedReason(data.reason);
      setActiveSessionAndRef(null);
      setMessages([]);
      setUiState('KICKED');
    };

    // 8. Receive chat message
    const handleReceiveMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (activeSessionRef.current && msg.senderId !== activeSessionRef.current.participantId) {
        playMessageReceivedSound();
      }
    };

    // 8b. Receive encrypted file broadcast from server
    const handleReceiveFile = (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: msg.fileType }]);
      if (activeSessionRef.current && msg.senderId !== activeSessionRef.current.participantId) {
        playFileReceivedSound();
      }
    };

    // 8c. File Deleted Event (PRD Section 31)
    const handleFileDeleted = (data) => {
      setMessages((prev) =>
        prev.filter((m) => m.fileId !== data.fileId)
      );
    };

    // 8d. File Expired Event (PRD Section 30)
    const handleFileExpired = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.fileId === data.fileId ? { ...m, isExpired: true } : m
        )
      );
    };

    // 8e. Security Audit Log Event
    const handleSecurityEvent = (event) => {
      setSecurityLogs((prev) => [...prev, event]);
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

    // 10. Session ending countdown initiated by server
    const handleSessionEnding = (data) => {
      setEndingData(data);
    };

    // 11. Final Session Destroyed
    const handleSessionDestroyed = () => {
      setEndingData(null);
      setActiveSessionAndRef(null);
      setMessages([]);
      setTypingUsers([]);
      setSecurityLogs([]);
      setUiState('DESTROYED');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('session-created', handleSessionCreated);
    socket.on('join-success', handleJoinSuccess);
    socket.on('join-error', handleJoinError);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('peer-key-updated', handlePeerKeyUpdated);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-kicked', handleParticipantKicked);
    socket.on('participant-kicked-self', handleKickedSelf);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('receive-file', handleReceiveFile);
    socket.on('file-deleted', handleFileDeleted);
    socket.on('file-expired', handleFileExpired);
    socket.on('security-event', handleSecurityEvent);
    socket.on('user-typing', handleUserTyping);
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
      socket.off('peer-key-updated', handlePeerKeyUpdated);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('participant-kicked', handleParticipantKicked);
      socket.off('participant-kicked-self', handleKickedSelf);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('receive-file', handleReceiveFile);
      socket.off('file-deleted', handleFileDeleted);
      socket.off('file-expired', handleFileExpired);
      socket.off('security-event', handleSecurityEvent);
      socket.off('user-typing', handleUserTyping);
      socket.off('session-ending', handleSessionEnding);
      socket.off('session-destroyed', handleSessionDestroyed);
    };
  }, []);

  // Actions
  const handleCreateSession = async (username) => {
    setIsLoading(true);
    let keyData = identityKeyPairRef.current;
    if (!keyData) {
      keyData = await generateIdentityKeyPair();
      setIdentityKeyPair(keyData);
      identityKeyPairRef.current = keyData;
    }

    const socket = getSocket();
    socket.emit('create-session', {
      username,
      publicKey: keyData.publicKeyString,
      fingerprint: keyData.fingerprint,
    });
  };

  const handleJoinSession = async (sessionId, passkey, username) => {
    setIsLoading(true);
    setJoinErrorMessage(null);

    let keyData = identityKeyPairRef.current;
    if (!keyData) {
      keyData = await generateIdentityKeyPair();
      setIdentityKeyPair(keyData);
      identityKeyPairRef.current = keyData;
    }

    const socket = getSocket();
    socket.emit('join-session', {
      sessionId,
      passkey,
      username,
      publicKey: keyData.publicKeyString,
      fingerprint: keyData.fingerprint,
    });
  };

  const handleRotateKeys = async () => {
    if (!activeSession || isRotatingKeys) return;
    setIsRotatingKeys(true);
    try {
      const newKeyData = await generateIdentityKeyPair();
      setIdentityKeyPair(newKeyData);
      identityKeyPairRef.current = newKeyData;

      const selfKey = await deriveSharedWrappingKey(
        newKeyData.keyPair.privateKey,
        newKeyData.keyPair.publicKey
      );
      setSelfWrappingKey(selfKey);

      await computeDerivedKeys(activeSession.participants, newKeyData);

      const socket = getSocket();
      socket.emit('rotate-keys', {
        sessionId: activeSession.sessionId,
        participantId: activeSession.participantId,
        publicKey: newKeyData.publicKeyString,
        fingerprint: newKeyData.fingerprint,
      });
    } catch (err) {
      console.error('Failed to rotate cryptographic keypair:', err);
    } finally {
      setIsRotatingKeys(false);
    }
  };

  const handleSendMessage = (text, fileData = null) => {
    if (!activeSession) return;
    const socket = getSocket();

    if (fileData) {
      // Direct local state update for sender for instant display with direct key
      setMessages((prev) => [
        ...prev,
        {
          messageId: `msg-${Date.now()}`,
          senderId: activeSession.participantId,
          senderName: activeSession.username,
          isOwner: activeSession.isOwner,
          timestamp: Date.now(),
          ...fileData,
        },
      ]);
    } else {
      socket.emit('send-message', {
        sessionId: activeSession.sessionId,
        participantId: activeSession.participantId,
        text,
        type: 'text',
      });
    }
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
    setActiveSessionAndRef(null);
    setMessages([]);
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
    setActiveSessionAndRef(null);
    setEndingData(null);
    setMessages([]);
    setTypingUsers([]);
    setJoinErrorMessage(null);
    setUiState('HOME');
  };

  const handleDeleteFileFromState = (fileId) => {
    setMessages((prev) => prev.filter((m) => m.fileId !== fileId));
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
            onDeleteFile={handleDeleteFileFromState}
            identityKeyPair={identityKeyPair}
            derivedSharedKeys={derivedSharedKeys}
            selfWrappingKey={selfWrappingKey}
            securityLogs={securityLogs}
            onRotateKeys={handleRotateKeys}
            isRotatingKeys={isRotatingKeys}
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