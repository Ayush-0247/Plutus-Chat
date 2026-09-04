// WebRTC DataChannel File Transfer Protocol & Memory Manager
// Implements chunking (16 KB), backpressure handling, Blob reconstruction, and Blob URL lifecycle

import {
  CHUNK_SIZE,
  MAX_FILE_SIZE,
  BUFFERED_AMOUNT_HIGH_THRESHOLD,
  getFileTypeCategory,
} from './config.js';

export { getFileTypeCategory };
export const getFileCategory = getFileTypeCategory;

// Global registry of created Blob URLs for strict session destruction purge
const createdBlobUrls = new Set();

export function registerBlobUrl(url) {
  if (url) createdBlobUrls.add(url);
  return url;
}

export function revokeBlobUrl(url) {
  if (url && createdBlobUrls.has(url)) {
    try {
      URL.revokeObjectURL(url);
      createdBlobUrls.delete(url);
    } catch (e) {
      // ignore
    }
  }
}

export function revokeAllBlobUrls() {
  createdBlobUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  });
  createdBlobUrls.clear();
}

/**
 * Handles sending a File or Blob over an RTCDataChannel with chunking and backpressure control.
 */
export async function sendFileChunked({
  dataChannel,
  file,
  fileId,
  senderId,
  senderName,
  isOwner,
  onProgress,
  abortSignal,
}) {
  if (!dataChannel || dataChannel.readyState !== 'open') {
    throw new Error('DataChannel is not open for file transfer.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File is larger than the 25 MB limit.');
  }

  const totalBytes = file.size;
  const fileName = file.name || 'unnamed-file';
  const fileType = file.type || 'application/octet-stream';
  const category = getFileTypeCategory(fileType, fileName);

  // 1. Send file-start metadata message
  const startHeader = {
    type: 'file-start',
    fileId,
    fileName,
    fileType,
    fileSize: totalBytes,
    category,
    senderId,
    senderName,
    isOwner: Boolean(isOwner),
    timestamp: Date.now(),
  };

  dataChannel.send(JSON.stringify(startHeader));

  // 2. Read and send binary chunks with backpressure
  let offset = 0;

  while (offset < totalBytes) {
    if (abortSignal?.aborted) {
      // Send cancel signal to receiver
      try {
        dataChannel.send(JSON.stringify({ type: 'file-cancel', fileId }));
      } catch (e) {
        // channel may have closed
      }
      throw new Error('Transfer cancelled by user.');
    }

    // Check DataChannel bufferedAmount backpressure
    if (dataChannel.bufferedAmount > BUFFERED_AMOUNT_HIGH_THRESHOLD) {
      await new Promise((resolve) => {
        const onLow = () => {
          dataChannel.removeEventListener('bufferedamountlow', onLow);
          resolve();
        };
        dataChannel.addEventListener('bufferedamountlow', onLow);
      });
    }

    const chunkBlob = file.slice(offset, offset + CHUNK_SIZE);
    const arrayBuffer = await chunkBlob.arrayBuffer();

    dataChannel.send(arrayBuffer);
    offset += arrayBuffer.byteLength;

    if (typeof onProgress === 'function') {
      const percentage = Math.min(100, Math.round((offset / totalBytes) * 100));
      onProgress({
        fileId,
        bytesSent: offset,
        totalBytes,
        percentage,
      });
    }
  }

  // 3. Send file-end completion message
  const endHeader = {
    type: 'file-end',
    fileId,
  };
  dataChannel.send(JSON.stringify(endHeader));
}

/**
 * Class for accumulating incoming file chunks on the receiver end.
 */
export class FileReceiverManager {
  constructor({ onProgress, onComplete, onCancel, onError }) {
    this.transfers = new Map(); // fileId -> { metadata, chunks, receivedBytes, timer }
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onCancel = onCancel;
    this.onError = onError;
  }

  handleMessage(event) {
    const data = event.data;

    // JSON control message (file-start, file-end, file-cancel)
    if (typeof data === 'string') {
      try {
        const payload = JSON.parse(data);

        if (payload.type === 'file-start') {
          const { fileId, fileName, fileType, fileSize, category, senderId, senderName, isOwner, timestamp } = payload;
          this.transfers.set(fileId, {
            fileId,
            fileName,
            fileType,
            fileSize,
            category,
            senderId,
            senderName,
            isOwner,
            timestamp,
            chunks: [],
            receivedBytes: 0,
          });

          if (this.onProgress) {
            this.onProgress({
              fileId,
              fileName,
              fileSize,
              category,
              senderId,
              senderName,
              isOwner,
              receivedBytes: 0,
              percentage: 0,
              status: 'RECEIVING',
            });
          }
          return;
        }

        if (payload.type === 'file-end') {
          const { fileId } = payload;
          const transfer = this.transfers.get(fileId);
          if (!transfer) return;

          // Reconstruct Blob from collected ArrayBuffer chunks
          const blob = new Blob(transfer.chunks, { type: transfer.fileType });
          const objectUrl = registerBlobUrl(URL.createObjectURL(blob));

          const completedFile = {
            messageId: `file-${fileId}`,
            fileId: transfer.fileId,
            fileName: transfer.fileName,
            fileType: transfer.fileType,
            fileSize: transfer.fileSize,
            category: transfer.category,
            senderId: transfer.senderId,
            senderName: transfer.senderName,
            isOwner: transfer.isOwner,
            timestamp: transfer.timestamp || Date.now(),
            objectUrl,
            isLocal: false,
          };

          this.transfers.delete(fileId);

          if (this.onComplete) {
            this.onComplete(completedFile);
          }
          return;
        }

        if (payload.type === 'file-cancel') {
          const { fileId } = payload;
          if (this.transfers.has(fileId)) {
            this.transfers.delete(fileId);
            if (this.onCancel) this.onCancel(fileId);
          }
          return;
        }
      } catch (err) {
        console.error('[WebRTC FileReceiver] Error parsing control message:', err);
      }
      return;
    }

    // Binary Chunk (ArrayBuffer)
    if (data instanceof ArrayBuffer) {
      // Attribute chunk to the active receiving transfer
      // In small peer groups, typically one file transfer is streamed at a time per channel
      for (const [fileId, transfer] of this.transfers.entries()) {
        transfer.chunks.push(data);
        transfer.receivedBytes += data.byteLength;

        const percentage = Math.min(100, Math.round((transfer.receivedBytes / transfer.fileSize) * 100));

        if (this.onProgress) {
          this.onProgress({
            fileId,
            fileName: transfer.fileName,
            fileSize: transfer.fileSize,
            category: transfer.category,
            senderId: transfer.senderId,
            senderName: transfer.senderName,
            isOwner: transfer.isOwner,
            receivedBytes: transfer.receivedBytes,
            percentage,
            status: 'RECEIVING',
          });
        }
        break;
      }
    }
  }

  cancelTransfer(fileId) {
    if (this.transfers.has(fileId)) {
      this.transfers.delete(fileId);
      if (this.onCancel) this.onCancel(fileId);
    }
  }

  clear() {
    this.transfers.clear();
  }
}
