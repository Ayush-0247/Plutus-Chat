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
} from "lucide-react";
import { motion } from "motion/react";
import {
  playMessageSentSound,
} from "../services/soundEffects.js";

export const ActiveSessionView = ({
  sessionData,
  messages,
  typingUsers,
  onSendMessage,
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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

  const isOwner = sessionData.isOwner;

  return (
    <div className="w-full h-[670px] box-border px-1 sm:px-2 py-1 sm:py-3 flex flex-col font-mono bg-slate-50 relative">

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

          {/* Sidebar Footer Info */}
          <div className="pt-3 mt-3 border-t-2 border-slate-200 text-[10px] text-slate-600 font-bold space-y-1">
            <div className="flex items-center justify-between">
              <span>STORAGE MODE:</span>
              <span className="text-emerald-700 font-black">
                RAM ONLY
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
                  Send a text to begin secure communication. All messages are ephemeral and destroyed when the session ends.
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

                    {/* Standard Text Message */}
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] px-4 py-2.5 text-xs break-words leading-relaxed border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
                        isMe
                          ? "bg-indigo-600 text-white font-medium"
                          : "bg-white text-slate-900 font-medium"
                      }`}
                    >
                      {m.text}
                    </div>
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

          {/* Message Input Bar */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t-2 border-slate-900 bg-white"
          >
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder="Type real-time message... (Enter to send)"
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
              purge all messages from memory.
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
