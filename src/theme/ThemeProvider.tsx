import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

type ThemeMode = "dark" | "light";

type ThemeState = {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
};

const storageKey = "drakkar-theme";
const ThemeContext = createContext<ThemeState | null>(null);

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo<ThemeState>(() => ({
    theme,
    toggleTheme: () => setThemeState((current) => current === "dark" ? "light" : "dark"),
    setTheme: setThemeState
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
