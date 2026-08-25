import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ExternalLink,
  Info,
  Calendar,
  HardDrive,
} from 'lucide-react';
import { formatFileSize, getFileDownloadUrl, getFileInlineUrl } from '../services/api';

export default function ImageLightboxModal({
  isOpen,
  onClose,
  message,
  sessionId,
  participantId,
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.25, 4));
      if (e.key === '-') setScale((s) => Math.max(s - 0.25, 0.5));
      if (e.key === 'r') setRotation((r) => (r + 90) % 360);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !message) return null;

  const inlineUrl = getFileInlineUrl(message.fileId, sessionId, participantId);
  const downloadUrl = getFileDownloadUrl(message.fileId, sessionId, participantId);

  return (
    <AnimatePresence>
      <div
        id="image-lightbox-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-lg"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Top Control Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="text-left">
              <h4 className="text-sm font-medium text-slate-100 font-mono truncate max-w-xs sm:max-w-md">
                {message.fileName || 'Encrypted Image'}
              </h4>
              <p className="text-xs text-slate-400">
                {formatFileSize(message.fileSize)} • Sent by {message.senderName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Out */}
            <button
              id="lightbox-zoom-out"
              onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            {/* Zoom Level Indicator */}
            <span className="text-xs font-mono text-slate-400 min-w-[44px] text-center">
              {Math.round(scale * 100)}%
            </span>

            {/* Zoom In */}
            <button
              id="lightbox-zoom-in"
              onClick={() => setScale((s) => Math.min(s + 0.25, 4))}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Rotate */}
            <button
              id="lightbox-rotate"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Rotate (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Download Button */}
            <a
              id="lightbox-download-button"
              href={downloadUrl}
              download={message.fileName || 'image.png'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>

            {/* Close Button */}
            <button
              id="lightbox-close-button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Image Container */}
        <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden select-none">
          <motion.img
            src={inlineUrl}
            alt={message.fileName || 'Full view'}
            referrerPolicy="no-referrer"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale, rotate: rotation, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="max-h-[82vh] max-w-[88vw] object-contain rounded-lg shadow-2xl transition-transform"
          />
        </div>

        {/* Caption Bar if present */}
        {message.text && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-xl w-full px-4">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-slate-200 text-sm text-center shadow-lg">
              {message.text}
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
