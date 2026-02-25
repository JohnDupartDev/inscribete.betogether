// src/scripts/theme.ts

export function initTheme() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  btn.onclick = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };
}

export function applyInitialTheme() {
  const storedTheme = localStorage.getItem("theme");

  const theme =
    storedTheme ??
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");

  document.documentElement.classList.toggle("dark", theme === "dark");
}