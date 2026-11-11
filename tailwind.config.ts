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
        // The one colour: about a quarter of every screen (styles/tokens.css)
        accent: {
          DEFAULT: "#F205CF",
          hover: "#FF3DE0",
          ink: "#0A0A0A",
          muted: "#33002C",
          soft: "rgba(242, 5, 207, 0.12)",
          line: "rgba(242, 5, 207, 0.5)",
        },
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
            primary: "#F205CF",
            "primary-text": "#0A0A0A",
          },
        },
        // Logged-in product: AMOLED black, flat
        app: {
          bg: "#000000",
          panel: "#0E0E0E",
          raised: "#181818",
          text: {
            primary: "#F2F2EF",
            secondary: "#9A9A96",
            tertiary: "#85857F",
          },
        },
      },
      boxShadow: {
        // Dark Theme Cards
        "dark-card": "0 0 0 1px rgba(255, 255, 255, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.6)",
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
          "var(--font-geist-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
        display: ["var(--font-archivo)", "var(--font-geist-sans)", "system-ui", "sans-serif"],
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
        // Product motion (transform/opacity only; durations 120–220ms)
        "page-in": {
          from: { opacity: "0.5", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        "overlay-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "overlay-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "drawer-in": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "none" },
        },
        "drawer-out": {
          from: { opacity: "1", transform: "none" },
          to: { opacity: "0", transform: "translateX(24px)" },
        },
        "nav-in": {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to: { opacity: "1", transform: "none" },
        },
        "nav-out": {
          from: { opacity: "1", transform: "none" },
          to: { opacity: "0", transform: "translateX(-24px)" },
        },
        // Centred dialogs keep their -50% x offset inside the keyframes
        "dialog-in": {
          from: { opacity: "0", transform: "translateX(-50%) translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateX(-50%) translateY(0) scale(1)" },
        },
        "dialog-out": {
          from: { opacity: "1", transform: "translateX(-50%) scale(1)" },
          to: { opacity: "0", transform: "translateX(-50%) scale(0.98)" },
        },
        "menu-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "menu-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.96)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
        "row-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "none" },
        },
        // Fills animate from zero to their inline transform value
        "grow-x": { from: { transform: "scaleX(0)" } },
        "grow-y": { from: { transform: "scaleY(0)" } },
        "cell-in": { from: { opacity: "0" } },
        flash: {
          "0%": { opacity: "0" },
          "25%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "line-rise": "line-rise 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 700ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "page-in": "page-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "overlay-in": "overlay-in 160ms ease-out both",
        "overlay-out": "overlay-out 120ms ease-in both",
        "drawer-in": "drawer-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "drawer-out": "drawer-out 140ms ease-in both",
        "nav-in": "nav-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "nav-out": "nav-out 140ms ease-in both",
        "dialog-in": "dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "dialog-out": "dialog-out 120ms ease-in both",
        "menu-in": "menu-in 140ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "menu-out": "menu-out 100ms ease-in both",
        "toast-in": "toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "row-in": "row-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "grow-x": "grow-x 600ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "grow-y": "grow-y 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "cell-in": "cell-in 300ms ease-out both",
        flash: "flash 900ms ease-out both",
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
