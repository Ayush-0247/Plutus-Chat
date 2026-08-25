import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { formatFileSize, getFileDownloadUrl, getFileInlineUrl } from '../services/api';

export default function PdfViewerModal({
  isOpen,
  onClose,
  message,
  sessionId,
  participantId,
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

  const inlineUrl = getFileInlineUrl(message.fileId, sessionId, participantId);
  const downloadUrl = getFileDownloadUrl(message.fileId, sessionId, participantId);

  return (
    <AnimatePresence>
      <div
        id="pdf-viewer-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          id="pdf-viewer-container"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-100 truncate font-mono">
                  {message.fileName || 'document.pdf'}
                </h4>
                <p className="text-xs text-slate-400">
                  {formatFileSize(message.fileSize)} • Shared by {message.senderName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                id="pdf-open-new-tab"
                href={inlineUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                title="Open in new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>New Tab</span>
              </a>

              <a
                id="pdf-modal-download-button"
                href={downloadUrl}
                download={message.fileName || 'document.pdf'}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>

              <button
                id="pdf-modal-close-button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* IFrame / Embed View */}
          <div className="flex-1 bg-slate-950 relative">
            <iframe
              src={inlineUrl}
              title={message.fileName || 'PDF Document'}
              className="w-full h-full border-0"
            />
          </div>

          {/* Footer Security Tag */}
          <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Protected session document</span>
            </div>
            <span>Auto-purged on session termination</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}