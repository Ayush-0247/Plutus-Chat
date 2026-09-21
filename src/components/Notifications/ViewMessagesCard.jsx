import React, { useState, useEffect } from 'react';
import {
  Inbox,
  RefreshCw,
  Trash2,
  Lock,
  Mail,
  Key,
  AlertCircle,
  EyeOff,
  Clock,
  CheckCircle2,
  Flame,
  LogIn,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewOnceModal } from './ViewOnceModal.jsx';

export const ViewMessagesCard = ({
  defaultEmail = '',
  defaultPasskey = '',
  sessionToken = null,
  sessionEmail = '',
  onRequireAuth,
}) => {
  const [email, setEmail] = useState(sessionEmail || defaultEmail);
  const [passkey, setPasskey] = useState(defaultPasskey);
  const [showPasskey, setShowPasskey] = useState(false);

  const [messages, setMessages] = useState([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Active view-once message modal
  const [viewOnceModalMeta, setViewOnceModalMeta] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (sessionEmail) {
      setEmail(sessionEmail);
      fetchMessages(null, sessionEmail);
    } else {
      if (defaultEmail && !email) setEmail(defaultEmail);
      if (defaultPasskey && !passkey) setPasskey(defaultPasskey);
    }
  }, [sessionEmail, sessionToken, defaultEmail, defaultPasskey]);

  const fetchMessages = async (e, overrideEmail) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const activeEmail = overrideEmail || sessionEmail || email.trim();
    if (!activeEmail) {
      setErrorMessage('Please enter your email to view messages.');
      return;
    }
    if (!sessionToken && !passkey) {
      setErrorMessage('Please enter your passkey or sign in.');
      return;
    }

    setIsLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch('/api/notifications/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: activeEmail,
          ...(passkey ? { passkey: passkey.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch messages.');
      }

      setMessages(data.messages || []);
      setHasFetched(true);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message permanently?')) return;

    setDeletingId(messageId);
    try {
      const activeEmail = sessionEmail || email.trim();
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/notifications/messages/${messageId}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          email: activeEmail,
          ...(passkey ? { passkey: passkey.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete message.');
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setSuccessMessage('Message deleted.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleMessageConsumed = (messageId) => {
    // Remove the consumed view-once message from the list
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const formatDate = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#f0f2f5]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#111b21] text-white flex items-center justify-center shadow-2xs">
            <Inbox className="w-5 h-5 text-[#00a884]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#111b21]">Received Messages</h2>
            <p className="text-xs text-[#54656f]">
              Authenticate with your email & passkey to inspect private notifications.
            </p>
          </div>
        </div>

        {hasFetched && (
          <button
            onClick={() => fetchMessages()}
            disabled={isLoading}
            className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
            title="Refresh inbox"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00a884]' : ''}`} />
          </button>
        )}
      </div>

      {/* Status Alerts */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {/* Active identity pill or receiver credentials form */}
      {sessionEmail ? (
        <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00a884]" />
            <span className="text-[#54656f]">Viewing inbox for:</span>
            <strong className="font-mono text-[#111b21]">{sessionEmail}</strong>
          </div>
          <button
            type="button"
            onClick={() => fetchMessages()}
            disabled={isLoading}
            className="px-3 py-1.5 bg-[#111b21] hover:bg-[#2a3942] disabled:opacity-50 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'REFRESHING...' : 'REFRESH INBOX'}</span>
          </button>
        </div>
      ) : (
        <form onSubmit={fetchMessages} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#54656f]" />
                <span>Your Email</span>
              </label>
              <input
                id="view_messages_email_input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#111b21] uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#54656f]" />
                  <span>Your Passkey</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasskey(!showPasskey)}
                  className="text-[11px] text-[#00a884] hover:underline font-semibold"
                >
                  {showPasskey ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="view_messages_passkey_input"
                type={showPasskey ? 'text' : 'password'}
                placeholder="••••••••"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              id="fetch_messages_button"
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 bg-[#111b21] hover:bg-[#2a3942] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
            >
              <Inbox className="w-4 h-4 text-[#00a884]" />
              <span>{isLoading ? 'AUTHENTICATING...' : hasFetched ? 'REFRESH MESSAGES' : 'VIEW MESSAGES'}</span>
            </button>
            {onRequireAuth && (
              <button
                type="button"
                onClick={onRequireAuth}
                className="py-2.5 px-4 bg-white border border-[#e9edef] hover:bg-[#f5f6f8] text-[#111b21] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <LogIn className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Sign In Instead</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Messages List Display */}
      {hasFetched && (
        <div className="pt-2 border-t border-[#f0f2f5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#111b21] uppercase tracking-wider">
              Inbox ({messages.length})
            </span>
            <span className="text-[11px] text-[#54656f]">
              {messages.length === 0 ? 'No notifications' : 'Sorted by latest'}
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="py-8 text-center rounded-xl bg-[#f0f2f5] border border-dashed border-[#cbd5e1] space-y-1">
              <p className="text-xs font-bold text-[#111b21]">No notifications found</p>
              <p className="text-[11px] text-[#54656f]">
                Ensure your Text Channel is active so other users can send you messages.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border transition-all ${
                    msg.viewOnce
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-[#f0f2f5] border-[#e9edef]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#111b21] font-mono">
                          From: {msg.senderEmail}
                        </span>
                        {msg.viewOnce && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                            <Flame className="w-3 h-3 text-amber-600" />
                            <span>View Once</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#54656f] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(msg.createdAt)}</span>
                      </span>
                    </div>

                    {!msg.viewOnce && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        disabled={deletingId === msg.id}
                        className="p-1.5 text-[#54656f] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  {msg.viewOnce ? (
                    <div className="mt-3 pt-2 border-t border-amber-200/60 flex items-center justify-between">
                      <p className="text-xs text-amber-800 font-medium">
                        Self-destructing message. Will be deleted immediately upon opening.
                      </p>
                      <button
                        onClick={() => setViewOnceModalMeta(msg)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Open Once</span>
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-[#111b21] whitespace-pre-wrap break-words leading-relaxed font-sans bg-white p-3 rounded-lg border border-[#e9edef]">
                      {msg.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for View Once Message */}
      {viewOnceModalMeta && (
        <ViewOnceModal
          isOpen={Boolean(viewOnceModalMeta)}
          onClose={() => setViewOnceModalMeta(null)}
          messageMeta={viewOnceModalMeta}
          userEmail={sessionEmail || email}
          userPasskey={passkey}
          sessionToken={sessionToken}
          onMessageConsumed={handleMessageConsumed}
        />
      )}
    </div>
  );
};
