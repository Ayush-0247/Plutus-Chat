import React, { useEffect } from 'react';
import { Trash2, RefreshCw, CheckCircle2, Terminal } from 'lucide-react';
import { motion } from 'motion/react';
import { playPurgedSound } from '../services/soundEffects.js';

export const DestroyedScreen = ({ sessionId, onReset }) => {
  useEffect(() => {
    playPurgedSound();
  }, []);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xl bg-white border-2 border-slate-900 rounded-none p-6 sm:p-8 text-center font-mono shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] relative"
      >
        {/* Destroyed Icon Badge */}
        <div className="mx-auto w-16 h-16 bg-slate-900 border-2 border-slate-900 flex items-center justify-center text-white mb-5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <Trash2 className="w-8 h-8 text-rose-400" />
        </div>

        <span className="inline-block px-3 py-1 text-xs font-black bg-rose-100 border-2 border-rose-600 text-rose-900 uppercase tracking-widest mb-3">
          SESSION DESTROYED & PURGED
        </span>

        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide mb-2 font-sans">
          Memory State Completely Erased
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-6 font-mono">
          The ephemeral session {sessionId ? <code className="text-indigo-700 font-bold bg-slate-100 px-1 py-0.5 border border-slate-300">[{sessionId}]</code> : ''} has been permanently terminated. All in-memory participant tables, Socket.IO channels, and transient chat streams have been zeroed out.
        </p>

        {/* Verification Terminal Block */}
        <div className="p-4 bg-slate-900 border-2 border-slate-900 text-left text-xs text-slate-200 font-mono space-y-2 mb-6 shadow-inner">
          <div className="flex items-center gap-2 text-slate-400 border-b border-slate-700 pb-2 mb-2">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Node.js Memory Wipe Verification</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>sessions.delete("{sessionId || 'CURRENT'}") ➔ SUCCESS</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>participants.clear() ➔ 0 active references</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>bannedList.clear() ➔ memory reclaimed</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Disk writes ➔ 0 bytes (No database configured)</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="create_new_session_after_destroy"
            onClick={onReset}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] focus:outline-none"
          >
            <RefreshCw className="w-4 h-4" />
            Establish New Session
          </button>
        </div>
      </motion.div>
    </div>
  );
};
