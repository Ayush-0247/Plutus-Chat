import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { formatFileSize, uploadFileWithProgress } from '../services/api';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];

export default function AttachmentModal({
  isOpen,
  onClose,
  sessionId,
  participantId,
  onSendFileMessage,
  initialFile = null,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploadState, setUploadState] = useState('IDLE'); // IDLE | UPLOADING | SUCCESS | ERROR
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);

  // Initialize with passed file if provided
  useEffect(() => {
    if (initialFile && isOpen) {
      handleFileSelected(initialFile);
    }
  }, [initialFile, isOpen]);

  // Clean up object URL when closing or changing
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setUploadState('IDLE');
    setUploadProgress(0);
    setErrorMessage('');
    setIsDragOver(false);
  };

  const handleFileSelected = (file) => {
    if (!file) return;

    setErrorMessage('');
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;

    // Validate MIME / Extension (PRD Section 10, 11)
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) || ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    const isPdf = file.type === 'application/pdf' || ext === '.pdf';

    if (!isImage && !isPdf) {
      setErrorMessage('This file type is not supported. Allowed formats: JPEG, PNG, WEBP, GIF, PDF.');
      return;
    }

    // Validate size
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      setErrorMessage(`Image exceeds the maximum allowed size (10 MB). Selected: ${formatFileSize(file.size)}.`);
      return;
    }

    if (isPdf && file.size > MAX_PDF_SIZE) {
      setErrorMessage(`PDF exceeds the maximum allowed size (25 MB). Selected: ${formatFileSize(file.size)}.`);
      return;
    }

    setSelectedFile(file);

    // Create object URL for preview if image
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleStartUploadAndSend = async () => {
    if (!selectedFile || uploadState === 'UPLOADING') return;

    setUploadState('UPLOADING');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      // 1. Upload file binary via HTTP multipart/form-data
      const res = await uploadFileWithProgress({
        file: selectedFile,
        sessionId,
        participantId,
        caption: caption.trim(),
        onProgress: ({ percent }) => {
          setUploadProgress(percent);
        },
      });

      if (res && res.success && res.fileId) {
        setUploadState('SUCCESS');
        const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
        const messageType = isPdf ? 'pdf' : 'image';

        // 2. Emit WebSocket message metadata
        onSendFileMessage({
          type: messageType,
          fileId: res.fileId,
          text: caption.trim(),
          fileName: res.fileName,
          fileSize: res.fileSize,
          mimeType: res.mimeType,
        });

        // Close modal after brief success confirmation
        setTimeout(() => {
          onClose();
        }, 400);
      }
    } catch (err) {
      setUploadState('ERROR');
      setErrorMessage(err.message || 'File upload failed. Please verify connection and retry.');
    }
  };

  if (!isOpen) return null;

  const isPdf = selectedFile && (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf'));

  return (
    <AnimatePresence>
      <div
        id="attachment-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        onClick={(e) => {
          if (e.target === e.currentTarget && uploadState !== 'UPLOADING') {
            onClose();
          }
        }}
      >
        <motion.div
          id="attachment-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 text-base leading-snug">
                  Secure File Transfer
                </h3>
                <p className="text-xs text-slate-400">
                  Ephemeral, zero-cloud encrypted line
                </p>
              </div>
            </div>
            <button
              id="attachment-modal-close-button"
              onClick={onClose}
              disabled={uploadState === 'UPLOADING'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {/* Error Banner */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-rose-200">Transfer Issue</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </motion.div>
            )}

            {!selectedFile ? (
              /* Dropzone Selector */
              <div
                id="file-dropzone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                    : 'border-slate-700 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={handleInputChange}
                />

                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mb-3 shadow-inner">
                  <Upload className="w-6 h-6 text-emerald-400" />
                </div>

                <p className="text-sm font-medium text-slate-200">
                  Click to select or drag & drop file
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Images up to <span className="text-slate-200 font-medium">10 MB</span> (JPEG, PNG, WEBP, GIF)
                  <br />
                  PDF Documents up to <span className="text-slate-200 font-medium">25 MB</span>
                </p>

                <div className="flex items-center gap-3 mt-4 text-[11px] text-slate-500 font-mono">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" /> Images
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF Files
                  </span>
                </div>
              </div>
            ) : (
              /* Selected File Preview & Staging */
              <div className="space-y-4">
                {/* Image Preview or PDF Card */}
                {!isPdf && previewUrl ? (
                  <div className="relative rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden flex items-center justify-center max-h-64 group">
                    <img
                      src={previewUrl}
                      alt={selectedFile.name}
                      referrerPolicy="no-referrer"
                      className="max-h-60 w-auto object-contain rounded-lg"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-90 pointer-events-none" />
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                      <span className="truncate max-w-[240px] font-mono text-[11px]">
                        {selectedFile.name}
                      </span>
                      <span className="font-mono bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
                        {formatFileSize(selectedFile.size)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-700/80 bg-slate-800/60">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate font-mono">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold text-[10px]">
                          PDF
                        </span>
                        <span>•</span>
                        <span>{formatFileSize(selectedFile.size)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Caption Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Optional Message Caption
                  </label>
                  <input
                    id="attachment-caption-input"
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add an optional note or caption..."
                    disabled={uploadState === 'UPLOADING'}
                    maxLength={500}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleStartUploadAndSend();
                      }
                    }}
                  />
                </div>

                {/* Uploading Progress Bar (PRD Section 26) */}
                {uploadState === 'UPLOADING' && (
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-emerald-400 flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading secure file...
                      </span>
                      <span className="text-slate-300 font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
            {selectedFile ? (
              <button
                id="attachment-change-file-button"
                type="button"
                onClick={resetState}
                disabled={uploadState === 'UPLOADING'}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
              >
                Choose different file
              </button>
            ) : (
              <span className="text-xs text-slate-500">
                Encrypted in-flight & memory-purged on close
              </span>
            )}

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                id="attachment-cancel-button"
                type="button"
                onClick={onClose}
                disabled={uploadState === 'UPLOADING'}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>

              {selectedFile && (
                <button
                  id="attachment-send-button"
                  type="button"
                  onClick={handleStartUploadAndSend}
                  disabled={uploadState === 'UPLOADING'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {uploadState === 'UPLOADING' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : uploadState === 'ERROR' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Upload</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send {isPdf ? 'PDF' : 'Image'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
