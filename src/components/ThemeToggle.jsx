import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export const ThemeToggle = ({ id = 'theme-toggle-btn', className = '' }) => {
  const { isDark, toggleTheme } = useTheme();

  const title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  const ariaLabel = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

  return (
    <button
      id={id}
      type="button"
      onClick={toggleTheme}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={isDark}
      className={`theme-toggle-btn w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-1 active:scale-95 ${
        isDark
          ? 'bg-[#111b21] border-[#222e35] text-amber-400 hover:text-amber-300 hover:bg-[#202c33]'
          : 'bg-white border-[#e9edef] text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-200 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
};
