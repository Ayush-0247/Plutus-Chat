import React, { useState } from 'react';
import { ArrowLeft, Send, AlertCircle, CheckCircle2, Lock, X } from 'lucide-react';
import { motion } from 'motion/react';

export const NewMessageModal = ({
  isOpen,
  onClose,
  sessionEmail,
  sessionToken,
  onMessageSent,
}) => {
  const [receiverEmail, setReceiverEmail] = useState('');
  const [content, setContent] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedReceiver = receiverEmail.trim().toLowerCase();
    if (!trimmedReceiver) {
      setErrorMessage('Please enter a recipient email address.');
      return;
    }

    if (!content.trim()) {
      setErrorMessage('Message content cannot be empty.');
      return;
    }

    if (content.length > 5000) {
      setErrorMessage('Message exceeds 5000 character limit.');
      return;
    }

    setIsLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderEmail: sessionEmail,
          receiverEmail: trimmedReceiver,
          content: content.trim(),
          viewOnce,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message.');
      }

      setSuccessMessage(
        viewOnce
          ? 'View-Once message delivered! It will self-destruct when opened.'
          : 'Message delivered to recipient.'
      );
      setContent('');
      setReceiverEmail('');
      setViewOnce(false);

      if (onMessageSent) {
        onMessageSent();
      }

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 border border-[#e9edef] shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#00a884]" />
            </button>
            <div>
              <h3 className="text-base font-bold text-[#111b21]">New Message</h3>
              <p className="text-xs text-[#54656f]">
                Signed in as <span className="font-mono text-[#111b21] font-semibold">{sessionEmail}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#54656f] hover:bg-[#f0f2f5] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
            className="p-3.5 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSend} className="space-y-4">
          {/* To */}
          <div>
            <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5">
              To
            </label>
            <input
              id="new_message_receiver_input"
              type="email"
              placeholder="receiver@example.com"
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
              required
            />
          </div>

          {/* Message Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#111b21] uppercase tracking-wider">
                Message
              </label>
              <span className="text-[11px] font-mono text-[#54656f]">
                {content.length} / 5000
              </span>
            </div>
            <textarea
              id="new_message_content_input"
              rows={5}
              placeholder="Write your message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all resize-y"
              required
            />
          </div>

          {/* View Once Toggle */}
          <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🔐</span>
              <div>
                <span className="text-xs font-bold text-[#111b21] block">View once</span>
                <span className="text-[11px] text-[#54656f]">
                  Permanently deleted from server once opened.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="new_message_view_once_toggle"
                type="checkbox"
                checked={viewOnce}
                onChange={(e) => setViewOnce(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
            </label>
          </div>

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#54656f] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="new_message_send_button"
              type="submit"
              disabled={isLoading}
              className="py-2.5 px-6 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>{isLoading ? 'SENDING...' : 'SEND MESSAGE'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
