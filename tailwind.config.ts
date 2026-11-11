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
          DEFAULT: "#D92B74",
          hover: "#C4226A",
          ink: "#FFFFFF",
          muted: "#FFFFFF",
          soft: "rgba(217, 43, 116, 0.12)",
          line: "rgba(217, 43, 116, 0.5)",
        },
        // Marketing / Brand Dark Theme
        dark: {
          bg: {
            0: "#001A33",
            1: "#001A33",
            2: "#05223F",
          },
          surface: {
            1: "#05223F",
            2: "#0B2A48",
            3: "#0B2A48",
          },
          border: {
            subtle: "rgba(255, 255, 255, 0.08)",
            default: "rgba(255, 255, 255, 0.12)",
            strong: "rgba(255, 255, 255, 0.20)",
          },
          text: {
            primary: "#FFFFFF",
            secondary: "#B4BEDB",
            tertiary: "#8E9AC0",
            inverse: "#001A33",
          },
          action: {
            primary: "#D92B74",
            "primary-text": "#001A33",
          },
        },
        // Logged-in product: AMOLED black, flat
        app: {
          bg: "#001A33",
          panel: "#05223F",
          raised: "#0B2A48",
          text: {
            primary: "#FFFFFF",
            secondary: "#B4BEDB",
            tertiary: "#8E9AC0",
          },
        },
      },
      // Accent as text: a lighter tint so small pink text passes AA on every layer
      // (#D92B74 on the card layer is 3.2:1; #FF5C99 is 5.1:1). Fills keep #D92B74, and
      // text on a pink fill is white (4.6:1).
      textColor: {
        accent: {
          DEFAULT: "#FF5C99",
          hover: "#FF7AAD",
          ink: "#FFFFFF",
          muted: "#FFFFFF",
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
