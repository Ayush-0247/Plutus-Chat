import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Users,
  Copy,
  Check,
  Send,
  UserX,
  AlertTriangle,
  Radio,
  Clock,
  LogOut,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Eye,
  Lock,
  ShieldCheck,
  Trash2,
  Key,
  RefreshCw,
  Cpu,
  AlertCircle,
  HelpCircle,
  FileCode,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  formatFileSize,
  formatTtlRemaining,
  fetchCiphertextBuffer,
  requestDeleteFile,
} from "../services/api";
import { decryptFileBuffer, calculateSha256 } from "../services/crypto";
import AttachmentModal from "./AttachmentModal";
import ImageLightboxModal from "./ImageLightboxModal";
import PdfViewerModal from "./PdfViewerModal";
import SecurityDashboardModal from "./SecurityDashboardModal";
import { playMessageSentSound } from "../services/soundEffects";

export const ActiveSessionView = ({
  sessionData,
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
  onKickParticipant,
  onLeaveSession,
  onEndSession,
  onDeleteFile,
  identityKeyPair,
  derivedSharedKeys = new Map(),
  selfWrappingKey = null,
  securityLogs = [],
  onRotateKeys,
  isRotatingKeys = false,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPasskey, setCopiedPasskey] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);

  // Modals
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [lightboxMessage, setLightboxMessage] = useState(null);
  const [pdfModalMessage, setPdfModalMessage] = useState(null);
  const [inspectCryptoMessage, setInspectCryptoMessage] = useState(null);

  // Drag-and-drop file attachment state
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const [stagedDroppedFile, setStagedDroppedFile] = useState(null);

  // Decrypted blob cache: fileId -> { blobUrl, isDecrypting, error, sha256 }
  const [decryptedFiles, setDecryptedFiles] = useState({});

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const decryptedUrlsRef = useRef(new Set());

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Clean up all generated Object URLs when component unmounts
  useEffect(() => {
    return () => {
      decryptedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      decryptedUrlsRef.current.clear();
    };
  }, []);

  // Automatically decrypt incoming encrypted files
  useEffect(() => {
    messages.forEach((msg) => {
      if (
        (msg.type === "image" || msg.type === "pdf") &&
        msg.fileId &&
        !decryptedFiles[msg.fileId]
      ) {
        decryptMessageFile(msg);
      }
    });
  }, [messages, derivedSharedKeys]);

  const decryptMessageFile = async (msg, simulateTamper = false) => {
    const fileId = msg.fileId;
    if (!fileId) return;

    setDecryptedFiles((prev) => ({
      ...prev,
      [fileId]: { isDecrypting: true, error: null, blobUrl: null },
    }));

    try {
      // 1. Fetch raw ciphertext from server
      let ciphertextBuffer = await fetchCiphertextBuffer(
        fileId,
        sessionData.sessionId,
        sessionData.participantId,
      );

      // Simulation of Tamper Protection (PRD Section 25 & 42)
      if (simulateTamper) {
        const corruptedBytes = new Uint8Array(ciphertextBuffer);
        // Flip bits in the middle of ciphertext
        if (corruptedBytes.length > 20) {
          corruptedBytes[15] ^= 0xff;
        }
        ciphertextBuffer = corruptedBytes.buffer;
      }

      // 2. Determine wrapping key (sender shared key or selfWrappingKey)
      let wrappingKey = selfWrappingKey;
      if (msg.senderId !== sessionData.participantId) {
        wrappingKey = derivedSharedKeys.get(msg.senderId) || null;
      }

      // 3. Decrypt client-side via AES-256-GCM
      const plaintextBuffer = await decryptFileBuffer({
        ciphertextBuffer,
        nonce: msg.nonce,
        keyEnvelopes: msg.keyEnvelopes || {},
        currentParticipantId: sessionData.participantId,
        sharedWrappingKey: wrappingKey,
        directRawKeyBase64: msg.directRawKeyBase64 || null,
        expectedSha256: msg.sha256 || null,
      });

      // 4. Create local Object URL
      const mimeType =
        msg.mimeType || (msg.type === "pdf" ? "application/pdf" : "image/jpeg");
      const blob = new Blob([plaintextBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      decryptedUrlsRef.current.add(blobUrl);

      setDecryptedFiles((prev) => ({
        ...prev,
        [fileId]: {
          isDecrypting: false,
          blobUrl,
          error: null,
          isCorrupted: false,
          sha256: msg.sha256,
        },
      }));
    } catch (err) {
      console.warn(`Decryption failed for file ${fileId}:`, err);
      setDecryptedFiles((prev) => ({
        ...prev,
        [fileId]: {
          isDecrypting: false,
          blobUrl: null,
          error:
            err.message ||
            "Unable to verify this file. The file may be corrupted or unavailable.",
          isCorrupted: true,
        },
      }));
    }
  };

  const handleDownloadDecryptedFile = async (msg) => {
    const fileState = decryptedFiles[msg.fileId];
    if (fileState?.blobUrl) {
      const a = document.createElement("a");
      a.href = fileState.blobUrl;
      a.download =
        msg.fileName || (msg.type === "pdf" ? "document.pdf" : "image.png");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Re-run decryption and download
      await decryptMessageFile(msg);
    }
  };

  const handleDownloadRawCiphertext = async (msg) => {
    try {
      const ciphertext = await fetchCiphertextBuffer(
        msg.fileId,
        sessionData.sessionId,
        sessionData.participantId,
      );
      const blob = new Blob([ciphertext], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${msg.fileName || "file"}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(`Could not download ciphertext: ${err.message}`);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (
      !window.confirm(
        "Permanently purge this encrypted file from server memory for all participants?",
      )
    ) {
      return;
    }
    try {
      await requestDeleteFile(
        fileId,
        sessionData.sessionId,
        sessionData.participantId,
      );
      if (onDeleteFile) {
        onDeleteFile(fileId);
      }
      setDecryptedFiles((prev) => {
        const next = { ...prev };
        if (next[fileId]?.blobUrl) {
          URL.revokeObjectURL(next[fileId].blobUrl);
          decryptedUrlsRef.current.delete(next[fileId].blobUrl);
        }
        delete next[fileId];
        return next;
      });
    } catch (err) {
      alert(`Failed to delete file: ${err.message}`);
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1200);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);

    onSendMessage(inputText.trim());
    setInputText("");
    playMessageSentSound();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSendFileCallback = (fileData) => {
    onSendMessage("", fileData);
    playMessageSentSound();
  };

  const handleCopyLink = () => {
    const origin = window.location.origin;
    const shareableUrl = `${origin}/#join?session=${sessionData.sessionId}&passkey=${sessionData.passkey}`;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPasskey = () => {
    navigator.clipboard.writeText(sessionData.passkey);
    setCopiedPasskey(true);
    setTimeout(() => setCopiedPasskey(false), 2000);
  };

  // Drag and drop onto chat feed
  const handleChatDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverChat(true);
  };

  const handleChatDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverChat(false);
  };

  const handleChatDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverChat(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setStagedDroppedFile(file);
      setIsAttachmentModalOpen(true);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 pb-8">
      {/* Session Security & Key Exchange Bar */}
      <div className="bg-white border-2 border-slate-900 p-4 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] font-mono">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Session ID & Passkey */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">
                LINE ID:
              </span>
              <span
                id="active_session_id_badge"
                className="px-2.5 py-1 bg-slate-900 text-white font-black text-xs sm:text-sm tracking-wider"
              >
                {sessionData.sessionId}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">
                PASSKEY:
              </span>
              <span
                id="active_session_passkey_badge"
                className="px-2.5 py-1 bg-indigo-50 text-indigo-900 border-2 border-slate-900 font-black text-xs sm:text-sm tracking-wider"
              >
                {sessionData.passkey}
              </span>
              <button
                id="copy_passkey_button"
                onClick={handleCopyPasskey}
                title="Copy Passkey"
                className="p-1.5 bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                {copiedPasskey ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <button
              id="copy_invite_link_button"
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Share Dual-Factor Link</span>
                </>
              )}
            </button>
          </div>

          {/* Right: E2EE Security Status & Actions */}
          <div className="flex items-center gap-2">
            <button
              id="open_security_dashboard_button"
              onClick={() => setIsSecurityModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-700 text-emerald-950 font-bold text-xs flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(4,120,87,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">E2EE:</span>
              <span className="font-black text-emerald-800">AES-256-GCM</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            </button>

            {sessionData.isOwner ? (
              <button
                id="owner_end_session_trigger"
                onClick={() => setShowEndConfirm(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>End Session</span>
              </button>
            ) : (
              <button
                id="participant_leave_session_button"
                onClick={onLeaveSession}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Line</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Grid: Left Sidebar (Participants) + Right (Encrypted Message Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Participant Roster */}
        <div className="lg:col-span-1 bg-white border-2 border-slate-900 p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col font-mono">
          <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-slate-900">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-700" />
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-900">
                Connected ({sessionData.participants.length})
              </h3>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-500">
              RAM ONLY
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {sessionData.participants.map((p) => {
              const isSelf = p.participantId === sessionData.participantId;
              return (
                <div
                  key={p.participantId}
                  className={`p-2.5 border-2 text-xs transition-colors flex items-center justify-between gap-2 ${
                    isSelf
                      ? "bg-indigo-50/80 border-indigo-600 text-slate-900 font-bold"
                      : "bg-slate-50 border-slate-900 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.isOwner ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{p.username}</span>
                        {isSelf && (
                          <span className="text-[9px] px-1 bg-indigo-600 text-white font-black">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1">
                        {p.isOwner && (
                          <span className="text-amber-700 font-black">
                            OWNER •{" "}
                          </span>
                        )}
                        <span>
                          {p.fingerprint
                            ? `FP: ${p.fingerprint.slice(0, 9)}...`
                            : "ECDH Synced"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {sessionData.isOwner && !p.isOwner && !isSelf && (
                    <button
                      onClick={() => setKickTarget(p)}
                      title={`Kick ${p.username}`}
                      className="p-1 bg-white hover:bg-rose-50 border border-rose-600 text-rose-600 shrink-0 transition-colors shadow-[1px_1px_0px_0px_rgba(225,29,72,1)] active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Identity Key Fingerprint Quick-Inspect */}
          <div className="mt-4 pt-3 border-t-2 border-slate-900 text-[10px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 font-bold">
              <span className="flex items-center gap-1">
                <Key className="w-3 h-3 text-indigo-600" />
                YOUR ECDH KEY:
              </span>
              <span className="font-mono text-slate-900 font-black">
                {identityKeyPair?.fingerprint || "ECDH-P256"}
              </span>
            </div>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-900 text-slate-900 font-bold text-[10px] uppercase flex items-center justify-center gap-1 transition-colors"
            >
              <Cpu className="w-3 h-3 text-indigo-600" />
              <span>Inspect E2EE Audit Logs</span>
            </button>
          </div>
        </div>

        {/* Right: Message Stream & Encrypted File Vault */}
        <div
          onDragOver={handleChatDragOver}
          onDragLeave={handleChatDragLeave}
          onDrop={handleChatDrop}
          className={`lg:col-span-3 bg-white border-2 border-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col h-[580px] font-mono relative ${
            isDraggingOverChat
              ? "ring-4 ring-indigo-600 ring-inset bg-indigo-50/30"
              : ""
          }`}
        >
          {/* Drag Overlay Prompt */}
          {isDraggingOverChat && (
            <div className="absolute inset-0 z-30 bg-indigo-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none p-6 text-center">
              <div className="w-14 h-14 bg-white text-indigo-600 border-2 border-slate-900 flex items-center justify-center mb-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider mb-1">
                Drop File to Encrypt & Send
              </h3>
              <p className="text-xs text-indigo-200 font-sans">
                AES-256-GCM authenticated encryption will execute on your device
              </p>
            </div>
          )}

          {/* Chat Messages Log */}
          <div
            id="chat_messages_feed"
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-12 h-12 bg-white border-2 border-slate-900 text-slate-400 flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  <ShieldCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-1">
                  Secure Ephemeral Line Active
                </p>
                <p className="text-[11px] font-sans max-w-sm text-slate-500">
                  Real-time text & AES-256-GCM encrypted image/PDF transfers.
                  All contents exist purely in client and server RAM.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelf = msg.senderId === sessionData.participantId;
                const isSystem = msg.isSystem;
                const time = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                // System notifications
                if (isSystem) {
                  return (
                    <div
                      key={msg.messageId}
                      className="py-1.5 px-3 bg-slate-100 border border-slate-300 text-slate-700 text-[11px] font-mono text-center mx-auto max-w-md shadow-xs"
                    >
                      <span className="font-bold text-indigo-700">
                        • {msg.text}
                      </span>{" "}
                      <span className="text-slate-400 text-[10px]">
                        ({time})
                      </span>
                    </div>
                  );
                }

                // File Messages (Encrypted Image / PDF)
                const isFile = msg.type === "image" || msg.type === "pdf";
                const fileState = isFile ? decryptedFiles[msg.fileId] : null;
                const canDelete =
                  sessionData.isOwner ||
                  msg.senderId === sessionData.participantId;

                return (
                  <div
                    key={msg.messageId}
                    className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-600 font-bold">
                      <span
                        className={
                          msg.isOwner ? "text-amber-800" : "text-slate-800"
                        }
                      >
                        {msg.senderName}
                      </span>
                      {msg.isOwner && (
                        <span className="px-1 text-[9px] bg-amber-300 border border-slate-900 font-black">
                          OWNER
                        </span>
                      )}
                      <span className="text-slate-400 font-mono text-[10px]">
                        {time}
                      </span>
                    </div>

                    {/* Standard Text Bubble */}
                    {!isFile && (
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] p-3 border-2 font-mono text-xs shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] break-words leading-relaxed ${
                          isSelf
                            ? "bg-indigo-600 text-white border-slate-900"
                            : "bg-white text-slate-900 border-slate-900"
                        }`}
                      >
                        {msg.text}
                      </div>
                    )}

                    {/* Encrypted File Card (PRD Phase 3) */}
                    {isFile && (
                      <div
                        className={`max-w-[90%] sm:max-w-[82%] p-3.5 border-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-mono text-xs space-y-3 ${
                          isSelf
                            ? "bg-indigo-50/90 border-indigo-700 text-slate-900"
                            : "bg-white border-slate-900 text-slate-900"
                        }`}
                      >
                        {/* File Card Header & E2EE Badges */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-300">
                          <div className="flex items-center gap-1.5">
                            <span className="p-1 bg-emerald-100 border border-emerald-500 text-emerald-800">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                              AES-256-GCM
                            </span>
                            {msg.expiresAt && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{formatTtlRemaining(msg.expiresAt)}</span>
                              </span>
                            )}
                          </div>

                          {/* Delete File Trigger (Owner or Uploader) */}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteFile(msg.fileId)}
                              title="Delete file from server RAM"
                              className="p-1 hover:bg-rose-100 text-rose-600 border border-transparent hover:border-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* File Metadata & Preview */}
                        <div className="flex items-start gap-3">
                          {/* Thumbnail / File Icon */}
                          {msg.type === "image" ? (
                            <div
                              onClick={() => {
                                if (fileState?.blobUrl) {
                                  setLightboxMessage({
                                    ...msg,
                                    decryptedBlobUrl: fileState.blobUrl,
                                  });
                                }
                              }}
                              className="w-20 h-20 bg-slate-950 border-2 border-slate-900 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer relative group"
                            >
                              {fileState?.blobUrl ? (
                                <>
                                  <img
                                    src={fileState.blobUrl}
                                    alt={msg.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Eye className="w-5 h-5" />
                                  </div>
                                </>
                              ) : fileState?.isCorrupted ? (
                                <div className="p-1 text-center text-[9px] text-rose-400 font-bold">
                                  CORRUPTED
                                </div>
                              ) : (
                                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (fileState?.blobUrl) {
                                  setPdfModalMessage({
                                    ...msg,
                                    decryptedBlobUrl: fileState.blobUrl,
                                  });
                                }
                              }}
                              className="w-20 h-20 bg-rose-50 border-2 border-rose-500 flex flex-col items-center justify-center shrink-0 text-rose-600 cursor-pointer hover:bg-rose-100 transition-colors"
                            >
                              <FileText className="w-8 h-8" />
                              <span className="text-[9px] font-black mt-1">
                                PDF
                              </span>
                            </div>
                          )}

                          {/* File Details */}
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-xs text-slate-900 truncate font-mono">
                              {msg.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Size: {formatFileSize(msg.fileSize)}
                              {msg.encryptedSize && (
                                <span className="text-slate-400">
                                  {" "}
                                  (Cipher: {formatFileSize(msg.encryptedSize)})
                                </span>
                              )}
                            </p>

                            {/* Integrity Verification Status */}
                            {fileState?.isDecrypting && (
                              <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1 mt-1">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>
                                  Decrypting & verifying AES-256 integrity...
                                </span>
                              </p>
                            )}

                            {fileState?.blobUrl && (
                              <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Authentic (128-bit tag verified)</span>
                              </p>
                            )}

                            {fileState?.error && (
                              <div className="mt-1 p-2 bg-rose-50 border border-rose-400 text-rose-900 text-[10px] font-sans flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                <span>{fileState.error}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Caption if provided */}
                        {msg.text && (
                          <p className="text-xs text-slate-800 font-sans p-2 bg-slate-100 border border-slate-300">
                            {msg.text}
                          </p>
                        )}

                        {/* File Action Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200">
                          <div className="flex items-center gap-1.5">
                            {msg.type === "image" ? (
                              <button
                                onClick={() => {
                                  if (fileState?.blobUrl) {
                                    setLightboxMessage({
                                      ...msg,
                                      decryptedBlobUrl: fileState.blobUrl,
                                    });
                                  }
                                }}
                                disabled={!fileState?.blobUrl}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-900 text-slate-900 font-bold text-[11px] flex items-center gap-1 shadow-xs"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (fileState?.blobUrl) {
                                    setPdfModalMessage({
                                      ...msg,
                                      decryptedBlobUrl: fileState.blobUrl,
                                    });
                                  }
                                }}
                                disabled={!fileState?.blobUrl}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-900 text-slate-900 font-bold text-[11px] flex items-center gap-1 shadow-xs"
                              >
                                <FileText className="w-3 h-3 text-rose-600" />
                                <span>View PDF</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDownloadDecryptedFile(msg)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 border border-slate-900 shadow-xs"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1 text-[10px]">
                            {/* Inspect Crypto Metadata */}
                            <button
                              onClick={() => setInspectCryptoMessage(msg)}
                              className="px-2 py-0.8 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                              title="Inspect cryptographic envelopes, nonce, and checksum"
                            >
                              <FileCode className="w-3 h-3 text-indigo-600" />
                              <span>Crypto Info</span>
                            </button>

                            {/* Simulate Tamper Test */}
                            <button
                              onClick={() => decryptMessageFile(msg, true)}
                              className="px-2 py-0.8 bg-amber-100 hover:bg-amber-200 border border-amber-500 text-amber-900 font-bold text-[10px] flex items-center gap-1"
                              title="Simulate ciphertext corruption to verify strict rejection"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              <span>Test Tamper</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Live Typing Status */}
            {typingUsers.length > 0 && (
              <div className="text-[11px] text-indigo-700 font-bold italic flex items-center gap-1.5 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping" />
                <span>
                  {typingUsers.join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Bar with Attachment Trigger */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t-2 border-slate-900 bg-white"
          >
            <div className="flex items-center gap-2">
              {/* Attachment Button */}
              <button
                id="open_attachment_modal_button"
                type="button"
                onClick={() => {
                  setStagedDroppedFile(null);
                  setIsAttachmentModalOpen(true);
                }}
                title="Send encrypted Image (Max 10MB) or PDF (Max 25MB)"
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Paperclip className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Encrypt File</span>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type real-time message, or attach encrypted file... (Enter to send)"
                maxLength={2000}
                autoFocus
                className="flex-1 px-4 py-2.5 bg-slate-50 border-2 border-slate-900 focus:border-indigo-600 focus:bg-white text-slate-900 placeholder-slate-400 text-xs font-mono focus:outline-none shadow-inner"
              />

              <button
                id="send_message_button"
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus:outline-none"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Attachment Upload Modal */}
      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => {
          setIsAttachmentModalOpen(false);
          setStagedDroppedFile(null);
        }}
        sessionId={sessionData.sessionId}
        participantId={sessionData.participantId}
        recipientSharedKeys={derivedSharedKeys}
        selfWrappingKey={selfWrappingKey}
        onSendFileMessage={handleSendFileCallback}
        initialFile={stagedDroppedFile}
      />

      {/* Security Dashboard & Cryptography Center */}
      <SecurityDashboardModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        sessionData={sessionData}
        identityKeyPair={identityKeyPair}
        securityLogs={securityLogs}
        onRotateKeys={onRotateKeys}
        isRotatingKeys={isRotatingKeys}
      />

      {/* Image Lightbox Viewer Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxMessage)}
        onClose={() => setLightboxMessage(null)}
        message={lightboxMessage}
        decryptedBlobUrl={lightboxMessage?.decryptedBlobUrl}
        onDownloadDecrypted={handleDownloadDecryptedFile}
      />

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={Boolean(pdfModalMessage)}
        onClose={() => setPdfModalMessage(null)}
        message={pdfModalMessage}
        decryptedBlobUrl={pdfModalMessage?.decryptedBlobUrl}
        onDownloadDecrypted={handleDownloadDecryptedFile}
      />

      {/* Individual File Cryptographic Inspector Modal */}
      {inspectCryptoMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-mono">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white border-2 border-slate-900 p-5 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-900">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                <h4 className="font-black text-sm uppercase text-slate-900">
                  File Cryptographic Package
                </h4>
              </div>
              <button
                onClick={() => setInspectCryptoMessage(null)}
                className="p-1 hover:bg-slate-100 text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-800">
              <div className="p-2 bg-slate-50 border border-slate-300">
                <span className="text-slate-500 font-bold block">
                  FILE NAME:
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {inspectCryptoMessage.fileName}
                </span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-300">
                <span className="text-slate-500 font-bold block">
                  ALGORITHM:
                </span>
                <span className="font-mono font-bold text-emerald-700">
                  AES-256-GCM (128-bit Auth Tag)
                </span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-300">
                <span className="text-slate-500 font-bold block">
                  96-BIT NONCE / IV (BASE64):
                </span>
                <span className="font-mono text-[11px] text-indigo-700 break-all">
                  {inspectCryptoMessage.nonce || "CSPRNG Random"}
                </span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-300">
                <span className="text-slate-500 font-bold block">
                  PLAINTEXT SHA-256 FINGERPRINT:
                </span>
                <span className="font-mono text-[11px] text-slate-900 break-all">
                  {inspectCryptoMessage.sha256 || "Calculated on upload"}
                </span>
              </div>
              <div className="p-2 bg-slate-50 border border-slate-300">
                <span className="text-slate-500 font-bold block">
                  EXPIRATION TIMESTAMP:
                </span>
                <span className="font-mono text-slate-700">
                  {inspectCryptoMessage.expiresAt
                    ? new Date(inspectCryptoMessage.expiresAt).toLocaleString()
                    : "Session Lifetime (Purged on exit)"}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t-2 border-slate-200 flex items-center justify-between">
              <button
                onClick={() =>
                  handleDownloadRawCiphertext(inspectCryptoMessage)
                }
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-900 text-slate-900 text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Raw .enc</span>
              </button>
              <button
                onClick={() => setInspectCryptoMessage(null)}
                className="px-4 py-1.5 bg-slate-900 text-white font-black text-xs uppercase"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal: Owner End Session */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white border-2 border-slate-900 p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] font-mono"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4 pb-2 border-b-2 border-slate-900">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wider text-slate-900">
                Terminate Ephemeral Line?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              This will initiate a 15-second countdown, disconnect all{" "}
              {sessionData.participants.length} participants, and permanently
              purge all messages and encrypted files from server RAM.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                id="cancel_end_session_button"
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
              >
                Cancel
              </button>
              <button
                id="confirm_end_session_button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndSession();
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
              >
                End & Wipe Session
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal: Kick Participant */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white border-2 border-slate-900 p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] font-mono"
          >
            <div className="flex items-center gap-3 text-amber-600 mb-4 pb-2 border-b-2 border-slate-900">
              <UserX className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black uppercase tracking-wider text-slate-900">
                Kick & Bar Participant?
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-2">
              Are you sure you want to remove{" "}
              <strong className="text-slate-900 font-bold">
                {kickTarget.username}
              </strong>
              ?
            </p>
            <p className="text-[11px] text-amber-950 font-bold leading-relaxed mb-5 p-2.5 bg-amber-50 border-2 border-amber-500">
              PRD Invariant 3: Kicked participants are permanently banned from
              rejoining this active session even if they have the link and
              passkey.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                id="cancel_kick_button"
                onClick={() => setKickTarget(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
              >
                Cancel
              </button>
              <button
                id="confirm_kick_button"
                onClick={() => {
                  const targetId = kickTarget.participantId;
                  setKickTarget(null);
                  onKickParticipant(targetId);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
              >
                Kick & Ban
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ActiveSessionView;
