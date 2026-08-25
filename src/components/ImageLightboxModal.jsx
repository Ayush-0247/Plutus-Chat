import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Lock,
  ShieldCheck,
  HardDrive,
  FileCheck,
  Clock,
} from 'lucide-react';
import { formatFileSize, formatTtlRemaining } from '../services/api';

export default function ImageLightboxModal({
  isOpen,
  onClose,
  message,
  decryptedBlobUrl,
  onDownloadDecrypted,
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

  const displayUrl = decryptedBlobUrl || message.decryptedBlobUrl || '';

  const handleDownload = () => {
    if (onDownloadDecrypted) {
      onDownloadDecrypted(message);
    } else if (displayUrl) {
      const a = document.createElement('a');
      a.href = displayUrl;
      a.download = message.fileName || 'image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="image-lightbox-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Top Control Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between z-10 font-mono">
          <div className="flex items-center gap-3">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-500/20 text-emerald-400 border border-emerald-400/40">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider truncate max-w-xs sm:max-w-md">
                  {message.fileName || 'Decrypted Image'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {formatFileSize(message.fileSize)} • AES-256-GCM Verified • Sent by {message.senderName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Out */}
            <button
              id="lightbox-zoom-out"
              onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
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
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {/* Rotate */}
            <button
              id="lightbox-rotate"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Rotate (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Download Button */}
            <button
              id="lightbox-download-button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider border border-emerald-400 transition-colors shadow-[2px_2px_0px_0px_rgba(4,120,87,1)]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            {/* Close Button */}
            <button
              id="lightbox-close-button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-300 text-slate-400 border border-slate-700 transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Image Container */}
        <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden select-none">
          {displayUrl ? (
            <motion.img
              src={displayUrl}
              alt={message.fileName || 'Decrypted Image'}
              referrerPolicy="no-referrer"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale, rotate: rotation, opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-h-[82vh] max-w-[88vw] object-contain border-2 border-slate-800 shadow-2xl transition-transform"
            />
          ) : (
            <div className="p-8 text-center text-slate-400 font-mono text-xs">
              Decrypted payload is being prepared...
            </div>
          )}
        </div>

        {/* Security & Caption Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-xl w-full px-4 font-mono">
          <div className="p-3 bg-slate-900/95 border-2 border-slate-800 backdrop-blur-md text-slate-200 text-xs shadow-xl space-y-1.5">
            {message.text && (
              <p className="text-white font-sans text-sm pb-1 border-b border-slate-800">
                {message.text}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256: {message.sha256 ? `${message.sha256.slice(0, 16)}...` : 'Verified Authentic'}</span>
              </div>
              {message.expiresAt && (
                <div className="flex items-center gap-1 text-amber-400">
                  <Clock className="w-3 h-3" />
                  <span>Expires: {formatTtlRemaining(message.expiresAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}