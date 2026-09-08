import React, { useState, useRef, useEffect } from "react";
import { Smile, Heart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

/**
 * WhatsApp / Instagram style message reaction picker and display badges
 */
export const MessageReactions = ({
  messageId,
  reactions = {},
  currentParticipantId,
  onReact,
  align = "left", // "left" for received messages, "right" for sent messages
  canReact = true,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  // Close picker on click outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showPicker]);

  const handleSelectEmoji = (emoji) => {
    if (typeof onReact === "function") {
      onReact(messageId, emoji);
    }
    setShowPicker(false);
  };

  // Convert reactions object to entries with count & hasReacted
  const reactionEntries = Object.entries(reactions || {}).filter(
    ([, users]) => Array.isArray(users) && users.length > 0
  );

  return (
    <div className="relative inline-flex items-center">
      {/* Reaction Trigger Button (Revealed on hover or when picker open) */}
      {canReact && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-10 transition-opacity duration-150 ${
            align === "right"
              ? "-left-8"
              : "-right-8"
          } ${showPicker ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker((prev) => !prev);
            }}
            className="w-7 h-7 rounded-full bg-white hover:bg-[#f0f2f5] border border-[#e9edef] shadow-xs text-[#54656f] hover:text-[#00a884] flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="React to message (WhatsApp/Instagram reaction)"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Reaction Bar (WhatsApp / Instagram Quick Reaction Bar) */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            ref={pickerRef}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 5 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className={`absolute bottom-full mb-2 z-30 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-full shadow-xl border border-[#e9edef] flex items-center gap-1.5 select-none ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {QUICK_EMOJIS.map((emoji) => {
              const users = reactions[emoji] || [];
              const isSelected = users.some(
                (u) => u.participantId === currentParticipantId
              );

              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelectEmoji(emoji)}
                  className={`text-xl hover:scale-135 active:scale-95 transition-transform duration-150 p-1 rounded-full cursor-pointer leading-none relative ${
                    isSelected
                      ? "bg-[#d1fae5] scale-110 shadow-xs"
                      : "hover:bg-black/5"
                  }`}
                  title={`${emoji} ${isSelected ? "(Click to remove)" : ""}`}
                >
                  <span>{emoji}</span>
                  {isSelected && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00a884]" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reaction Badges below the message */}
      {reactionEntries.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-1 mt-1.5 ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
        >
          {reactionEntries.map(([emoji, users]) => {
            const hasUserReacted = users.some(
              (u) => u.participantId === currentParticipantId
            );
            const userNames = users.map((u) => u.username).join(", ");

            return (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectEmoji(emoji);
                }}
                title={`Reacted by: ${userNames}`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer active:scale-90 ${
                  hasUserReacted
                    ? "bg-[#e7f7f3] border-[#00a884] text-[#008069] shadow-2xs font-semibold"
                    : "bg-white/90 hover:bg-[#f0f2f5] border-[#e9edef] text-[#54656f] shadow-2xs"
                }`}
              >
                <span className="text-sm leading-none">{emoji}</span>
                <span className="text-[11px] leading-none font-mono">
                  {users.length}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
