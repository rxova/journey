/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./docs/**/*.{md,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf7",
          100: "#d0fbe8",
          200: "#a4f6d4",
          300: "#6debbd",
          400: "#2fd79f",
          500: "#12b886",
          600: "#0f8f6a",
          700: "#0d7256",
          800: "#0b5b45",
          900: "#094c3a"
        },
        ink: {
          50: "#f7f8fa",
          100: "#eef0f4",
          200: "#d8dde6",
          300: "#b5bccb",
          400: "#8993a7",
          500: "#667089",
          600: "#4c556c",
          700: "#3b4256",
          800: "#2b3142",
          900: "#1c2230"
        }
      },
      fontFamily: {
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        soft: "0 20px 60px -30px rgba(15, 118, 110, 0.35)",
        ring: "0 0 0 1px rgba(15, 118, 110, 0.2)"
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(circle at 1px 1px, rgba(12, 74, 110, 0.15) 1px, transparent 0)"
      }
    }
  },
  plugins: []
};
