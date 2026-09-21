import React, { useState, useEffect } from 'react';
import { Send, EyeOff, AlertCircle, CheckCircle2, Lock, Mail, Key, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export const SendMessageCard = ({
  defaultSenderEmail = '',
  defaultPasskey = '',
  sessionToken = null,
  sessionEmail = '',
  onRequireAuth,
}) => {
  const [senderEmail, setSenderEmail] = useState(sessionEmail || defaultSenderEmail);
  const [passkey, setPasskey] = useState(defaultPasskey);
  const [receiverEmail, setReceiverEmail] = useState('');
  const [content, setContent] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (sessionEmail) {
      setSenderEmail(sessionEmail);
    } else if (defaultSenderEmail && !senderEmail) {
      setSenderEmail(defaultSenderEmail);
    }
    if (defaultPasskey && !passkey) {
      setPasskey(defaultPasskey);
    }
  }, [sessionEmail, defaultSenderEmail, defaultPasskey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const activeSender = sessionEmail || senderEmail.trim();

    if (!activeSender) {
      setErrorMessage('Please enter your registered email.');
      return;
    }
    if (!sessionToken && !passkey) {
      setErrorMessage('Please enter your sender passkey or sign in to establish a session.');
      return;
    }
    if (!receiverEmail.trim()) {
      setErrorMessage('Please enter the recipient email address.');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('Message cannot be empty.');
      return;
    }
    if (content.length > 5000) {
      setErrorMessage('Message exceeds the maximum allowed length of 5000 characters.');
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
          senderEmail: activeSender,
          ...(passkey ? { passkey: passkey.trim() } : {}),
          receiverEmail: receiverEmail.trim(),
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
          ? 'View-Once message dispatched! The recipient can open it exactly once before automatic self-destruction.'
          : 'Message delivered to recipient text channel.'
      );
      setContent('');
      setViewOnce(false);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-[#f0f2f5]">
        <div className="w-10 h-10 rounded-xl bg-[#00a884] text-white flex items-center justify-center shadow-2xs">
          <Send className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#111b21]">Send Private Message</h2>
          <p className="text-xs text-[#54656f]">
            {sessionEmail
              ? `Sending as verified identity ${sessionEmail}`
              : 'Authenticate with your registered email and passkey to send a notification.'}
          </p>
        </div>
      </div>

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
          className="p-3.5 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Active Session Identity Banner or Sender Credentials Form */}
        {sessionEmail ? (
          <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00a884]" />
              <span className="text-[#54656f]">Sender:</span>
              <strong className="font-mono text-[#111b21]">{sessionEmail}</strong>
            </div>
            <span className="text-[11px] text-[#00a884] font-medium">Session Authenticated</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#54656f]" />
                  <span>Your Registered Email</span>
                </label>
                <input
                  id="sender_email_input"
                  type="email"
                  placeholder="sender@example.com"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
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
                  id="sender_passkey_input"
                  type={showPasskey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                  required
                />
              </div>
            </div>

            {onRequireAuth && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="text-xs text-[#00a884] hover:underline font-semibold flex items-center gap-1"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Already registered? Sign in to send without entering passkeys</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recipient Email */}
        <div>
          <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#00a884]" />
            <span>Receiver Email</span>
          </label>
          <input
            id="receiver_email_input"
            type="email"
            placeholder="receiver@example.com"
            value={receiverEmail}
            onChange={(e) => setReceiverEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
            required
          />
          <p className="text-[11px] text-[#54656f] mt-1">
            Recipient must have a registered account and an enabled Text Channel.
          </p>
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-[#111b21] uppercase tracking-wider">
              Message Content
            </label>
            <span className="text-[11px] font-mono text-[#54656f]">
              {content.length} / 5000
            </span>
          </div>
          <textarea
            id="message_content_input"
            rows={4}
            placeholder="Type your private message here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={5000}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all resize-y"
            required
          />
        </div>

        {/* View Once Option */}
        <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex items-start gap-3">
          <input
            id="view_once_checkbox"
            type="checkbox"
            checked={viewOnce}
            onChange={(e) => setViewOnce(e.target.checked)}
            className="mt-1 w-4 h-4 text-[#00a884] rounded border-[#cbd5e1] focus:ring-[#00a884] cursor-pointer"
          />
          <label htmlFor="view_once_checkbox" className="text-xs cursor-pointer select-none">
            <span className="font-bold text-[#111b21] flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-amber-600" />
              <span>View Once (Self-Destructs Automatically)</span>
            </span>
            <span className="text-[#54656f] block mt-0.5 leading-relaxed">
              When enabled, the message can only be opened once. As soon as the recipient opens it, the backend immediately purges it permanently from server memory.
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          id="send_notification_submit_button"
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
        >
          <Send className="w-4 h-4" />
          <span>{isLoading ? 'VERIFYING & SENDING...' : 'SEND MESSAGE'}</span>
        </button>
      </form>
    </div>
  );
};
