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
  ExternalLink,
  MessageSquare,
  Mail,
} from 'lucide-react';
import { motion } from 'motion/react';

export const HomeView = ({
  onCreateClick,
  onJoinClick,
  onNotificationsClick,
  onMessagesClick,
  onOpenArchitecture,
}) => {
  const handleOpenMessages = onMessagesClick || onNotificationsClick;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8 sm:space-y-10 font-sans">
      {/* Hero Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e9edef] text-xs font-semibold text-[#111b21] shadow-2xs mb-1">
          <span className="w-2 h-2 rounded-full bg-[#00a884]" />
          <span className="text-[#54656f] font-mono uppercase tracking-wider text-[11px]">
            EPHEMERAL PROTOCOL
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-[#111b21] tracking-tight uppercase">
          PLUTUS
        </h1>

        <p className="text-sm sm:text-base font-medium text-[#54656f]">
          Secure. Temporary. Private.
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
                Create Session
              </h2>
              <p className="text-xs text-[#54656f] mt-1 leading-relaxed">
                Initialize a temporary P2P line. Receive credentials, QR code, audio/video calling, and hard-purge controls.
              </p>
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
                Join Session
              </h2>
              <p className="text-xs text-[#54656f] mt-1 leading-relaxed">
                Connect to an existing active line using Session ID and secret passkey, or scan an owner's QR code.
              </p>
            </div>
          </div>

          <button
            id="join_existing_line_button"
            onClick={onJoinClick}
            className="mt-6 w-full py-3 px-4 bg-[#111b21] hover:bg-[#2a3942] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <span>JOIN SESSION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Messages Card */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.15 }}
          className="md:col-span-2 bg-white rounded-2xl p-6 sm:p-7 border border-[#e9edef] shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-2xs shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#111b21] tracking-tight flex items-center gap-1.5">
                  <span>💬 Messages</span>
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#e7f7f3] text-[#008069] border border-[#00a884]/20 uppercase tracking-wider">
                  PRIVATE INBOX
                </span>
              </div>
              <p className="text-xs text-[#54656f] leading-relaxed">
                Send and receive private messages using your email identity, with self-destructing view-once capability.
              </p>
            </div>
          </div>

          <button
            id="open_messages_button"
            onClick={handleOpenMessages}
            className="w-full sm:w-auto shrink-0 py-3 px-6 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
          >
            <Mail className="w-4 h-4" />
            <span>MESSAGES</span>
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
              Session state exists in server RAM and is never committed to storage disks.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef]">
            <div className="font-bold text-[#111b21] flex items-center gap-1 mb-1">
              <Video className="w-3.5 h-3.5 text-[#00a884]" />
              <span>P2P WebRTC</span>
            </div>
            <p className="text-[11px] text-[#54656f] leading-snug">
              Voice and video streams connect directly between browsers without intermediate storage.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef]">
            <div className="font-bold text-[#111b21] flex items-center gap-1 mb-1">
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Hard Purge</span>
            </div>
            <p className="text-[11px] text-[#54656f] leading-snug">
              When the owner departs, all state, tokens, and participant buffers are wiped.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
