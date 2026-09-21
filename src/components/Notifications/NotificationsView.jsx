import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  Send,
  Inbox,
  Radio,
  UserCheck,
  ShieldCheck,
  Lock,
  Flame,
  CheckCircle2,
  ExternalLink,
  LogOut,
  LogIn,
  KeyRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SendMessageCard } from './SendMessageCard.jsx';
import { ViewMessagesCard } from './ViewMessagesCard.jsx';
import { TextChannelCard } from './TextChannelCard.jsx';
import { AccountCard } from './AccountCard.jsx';

export const NotificationsView = ({ onBackToHome }) => {
  const [activeTab, setActiveTab] = useState('SEND'); // 'SEND' | 'MESSAGES' | 'CHANNEL' | 'ACCOUNT'

  // Server-side authentication session state (Addendum #6 & #7)
  const [sessionToken, setSessionToken] = useState(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const [channelStatus, setChannelStatus] = useState(null);
  const [sessionChecking, setSessionChecking] = useState(true);

  // Check active server session on mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/notifications/auth/session');
        const data = await res.json();
        if (data.success && data.authenticated && data.email) {
          setSessionEmail(data.email);
          setChannelStatus(Boolean(data.channelEnabled));
        }
      } catch (err) {
        console.warn('Session verification error:', err);
      } finally {
        setSessionChecking(false);
      }
    };
    verifySession();
  }, []);

  const handleLoginSuccess = ({ email, token, channelEnabled }) => {
    setSessionEmail(email);
    if (token) setSessionToken(token);
    setChannelStatus(Boolean(channelEnabled));
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/notifications/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
      });
    } catch (e) {}
    setSessionToken(null);
    setSessionEmail('');
    setChannelStatus(null);
  };

  const handleAccountRegistered = ({ email, passkey }) => {
    // Automatically log in after registration
    fetch('/api/notifications/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, passkey }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          handleLoginSuccess(data);
          setActiveTab('CHANNEL');
        }
      })
      .catch(() => {
        setActiveTab('ACCOUNT');
      });
  };

  const handleAccountDeleted = (deletedEmail) => {
    if (sessionEmail === deletedEmail) {
      setSessionToken(null);
      setSessionEmail('');
      setChannelStatus(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-8 font-sans">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          id="back_to_home_button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#e9edef] text-xs font-bold text-[#111b21] hover:bg-[#f5f6f8] transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#00a884]" />
          <span>Back to Home</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#e9edef] text-xs font-semibold text-[#111b21] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#00a884] pulse-indicator" />
          <span className="text-[#54656f]">PRIVATE TEXT CHANNELS</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="text-center space-y-2.5 max-w-2xl mx-auto">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#00a884] text-white flex items-center justify-center shadow-md">
          <Bell className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#111b21] tracking-tight">
          Private Text Channel <br />
          <span className="text-[#00a884]">& Notifications</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#54656f] max-w-xl mx-auto leading-relaxed">
          Decentralized email identity with cryptographic passkeys, receiver-controlled privacy gates, and self-destructing view-once notifications.
        </p>
      </div>

      {/* Active Session Status Bar (Addendum #6 & #7) */}
      {sessionEmail ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#e9edef] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#e7f7f3] text-[#008069] flex items-center justify-center font-bold shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#111b21] text-xs sm:text-sm">{sessionEmail}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    channelStatus
                      ? 'bg-[#e7f7f3] text-[#008069] border border-[#00a884]/30'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${channelStatus ? 'bg-[#00a884] animate-pulse' : 'bg-slate-400'}`} />
                  {channelStatus ? 'Channel Open' : 'Channel Disabled'}
                </span>
              </div>
              <span className="text-[#54656f] text-[11px] block mt-0.5">
                Authenticated session active • 30m idle timeout
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="session_sign_out_button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-[#f0f2f5] border border-[#e9edef] flex items-center justify-between gap-3 text-xs text-[#54656f]">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#54656f] shrink-0" />
            <span>Not authenticated. Sign in or register to manage your text channel.</span>
          </div>
          <button
            onClick={() => setActiveTab('ACCOUNT')}
            className="text-xs font-bold text-[#00a884] hover:underline cursor-pointer shrink-0"
          >
            Sign In / Register &rarr;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          id="tab_send_message"
          onClick={() => setActiveTab('SEND')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'SEND'
              ? 'bg-[#00a884] text-white border-[#00a884] shadow-sm'
              : 'bg-white text-[#111b21] border-[#e9edef] hover:border-[#cbd5e1]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Send className={`w-4 h-4 ${activeTab === 'SEND' ? 'text-white' : 'text-[#00a884]'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'SEND' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Direct
            </span>
          </div>
          <div>
            <div className="text-xs font-bold">Send Message</div>
            <div className={`text-[11px] truncate ${activeTab === 'SEND' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Send private text
            </div>
          </div>
        </button>

        <button
          id="tab_view_messages"
          onClick={() => setActiveTab('MESSAGES')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'MESSAGES'
              ? 'bg-[#00a884] text-white border-[#00a884] shadow-sm'
              : 'bg-white text-[#111b21] border-[#e9edef] hover:border-[#cbd5e1]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Inbox className={`w-4 h-4 ${activeTab === 'MESSAGES' ? 'text-white' : 'text-[#111b21]'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'MESSAGES' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Inbox
            </span>
          </div>
          <div>
            <div className="text-xs font-bold">View Messages</div>
            <div className={`text-[11px] truncate ${activeTab === 'MESSAGES' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Received notifications
            </div>
          </div>
        </button>

        <button
          id="tab_text_channel"
          onClick={() => setActiveTab('CHANNEL')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'CHANNEL'
              ? 'bg-[#00a884] text-white border-[#00a884] shadow-sm'
              : 'bg-white text-[#111b21] border-[#e9edef] hover:border-[#cbd5e1]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Radio className={`w-4 h-4 ${activeTab === 'CHANNEL' ? 'text-white' : 'text-amber-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'CHANNEL' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Gate
            </span>
          </div>
          <div>
            <div className="text-xs font-bold">Text Channel</div>
            <div className={`text-[11px] truncate ${activeTab === 'CHANNEL' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Enable / disable gate
            </div>
          </div>
        </button>

        <button
          id="tab_account_mgmt"
          onClick={() => setActiveTab('ACCOUNT')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeTab === 'ACCOUNT'
              ? 'bg-[#00a884] text-white border-[#00a884] shadow-sm'
              : 'bg-white text-[#111b21] border-[#e9edef] hover:border-[#cbd5e1]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <UserCheck className={`w-4 h-4 ${activeTab === 'ACCOUNT' ? 'text-white' : 'text-indigo-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'ACCOUNT' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Identity
            </span>
          </div>
          <div>
            <div className="text-xs font-bold">Account</div>
            <div className={`text-[11px] truncate ${activeTab === 'ACCOUNT' ? 'text-white/80' : 'text-[#54656f]'}`}>
              Login / Register / Wipe
            </div>
          </div>
        </button>
      </div>

      {/* Active Tab Panel */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {activeTab === 'SEND' && (
          <SendMessageCard
            sessionToken={sessionToken}
            sessionEmail={sessionEmail}
            onRequireAuth={() => setActiveTab('ACCOUNT')}
          />
        )}

        {activeTab === 'MESSAGES' && (
          <ViewMessagesCard
            sessionToken={sessionToken}
            sessionEmail={sessionEmail}
            onRequireAuth={() => setActiveTab('ACCOUNT')}
          />
        )}

        {activeTab === 'CHANNEL' && (
          <TextChannelCard
            sessionToken={sessionToken}
            sessionEmail={sessionEmail}
            channelStatus={channelStatus}
            onChannelStatusChange={(enabled) => setChannelStatus(enabled)}
            onRequireAuth={() => setActiveTab('ACCOUNT')}
          />
        )}

        {activeTab === 'ACCOUNT' && (
          <AccountCard
            sessionEmail={sessionEmail}
            sessionToken={sessionToken}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onAccountRegistered={handleAccountRegistered}
            onAccountDeleted={handleAccountDeleted}
          />
        )}
      </motion.div>

      {/* Privacy Guarantee Footer */}
      <div className="p-4 rounded-2xl bg-white border border-[#e9edef] text-xs text-[#54656f] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0" />
          <span>Independent from temporary chat sessions. Strictly authenticated by hashed passkeys and secure sessions.</span>
        </div>
      </div>
    </div>
  );
};

