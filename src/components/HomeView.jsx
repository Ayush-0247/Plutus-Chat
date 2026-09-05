import React from 'react';
import {
  KeyRound,
  Radio,
  ArrowRight,
  ShieldCheck,
  Zap,
  Trash2,
  Video,
  Lock,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';

export const HomeView = ({
  onCreateClick,
  onJoinClick,
  onOpenArchitecture,
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8 sm:space-y-10 font-sans">
      {/* Hero Header */}
      <div className="text-center space-y-3.5 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#e9edef] text-xs font-semibold text-[#111b21] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#00a884] pulse-indicator" />
          <span className="text-[#54656f]">ZERO-PERSISTENCE PROTOCOL</span>
          <span className="text-[#e9edef]">•</span>
          <span className="text-[#008069] font-bold">NODE.JS RAM ONLY</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#111b21] tracking-tight">
          Real-Time Ephemeral <br />
          <span className="text-[#00a884]">Communication Line</span>
        </h1>

        <p className="text-xs sm:text-sm text-[#54656f] leading-relaxed max-w-xl mx-auto">
          Zero database persistence. Complete in-memory session lifecycle in
          volatile server RAM. Protected by cryptographic links & passkeys.
          Hard-destroyed upon owner departure.
        </p>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-2xl mx-auto">
        {/* Create Session Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.15 }}
          className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-2xs">
                <Radio className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#e7f7f3] text-[#008069] border border-[#00a884]/20 uppercase tracking-wider">
                OWNER MODE
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#111b21] tracking-tight">
                Start Secure Line
              </h2>
              <p className="text-xs text-[#54656f] mt-1 leading-relaxed">
                Initialize as <strong>Owner</strong>. Get cryptographic credentials,
                QR code for instant device joining, manage participants, kick unwanted users,
                and control hard-wipe termination.
              </p>
            </div>

            <div className="pt-2 border-t border-[#f0f2f5] space-y-1.5 text-xs text-[#54656f]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" />
                <span>Encrypted P2P Voice & Video Calls</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" />
                <span>Instant QR Scanner for Phones</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" />
                <span>Session-Scoped Irrevocable Bans</span>
              </div>
            </div>
          </div>

          <button
            id="start_secure_line_button"
            onClick={onCreateClick}
            className="mt-6 w-full py-3 px-4 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <span>CREATE SESSION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Join Session Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.15 }}
          className="bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-[#111b21] flex items-center justify-center text-amber-400 shadow-2xs">
                <KeyRound className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#fef9c3] text-[#713f12] border border-[#fde047] uppercase tracking-wider">
                PEER ACCESS
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#111b21] tracking-tight">
                Join Existing Line
              </h2>
              <p className="text-xs text-[#54656f] mt-1 leading-relaxed">
                Connect using an active Session ID and secret passkey, or simply
                scan an owner's QR code. Enjoy zero-trace communication with voluntary
                departure rights.
              </p>
            </div>

            <div className="pt-2 border-t border-[#f0f2f5] space-y-1.5 text-xs text-[#54656f]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Dual-Factor Passkey Verification</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Ephemeral File & Photo Transfers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Voluntary Disconnect Anytime</span>
              </div>
            </div>
          </div>

          <button
            id="join_existing_line_button"
            onClick={onJoinClick}
            className="mt-6 w-full py-3 px-4 bg-[#111b21] hover:bg-[#2a3942] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <span>ENTER PASSKEY & JOIN</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* Security Principles Banner */}
      <div className="max-w-2xl mx-auto p-4 sm:p-5 rounded-2xl bg-white border border-[#e9edef] shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5] mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00a884]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#111b21]">
              Zero-Trace Ephemeral Safeguards
            </span>
          </div>
          {onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              className="text-xs text-[#00a884] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>View Specs</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef]">
            <div className="font-bold text-[#111b21] flex items-center gap-1 mb-1">
              <Zap className="w-3.5 h-3.5 text-[#00a884]" />
              <span>Volatile RAM</span>
            </div>
            <p className="text-[11px] text-[#54656f] leading-snug">
              Messages and files exist only in server memory and are never saved to disk.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef]">
            <div className="font-bold text-[#111b21] flex items-center gap-1 mb-1">
              <Video className="w-3.5 h-3.5 text-[#00a884]" />
              <span>P2P WebRTC</span>
            </div>
            <p className="text-[11px] text-[#54656f] leading-snug">
              Voice and video streams connect directly between browsers without intermediate media storage.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef]">
            <div className="font-bold text-[#111b21] flex items-center gap-1 mb-1">
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Hard Purge</span>
            </div>
            <p className="text-[11px] text-[#54656f] leading-snug">
              When the owner departs, all state, tokens, and participant buffers are completely erased.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
