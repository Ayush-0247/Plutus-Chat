import React, { useState, useRef, useEffect } from "react";
import {
  Shield,
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
  Video,
  Phone,
  Volume2,
  VolumeX,
  Paperclip,
  Mic,
  QrCode,
  Smartphone,
  X,
  Wifi,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  playMessageSentSound,
  isSoundEnabled,
  toggleSound,
} from "../services/soundEffects.js";
import { CallWindow } from "./Call/CallWindow.jsx";
import { FileMessage } from "./File/FileMessage.jsx";
import { AddDeviceModal } from "./AddDeviceModal.jsx";

export const ActiveSessionView = ({
  sessionData,
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
  onKickParticipant,
  onLeaveSession,
  onEndSession,
  // Phase 3 WebRTC calling & P2P file transfer
  callState = "IDLE",
  callType = "video",
  localStream = null,
  remoteStreams = new Map(),
  isAudioMuted = false,
  isVideoMuted = false,
  callWarning = null,
  onStartCall,
  onToggleAudio,
  onToggleVideo,
  onLeaveCall,
  onEndCallForEveryone,
  onSendFile,
  onCancelFileTransfer,
  fileTransfers = [],
  incomingCall = null,
  onAcceptCall,
  onDeclineCall,
  onOpenArchitecture,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [kickTarget, setKickTarget] = useState(null);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);

  // Audio mute state
  const [audioEnabled, setAudioEnabled] = useState(isSoundEnabled());

  // Toast notification state
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const triggerToast = (text) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastText(text);
    setShowToast(true);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2200);
  };

  const handleToggleAudio = () => {
    const updated = toggleSound();
    setAudioEnabled(updated);
    triggerToast(updated ? "Audio notifications enabled" : "Audio muted");
  };

  // Copy handlers
  const handleCopyId = () => {
    navigator.clipboard.writeText(sessionData.sessionId);
    setCopiedId(true);
    triggerToast(`Copied: ${sessionData.sessionId}`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(sessionData.passkey);
    setCopiedKey(true);
    triggerToast(`Copied: ${sessionData.passkey}`);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}?join=${sessionData.sessionId}&key=${sessionData.passkey}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    triggerToast("Invite link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenTestTab = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}?join=${sessionData.sessionId}&key=${sessionData.passkey}`;
    triggerToast("Opening session peer in active window...");
    if (typeof window !== "undefined") {
      window.open(inviteUrl, "_blank");
    }
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

  const handleSendVoiceNote = () => {
    onSendMessage("🎤 [Voice Note • 0:05] Ephemeral encrypted audio memo");
    playMessageSentSound();
    triggerToast("Sent ephemeral voice memo");
  };

  // File attach trigger
  const handleTriggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onSendFile) {
      onSendFile(file);
      e.target.value = "";
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, fileTransfers]);

  const isOwner = sessionData.isOwner;

  // Derive peer display name
  const otherParticipants = sessionData.participants.filter(
    (p) => p.participantId !== sessionData.participantId
  );
  const peerDisplayName =
    otherParticipants.length === 1
      ? otherParticipants[0].username
      : otherParticipants.length > 1
      ? `${otherParticipants[0].username} +${otherParticipants.length - 1}`
      : `${sessionData.username} (Secure Mesh)`;

  // Current user initials
  const getInitials = (name) => {
    if (!name) return "P";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] text-[#111b21] antialiased select-none font-sans overflow-hidden relative">
      {/* 1. TOP APP HEADER (From test.html) */}
      <header
        id="top-header"
        className="h-14 px-3 sm:px-6 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between shrink-0 z-30 shadow-2xs"
      >
        {/* Brand & Shield Logo from Original UI */}
        <div className="flex items-center gap-2.5">
          <div
            id="brand-logo"
            className="w-9 h-9 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-2xs shrink-0"
          >
            {/* Shield Icon */}
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-base sm:text-lg font-bold tracking-tight text-[#111b21]">
                PLUTUS
              </span>
              <span className="text-base sm:text-lg font-bold tracking-tight text-[#00a884]">
                .CHAT
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: LINE status, signal indicator, audio speaker, mobile toggle */}
        <div className="flex items-center gap-2">
          {/* Architecture info button (if available) */}
          {onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              title="View Architecture"
              className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white border border-[#e9edef] text-xs text-[#54656f] hover:text-[#111b21] transition-colors cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-[#00a884]" />
              <span className="text-[11px] font-semibold">ARCH</span>
            </button>
          )}

          {/* LINE Indicator Badge */}
          <div
            id="line-indicator-badge"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#e9edef] text-xs font-mono text-[#111b21] shadow-2xs"
          >
            {/* Broadcast wave icon */}
            <svg
              className="w-3.5 h-3.5 text-[#00a884] pulse-indicator shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
            </svg>
            <span className="hidden xs:inline text-[#54656f] font-semibold">
              LINE:
            </span>
            <span className="font-bold text-[#00a884]">
              {sessionData.sessionId}
            </span>
          </div>

          {/* Signal Indicator Button from Original UI */}
          <button
            id="signal-indicator-btn"
            onClick={() =>
              triggerToast("Encrypted Peer Link: 100% Signal • RAM Buffer Active")
            }
            title="Encrypted Peer Link: 100% Signal"
            className="w-8 h-8 rounded-lg bg-[#e7f7f3] border border-[#00a884]/30 flex items-center justify-center text-[#008069] hover:bg-[#d1f2eb] transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </button>

          {/* Audio Speaker Button from Original UI */}
          <button
            id="audio-toggle-btn"
            onClick={handleToggleAudio}
            title={audioEnabled ? "Sound Notifications Enabled" : "Sound Muted"}
            className={`w-8 h-8 rounded-lg bg-white border border-[#e9edef] flex items-center justify-center transition-colors cursor-pointer ${
              audioEnabled
                ? "text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]"
                : "text-rose-500 hover:bg-rose-50"
            }`}
          >
            {audioEnabled ? (
              <svg
                id="speaker-icon"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg
                id="speaker-icon"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>

          {/* Mobile Sidebar Toggle */}
          <button
            id="mobile-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-8 h-8 rounded-lg bg-white border border-[#e9edef] flex items-center justify-center text-[#54656f] hover:text-[#111b21] cursor-pointer"
            title="Toggle Participants"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. SUBHEADER / SESSION ACTION BAR (From test.html) */}
      <div
        id="session-action-bar"
        className="px-3 sm:px-6 py-2.5 bg-white border-b border-[#e9edef] flex flex-wrap items-center justify-between gap-2.5 shrink-0"
      >
        {/* Session, Passkey, Copy Link, Add Device, Test in Tab */}
        <div className="flex flex-wrap items-center gap-2">
          {/* SESSION: <id> with copy icon */}
          <div
            id="session-pill"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f2f5] border border-[#e9edef] text-xs"
          >
            <span className="text-[#54656f] font-semibold text-[11px] uppercase tracking-wider">
              SESSION:
            </span>
            <span id="session-value" className="font-mono font-bold text-[#111b21]">
              {sessionData.sessionId}
            </span>
            <button
              onClick={handleCopyId}
              id="session-copy-btn"
              className="ml-1 text-[#54656f] hover:text-[#00a884] transition-colors cursor-pointer"
              title="Copy Session ID"
            >
              {copiedId ? (
                <Check className="w-3.5 h-3.5 text-[#00a884]" />
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>

          {/* PASSKEY: <key> with copy icon */}
          <div
            id="passkey-pill"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fef9c3] border border-[#fde047] text-xs"
          >
            <span className="text-[#854d0e] font-semibold text-[11px] uppercase tracking-wider">
              PASSKEY:
            </span>
            <span id="passkey-value" className="font-mono font-bold text-[#713f12]">
              {sessionData.passkey}
            </span>
            <button
              onClick={handleCopyKey}
              id="passkey-copy-btn"
              className="ml-1 text-[#854d0e] hover:text-[#ca8a04] transition-colors cursor-pointer"
              title="Copy Passkey"
            >
              {copiedKey ? (
                <Check className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>

          {/* COPY INVITE LINK BUTTON */}
          <button
            id="copy-invite-btn"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#00a884] text-[#00a884] hover:bg-[#e7f7f3] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span id="copy-invite-text">
              {copiedLink ? "COPIED!" : "COPY INVITE LINK"}
            </span>
          </button>

          {/* ADD DEVICE BUTTON (Opens responsive modal with QR code & credentials) */}
          <button
            id="add-device-btn"
            onClick={() => setShowAddDeviceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e7f7f3] border border-[#00a884]/40 text-[#008069] hover:bg-[#d1f2eb] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Scan QR Code or link another phone/tablet"
          >
            <QrCode className="w-3.5 h-3.5 text-[#00a884]" />
            <span>ADD DEVICE</span>
          </button>

          {/* TEST IN TAB BUTTON */}
          <button
            id="test-tab-btn"
            onClick={handleOpenTestTab}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e9edef] text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>TEST IN TAB</span>
          </button>
        </div>

        {/* Right Action Buttons: Calling controls, Terminate / Leave */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Owner WebRTC Call Controls */}
          {isOwner && callState === "IDLE" && (
            <div className="flex items-center gap-1.5">
              <button
                id="start_video_call_btn"
                onClick={() => onStartCall && onStartCall("video")}
                title="Start Video Call with participants"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <Video className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">VIDEO CALL</span>
              </button>

              <button
                id="start_audio_call_btn"
                onClick={() => onStartCall && onStartCall("audio")}
                title="Start Audio Call with participants"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#008069] hover:bg-[#006e5a] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AUDIO CALL</span>
              </button>
            </div>
          )}

          {isOwner && callState === "INVITING" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#e7f7f3] border border-[#00a884]/30 text-[#008069] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
              <span>INVITING...</span>
            </div>
          )}

          {/* Terminate Session Button (Owner) or Leave Session (Joiner) */}
          {isOwner ? (
            <button
              id="terminate-btn"
              onClick={() => setShowEndConfirm(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#ea0038] hover:bg-[#c90030] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              <span>TERMINATE SESSION</span>
            </button>
          ) : (
            <button
              id="leave-session-btn"
              onClick={onLeaveSession}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#e9edef] text-[#54656f] hover:text-[#111b21] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LEAVE</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. MAIN DUAL-PANEL CONTAINER (From test.html) */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* LEFT SIDEBAR: PARTICIPANTS & SECURITY TELEMETRY (From test.html) */}
        <aside
          id="sidebar-panel"
          className={`w-72 lg:w-80 bg-white border-r border-[#e9edef] flex flex-col justify-between shrink-0 absolute lg:relative inset-y-0 left-0 z-30 transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } shadow-lg lg:shadow-none`}
        >
          {/* Sidebar Header: PARTICIPANTS (count) */}
          <div className="h-[60px] px-4 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#dfe5e7] flex items-center justify-center text-[#54656f]">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#111b21]">
                PARTICIPANTS
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-[#00a884] text-white">
                ({sessionData.participants.length})
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-[#54656f] hover:text-[#111b21] p-1 cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Participants List from Original UI */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sessionData.participants.map((p) => {
              const isCurrentUser =
                p.participantId === sessionData.participantId;
              const initials = getInitials(p.username);

              return (
                <div
                  key={p.participantId}
                  id={`participant-${p.participantId}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#f0f2f5] border border-[#e9edef] hover:bg-[#e9edef] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with online status dot */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center font-bold text-sm text-white shadow-2xs">
                        {initials}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          p.isOwner ? "bg-[#eab308]" : "bg-[#00a884]"
                        }`}
                      />
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-sm text-[#111b21] truncate">
                        {p.username}
                      </div>
                      <div className="text-[11px] text-[#667781]">
                        Active now
                      </div>
                    </div>
                  </div>

                  {/* Badges: OWNER (crown) & YOU + Kick button */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.isOwner && (
                      <span
                        id="badge-owner"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef08a] text-[#854d0e] border border-[#facc15]"
                      >
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                        </svg>
                        OWNER
                      </span>
                    )}

                    {isCurrentUser && (
                      <span
                        id="badge-you"
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]"
                      >
                        YOU
                      </span>
                    )}

                    {/* Kick participant button for owner */}
                    {isOwner && !p.isOwner && (
                      <button
                        onClick={() => setKickTarget(p)}
                        title={`Kick and permanently ban ${p.username}`}
                        className="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer ml-1"
                      >
                        <UserX className="w-3 h-3" />
                        <span>KICK</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* BOTTOM STORAGE TELEMETRY from Original UI */}
          <div
            id="storage-telemetry-box"
            className="p-3.5 bg-[#f0f2f5] border-t border-[#e9edef] space-y-2 shrink-0"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#54656f] font-semibold text-[11px]">
                STORAGE MODE:
              </span>
              <span
                id="storage-mode-val"
                className="font-mono font-bold text-[11px] text-[#008069] bg-white px-2 py-0.5 rounded border border-[#00a884]/30"
              >
                RAM ONLY
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#54656f] font-semibold text-[11px]">
                PURGE ON CLOSE:
              </span>
              <span
                id="purge-on-close-val"
                className="font-mono font-bold text-[11px] text-[#008069] bg-white px-2 py-0.5 rounded border border-[#00a884]/30"
              >
                HARD WIPED
              </span>
            </div>
            <div className="pt-1.5 text-[10px] text-[#667781] flex items-center justify-between">
              <span>Zero-Disk Trace</span>
              <span className="font-mono">AES-GCM-256</span>
            </div>
          </div>
        </aside>

        {/* MAIN CHAT CANVAS (From test.html) */}
        <main className="flex-1 flex flex-col chat-wallpaper relative overflow-hidden min-h-0">
          {/* Mobile Sidebar Backdrop Overlay */}
          {sidebarOpen && (
            <div
              id="sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-20 lg:hidden cursor-pointer"
            />
          )}

          {/* Chat Area Subheader */}
          <div className="h-[60px] px-4 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                {getInitials(peerDisplayName)}
              </div>
              <div>
                <div className="font-semibold text-sm text-[#111b21]">
                  {peerDisplayName}
                </div>
                <div className="text-xs text-[#00a884] font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></span>
                  <span>online • E2EE Mesh</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddDeviceModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#e9edef] hover:bg-[#e9edef] text-xs text-[#54656f] hover:text-[#111b21] transition-colors cursor-pointer"
                title="Add Device or Scan QR"
              >
                <Smartphone className="w-3.5 h-3.5 text-[#00a884]" />
                <span className="font-semibold">Add Device</span>
              </button>
            </div>
          </div>

          {/* Incoming Call In-Session Banner (Joiner notification) */}
          {incomingCall && !isOwner && callState !== "ACTIVE" && (
            <div className="bg-[#fef9c3] border-b border-[#fde047] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs z-20">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a884] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#00a884]"></span>
                </span>
                <div>
                  <div className="text-xs font-bold uppercase text-[#713f12] tracking-wider flex items-center gap-1.5">
                    {incomingCall.callType === "video" ? (
                      <Video className="w-3.5 h-3.5 text-[#00a884]" />
                    ) : (
                      <Phone className="w-3.5 h-3.5 text-[#00a884]" />
                    )}
                    <span>
                      INCOMING {incomingCall.callType === "video" ? "VIDEO" : "AUDIO"} CALL
                    </span>
                  </div>
                  <span className="block text-[11px] text-[#854d0e]">
                    {incomingCall.callerName || "Session Owner"} is calling the session
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="banner_decline_call_button"
                  onClick={onDeclineCall}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-[#e9edef] text-[#54656f] font-semibold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  Decline
                </button>
                <button
                  id="banner_accept_call_button"
                  onClick={onAcceptCall}
                  className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {incomingCall.callType === "video" ? (
                    <Video className="w-3.5 h-3.5" />
                  ) : (
                    <Phone className="w-3.5 h-3.5" />
                  )}
                  <span>Accept & Join</span>
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Active P2P WebRTC Video / Audio Call Window */}
          {(callState === "ACTIVE" || (callState === "INVITING" && isOwner)) && (
            <CallWindow
              callType={callType}
              localStream={localStream}
              remoteStreams={remoteStreams}
              participants={sessionData.participants}
              myParticipantId={sessionData.participantId}
              isOwner={isOwner}
              isAudioMuted={isAudioMuted}
              isVideoMuted={isVideoMuted}
              onToggleAudio={onToggleAudio}
              onToggleVideo={onToggleVideo}
              onLeaveCall={onLeaveCall}
              onEndCallForEveryone={onEndCallForEveryone}
              warningMessage={callWarning}
            />
          )}

          {/* Messages Viewport */}
          <div
            id="messages-container"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && onSendFile) {
                onSendFile(file);
              }
            }}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 z-10"
          >
            {/* Empty State / Connection Banner from Original UI (test.html) */}
            {messages.length === 0 && fileTransfers.length === 0 && (
              <div
                id="secure-line-banner"
                className="max-w-md mx-auto my-6 p-6 rounded-2xl bg-white border border-[#e9edef] shadow-2xs text-center"
              >
                {/* Broadcast wave icon ((o)) from original UI */}
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#e7f7f3] text-[#008069] flex items-center justify-center">
                  <svg
                    className="w-6 h-6 animate-pulse"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                    <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                    <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
                  </svg>
                </div>

                <h3
                  id="secure-line-title"
                  className="text-xs sm:text-sm font-bold tracking-wider uppercase text-[#111b21]"
                >
                  SECURE LINE CONNECTED
                </h3>

                <p
                  id="secure-line-desc"
                  className="mt-2 text-xs sm:text-sm text-[#54656f] leading-relaxed"
                >
                  Send a text to begin secure communication. All messages are
                  ephemeral and destroyed when the session ends.
                </p>

                <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#00a884] font-medium bg-[#e7f7f3] px-3 py-1 rounded-full">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  End-to-End Encrypted Session Active
                </div>
              </div>
            )}

            {/* Dynamic Container for Live User Messages & File Transfers */}
            <div id="dynamic-messages" className="space-y-3">
              {[...messages, ...fileTransfers].map((m) => {
                if (m.isSystem) {
                  return (
                    <div
                      key={m.messageId}
                      className="my-2 py-1 px-3 bg-white/80 backdrop-blur-xs border border-[#e9edef] text-[11px] text-[#54656f] font-semibold text-center mx-auto max-w-fit rounded-lg shadow-2xs flex items-center gap-1.5"
                    >
                      <Info className="w-3 h-3 text-[#00a884] shrink-0" />
                      <span>{m.text}</span>
                    </div>
                  );
                }

                const isMe =
                  m.senderId === sessionData.participantId || m.isLocal;

                // File Transfers and Media
                if (
                  m.isTransferring ||
                  m.objectUrl ||
                  m.category ||
                  m.type === "file"
                ) {
                  return (
                    <div
                      key={m.messageId || m.fileId}
                      className={`flex flex-col ${
                        isMe ? "items-end" : "items-start"
                      } my-2`}
                    >
                      <FileMessage
                        message={m}
                        isSelf={isMe}
                        onCancelTransfer={onCancelFileTransfer}
                      />
                    </div>
                  );
                }

                const timeStr = new Date(m.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                // Sent Message Bubble (isMe) with soft mint background & blue double checks from test.html
                if (isMe) {
                  return (
                    <div
                      key={m.messageId}
                      className="max-w-[78%] sm:max-w-[65%] self-end ml-auto bg-[#d9fdd3] p-3 rounded-xl rounded-tr-none shadow-2xs text-sm relative border border-[#c1e8ba]"
                    >
                      <div className="break-words text-[#111b21] leading-relaxed select-text">
                        {m.text}
                      </div>
                      <div className="text-[10px] text-[#667781] text-right mt-1 flex justify-end items-center gap-1 select-none">
                        <span>{timeStr}</span>
                        {/* Blue double checkmarks */}
                        <svg
                          className="w-3.5 h-3.5 text-[#53bdeb]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      </div>
                    </div>
                  );
                }

                // Received Message Bubble (peer) with clean white background from test.html
                return (
                  <div
                    key={m.messageId}
                    className="max-w-[78%] sm:max-w-[65%] bg-white p-3 rounded-xl rounded-tl-none shadow-2xs text-sm relative border border-[#e9edef]"
                  >
                    <div className="text-[11px] font-bold text-[#00a884] mb-0.5 flex items-center gap-1.5">
                      <span>{m.senderName}</span>
                      {m.isOwner && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#fef08a] text-[#854d0e] border border-[#facc15]">
                          OWNER
                        </span>
                      )}
                    </div>
                    <div className="break-words text-[#111b21] leading-relaxed select-text">
                      {m.text}
                    </div>
                    <div className="text-[10px] text-[#667781] text-right mt-1 select-none">
                      {timeStr}
                    </div>
                  </div>
                );
              })}

              {/* Live typing status */}
              {typingUsers.length > 0 && (
                <div className="text-xs text-[#00a884] font-medium italic flex items-center gap-1.5 py-1 px-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00a884] animate-ping" />
                  <span>
                    {typingUsers.join(", ")}{" "}
                    {typingUsers.length === 1 ? "is" : "are"} typing...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* BOTTOM MESSAGE INPUT BAR (From test.html) */}
          <footer
            id="chat-input-bar"
            className="h-16 bg-[#f0f2f5] px-3 sm:px-4 border-t border-[#e9edef] flex items-center gap-2 z-10 shrink-0"
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Attachment Button from test.html */}
            <button
              type="button"
              onClick={handleTriggerFileSelect}
              className="text-[#54656f] hover:text-[#111b21] p-2 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
              title="Attach Document or Image (Ephemeral RAM)"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>

            {/* The Real-Time Message Input Field with exact placeholder from original UI */}
            <form
              id="message-form"
              onSubmit={handleSend}
              className="flex-1 flex items-center gap-2 min-w-0"
            >
              <input
                ref={inputRef}
                id="message-input"
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type real-time message... (Enter to send)"
                className="w-full bg-white text-[#111b21] rounded-lg px-4 py-2.5 text-sm outline-none border border-[#e9edef] focus:border-[#00a884] placeholder:text-[#667781] transition-all shadow-2xs"
                autoComplete="off"
                maxLength={2000}
              />

              {/* Mic Voice Memo Button */}
              <button
                type="button"
                onClick={handleSendVoiceNote}
                className="hidden sm:block text-[#54656f] hover:text-[#111b21] p-2 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                title="Send Voice Memo"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>

              {/* SEND Button: Exact text 'SEND' + send arrow icon from original UI */}
              <button
                id="send-btn"
                type="submit"
                disabled={!inputText.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
              >
                <span>SEND</span>
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </footer>
        </main>
      </div>

      {/* 4. TOAST NOTIFICATION (From test.html) */}
      <div
        id="toast"
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#111b21] text-white text-xs px-4 py-2 rounded-lg shadow-xl transition-opacity duration-300 z-50 flex items-center gap-2 pointer-events-none ${
          showToast ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg
          className="w-4 h-4 text-[#00a884]"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
        <span id="toast-text">{toastText}</span>
      </div>

      {/* 5. ADD DEVICE RESPONSIVE MODAL */}
      <AddDeviceModal
        isOpen={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        sessionId={sessionData.sessionId}
        passkey={sessionData.passkey}
        onTestInTab={handleOpenTestTab}
        onShowToast={triggerToast}
      />

      {/* 6. TERMINATE CONFIRMATION MODAL */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border border-[#e9edef] p-6 shadow-2xl font-sans"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4 pb-3 border-b border-[#e9edef]">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-base font-bold text-[#111b21]">
                Terminate Ephemeral Line?
              </h3>
            </div>
            <p className="text-sm text-[#54656f] leading-relaxed mb-6">
              This will immediately disconnect all {sessionData.participants.length}{" "}
              participants and hard-wipe all ephemeral RAM buffers. No messages
              or logs can be recovered.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndSession();
                }}
                className="px-4 py-2 rounded-xl bg-[#ea0038] hover:bg-[#c90030] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
              >
                End & Hard-Wipe
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 7. KICK PARTICIPANT MODAL */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border border-[#e9edef] p-6 shadow-2xl font-sans"
          >
            <div className="flex items-center gap-3 text-amber-600 mb-4 pb-3 border-b border-[#e9edef]">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-[#111b21]">
                Kick & Bar Participant?
              </h3>
            </div>
            <p className="text-sm text-[#54656f] leading-relaxed mb-3">
              Are you sure you want to remove{" "}
              <strong className="text-[#111b21] font-bold">
                {kickTarget.username}
              </strong>
              ?
            </p>
            <div className="text-xs text-[#854d0e] leading-relaxed mb-6 p-3 bg-[#fef9c3] rounded-xl border border-[#fde047]">
              Kicked participants are permanently barred from rejoining this active
              session even if they possess the invite link and passkey.
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setKickTarget(null)}
                className="px-4 py-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetId = kickTarget.participantId;
                  setKickTarget(null);
                  onKickParticipant(targetId);
                }}
                className="px-4 py-2 rounded-xl bg-[#ea0038] hover:bg-[#c90030] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
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
