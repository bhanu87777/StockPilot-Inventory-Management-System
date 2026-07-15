"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// The theme lives on <html data-theme> (stamped pre-paint by the inline
// script in layout.tsx). React reads it through useSyncExternalStore, so
// there's no hydration-effect dance; toggle() mutates the DOM + localStorage
// and notifies subscribers.

const EVENT = "sp-theme-change";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function getServerSnapshot(): Theme {
  return "light";
}

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("sp-theme", next);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
