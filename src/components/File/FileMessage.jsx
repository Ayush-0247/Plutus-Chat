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
        className={`w-full max-w-sm p-3 border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] font-mono ${
          isSelf ? 'ml-auto' : 'mr-auto'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 truncate">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            <span className="text-xs font-bold text-slate-900 truncate">
              {message.fileName || 'Transferring file...'}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase text-indigo-600">
            {message.percentage || 0}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 border border-slate-900 overflow-hidden mb-2">
          <div
            className="h-full bg-indigo-600 transition-all duration-150"
            style={{ width: `${message.percentage || 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {isSending ? 'Sending P2P' : 'Receiving P2P'} ({formatBytes(message.fileSize)})
          </span>
          {onCancelTransfer && (
            <button
              onClick={() => onCancelTransfer(message.fileId)}
              className="text-rose-600 font-bold hover:underline"
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
      className={`w-full max-w-sm border-2 border-slate-900 font-mono shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] ${
        isSelf ? 'ml-auto bg-indigo-50/50' : 'mr-auto bg-white'
      }`}
    >
      {/* Header with Sender Info */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-900 text-[10px]">
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-black text-slate-900 truncate">
            {isSelf ? 'You' : message.senderName}
          </span>
          {message.isOwner && (
            <span className="px-1 py-0.2 bg-amber-400 text-slate-900 font-black text-[8px] uppercase flex items-center gap-0.5 border border-slate-900">
              <Crown className="w-2.5 h-2.5" /> OWNER
            </span>
          )}
        </div>
        <span className="text-slate-400 text-[9px]">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Body: Image Preview or File Card */}
      <div className="p-3">
        {isImage && (
          <div className="mb-2">
            <div
              onClick={() => setShowLightbox(true)}
              className="group relative cursor-pointer border-2 border-slate-900 overflow-hidden bg-slate-900 max-h-56 flex items-center justify-center"
            >
              <img
                src={message.objectUrl}
                alt={message.fileName}
                className="w-full max-h-56 object-contain group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                <ExternalLink className="w-4 h-4" /> Click to Expand
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600 truncate">
              <span className="truncate font-semibold">{message.fileName}</span>
              <span className="shrink-0 text-[10px] text-slate-400 ml-2">
                {formatBytes(message.fileSize)}
              </span>
            </div>
          </div>
        )}

        {isPdf && (
          <div className="flex items-start gap-3 p-2.5 bg-rose-50 border-2 border-slate-900 mb-2">
            <div className="p-2 bg-rose-600 text-white shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                {message.fileName}
              </p>
              <p className="text-[10px] text-rose-700 font-bold mt-0.5">
                PDF Document • {formatBytes(message.fileSize)}
              </p>
            </div>
          </div>
        )}

        {!isImage && !isPdf && (
          <div className="flex items-start gap-3 p-2.5 bg-slate-50 border-2 border-slate-900 mb-2">
            <div className="p-2 bg-slate-900 text-white shrink-0">
              <FileArchive className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                {message.fileName}
              </p>
              <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                Attachment • {formatBytes(message.fileSize)}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {isPdf && (
            <a
              href={message.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </a>
          )}

          <a
            href={message.objectUrl}
            download={message.fileName}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Lightbox Modal for Full Image View */}
      {showLightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm font-mono">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border-2 border-white p-2 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-2 text-white border-b border-slate-800 mb-2">
              <span className="text-xs font-bold truncate max-w-md">
                {message.fileName} ({formatBytes(message.fileSize)})
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={message.objectUrl}
                  download={message.fileName}
                  className="px-3 py-1 bg-white text-slate-900 text-xs font-bold hover:bg-slate-200"
                >
                  Download
                </a>
                <button
                  onClick={() => setShowLightbox(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              <img
                src={message.objectUrl}
                alt={message.fileName}
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
