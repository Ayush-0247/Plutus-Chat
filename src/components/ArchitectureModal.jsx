import React from 'react';
import {
  X,
  ShieldCheck,
  Database,
  Trash2,
  Lock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Video,
  FileUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ArchitectureModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-white rounded-2xl border border-[#e9edef] p-6 sm:p-8 shadow-2xl text-[#111b21]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e9edef] pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-2xs shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#111b21]">
                  Privacy-Preserving Ephemeral Architecture
                </h2>
                <p className="text-xs text-[#54656f]">
                  Zero-Database Communication & Volatile In-Memory Lifecycle
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#f0f2f5] hover:bg-[#e9edef] text-[#54656f] hover:text-[#111b21] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-5 text-xs sm:text-sm leading-relaxed">
            {/* Core Principle */}
            <div className="p-4 rounded-xl bg-[#e7f7f3] border border-[#00a884]/20 text-[#008069]">
              <p className="font-bold text-xs tracking-wider uppercase mb-1">
                Core Architectural Invariant
              </p>
              <p className="text-xs text-[#008069] leading-relaxed">
                <strong>"The database stores session metadata, not communication content."</strong>{' '}
                The platform provides ephemeral communication infrastructure without becoming
                a permanent archive. Messages, shared files, voice, and video streams remain
                strictly ephemeral in volatile RAM and are never written to disk or database.
              </p>
            </div>

            {/* Invariants Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-1">
                <div className="flex items-center gap-1.5 text-[#111b21] text-xs font-bold uppercase">
                  <Lock className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Hashed Passkey Auth</span>
                </div>
                <p className="text-xs text-[#54656f]">
                  Raw passkeys are never stored in the database. Only secure cryptographic hashes (bcrypt) are retained in memory/metadata for admission verification.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-1">
                <div className="flex items-center gap-1.5 text-[#111b21] text-xs font-bold uppercase">
                  <Database className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Zero Message Storage</span>
                </div>
                <p className="text-xs text-[#54656f]">
                  Hard architectural constraint: No messages collection, no chat history table, and no permanent user accounts.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-1">
                <div className="flex items-center gap-1.5 text-[#111b21] text-xs font-bold uppercase">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  <span>Session Moderation & Bans</span>
                </div>
                <p className="text-xs text-[#54656f]">
                  Owner authority allows kicking participants. Session-scoped ban records prevent kicked users from rejoining until session destruction.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-1">
                <div className="flex items-center gap-1.5 text-[#111b21] text-xs font-bold uppercase">
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hard Destruction & Purge</span>
                </div>
                <p className="text-xs text-[#54656f]">
                  Owner termination or disconnect initiates a 15-second grace countdown followed by complete eradication of RAM buffers and metadata.
                </p>
              </div>
            </div>

            {/* RAM vs Database Matrix */}
            <div className="border border-[#e9edef] rounded-xl p-4 bg-white shadow-2xs space-y-2.5">
              <h3 className="text-xs uppercase tracking-wider text-[#111b21] font-bold">
                Responsibility Separation Matrix
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#f0f2f5] rounded-lg border border-[#e9edef] space-y-1.5">
                  <div className="font-bold text-[#111b21] uppercase flex items-center gap-1.5 text-[11px]">
                    <Database className="w-3.5 h-3.5 text-[#54656f]" />
                    <span>Database Metadata (Minimal)</span>
                  </div>
                  <ul className="list-disc list-inside text-[#54656f] text-xs space-y-1">
                    <li>Session ID & Owner UUID</li>
                    <li>Bcrypt Passkey Hash</li>
                    <li>Status (ACTIVE, ENDING, DESTROYED)</li>
                    <li>Creation & Expiration Timestamps</li>
                    <li>Session-Specific Ban Table</li>
                  </ul>
                </div>

                <div className="p-3 bg-[#e7f7f3] rounded-lg border border-[#00a884]/20 space-y-1.5">
                  <div className="font-bold text-[#008069] uppercase flex items-center gap-1.5 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Server RAM State (Ephemeral)</span>
                  </div>
                  <ul className="list-disc list-inside text-[#008069] text-xs space-y-1">
                    <li>Active Socket rooms & live peers</li>
                    <li>Connected participant usernames</li>
                    <li>Real-time message & typing broadcasts</li>
                    <li>P2P WebRTC signaling exchanges</li>
                    <li>Authoritative destruction timers</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Lifecycle Stages */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider text-[#111b21] font-bold">
                Lifecycle Progression
              </h3>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef] text-xs font-semibold">
                <div className="flex items-center gap-1.5 text-[#008069]">
                  <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                  <span>1. ACTIVE</span>
                </div>
                <span className="text-[#667781] hidden sm:inline">➔</span>
                <div className="flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>2. ENDING (5s warning + 10s timer)</span>
                </div>
                <span className="text-[#667781] hidden sm:inline">➔</span>
                <div className="flex items-center gap-1.5 text-rose-700">
                  <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>3. DESTROYED (Hard Eradication)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-[#e9edef] flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              Acknowledge & Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
