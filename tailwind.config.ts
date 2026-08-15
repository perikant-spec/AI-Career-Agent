import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F4F1EA",
        card: "#FFFDF9",
        border: "#E6E1D6",
        "border-strong": "#D8D2C4",
        ink: {
          primary: "#211F1A",
          secondary: "#5C584D",
          tertiary: "#6E6A5F",
          quaternary: "#8C877A",
        },
        sidebar: {
          DEFAULT: "#1B1A17",
          hover: "#282621",
          text: "#EDE9DF",
          "text-dim": "#8C877A",
          border: "#2C2A25",
        },
        accent: {
          teal: "oklch(0.72 0.12 175)",
          "teal-ink": "#10201D",
          link: "oklch(0.52 0.09 190)",
          "link-hover": "oklch(0.42 0.09 190)",
          success: "oklch(0.70 0.11 160)",
          "success-bg": "oklch(0.96 0.04 165)",
          "success-border": "oklch(0.86 0.07 165)",
          "success-text": "oklch(0.42 0.10 165)",
          warning: "oklch(0.78 0.11 75)",
          "warning-bg": "oklch(0.96 0.03 80)",
          "warning-border": "oklch(0.88 0.06 80)",
          risk: "oklch(0.72 0.12 30)",
          "risk-bg": "oklch(0.96 0.04 30)",
          "risk-border": "oklch(0.88 0.06 30)",
          "risk-text": "oklch(0.44 0.11 40)",
        },
      },
      fontFamily: {
        serif: ["var(--font-instrument-serif)", "Georgia", "serif"],
        sans: ["var(--font-instrument-sans)", "Helvetica", "Arial", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      borderRadius: {
        card: "16px",
        btn: "10px",
        pill: "999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
