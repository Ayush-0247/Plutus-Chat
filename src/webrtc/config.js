// WebRTC Central Configuration & Limits for Plutus Chat Phase 3

export const RTC_CONFIG = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'stun:stun1.l.google.com:19302',
    },
  ],
  iceCandidatePoolSize: 10,
};

// Application-level file transfer limits
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per PRD Section 28
export const CHUNK_SIZE = 16384; // 16 KB chunks per PRD Section 30
export const BUFFERED_AMOUNT_HIGH_THRESHOLD = 64 * 1024; // 64 KB backpressure threshold

// Explicit Call States per PRD Section 10
export const CALL_STATES = {
  IDLE: 'IDLE',
  INVITING: 'INVITING',
  JOINING: 'JOINING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

// Call Types per PRD Section 6
export const CALL_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio',
};

// Human-readable file size formatter
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// File category helper
export function getFileTypeCategory(fileType = '', fileName = '') {
  const mime = fileType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)
  ) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  return 'file';
}
