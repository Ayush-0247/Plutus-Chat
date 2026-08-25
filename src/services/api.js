// API helper service for HTTP file transfer in Plutus Secure Line (PRD Phase 2)

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

export function uploadFileWithProgress({
  file,
  sessionId,
  participantId,
  caption = '',
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('file', file);
    formData.append('sessionId', sessionId);
    formData.append('participantId', participantId);
    formData.append('caption', caption || '');

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
            : 'Unable to upload file.');
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
