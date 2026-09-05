import React, { useRef, useState } from 'react';
import { Paperclip, AlertCircle, X } from 'lucide-react';
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
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
          disabled
            ? 'bg-[#f0f2f5] border-[#e9edef] text-[#8696a0] cursor-not-allowed'
            : 'bg-white border-[#e9edef] text-[#54656f] hover:text-[#111b21] hover:bg-[#f0f2f5] active:scale-95'
        }`}
        title="Send file, photo, or PDF peer-to-peer (up to 25 MB)"
      >
        <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-[#54656f]" />
      </button>

      {/* File Size Error Modal */}
      {sizeError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[#e9edef] p-6 shadow-2xl text-[#111b21]">
            <div className="flex items-center gap-2.5 text-[#ea0038] mb-3 pb-2 border-b border-[#e9edef]">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-[#ea0038] shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                File Exceeds Limit
              </h4>
            </div>

            <p className="text-xs text-[#54656f] leading-relaxed mb-4">
              <strong className="text-[#111b21] block truncate mb-1">{sizeError.name}</strong>
              Selected file is{' '}
              <span className="font-bold text-[#ea0038]">
                {formatBytes(sizeError.size)}
              </span>
              . The maximum supported ephemeral transfer size is 25 MB.
            </p>

            <button
              onClick={() => setSizeError(null)}
              className="w-full py-2.5 bg-[#111b21] hover:bg-[#2a3942] text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </>
  );
};
