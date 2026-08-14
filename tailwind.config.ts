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
          DEFAULT: "#22392f",
          deep: "#17281f",
          ink: "#17362a",
        },
        signal: {
          DEFAULT: "#00a100",
          dark: "#007d00",
        },
        fog: "#f4f5f2",
        concrete: "#dfe3dd",
        border: "#d7ddd8",
        muted: "#69716d",
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
