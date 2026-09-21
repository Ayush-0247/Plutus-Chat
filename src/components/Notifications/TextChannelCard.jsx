import React, { useState, useEffect } from 'react';
import { Radio, ShieldAlert, ShieldCheck, Mail, Key, CheckCircle2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export const TextChannelCard = ({
  sessionToken = null,
  sessionEmail = '',
  channelStatus: propChannelStatus = null,
  onChannelStatusChange,
  onRequireAuth,
}) => {
  const [email, setEmail] = useState(sessionEmail);
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);

  const [channelStatus, setChannelStatus] = useState(propChannelStatus); // true | false | null
  const [hasChecked, setHasChecked] = useState(sessionEmail && propChannelStatus !== null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (sessionEmail) {
      setEmail(sessionEmail);
      if (propChannelStatus !== null) {
        setChannelStatus(propChannelStatus);
        setHasChecked(true);
      }
    }
  }, [sessionEmail, propChannelStatus]);

  // Check channel status
  const handleCheckStatus = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const activeEmail = sessionEmail || email.trim();
    if (!activeEmail) {
      setErrorMessage('Please enter your registered email.');
      return;
    }
    if (!sessionToken && !passkey) {
      setErrorMessage('Please enter your passkey or sign in to establish a session.');
      return;
    }

    setIsLoading(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch('/api/notifications/channel/status', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: activeEmail,
          ...(passkey ? { passkey: passkey.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to authenticate channel status.');
      }

      setChannelStatus(data.channelEnabled);
      setHasChecked(true);
      if (onChannelStatusChange) onChannelStatusChange(data.channelEnabled);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle channel status (Enable or Disable)
  const handleToggleChannel = async (targetEnabled) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    const activeEmail = sessionEmail || email.trim();
    const endpoint = targetEnabled ? '/api/notifications/channel/create' : '/api/notifications/channel/disable';

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: activeEmail,
          ...(passkey ? { passkey: passkey.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update text channel.');
      }

      setChannelStatus(data.channelEnabled);
      setHasChecked(true);
      setSuccessMessage(data.message);
      if (onChannelStatusChange) onChannelStatusChange(data.channelEnabled);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#f0f2f5]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00a884] text-white flex items-center justify-center shadow-2xs">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#111b21]">Text Channel Privacy Gate</h2>
            <p className="text-xs text-[#54656f]">
              Control whether other registered users can deliver messages to your inbox.
            </p>
          </div>
        </div>

        {hasChecked && (
          <button
            onClick={() => handleCheckStatus()}
            disabled={isLoading}
            className="p-2 text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
            title="Check status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00a884]' : ''}`} />
          </button>
        )}
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
          className="p-3 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {/* When session is active */}
      {sessionEmail ? (
        <div className="p-4 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00a884]" />
            <span className="text-[#54656f]">Operating on active identity:</span>
            <strong className="font-mono text-[#111b21]">{sessionEmail}</strong>
          </div>
          <span className="text-[11px] text-[#54656f]">Authenticated via Session Token</span>
        </div>
      ) : (
        /* Auth credentials form if not in an active session */
        <form onSubmit={handleCheckStatus} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#54656f]" />
                <span>Registered Email</span>
              </label>
              <input
                id="channel_email_input"
                type="email"
                placeholder="user@example.com"
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
                  <span>Passkey</span>
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
                id="channel_passkey_input"
                type={showPasskey ? 'text' : 'password'}
                placeholder="••••••••"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                required
              />
            </div>
          </div>

          {!hasChecked && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                id="check_channel_status_button"
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-[#111b21] hover:bg-[#2a3942] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
              >
                <Radio className="w-4 h-4 text-[#00a884]" />
                <span>{isLoading ? 'AUTHENTICATING...' : 'CHECK CHANNEL STATUS'}</span>
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
          )}
        </form>
      )}

      {/* Channel State Box */}
      {hasChecked && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-2xl border transition-all ${
            channelStatus
              ? 'bg-[#e7f7f3] border-[#00a884]/30 text-[#111b21]'
              : 'bg-[#f0f2f5] border-[#e9edef] text-[#111b21]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    channelStatus ? 'bg-[#00a884] animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span className="text-sm font-bold uppercase tracking-wide">
                  {channelStatus ? 'Text Channel Active' : 'Text Channel Disabled'}
                </span>
              </div>
              <p className="text-xs text-[#54656f] leading-relaxed max-w-md">
                {channelStatus
                  ? 'Your registered email is active. Other registered users can deliver notification messages to you.'
                  : 'Your email is registered, but you are currently not accepting notifications. Senders will be rejected.'}
              </p>
              <div className="pt-1 text-[11px] font-mono text-[#54656f]">
                Account: <span className="font-semibold text-[#111b21]">{sessionEmail || email}</span>
              </div>
            </div>

            {/* Action toggle button */}
            <div className="shrink-0">
              {channelStatus ? (
                <button
                  id="disable_text_channel_button"
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleToggleChannel(false)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  {isLoading ? 'UPDATING...' : 'DISABLE TEXT CHANNEL'}
                </button>
              ) : (
                <button
                  id="enable_text_channel_button"
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleToggleChannel(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  {isLoading ? 'UPDATING...' : 'ENABLE TEXT CHANNEL'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

