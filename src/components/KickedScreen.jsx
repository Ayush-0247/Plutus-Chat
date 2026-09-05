import React from 'react';
import { UserX, ShieldAlert, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export const KickedScreen = ({ sessionId, reason, onReset }) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-2xl border border-[#e9edef] p-6 sm:p-8 text-center shadow-xl"
      >
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#ea0038] mb-4 shadow-2xs">
          <UserX className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-rose-50 border border-rose-200 text-[#ea0038] rounded-full uppercase tracking-wider mb-3">
          <span className="w-2 h-2 rounded-full bg-[#ea0038]" />
          <span>ACCESS REVOKED BY OWNER</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-[#111b21] tracking-tight mb-2">
          Participant Kicked & Banned
        </h2>

        <p className="text-xs sm:text-sm text-[#54656f] max-w-md mx-auto mb-6 leading-relaxed">
          {reason || 'The session creator has removed you from this ephemeral communication line.'}
        </p>

        <div className="p-4 bg-[#fef9c3] rounded-xl border border-[#fde047] text-left text-xs text-[#713f12] space-y-1.5 mb-6">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs text-[#854d0e] border-b border-amber-300 pb-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Session Rule: Irrevocable Ban</span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#713f12]">
            In accordance with PRD Invariant 3, a kicked participant cannot rejoin
            the session {sessionId ? (
              <code className="text-[#111b21] font-mono font-bold bg-white px-1 py-0.5 rounded border border-amber-300">
                {sessionId}
              </code>
            ) : ''}{' '}
            even with the session link or secret passkey.
          </p>
        </div>

        <button
          onClick={onReset}
          className="w-full sm:w-auto px-6 py-2.5 bg-[#111b21] hover:bg-[#2a3942] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer shadow-2xs active:scale-[0.98]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Home</span>
        </button>
      </motion.div>
    </div>
  );
};
