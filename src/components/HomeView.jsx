import React from 'react';
import { KeyRound, Radio, Cpu, Trash2, Users, ArrowRight, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

export const HomeView = ({
  onCreateClick,
  onJoinClick,
  onOpenArchitecture,
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10 font-mono">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white text-xs font-mono font-bold uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          EPHEMERAL PROTOCOL V1.0 • SOCKET.IO ACTIVE
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight font-sans">
          Owner-Controlled <br />
          <span className="text-indigo-600 underline decoration-4 decoration-amber-400 underline-offset-8">
            Real-time Ephemeral Line
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-mono">
          Zero database persistence. Complete in-memory session lifecycle in Node.js RAM. Protected by cryptographic links & passkeys. Destroyed permanently upon owner departure.
        </p>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Create Session Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.15 }}
          className="bg-white border-2 border-slate-900 rounded-none p-6 sm:p-7 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between group transition-all"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 bg-indigo-600 border-2 border-slate-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase text-indigo-600 tracking-wider">CREATOR MODE</div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide font-sans">
                Start Secure Line
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-mono">
                Initialize as <strong className="text-slate-900 font-bold">OWNER</strong>. Get cryptographic credentials, manage participants, kick unwanted users, and control line termination.
              </p>
            </div>
          </div>

          <button
            id="start_secure_line_button"
            onClick={onCreateClick}
            className="mt-6 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none"
          >
            <span>Create Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Join Session Card */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.15 }}
          className="bg-white border-2 border-slate-900 rounded-none p-6 sm:p-7 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between group transition-all"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 bg-slate-900 border-2 border-slate-900 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">PARTICIPANT MODE</div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide font-sans">
                Join Existing Line
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-mono">
                Authenticate with an active Session ID and secret passkey. Live text stream with voluntary departure and rejoining rights.
              </p>
            </div>
          </div>

          <button
            id="join_existing_line_button"
            onClick={onJoinClick}
            className="mt-6 w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none"
          >
            <span>Enter Passkey & Join</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* Security Invariants Showcase */}
      <div className="pt-6 border-t-2 border-slate-300">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-mono font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 bg-slate-900 inline-block"></span>
            PRD Ephemeral Invariants
          </span>
          <button
            onClick={onOpenArchitecture}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline flex items-center gap-1"
          >
            <span>View Architecture Spec</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-black uppercase">
              <Cpu className="w-4 h-4" />
              <span>0% Persistent Storage</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              No MongoDB, SQL, or disk logging. Messages are strictly real-time Socket.IO relays.
            </p>
          </div>

          <div className="p-4 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-700 text-xs font-black uppercase">
              <Users className="w-4 h-4" />
              <span>Permanent Kick Ban</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              If the owner removes a participant, their session membership is permanently barred from returning.
            </p>
          </div>

          <div className="p-4 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-1.5">
            <div className="flex items-center gap-2 text-rose-700 text-xs font-black uppercase">
              <Trash2 className="w-4 h-4" />
              <span>15s Hard Memory Purge</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Owner departure triggers authoritative 5s notice + 10s countdown followed by complete memory wipe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
