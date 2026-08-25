import React from 'react';
import { UserX, ShieldAlert, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export const KickedScreen = ({ sessionId, reason, onReset }) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 font-mono">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white border-2 border-slate-900 rounded-none p-6 sm:p-8 text-center shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]"
      >
        <div className="mx-auto w-16 h-16 bg-slate-900 border-2 border-slate-900 flex items-center justify-center text-rose-400 mb-5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <UserX className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 text-xs font-black bg-rose-100 border-2 border-rose-600 text-rose-900 uppercase tracking-widest mb-3">
          ACCESS REVOKED BY OWNER
        </span>

        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide mb-2 font-sans">
          Participant Kicked & Banned
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-6">
          {reason || 'The session creator has removed you from this ephemeral communication line.'}
        </p>

        <div className="p-4 bg-amber-50 border-2 border-amber-500 text-left text-xs text-amber-950 font-mono space-y-2 mb-6 font-bold">
          <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider border-b border-amber-300 pb-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Session Rule: Irrevocable Ban</span>
          </div>
          <p className="text-[11px] text-slate-800 leading-relaxed">
            In accordance with PRD Invariant 3, a kicked participant cannot rejoin the same session {sessionId ? <code className="text-indigo-700 font-bold bg-white px-1 py-0.5 border border-slate-400">[{sessionId}]</code> : ''} even with the session link or passkey.
          </p>
        </div>

        <button
          onClick={onReset}
          className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 mx-auto border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Home
        </button>
      </motion.div>
    </div>
  );
};
