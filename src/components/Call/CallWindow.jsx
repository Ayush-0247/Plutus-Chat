import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Radio,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VideoTile } from './VideoTile.jsx';

export const CallWindow = ({
  callType = 'video',
  localStream,
  remoteStreams = new Map(), // participantId -> MediaStream
  participants = [], // session participants array
  myParticipantId,
  isOwner = false,
  isAudioMuted = false,
  isVideoMuted = false,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  onEndCallForEveryone,
  warningMessage,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Find user details by participantId
  const getParticipant = (pid) => {
    return participants.find((p) => p.participantId === pid) || { username: 'Participant', isOwner: false };
  };

  const myUser = getParticipant(myParticipantId);
  const isVideoCall = callType === 'video';
  const totalCallers = 1 + remoteStreams.size;

  return (
    <div className="bg-slate-900 border-2 border-slate-900 mb-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-mono text-white select-none">
      {/* Top Status Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b-2 border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-black tracking-wider uppercase text-emerald-400">
            P2P {callType.toUpperCase()} CALL
          </span>
          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
            {formatTimer(elapsedSeconds)}
          </span>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>({totalCallers})</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {warningMessage && (
            <span className="text-[10px] text-amber-400 font-bold hidden md:inline truncate max-w-xs">
              {warningMessage}
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title={isCollapsed ? 'Expand Call Tiles' : 'Minimize Call Tiles'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Video Grid Tiles */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden p-2 sm:p-3 bg-slate-950"
          >
            <div
              className={`grid gap-2 ${
                totalCallers === 1
                  ? 'grid-cols-1 max-w-sm mx-auto'
                  : totalCallers === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {/* Local User Tile */}
              <VideoTile
                stream={localStream}
                username={myUser.username}
                isOwner={myUser.isOwner}
                isLocal={true}
                isMuted={isAudioMuted}
                isVideoEnabled={!isVideoMuted}
                callType={callType}
              />

              {/* Remote Participants Tiles */}
              {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
                const remoteUser = getParticipant(peerId);
                return (
                  <VideoTile
                    key={peerId}
                    stream={stream}
                    username={remoteUser.username}
                    isOwner={remoteUser.isOwner}
                    isLocal={false}
                    isMuted={false}
                    isVideoEnabled={true}
                    callType={callType}
                  />
                );
              })}

              {/* Waiting state when only owner is on call */}
              {remoteStreams.size === 0 && (
                <div className="h-full min-h-[140px] sm:min-h-[170px] bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-4 text-center">
                  <Radio className="w-8 h-8 text-indigo-400 animate-pulse mb-2" />
                  <p className="text-xs font-bold text-slate-300">Awaiting Joiners...</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                    Invitation sent to participants. When accepted, encrypted streams connect directly peer-to-peer.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Controls Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-slate-900 border-t-2 border-slate-800">
        {/* Mute/Unmute */}
        <button
          id="toggle_mic_button"
          onClick={onToggleAudio}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase transition-colors border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-emerald-400'
          }`}
          title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{isAudioMuted ? 'UNMUTE' : 'MUTE'}</span>
        </button>

        {/* Camera Toggle (Video Call Only) */}
        {isVideoCall && (
          <button
            id="toggle_camera_button"
            onClick={onToggleVideo}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black uppercase transition-colors border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] ${
              isVideoMuted
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-indigo-300'
            }`}
            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
            <span>{isVideoMuted ? 'CAM ON' : 'CAM OFF'}</span>
          </button>
        )}

        {/* Joiner: Leave Call */}
        {!isOwner && (
          <button
            id="leave_call_button"
            onClick={onLeaveCall}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase transition-colors border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
          >
            <PhoneOff className="w-4 h-4 text-rose-400" />
            <span>LEAVE CALL</span>
          </button>
        )}

        {/* Owner: End Call for Everyone / Leave Call */}
        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              id="owner_end_call_button"
              onClick={() => setShowEndConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider transition-colors border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              title="Terminate the call for all session participants"
            >
              <PhoneOff className="w-4 h-4" />
              <span>END CALL FOR EVERYONE</span>
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Owner Ending Call */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white border-2 border-slate-900 p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] font-mono text-slate-900"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4 pb-2 border-b-2 border-slate-900">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wider">
                End Call for Everyone?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              As the session owner, ending this call will disconnect all active video and audio streams for everyone and return all participants to the text chat.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                id="cancel_end_call_confirm_button"
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
              >
                Cancel
              </button>
              <button
                id="confirm_end_call_for_all_button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndCallForEveryone();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
              >
                End Call Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
