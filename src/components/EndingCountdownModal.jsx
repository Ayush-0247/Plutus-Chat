import React, { useEffect, useState } from 'react';
import { AlertOctagon, Clock, ShieldAlert } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-white rounded-2xl border border-[#e9edef] p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden"
      >
        {/* Animated warning stripe header */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse" />

        {/* Warning Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#ea0038] mb-4 shadow-2xs">
          <AlertOctagon className="w-8 h-8 animate-bounce" />
        </div>

        {/* Title / Status */}
        <div className="space-y-1 mb-5">
          <span className="inline-block px-3 py-1 text-xs font-bold bg-rose-50 border border-rose-200 text-[#ea0038] rounded-full uppercase tracking-wider">
            {endingData.reason === 'OWNER_LEFT'
              ? 'OWNER DISCONNECTED'
              : 'ALL OUT • SESSION TERMINATION'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-[#111b21] tracking-tight mt-2">
            {isWarningPhase ? 'Session is Closing' : 'Purging Ephemeral RAM'}
          </h2>
          <p className="text-xs text-[#54656f] max-w-md mx-auto leading-relaxed mt-1">
            {endingData.reason === 'OWNER_LEFT'
              ? 'The session owner has disconnected. In accordance with zero-persistence policy, all session state is being permanently destroyed.'
              : 'The session owner has initiated hard session termination. All participant connections and in-memory caches will be erased.'}
          </p>
        </div>

        {/* Large Countdown Display */}
        <div className="my-5 p-5 bg-[#111b21] rounded-xl border border-[#2a3942] relative shadow-sm text-white">
          <div className="text-xs text-[#667781] uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5 font-bold">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>Time Until Hard Destruction</span>
          </div>

          <div className="text-5xl sm:text-6xl font-black text-amber-400 tracking-tight tabular-nums my-1">
            {secondsRemaining}
            <span className="text-lg font-bold text-white/50 ml-1">s</span>
          </div>

          <div className="text-[11px] text-[#00a884] font-medium uppercase">
            {isWarningPhase
              ? 'Phase 1: Graceful closure notification'
              : 'Phase 2: Authoritative RAM eradication'}
          </div>
        </div>

        {/* Destruction Progress Bar */}
        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-xs text-[#54656f] font-semibold">
            <span>TERMINATION PROGRESS</span>
            <span className="text-[#ea0038] font-bold">{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2.5 bg-[#f0f2f5] rounded-full overflow-hidden border border-[#e9edef]">
            <div
              className="h-full bg-[#ea0038] transition-all duration-75 ease-linear rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="text-[11px] text-[#54656f] bg-[#f0f2f5] p-2.5 rounded-xl border border-[#e9edef]">
          Zero database persistence. Complete wipe of all active memory references in Node.js runtime.
        </div>
      </motion.div>
    </div>
  );
};
