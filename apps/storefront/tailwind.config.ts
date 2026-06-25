/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f6f8",
          100: "#e8ecf0",
          200: "#c9d2dc",
          300: "#9aabb9",
          400: "#6b8294",
          500: "#4a6275",
          600: "#354a5c",
          700: "#2a3b4a",
          800: "#1f2d38",
          900: "#152028",
          950: "#0c1419",
        },
        accent: {
          50: "#fdf6ef",
          100: "#f8e8d6",
          200: "#efcfad",
          300: "#e4b07f",
          400: "#d8934f",
          500: "#c47a2e",
          600: "#a86124",
          700: "#8a4c1f",
          800: "#6f3d1c",
          900: "#5a3219",
        },
        surface: {
          DEFAULT: "#faf9f7",
          muted: "#f3f1ed",
          card: "#ffffff",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(12 20 25 / 0.06), 0 1px 2px -1px rgb(12 20 25 / 0.06)",
        elevated: "0 10px 40px -12px rgb(12 20 25 / 0.15)",
      },
      backgroundImage: {
        "hero-pattern":
          "radial-gradient(circle at 20% 20%, rgb(196 122 46 / 0.18), transparent 45%), radial-gradient(circle at 80% 0%, rgb(53 74 92 / 0.25), transparent 40%)",
      },
    },
  },
  plugins: [],
};
