import  { useState, useEffect } from 'react';
import { KeyRound, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const JoinSessionView = ({
  initialSessionId = '',
  initialPasskey = '',
  onJoinSession,
  onCancel,
  isLoading,
  errorMessage,
}) => {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [passkey, setPasskey] = useState(initialPasskey);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
    if (initialPasskey) setPasskey(initialPasskey);
  }, [initialSessionId, initialPasskey]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sessionId.trim() || !passkey.trim()) return;
    onJoinSession(sessionId.trim().toUpperCase(), passkey.trim().toUpperCase(), username.trim() || 'Participant');
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
          <div className="p-2.5 bg-slate-900 border-2 border-slate-900 text-amber-400 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide font-sans">
              Join Secure Line
            </h2>
            {/* <p className="text-xs text-slate-500 font-mono">
              Provide link ID & passkey to authenticate
            </p> */}
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-50 border-2 border-rose-600 text-rose-900 text-xs flex items-start gap-2.5 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
              Session ID
            </label>
            <input
              id="join_session_id_input"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="e.g. 8F7K2M"
              required
              maxLength={12}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:border-indigo-600 focus:bg-white text-slate-900 placeholder-slate-400 text-sm uppercase tracking-wider font-bold focus:outline-none shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
              Session Passkey
            </label>
            <input
              id="join_passkey_input"
              type="text"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value.toUpperCase())}
              placeholder="e.g. ALPHA-982"
              required
              maxLength={20}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:border-indigo-600 focus:bg-white text-slate-900 placeholder-slate-400 text-sm uppercase tracking-wider font-bold focus:outline-none shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
              Your Codename / Handle
            </label>
            <input
              id="join_username_input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Rahul, Aman, Rishi"
              maxLength={32}
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:border-indigo-600 focus:bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none shadow-inner"
            />
          </div>

          {/* <div className="p-3 bg-slate-100 border-2 border-slate-900 text-[11px] text-slate-700">
            <span className="text-indigo-800 font-bold uppercase">Dual-Factor Verification:</span> Both credentials will be validated against active RAM state on the server.
          </div> */}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              id="cancel_join_button"
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-900 font-bold text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px]"
            >
              Back
            </button>
            <button
              id="confirm_join_session_button"
              type="submit"
              disabled={isLoading || !sessionId.trim() || !passkey.trim()}
              className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none focus:outline-none"
            >
              {isLoading ? (
                <span>Validating Line...</span>
              ) : (
                <>
                  <span>Join Session</span>
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
