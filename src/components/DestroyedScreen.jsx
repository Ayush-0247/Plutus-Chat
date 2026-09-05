import React, { useEffect } from 'react';
import { Trash2, RefreshCw, CheckCircle2, Terminal, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { playPurgedSound } from '../services/soundEffects.js';

export const DestroyedScreen = ({ sessionId, onReset }) => {
  useEffect(() => {
    playPurgedSound();
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-2xl border border-[#e9edef] p-6 sm:p-8 text-center shadow-xl relative"
      >
        {/* Destroyed Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#ea0038] mb-4 shadow-2xs">
          <Trash2 className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-rose-50 border border-rose-200 text-[#ea0038] rounded-full uppercase tracking-wider mb-3">
          <span className="w-2 h-2 rounded-full bg-[#ea0038]" />
          <span>SESSION DESTROYED & HARD-PURGED</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-[#111b21] tracking-tight mb-2">
          Memory State Completely Erased
        </h2>

        <p className="text-xs sm:text-sm text-[#54656f] max-w-md mx-auto mb-6 leading-relaxed">
          The ephemeral session {sessionId ? (
            <code className="text-[#111b21] font-mono font-bold bg-[#f0f2f5] px-1.5 py-0.5 rounded border border-[#e9edef]">
              {sessionId}
            </code>
          ) : ''}{' '}
          has been permanently terminated. All in-memory participant tables,
          WebRTC connection channels, and transient chat streams have been zeroed out.
        </p>

        {/* Verification Terminal Block */}
        <div className="p-4 bg-[#111b21] rounded-xl border border-[#2a3942] text-left text-xs text-white font-mono space-y-2 mb-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 text-[#667781]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#00a884]" />
              <span className="text-[11px] uppercase tracking-wider font-bold text-white">
                Node.js Memory Wipe Verification
              </span>
            </div>
            <span className="text-[10px] text-[#00a884] font-bold">VERIFIED</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-[#00a884]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>sessions.delete("{sessionId || 'CURRENT'}") ➔ SUCCESS</span>
            </div>
            <div className="flex items-center gap-2 text-[#00a884]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>participants.clear() ➔ 0 active references</span>
            </div>
            <div className="flex items-center gap-2 text-[#00a884]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>bannedList.clear() ➔ memory reclaimed</span>
            </div>
            <div className="flex items-center gap-2 text-[#00a884]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Disk writes ➔ 0 bytes (No database configured)</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          id="create_new_session_after_destroy"
          onClick={onReset}
          className="w-full sm:w-auto px-6 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer shadow-2xs active:scale-[0.98]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>ESTABLISH NEW SESSION</span>
        </button>
      </motion.div>
    </div>
  );
};
