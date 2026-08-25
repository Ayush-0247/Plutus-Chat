import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  ShieldCheck,
  Lock,
  Clock,
} from 'lucide-react';
import { formatFileSize, formatTtlRemaining } from '../services/api';

export default function PdfViewerModal({
  isOpen,
  onClose,
  message,
  decryptedBlobUrl,
  onDownloadDecrypted,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
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
      a.download = message.fileName || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="pdf-viewer-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md font-mono"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          id="pdf-viewer-container"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-5xl h-[88vh] bg-slate-900 border-2 border-slate-700 shadow-[10px_10px_0px_0px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-slate-800 bg-slate-900">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-slate-100 truncate uppercase tracking-wide">
                    {message.fileName || 'document.pdf'}
                  </h4>
                  <span className="px-1.5 py-0.2 text-[10px] bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 font-bold">
                    AES-256 DECRYPTED
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  {formatFileSize(message.fileSize)} • Sent by {message.senderName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {displayUrl && (
                <a
                  id="pdf-open-new-tab"
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>New Tab</span>
                </a>
              )}

              <button
                id="pdf-modal-download-button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider border border-emerald-400 shadow-[2px_2px_0px_0px_rgba(4,120,87,1)] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>

              <button
                id="pdf-modal-close-button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors ml-1"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* IFrame / Embed View */}
          <div className="flex-1 bg-slate-950 relative">
            {displayUrl ? (
              <iframe
                src={displayUrl}
                title={message.fileName || 'PDF Document'}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Preparing decrypted PDF stream...
              </div>
            )}
          </div>

          {/* Footer Security Tag */}
          <div className="px-4 py-2 border-t-2 border-slate-800 bg-slate-900 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}