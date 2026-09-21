import React, { useState } from 'react';
import { Mail, Key, ArrowRight, Shield, AlertCircle, CheckCircle2, ArrowLeft, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export const MessagesAuthScreen = ({
  onAuthenticated,
  onBackToHome,
}) => {
  const [email, setEmail] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);

  // 'continue' (smart auto-detect) | 'login' | 'register'
  const [authMode, setAuthMode] = useState('continue');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normEmail = email.trim().toLowerCase();
    if (!normEmail || !normEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!passkey || passkey.trim().length < 4) {
      setErrorMessage('Passkey must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      let endpoint = '/api/notifications/auth/continue';
      let payload = {
        email: normEmail,
        passkey: passkey.trim(),
        allowMessages,
      };

      if (authMode === 'login') {
        endpoint = '/api/notifications/auth/login';
        payload = { email: normEmail, passkey: passkey.trim() };
      } else if (authMode === 'register') {
        endpoint = '/api/notifications/register';
        payload = { email: normEmail, passkey: passkey.trim() };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      // If user did explicit registration, auto-login or enable channel
      if (authMode === 'register') {
        // Log in immediately to establish session
        const loginRes = await fetch('/api/notifications/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normEmail, passkey: passkey.trim() }),
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.success) {
          if (allowMessages) {
            await fetch('/api/notifications/channel/create', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${loginData.token}`,
              },
              body: JSON.stringify({ email: normEmail }),
            });
          }
          onAuthenticated({
            email: normEmail,
            token: loginData.token,
            channelEnabled: allowMessages,
          });
          return;
        }
      }

      setSuccessMessage(data.message || 'Authenticated successfully.');
      onAuthenticated({
        email: normEmail,
        token: data.token,
        channelEnabled: data.channelEnabled ?? allowMessages,
      });
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e9edef] shadow-sm space-y-6"
      >
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#54656f] hover:text-[#111b21] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#00a884]" />
            <span>Back to Plutus</span>
          </button>

          <span className="text-[11px] font-bold text-[#008069] bg-[#e7f7f3] px-2.5 py-0.5 rounded-full border border-[#00a884]/20">
            PRIVATE MESSAGES
          </span>
        </div>

        {/* Title & Introduction */}
        <div className="space-y-1.5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#00a884] text-white flex items-center justify-center mx-auto shadow-sm">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#111b21]">Private Messages</h2>
          <p className="text-xs text-[#54656f] leading-relaxed max-w-xs mx-auto">
            Send and receive private, end-to-end messages using your registered email.
          </p>
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

        {/* Unified Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <input
                id="messages_auth_email_input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                required
              />
            </div>
          </div>

          {/* Passkey */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[#111b21] uppercase tracking-wider">
                Passkey
              </label>
              <button
                type="button"
                onClick={() => setShowPasskey(!showPasskey)}
                className="text-[11px] text-[#00a884] hover:underline font-semibold cursor-pointer"
              >
                {showPasskey ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="messages_auth_passkey_input"
              type={showPasskey ? 'text' : 'password'}
              placeholder="••••••••"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
              required
            />
            <p className="text-[11px] text-[#54656f] mt-1">
              Minimum 4 characters. Stored securely via bcrypt.
            </p>
          </div>

          {/* Allow Messages Checkbox / Toggle */}
          <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#111b21] block">
                Allow incoming messages
              </span>
              <span className="text-[11px] text-[#54656f]">
                Permit registered contacts to reach your inbox.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="messages_auth_allow_messages"
                type="checkbox"
                checked={allowMessages}
                onChange={(e) => setAllowMessages(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
            </label>
          </div>

          {/* Submit Button */}
          <button
            id="messages_auth_continue_button"
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
          >
            <span>
              {isLoading
                ? 'AUTHENTICATING...'
                : authMode === 'register'
                ? 'CREATE ACCOUNT & ENTER'
                : authMode === 'login'
                ? 'SIGN IN'
                : 'CONTINUE'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer Alternative Links */}
        <div className="pt-2 text-center text-xs text-[#54656f] border-t border-[#f0f2f5] space-y-1.5">
          {authMode === 'continue' ? (
            <p>
              New here or have an account?{' '}
              <span className="text-[#111b21] font-semibold">
                Continue automatically handles both.
              </span>
            </p>
          ) : authMode === 'register' ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-[#00a884] hover:underline font-bold cursor-pointer"
              >
                Sign in here
              </button>
            </p>
          ) : (
            <p>
              Need a fresh account?{' '}
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className="text-[#00a884] hover:underline font-bold cursor-pointer"
              >
                Create an account
              </button>
            </p>
          )}

          {authMode !== 'continue' && (
            <div>
              <button
                type="button"
                onClick={() => setAuthMode('continue')}
                className="text-[11px] text-[#54656f] hover:text-[#111b21] underline cursor-pointer"
              >
                Return to quick Continue flow
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
