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
  Lock,
  ShieldCheck,
  Clock,
  Key,
  Cpu,
} from 'lucide-react';
import { formatFileSize, uploadEncryptedFileWithProgress } from '../services/api';
import { encryptFileBuffer } from '../services/crypto';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];

export default function AttachmentModal({
  isOpen,
  onClose,
  sessionId,
  participantId,
  recipientSharedKeys = new Map(),
  selfWrappingKey = null,
  onSendFileMessage,
  initialFile = null,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [expiresInOption, setExpiresInOption] = useState('NEVER'); // NEVER | 1H | 24H | 7D | 30D
  const [uploadState, setUploadState] = useState('IDLE'); // IDLE | ENCRYPTING | UPLOADING | SUCCESS | ERROR
  const [uploadProgress, setUploadProgress] = useState(0);
  const [cryptoStage, setCryptoStage] = useState('');
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
    setExpiresInOption('NEVER');
    setUploadState('IDLE');
    setUploadProgress(0);
    setCryptoStage('');
    setErrorMessage('');
    setIsDragOver(false);
  };

  const handleFileSelected = (file) => {
    if (!file) return;

    setErrorMessage('');
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;

    // Validate MIME / Extension (PRD Section 7)
    const isImage =
      ALLOWED_IMAGE_TYPES.includes(file.type) ||
      ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
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

    // Create temporary local object URL for preview before encryption
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
    if (!selectedFile || uploadState === 'UPLOADING' || uploadState === 'ENCRYPTING') return;

    setUploadState('ENCRYPTING');
    setCryptoStage('Generating 256-bit AES file key & unique 96-bit IV...');
    setUploadProgress(0);
    setErrorMessage('');

    try {
      // 1. Read file as ArrayBuffer in client memory
      const fileBuffer = await selectedFile.arrayBuffer();

      // 2. Perform Client-Side Authenticated Encryption (AES-256-GCM)
      setCryptoStage('Executing AES-256-GCM encryption & sealing envelopes for peers...');
      const encryptedPackage = await encryptFileBuffer(fileBuffer, {
        recipientSharedKeys,
        selfWrappingKey,
      });

      // 3. Upload only the encrypted ciphertext payload to server (zero plaintext sent)
      setUploadState('UPLOADING');
      setCryptoStage('Uploading encrypted ciphertext payload to server...');

      const res = await uploadEncryptedFileWithProgress({
        ciphertextBlob: encryptedPackage.ciphertextBlob,
        fileName: selectedFile.name,
        originalMimeType: selectedFile.type || 'application/octet-stream',
        originalSize: selectedFile.size,
        encryptionVersion: encryptedPackage.encryptionVersion,
        algorithm: encryptedPackage.algorithm,
        nonce: encryptedPackage.nonce,
        keyEnvelopes: encryptedPackage.keyEnvelopes,
        sha256: encryptedPackage.originalSha256,
        expiresInOption,
        sessionId,
        participantId,
        caption: caption.trim(),
        onProgress: ({ percent }) => {
          setUploadProgress(percent);
        },
      });

      if (res && res.success && res.fileId) {
        setUploadState('SUCCESS');
        const isPdf =
          selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
        const messageType = isPdf ? 'pdf' : 'image';

        // 4. Emit callback with complete cryptographic metadata (local direct key cache included)
        onSendFileMessage({
          type: messageType,
          fileId: res.fileId,
          text: caption.trim(),
          fileName: res.fileName,
          fileSize: res.fileSize,
          encryptedSize: res.encryptedSize,
          mimeType: res.mimeType,
          encryptionVersion: 1,
          algorithm: 'AES-256-GCM',
          nonce: encryptedPackage.nonce,
          keyEnvelopes: encryptedPackage.keyEnvelopes,
          sha256: encryptedPackage.originalSha256,
          directRawKeyBase64: encryptedPackage.rawKeyExported,
          expiresAt: res.expiresAt,
        });

        // Close modal after brief success feedback
        setTimeout(() => {
          onClose();
        }, 400);
      }
    } catch (err) {
      console.error('File encryption/upload error:', err);
      setUploadState('ERROR');
      setErrorMessage(
        err.message || 'File encryption or upload failed. Please verify connection and retry.'
      );
    }
  };

  if (!isOpen) return null;

  const isImage =
    selectedFile &&
    (ALLOWED_IMAGE_TYPES.includes(selectedFile.type) ||
      ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some((ext) =>
        selectedFile.name.toLowerCase().endsWith(ext)
      ));
  const isPdf =
    selectedFile &&
    (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf'));

  return (
    <AnimatePresence>
      <div
        id="attachment-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && uploadState !== 'ENCRYPTING' && uploadState !== 'UPLOADING') {
            onClose();
          }
        }}
      >
        <motion.div
          id="attachment-modal-container"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-xl bg-white border-2 border-slate-900 rounded-none shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] flex flex-col font-mono text-slate-900 overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b-2 border-slate-900 bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/20 border border-emerald-400 text-emerald-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  End-to-End Encrypted File Transfer
                </h3>
                <p className="text-[11px] text-slate-300 font-sans">
                  AES-256-GCM client-side encryption • Server stores ciphertext only
                </p>
              </div>
            </div>
            {uploadState !== 'ENCRYPTING' && uploadState !== 'UPLOADING' && (
              <button
                id="attachment-modal-close-button"
                onClick={onClose}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* File Dropzone / Selector */}
            {!selectedFile ? (
              <div
                id="file-dropzone"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-indigo-600 bg-indigo-50/70 scale-[0.99]'
                    : 'border-slate-400 hover:border-slate-900 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  onChange={handleInputChange}
                  className="hidden"
                />
                <div className="w-12 h-12 bg-white border-2 border-slate-900 flex items-center justify-center mb-3 text-indigo-600 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-xs sm:text-sm font-black uppercase text-slate-900 mb-1">
                  Click to select or drag and drop
                </h4>
                <p className="text-[11px] text-slate-500 font-sans max-w-sm mb-3">
                  Images (JPEG, PNG, WEBP, GIF up to 10 MB) or PDF documents (up to 25 MB).
                </p>
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 border border-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Encrypted in memory with unique AES-256 key before upload</span>
                </div>
              </div>
            ) : (
              /* Selected File Preview & Inspection */
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border-2 border-slate-900 flex items-start gap-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  {isImage && previewUrl ? (
                    <div className="w-16 h-16 bg-slate-950 border border-slate-900 rounded-none overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-rose-50 border-2 border-rose-400 flex items-center justify-center shrink-0 text-rose-600">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-900 truncate font-mono">
                        {selectedFile.name}
                      </p>
                      {uploadState === 'IDLE' && (
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (previewUrl) URL.revokeObjectURL(previewUrl);
                            setPreviewUrl(null);
                          }}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                      <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 font-bold uppercase">
                        {isPdf ? 'PDF DOCUMENT' : selectedFile.type || 'IMAGE'}
                      </span>
                      <span>•</span>
                      <span>Plaintext: {formatFileSize(selectedFile.size)}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-indigo-700">
                      <Lock className="w-3 h-3" />
                      <span>Ready for AES-256-GCM Client Encryption</span>
                    </div>
                  </div>
                </div>

                {/* File Expiration Configuration (PRD Section 29, 30) */}
                <div className="p-3 bg-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-2">
                  <label className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>File Retention & Expiration Policy</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                    {[
                      { label: 'Session Only', value: 'NEVER' },
                      { label: '1 Hour', value: '1H' },
                      { label: '24 Hours', value: '24H' },
                      { label: '7 Days', value: '7D' },
                      { label: '30 Days', value: '30D' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setExpiresInOption(opt.value)}
                        disabled={uploadState === 'ENCRYPTING' || uploadState === 'UPLOADING'}
                        className={`px-2 py-1.5 border-2 text-[11px] font-bold uppercase transition-colors ${
                          expiresInOption === opt.value
                            ? 'bg-indigo-600 border-slate-900 text-white font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans">
                    {expiresInOption === 'NEVER'
                      ? 'File exists only while the session is active. Purged immediately on session termination.'
                      : `Server will reject downloads and permanently purge ciphertext after ${expiresInOption}.`}
                  </p>
                </div>

                {/* Optional Caption */}
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-700">
                    Optional Caption (Max 500 characters)
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a message or description with this file..."
                    maxLength={500}
                    disabled={uploadState === 'ENCRYPTING' || uploadState === 'UPLOADING'}
                    className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-900 text-slate-900 text-xs font-mono focus:bg-white focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Cryptographic Progress & Upload State Bar */}
            {(uploadState === 'ENCRYPTING' || uploadState === 'UPLOADING') && (
              <div className="p-3.5 bg-slate-900 text-white border-2 border-slate-900 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2 text-emerald-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadState === 'ENCRYPTING' ? 'ENCRYPTING CLIENT-SIDE...' : 'UPLOADING CIPHERTEXT...'}</span>
                  </span>
                  <span>{uploadProgress}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-800 border border-slate-700 overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadState === 'ENCRYPTING' ? 45 : Math.max(45, uploadProgress)}%` }}
                    transition={{ ease: 'easeOut', duration: 0.2 }}
                  />
                </div>

                <p className="text-[11px] text-slate-300 font-mono truncate">{cryptoStage}</p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border-2 border-rose-600 text-rose-900 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="font-sans leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Success Feedback */}
            {uploadState === 'SUCCESS' && (
              <div className="p-3 bg-emerald-50 border-2 border-emerald-600 text-emerald-950 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Encrypted payload uploaded & broadcasted to session.</span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t-2 border-slate-900 bg-slate-50 flex items-center justify-end gap-3">
            <button
              id="attachment-modal-cancel-button"
              type="button"
              onClick={onClose}
              disabled={uploadState === 'ENCRYPTING' || uploadState === 'UPLOADING'}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              Cancel
            </button>
            <button
              id="attachment-modal-encrypt-send-button"
              type="button"
              onClick={handleStartUploadAndSend}
              disabled={!selectedFile || uploadState === 'ENCRYPTING' || uploadState === 'UPLOADING'}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Encrypt & Transfer</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}