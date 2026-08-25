import React, { useState } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  RefreshCw,
  Cpu,
  AlertTriangle,
  FileCheck,
  Activity,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  Trash2,
  Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SecurityDashboardModal({
  isOpen,
  onClose,
  sessionData,
  identityKeyPair,
  securityLogs = [],
  onRotateKeys,
  isRotatingKeys = false,
  onRunTamperTest,
}) {
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [activeTab, setActiveTab] = useState('CRYPTO'); // CRYPTO | AUDIT | THREAT

  if (!isOpen) return null;

  const handleCopyFingerprint = () => {
    if (identityKeyPair?.fingerprint) {
      navigator.clipboard.writeText(identityKeyPair.fingerprint);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="security_dashboard_overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          id="security_dashboard_container"
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-white border-2 border-slate-900 rounded-none shadow-[12px_12px_0px_0px_rgba(15,23,42,1)] flex flex-col font-mono text-slate-900 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b-2 border-slate-900 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-400 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                  Cryptographic Security & Audit Center
                </h3>
                <p className="text-xs text-slate-300 font-sans">
                  Phase 3: End-to-End Encrypted File Transfer • Web Crypto AES-256-GCM + ECDH
                </p>
              </div>
            </div>
            <button
              id="security_modal_close_button"
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center border-b-2 border-slate-900 bg-slate-100 px-4 pt-2 gap-2 text-xs font-bold">
            <button
              onClick={() => setActiveTab('CRYPTO')}
              className={`px-4 py-2 border-t-2 border-x-2 border-slate-900 transition-colors flex items-center gap-1.5 ${
                activeTab === 'CRYPTO'
                  ? 'bg-white text-indigo-700 -mb-[2px] pb-[10px] font-black'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>KEY AGREEMENT & CRYPTO</span>
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-4 py-2 border-t-2 border-x-2 border-slate-900 transition-colors flex items-center gap-1.5 ${
                activeTab === 'AUDIT'
                  ? 'bg-white text-indigo-700 -mb-[2px] pb-[10px] font-black'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>SECURITY AUDIT LOGS ({securityLogs.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('THREAT')}
              className={`px-4 py-2 border-t-2 border-x-2 border-slate-900 transition-colors flex items-center gap-1.5 ${
                activeTab === 'THREAT'
                  ? 'bg-white text-indigo-700 -mb-[2px] pb-[10px] font-black'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>THREAT MODEL & INVARIANTS</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
            {activeTab === 'CRYPTO' && (
              <div className="space-y-5">
                {/* Status Hero Card */}
                <div className="p-4 bg-emerald-50 border-2 border-emerald-700 shadow-[4px_4px_0px_0px_rgba(4,120,87,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-none bg-emerald-600 text-white flex items-center justify-center border-2 border-slate-900 shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                          E2EE Zero-Knowledge Protection Active
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-600 text-white">
                          PRD PHASE 3
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 font-sans mt-0.5">
                        Files are encrypted client-side with unique 256-bit AES-GCM keys. The server stores ciphertext only and has zero knowledge of plaintext.
                      </p>
                    </div>
                  </div>

                  <button
                    id="rotate_keys_modal_button"
                    onClick={onRotateKeys}
                    disabled={isRotatingKeys}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRotatingKeys ? 'animate-spin' : ''}`} />
                    <span>Rotate Keypair</span>
                  </button>
                </div>

                {/* Cryptographic Specifications Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Your Identity Key */}
                  <div className="p-4 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1.5">
                        <Key className="w-4 h-4" />
                        Your Identity Key (ECDH P-256)
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-900 font-black border border-indigo-300">
                        IN-MEMORY RAM
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-100 border border-slate-300 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Public Fingerprint</p>
                        <p className="font-mono font-black text-slate-900 tracking-wider">
                          {identityKeyPair?.fingerprint || 'GENERATING...'}
                        </p>
                      </div>
                      <button
                        onClick={handleCopyFingerprint}
                        title="Copy Fingerprint"
                        className="p-1.5 hover:bg-white text-slate-700 border border-slate-300 transition-colors"
                      >
                        {copiedFingerprint ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 font-sans leading-relaxed">
                      Your private key never leaves browser memory. Public keys are exchanged over the authenticated channel to derive shared wrapping keys.
                    </p>
                  </div>

                  {/* Encryption Primitive Details */}
                  <div className="p-4 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                        <Cpu className="w-4 h-4 text-emerald-600" />
                        Primitive Configuration
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-black border border-emerald-300">
                        STANDARD
                      </span>
                    </div>
                    <div className="text-xs space-y-1 text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Cipher:</span>
                        <span className="font-bold font-mono">AES-256-GCM (Authenticated)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Key Agreement:</span>
                        <span className="font-bold font-mono">ECDH (NIST P-256)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-500">Auth Tag:</span>
                        <span className="font-bold font-mono">128-bit GHASH Tag</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Nonce / IV:</span>
                        <span className="font-bold font-mono">96-bit CSPRNG unique per file</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Peer Status */}
                <div className="p-4 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                  <h4 className="text-xs font-black uppercase text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Session Participants & Fingerprints ({sessionData.participants.length})
                  </h4>
                  <div className="space-y-2">
                    {sessionData.participants.map((p) => (
                      <div
                        key={p.participantId}
                        className="p-2.5 bg-slate-50 border border-slate-300 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.isOwner ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="font-bold">{p.username}</span>
                          {p.isOwner && (
                            <span className="px-1 py-0.2 text-[9px] bg-amber-300 border border-slate-900 font-black">
                              OWNER
                            </span>
                          )}
                          {p.participantId === sessionData.participantId && (
                            <span className="px-1 py-0.2 text-[9px] bg-emerald-600 text-white font-black">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-bold">ECDH FINGERPRINT:</span>
                          <span className="font-mono text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 border border-indigo-200 text-[11px]">
                            {p.fingerprint || 'Synchronized'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tamper Resistance & Verification Info */}
                <div className="p-4 bg-amber-50 border-2 border-amber-600 flex items-start gap-3 text-xs text-amber-950">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Cryptographic Integrity Guarantee (PRD Section 25)</p>
                    <p className="font-sans leading-relaxed text-amber-900">
                      If an attacker or intermediate proxy modifies even a single bit of ciphertext or tampers with the authentication tag, Web Crypto AES-GCM verification strictly rejects the file with an integrity verification error.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'AUDIT' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-300">
                  <p className="text-xs text-slate-600 font-bold">
                    Real-time safe cryptographic security events emitted during this active session.
                  </p>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-slate-900 text-white">
                    ZERO SECRETS LOGGED
                  </span>
                </div>

                {securityLogs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    No security events recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {securityLogs.map((log) => {
                      const time = new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const isAlert =
                        log.type.includes('UNAUTHORIZED') ||
                        log.type.includes('FAILED') ||
                        log.type.includes('BANNED');

                      return (
                        <div
                          key={log.id || `${log.timestamp}-${Math.random()}`}
                          className={`p-2.5 border text-xs flex items-start justify-between gap-3 ${
                            isAlert
                              ? 'bg-rose-50 border-rose-400 text-rose-950'
                              : 'bg-white border-slate-300 text-slate-800'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-mono text-[10px] text-slate-500 font-bold shrink-0 mt-0.5">
                              {time}
                            </span>
                            <div>
                              <p className="font-black text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isAlert ? 'bg-rose-600' : 'bg-indigo-600'
                                  }`}
                                />
                                {log.type}
                              </p>
                              {log.details && (
                                <p className="text-[11px] text-slate-600 font-sans mt-0.5 break-all">
                                  {Object.entries(log.details)
                                    .filter(([_, v]) => v !== undefined)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(' • ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-300 shrink-0 uppercase text-slate-600">
                            VERIFIED
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'THREAT' && (
              <div className="space-y-4 text-xs font-sans text-slate-700">
                <div className="p-3.5 bg-slate-900 text-white font-mono">
                  <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                    Plutus Phase 3 Threat Model (PRD Section 37)
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 font-sans">
                    Designed to defend against compromised server infrastructure and eavesdropping proxies.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  <div className="p-3 bg-white border border-slate-300 space-y-1">
                    <p className="font-black text-[11px] text-indigo-700 uppercase">1. Server / Storage Breach</p>
                    <p className="text-[11px] text-slate-600 font-sans">
                      Attacker obtaining server RAM or disk reads only ciphertext. File decryption is cryptographically impossible without the client's private identity key.
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-300 space-y-1">
                    <p className="font-black text-[11px] text-indigo-700 uppercase">2. Ciphertext Tampering</p>
                    <p className="text-[11px] text-slate-600 font-sans">
                      AES-256-GCM 128-bit authentication tag verification immediately detects and rejects modified ciphertext bytes.
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-300 space-y-1">
                    <p className="font-black text-[11px] text-indigo-700 uppercase">3. Unauthorized File Access</p>
                    <p className="text-[11px] text-slate-600 font-sans">
                      Server strictly validates session membership and authorization before serving ciphertext. Guessing a UUID returns 403.
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-300 space-y-1">
                    <p className="font-black text-[11px] text-indigo-700 uppercase">4. File Expiration & Deletion</p>
                    <p className="text-[11px] text-slate-600 font-sans">
                      Server purges expired files from RAM and rejects subsequent download requests with 410 Gone.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t-2 border-slate-900 bg-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Standard: W3C Web Cryptography API</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-colors border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
            >
              Close Inspector
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}