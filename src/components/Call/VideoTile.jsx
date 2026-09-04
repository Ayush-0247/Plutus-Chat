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

      const checkVideo = () => {
        const videoTracks = stream.getVideoTracks();
        const hasTrack = videoTracks.length > 0 && videoTracks[0].enabled && videoTracks[0].readyState === 'live';
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
    <div className="relative w-full h-full min-h-[140px] sm:min-h-[170px] bg-slate-900 border-2 border-slate-900 flex items-center justify-center overflow-hidden shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-mono">
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
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-none bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-xl sm:text-2xl font-black text-indigo-400 mb-2 shadow-inner">
            {initial}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            {callType === 'audio' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Mic className="w-3 h-3" /> AUDIO LINE
              </span>
            ) : (
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <VideoOff className="w-3 h-3" /> CAMERA OFF
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Username & Status Bar */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-xs px-2 py-1 border border-slate-700 text-[10px] font-bold text-white max-w-[80%] truncate">
          <span className="truncate">{username}</span>
          {isOwner && (
            <span className="shrink-0 px-1 py-0.2 bg-amber-400 border border-slate-900 text-slate-900 text-[8px] font-black uppercase flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5" /> OWNER
            </span>
          )}
          {isLocal && (
            <span className="shrink-0 px-1 py-0.2 bg-emerald-600 text-white text-[8px] font-black uppercase">
              YOU
            </span>
          )}
        </div>

        {/* Audio Muted Indicator */}
        <div className="flex items-center gap-1">
          {isMuted ? (
            <div className="p-1 bg-rose-600/90 text-white border border-rose-800" title="Microphone Muted">
              <MicOff className="w-3 h-3" />
            </div>
          ) : (
            <div className="p-1 bg-emerald-600/80 text-white border border-emerald-800" title="Microphone Active">
              <Mic className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
