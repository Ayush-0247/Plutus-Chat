import React, { useState, useEffect } from "react";
import {
  QrCode,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X,
  ShieldCheck,
  KeyRound,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "qrcode";

export const AddDeviceModal = ({
  isOpen,
  onClose,
  sessionId,
  passkey,
  onTestInTab,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState("qr"); // "qr" | "link" | "credentials"
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = `${origin}?join=${sessionId}&key=${passkey}`;

  useEffect(() => {
    if (isOpen && inviteUrl) {
      QRCode.toDataURL(inviteUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: "#111b21",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Error generating QR code:", err));
    }
  }, [isOpen, inviteUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      if (onShowToast) onShowToast("Invite link copied to clipboard!");
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopiedId(true);
      if (onShowToast) onShowToast(`Copied Session ID: ${sessionId}`);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(passkey).then(() => {
      setCopiedKey(true);
      if (onShowToast) onShowToast(`Copied Passkey: ${passkey}`);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      <div
        id="add-device-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="w-full max-w-md md:max-w-lg bg-white rounded-2xl shadow-2xl border border-[#e9edef] overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 bg-[#f0f2f5] border-b border-[#e9edef] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#00a884] flex items-center justify-center text-white shrink-0 shadow-2xs">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-[#111b21] truncate">
                  Add Device / Join Peer
                </h3>
                <p className="text-[11px] sm:text-xs text-[#54656f] truncate">
                  Connect another phone, tablet, or browser tab
                </p>
              </div>
            </div>
            <button
              id="close-add-device-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#54656f] hover:text-[#111b21] hover:bg-white transition-colors cursor-pointer shrink-0 ml-2"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs for Mobile & Desktop */}
          <div className="px-4 sm:px-6 pt-3 bg-white border-b border-[#e9edef] flex items-center gap-2 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab("qr")}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "qr"
                  ? "border-[#00a884] text-[#00a884]"
                  : "border-transparent text-[#54656f] hover:text-[#111b21]"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Code</span>
            </button>
            <button
              onClick={() => setActiveTab("link")}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "link"
                  ? "border-[#00a884] text-[#00a884]"
                  : "border-transparent text-[#54656f] hover:text-[#111b21]"
              }`}
            >
              <Copy className="w-4 h-4" />
              <span>Invite Link</span>
            </button>
            <button
              onClick={() => setActiveTab("credentials")}
              className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === "credentials"
                  ? "border-[#00a884] text-[#00a884]"
                  : "border-transparent text-[#54656f] hover:text-[#111b21]"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Session Passkey</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            {/* TAB 1: QR CODE */}
            {activeTab === "qr" && (
              <div className="flex flex-col items-center text-center space-y-3.5">
                <div className="p-3 bg-white rounded-2xl border-2 border-[#e9edef] shadow-2xs inline-block">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Session Invite QR Code"
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#111b21]">
                    <Smartphone className="w-4 h-4 text-[#00a884]" />
                    <span>Point your phone camera to scan</span>
                  </div>
                  <p className="text-xs text-[#54656f] max-w-xs mx-auto leading-relaxed">
                    Instantly opens this encrypted session on any mobile device
                    without typing passwords.
                  </p>
                </div>

                <div className="w-full pt-2 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>LINK COPIED!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>COPY INVITE LINK</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onTestInTab}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white border border-[#e9edef] hover:bg-[#f0f2f5] text-[#111b21] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4 text-[#54656f]" />
                    <span>TEST IN TAB</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: INVITE LINK */}
            {activeTab === "link" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
                    Shareable Encrypted Link
                  </label>
                  <div className="p-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef] text-xs font-mono text-[#111b21] break-all leading-relaxed select-all">
                    {inviteUrl}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>COPIED TO CLIPBOARD!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>COPY INVITE LINK</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onTestInTab}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-white border border-[#e9edef] hover:bg-[#f0f2f5] text-[#111b21] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4 text-[#54656f]" />
                    <span>TEST IN TAB</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#e7f7f3] border border-[#00a884]/20 flex items-start gap-2.5 text-xs text-[#008069]">
                  <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    The link contains the session token and encrypted passkey.
                    Anyone with this link can join until the session is terminated.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CREDENTIALS */}
            {activeTab === "credentials" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
                    Session ID
                  </label>
                  <div className="flex items-center justify-between p-3 bg-[#f0f2f5] rounded-xl border border-[#e9edef]">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-[#00a884]" />
                      <span className="font-mono font-bold text-sm text-[#111b21]">
                        {sessionId}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyId}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#e9edef] text-xs font-semibold text-[#54656f] hover:text-[#00a884] cursor-pointer"
                    >
                      {copiedId ? (
                        <Check className="w-3.5 h-3.5 text-[#00a884]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#54656f] mb-1.5">
                    Passkey
                  </label>
                  <div className="flex items-center justify-between p-3 bg-[#fef9c3] rounded-xl border border-[#fde047]">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#854d0e]" />
                      <span className="font-mono font-bold text-sm text-[#713f12]">
                        {passkey}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyKey}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#fde047] text-xs font-semibold text-[#854d0e] hover:text-[#ca8a04] cursor-pointer"
                    >
                      {copiedKey ? (
                        <Check className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs text-[#54656f] leading-relaxed">
                  On the other device, navigate to the join page and enter the
                  Session ID and Passkey above.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 bg-[#f0f2f5] border-t border-[#e9edef] flex items-center justify-between shrink-0 text-xs text-[#54656f]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00a884]"></span>
              <span>Ephemeral Peer-to-Peer</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white border border-[#e9edef] text-[#111b21] font-semibold hover:bg-[#e9edef] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
