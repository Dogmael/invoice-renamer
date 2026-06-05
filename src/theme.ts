export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "invoicerenamer.theme";

let currentTheme: ThemeMode = "system";
let mediaQuery: MediaQueryList | null = null;

function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
}

function applyThemeToDocument(theme: ThemeMode): void {
  const root = document.documentElement;

  if (theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }

  root.setAttribute("data-theme", theme);
}

function handleSystemThemeChange(): void {
  if (currentTheme === "system") {
    applyThemeToDocument("system");
  }
}

export function getTheme(): ThemeMode {
  return currentTheme;
}

export function setTheme(theme: ThemeMode): void {
  currentTheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  applyThemeToDocument(theme);
}

export function initTheme(): void {
  currentTheme = readStoredTheme();
  applyThemeToDocument(currentTheme);

  mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", handleSystemThemeChange);
}
