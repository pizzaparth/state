import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Marketing / Brand Dark Theme
        dark: {
          bg: {
            0: "#050505",
            1: "#080808",
            2: "#0D0D0D",
          },
          surface: {
            1: "#111111",
            2: "#161616",
            3: "#1C1C1C",
          },
          border: {
            subtle: "rgba(255, 255, 255, 0.08)",
            default: "rgba(255, 255, 255, 0.12)",
            strong: "rgba(255, 255, 255, 0.20)",
          },
          text: {
            primary: "#F4F4F2",
            secondary: "#A9A9A6",
            tertiary: "#6F6F6B",
            inverse: "#0A0A0A",
          },
          action: {
            primary: "#F2F2EF",
            "primary-text": "#0A0A0A",
          },
        },
        // Logged-in Product Pale Neumorphic Theme
        app: {
          bg: {
            DEFAULT: "#D9D9D5",
            soft: "#E1E1DD",
          },
          surface: {
            raised: "#DEDEDA",
            "raised-light": "#E6E6E2",
            inset: "#D2D2CE",
            inverse: "#101010",
            "inverse-2": "#171717",
          },
          text: {
            primary: "#171717",
            secondary: "#5F5F5B",
            tertiary: "#8B8B86",
            inverse: "#F2F2EF",
          },
        },
      },
      boxShadow: {
        // Product Neumorphic Shadows
        "neu-raised": "-8px -8px 20px rgba(255, 255, 255, 0.70), 8px 8px 20px rgba(0, 0, 0, 0.10)",
        "neu-raised-sm": "-3px -3px 8px rgba(255, 255, 255, 0.65), 3px 3px 8px rgba(0, 0, 0, 0.10)",
        "neu-raised-xs": "-2px -2px 5px rgba(255, 255, 255, 0.60), 2px 2px 5px rgba(0, 0, 0, 0.08)",
        "neu-inset": "inset 3px 3px 8px rgba(0, 0, 0, 0.09), inset -3px -3px 8px rgba(255, 255, 255, 0.70)",
        "neu-inset-sm": "inset 2px 2px 5px rgba(0, 0, 0, 0.08), inset -2px -2px 5px rgba(255, 255, 255, 0.65)",
        // Dark Theme Cards
        "dark-card": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.6)",
        "dark-glow": "0 0 20px rgba(255, 255, 255, 0.05)",
      },
      borderRadius: {
        control: "12px",
        input: "16px",
        task: "16px",
        card: "24px",
        module: "32px",
      },
      fontFamily: {
        sans: [
          "var(--font-michroma)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
        display: ["var(--font-michroma)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "line-rise": {
          from: { transform: "translateY(105%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "line-rise": "line-rise 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      letterSpacing: {
        display: "-0.03em",
        eyebrow: "0.12em",
      },
    },
  },
  plugins: [],
};

export default config;
