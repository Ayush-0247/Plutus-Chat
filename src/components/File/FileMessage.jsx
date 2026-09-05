import React, { useState } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  FileArchive,
  Image as ImageIcon,
  X,
  Loader2,
  Crown,
} from 'lucide-react';
import { formatBytes, getFileTypeCategory } from '../../webrtc/config.js';

export const FileMessage = ({ message, isSelf = false, onCancelTransfer }) => {
  const [showLightbox, setShowLightbox] = useState(false);

  // If this is an in-progress transfer
  if (message.isTransferring) {
    const isSending = message.status === 'SENDING';
    return (
      <div
        className={`w-full max-w-xs sm:max-w-sm p-3.5 rounded-2xl border border-[#e9edef] bg-white shadow-2xs font-sans ${
          isSelf ? 'ml-auto' : 'mr-auto'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 truncate">
            <Loader2 className="w-4 h-4 text-[#00a884] animate-spin shrink-0" />
            <span className="text-xs font-bold text-[#111b21] truncate">
              {message.fileName || 'Transferring file...'}
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#00a884]">
            {message.percentage || 0}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#f0f2f5] rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-[#00a884] transition-all duration-150 rounded-full"
            style={{ width: `${message.percentage || 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#54656f]">
          <span>
            {isSending ? 'Sending P2P' : 'Receiving P2P'} ({formatBytes(message.fileSize)})
          </span>
          {onCancelTransfer && (
            <button
              onClick={() => onCancelTransfer(message.fileId)}
              className="text-[#ea0038] font-bold hover:underline cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  const category = message.category || getFileTypeCategory(message.fileType, message.fileName);
  const isImage = category === 'image';
  const isPdf = category === 'pdf';

  return (
    <div
      className={`w-full max-w-xs sm:max-w-sm rounded-2xl border border-[#e9edef] font-sans shadow-2xs overflow-hidden ${
        isSelf ? 'ml-auto bg-[#d9fdd3]' : 'mr-auto bg-white'
      }`}
    >
      {/* Header with Sender Info */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/5 text-[11px] border-b border-black/5">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-bold text-[#111b21] truncate">
            {isSelf ? 'You' : message.senderName}
          </span>
          {message.isOwner && (
            <span className="px-1.5 py-0.2 bg-[#fef9c3] text-[#713f12] text-[9px] font-bold uppercase rounded-md flex items-center gap-0.5">
              <Crown className="w-2.5 h-2.5 text-[#854d0e]" /> OWNER
            </span>
          )}
        </div>
        <span className="text-[#667781] text-[10px]">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Body: Image Preview or File Card */}
      <div className="p-3">
        {isImage && (
          <div className="mb-2.5">
            <div
              onClick={() => setShowLightbox(true)}
              className="group relative cursor-pointer rounded-xl overflow-hidden bg-[#111b21] max-h-60 flex items-center justify-center border border-black/10"
            >
              <img
                src={message.objectUrl}
                alt={message.fileName}
                className="w-full max-h-60 object-contain group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                <ExternalLink className="w-4 h-4" /> Expand Image
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-[#54656f] truncate">
              <span className="truncate font-medium">{message.fileName}</span>
              <span className="shrink-0 text-[10px] text-[#667781] ml-2">
                {formatBytes(message.fileSize)}
              </span>
            </div>
          </div>
        )}

        {isPdf && (
          <div className="flex items-start gap-3 p-2.5 bg-white rounded-xl border border-[#e9edef] mb-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-[#ea0038] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#111b21] truncate">
                {message.fileName}
              </p>
              <p className="text-[11px] text-[#ea0038] font-semibold mt-0.5">
                PDF Document • {formatBytes(message.fileSize)}
              </p>
            </div>
          </div>
        )}

        {!isImage && !isPdf && (
          <div className="flex items-start gap-3 p-2.5 bg-white rounded-xl border border-[#e9edef] mb-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-lg bg-[#f0f2f5] flex items-center justify-center text-[#54656f] shrink-0">
              <FileArchive className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#111b21] truncate">
                {message.fileName}
              </p>
              <p className="text-[11px] text-[#54656f] font-semibold mt-0.5">
                Attachment • {formatBytes(message.fileSize)}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          {isPdf && (
            <a
              href={message.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-[#f0f2f5] text-[#111b21] border border-[#e9edef] rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </a>
          )}

          <a
            href={message.objectUrl}
            download={message.fileName}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Lightbox Modal for Full Image View */}
      {showLightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="relative max-w-4xl max-h-[90vh] bg-[#111b21] rounded-2xl border border-white/10 p-3 shadow-2xl flex flex-col text-white">
            <div className="flex items-center justify-between p-2 border-b border-white/10 mb-2">
              <span className="text-xs font-semibold truncate max-w-md">
                {message.fileName} ({formatBytes(message.fileSize)})
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={message.objectUrl}
                  download={message.fileName}
                  className="px-3 py-1 bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => setShowLightbox(false)}
                  className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              <img
                src={message.objectUrl}
                alt={message.fileName}
                className="max-w-full max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
