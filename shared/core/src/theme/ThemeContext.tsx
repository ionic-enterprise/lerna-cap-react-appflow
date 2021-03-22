import React, { createContext, useContext, useEffect, useState } from "react";

const initialContext = {
  isDarkMode: false,
  toggleDarkMode: (_: boolean) => {},
};

const ThemeContext = createContext(initialContext);
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC = ({ children }) => {
  const [isDarkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    prefersDark.addEventListener("change", (e) => setDarkMode(e.matches));
    toggleDarkMode(prefersDark.matches);
  }, []);

  const toggleDarkMode = (useDarkMode: boolean) => {
    document.body.classList.toggle("dark", useDarkMode);
    setDarkMode(useDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
