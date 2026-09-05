import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, VideoOff, Crown } from 'lucide-react';

export const VideoTile = ({
  stream,
  username,
  isOwner = false,
  isLocal = false,
  isMuted = false,
  isVideoEnabled = true,
  callType = 'video',
}) => {
  const videoRef = useRef(null);
  const [hasActualVideo, setHasActualVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});

      const checkVideo = () => {
        const videoTracks = stream.getVideoTracks();
        const hasTrack =
          videoTracks.length > 0 &&
          videoTracks[0].enabled &&
          videoTracks[0].readyState === 'live';
        setHasActualVideo(Boolean(hasTrack) && isVideoEnabled && callType === 'video');
      };

      checkVideo();
      const interval = setInterval(checkVideo, 500);
      return () => clearInterval(interval);
    } else {
      setHasActualVideo(false);
    }
  }, [stream, isVideoEnabled, callType]);

  const initial = (username || '?').charAt(0).toUpperCase();

  return (
    <div className="relative w-full h-full min-h-[140px] sm:min-h-[170px] bg-[#1a232a] rounded-xl border border-[#2a3942] flex items-center justify-center overflow-hidden font-sans shadow-2xs">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''} ${
          hasActualVideo ? 'block' : 'hidden'
        }`}
      />

      {/* Fallback Graphic (When Video Off or Audio-Only Call) */}
      {!hasActualVideo && (
        <div className="flex flex-col items-center justify-center p-3 text-center select-none">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-xl sm:text-2xl font-bold text-[#00a884] mb-2 shadow-inner">
            {initial}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#667781]">
            {callType === 'audio' ? (
              <span className="text-[#00a884] font-semibold flex items-center gap-1">
                <Mic className="w-3 h-3" /> Audio Stream
              </span>
            ) : (
              <span className="text-[#667781] font-semibold flex items-center gap-1">
                <VideoOff className="w-3 h-3" /> Camera Inactive
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Username & Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10 text-[11px] font-semibold text-white max-w-[80%] truncate">
          <span className="truncate">{username}</span>
          {isOwner && (
            <span className="shrink-0 px-1.5 py-0.2 bg-[#fef9c3] text-[#713f12] text-[9px] font-bold uppercase rounded-md flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5 text-[#854d0e]" /> OWNER
            </span>
          )}
          {isLocal && (
            <span className="shrink-0 px-1.5 py-0.2 bg-[#00a884] text-white text-[9px] font-bold uppercase rounded-md">
              YOU
            </span>
          )}
        </div>

        {/* Audio Muted Indicator */}
        <div className="flex items-center gap-1">
          {isMuted ? (
            <div
              className="p-1.5 bg-[#ea0038] text-white rounded-lg shadow-2xs"
              title="Microphone Muted"
            >
              <MicOff className="w-3 h-3" />
            </div>
          ) : (
            <div
              className="p-1.5 bg-[#00a884] text-white rounded-lg shadow-2xs"
              title="Microphone Active"
            >
              <Mic className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
