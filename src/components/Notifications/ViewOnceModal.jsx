import React, { useState } from 'react';
import { EyeOff, AlertTriangle, Check, Copy, X, Lock, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ViewOnceModal = ({
  isOpen,
  onClose,
  messageMeta,
  userEmail,
  userPasskey = '',
  sessionToken = null,
  onMessageConsumed,
}) => {
  const [step, setStep] = useState('CONFIRM'); // 'CONFIRM' | 'LOADING' | 'VIEWING' | 'ERROR'
  const [revealedContent, setRevealedContent] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setStep('CONFIRM');
      setRevealedContent(null);
      setErrorMessage(null);
      setCopied(false);
    }
  }, [isOpen, messageMeta]);

  if (!isOpen || !messageMeta) return null;

  const handleConfirmOpen = async () => {
    setStep('LOADING');
    setErrorMessage(null);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`/api/notifications/messages/${messageMeta.id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: userEmail.trim(),
          ...(userPasskey ? { passkey: userPasskey.trim() } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to retrieve message.');
      }

      setRevealedContent(data.message.content);
      setStep('VIEWING');
      if (onMessageConsumed) {
        onMessageConsumed(messageMeta.id);
      }
    } catch (err) {
      setErrorMessage(err.message);
      setStep('ERROR');
    }
  };

  const handleCopy = () => {
    if (revealedContent) {
      navigator.clipboard.writeText(revealedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#e9edef] shadow-xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#111b21]">View Once Message</h3>
              <p className="text-[11px] text-[#54656f] font-mono">From: {messageMeta.senderEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#54656f] hover:bg-[#f0f2f5] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Confirmation Warning */}
        {step === 'CONFIRM' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Permanent Single-View Action</span>
              </div>
              <p className="leading-relaxed text-amber-800/90">
                This message is flagged as <strong>View Once</strong>. Once you open it:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-amber-800/90">
                <li>Its content will be fetched and displayed on this screen.</li>
                <li>The server will immediately and irrevocably delete the message.</li>
                <li>It cannot be opened again by anyone.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#54656f] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOpen}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Open & Destroy</span>
              </button>
            </div>
          </div>
        )}

        {/* Step: Loading */}
        {step === 'LOADING' && (
          <div className="py-8 text-center space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#54656f]">Retrieving and self-destructing message...</p>
          </div>
        )}

        {/* Step: Viewing Content */}
        {step === 'VIEWING' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-semibold">
              <Flame className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Message has been permanently deleted from server storage.</span>
            </div>

            <div className="p-4 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#54656f] border-b border-[#e9edef] pb-2">
                <span>CONTENT:</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[#00a884] hover:underline font-semibold cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-sm text-[#111b21] whitespace-pre-wrap break-words leading-relaxed pt-1 select-all font-sans">
                {revealedContent}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#111b21] hover:bg-[#2a3942] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Step: Error */}
        {step === 'ERROR' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Error Retrieving Message</span>
              </div>
              <p>{errorMessage}</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#54656f] hover:bg-[#f0f2f5] rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
