import React, { useState, useEffect } from 'react';
import { MessagesAuthScreen } from './MessagesAuthScreen';
import { MessagesDashboard } from './MessagesDashboard';

export const NotificationsView = ({ onBackToHome }) => {
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const [channelEnabled, setChannelEnabled] = useState(true);
  const [sessionChecking, setSessionChecking] = useState(true);

  // Check active server session on mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/notifications/auth/session');
        const data = await res.json();
        if (data.success && data.authenticated && data.email) {
          setSessionEmail(data.email);
          setChannelEnabled(Boolean(data.channelEnabled));
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      } finally {
        setSessionChecking(false);
      }
    };
    verifySession();
  }, []);

  const handleAuthenticated = ({ email, token, channelEnabled: enabled }) => {
    setSessionEmail(email);
    if (token) setSessionToken(token);
    setChannelEnabled(Boolean(enabled));
  };

  const handleSignOut = async () => {
    try {
      const headers = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
      await fetch('/api/notifications/auth/logout', {
        method: 'POST',
        headers,
      });
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setSessionToken(null);
      setSessionEmail('');
    }
  };

  const handleAccountDeleted = () => {
    setSessionToken(null);
    setSessionEmail('');
  };

  if (sessionChecking) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-3">
        <div className="w-8 h-8 mx-auto border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#54656f]">Loading Messages...</p>
      </div>
    );
  }

  // If user has active authenticated session, show single Messages Dashboard
  if (sessionEmail) {
    return (
      <MessagesDashboard
        sessionEmail={sessionEmail}
        sessionToken={sessionToken}
        channelEnabled={channelEnabled}
        onBackToHome={onBackToHome}
        onSignOut={handleSignOut}
        onAccountDeleted={handleAccountDeleted}
      />
    );
  }

  // Otherwise, show the clean first-time / continue authentication screen
  return (
    <MessagesAuthScreen
      onAuthenticated={handleAuthenticated}
      onBackToHome={onBackToHome}
    />
  );
};

export const MessagesView = NotificationsView;
