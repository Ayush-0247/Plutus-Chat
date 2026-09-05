import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, Radio, ShieldCheck, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';

export const CreateSessionView = ({
  onCreateSession,
  onCancel,
  isLoading,
}) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateSession(username.trim() || 'Session Creator');
  };

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#e9edef] shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#111b21]">
              Create Secure Line
            </h2>
            <p className="text-xs text-[#54656f]">
              Initialize an ephemeral owner-controlled room
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
              Your Codename / Handle
            </label>
            <input
              id="create_username_input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Cipher, Ayush, Agent-01"
              maxLength={32}
              autoFocus
              className="w-full px-4 py-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef] focus:border-[#00a884] focus:bg-white text-[#111b21] placeholder-[#667781] text-sm outline-none transition-all shadow-2xs font-medium"
            />
            <p className="text-[11px] text-[#54656f] mt-1.5 leading-normal">
              You will be granted <strong>Owner</strong> authority with participant moderation,
              QR code device linking, and line termination rights.
            </p>
          </div>

          {/* Security Features checklist */}
          <div className="p-3.5 bg-[#e7f7f3] rounded-xl border border-[#00a884]/20 space-y-1.5 text-xs text-[#008069]">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-[#00a884]" />
              <span>Automatic Cryptographic Generation</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              A high-entropy Session ID and secret passkey will be automatically
              generated in Node.js volatile RAM upon creation.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              id="cancel_create_button"
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              id="confirm_create_session_button"
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              {isLoading ? (
                <span>Generating Line...</span>
              ) : (
                <>
                  <span>Create Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
