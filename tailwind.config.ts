import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1E7FC4",
          accent: "#3FB6F0",
          navy: "#0A2540",
        },
        surface: "#F5F7FA",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        muted: "#6B7280",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
