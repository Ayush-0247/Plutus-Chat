import React, { useState, useEffect } from 'react';
import { KeyRound, ArrowRight, ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const JoinSessionView = ({
  initialSessionId = '',
  initialPasskey = '',
  onJoinSession,
  onCancel,
  isLoading,
  errorMessage,
}) => {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [passkey, setPasskey] = useState(initialPasskey);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
    if (initialPasskey) setPasskey(initialPasskey);
  }, [initialSessionId, initialPasskey]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sessionId.trim() || !passkey.trim()) return;
    onJoinSession(
      sessionId.trim().toUpperCase(),
      passkey.trim().toUpperCase(),
      username.trim() || 'Participant'
    );
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
          <div className="w-10 h-10 rounded-xl bg-[#111b21] flex items-center justify-center text-amber-400 shadow-2xs shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#111b21]">
              Join Secure Line
            </h2>
            <p className="text-xs text-[#54656f]">
              Enter Session ID and Passkey to authenticate
            </p>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="m-6 mb-0 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
              Session ID
            </label>
            <input
              id="join_session_id_input"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="e.g. 8F7K2M"
              required
              maxLength={12}
              className="w-full px-4 py-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef] focus:border-[#00a884] focus:bg-white text-[#111b21] placeholder-[#667781] text-sm uppercase tracking-wider font-mono font-bold outline-none transition-all shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
              Session Passkey
            </label>
            <input
              id="join_passkey_input"
              type="text"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value.toUpperCase())}
              placeholder="e.g. ALPHA-982"
              required
              maxLength={24}
              className="w-full px-4 py-3 bg-[#fef9c3] rounded-xl border border-[#fde047] focus:border-amber-500 focus:bg-white text-[#713f12] placeholder-amber-700/60 text-sm uppercase tracking-wider font-mono font-bold outline-none transition-all shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
              Your Codename / Handle
            </label>
            <input
              id="join_username_input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Rahul, Aman, Rishi"
              maxLength={32}
              className="w-full px-4 py-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef] focus:border-[#00a884] focus:bg-white text-[#111b21] placeholder-[#667781] text-sm outline-none transition-all shadow-2xs font-medium"
            />
          </div>

          <div className="p-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef] text-xs text-[#54656f] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Dual-factor authentication checks against active RAM session states.
              Never stored permanently.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              id="cancel_join_button"
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              id="confirm_join_session_button"
              type="submit"
              disabled={isLoading || !sessionId.trim() || !passkey.trim()}
              className="flex-1 px-4 py-2.5 bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              {isLoading ? (
                <span>Validating Line...</span>
              ) : (
                <>
                  <span>Join Session</span>
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
