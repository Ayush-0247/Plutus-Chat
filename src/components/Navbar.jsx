import React, { useState } from 'react';
import { Shield, Volume2, VolumeX, Radio, Terminal } from 'lucide-react';
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
    <header id="main_navbar" className="w-full border-b-2 border-slate-900 bg-white/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Title */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-slate-900 border-2 border-slate-900 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            {/* <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm sm:text-base text-slate-900 tracking-wider">
                EPHEMERAL<span className="text-indigo-600">.LINE</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono tracking-tight font-bold bg-emerald-100 border border-emerald-600 text-emerald-900">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                NO DATABASE • RAM ONLY
              </span>
            </div> */}

             <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm sm:text-base text-slate-900 tracking-wider">
                PLUTUS<span className="text-indigo-600">.CHAT</span>
              </span>
             
            </div>



            {/* <p className="text-[11px] text-slate-500 hidden sm:block font-mono font-medium">
              Zero-Persistence Real-time Secure Text Channel
            </p> */}
          </div>
        </div>

        {/* Actions & Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Session Indicator */}
          {activeSessionId && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border-2 border-slate-900 text-slate-900 font-mono text-xs font-bold">
              <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              <span className="text-slate-500">LINE:</span>
              <span className="text-indigo-600">{activeSessionId}</span>
            </div>
          )}

          {/* Connection Status Pill */}
          <div
            id="connection_status_badge"
            className={`flex items-center gap-1.5 px-2.5 py-1 border-2 text-xs font-mono font-bold transition-colors ${
              isConnected
                ? 'bg-emerald-50 border-emerald-700 text-emerald-800'
                : 'bg-amber-50 border-amber-600 text-amber-900'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-600' : 'bg-amber-500 animate-ping'
              }`}
            />
            <span className="hidden xs:inline">{isConnected ? 'SERVER SYNCED' : 'CONNECTING...'}</span>
          </div>

          {/* Audio toggle button */}
          <button
            id="toggle_audio_button"
            onClick={handleToggleSound}
            title={sound ? 'Mute sound effects' : 'Enable sound effects'}
            className="p-2 bg-white border-2 border-slate-900 text-slate-800 hover:bg-slate-100 transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus:outline-none"
            aria-label="Toggle audio effects"
          >
            {sound ? <Volume2 className="w-4 h-4 text-indigo-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Architecture & PRD details button */}
          {/* <button
            id="view_architecture_button"
            onClick={onOpenArchitecture}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-mono font-bold uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,0.4)] active:translate-x-[1px] active:translate-y-[1px] focus:outline-none"
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">SPEC / RAM RULES</span>
          </button> */}
        </div>
      </div>
    </header>
  );
};
