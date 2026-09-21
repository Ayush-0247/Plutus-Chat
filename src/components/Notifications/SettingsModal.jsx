import React, { useState } from 'react';
import { Settings, Shield, Power, Trash2, Key, AlertCircle, CheckCircle2, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SettingsModal = ({
  isOpen,
  onClose,
  sessionEmail,
  sessionToken,
  channelEnabled,
  onChannelToggle,
  onSignOut,
  onAccountDeleted,
}) => {
  const [isUpdatingChannel, setIsUpdatingChannel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePasskey, setDeletePasskey] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleToggleReceiveMessages = async (newValue) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUpdatingChannel(true);

    try {
      const endpoint = newValue
        ? '/api/notifications/channel/create'
        : '/api/notifications/channel/disable';

      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: sessionEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update message settings.');
      }

      onChannelToggle(data.channelEnabled);
      setSuccessMsg(
        data.channelEnabled
          ? 'You can now receive messages from registered users.'
          : 'You are now blocking incoming messages.'
      );
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsUpdatingChannel(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePasskey) {
      setErrorMsg('Please enter your passkey to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch('/api/notifications/account', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          email: sessionEmail,
          passkey: deletePasskey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete account.');
      }

      setShowDeleteConfirm(false);
      if (onAccountDeleted) {
        onAccountDeleted();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 border border-[#e9edef] shadow-xl space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f0f2f5] text-[#111b21] flex items-center justify-center">
              <Settings className="w-4 h-4 text-[#54656f]" />
            </div>
            <h3 className="text-base font-bold text-[#111b21]">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#54656f] hover:bg-[#f0f2f5] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {/* Privacy Section: Receive Messages */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#54656f]">Privacy</h4>
          <div className="p-4 rounded-xl bg-[#f0f2f5] border border-[#e9edef] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    channelEnabled ? 'bg-[#00a884]' : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs font-bold text-[#111b21]">
                  {channelEnabled ? 'Receiving Messages' : 'Not Receiving Messages'}
                </span>
              </div>
              <p className="text-[11px] text-[#54656f] leading-relaxed">
                Allow registered users to send you private messages.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                id="settings_receive_messages_toggle"
                type="checkbox"
                checked={Boolean(channelEnabled)}
                disabled={isUpdatingChannel}
                onChange={(e) => handleToggleReceiveMessages(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
            </label>
          </div>
        </div>

        {/* Account Section */}
        <div className="space-y-3 pt-2 border-t border-[#f0f2f5]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#54656f]">Account</h4>
          <div className="p-4 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#54656f]">Email</span>
              <span className="text-xs font-mono font-semibold text-[#111b21]">{sessionEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#54656f]">Status</span>
              <span className="text-xs text-[#008069] font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" /> Active Session
              </span>
            </div>

            <div className="pt-2">
              <button
                id="settings_sign_out_button"
                type="button"
                onClick={onSignOut}
                className="w-full py-2 px-3 bg-white border border-[#e9edef] hover:bg-[#eaecee] text-[#111b21] text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Power className="w-3.5 h-3.5 text-[#54656f]" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="space-y-3 pt-2 border-t border-[#f0f2f5]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600">Danger Zone</h4>

          {!showDeleteConfirm ? (
            <button
              id="settings_delete_account_open_button"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2 px-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Confirm Permanent Deletion</span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                This will immediately purge your account, passkey hash, active messages, and identity from the database.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-rose-900 mb-1">
                  Enter Passkey to Confirm
                </label>
                <input
                  id="settings_delete_passkey_input"
                  type="password"
                  placeholder="••••••••"
                  value={deletePasskey}
                  onChange={(e) => setDeletePasskey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-rose-300 text-xs text-[#111b21] placeholder-slate-400 focus:outline-none focus:border-rose-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-[#54656f] hover:bg-rose-100/60 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="settings_confirm_delete_account_button"
                  type="submit"
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
