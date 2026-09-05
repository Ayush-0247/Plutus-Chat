import React, { useState } from 'react';
import { Volume2, VolumeX, Radio, Shield, Info, Wifi } from 'lucide-react';
import { isSoundEnabled, toggleSound } from '../services/soundEffects.js';

export const Navbar = ({
  isConnected,
  activeSessionId,
  onOpenArchitecture,
}) => {
  const [sound, setSound] = useState(isSoundEnabled());

  const handleToggleSound = () => {
    const updated = toggleSound();
    setSound(updated);
  };

  return (
    <header
      id="main_navbar"
      className="w-full bg-[#f0f2f5] border-b border-[#e9edef] sticky top-0 z-40 shadow-2xs"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div
            id="navbar-brand-logo"
            className="w-9 h-9 rounded-xl bg-[#00a884] flex items-center justify-center text-white shadow-2xs shrink-0"
          >
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

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Active Session Indicator */}
          {activeSessionId && (
            <div
              id="navbar-session-pill"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#e9edef] text-xs font-mono shadow-2xs"
            >
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
              <span className="text-[#54656f] font-semibold text-[11px]">LINE:</span>
              <span className="font-bold text-[#00a884]">{activeSessionId}</span>
            </div>
          )}

          {/* Connection Status Pill */}
          <div
            id="connection_status_badge"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors shadow-2xs ${
              isConnected
                ? 'bg-[#e7f7f3] border-[#00a884]/30 text-[#008069]'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-[#00a884]' : 'bg-amber-500 animate-ping'
              }`}
            />
            <span className="text-[11px]">
              {isConnected ? 'NODE RAM ACTIVE' : 'CONNECTING...'}
            </span>
          </div>

          {/* Audio toggle button */}
          <button
            id="navbar-audio-btn"
            onClick={handleToggleSound}
            title={sound ? 'Mute sound notifications' : 'Enable sound notifications'}
            className={`w-8 h-8 rounded-lg bg-white border border-[#e9edef] flex items-center justify-center transition-colors cursor-pointer shadow-2xs ${
              sound
                ? 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                : 'text-rose-500 hover:bg-rose-50'
            }`}
            aria-label="Toggle audio effects"
          >
            {sound ? (
              <svg
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

          {/* Architecture Spec Button */}
          {onOpenArchitecture && (
            <button
              id="view_architecture_button"
              onClick={onOpenArchitecture}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#e9edef] text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef] text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              title="View Architecture Specifications"
            >
              <Info className="w-3.5 h-3.5 text-[#00a884]" />
              <span className="hidden sm:inline text-[11px]">SPECS</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
