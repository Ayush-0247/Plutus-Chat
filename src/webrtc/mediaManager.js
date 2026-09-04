// WebRTC MediaStream Manager for Audio/Video Calling
// Handles getUserMedia, track toggling (mute/camera), and cleanup

export async function acquireMediaStream({ video = true, audio = true }) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Your browser does not support WebRTC audio/video calling.');
  }

  // If video is requested, try getting both video and audio
  if (video) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      return {
        stream,
        isAudioOnlyFallback: false,
        hasVideo: true,
        hasAudio: true,
      };
    } catch (err) {
      console.warn('[WebRTC Media] Video+Audio acquisition failed, attempting audio-only fallback:', err.message);
      // Fallback: camera may be denied or not present, but user can still join with audio
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        return {
          stream: audioStream,
          isAudioOnlyFallback: true,
          hasVideo: false,
          hasAudio: true,
          warning: 'Camera access was denied or unavailable. Joined with audio only.',
        };
      } catch (audioErr) {
        // Both video and audio failed
        throw new Error('Microphone access is required to join the call.');
      }
    }
  }

  // Audio-only call
  try {
    const audioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    return {
      stream: audioStream,
      isAudioOnlyFallback: false,
      hasVideo: false,
      hasAudio: true,
    };
  } catch (err) {
    throw new Error('Microphone access is required for this audio call.');
  }
}

// Mute/Unmute audio track (PRD Section 19: disable track without destroying connection)
export function setAudioEnabled(stream, enabled) {
  if (!stream) return false;
  const audioTracks = stream.getAudioTracks();
  audioTracks.forEach((track) => {
    track.enabled = Boolean(enabled);
  });
  return audioTracks.some((t) => t.enabled);
}

// Camera toggle (PRD Section 20: disable video track without leaving call)
export function setVideoEnabled(stream, enabled) {
  if (!stream) return false;
  const videoTracks = stream.getVideoTracks();
  videoTracks.forEach((track) => {
    track.enabled = Boolean(enabled);
  });
  return videoTracks.some((t) => t.enabled);
}

// Complete stop of all tracks (PRD Section 71)
export function stopAllMediaTracks(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch (e) {
        // ignore
      }
    });
  } catch (err) {
    console.error('[WebRTC Media] Error stopping tracks:', err);
  }
}

export const stopAllTracks = stopAllMediaTracks;

export function toggleTrackEnabled(stream, kind, currentMutedState) {
  if (kind === 'audio') {
    return setAudioEnabled(stream, currentMutedState);
  }
  if (kind === 'video') {
    return setVideoEnabled(stream, currentMutedState);
  }
}
