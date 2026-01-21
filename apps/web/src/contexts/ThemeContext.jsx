import { createContext, useContext, useState, useEffect, useCallback } from "react";

// Theme configurations
export const THEMES = {
  light: {
    id: "light",
    name: "Light",
    icon: "☀️",
    colors: {
      bg: "#f5f7fb",
      panel: "#ffffff",
      panelMuted: "#f8fafc",
      border: "#e2e8f0",
      textPrimary: "#0f172a",
      textMuted: "#475569",
      primary: "#4f46e5",
      primaryStrong: "#4338ca",
      success: "#16a34a",
      warning: "#dc2626",
      shadowSm: "0 1px 3px rgba(15, 23, 42, 0.08)",
      shadowMd: "0 10px 30px rgba(15, 23, 42, 0.12)",
    },
  },
  dark: {
    id: "dark",
    name: "Dark",
    icon: "🌙",
    colors: {
      bg: "#0f172a",
      panel: "#1e293b",
      panelMuted: "#334155",
      border: "#475569",
      textPrimary: "#f1f5f9",
      textMuted: "#94a3b8",
      primary: "#818cf8",
      primaryStrong: "#6366f1",
      success: "#22c55e",
      warning: "#f87171",
      shadowSm: "0 1px 3px rgba(0, 0, 0, 0.3)",
      shadowMd: "0 10px 30px rgba(0, 0, 0, 0.4)",
    },
  },
};

// Color scheme presets
export const COLOR_SCHEMES = {
  default: {
    id: "default",
    name: "Default Purple",
    primary: "#4f46e5",
    primaryStrong: "#4338ca",
    accent: "#818cf8",
  },
  ocean: {
    id: "ocean",
    name: "Ocean Blue",
    primary: "#0284c7",
    primaryStrong: "#0369a1",
    accent: "#38bdf8",
  },
  forest: {
    id: "forest",
    name: "Forest Green",
    primary: "#16a34a",
    primaryStrong: "#15803d",
    accent: "#4ade80",
  },
  sunset: {
    id: "sunset",
    name: "Sunset Orange",
    primary: "#ea580c",
    primaryStrong: "#c2410c",
    accent: "#fb923c",
  },
  rose: {
    id: "rose",
    name: "Rose Pink",
    primary: "#e11d48",
    primaryStrong: "#be123c",
    accent: "#fb7185",
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    primary: "#7c3aed",
    primaryStrong: "#6d28d9",
    accent: "#a78bfa",
  },
};

// Accessibility settings
export const DEFAULT_ACCESSIBILITY = {
  highContrast: false,
  reducedMotion: false,
  fontSize: "medium", // small, medium, large, xlarge
  keyboardNavigation: false,
  screenReaderMode: false,
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Load saved preferences from localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved || "light";
  });

  const [colorScheme, setColorScheme] = useState(() => {
    const saved = localStorage.getItem("colorScheme");
    return saved || "default";
  });

  const [accessibility, setAccessibility] = useState(() => {
    const saved = localStorage.getItem("accessibility");
    return saved ? JSON.parse(saved) : DEFAULT_ACCESSIBILITY;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const themeConfig = THEMES[theme];
    const schemeConfig = COLOR_SCHEMES[colorScheme];

    // Set color scheme
    root.style.colorScheme = theme;

    // Apply theme colors
    Object.entries(themeConfig.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Override primary colors from color scheme
    root.style.setProperty("--primary", schemeConfig.primary);
    root.style.setProperty("--primary-strong", schemeConfig.primaryStrong);
    root.style.setProperty("--accent", schemeConfig.accent);

    // Set theme class on body
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);

    // Save to localStorage
    localStorage.setItem("theme", theme);
  }, [theme, colorScheme]);

  // Apply color scheme
  useEffect(() => {
    localStorage.setItem("colorScheme", colorScheme);
  }, [colorScheme]);

  // Apply accessibility settings
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // High contrast
    body.classList.toggle("high-contrast", accessibility.highContrast);

    // Reduced motion
    body.classList.toggle("reduced-motion", accessibility.reducedMotion);

    // Keyboard navigation mode
    body.classList.toggle("keyboard-nav", accessibility.keyboardNavigation);

    // Screen reader mode
    body.classList.toggle("screen-reader-mode", accessibility.screenReaderMode);

    // Font size
    const fontSizes = {
      small: "14px",
      medium: "16px",
      large: "18px",
      xlarge: "20px",
    };
    root.style.setProperty("--base-font-size", fontSizes[accessibility.fontSize]);
    root.style.fontSize = fontSizes[accessibility.fontSize];

    // Save to localStorage
    localStorage.setItem("accessibility", JSON.stringify(accessibility));
  }, [accessibility]);

  // Check for system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const savedTheme = localStorage.getItem("theme");

    // Only auto-switch if user hasn't manually set a theme
    if (!savedTheme) {
      setTheme(mediaQuery.matches ? "dark" : "light");
    }

    const handler = (e) => {
      if (!localStorage.getItem("theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches && !localStorage.getItem("accessibility")) {
      setAccessibility((prev) => ({ ...prev, reducedMotion: true }));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const updateAccessibility = useCallback((key, value) => {
    setAccessibility((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setTheme("light");
    setColorScheme("default");
    setAccessibility(DEFAULT_ACCESSIBILITY);
    localStorage.removeItem("theme");
    localStorage.removeItem("colorScheme");
    localStorage.removeItem("accessibility");
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    colorScheme,
    setColorScheme,
    accessibility,
    setAccessibility,
    updateAccessibility,
    resetSettings,
    isSettingsOpen,
    openSettings,
    closeSettings,
    themeConfig: THEMES[theme],
    schemeConfig: COLOR_SCHEMES[colorScheme],
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export default ThemeContext;
