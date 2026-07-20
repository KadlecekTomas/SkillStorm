import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

/** Token z globals.css s podporou alpha modifikátorů (bg-accent/10 apod.). */
const token = (name: string): string => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Plochy */
        canvas: {
          DEFAULT: token("--canvas"),
          alt: token("--canvas-alt"),
        },
        surface: token("--surface"),
        /* Text */
        ink: {
          DEFAULT: token("--ink"),
          muted: token("--ink-muted"),
          dim: token("--ink-dim"),
        },
        /* Ohraničení */
        line: {
          DEFAULT: token("--line"),
          strong: token("--line-strong"),
        },
        /* Akcent */
        accent: {
          DEFAULT: token("--accent"),
          hover: token("--accent-hover"),
          deep: token("--accent-deep"),
          soft: token("--accent-soft"),
        },
        /* Signály */
        streak: {
          DEFAULT: token("--streak"),
          deep: token("--streak-deep"),
        },
        xp: {
          DEFAULT: token("--xp"),
          deep: token("--xp-deep"),
        },
        danger: {
          DEFAULT: token("--danger"),
          deep: token("--danger-deep"),
          soft: token("--danger-soft"),
        },
        /* Legacy aliasy — držet, dokud běží migrace starých obrazovek (Fáze 4) */
        primary: {
          DEFAULT: token("--accent"),
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: token("--canvas-alt"),
          foreground: token("--ink"),
        },
        muted: token("--surface"),
        slate: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          ...fontFamily.sans,
        ],
        /* Terminál/archiv motiv Misí — IBM Plex Mono */
        mono: ["var(--font-plex-mono)", "IBM Plex Mono", ...fontFamily.mono],
      },
      borderRadius: {
        xl: "0.75rem", // karty
        "2xl": "1rem", // tlačítka, panely
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        /* Taktilní tlačítka: barvu stínu určuje --tactile-shadow na prvku */
        tactile: "0 4px 0 0 var(--tactile-shadow, rgb(var(--line-strong)))",
        "tactile-sm": "0 3px 0 0 var(--tactile-shadow, rgb(var(--line-strong)))",
        "tactile-pressed": "0 0 0 0 var(--tactile-shadow, rgb(var(--line-strong)))",
      },
      keyframes: {
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pop: {
          "0%": { transform: "scale(.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0)" },
          "25%": { transform: "rotate(-5deg)" },
          "75%": { transform: "rotate(5deg)" },
        },
        /* Špatné položení: zatřese a vrátí — iterace, ne verdikt */
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-8px) rotate(-2deg)" },
          "40%": { transform: "translateX(8px) rotate(2deg)" },
          "60%": { transform: "translateX(-6px)" },
          "80%": { transform: "translateX(6px)" },
        },
        /* Kartička usazená v zóně, čeká na soud serveru (200–500 ms wifi) */
        "pending-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.65" },
        },
        /* Clean flash — senior oslava dokončeného kola */
        "board-flash": {
          "0%": { opacity: "0" },
          "30%": { opacity: "0.35" },
          "100%": { opacity: "0" },
        },
        "confetti-fall": {
          "0%": {
            transform: "translateY(-10vh) rotate(0)",
            opacity: "1",
          },
          "100%": {
            transform: "translateY(105vh) rotate(720deg)",
            opacity: "0.3",
          },
        },
      },
      animation: {
        bob: "bob 2.6s ease-in-out infinite",
        pop: "pop .35s ease-out both",
        wiggle: "wiggle .5s ease-in-out",
        shake: "shake .45s ease-in-out",
        "pending-pulse": "pending-pulse 1.1s ease-in-out infinite",
        "board-flash": "board-flash .9s ease-out both",
        "confetti-fall": "confetti-fall 2.6s ease-in both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
