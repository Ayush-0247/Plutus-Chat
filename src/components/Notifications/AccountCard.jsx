import React, { useState } from 'react';
import {
  UserCheck,
  UserX,
  Mail,
  Key,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Lock,
  Trash2,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AccountCard = ({
  sessionEmail = '',
  sessionToken = null,
  onLoginSuccess,
  onLogout,
  onAccountRegistered,
  onAccountDeleted,
}) => {
  const [activeTab, setActiveTab] = useState(sessionEmail ? 'DELETE' : 'LOGIN'); // 'LOGIN' | 'REGISTER' | 'DELETE'

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPasskey, setLoginPasskey] = useState('');
  const [showLoginPasskey, setShowLoginPasskey] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [loginSuccess, setLoginSuccess] = useState(null);

  // Register state
  const [regEmail, setRegEmail] = useState('');
  const [regPasskey, setRegPasskey] = useState('');
  const [regConfirmPasskey, setRegConfirmPasskey] = useState('');
  const [showRegPasskey, setShowRegPasskey] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);

  // Delete state
  const [delEmail, setDelEmail] = useState(sessionEmail);
  const [delPasskey, setDelPasskey] = useState('');
  const [showDelPasskey, setShowDelPasskey] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [delError, setDelError] = useState(null);
  const [delSuccess, setDelSuccess] = useState(null);

  // Synchronize delete form if session email changes
  React.useEffect(() => {
    if (sessionEmail && !delEmail) setDelEmail(sessionEmail);
  }, [sessionEmail]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSuccess(null);

    const emailTrimmed = loginEmail.trim().toLowerCase();
    if (!emailTrimmed || !loginPasskey) {
      setLoginError('Please enter both email and passkey.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch('/api/notifications/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed, passkey: loginPasskey.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed.');
      }

      setLoginSuccess('Authentication successful! Active session established.');
      if (onLoginSuccess) {
        onLoginSuccess({
          email: data.email,
          token: data.token,
          channelEnabled: data.channelEnabled,
        });
      }
      setLoginPasskey('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    const emailTrimmed = regEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setRegError('Email address is required.');
      return;
    }
    if (!regPasskey) {
      setRegError('Passkey is required.');
      return;
    }
    if (regPasskey.length < 4) {
      setRegError('Passkey must be at least 4 characters long.');
      return;
    }
    if (regPasskey !== regConfirmPasskey) {
      setRegError('Passkey and confirmation do not match.');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch('/api/notifications/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed, passkey: regPasskey }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      setRegSuccess('Account registered successfully! Logging in...');
      if (onAccountRegistered) {
        onAccountRegistered({ email: emailTrimmed, passkey: regPasskey });
      }
      setRegEmail('');
      setRegPasskey('');
      setRegConfirmPasskey('');
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleInitiateDelete = (e) => {
    e.preventDefault();
    setDelError(null);
    setDelSuccess(null);

    if (!delEmail.trim() || !delPasskey) {
      setDelError('Please enter your email and passkey to verify deletion.');
      return;
    }
    setShowConfirmModal(true);
  };

  // Execute Permanent Account Deletion (PRD Addendum #19 & #40)
  const handleConfirmPermanentDelete = async () => {
    setDelLoading(true);
    setDelError(null);

    try {
      const res = await fetch('/api/notifications/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ email: delEmail.trim(), passkey: delPasskey.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Account deletion failed.');
      }

      setShowConfirmModal(false);
      setDelSuccess(
        'Account and all associated messages, channels, and records have been permanently erased.'
      );
      if (onAccountDeleted) onAccountDeleted(delEmail.trim());
      setDelPasskey('');
    } catch (err) {
      setShowConfirmModal(false);
      setDelError(err.message);
    } finally {
      setDelLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f0f2f5]">
        <div>
          <h2 className="text-lg font-bold text-[#111b21]">Identity & Credentials</h2>
          <p className="text-xs text-[#54656f]">
            Authenticate your session, register a new identity, or permanently purge your account.
          </p>
        </div>

        <div className="flex rounded-xl bg-[#f0f2f5] p-1 border border-[#e9edef] shrink-0">
          <button
            id="account_tab_login"
            type="button"
            onClick={() => setActiveTab('LOGIN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'LOGIN'
                ? 'bg-white text-[#111b21] shadow-2xs'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            Sign In
          </button>
          <button
            id="account_tab_register"
            type="button"
            onClick={() => setActiveTab('REGISTER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'REGISTER'
                ? 'bg-white text-[#111b21] shadow-2xs'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            Register
          </button>
          <button
            id="account_tab_delete"
            type="button"
            onClick={() => setActiveTab('DELETE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'DELETE'
                ? 'bg-rose-50 text-rose-700 shadow-2xs'
                : 'text-[#54656f] hover:text-rose-600'
            }`}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tab 1: Sign In Form */}
      {activeTab === 'LOGIN' && (
        <div className="space-y-4">
          {sessionEmail && (
            <div className="p-3.5 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#008069]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Currently signed in as <strong>{sessionEmail}</strong></span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="text-rose-600 font-bold hover:underline cursor-pointer text-[11px]"
              >
                Sign Out
              </button>
            </div>
          )}

          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </motion.div>
          )}

          {loginSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginSuccess}</span>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#54656f]" />
                <span>Registered Email</span>
              </label>
              <input
                id="login_email_input"
                type="email"
                placeholder="alice@gmail.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
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
                  onClick={() => setShowLoginPasskey(!showLoginPasskey)}
                  className="text-[11px] text-[#00a884] hover:underline font-semibold"
                >
                  {showLoginPasskey ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                id="login_passkey_input"
                type={showLoginPasskey ? 'text' : 'password'}
                placeholder="••••••••"
                value={loginPasskey}
                onChange={(e) => setLoginPasskey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                required
              />
            </div>

            <div className="p-3 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-xs text-[#54656f] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0" />
              <span>Brute-force protection: Accounts lock automatically for 15 minutes after 5 failed attempts.</span>
            </div>

            <button
              id="login_submit_button"
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
            >
              <LogIn className="w-4 h-4" />
              <span>{loginLoading ? 'SIGNING IN...' : 'ESTABLISH SECURE SESSION'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Registration Form */}
      {activeTab === 'REGISTER' && (
        <div className="space-y-4">
          {regError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{regError}</span>
            </motion.div>
          )}

          {regSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{regSuccess}</span>
            </motion.div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#54656f]" />
                <span>Email Address</span>
              </label>
              <input
                id="register_email_input"
                type="email"
                placeholder="alice@gmail.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                required
              />
              <p className="text-[11px] text-[#54656f] mt-1">
                Your email will be normalized to lowercase and used as your recipient identifier.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#111b21] uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#54656f]" />
                    <span>Passkey</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRegPasskey(!showRegPasskey)}
                    className="text-[11px] text-[#00a884] hover:underline font-semibold"
                  >
                    {showRegPasskey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="register_passkey_input"
                  type={showRegPasskey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={regPasskey}
                  onChange={(e) => setRegPasskey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#54656f]" />
                  <span>Confirm Passkey</span>
                </label>
                <input
                  id="register_confirm_passkey_input"
                  type={showRegPasskey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={regConfirmPasskey}
                  onChange={(e) => setRegConfirmPasskey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884] transition-all font-mono"
                  required
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-xs text-[#54656f] space-y-1">
              <span className="font-bold text-[#111b21] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#00a884]" />
                <span>Zero Plaintext Storage</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                Passkeys are salted and hashed using bcrypt before storage. Your passkey is never logged, stored in plaintext, or transmitted in server session records.
              </p>
            </div>

            <button
              id="register_account_button"
              type="submit"
              disabled={regLoading}
              className="w-full py-3 px-4 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
            >
              <UserCheck className="w-4 h-4" />
              <span>{regLoading ? 'REGISTERING...' : 'REGISTER NOTIFICATION ACCOUNT'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Delete Account Form */}
      {activeTab === 'DELETE' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Permanent Account Wipe</span>
              <p className="text-[11px] leading-relaxed text-rose-800/90">
                Deleting your account will purge your email registration, passkey hash, active Text Channel, received messages, sent message records, and all active server sessions.
              </p>
            </div>
          </div>

          {delError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{delError}</span>
            </motion.div>
          )}

          {delSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{delSuccess}</span>
            </motion.div>
          )}

          <form onSubmit={handleInitiateDelete} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#111b21] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#54656f]" />
                  <span>Email Address</span>
                </label>
                <input
                  id="delete_account_email_input"
                  type="email"
                  placeholder="alice@gmail.com"
                  value={delEmail}
                  onChange={(e) => setDelEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#111b21] uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-[#54656f]" />
                    <span>Confirm Passkey</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDelPasskey(!showDelPasskey)}
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    {showDelPasskey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  id="delete_account_passkey_input"
                  type={showDelPasskey ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={delPasskey}
                  onChange={(e) => setDelPasskey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] text-sm text-[#111b21] placeholder-[#667781] focus:bg-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                  required
                />
              </div>
            </div>

            <button
              id="request_delete_account_button"
              type="submit"
              disabled={delLoading}
              className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.99]"
            >
              <Trash2 className="w-4 h-4" />
              <span>CONFIRM PASSKEY & PURGE ACCOUNT</span>
            </button>
          </form>
        </div>
      )}

      {/* Two-Step Confirmation Modal (PRD Section 21) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#e9edef] shadow-2xl space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111b21]">Are you sure?</h3>
                <p className="text-xs text-[#54656f]">Irreversible account deletion</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#54656f]">
              <p className="font-semibold text-[#111b21]">This will permanently delete:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Your registered email (<strong>{delEmail}</strong>)</li>
                <li>Your passkey hash</li>
                <li>Your Text Channel</li>
                <li>Your received messages</li>
                <li>Your sent notification records</li>
                <li>All active sessions</li>
              </ul>
              <p className="pt-2 text-rose-600 font-bold">This action cannot be undone.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#f0f2f5]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={delLoading}
                className="px-4 py-2 text-xs font-bold text-[#54656f] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="permanently_delete_confirm_button"
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={delLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{delLoading ? 'PURGING...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
