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
    return (
      participants.find((p) => p.participantId === pid) || {
        username: 'Participant',
        isOwner: false,
      }
    );
  };

  const myUser = getParticipant(myParticipantId);
  const isVideoCall = callType === 'video';
  const totalCallers = 1 + remoteStreams.size;

  return (
    <div className="bg-[#111b21] rounded-2xl border border-[#2a3942] mb-3 shadow-md font-sans text-white select-none overflow-hidden">
      {/* Top Status Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#0b141a] border-b border-[#2a3942] text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00a884] pulse-indicator" />
          <span className="font-bold tracking-wider uppercase text-[#00a884]">
            P2P {callType.toUpperCase()} CALL
          </span>
          <span className="px-2 py-0.5 bg-[#202c33] text-white text-[11px] font-mono font-semibold rounded-md border border-white/10">
            {formatTimer(elapsedSeconds)}
          </span>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#8696a0]">
            <Users className="w-3.5 h-3.5 text-[#00a884]" />
            <span>({totalCallers})</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {warningMessage && (
            <span className="text-[11px] text-amber-400 font-medium hidden md:inline truncate max-w-xs">
              {warningMessage}
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-lg hover:bg-[#202c33] text-[#8696a0] hover:text-white transition-colors cursor-pointer"
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
            className="overflow-hidden p-3 bg-[#111b21]"
          >
            <div
              className={`grid gap-3 ${
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
                <div className="h-full min-h-[140px] sm:min-h-[170px] bg-[#1a232a] rounded-xl border border-dashed border-[#2a3942] flex flex-col items-center justify-center p-4 text-center">
                  <Radio className="w-8 h-8 text-[#00a884] pulse-indicator mb-2" />
                  <p className="text-xs font-bold text-white">Awaiting Peers...</p>
                  <p className="text-[11px] text-[#8696a0] mt-1 max-w-xs leading-relaxed">
                    Invitation dispatched. When accepted, encrypted streams connect directly peer-to-peer.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Controls Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 p-3 bg-[#0b141a] border-t border-[#2a3942]">
        {/* Mute/Unmute */}
        <button
          id="toggle_mic_button"
          onClick={onToggleAudio}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-2xs ${
            isAudioMuted
              ? 'bg-[#ea0038] hover:bg-[#c90030] text-white'
              : 'bg-[#202c33] hover:bg-[#2a3942] text-[#00a884]'
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
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-2xs ${
              isVideoMuted
                ? 'bg-[#ea0038] hover:bg-[#c90030] text-white'
                : 'bg-[#202c33] hover:bg-[#2a3942] text-white'
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
            className="flex items-center gap-1.5 px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <PhoneOff className="w-4 h-4 text-[#ea0038]" />
            <span>LEAVE CALL</span>
          </button>
        )}

        {/* Owner: End Call for Everyone */}
        {isOwner && (
          <button
            id="owner_end_call_button"
            onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ea0038] hover:bg-[#c90030] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            title="Terminate the call for all session participants"
          >
            <PhoneOff className="w-4 h-4" />
            <span>END CALL FOR EVERYONE</span>
          </button>
        )}
      </div>

      {/* Confirmation Modal for Owner Ending Call */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border border-[#e9edef] p-6 shadow-2xl font-sans text-[#111b21]"
          >
            <div className="flex items-center gap-3 text-[#ea0038] mb-3 pb-3 border-b border-[#e9edef]">
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#ea0038] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">End Call for Everyone?</h3>
            </div>
            <p className="text-xs text-[#54656f] leading-relaxed mb-5">
              As session owner, ending this call will disconnect all active peer streams
              and return everyone to the text line.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                id="cancel_end_call_confirm_button"
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-bold uppercase rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm_end_call_for_all_button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndCallForEveryone();
                }}
                className="px-4 py-2 bg-[#ea0038] hover:bg-[#c90030] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
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
