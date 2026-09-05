import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Mic, Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { playIncomingCallSound } from '../../services/soundEffects.js';

export const CallInvitationModal = ({
  invitation,
  callerName,
  callType,
  isOpen = true,
  onAccept,
  onDecline,
}) => {
  useEffect(() => {
    // Play initial ringtone and loop every 2.5 seconds while open
    try {
      playIncomingCallSound();
    } catch (e) {
      // Audio autoplay policy
    }
    const interval = setInterval(() => {
      try {
        playIncomingCallSound();
      } catch (e) {
        // Audio autoplay policy
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const resolvedInvitation = invitation || (callerName ? { callerName, callType } : null);
  if (!resolvedInvitation) return null;

  const isVideo = (resolvedInvitation.callType || callType) === 'video';
  const displayName = resolvedInvitation.callerName || callerName || 'Session Owner';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="w-full max-w-sm bg-white rounded-2xl border border-[#e9edef] shadow-2xl p-6 text-center text-[#111b21]"
      >
        {/* Pulsating Icon Circle */}
        <div className="relative mx-auto mb-4 w-16 h-16 flex items-center justify-center bg-[#e7f7f3] border border-[#00a884]/20 rounded-2xl shadow-2xs">
          <span className="absolute inset-0 rounded-2xl bg-[#00a884]/20 animate-ping" />
          {isVideo ? (
            <Video className="w-8 h-8 text-[#00a884] relative z-10" />
          ) : (
            <Phone className="w-8 h-8 text-[#00a884] relative z-10" />
          )}
        </div>

        {/* Title */}
        <div className="text-xs uppercase font-bold tracking-wider text-[#54656f] mb-1">
          <span>INCOMING {isVideo ? 'VIDEO' : 'AUDIO'} CALL</span>
        </div>

        <h3 className="text-lg font-bold text-[#111b21] tracking-tight mb-2">
          {displayName}
        </h3>

        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#fef9c3] border border-[#fde047] text-[#713f12] text-[11px] font-bold uppercase rounded-full mb-4">
          <Crown className="w-3 h-3 text-[#854d0e]" />
          <span>SESSION OWNER IS CALLING</span>
        </div>

        <p className="text-xs text-[#54656f] mb-6 leading-relaxed">
          Peer-to-peer encrypted WebRTC {isVideo ? 'video stream' : 'audio stream'}. Direct browser link with zero server media storage.
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            id="decline_call_button"
            onClick={onDecline}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
          >
            <PhoneOff className="w-4 h-4 text-[#ea0038]" />
            <span>Decline</span>
          </button>

          <button
            id="accept_call_button"
            onClick={onAccept}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
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
