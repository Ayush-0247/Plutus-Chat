import React from 'react';
import { X, ShieldCheck, Database, Trash2, Key, Users, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
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
                  Privacy-Preserving Ephemeral Architecture
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Phase 2: Minimal Session Metadata Storage & Ephemeral Communication State
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
                Core Architectural Rule
              </p>
              <p className="text-xs text-slate-700 leading-relaxed font-sans">
                <strong>"The database stores session metadata, not communication content."</strong> The platform provides the infrastructure required to communicate without becoming a permanent archive. Messages, images, PDFs, and active participant states remain strictly ephemeral in RAM and are never stored in the database.
              </p>
            </div>

            {/* Invariants Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-black uppercase">
                  <Lock className="w-4 h-4" />
                  Hashed Passkey Auth
                </div>
                <p className="text-xs text-slate-600">
                  Raw passkeys are never stored in MongoDB. Only secure cryptographic hashes (bcrypt) are retained for admission verification.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase">
                  <Database className="w-4 h-4" />
                  Zero Message DB
                </div>
                <p className="text-xs text-slate-600">
                  Hard architectural constraint: No messages collection, no chat history, and no permanent user accounts.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-amber-700 text-xs font-black uppercase">
                  <Users className="w-4 h-4" />
                  Session-Scoped Moderation
                </div>
                <p className="text-xs text-slate-600">
                  Owner authority allows kicking participants. Session-specific ban records persist in <code className="text-amber-800 font-bold">session_bans</code> until session destruction.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
                <div className="flex items-center gap-2 text-rose-700 text-xs font-black uppercase">
                  <Trash2 className="w-4 h-4" />
                  Hard Destruction & Purge
                </div>
                <p className="text-xs text-slate-600">
                  Owner termination or disconnect initiates a 15s countdown followed by complete deletion of RAM state and database metadata.
                </p>
              </div>
            </div>

            {/* RAM vs Database Matrix */}
            <div className="border-2 border-slate-900 p-3.5 bg-slate-50 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-slate-900 font-black">
                Responsibility Separation Matrix
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 bg-white border border-slate-300 space-y-1">
                  <div className="font-bold text-indigo-700 uppercase flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    Database Metadata (Persistent)
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                    <li>Session ID & Owner Participant UUID</li>
                    <li>Cryptographic Passkey Hash</li>
                    <li>Status (ACTIVE, ENDING, DESTROYED)</li>
                    <li>Creation & Expiration Timestamps</li>
                    <li>Session-Specific Ban Records</li>
                  </ul>
                </div>

                <div className="p-2.5 bg-white border border-slate-300 space-y-1">
                  <div className="font-bold text-emerald-700 uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Server RAM State (Ephemeral)
                  </div>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                    <li>Active Socket connections & rooms</li>
                    <li>Connected participant list & usernames</li>
                    <li>Real-time message & typing relay</li>
                    <li>Destruction countdown timers</li>
                  </ul>
                </div>
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
                  <span>3. DESTROYED (RAM & DB Purged)</span>
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
