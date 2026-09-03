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
  playMessageReceivedSound,
  playUserJoinedSound,
  playUserLeftSound,
} from './services/soundEffects.js';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [uiState, setUiState] = useState('HOME');
  const [activeSession, setActiveSession] = useState(null);
  // Keep ref in sync so socket handlers (stale closures) can read current value
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
  const activeSessionRef = useRef(null); // always-current ref for use inside socket handlers

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
      setMessages([
        // {
        //   messageId: 'sys-start',
        //   senderId: 'SYSTEM',
        //   senderName: 'SYSTEM',
        //   isOwner: false,
        //   // text: `Secure ephemeral line [${data.sessionId}] initialized in Node.js RAM. You are the OWNER.`,
        //   timestamp: Date.now(),
        //   isSystem: true,
        // },
      ]);
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
      socket.off('session-ending', handleSessionEnding);
      socket.off('session-destroyed', handleSessionDestroyed);
    };
  }, [activeSession]);

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
