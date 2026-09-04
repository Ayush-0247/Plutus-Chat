import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Mic, Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { playIncomingCallSound } from '../../services/soundEffects.js';

export const CallInvitationModal = ({
  invitation,
  onAccept,
  onDecline,
}) => {
  useEffect(() => {
    // Play initial ringtone and loop every 2.5 seconds while open
    playIncomingCallSound();
    const interval = setInterval(() => {
      playIncomingCallSound();
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  if (!invitation) return null;

  const isVideo = invitation.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-mono">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-sm bg-white border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] p-6 text-center"
      >
        {/* Pulsating Icon Circle */}
        <div className="relative mx-auto mb-4 w-16 h-16 flex items-center justify-center bg-indigo-50 border-2 border-slate-900 rounded-full">
          <span className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
          {isVideo ? (
            <Video className="w-8 h-8 text-indigo-700 relative z-10" />
          ) : (
            <Phone className="w-8 h-8 text-emerald-700 relative z-10" />
          )}
        </div>

        {/* Title */}
        <div className="text-xs uppercase font-black tracking-widest text-slate-500 mb-1 flex items-center justify-center gap-1.5">
          <span>INCOMING {isVideo ? 'VIDEO' : 'AUDIO'} CALL</span>
        </div>

        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">
          {invitation.callerName || 'Session Owner'}
        </h3>

        <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-400 border border-slate-900 text-slate-900 text-[10px] font-black uppercase mb-5">
          <Crown className="w-3 h-3" />
          <span>SESSION OWNER IS CALLING</span>
        </div>

        <p className="text-xs text-slate-600 mb-6 leading-relaxed">
          Peer-to-peer encrypted WebRTC {isVideo ? 'media stream' : 'audio stream'}. Zero server storage.
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            id="decline_call_button"
            onClick={onDecline}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-900 font-bold text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <PhoneOff className="w-4 h-4 text-rose-600" />
            <span>Decline</span>
          </button>

          <button
            id="accept_call_button"
            onClick={onAccept}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 border-2 border-slate-900 text-white font-black text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            {isVideo ? (
              <Video className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span>Accept</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
