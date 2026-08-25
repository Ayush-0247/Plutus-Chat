import React from 'react';
import { X, ShieldCheck, Cpu, Trash2, Key, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ArchitectureModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white border-2 border-slate-900 rounded-none p-6 sm:p-8 shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] text-slate-900 font-mono"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 border-2 border-slate-900 text-emerald-400 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black font-sans uppercase tracking-wide text-slate-900">
                  Ephemeral System Architecture & Invariants
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Strict in-memory Node.js + Socket.IO lifecycle specification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-slate-100 border-2 border-slate-900 text-slate-900 hover:bg-slate-200 transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-6 text-sm font-mono leading-relaxed">
            {/* Core Principle */}
            <div className="p-4 bg-slate-100 border-2 border-slate-900 text-slate-900">
              <p className="font-black text-xs tracking-wider uppercase text-indigo-700 mb-1">
                Core Engineering Axiom
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                "A communication session should exist only for as long as the session is active.
                No database, no disk logs, no post-termination history. When the owner terminates or disconnects, the Node.js RAM state is hard-purged."
              </p>
            </div>

            {/* Invariants Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-black uppercase">
                  <Key className="w-4 h-4" />
                  Dual-Factor Admission
                </div>
                <p className="text-xs text-slate-600">
                  Link alone is never sufficient. Both the cryptographic Session ID + high-entropy Passkey are strictly required.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase">
                  <Cpu className="w-4 h-4" />
                  Zero Persistent Storage
                </div>
                <p className="text-xs text-slate-600">
                  Server operates in-memory (Node.js RAM <code className="text-emerald-700 font-bold">Map()</code>). Messages are transiently relayed through Socket.IO with zero disk storage.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase">
                  <Users className="w-4 h-4" />
                  Owner Authority & Ban
                </div>
                <p className="text-xs text-slate-600">
                  Only the creator has owner privileges to kick participants. A kicked participant ID is permanently barred from rejoining that active session.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-rose-700 text-xs font-black uppercase">
                  <Trash2 className="w-4 h-4" />
                  Authoritative Termination
                </div>
                <p className="text-xs text-slate-600">
                  Manual end or owner disconnect triggers a 15-second server-authoritative countdown (5s warning + 10s countdown) followed by immediate total memory wipe.
                </p>
              </div>
            </div>

            {/* Lifecycle Stages */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-slate-900 font-black">
                State Machine Progression
              </h3>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3.5 bg-slate-100 border-2 border-slate-900 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1. ACTIVE</span>
                </div>
                <span className="text-slate-400 hidden sm:inline font-black">➔</span>
                <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>2. ENDING (5s warning + 10s timer)</span>
                </div>
                <span className="text-slate-400 hidden sm:inline font-black">➔</span>
                <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>3. DESTROYED (RAM Purged)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t-2 border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black font-mono text-xs uppercase tracking-wider transition-colors border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] focus:outline-none"
            >
              Acknowledge & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
