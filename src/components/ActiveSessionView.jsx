import React, { useState, useRef, useEffect } from "react";
import {
  Copy,
  Check,
  Power,
  Users,
  Send,
  UserX,
  Radio,
  ExternalLink,
  Crown,
  LogOut,
  AlertTriangle,
  Info,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Download,
  Eye,
  UploadCloud,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  playMessageSentSound,
  playFileSentSound,
} from "../services/soundEffects.js";
import AttachmentModal from "./AttachmentModal.jsx";
import ImageLightboxModal from "./ImageLightboxModal.jsx";
import PdfViewerModal from "./PdfViewerModal.jsx";
import {
  formatFileSize,
  getFileDownloadUrl,
  getFileInlineUrl,
} from "../services/api.js";

export const ActiveSessionView = ({
  sessionData,
  messages,
  typingUsers,
  onSendMessage,
  onSendFileMessage,
  onTyping,
  onKickParticipant,
  onLeaveSession,
  onEndSession,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);

  // Phase 2 Attachment & Modals State
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [stagedDroppedFile, setStagedDroppedFile] = useState(null);
  const [lightboxMessage, setLightboxMessage] = useState(null);
  const [pdfModalMessage, setPdfModalMessage] = useState(null);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Global drag-and-drop listener for the active session view
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOverChat(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOverChat(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverChat(false);
    dragCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      setStagedDroppedFile(file);
      setIsAttachmentModalOpen(true);
    }
  };

  // Copy handlers
  const handleCopyId = () => {
    navigator.clipboard.writeText(sessionData.sessionId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(sessionData.passkey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}?join=${sessionData.sessionId}&key=${sessionData.passkey}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenTestTab = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}?join=${sessionData.sessionId}&key=${sessionData.passkey}`;
    window.open(inviteUrl, "_blank");
  };

  // Text input change & typing trigger
  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSendMessage(trimmed);
    playMessageSentSound();
    setInputText("");
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    inputRef.current?.focus();
  };

  const handleSendFileCallback = (filePayload) => {
    if (typeof onSendFileMessage === "function") {
      onSendFileMessage(filePayload);
      playFileSentSound();
    }
  };

  const isOwner = sessionData.isOwner;

  return (
    <div
      className="w-full h-[670px] box-border px-1 sm:px-2 py-1 sm:py-3 flex flex-col font-mono bg-slate-50 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag & Drop Fullscreen Dropzone Overlay */}
      <AnimatePresence>
        {isDraggingOverChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-indigo-950/80 backdrop-blur-sm border-4 border-dashed border-indigo-400 m-2 flex flex-col items-center justify-center text-white pointer-events-none"
          >
            <div className="p-4 bg-indigo-900/90 rounded-2xl border-2 border-indigo-400 flex flex-col items-center text-center shadow-2xl">
              <UploadCloud className="w-12 h-12 text-indigo-300 animate-bounce mb-2" />
              <h3 className="text-base font-black uppercase tracking-wider">
                Drop to Encrypt & Transfer
              </h3>
              <p className="text-xs text-indigo-200 mt-1">
                Images (Max 10 MB) • PDF Documents (Max 25 MB)
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Credentials & Actions Bar */}
      <div className="bg-white border-2 border-slate-900 rounded-none p-3 sm:p-4 mb-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Credentials Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border-2 border-slate-900">
              <span className="text-slate-500 text-[10px] uppercase font-black">
                SESSION:
              </span>
              <span className="font-black text-indigo-700 tracking-wider">
                {sessionData.sessionId}
              </span>
              <button
                onClick={handleCopyId}
                title="Copy Session ID"
                className="p-1 hover:text-indigo-700 text-slate-500 transition-colors"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 border-2 border-slate-900">
              <span className="text-slate-500 text-[10px] uppercase font-black">
                PASSKEY:
              </span>
              <span className="font-black text-amber-700 tracking-wider">
                {sessionData.passkey}
              </span>
              <button
                onClick={handleCopyKey}
                title="Copy Passkey"
                className="p-1 hover:text-amber-700 text-slate-500 transition-colors"
              >
                {copiedKey ? (
                  <Check className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <button
              id="copy_invite_link_button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 border-2 border-indigo-700 hover:bg-indigo-100 text-indigo-950 font-black text-xs transition-colors shadow-[2px_2px_0px_0px_rgba(79,70,229,0.3)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-indigo-700" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {copiedLink ? "INVITE LINK COPIED!" : "COPY INVITE LINK"}
              </span>
            </button>

            <button
              id="open_tab_test_button"
              onClick={handleOpenTestTab}
              title="Open Joiner instance in another browser tab to test Owner & Joiner communication"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border-2 border-slate-900 hover:bg-slate-100 text-slate-900 font-bold text-xs transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
              <span>TEST IN TAB</span>
            </button>
          </div>

          {/* Action Buttons: Toggle Participants, End Session (Owner), Leave Session (Participant) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border-2 border-slate-900 text-slate-900 font-bold text-xs"
            >
              <Users className="w-3.5 h-3.5" />
              <span>({sessionData.participants.length})</span>
            </button>

            {isOwner ? (
              <button
                id="end_session_button"
                onClick={() => setShowEndConfirm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider transition-colors border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Power className="w-3.5 h-3.5" />
                <span>TERMINATE SESSION</span>
              </button>
            ) : (
              <button
                id="leave_session_button"
                onClick={onLeaveSession}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold text-xs uppercase transition-colors border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>LEAVE</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace: Sidebar & Realtime Feed */}
      <div className="flex-1 flex gap-3 min-h-0 relative">
        {/* Participants Sidebar */}
        <div
          className={`
            ${sidebarOpen ? "flex absolute inset-0 z-30 bg-white/95 p-4" : "hidden"}
            md:flex md:static md:w-64 lg:w-72 flex-col bg-white border-2 border-slate-900 rounded-none p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] overflow-hidden shrink-0
          `}
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Participants ({sessionData.participants.length})
              </span>
            </div>
            {sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden text-xs text-slate-500 font-bold hover:text-slate-900"
              >
                Close ✕
              </button>
            )}
          </div>

          {/* Participant List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {sessionData.participants.map((p) => {
              const isCurrentUser =
                p.participantId === sessionData.participantId;
              return (
                <div
                  key={p.participantId}
                  className={`p-2.5 border-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                    isCurrentUser
                      ? "bg-emerald-50 border-emerald-700 text-emerald-950 font-bold"
                      : "bg-slate-50 border-slate-300 text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.isOwner
                          ? "bg-amber-500 ring-2 ring-amber-400/50"
                          : "bg-emerald-600"
                      }`}
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold truncate">{p.username}</span>
                        {p.isOwner && (
                          <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 font-black text-[9px] bg-amber-400 border border-slate-900 text-slate-900">
                            <Crown className="w-2.5 h-2.5" /> OWNER
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="shrink-0 px-1.5 py-0.5 font-black text-[9px] bg-emerald-600 text-white">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Owner actions: Kick Participant */}
                  {isOwner && !p.isOwner && (
                    <button
                      onClick={() => setKickTarget(p)}
                      title={`Kick and permanently ban ${p.username} from this session`}
                      className="shrink-0 px-2 py-1 bg-rose-100 hover:bg-rose-200 border border-rose-700 text-rose-900 text-[10px] font-black uppercase transition-colors flex items-center gap-1"
                    >
                      <UserX className="w-3 h-3" />
                      <span>KICK</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer Info (Phase 2 Capabilities) */}
          <div className="pt-3 mt-3 border-t-2 border-slate-200 text-[10px] text-slate-600 font-bold space-y-1">
            <div className="flex items-center justify-between">
              <span>STORAGE MODE:</span>
              <span className="text-emerald-700 font-black">
                LOCAL DISK + RAM
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>FILE LIMITS:</span>
              <span className="text-slate-700 font-mono">
                10MB IMG / 25MB PDF
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>PURGE ON CLOSE:</span>
              <span className="text-emerald-600 font-black">HARD WIPED</span>
            </div>
          </div>
        </div>

        {/* Real-time Chat Section */}
        <div className="flex-1 flex flex-col bg-white border-2 border-slate-900 rounded-none overflow-hidden shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs">
                <Radio className="w-10 h-10 text-slate-400 mb-2 animate-pulse" />
                <p className="font-black text-slate-700 uppercase">
                  Secure Line Connected
                </p>
                <p className="max-w-xs mt-1 text-slate-500">
                  Send a text, or share an encrypted image (Max 10MB) or PDF
                  (Max 25MB). All files are purged when the session ends.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                if (m.isSystem) {
                  return (
                    <div
                      key={m.messageId}
                      className="my-2 py-1 px-3 bg-slate-200 border border-slate-400 text-[11px] text-slate-800 font-bold text-center mx-auto max-w-fit flex items-center gap-1.5"
                    >
                      <Info className="w-3 h-3 text-indigo-700 shrink-0" />
                      <span>{m.text}</span>
                    </div>
                  );
                }

                const isMe = m.senderId === sessionData.participantId;
                const timeString = new Date(m.timestamp).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  },
                );

                // Phase 2: Message Type Routing (Image, PDF, Text)
                return (
                  <div
                    key={m.messageId}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1 px-1 font-bold">
                      <span className="font-black text-slate-900">
                        {isMe ? "You" : m.senderName}
                      </span>
                      {m.isOwner && (
                        <span className="px-1 bg-amber-400 border border-slate-900 text-slate-900 font-black">
                          OWNER
                        </span>
                      )}
                      <span>{timeString}</span>
                    </div>

                    {/* Image Message Component */}
                    {m.type === "image" ? (
                      <div
                        className={`max-w-[85%] sm:max-w-[340px] p-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] rounded-none ${
                          isMe
                            ? "bg-indigo-900 text-white"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        {/* Thumbnail Container */}
                        <div
                          className="relative rounded overflow-hidden bg-slate-950 cursor-pointer group flex items-center justify-center max-h-56"
                          onClick={() => setLightboxMessage(m)}
                        >
                          <img
                            src={getFileInlineUrl(
                              m.fileId,
                              sessionData.sessionId,
                              sessionData.participantId,
                            )}
                            alt={m.fileName || "Shared Image"}
                            referrerPolicy="no-referrer"
                            className="w-full h-auto object-cover max-h-56 group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <span className="p-2 rounded-lg bg-slate-900/90 text-white hover:bg-slate-800 border border-slate-700 flex items-center gap-1 text-[11px] font-bold">
                              <Eye className="w-3.5 h-3.5" /> Preview
                            </span>
                          </div>
                        </div>

                        {/* File details & download action */}
                        <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80">
                          <div className="truncate pr-2">
                            <p className="font-mono truncate text-slate-200 font-bold">
                              {m.fileName || "image.jpg"}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatFileSize(m.fileSize)}
                            </p>
                          </div>
                          <a
                            href={getFileDownloadUrl(
                              m.fileId,
                              sessionData.sessionId,
                              sessionData.participantId,
                            )}
                            download={m.fileName || "image.jpg"}
                            title="Download original image"
                            className="shrink-0 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>

                        {/* Optional Image Caption */}
                        {m.text && (
                          <p className="mt-1.5 text-xs text-slate-200 bg-slate-950/60 p-2 border border-slate-800 break-words leading-relaxed font-sans">
                            {m.text}
                          </p>
                        )}
                      </div>
                    ) : m.type === "pdf" ? (
                      /* PDF Message Component */
                      <div
                        className={`max-w-[88%] sm:max-w-[360px] p-3.5 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] rounded-none ${
                          isMe
                            ? "bg-indigo-950 text-white"
                            : "bg-slate-900 text-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 mt-0.5">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-100 truncate font-mono">
                              {m.fileName || "document.pdf"}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                              <span className="px-1 py-0.2 rounded bg-rose-500/30 text-rose-300 font-bold">
                                PDF
                              </span>
                              <span>•</span>
                              <span>{formatFileSize(m.fileSize)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons: Open PDF and Download */}
                        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            id={`open_pdf_${m.fileId}`}
                            onClick={() => setPdfModalMessage(m)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>Preview</span>
                          </button>
                          <a
                            id={`download_pdf_${m.fileId}`}
                            href={getFileDownloadUrl(
                              m.fileId,
                              sessionData.sessionId,
                              sessionData.participantId,
                            )}
                            download={m.fileName || "document.pdf"}
                            className="flex items-center justify-center gap-1 py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-[11px] font-bold transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        </div>

                        {/* Optional PDF Caption */}
                        {m.text && (
                          <p className="mt-2 text-xs text-slate-200 bg-slate-950/60 p-2 border border-slate-800 break-words leading-relaxed font-sans">
                            {m.text}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Standard Text Message */
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 text-xs break-words leading-relaxed border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
                          isMe
                            ? "bg-indigo-600 text-white font-medium"
                            : "bg-white text-slate-900 font-medium"
                        }`}
                      >
                        {m.text}
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
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Paperclip className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Attach</span>
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type real-time message, or attach file... (Enter to send)"
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
        onSendFileMessage={handleSendFileCallback}
        initialFile={stagedDroppedFile}
      />

      {/* Image Lightbox Viewer Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxMessage)}
        onClose={() => setLightboxMessage(null)}
        message={lightboxMessage}
        sessionId={sessionData.sessionId}
        participantId={sessionData.participantId}
      />

      {/* PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={Boolean(pdfModalMessage)}
        onClose={() => setPdfModalMessage(null)}
        message={pdfModalMessage}
        sessionId={sessionData.sessionId}
        participantId={sessionData.participantId}
      />

      {/* Confirmation Modal: Owner End Session */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
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
              purge all messages and uploaded files from disk and memory.
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
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
