import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Send,
  Settings as SettingsIcon,
  RefreshCw,
  Trash2,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NewMessageModal } from './NewMessageModal';
import { SettingsModal } from './SettingsModal';
import { ViewOnceModal } from './ViewOnceModal';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export const MessagesDashboard = ({
  sessionEmail,
  sessionToken,
  channelEnabled: initialChannelEnabled,
  onBackToHome,
  onSignOut,
  onAccountDeleted,
}) => {
  const [messages, setMessages] = useState([]);
  const [channelEnabled, setChannelEnabled] = useState(initialChannelEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Modals state
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewOnceActiveMessage, setViewOnceActiveMessage] = useState(null);

  // Expanded regular message content
  const [expandedMsgId, setExpandedMsgId] = useState(null);

  // Fetch messages
  const fetchInbox = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setErrorMessage(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch('/api/notifications/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: sessionEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load inbox.');
      }

      setMessages(data.messages || []);
      if (typeof data.channelEnabled === 'boolean') {
        setChannelEnabled(data.channelEnabled);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      if (!quiet) setIsLoading(false);
    }
  }, [sessionEmail, sessionToken]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Delete message
  const handleDeleteMessage = async (messageId, e) => {
    if (e) e.stopPropagation();
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/notifications/messages/${messageId}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ email: sessionEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete message.');
      }

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setSuccessMessage('Message deleted.');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleMessageConsumed = (messageId) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-8 px-4 space-y-6">
      {/* Top App Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#e9edef] shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="p-2 rounded-xl text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] transition-colors cursor-pointer flex items-center gap-1.5"
            title="Back to Plutus"
          >
            <ArrowLeft className="w-4 h-4 text-[#00a884]" />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Plutus</span>
          </button>
          <div className="h-5 w-px bg-[#e9edef] hidden sm:block" />
          <div>
            <h1 className="text-lg font-bold text-[#111b21] leading-tight">Messages</h1>
            <p className="text-xs font-mono text-[#54656f]">{sessionEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Button */}
          <button
            id="messages_settings_button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
            title="Settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Primary Action: + New Message */}
      <motion.button
        id="messages_new_message_button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setIsNewMessageOpen(true)}
        className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white p-5 rounded-2xl shadow-sm transition-all flex items-center justify-between text-left cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-bold flex items-center gap-2">
              <span>+ New Message</span>
            </div>
            <p className="text-xs text-white/85">
              Send an encrypted or self-destructing message to an email identity.
            </p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
          <ChevronRight className="w-5 h-5 text-white" />
        </div>
      </motion.button>

      {/* Alerts */}
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

      {/* Privacy Notice Banner if Messages Disabled */}
      {channelEnabled === false && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>Incoming messages are currently paused in your Privacy settings.</span>
          </div>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-[#008069] hover:underline font-bold shrink-0 cursor-pointer"
          >
            Settings
          </button>
        </div>
      )}

      {/* Inbox Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e9edef] shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#111b21]">Inbox</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#f0f2f5] text-[#54656f]">
              {messages.length}
            </span>
          </div>

          <button
            onClick={() => fetchInbox()}
            disabled={isLoading}
            className="p-1.5 text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
            title="Refresh Inbox"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00a884]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && messages.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#54656f]">Checking for new messages...</p>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State */
          <div className="py-12 sm:py-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#f0f2f5] text-[#54656f] flex items-center justify-center mx-auto">
              <Mail className="w-7 h-7 text-[#54656f]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#111b21]">Your inbox is empty</h3>
              <p className="text-xs text-[#54656f] max-w-xs mx-auto">
                Messages sent to your registered email will appear here.
              </p>
            </div>
            <div className="pt-2">
              <button
                id="empty_inbox_send_button"
                onClick={() => setIsNewMessageOpen(true)}
                className="py-2.5 px-5 bg-[#111b21] hover:bg-[#2a3942] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
              >
                <Send className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Send a Message</span>
              </button>
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="space-y-3">
            {messages.map((msg) => {
              const isViewOnce = Boolean(msg.viewOnce);
              const isExpanded = expandedMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isViewOnce
                      ? 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                      : 'bg-[#f0f2f5]/60 hover:bg-[#f0f2f5] border-[#e9edef]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Sender and timestamp */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-[#111b21] truncate max-w-[220px]">
                          From: {msg.senderEmail}
                        </span>
                        <span className="text-[11px] text-[#54656f] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#54656f]" />
                          {formatTimeAgo(msg.createdAt)}
                        </span>
                      </div>

                      {/* Content representation */}
                      {isViewOnce ? (
                        <div className="flex items-center gap-2 py-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100/80 text-amber-900 text-xs font-bold border border-amber-200">
                            <span>🔐</span>
                            <span>View once</span>
                          </span>
                          <span className="text-[11px] text-[#54656f]">
                            Permanently deleted when opened.
                          </span>
                        </div>
                      ) : (
                        <div
                          onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}
                          className="text-xs text-[#111b21] leading-relaxed cursor-pointer"
                        >
                          <p className={isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}>
                            {msg.content}
                          </p>
                          {msg.content && msg.content.length > 120 && (
                            <button
                              type="button"
                              className="text-[11px] text-[#00a884] font-semibold hover:underline mt-1 cursor-pointer"
                            >
                              {isExpanded ? 'Show less' : 'Read more'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {isViewOnce ? (
                        <button
                          id={`open_view_once_${msg.id}`}
                          onClick={() => setViewOnceActiveMessage(msg)}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                        >
                          Open
                        </button>
                      ) : (
                        <button
                          id={`delete_message_${msg.id}`}
                          onClick={(e) => handleDeleteMessage(msg.id, e)}
                          className="p-2 text-[#54656f] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Message Modal */}
      <NewMessageModal
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
        sessionEmail={sessionEmail}
        sessionToken={sessionToken}
        onMessageSent={() => fetchInbox(true)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sessionEmail={sessionEmail}
        sessionToken={sessionToken}
        channelEnabled={channelEnabled}
        onChannelToggle={(enabled) => setChannelEnabled(enabled)}
        onSignOut={onSignOut}
        onAccountDeleted={onAccountDeleted}
      />

      {/* View Once Modal */}
      <ViewOnceModal
        isOpen={Boolean(viewOnceActiveMessage)}
        onClose={() => setViewOnceActiveMessage(null)}
        messageMeta={viewOnceActiveMessage}
        userEmail={sessionEmail}
        sessionToken={sessionToken}
        onMessageConsumed={handleMessageConsumed}
      />
    </div>
  );
};
