import React, { useRef, useState } from 'react';
import { Paperclip, AlertCircle } from 'lucide-react';
import { MAX_FILE_SIZE, formatBytes } from '../../webrtc/config.js';

export const FileUploadButton = ({ onFileSelect, disabled = false }) => {
  const fileInputRef = useRef(null);
  const [sizeError, setSizeError] = useState(null);

  const handleClick = () => {
    if (disabled) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setSizeError({
        name: file.name,
        size: file.size,
      });
      return;
    }

    onFileSelect(file);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        id="file_upload_button"
        onClick={handleClick}
        disabled={disabled}
        className={`p-2.5 sm:p-3 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-colors active:translate-x-[1px] active:translate-y-[1px] ${
          disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-white hover:bg-slate-100 text-slate-900'
        }`}
        title="Send file, image, or PDF peer-to-peer (up to 25 MB)"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      {/* File Size Error Modal */}
      {sizeError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-mono">
          <div className="w-full max-w-sm bg-white border-2 border-slate-900 p-5 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-slate-900">
            <div className="flex items-center gap-2 text-rose-600 mb-3 pb-2 border-b-2 border-slate-900">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider">
                File Exceeds Limit
              </h4>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed mb-3">
              <strong className="text-slate-900 font-bold block truncate">{sizeError.name}</strong>
              Selected file is <span className="font-bold text-rose-600">{formatBytes(sizeError.size)}</span>. The maximum supported ephemeral transfer size is 25 MB.
            </p>

            <button
              onClick={() => setSizeError(null)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </>
  );
};
