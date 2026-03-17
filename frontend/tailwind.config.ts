import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors
        brand: {
          cream: "#F9FEF5",
          black: "#000000",
        },
        // Base Colors (Greens)
        primary: {
          light: "#7F8790",
          DEFAULT: "#8F92A1",
          dark: "#F8F8F8",
        },
        // Legacy colors (keeping for compatibility)
        neutral: "#2E2E2E",
        accent: "#4C6EF5",
        success: "#28A745",
        warning: "#FF6B35",
        gold: "#FFD700",
      },
    },
  },
  plugins: [],
};
export default config;
