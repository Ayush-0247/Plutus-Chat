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
  Lock,
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
import { MessageReactions } from "./MessageReactions.jsx";

export const ActiveSessionView = ({
  sessionData,
  messages,
  typingUsers,
  onSendMessage,
  onTyping,
  onKickParticipant,
  onLeaveSession,
  onEndSession,
  onTransferOwnership,
  onTransferAndLeaveSession,
  onReactMessage,
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
  const [transferTarget, setTransferTarget] = useState(null);
  const [showOwnerLeaveModal, setShowOwnerLeaveModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);

  // Audio mute state
  const [audioEnabled, setAudioEnabled] = useState(isSoundEnabled());

  // Toast notification state
  const [toastText, setToastText] = useState("");
  const [showToast, setShowToast] = useState(false);
  const toastTimeoutRef = useRef(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevItemsCountRef = useRef(0);
  const [showNewMessagesBtn, setShowNewMessagesBtn] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const checkIfNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = 100;
    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom < threshold;
  };

  const handleScroll = () => {
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowNewMessagesBtn(false);
    }
  };

  const scrollToBottom = (behavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
    setShowNewMessagesBtn(false);
    isNearBottomRef.current = true;
  };

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
    triggerToast(updated ? "Notifications on" : "Notifications muted");
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
    triggerToast("Invite link copied to clipboard");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenTestTab = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}?join=${sessionData.sessionId}&key=${sessionData.passkey}`;
    triggerToast("Contacting peer...");
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
    onSendMessage("Voice note · 0:05");
    playMessageSentSound();
    triggerToast("Voice note sent");
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

  // Smart auto-scroll to bottom on new messages
  useEffect(() => {
    const totalItems = messages.length + fileTransfers.length;
    if (totalItems === 0) {
      prevItemsCountRef.current = 0;
      return;
    }

    const isFirstLoad = prevItemsCountRef.current === 0;
    prevItemsCountRef.current = totalItems;

    if (isFirstLoad) {
      scrollToBottom("auto");
      return;
    }

    // Determine if the newest item was sent by the current user
    const lastMsg = messages[messages.length - 1];
    const lastTransfer = fileTransfers[fileTransfers.length - 1];
    let sentByMe = false;

    if (lastMsg) {
      sentByMe =
        lastMsg.senderId === sessionData.participantId || lastMsg.isLocal;
    }
    if (!sentByMe && lastTransfer) {
      sentByMe =
        lastTransfer.senderId === sessionData.participantId ||
        lastTransfer.isLocal ||
        lastTransfer.status === "SENDING";
    }

    if (sentByMe) {
      scrollToBottom("smooth");
    } else {
      if (isNearBottomRef.current) {
        scrollToBottom("smooth");
      } else {
        setShowNewMessagesBtn(true);
      }
    }
  }, [messages, fileTransfers, sessionData.participantId]);

  const isOwner = sessionData.isOwner;

  // Derive session creator (owner) and joiners
  const creatorParticipant = sessionData.participants.find((p) => p.isOwner);
  const creatorName = creatorParticipant
    ? creatorParticipant.username
    : sessionData.isOwner
    ? sessionData.username
    : "Host";

  const getMeetName = (name) => {
    if (!name) return "Secure Meet";
    const firstName = name.trim().split(" ")[0] || name.trim();
    return firstName.toLowerCase().endsWith("s")
      ? `${firstName}' meet`
      : `${firstName}'s meet`;
  };

  const creatorMeetTitle = isOwner
    ? "Your meet"
    : getMeetName(creatorName);

  const joinerParticipants = sessionData.participants.filter((p) => !p.isOwner);
  const joinerDisplayNames =
    joinerParticipants.length > 0
      ? joinerParticipants.map((p) => p.username).join(", ")
      : "Waiting for joiners...";

  const otherParticipants = sessionData.participants.filter(
    (p) => p.participantId !== sessionData.participantId
  );
  const peerDisplayName =
    otherParticipants.length === 1
      ? otherParticipants[0].username
      : otherParticipants.length > 1
      ? `${otherParticipants[0].username} +${otherParticipants.length - 1}`
      : sessionData.username;

  const getInitials = (name) => {
    if (!name) return "P";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f4f5f9] text-[#171a25] antialiased select-none font-sans overflow-hidden relative">
      {/* 1. TOP HEADER (Inspired by test2.html) */}
      <header
        id="top-header"
        className="h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 border-b bg-white"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Left: Brand Icon & Title with pulsing connection dot */}
        <div className="flex items-center gap-3">
          <div
            id="brand-logo"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
            style={{ background: "var(--brand)" }}
          >
            <svg
              className="w-4.5 h-4.5"
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
          <div className="leading-tight">
            <div className="flex items-baseline gap-1">
              <span
                className="text-[15px] font-extrabold tracking-tight"
                style={{ color: "var(--ink)" }}
              >
                Plutus
              </span>
              <span
                className="text-[15px] font-medium"
                style={{ color: "var(--ink-faint)" }}
              >
                Session
              </span>
            </div>
            <div
              className="hidden sm:flex items-center gap-1.5 text-[11px]"
              style={{ color: "var(--ink-faint)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full pulse-dot"
                style={{ background: "var(--success)" }}
              />
              Connected · nothing is saved to disk
            </div>
          </div>
        </div>

        {/* Right Controls: Arch, Line status, Signal, Sound, Calls, Terminate/Leave, Mobile toggle */}
        <div className="flex items-center gap-2">
          {/* Architecture info button (if available) */}
          {onOpenArchitecture && (
            <button
              onClick={onOpenArchitecture}
              title="View Architecture"
              className="hidden sm:flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-xs transition-colors cursor-pointer"
              style={{
                color: "var(--ink-soft)",
                borderColor: "var(--border)",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Info className="w-3.5 h-3.5" style={{ color: "var(--brand)" }} />
              <span className="text-[11px] font-semibold">ARCH</span>
            </button>
          )}

          {/* LINE Indicator Badge */}
          <div
            id="line-indicator-badge"
            className="hidden md:flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-xs font-mono"
            style={{
              background: "var(--surface-alt)",
              borderColor: "var(--border)",
              color: "var(--ink)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full pulse-dot"
              style={{ background: "var(--brand)" }}
            />
            <span style={{ color: "var(--ink-faint)" }} className="font-semibold">
              LINE:
            </span>
            <span className="font-bold" style={{ color: "var(--brand)" }}>
              {sessionData.sessionId}
            </span>
          </div>

          {/* Signal Indicator Button */}
          <button
            id="signal-indicator-btn"
            onClick={() =>
              triggerToast("Encrypted Peer Link: 100% Signal • RAM Buffer Active")
            }
            title="Encrypted Peer Link: 100% Signal"
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer border"
            style={{
              color: "var(--success)",
              borderColor: "var(--border)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
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

          {/* Audio Speaker Toggle Button (Exact from test2.html) */}
          <button
            id="audio-toggle-btn"
            onClick={handleToggleAudio}
            title={audioEnabled ? "Toggle notification sound" : "Sound Muted"}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer border"
            style={{
              color: audioEnabled ? "var(--ink-soft)" : "var(--danger)",
              borderColor: "var(--border)",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {audioEnabled ? (
              <svg
                id="speaker-icon"
                className="w-4.5 h-4.5"
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
                className="w-4.5 h-4.5"
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

          {/* Owner WebRTC Calling Controls */}
          {isOwner && callState === "IDLE" && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                id="start_video_call_btn"
                onClick={() => onStartCall && onStartCall("video")}
                title="Start Video Call with participants"
                className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-white text-[12px] font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
                style={{ background: "var(--brand)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--brand-dark)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Call</span>
              </button>

              <button
                id="start_audio_call_btn"
                onClick={() => onStartCall && onStartCall("audio")}
                title="Start Audio Call with participants"
                className="flex items-center gap-1.5 px-2.5 h-9 rounded-lg border text-[12px] font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
                style={{
                  color: "var(--ink-soft)",
                  borderColor: "var(--border)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Audio</span>
              </button>
            </div>
          )}

          {isOwner && callState === "INVITING" && (
            <div
              className="flex items-center gap-2 px-3 h-9 rounded-lg border text-xs font-semibold"
              style={{
                background: "var(--brand-tint)",
                borderColor: "var(--brand-tint-border)",
                color: "var(--brand)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-ping"
                style={{ background: "var(--brand)" }}
              />
              <span>Inviting...</span>
            </div>
          )}

          {/* Owner Leave (Transfer Ownership mid-session) Button */}
          {isOwner && (
            <button
              id="owner-leave-btn"
              onClick={() => {
                const others = sessionData.participants.filter(
                  (p) => p.participantId !== sessionData.participantId
                );
                if (others.length > 0) {
                  setSelectedNewOwnerId(others[0].participantId);
                  setShowOwnerLeaveModal(true);
                } else {
                  setShowEndConfirm(true);
                }
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg border text-[13px] font-semibold transition-all cursor-pointer active:scale-95"
              style={{
                color: "var(--ink-soft)",
                borderColor: "var(--border)",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              title="Leave session without ending by transferring ownership"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          )}

          {/* Terminate Session (Owner) or Leave Session (Joiner) - Exact from test2.html */}
          {isOwner ? (
            <button
              id="terminate-btn"
              onClick={() => setShowEndConfirm(true)}
              className="hidden sm:flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-white text-[13px] font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
              style={{ background: "var(--danger)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#a8342e")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--danger)")}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              <span>End session</span>
            </button>
          ) : (
            <button
              id="leave-session-btn"
              onClick={onLeaveSession}
              className="hidden sm:flex items-center gap-1.5 px-3.5 h-9 rounded-lg text-white text-[13px] font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
              style={{ background: "var(--danger)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#a8342e")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--danger)")}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Leave</span>
            </button>
          )}

          {/* Mobile Sidebar Toggle Button */}
          <button
            id="mobile-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer border"
            style={{
              color: "var(--ink-soft)",
              borderColor: "var(--border)",
            }}
            title="Session details"
          >
            <svg
              className="w-4.5 h-4.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. MAIN DUAL-PANEL LAYOUT (Exact layout from test2.html) */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        {/* SIDEBAR PANEL (Exact structure from test2.html) */}
        <aside
          id="sidebar-panel"
          className={`w-[300px] lg:w-80 flex flex-col shrink-0 absolute lg:relative inset-y-0 left-0 z-20 transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          } overflow-y-auto border-r`}
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          {/* Sidebar Top Title */}
          <div
            className="h-14 px-4 flex items-center justify-between shrink-0 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <h2
              className="text-[13px] font-bold"
              style={{ color: "var(--ink)" }}
            >
              Session details
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md cursor-pointer"
              style={{ color: "var(--ink-faint)" }}
            >
              <svg
                className="w-4.5 h-4.5"
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

          {/* Connection Card (Exact from test2.html) */}
          <div
            className="p-2 space-y-2 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              id="session-pill"
              className="rounded-xl p-1.5 space-y-3 border "
              style={{
                background: "var(--surface-alt)",
                borderColor: "var(--border)",
              }}
            >
              {/* Session ID */}
              <div className="flex items-center justify-between ">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--ink-faint)" }}
                >
                  Session ID
                </span>
                <button
                  id="session-copy-btn"
                  onClick={handleCopyId}
                  title="Copy session ID"
                  className="p-1 rounded-md cursor-pointer transition-colors"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
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
              <div
                id="session-value"
                className="font-mono text-[15px] font-semibold tracking-wide "
                style={{ color: "var(--ink)" }}
              >
                {sessionData.sessionId}
              </div>

              <div className="h-px" style={{ background: "var(--border)" }} />

              {/* Passkey */}
              <div id="passkey-pill" className="flex items-center justify-between">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--gold)" }}
                >
                  Passkey
                </span>
                <button
                  id="passkey-copy-btn"
                  onClick={handleCopyKey}
                  title="Copy passkey"
                  className="p-1 rounded-md cursor-pointer transition-colors"
                  style={{ color: "var(--gold)" }}
                >
                  {copiedKey ? (
                    <Check className="w-3.5 h-3.5" style={{ color: "var(--gold)" }} />
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
              <div
                id="passkey-value"
                className="font-mono text-[15px] font-semibold tracking-wide"
                style={{ color: "var(--ink)" }}
              >
                {sessionData.passkey}
              </div>
            </div>

            {/* Copy Invite Link Button (Exact from test2.html) */}
            <button
              id="copy-invite-btn"
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-white text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.98] shadow-xs"
              style={{ background: "var(--brand)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--brand-dark)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
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
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span id="copy-invite-text">
                {copiedLink ? "Copied" : "Copy invite link"}
              </span>
            </button>

            {/* Add Device Button */}
            <button
              id="add-device-btn"
              onClick={() => setShowAddDeviceModal(true)}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.98] border shadow-2xs"
              style={{
                color: "var(--brand)",
                background: "var(--brand-tint)",
                borderColor: "var(--brand-tint-border)",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#e5e3f8")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand-tint)")}
              title="Scan QR Code or link another phone/tablet"
            >
              <QrCode className="w-4 h-4" />
              <span>Add Device / QR</span>
            </button>

            {/* Simulate a reply / Test in Tab Button (Exact from test2.html) */}
            <button
              id="test-tab-btn"
              onClick={handleOpenTestTab}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-lg text-[13px] font-semibold transition-all cursor-pointer active:scale-[0.98] border"
              style={{
                color: "var(--ink-soft)",
                borderColor: "var(--border)",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
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
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Test in Tab / Peer</span>
            </button>

            {/* Mobile Terminate or Leave Button */}
            {isOwner ? (
              <button
                id="terminate-btn-mobile"
                onClick={() => setShowEndConfirm(true)}
                className="sm:hidden w-full flex items-center justify-center gap-2 h-10 rounded-lg text-white text-[13px] font-semibold cursor-pointer active:scale-[0.98]"
                style={{ background: "var(--danger)" }}
              >
                End session
              </button>
            ) : (
              <button
                id="leave-btn-mobile"
                onClick={onLeaveSession}
                className="sm:hidden w-full flex items-center justify-center gap-2 h-10 rounded-lg text-white text-[13px] font-semibold cursor-pointer active:scale-[0.98]"
                style={{ background: "var(--danger)" }}
              >
                Leave session
              </button>
            )}
          </div>

          {/* Participants List (Exact from test2.html) */}
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[13px] font-bold"
                style={{ color: "var(--ink)" }}
              >
                Participants
              </span>
              <span
                className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--ink-faint)",
                }}
              >
                {sessionData.participants.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {sessionData.participants.map((p) => {
                const isCurrentUser =
                  p.participantId === sessionData.participantId;
                const initials = getInitials(p.username);

                if (isCurrentUser) {
                  return (
                    <div
                      key={p.participantId}
                      id={`participant-me-${p.participantId}`}
                      className="flex items-center justify-between p-2.5 rounded-xl transition-colors border"
                      style={{
                        background: "var(--surface-alt)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[12px] text-white"
                            style={{ background: "var(--brand)" }}
                          >
                            {initials}
                          </div>
                          <span
                            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                            style={{
                              background: "var(--success)",
                              border: "2px solid var(--surface-alt)",
                            }}
                          />
                        </div>
                        <div className="truncate min-w-0">
                          <div
                            className="font-semibold text-[13px] truncate"
                            style={{ color: "var(--ink)" }}
                          >
                            {p.username}
                          </div>
                          <div
                            className="text-[11px]"
                            style={{ color: "var(--ink-faint)" }}
                          >
                            Active now
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.isOwner && (
                          <span
                            id="badge-owner-me"
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border"
                            style={{
                              background: "var(--gold-tint)",
                              color: "var(--gold)",
                              borderColor: "var(--gold-tint-border)",
                            }}
                          >
                            Owner
                          </span>
                        )}
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: "var(--success-tint)",
                            color: "var(--success)",
                          }}
                        >
                          You
                        </span>
                      </div>
                    </div>
                  );
                }

                // Other participant
                return (
                  <div
                    key={p.participantId}
                    id={`participant-peer-${p.participantId}`}
                    className="flex items-center justify-between p-2.5 rounded-xl transition-colors border bg-white"
                    style={{
                      borderColor: "var(--border)",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[12px] text-white"
                          style={{ background: "var(--ink-soft)" }}
                        >
                          {initials}
                        </div>
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                          style={{
                            background: "var(--success)",
                            border: "2px solid #ffffff",
                          }}
                        />
                      </div>
                      <div className="truncate min-w-0">
                        <div
                          className="font-semibold text-[13px] truncate"
                          style={{ color: "var(--ink)" }}
                        >
                          {p.username}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--ink-faint)" }}
                        >
                          Connected peer
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {p.isOwner ? (
                        <span
                          id="badge-owner-peer"
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border"
                          style={{
                            background: "var(--gold-tint)",
                            color: "var(--gold)",
                            borderColor: "var(--gold-tint-border)",
                          }}
                        >
                          Owner
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            background: "var(--surface-alt)",
                            color: "var(--ink-faint)",
                          }}
                        >
                          Joiner
                        </span>
                      )}

                      {/* Owner controls for joiner */}
                      {isOwner && !p.isOwner && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => setTransferTarget(p)}
                            title={`Make ${p.username} owner`}
                            className="p-1 rounded cursor-pointer transition-colors border"
                            style={{
                              background: "var(--gold-tint)",
                              color: "var(--gold)",
                              borderColor: "var(--gold-tint-border)",
                            }}
                          >
                            <Crown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setKickTarget(p)}
                            title={`Kick and ban ${p.username}`}
                            className="p-1 rounded cursor-pointer transition-colors border"
                            style={{
                              background: "var(--danger-tint)",
                              color: "var(--danger)",
                              borderColor: "#f5c6c4",
                            }}
                          >
                            <UserX className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Telemetry (Exact from test2.html) */}
          <div
            id="storage-telemetry-box"
            className="p-4 text-[11px] flex items-center justify-between shrink-0 border-t"
            style={{
              color: "var(--ink-faint)",
              borderColor: "var(--border)",
            }}
          >
            <span>
              Memory-only storage (
              <strong id="storage-mode-val" style={{ color: "var(--success)" }}>
                RAM ONLY
              </strong>
              )
            </span>
            <span id="purge-on-close-val" className="font-mono">
              AES-GCM-256
            </span>
          </div>
        </aside>

        {/* 3. CHAT CANVAS & CONVERSATION VIEW (Exact from test2.html) */}
        <main className="flex-1 flex flex-col chat-canvas relative overflow-hidden min-h-0 h-full">
          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div
              id="sidebar-backdrop"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/30 z-10 lg:hidden cursor-pointer"
            />
          )}

          {/* Chat Canvas Subheader (Exact from test2.html) */}
          <div
            className="h-14 px-4 sm:px-6 flex items-center justify-between z-10 shrink-0 border-b bg-white"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-[11px] shrink-0"
                style={{ background: "var(--brand)" }}
              >
                {getInitials(peerDisplayName)}
              </div>
              <div className="leading-tight truncate">
                <div
                  className="font-semibold text-[13.5px] truncate"
                  style={{ color: "var(--ink)" }}
                >
                  {peerDisplayName}
                </div>
                <div
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--success)" }}
                  />
                  <span>Online</span>
                  <span style={{ color: "var(--border)" }}>|</span>
                  <svg
                    className="w-3 h-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--ink-faint)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Encrypted</span>
                  <span className="hidden sm:inline" style={{ color: "var(--border)" }}>|</span>
                  <span className="hidden sm:inline truncate">
                    Host: <strong style={{ color: "var(--ink)" }}>{creatorName}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddDeviceModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-semibold cursor-pointer transition-colors"
                style={{
                  color: "var(--ink-soft)",
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "var(--surface)")}
                title="Add Device or QR"
              >
                <Smartphone className="w-3.5 h-3.5" style={{ color: "var(--brand)" }} />
                <span>Add Device</span>
              </button>
            </div>
          </div>

          {/* Incoming Call In-Session Banner */}
          {incomingCall && !isOwner && callState !== "ACTIVE" && (
            <div
              className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b shadow-xs z-20 shrink-0"
              style={{
                background: "var(--gold-tint)",
                borderColor: "var(--gold-tint-border)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "var(--brand)" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-3.5 w-3.5"
                    style={{ background: "var(--brand)" }}
                  />
                </span>
                <div>
                  <div
                    className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: "var(--gold)" }}
                  >
                    {incomingCall.callType === "video" ? (
                      <Video className="w-3.5 h-3.5" />
                    ) : (
                      <Phone className="w-3.5 h-3.5" />
                    )}
                    <span>
                      Incoming {incomingCall.callType === "video" ? "Video" : "Audio"} Call
                    </span>
                  </div>
                  <span className="block text-[11px]" style={{ color: "var(--ink-soft)" }}>
                    {incomingCall.callerName || "Host"} is calling the session
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="banner_decline_call_button"
                  onClick={onDeclineCall}
                  className="px-3 py-1.5 bg-white border text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  style={{
                    color: "var(--ink-soft)",
                    borderColor: "var(--border)",
                  }}
                >
                  Decline
                </button>
                <button
                  id="banner_accept_call_button"
                  onClick={onAcceptCall}
                  className="px-3 py-1.5 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                  style={{ background: "var(--brand)" }}
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

          {/* Active P2P WebRTC Video / Audio Call Window */}
          {(callState === "ACTIVE" || (callState === "INVITING" && isOwner)) && (
            <div className="shrink-0 px-4 pt-3 z-20">
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
            </div>
          )}

          {/* Messages Container (Exact styling & structure from test2.html) */}
          <div
            ref={messagesContainerRef}
            id="messages-container"
            onScroll={handleScroll}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file && onSendFile) {
                onSendFile(file);
              }
            }}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 z-10 min-h-0"
          >
            {/* Empty State Banner (Exact from test2.html) */}
            {messages.length === 0 && fileTransfers.length === 0 && (
              <div
                id="secure-line-banner"
                className="max-w-sm mx-auto my-8 p-6 rounded-2xl text-center border shadow-xs"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="w-11 h-11 mx-auto mb-3 rounded-full flex items-center justify-center"
                  style={{
                    background: "var(--brand-tint)",
                    color: "var(--brand)",
                  }}
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
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h3
                  className="text-[14px] font-bold"
                  style={{ color: "var(--ink)" }}
                >
                  Line secured
                </h3>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Send a message to start. Everything here lives in memory and
                  disappears when the session ends.
                </p>
              </div>
            )}

            {/* Dynamic Live Messages Container */}
            <div id="dynamic-messages" className="space-y-3 max-w-2xl mx-auto flex flex-col">
              {[...messages, ...fileTransfers].map((m) => {
                if (m.isSystem) {
                  return (
                    <div
                      key={m.messageId}
                      className="my-2 py-1 px-3.5 border text-[11px] font-semibold text-center mx-auto max-w-fit rounded-lg shadow-xs flex items-center gap-1.5"
                      style={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      <Info className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--brand)" }} />
                      <span>{m.text}</span>
                    </div>
                  );
                }

                const isMe =
                  m.senderId === sessionData.participantId || m.isLocal;

                // File message transfer
                if (
                  m.isTransferring ||
                  m.objectUrl ||
                  m.category ||
                  m.type === "file"
                ) {
                  return (
                    <div
                      key={m.messageId || m.fileId}
                      className={`flex w-full ${
                        isMe ? "justify-end" : "justify-start"
                      } my-1`}
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

                // Self bubble (Exact from test2.html: brand-tint background, rounded-br-[4px])
                if (isMe) {
                  return (
                    <div
                      key={m.messageId}
                      className="flex w-full justify-end my-1"
                    >
                      <div className="relative group max-w-[82%] sm:max-w-[65%] flex flex-col items-end">
                        <div
                          onDoubleClick={() => onReactMessage?.(m.messageId, "❤️")}
                          className="msg-in w-fit min-w-[76px] p-3 rounded-2xl text-[14px] relative border shadow-xs"
                          style={{
                            background: "var(--brand-tint)",
                            borderColor: "var(--brand-tint-border)",
                            borderBottomRightRadius: "4px",
                          }}
                        >
                          <div
                            className="break-words whitespace-pre-wrap leading-relaxed select-text"
                            style={{ color: "var(--ink)" }}
                          >
                            {m.text}
                          </div>
                          <div
                            className="text-[10px] text-right mt-1 flex justify-end items-center gap-1 select-none"
                            style={{ color: "var(--ink-faint)" }}
                          >
                            <span>{timeStr}</span>
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="var(--brand)"
                              strokeWidth="2.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              viewBox="0 0 24 24"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>

                          {/* Message Reactions */}
                          <MessageReactions
                            messageId={m.messageId}
                            reactions={m.reactions}
                            currentParticipantId={sessionData.participantId}
                            onReact={onReactMessage}
                            align="right"
                            canReact={true}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                // Peer bubble (Exact from test2.html: white background, brand sender name, rounded-bl-[4px])
                return (
                  <div
                    key={m.messageId}
                    className="flex w-full justify-start my-1"
                  >
                    <div className="relative group max-w-[82%] sm:max-w-[65%] flex flex-col items-start">
                      <div
                        onDoubleClick={() => onReactMessage?.(m.messageId, "❤️")}
                        className="msg-in w-fit min-w-[76px] p-3 rounded-2xl text-[14px] relative border shadow-xs"
                        style={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          borderBottomLeftRadius: "4px",
                        }}
                      >
                        <div
                          className="text-[11px] font-bold mb-0.5 flex items-center gap-1.5"
                          style={{ color: "var(--brand)" }}
                        >
                          <span>{m.senderName}</span>
                          {m.isOwner && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold border"
                              style={{
                                background: "var(--gold-tint)",
                                color: "var(--gold)",
                                borderColor: "var(--gold-tint-border)",
                              }}
                            >
                              Owner
                            </span>
                          )}
                        </div>
                        <div
                          className="break-words whitespace-pre-wrap leading-relaxed select-text"
                          style={{ color: "var(--ink)" }}
                        >
                          {m.text}
                        </div>
                        <div
                          className="text-[10px] text-right mt-1 select-none"
                          style={{ color: "var(--ink-faint)" }}
                        >
                          {timeStr}
                        </div>

                        {/* Message Reactions */}
                        <MessageReactions
                          messageId={m.messageId}
                          reactions={m.reactions}
                          currentParticipantId={sessionData.participantId}
                          onReact={onReactMessage}
                          align="left"
                          canReact={true}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Live typing status */}
              {typingUsers.length > 0 && (
                <div
                  className="text-xs font-medium italic flex items-center gap-1.5 py-1 px-1"
                  style={{ color: "var(--brand)" }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full pulse-dot"
                    style={{ background: "var(--brand)" }}
                  />
                  <span>
                    {typingUsers.join(", ")}{" "}
                    {typingUsers.length === 1 ? "is" : "are"} typing...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating 'New messages' indicator when scrolled up */}
          <AnimatePresence>
            {showNewMessagesBtn && (
              <motion.button
                id="new-messages-indicator"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 z-20 cursor-pointer transition-all active:scale-95"
                style={{ background: "var(--brand)" }}
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
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
                <span>New messages</span>
              </motion.button>
            )}
          </AnimatePresence>

          {/* 4. BOTTOM CHAT INPUT BAR (Exact from test2.html) */}
          <footer
            id="chat-input-bar"
            className="px-3 sm:px-5 py-3 flex items-center gap-2 z-10 shrink-0 border-t bg-white"
            style={{
              borderColor: "var(--border)",
            }}
          >
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Attach File Button (Exact from test2.html) */}
            <button
              type="button"
              onClick={handleTriggerFileSelect}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
              style={{ color: "var(--ink-soft)" }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              title="Attach a file"
            >
              <svg
                className="w-4.5 h-4.5"
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

            {/* Message Input Form (Exact from test2.html) */}
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
                placeholder={`Message ${peerDisplayName}...`}
                className="w-full rounded-lg px-4 py-2.5 text-[14px] outline-none transition-all border"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--ink)",
                  borderColor: "var(--border)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--brand)";
                  e.target.style.background = "var(--surface)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border)";
                  e.target.style.background = "var(--surface-alt)";
                }}
                autoComplete="off"
                maxLength={2000}
              />

              {/* Voice Note Button (Exact from test2.html) */}
              <button
                type="button"
                onClick={handleSendVoiceNote}
                className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center transition-colors cursor-pointer shrink-0"
                style={{ color: "var(--ink-soft)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                title="Send a voice note"
              >
                <svg
                  className="w-4.5 h-4.5"
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

              {/* Send Button (Exact from test2.html) */}
              <button
                id="send-btn"
                type="submit"
                disabled={!inputText.trim()}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-white transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-40 shadow-xs"
                style={{ background: "var(--brand)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--brand-dark)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
                title="Send"
              >
                <svg
                  className="w-4.5 h-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
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

      {/* 5. TOAST NOTIFICATION (Exact styling from test2.html) */}
      <div
        id="toast"
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 text-[13px] px-4 py-2.5 rounded-lg shadow-lg transition-opacity duration-300 z-50 flex items-center gap-2 pointer-events-none ${
          showToast ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: "var(--ink)",
          color: "#ffffff",
        }}
      >
        <svg
          className="w-4 h-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--success)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span id="toast-text">{toastText}</span>
      </div>

      {/* 6. ADD DEVICE RESPONSIVE MODAL */}
      <AddDeviceModal
        isOpen={showAddDeviceModal}
        onClose={() => setShowAddDeviceModal(false)}
        sessionId={sessionData.sessionId}
        passkey={sessionData.passkey}
        onTestInTab={handleOpenTestTab}
        onShowToast={triggerToast}
      />

      {/* 7. TERMINATE CONFIRMATION MODAL */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border p-6 shadow-2xl font-sans"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-3 mb-4 pb-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--danger-tint)",
                  color: "var(--danger)",
                }}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3
                className="text-base font-bold"
                style={{ color: "var(--ink)" }}
              >
                End session?
              </h3>
            </div>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: "var(--ink-soft)" }}
            >
              Every message and attachment in this session lives only in memory. Ending this session will immediately disconnect all {sessionData.participants.length} participants and clear all memory buffers permanently.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndSession();
                }}
                className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                style={{ background: "var(--danger)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#a8342e")}
                onMouseOut={(e) => (e.currentTarget.style.background = "var(--danger)")}
              >
                End session
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 8. KICK PARTICIPANT MODAL */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border p-6 shadow-2xl font-sans"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-3 mb-4 pb-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--danger-tint)",
                  color: "var(--danger)",
                }}
              >
                <UserX className="w-5 h-5" />
              </div>
              <h3
                className="text-base font-bold"
                style={{ color: "var(--ink)" }}
              >
                Kick & Bar Participant?
              </h3>
            </div>
            <p
              className="text-sm leading-relaxed mb-3"
              style={{ color: "var(--ink-soft)" }}
            >
              Are you sure you want to remove{" "}
              <strong style={{ color: "var(--ink)" }}>
                {kickTarget.username}
              </strong>
              ?
            </p>
            <div
              className="text-xs leading-relaxed mb-6 p-3 rounded-xl border"
              style={{
                background: "var(--gold-tint)",
                color: "var(--gold)",
                borderColor: "var(--gold-tint-border)",
              }}
            >
              Kicked participants are permanently barred from rejoining this active
              session even if they possess the invite link and passkey.
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setKickTarget(null)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetId = kickTarget.participantId;
                  setKickTarget(null);
                  onKickParticipant(targetId);
                }}
                className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                style={{ background: "var(--danger)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#a8342e")}
                onMouseOut={(e) => (e.currentTarget.style.background = "var(--danger)")}
              >
                Kick & Ban
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 9. TRANSFER OWNERSHIP CONFIRMATION MODAL */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border p-6 shadow-2xl font-sans"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-3 mb-4 pb-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--gold-tint)",
                  color: "var(--gold)",
                }}
              >
                <Crown className="w-5 h-5" />
              </div>
              <h3
                className="text-base font-bold"
                style={{ color: "var(--ink)" }}
              >
                Transfer Session Ownership?
              </h3>
            </div>
            <p
              className="text-sm leading-relaxed mb-3"
              style={{ color: "var(--ink-soft)" }}
            >
              Transfer full ownership of this session to{" "}
              <strong style={{ color: "var(--ink)" }}>
                {transferTarget.username}
              </strong>
              ?
            </p>
            <div
              className="text-xs leading-relaxed mb-6 p-3 rounded-xl border"
              style={{
                background: "var(--gold-tint)",
                color: "var(--gold)",
                borderColor: "var(--gold-tint-border)",
              }}
            >
              The new owner will gain complete administrative control (call controls, kicking participants, and ending the session). You will remain in the session as an active participant.
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setTransferTarget(null)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetId = transferTarget.participantId;
                  const targetName = transferTarget.username;
                  setTransferTarget(null);
                  if (typeof onTransferOwnership === "function") {
                    onTransferOwnership(targetId, (res) => {
                      if (res?.success) {
                        triggerToast(`Ownership transferred to ${targetName}`);
                      }
                    });
                  }
                }}
                className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                style={{ background: "var(--brand)" }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--brand-dark)")}
                onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Confirm Transfer</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 10. OWNER LEAVE IN MID (Transfer Ownership & Leave) MODAL */}
      {showOwnerLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-2xl border p-6 shadow-2xl font-sans"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="flex items-center gap-3 mb-4 pb-3 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--brand-tint)",
                  color: "var(--brand)",
                }}
              >
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3
                  className="text-base font-bold"
                  style={{ color: "var(--ink)" }}
                >
                  Leave Session as Owner
                </h3>
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  Transfer ownership so the meet continues running
                </p>
              </div>
            </div>

            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: "var(--ink-soft)" }}
            >
              To leave the meet without terminating the session for other participants, select a joiner to take over as the new session owner:
            </p>

            <div className="mb-4">
              <label
                className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: "var(--ink-soft)" }}
              >
                Select New Owner
              </label>
              <select
                value={selectedNewOwnerId}
                onChange={(e) => setSelectedNewOwnerId(e.target.value)}
                className="w-full border rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none cursor-pointer"
                style={{
                  background: "var(--surface-alt)",
                  borderColor: "var(--border)",
                  color: "var(--ink)",
                }}
              >
                {sessionData.participants
                  .filter((p) => p.participantId !== sessionData.participantId)
                  .map((p) => (
                    <option key={p.participantId} value={p.participantId}>
                      {p.username}
                    </option>
                  ))}
              </select>
            </div>

            <div
              className="p-3 rounded-xl border text-xs mb-6 leading-relaxed"
              style={{
                background: "var(--brand-tint)",
                borderColor: "var(--brand-tint-border)",
                color: "var(--brand)",
              }}
            >
              The selected participant will become the new session owner. The session will remain active and uninterrupted after you leave.
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setShowOwnerLeaveModal(false);
                  setShowEndConfirm(true);
                }}
                className="text-xs font-semibold underline cursor-pointer"
                style={{ color: "var(--danger)" }}
              >
                End for everyone
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOwnerLeaveModal(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--ink)",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!selectedNewOwnerId) return;
                    setShowOwnerLeaveModal(false);
                    if (typeof onTransferAndLeaveSession === "function") {
                      onTransferAndLeaveSession(selectedNewOwnerId);
                    }
                  }}
                  disabled={!selectedNewOwnerId}
                  className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "var(--brand)" }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "var(--brand-dark)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "var(--brand)")}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Transfer & Leave</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};


// merging to main to undo changes