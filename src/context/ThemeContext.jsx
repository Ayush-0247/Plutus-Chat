import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'plutus-theme';
const DEFAULT_THEME = 'light';

export const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: false,
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          return stored;
        }
      }
    } catch (e) {
      console.warn('Unable to access localStorage for theme preference:', e);
    }
    return DEFAULT_THEME;
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (e) {
      console.warn('Unable to save theme preference to localStorage:', e);
    }

    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
      document.body.setAttribute('data-theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
      document.body.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        isDark: theme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
