import React, { useState } from 'react';
import { ArrowRight, Radio } from 'lucide-react';
import { motion } from 'motion/react';

export const CreateSessionView = ({
  onCreateSession,
  onCancel,
  isLoading,
}) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateSession(username.trim() || 'Session Creator');
  };

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white border-2 border-slate-900 rounded-none p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] font-mono"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-slate-900">
          <div className="p-2.5 bg-indigo-600 border-2 border-slate-900 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide font-sans">
              Create Secure Line
            </h2>
            {/* <p className="text-xs text-slate-500 font-mono">
              Initialize a temporary owner-controlled room
            </p> */}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
              Your Codename / Handle
            </label>
            <input
              id="create_username_input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Cipher, Ayush, Agent-01"
              maxLength={32}
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:border-indigo-600 focus:bg-white text-slate-900 placeholder-slate-400 text-sm font-mono focus:outline-none shadow-inner"
            />
            {/* <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
              You will be granted OWNER privileges to manage participants and terminate the line.
            </p> */}
          </div>

          {/* Security Features checklist */}
          {/* <div className="p-3.5 bg-slate-100 border-2 border-slate-900 space-y-2 text-[11px] text-slate-700">
            <div className="flex items-center gap-2 text-indigo-700 font-black uppercase">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Automatic Security Generation</span>
            </div>
            <p className="text-slate-600 font-mono">
              A high-entropy Session ID and secret passkey will be generated in Node.js RAM upon creation.
            </p>
          </div> */}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              id="cancel_create_button"
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 font-bold text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              Back
            </button>
            <button
              id="confirm_create_session_button"
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none"
            >
              {isLoading ? (
                <span>Generating Line...</span>
              ) : (
                <>
                  <span>Create Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
