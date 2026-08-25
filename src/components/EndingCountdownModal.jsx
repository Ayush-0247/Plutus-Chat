import React, { useEffect, useState } from 'react';
import { AlertOctagon, ShieldAlert, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { playCountdownTickSound } from '../services/soundEffects.js';

export const EndingCountdownModal = ({ endingData, isOwner }) => {
  const [msRemaining, setMsRemaining] = useState(() => {
    return Math.max(0, endingData.destroyAt - Date.now());
  });

  const totalMs = endingData.totalDurationMs || 15000;
  const warningMs = endingData.warningDurationMs || 5000;
  const countdownMs = endingData.countdownDurationMs || 10000;

  useEffect(() => {
    let lastSec = Math.ceil(msRemaining / 1000);

    const interval = setInterval(() => {
      const remaining = Math.max(0, endingData.destroyAt - Date.now());
      setMsRemaining(remaining);

      const currentSec = Math.ceil(remaining / 1000);
      if (currentSec !== lastSec && currentSec > 0) {
        lastSec = currentSec;
        // Play tick sound (urgent in the final 5 seconds)
        playCountdownTickSound(currentSec <= 5);
      }

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [endingData.destroyAt]);

  const secondsRemaining = Math.max(0, Math.ceil(msRemaining / 1000));
  const isWarningPhase = msRemaining > countdownMs;
  const progressPercent = Math.min(100, Math.max(0, (1 - msRemaining / totalMs) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white border-4 border-rose-600 rounded-none p-6 sm:p-8 shadow-[12px_12px_0px_0px_rgba(225,29,72,1)] text-center font-mono relative overflow-hidden"
      >
        {/* Animated warning stripe header */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600 animate-pulse" />

        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 bg-rose-600 border-2 border-slate-900 flex items-center justify-center text-white mb-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <AlertOctagon className="w-9 h-9 animate-bounce" />
        </div>

        {/* Title / Status */}
        <div className="space-y-1 mb-6">
          <span className="inline-block px-3 py-1 text-xs font-black bg-slate-900 text-amber-400 uppercase tracking-widest border border-slate-900">
            {endingData.reason === 'OWNER_LEFT' ? 'OWNER DISCONNECTED' : 'ALL OUT • SESSION TERMINATION'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-wide font-sans mt-2">
            {isWarningPhase ? 'SESSION IS CLOSING' : 'PURGING EPHEMERAL RAM'}
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto font-mono mt-1">
            {endingData.reason === 'OWNER_LEFT'
              ? 'The session owner has left or closed their connection. In accordance with zero-persistence policy, all session state is being permanently destroyed.'
              : 'The session owner has initiated hard session termination. All participant connections and in-memory caches will be erased.'}
          </p>
        </div>

        {/* Large Countdown Display */}
        <div className="my-6 p-6 bg-slate-900 border-2 border-slate-900 relative shadow-[4px_4px_0px_0px_rgba(225,29,72,0.6)]">
          <div className="text-xs text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5 font-bold">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            Time until hard destruction
          </div>
          
          <div className="text-6xl sm:text-7xl font-black text-amber-400 tracking-tighter tabular-nums">
            {secondsRemaining}
            <span className="text-xl sm:text-2xl font-bold text-slate-400 ml-1">s</span>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 font-bold uppercase">
            {isWarningPhase
              ? 'Phase 1: Session notification & closure warning'
              : 'Phase 2: Authoritative destruction countdown'}
          </div>
        </div>

        {/* Destruction Progress Bar */}
        <div className="space-y-1.5 mb-6">
          <div className="flex justify-between text-[11px] text-slate-700 font-bold">
            <span>TERMINATION PROGRESS</span>
            <span className="text-rose-700 font-black">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-3 bg-slate-200 border-2 border-slate-900 overflow-hidden">
            <div
              className="h-full bg-rose-600 transition-all duration-75 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Information Notice */}
        <div className="p-3 bg-amber-50 border-2 border-amber-500 text-[11px] text-amber-950 font-bold flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>No chat logs or session records will survive this countdown.</span>
        </div>
      </motion.div>
    </div>
  );
};
