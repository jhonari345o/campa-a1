import type { Config } from "tailwindcss";

/**
 * Tokens de marca Ad Mavericks (Manual de identidad v1.0, agosto 2026).
 * La confianza vive en verde profundo; la accion, en verde senal.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: "rgb(var(--color-forest) / <alpha-value>)",
          deep: "rgb(var(--color-forest-deep) / <alpha-value>)",
          ink: "rgb(var(--color-forest-ink) / <alpha-value>)",
        },
        signal: {
          DEFAULT: "rgb(var(--color-signal) / <alpha-value>)",
          dark: "rgb(var(--color-signal-dark) / <alpha-value>)",
        },
        fog: "rgb(var(--color-fog) / <alpha-value>)",
        concrete: "rgb(var(--color-concrete) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        sky: "#4b9eff",
        amber: "#f4bc3b",
        coral: "#ff735c",
      },
      fontFamily: {
        sans: [
          "var(--font-nunito)",
          "Nunito Sans",
          "Avenir Next",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "18px",
        panel: "28px",
        hero: "34px",
      },
      boxShadow: {
        "brand-press": "0 5px 0 var(--shadow-press)",
        panel: "0 12px 35px rgba(31,53,43,.06)",
      },
      letterSpacing: {
        tightest: "-.065em",
      },
    },
  },
  plugins: [],
};

export default config;
