/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx}"],
  darkMode: "class",
  important: true,
  theme: {
    extend: {
      colors: {
        primary: "#ff00c8",
        "background-light": "#FFFFFF",
        "background-dark": "#120B2E",
        "deep-purple": "#2900ff",
        "accent-purple": "#ff00c8",
        "brand-blue": "#120B2E",
        "hero-start": "rgba(45, 27, 105, 0.95)",
        "hero-end": "rgba(230, 0, 126, 0.6)",
      },
      fontFamily: {
        sans: ["Outfit", "sans-serif"],
        display: ["Outfit", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "1rem",
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        glow: "glow 2s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
      },
    },
  },
  plugins: [],
};