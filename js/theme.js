
import { dom } from './dom.js';

export function handleThemeToggle() {
  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  setTheme(next);
}


// Set theme
export function setTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  dom.themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  dom.themeToggle.querySelector(".toggle-icon").textContent = theme === "dark" ? "🌙" : "🌞";
  dom.themeToggle.querySelector(".toggle-text").textContent = `${theme === "dark" ? "Dark" : "Light"} mode`;
  // Add a cookie to save theme
  document.cookie = `theme=${theme}; path=/; max-age=31536000`; // 1 year
}

// Saved theme handling
export function getThemeFromCookie() {
  const match = document.cookie.match(/(?:^|;\s*)theme=([^;]+)/);
  return match ? match[1] : null;
}