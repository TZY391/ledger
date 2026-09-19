/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#12151A",
        surface: "#1B1F27",
        surface2: "#20242D",
        line: "#2A2F3A",
        text: "#ECE9E2",
        textDim: "#8A8F99",
        gold: "#C9A227",
        rust: "#B0524A",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
