// API helper service for Encrypted File Transfer in Plutus Secure Line (PRD Phase 3)

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatTtlRemaining(expiresAt) {
  if (!expiresAt) return null;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return 'EXPIRED';
  const mins = Math.floor(remainingMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return '< 1m';
}

export function getFileInlineUrl(fileId, sessionId, participantId) {
  if (!fileId) return '';
  const params = new URLSearchParams({
    sessionId: sessionId || '',
    participantId: participantId || '',
  });
  return `/api/files/${fileId}?${params.toString()}`;
}

export function getFileDownloadUrl(fileId, sessionId, participantId) {
  if (!fileId) return '';
  const params = new URLSearchParams({
    sessionId: sessionId || '',
    participantId: participantId || '',
    download: 'true',
  });
  return `/api/files/${fileId}?${params.toString()}`;
}

/**
 * Upload an encrypted ciphertext payload via HTTP POST /api/files/upload
 */
export function uploadEncryptedFileWithProgress({
  ciphertextBlob,
  fileName,
  originalMimeType,
  originalSize,
  encryptionVersion = 1,
  algorithm = 'AES-256-GCM',
  nonce,
  keyEnvelopes,
  sha256,
  expiresInOption = 'NEVER',
  sessionId,
  participantId,
  caption = '',
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    // Attach encrypted binary payload as "file"
    formData.append('file', ciphertextBlob, `${fileName}.enc`);
    formData.append('sessionId', sessionId);
    formData.append('participantId', participantId);
    formData.append('caption', caption || '');
    formData.append('originalName', fileName);
    formData.append('originalMimeType', originalMimeType);
    formData.append('originalSize', String(originalSize));
    formData.append('encryptionVersion', String(encryptionVersion));
    formData.append('algorithm', algorithm);
    formData.append('nonce', nonce);
    formData.append('keyEnvelopes', JSON.stringify(keyEnvelopes));
    formData.append('sha256', sha256);
    formData.append('expiresInOption', expiresInOption);

    // Track upload progress (PRD Section 26)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && typeof onProgress === 'function') {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress({ loaded: e.loaded, total: e.total, percent });
      }
    });

    xhr.addEventListener('load', () => {
      let responseData = null;
      try {
        responseData = JSON.parse(xhr.responseText);
      } catch {
        responseData = { message: xhr.responseText || 'Upload failed' };
      }

      if (xhr.status >= 200 && xhr.status < 300 && responseData.success) {
        resolve(responseData);
      } else {
        const errorMsg =
          responseData.message ||
          (xhr.status === 401 || xhr.status === 403
            ? 'You do not have permission to access or upload to this conversation.'
            : 'Unable to upload encrypted file.');
        const err = new Error(errorMsg);
        err.code = responseData.code || `HTTP_${xhr.status}`;
        reject(err);
      }
    });

    xhr.addEventListener('error', () => {
      const err = new Error('Connection interrupted. Please try again.');
      err.code = 'NETWORK_ERROR';
      reject(err);
    });

    xhr.addEventListener('abort', () => {
      const err = new Error('Upload cancelled.');
      err.code = 'UPLOAD_ABORTED';
      reject(err);
    });

    xhr.open('POST', '/api/files/upload', true);
    xhr.setRequestHeader('x-session-id', sessionId);
    xhr.setRequestHeader('x-participant-id', participantId);

    xhr.send(formData);
  });
}

/**
 * Fetch raw ciphertext ArrayBuffer from the server for client-side decryption
 */
export async function fetchCiphertextBuffer(fileId, sessionId, participantId) {
  const url = getFileInlineUrl(fileId, sessionId, participantId);
  const response = await fetch(url, {
    headers: {
      'x-session-id': sessionId,
      'x-participant-id': participantId,
    },
  });

  if (!response.ok) {
    if (response.status === 410) {
      const err = new Error('This encrypted file has expired and was purged from server memory.');
      err.code = 'FILE_EXPIRED';
      throw err;
    }
    if (response.status === 403) {
      const err = new Error('Access denied. You are not authorized to download this file.');
      err.code = 'UNAUTHORIZED';
      throw err;
    }
    if (response.status === 404) {
      const err = new Error('File not found or session has been terminated.');
      err.code = 'FILE_NOT_FOUND';
      throw err;
    }
    throw new Error(`Failed to download ciphertext (HTTP ${response.status})`);
  }

  return response.arrayBuffer();
}

/**
 * Request server to delete an encrypted file (PRD Section 31)
 */
export async function requestDeleteFile(fileId, sessionId, participantId) {
  const response = await fetch(`/api/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
      'x-participant-id': participantId,
    },
    body: JSON.stringify({ sessionId, participantId }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to delete file from server.');
  }
  return data;
}

// Backward compatibility alias for legacy Phase 2 if needed
export const uploadFileWithProgress = uploadEncryptedFileWithProgress;